import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getCurrentHourWindow, getTimeUntilNextHour } from './userService';

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
let isInitialized: boolean = false;

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
 * Schedule hourly notifications for the next 24 hours
 * Only schedules when user is awake
 * @param isAwake - Whether the user is currently awake
 */
export const scheduleHourlyNotifications = async (isAwake: boolean): Promise<void> => {
  try {
    // Cancel existing notifications first
    await cancelHourlyNotifications();

    if (!isAwake) {
      console.log('User is asleep, not scheduling hourly notifications');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.warn('Cannot schedule notifications without permission');
      return;
    }

    const now = new Date();
    const newNotificationIds: string[] = [];

    // Schedule notifications for the next 24 hours
    // Start from the next hour (i=1 means 1 hour from now)
    for (let i = 1; i <= 24; i++) {
      const notificationTime = new Date(now);
      // Add i hours to current time, then set to the start of that hour
      notificationTime.setHours(notificationTime.getHours() + i, 0, 0, 0);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Hour Started! 🌅',
          body: 'You can now upload a new update to your partner',
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
    console.log(`Scheduled ${newNotificationIds.length} hourly notifications`);
  } catch (error) {
    console.error('Error scheduling hourly notifications:', error);
  }
};

/**
 * Cancel all scheduled hourly notifications
 */
export const cancelHourlyNotifications = async (): Promise<void> => {
  try {
    for (const notificationId of scheduledNotificationIds) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
    scheduledNotificationIds = [];
    console.log('Cancelled all hourly notifications');
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
      console.warn('Cannot send notification without permission');
      return;
    }

    const title = partnerName 
      ? `New Update from ${partnerName}! 💕`
      : 'New Update from Partner! 💕';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: 'Your partner just shared a new photo',
        sound: true,
        data: { type: 'partner_update' },
      },
      // Omit trigger for immediate notification, or use null
      trigger: null,
    });

    console.log('Sent partner update notification');
  } catch (error) {
    console.error('Error sending partner update notification:', error);
  }
};

/**
 * Update notification schedule based on user awake status
 * @param isAwake - Whether the user is currently awake
 */
export const updateNotificationSchedule = async (isAwake: boolean): Promise<void> => {
  await scheduleHourlyNotifications(isAwake);
};

/**
 * Check for new partner photos and send notification if detected
 * @param currentPhotoCount - Current number of partner photos
 * @param partnerName - Optional partner name
 */
export const checkAndNotifyPartnerUpdate = async (
  currentPhotoCount: number,
  partnerName?: string
): Promise<void> => {
  // Only send notification if this is not the initial load
  if (isInitialized && currentPhotoCount > lastPartnerPhotoCount) {
    await sendPartnerUpdateNotification(partnerName);
  }
  
  lastPartnerPhotoCount = currentPhotoCount;
  isInitialized = true;
};

/**
 * Initialize notification service
 * Should be called when app starts or user logs in
 * @param isAwake - Initial awake status
 */
export const initializeNotifications = async (isAwake: boolean): Promise<void> => {
  await requestPermissions();
  await scheduleHourlyNotifications(isAwake);
  isInitialized = false; // Reset for new session
  lastPartnerPhotoCount = 0;
};

/**
 * Reset notification state (call on logout)
 */
export const resetNotifications = async (): Promise<void> => {
  await cancelHourlyNotifications();
  isInitialized = false;
  lastPartnerPhotoCount = 0;
};

/**
 * Get all scheduled notifications (for debugging)
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  return await Notifications.getAllScheduledNotificationsAsync();
};
