/**
 * Firebase Cloud Function Example
 * 
 * This function automatically sends push notifications when a user uploads a photo.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Initialize: firebase init functions
 * 4. Install dependencies: cd functions && npm install expo-server-sdk
 * 5. Deploy: firebase deploy --only functions
 * 
 * This is the RECOMMENDED approach for production as it:
 * - Works even when the app is closed
 * - Doesn't expose API keys in the client
 * - Is more reliable and scalable
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

admin.initializeApp();

// Initialize Expo SDK
const expo = new Expo();

/**
 * Cloud Function that triggers when a photo is uploaded
 * This sends a push notification to the user's partner
 */
exports.sendPhotoUploadNotification = functions.firestore
  .document('users/{userId}/photos/{photoId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const photoData = snap.data();

    try {
      // Get the user's data to find their partner
      const userDoc = await admin.firestore().doc(`users/${userId}`).get();
      const userData = userDoc.data();

      if (!userData || !userData.matchedWith) {
        console.log('User not matched, skipping notification');
        return null;
      }

      // Get partner's data and push token
      const partnerDoc = await admin.firestore().doc(`users/${userData.matchedWith}`).get();
      const partnerData = partnerDoc.data();

      if (!partnerData || !partnerData.pushToken) {
        console.log('Partner has no push token, skipping notification');
        return null;
      }

      // Get partner's name for personalization
      const partnerName = partnerData.fullName || partnerData.displayName || 'Your Partner';

      // Prepare push notification message
      const messages = [{
        to: partnerData.pushToken,
        sound: 'default',
        title: `New Update from ${partnerName}! 💕`,
        body: 'Your partner just shared a new photo',
        data: { 
          type: 'partner_update',
          userId: userId,
          photoId: snap.id
        },
        priority: 'high',
      }];

      // Send the notification
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      // Check for errors
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          console.error('Push notification error:', ticket.message);
          // If token is invalid, remove it from Firestore
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            await admin.firestore().doc(`users/${userData.matchedWith}`).update({
              pushToken: admin.firestore.FieldValue.delete()
            });
          }
        }
      }

      console.log('Push notification sent successfully');
      return null;
    } catch (error) {
      console.error('Error in sendPhotoUploadNotification:', error);
      return null;
    }
  });

/**
 * Optional: Function to send notification when users match
 */
exports.sendMatchNotification = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const userId = context.params.userId;

    // Check if user just got matched (matchedWith changed from null to a value)
    if (!before.matchedWith && after.matchedWith) {
      try {
        // Get partner's push token
        const partnerDoc = await admin.firestore().doc(`users/${after.matchedWith}`).get();
        const partnerData = partnerDoc.data();

        if (partnerData && partnerData.pushToken) {
          const messages = [{
            to: partnerData.pushToken,
            sound: 'default',
            title: 'You have a new match! 💕',
            body: 'Start sharing your LoveHour updates!',
            data: { type: 'match' },
            priority: 'high',
          }];

          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
          }
        }
      } catch (error) {
        console.error('Error sending match notification:', error);
      }
    }

    return null;
  });

