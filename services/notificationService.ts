import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getCurrentHourWindow, getTimeUntilNextHour, getUserData, savePushToken, getPartnerPushToken } from './userService';

// Dynamically import expo-device (may not be installed)
let Device: any = null;
try {
  Device = require('expo-device');
} catch (e) {
  console.warn('expo-device not installed. Push notifications may not work on simulators.');
}

// Configure notification handler behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Store scheduled notification IDs for cancellation
let scheduledNotificationIds: string[] = [];
let lastPartnerPhotoCount: number = 0;
let lastPartnerPhotoId: string | null = null; // Track the most recent photo ID
let isInitialized: boolean = false;
let isScheduling: boolean = false; // Prevent concurrent scheduling

/**
 * Request notification permissions from the user
 * @returns Promise with permission status
 */
export const requestPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log(`Requesting notification permissions (current status: ${existingStatus})`);
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log(`Notification permission request result: ${status}`);
    } else {
      console.log('Notification permissions already granted');
    }

    if (finalStatus !== 'granted') {
      console.warn(`Notification permissions not granted. Status: ${finalStatus}`);
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        console.warn('Android 13+ requires POST_NOTIFICATIONS permission. Please check app permissions in settings.');
      }
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
        });
        console.log('Android notification channel configured successfully');
      } catch (channelError: any) {
        console.error('Error setting up Android notification channel:', {
          error: channelError.message || channelError,
          platform: Platform.OS,
          version: Platform.Version,
        });
        // Don't fail permission request if channel setup fails - channel might already exist
      }
    }

    return true;
  } catch (error: any) {
    console.error('Error requesting notification permissions:', {
      error: error.message || error,
      stack: error.stack,
      platform: Platform.OS,
      version: Platform.Version,
    });
    return false;
  }
};

/**
 * Schedule notifications based on user's upload interval
 * Only schedules when user is awake
 * @param userId - The user ID
 * @param isAwake - Whether the user is currently awake
 */
/**
 * @deprecated This function is deprecated. Use scheduleNextUploadNotification instead.
 * This function now redirects to scheduleNextUploadNotification to prevent hourly notifications.
 */
export const scheduleHourlyNotifications = async (userId: string, isAwake: boolean): Promise<void> => {
  // DEPRECATED: Redirect to the new function instead of scheduling hourly notifications
  console.warn('scheduleHourlyNotifications is deprecated. Redirecting to scheduleNextUploadNotification.');
  // Cancel any existing hourly notifications first
  await cancelHourlyNotifications();
  // Use the new function that schedules only the next upload notification
  await scheduleNextUploadNotification(userId);
};

/**
 * Schedule a notification for when the user can upload again based on their last upload timestamp and interval
 * @param userId - The user ID
 */
export const scheduleNextUploadNotification = async (userId: string): Promise<void> => {
  // Prevent concurrent scheduling
  if (isScheduling) {
    console.log('Notification scheduling already in progress, skipping duplicate call');
    return;
  }

  isScheduling = true;

  try {
    // Cancel ALL existing upload interval notifications first
    await cancelHourlyNotifications();

    // Check if notifications are enabled
    const userData = await getUserData(userId);
    if (userData?.notificationsEnabled === false) {
      console.log('Notifications are disabled, not scheduling');
      isScheduling = false;
      return;
    }

    // Check if user is awake
    if (userData?.isAwake === false) {
      console.log('User is asleep, not scheduling notification');
      isScheduling = false;
      return;
    }

    // Check if user has uploaded before
    if (!userData?.lastUploadTimestamp) {
      console.log('User has not uploaded yet, not scheduling notification');
      isScheduling = false;
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot schedule notification without permission');
      isScheduling = false;
      return;
    }

    // Get upload interval (default to 1 hour)
    const intervalHours = userData?.uploadIntervalHours || 1;

    // Calculate next notification time
    const lastUploadTime = userData.lastUploadTimestamp.toDate 
      ? userData.lastUploadTimestamp.toDate() 
      : new Date(userData.lastUploadTimestamp);
    
    const nextNotificationTime = new Date(lastUploadTime);
    nextNotificationTime.setHours(nextNotificationTime.getHours() + intervalHours);

    // Don't schedule if the time has already passed
    if (nextNotificationTime.getTime() <= Date.now()) {
      console.log('Next upload time has already passed, not scheduling');
      isScheduling = false;
      return;
    }

    // Double-check: Cancel any remaining notifications before scheduling
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
      if (notification.content?.data?.type === 'upload_interval' || notification.content?.data?.type === 'hourly') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log('Cancelled duplicate notification:', notification.identifier);
      }
    }

    const intervalText = intervalHours === 1 ? 'hour' : `${intervalHours} hours`;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for an Update! 🌅',
        body: `You can now upload a new update to your partner (every ${intervalText})`,
        sound: true,
        data: { type: 'upload_interval' },
      },
      trigger: {
        type: 'date',
        date: nextNotificationTime,
      },
    });

    scheduledNotificationIds = [notificationId];
    console.log(`Scheduled next upload notification for ${nextNotificationTime.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling next upload notification:', error);
  } finally {
    isScheduling = false;
  }
};

/**
 * Cancel all scheduled hourly and upload interval notifications
 */
export const cancelHourlyNotifications = async (): Promise<void> => {
  try {
    // Get all scheduled notifications from the system to check what's actually scheduled
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    // Cancel all tracked notifications
    for (const notificationId of scheduledNotificationIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (error) {
        // Notification might already be cancelled, ignore error
        console.log('Notification already cancelled or not found:', notificationId);
      }
    }
    
    // IMPORTANT: Cancel ALL notifications from the system that have type 'hourly' OR 'upload_interval'
    // This ensures we cancel all upload-related notifications, even if old code scheduled them
    let cancelledCount = 0;
    for (const notification of allScheduled) {
      const notificationType = notification.content?.data?.type;
      if (notificationType === 'hourly' || notificationType === 'upload_interval') {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          cancelledCount++;
        } catch (error) {
          // Notification might already be cancelled, ignore error
          console.log('Error cancelling notification:', notification.identifier);
        }
      }
    }
    
    scheduledNotificationIds = [];
    if (cancelledCount > 0) {
      console.log(`Cancelled ${cancelledCount} upload interval notification(s)`);
    }
  } catch (error) {
    console.error('Error cancelling hourly notifications:', error);
  }
};

/**
 * Send immediate notification when partner uploads a new photo
 * @param partnerName - Optional partner name for personalization
 */
export const sendPartnerUpdateNotification = async (partnerName?: string): Promise<void> => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot send local notification without permission');
      return;
    }

    const title = partnerName 
      ? `New Update from ${partnerName}! 💕`
      : 'New Update from Partner! 💕';
    
    // Use presentNotificationAsync for immediate notifications instead of scheduleNotificationAsync
    await Notifications.presentNotificationAsync({
      title,
      body: 'Your partner just shared a new photo',
      sound: true,
      data: { type: 'partner_update' },
    });

    console.log('Local partner update notification sent successfully');
  } catch (error: any) {
    console.error('Error sending local partner update notification:', {
      error: error.message || error,
      stack: error.stack,
      platform: Platform.OS,
    });
  }
};

/**
 * Update notification schedule based on user awake status
 * @param userId - The user ID
 * @param isAwake - Whether the user is currently awake
 */
export const updateNotificationSchedule = async (userId: string, isAwake: boolean): Promise<void> => {
  // IMPORTANT: Always cancel hourly notifications first to prevent old code from scheduling them
  await cancelHourlyNotifications();
  // If user is awake and notifications are enabled, schedule next upload notification
  // Otherwise, cancel all notifications (already done above)
  try {
    const userData = await getUserData(userId);
    if (isAwake && userData?.notificationsEnabled !== false) {
      await scheduleNextUploadNotification(userId);
    }
    // Note: cancelHourlyNotifications was already called at the start, so we don't need to call it again here
  } catch (error) {
    console.error('Error updating notification schedule:', error);
  }
};

/**
 * Check for new partner photos and send notification if detected
 * @param photos - Array of partner photos (ordered by createdAt desc)
 * @param partnerName - Optional partner name
 */
export const checkAndNotifyPartnerUpdate = async (
  photos: Array<{ id?: string }>,
  partnerName?: string
): Promise<void> => {
  const currentPhotoCount = photos.length;
  const mostRecentPhotoId = photos.length > 0 && photos[0].id ? photos[0].id : null;
  
  // Check if there's a new photo by comparing the most recent photo ID
  // This is more reliable than just counting photos
  const hasNewPhoto = isInitialized && 
    mostRecentPhotoId !== null && 
    mostRecentPhotoId !== lastPartnerPhotoId &&
    (currentPhotoCount > lastPartnerPhotoCount || lastPartnerPhotoId === null);
  
  if (hasNewPhoto) {
    await sendPartnerUpdateNotification(partnerName);
  }
  
  // Update state after checking (this ensures next call will have isInitialized = true)
  lastPartnerPhotoCount = currentPhotoCount;
  lastPartnerPhotoId = mostRecentPhotoId;
  isInitialized = true;
};

/**
 * Register for push notifications and save token to Firestore
 * @param userId - The user ID
 * @returns The push token or null if registration failed
 */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  try {
    // Check if running on a physical device (if expo-device is available)
    if (Device && !Device.isDevice) {
      console.warn('Push notifications only work on physical devices, not simulators/emulators');
      return null;
    }

    // Request permissions
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot register for push notifications without permission');
      return null;
    }

    // Get the push token
    console.log('Requesting Expo push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '2e9bb7e4-8905-4a69-b4de-2eae549fdfbe', // From app.json extra.eas.projectId
    });
    const pushToken = tokenData.data;

    if (!pushToken) {
      console.error('Failed to get push token - token data is empty');
      return null;
    }

    console.log(`Push token received (${pushToken.substring(0, 20)}...)`);

    // Save token to Firestore
    try {
      await savePushToken(userId, pushToken);
      console.log('Push token saved to Firestore successfully');
    } catch (saveError: any) {
      console.error('Error saving push token to Firestore:', {
        error: saveError.message || saveError,
        userId,
      });
      // Still return the token even if saving fails - token is valid
    }

    return pushToken;
  } catch (error: any) {
    console.error('Error registering for push notifications:', {
      error: error.message || error,
      stack: error.stack,
      platform: Platform.OS,
      userId,
    });
    return null;
  }
};

/**
 * Send push notification to partner when user uploads a photo
 * This should be called from a Cloud Function, but we provide a client-side version for testing
 * @param partnerPushToken - Partner's Expo push token
 * @param partnerName - Optional partner name
 */
export const sendPushNotificationToPartner = async (
  partnerPushToken: string,
  partnerName?: string
): Promise<void> => {
  try {
    // Ensure Android notification channel is set up before sending
    if (Platform.OS === 'android') {
      await requestPermissions(); // This will set up the channel if it doesn't exist
    }

    const title = partnerName 
      ? `New Update from ${partnerName}! 💕`
      : 'New Update from Partner! 💕';

    // Build notification payload
    const notificationPayload: any = {
      to: partnerPushToken,
      sound: 'default',
      title: title,
      body: 'Your partner just shared a new photo',
      data: { type: 'partner_update' },
      priority: 'high',
    };

    // Add Android-specific fields
    if (Platform.OS === 'android') {
      notificationPayload.channelId = 'default';
    }

    console.log(`Sending push notification to partner (${Platform.OS}):`, {
      token: partnerPushToken.substring(0, 20) + '...',
      title,
      channelId: Platform.OS === 'android' ? 'default' : undefined,
    });

    // Send push notification via Expo's API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push notification API error (${response.status}):`, errorText);
      throw new Error(`Failed to send push notification: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Check response structure - Expo API can return data as array or object
    const notifications = Array.isArray(result.data) ? result.data : [result.data];
    const allSuccessful = notifications.every((item: any) => item?.status === 'ok');
    
    if (allSuccessful) {
      console.log('Push notification sent successfully to partner');
    } else {
      const errors = notifications
        .filter((item: any) => item?.status !== 'ok')
        .map((item: any) => item?.message || item?.status)
        .join(', ');
      console.error('Failed to send push notification:', {
        result,
        errors,
      });
      throw new Error(`Push notification delivery failed: ${errors}`);
    }
  } catch (error: any) {
    console.error('Error sending push notification to partner:', {
      error: error.message || error,
      stack: error.stack,
      platform: Platform.OS,
    });
    // Don't throw - we don't want to fail the upload if notification fails
  }
};

/**
 * Initialize notification service
 * Should be called when app starts or user logs in
 * @param userId - The user ID
 * @param isAwake - Initial awake status
 */
export const initializeNotifications = async (userId: string, isAwake: boolean): Promise<void> => {
  await requestPermissions();
  
  // Register for push notifications
  await registerForPushNotifications(userId);
  
  // Schedule next upload notification based on last upload timestamp
  await scheduleNextUploadNotification(userId);
  isInitialized = false; // Reset for new session
  lastPartnerPhotoCount = 0;
  lastPartnerPhotoId = null;
};

/**
 * Reset notification state (call on logout)
 */
export const resetNotifications = async (): Promise<void> => {
  await cancelHourlyNotifications();
  isInitialized = false;
  lastPartnerPhotoCount = 0;
  lastPartnerPhotoId = null;
};

/**
 * Get all scheduled notifications (for debugging)
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  return await Notifications.getAllScheduledNotificationsAsync();
};
