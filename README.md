# LoveHour App

A React Native app with Firebase authentication supporting Email and Google sign-in.

## Features

- 🔐 Firebase Authentication
  - Email/Password sign up and sign in
  - Google Sign-In
- 🎨 Modern UI with smooth navigation
- 📱 Cross-platform (iOS and Android)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase project set up
- For iOS: Xcode
- For Android: Android Studio

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google (add OAuth client IDs)
4. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll down to "Your apps" and add iOS/Android apps if needed
   - Copy the config values

5. Update `config/firebase.ts` with your Firebase config:
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

### 3. Google Sign-In Setup

1. In Firebase Console, go to Authentication > Sign-in method > Google
2. Enable Google sign-in
3. Get your OAuth client IDs from Google Cloud Console
4. Update `contexts/AuthContext.tsx`:
   ```typescript
   iosClientId: 'YOUR_IOS_CLIENT_ID',
   androidClientId: 'YOUR_ANDROID_CLIENT_ID',
   webClientId: 'YOUR_WEB_CLIENT_ID',
   ```

### 4. Run the App

```bash
# Start the Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
loveHour-app/
├── App.tsx                 # Main app entry point
├── index.ts                # Expo entry point
├── config/
│   └── firebase.ts        # Firebase configuration
├── contexts/
│   └── AuthContext.tsx   # Authentication context provider
├── screens/
│   ├── AuthScreen.tsx     # Sign in/up screen
│   └── ThankYouScreen.tsx # Post-authentication screen
└── package.json
```

## Notes

- Make sure to replace all placeholder values (YOUR_API_KEY, etc.) with your actual Firebase credentials
- Google Sign-In requires proper OAuth client IDs for each platform
- The app uses AsyncStorage for auth persistence

## Troubleshooting

- **Firebase errors**: Make sure all Firebase services are enabled in your Firebase Console
- **Google Sign-In not working**: Verify OAuth client IDs are correct and match your app's bundle identifier

