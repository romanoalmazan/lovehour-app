# LoveHour App

A React Native app for couples to share hourly photo updates throughout their day.

## Features

- Email/Password and Google Sign-In authentication
- Friend code-based partner matching
- Camera-only photo uploads with hourly restrictions
- Real-time photo gallery with date grouping
- Goodnight/Good Morning updates with awake/asleep status
- Delete photo functionality
- Real-time updates via Firestore

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase project with Authentication, Firestore, and Storage enabled

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google)
3. Create Firestore database
4. Create Storage bucket
5. Copy your Firebase config to `config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

6. Add Google OAuth client IDs to `contexts/AuthContext.tsx`:
```typescript
iosClientId: 'YOUR_IOS_CLIENT_ID',
androidClientId: 'YOUR_ANDROID_CLIENT_ID',
webClientId: 'YOUR_WEB_CLIENT_ID',
```

### 3. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /photos/{photoId} {
        allow read: if request.auth != null && 
          (request.auth.uid == userId || 
           get(/databases/$(database)/documents/users/$(userId)).data.matchedWith != null);
        allow create, update, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 4. Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/images/{allPaths=**} {
      allow read: if request.auth != null;
      allow write, delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## How to Run

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Project Structure

```
loveHour-app/
├── App.tsx                    # Main app and navigation
├── screens/                   # Screen components
│   ├── AuthScreen.tsx        # Sign in/up
│   ├── UserProfileSetupScreen.tsx
│   ├── HomeScreen.tsx        # Match status
│   ├── ChoosePartnerScreen.tsx # Friend code matching
│   └── LoveHourScreen.tsx    # Main photo gallery
├── services/
│   └── userService.ts        # All backend functions
├── contexts/
│   └── AuthContext.tsx       # Authentication
├── config/
│   └── firebase.ts           # Firebase config
└── utils/
    └── friendCodeGenerator.ts
```

## Key Functions

### User & Profile
- `getUserData(uid)` - Get user data
- `createUserProfile(uid, profileData)` - Create profile
- `subscribeToUserData(uid, callback)` - Real-time user updates

### Matching
- `findUserByFriendCode(code)` - Find user by code
- `matchUsers(userId, partnerCode)` - Match two users
- `unmatchUsers(userId)` - Unmatch users
- `verifyMutualMatch(userId)` - Verify match validity

### Photos
- `uploadUserImage(userId, imageUri, caption)` - Upload photo
- `deleteUserPhoto(userId, photoId)` - Delete photo
- `getUserPhotos(userId)` - Get all photos
- `subscribeToUserPhotos(userId, callback)` - Real-time photo updates

### Daily Updates
- `sendGoodnightUpdate(userId, imageUri, caption)` - Send goodnight
- `sendGoodmorningUpdate(userId, imageUri, caption)` - Send good morning
- `canUploadInCurrentHour(userId)` - Check upload permission
- `getCurrentHourWindow()` - Get current hour (0-23)

## Screens

1. **AuthScreen** - Sign in/sign up with Email or Google
2. **UserProfileSetupScreen** - Create profile (name, gender, friend code)
3. **HomeScreen** - View match status, unmatch option
4. **ChoosePartnerScreen** - Match using friend codes
5. **LoveHourScreen** - Main screen with photo gallery and upload

## Key Features

- **Friend Codes:** 6-character unique codes for private matching
- **Hourly Restrictions:** One photo upload per hour window
- **Awake/Asleep Status:** Goodnight sets to asleep, good morning to awake
- **Real-time Updates:** Photos sync instantly via Firestore subscriptions
- **Camera Only:** Photos must be taken with camera (no gallery selection)

## Troubleshooting

**Firebase errors:** Check config values and ensure services are enabled in Firebase Console

**Google Sign-In not working:** Verify OAuth client IDs match your app bundle identifier/package name

**Photo upload fails:** Check camera permissions and Storage security rules

**Build errors:** Clear cache with `expo start -c` or delete `node_modules` and reinstall

**Match not working:** Verify friend code format (6 characters) and both users have completed profiles

## Technology Stack

- React Native with Expo
- TypeScript
- Firebase (Auth, Firestore, Storage)
- React Navigation
