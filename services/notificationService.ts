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
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Schedule notifications based on user's upload interval
 * Only schedules when user is awake
 * @param userId - The user ID
 * @param isAwake - Whether the user is currently awake
 */
export const scheduleHourlyNotifications = async (userId: string, isAwake: boolean): Promise<void> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:61',message:'scheduleHourlyNotifications called',data:{isAwake,scheduledCountBefore:scheduledNotificationIds.length,isScheduling},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // Prevent concurrent scheduling
  if (isScheduling) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:63',message:'Scheduling already in progress, skipping',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return;
  }
  isScheduling = true;
  try {
    // Cancel existing notifications first
    await cancelHourlyNotifications();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:64',message:'After cancelHourlyNotifications',data:{scheduledCountAfter:scheduledNotificationIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!isAwake) {
      console.log('User is asleep, not scheduling hourly notifications');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot schedule notifications without permission');
      return;
    }

    // Get user's upload interval setting (default to 1 hour)
    let intervalHours = 1;
    try {
      const userData = await getUserData(userId);
      intervalHours = userData?.uploadIntervalHours || 1;
    } catch (error) {
      console.error('Error getting user data for notification scheduling:', error);
    }

    const now = new Date();
    const newNotificationIds: string[] = [];

    // Schedule notifications for the next 24 hours based on interval
    // Calculate how many intervals fit in 24 hours
    const intervalsIn24Hours = Math.ceil(24 / intervalHours);
    
    for (let i = 1; i <= intervalsIn24Hours; i++) {
      const notificationTime = new Date(now);
      // Add i * intervalHours to current time
      notificationTime.setHours(notificationTime.getHours() + (i * intervalHours), 0, 0, 0);

      // Don't schedule beyond 24 hours from now
      if (notificationTime.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
        break;
      }

      const intervalText = intervalHours === 1 ? 'hour' : `${intervalHours} hours`;
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time for an Update! 🌅',
          body: `You can now upload a new update to your partner (every ${intervalText})`,
          sound: true,
          data: { type: 'hourly' },
        },
        trigger: {
          type: 'date',
          date: notificationTime,
        },
      });

      newNotificationIds.push(notificationId);
    }

    scheduledNotificationIds = newNotificationIds;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:103',message:'Notifications scheduled',data:{newCount:newNotificationIds.length,notificationIds:newNotificationIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log(`Scheduled ${newNotificationIds.length} hourly notifications`);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:106',message:'Error scheduling',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error scheduling hourly notifications:', error);
  } finally {
    isScheduling = false;
  }
};

/**
 * Schedule a notification for when the user can upload again based on their last upload timestamp and interval
 * @param userId - The user ID
 */
export const scheduleNextUploadNotification = async (userId: string): Promise<void> => {
  try {
    // Cancel existing notifications first
    await cancelHourlyNotifications();

    // Check if notifications are enabled
    const userData = await getUserData(userId);
    if (userData?.notificationsEnabled === false) {
      console.log('Notifications are disabled, not scheduling');
      return;
    }

    // Check if user is awake
    if (userData?.isAwake === false) {
      console.log('User is asleep, not scheduling notification');
      return;
    }

    // Check if user has uploaded before
    if (!userData?.lastUploadTimestamp) {
      console.log('User has not uploaded yet, not scheduling notification');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot schedule notification without permission');
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
      return;
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
  }
};

/**
 * Cancel all scheduled hourly notifications
 */
export const cancelHourlyNotifications = async (): Promise<void> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:113',message:'cancelHourlyNotifications called',data:{toCancelCount:scheduledNotificationIds.length,ids:scheduledNotificationIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    for (const notificationId of scheduledNotificationIds) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
    scheduledNotificationIds = [];
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:118',message:'Cancellation complete',data:{remainingCount:scheduledNotificationIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.log('Cancelled all hourly notifications');
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:121',message:'Error cancelling',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Error cancelling hourly notifications:', error);
  }
};

/**
 * Send immediate notification when partner uploads a new photo
 * @param partnerName - Optional partner name for personalization
 */
export const sendPartnerUpdateNotification = async (partnerName?: string): Promise<void> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:129',message:'sendPartnerUpdateNotification called',data:{partnerName},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:132',message:'No permission for partner notification',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      console.warn('Cannot send notification without permission');
      return;
    }

    const title = partnerName 
      ? `New Update from ${partnerName}! 💕`
      : 'New Update from Partner! 💕';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:141',message:'Calling presentNotificationAsync for immediate notification',data:{title},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Use presentNotificationAsync for immediate notifications instead of scheduleNotificationAsync
    await Notifications.presentNotificationAsync({
      title,
      body: 'Your partner just shared a new photo',
      sound: true,
      data: { type: 'partner_update' },
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:152',message:'presentNotificationAsync completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    console.log('Sent partner update notification');
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:154',message:'Error sending partner notification',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error sending partner update notification:', error);
  }
};

/**
 * Update notification schedule based on user awake status
 * @param userId - The user ID
 * @param isAwake - Whether the user is currently awake
 */
export const updateNotificationSchedule = async (userId: string, isAwake: boolean): Promise<void> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:162',message:'updateNotificationSchedule called',data:{isAwake},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  // If user is awake and notifications are enabled, schedule next upload notification
  // Otherwise, cancel all notifications
  try {
    const userData = await getUserData(userId);
    if (isAwake && userData?.notificationsEnabled !== false) {
      await scheduleNextUploadNotification(userId);
    } else {
      await cancelHourlyNotifications();
    }
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:171',message:'checkAndNotifyPartnerUpdate called',data:{currentPhotoCount,lastPartnerPhotoCount,mostRecentPhotoId,lastPartnerPhotoId,isInitialized,partnerName},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Check if there's a new photo by comparing the most recent photo ID
  // This is more reliable than just counting photos
  const hasNewPhoto = isInitialized && 
    mostRecentPhotoId !== null && 
    mostRecentPhotoId !== lastPartnerPhotoId &&
    (currentPhotoCount > lastPartnerPhotoCount || lastPartnerPhotoId === null);
  
  if (hasNewPhoto) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:176',message:'Condition met, calling sendPartnerUpdateNotification',data:{currentPhotoCount,lastPartnerPhotoCount,mostRecentPhotoId,lastPartnerPhotoId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    await sendPartnerUpdateNotification(partnerName);
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:179',message:'Condition not met, skipping notification',data:{isInitialized,currentPhotoCount,lastPartnerPhotoCount,mostRecentPhotoId,lastPartnerPhotoId,hasNewPhoto},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return null;
    }

    // Get the push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '2e9bb7e4-8905-4a69-b4de-2eae549fdfbe', // From app.json extra.eas.projectId
    });
    const pushToken = tokenData.data;

    // Save token to Firestore
    if (pushToken) {
      await savePushToken(userId, pushToken);
      console.log('Push token registered and saved:', pushToken);
    }

    return pushToken;
  } catch (error: any) {
    console.error('Error registering for push notifications:', error);
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
    const title = partnerName 
      ? `New Update from ${partnerName}! 💕`
      : 'New Update from Partner! 💕';

    // Send push notification via Expo's API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: partnerPushToken,
        sound: 'default',
        title: title,
        body: 'Your partner just shared a new photo',
        data: { type: 'partner_update' },
        priority: 'high',
      }),
    });

    const result = await response.json();
    if (result.data?.status === 'ok') {
      console.log('Push notification sent successfully');
    } else {
      console.error('Failed to send push notification:', result);
    }
  } catch (error: any) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * Initialize notification service
 * Should be called when app starts or user logs in
 * @param userId - The user ID
 * @param isAwake - Initial awake status
 */
export const initializeNotifications = async (userId: string, isAwake: boolean): Promise<void> => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/ef6cb03f-12f2-44a7-bf63-f808211cd3b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notificationService.ts:189',message:'initializeNotifications called',data:{isAwake},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
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
