# Push Notifications Setup Guide

## Overview

The app now supports push notifications that work **even when the app is closed**. When a matched user sends an update, their partner will receive a push notification.

## How It Works

### Current Implementation (Client-Side)

The app currently sends push notifications from the client when a photo is uploaded. This works but has limitations:
- ✅ Works when app is in background
- ⚠️ May not work reliably when app is completely closed
- ⚠️ Uses client-side API calls (less secure)

### Recommended Implementation (Cloud Functions)

For production, use Firebase Cloud Functions (see `cloud-functions-example.js`):
- ✅ Works even when app is completely closed
- ✅ More reliable and scalable
- ✅ More secure (no API keys in client)
- ✅ Better error handling

## Setup Instructions

### Option 1: Client-Side (Current - Works for Testing)

The current implementation is already set up and will work for testing. It:
1. Registers push tokens when users log in
2. Stores tokens in Firestore
3. Sends notifications via Expo's API when photos are uploaded

**What's already done:**
- ✅ Push token registration on login
- ✅ Token storage in Firestore
- ✅ Notification sending on photo upload

**To test:**
1. Make sure both users are logged in on physical devices
2. Have one user send an update
3. The other user should receive a push notification

### Option 2: Cloud Functions (Recommended for Production)

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Functions:**
   ```bash
   firebase init functions
   ```
   - Select JavaScript or TypeScript
   - Install dependencies when prompted

4. **Install Expo Server SDK:**
   ```bash
   cd functions
   npm install expo-server-sdk
   ```

5. **Copy Cloud Function:**
   - Copy the code from `cloud-functions-example.js` to `functions/index.js`
   - Or integrate it into your existing functions file

6. **Deploy:**
   ```bash
   firebase deploy --only functions
   ```

7. **Remove client-side notification sending:**
   - Once Cloud Functions are deployed, you can remove the push notification code from `uploadUserImage`, `sendGoodnightUpdate`, and `sendGoodmorningUpdate` in `userService.ts`
   - The Cloud Function will handle it automatically

## How Push Notifications Work

1. **Token Registration:**
   - When a user logs in, `initializeNotifications()` is called
   - This registers for push notifications and gets an Expo push token
   - The token is saved to Firestore in the user's document

2. **When a Photo is Uploaded:**
   - User uploads a photo via `uploadUserImage()`, `sendGoodnightUpdate()`, or `sendGoodmorningUpdate()`
   - The function gets the partner's push token from Firestore
   - Sends a push notification via Expo's API (or Cloud Function triggers automatically)

3. **Notification Delivery:**
   - Expo's push notification service delivers the notification
   - Works on iOS and Android
   - Works even when app is closed (with Cloud Functions)

## Testing

1. **On Physical Devices:**
   - Push notifications only work on physical devices, not simulators
   - Make sure both users are logged in on separate devices
   - Have one user send an update
   - The other user should receive a notification

2. **Check Token Registration:**
   - Check Firestore: `users/{userId}` document should have a `pushToken` field
   - If missing, the user needs to log in again to register

3. **Troubleshooting:**
   - Check console logs for errors
   - Verify push tokens are stored in Firestore
   - Make sure notification permissions are granted
   - For Cloud Functions, check Firebase Console > Functions > Logs

## Important Notes

- **Physical Devices Only:** Push notifications don't work on simulators/emulators
- **Permissions:** Users must grant notification permissions
- **Token Updates:** Tokens can change, so they're re-registered on each login
- **Cloud Functions Recommended:** For production, use Cloud Functions instead of client-side sending

## Files Modified

- `services/notificationService.ts` - Added push token registration and sending
- `services/userService.ts` - Added functions to save/get push tokens, and send notifications on upload
- `cloud-functions-example.js` - Example Cloud Function for production use

## Next Steps

1. Test the current client-side implementation
2. Set up Cloud Functions for production
3. Remove client-side notification sending once Cloud Functions are deployed
4. Monitor notification delivery in Firebase Console


