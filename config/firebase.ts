import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Firebase config
// Get these values from your Firebase Console: Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: "AIzaSyCZeVwhqGnFdDF2mGzgso45ZH0_jBGg49Q",
  authDomain: "lovehour-6c07a.firebaseapp.com",
  projectId: "lovehour-6c07a",
  storageBucket: "lovehour-6c07a.firebasestorage.app",
  messagingSenderId: "382263225060",
  appId: "1:382263225060:web:c4c001a30bc198aa39daf1",
  measurementId: "G-RZYCRY9EZM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
let auth;
try {
  // Import getReactNativePersistence with type assertion since it may not be in types
  // but exists in the runtime for React Native compatibility
  const { getReactNativePersistence } = require('firebase/auth') as any;
  
  if (getReactNativePersistence && typeof getReactNativePersistence === 'function') {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    // Fallback if not available: initialize without persistence
    auth = initializeAuth(app);
  }
} catch (error: any) {
  // If already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    // Final fallback: use getAuth (will show warning but auth will work)
    auth = getAuth(app);
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

// Track if Firestore network has been enabled
let firestoreNetworkEnabled = false;

/**
 * Ensure Firestore network is enabled (safe to call multiple times)
 */
const ensureFirestoreNetwork = async (): Promise<void> => {
  if (firestoreNetworkEnabled) {
    return; // Already enabled
  }

  try {
    await enableNetwork(db);
    firestoreNetworkEnabled = true;
    console.log('Firestore network enabled');
  } catch (error) {
    console.error('Failed to enable Firestore network:', error);
    throw error;
  }
};

export { auth, db, storage, ensureFirestoreNetwork };
export default app;

