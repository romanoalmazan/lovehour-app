import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork } from 'firebase/firestore';

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

// Initialize Auth
// Note: For AsyncStorage persistence, you may need to upgrade Firebase or use a different approach
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

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

export { auth, db, ensureFirestoreNetwork };
export default app;

