import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// Initialize Auth (persistence is handled automatically in React Native)
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

export { auth, db };
export default app;

