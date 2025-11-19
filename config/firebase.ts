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

// Promise to track when Firestore is ready
let firestoreReadyPromise: Promise<void> | null = null;

/**
 * Initialize and wait for Firestore to be ready
 */
const initializeFirestore = async (): Promise<void> => {
  if (firestoreReadyPromise) {
    return firestoreReadyPromise;
  }

  firestoreReadyPromise = (async () => {
    try {
      // Enable network
      await enableNetwork(db);
      console.log('Firestore network enabled');
      
      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try a test operation to verify connection
      // We'll do this in userService instead to avoid circular dependencies
      console.log('Firestore initialization complete');
    } catch (error) {
      console.error('Firestore initialization error:', error);
      // Retry after delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        await enableNetwork(db);
        console.log('Firestore network enabled on retry');
      } catch (retryError) {
        console.error('Firestore network enable retry failed:', retryError);
        throw retryError;
      }
    }
  })();

  return firestoreReadyPromise;
};

// Start initialization immediately
initializeFirestore().catch(console.error);

export { auth, db, initializeFirestore };
export default app;

