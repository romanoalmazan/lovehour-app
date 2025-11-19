import { 
  doc, 
  getDoc, 
  getDocFromCache,
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  collection,
  serverTimestamp,
  onSnapshot,
  enableNetwork
} from 'firebase/firestore';
import { db, initializeFirestore } from '../config/firebase';
import { generateFriendCode } from '../utils/friendCodeGenerator';

/**
 * Wait for Firestore to be ready and online
 * This is critical for React Native where Firestore can report offline incorrectly
 */
const waitForFirestoreReady = async (maxRetries: number = 5): Promise<void> => {
  // First, ensure Firestore is initialized
  await initializeFirestore();
  
  // Wait for network to be enabled and connection established
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Enable network
      await enableNetwork(db);
      
      // Wait progressively longer with each retry to allow connection to establish
      const waitTime = Math.min(500 * (attempt + 1), 2000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // If we get here without error, network should be enabled
      // The actual query will tell us if we're truly connected
      if (attempt === 0) {
        console.log('Firestore network enabled, ready for queries');
      } else {
        console.log(`Firestore network enabled after ${attempt + 1} attempts`);
      }
      return;
    } catch (error) {
      console.warn(`Firestore ready check attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  // If we get here, we couldn't enable network but proceed anyway
  console.warn('Could not fully enable Firestore network, proceeding anyway');
};

export interface UserData {
  friendCode: string;
  matchedWith: string | null;
  createdAt: any;
  email?: string;
  displayName?: string;
}

/**
 * Get user data from Firestore, create document if it doesn't exist
 * Handles offline scenarios by trying cache as fallback
 */
export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userRef = doc(db, 'users', uid);
  
  // Wait for Firestore to be ready and connected
  await waitForFirestoreReady();
  
  try {
    // Try to get from server first
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserData;
    } else {
      // Document doesn't exist, create new one
      // Only create if we're online (can't create offline without network)
      try {
        const friendCode = await generateUniqueFriendCode();
        const newUserData: UserData = {
          friendCode,
          matchedWith: null,
          createdAt: serverTimestamp(),
        };
        
        await setDoc(userRef, newUserData);
        return newUserData;
      } catch (createError: any) {
        // Log the actual error for debugging
        console.error('Error creating user document:', createError.code, createError.message);
        
        // If offline, we can't create new documents
        if (createError.code === 'unavailable' || createError.message?.includes('offline')) {
          console.warn('Cannot create user document while offline');
          return null;
        }
        
        // If permission denied, this is a security rules issue
        if (createError.code === 'permission-denied') {
          console.error('Permission denied - check Firestore security rules');
          throw new Error('Permission denied. Please check Firestore security rules.');
        }
        
        throw createError;
      }
    }
  } catch (error: any) {
    // Log the actual error code and message
    console.error('Error getting user data:', error.code, error.message, error);
    
    // If offline error, wait for connection and retry with exponential backoff
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.log('Offline detected, waiting for Firestore connection and retrying...');
      
      // Wait for Firestore to be ready with more retries
      try {
        await waitForFirestoreReady(10); // More retries for this case
        
        // Retry the query
        const retrySnap = await getDoc(userRef);
        if (retrySnap.exists()) {
          return retrySnap.data() as UserData;
        }
        
        // If document doesn't exist, try to create it
        const friendCode = await generateUniqueFriendCode();
        const newUserData: UserData = {
          friendCode,
          matchedWith: null,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, newUserData);
        return newUserData;
      } catch (retryError: any) {
        // If retry fails, try cache as last resort
        try {
          console.log('Retry failed, trying cache...');
          const cachedSnap = await getDocFromCache(userRef);
          if (cachedSnap.exists()) {
            return cachedSnap.data() as UserData;
          }
        } catch (cacheError) {
          console.warn('No cached data available:', cacheError);
        }
        
        // If everything fails, throw with helpful message
        throw new Error('Unable to connect to Firestore. Please check your internet connection and Firestore database is active.');
      }
    }
    
    // If permission denied, throw a more specific error
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules are published.');
    }
    
    // For other errors, throw them so we can see what's wrong
    throw error;
  }
};

/**
 * Generate a unique friend code that doesn't exist in Firestore
 */
const generateUniqueFriendCode = async (): Promise<string> => {
  let code = generateFriendCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const codeQuery = query(
        collection(db, 'users'),
        where('friendCode', '==', code)
      );
      const querySnapshot = await getDocs(codeQuery);

      if (querySnapshot.empty) {
        return code;
      }
    } catch (error: any) {
      // If offline, we can't check uniqueness, so generate a more unique code
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        console.warn('Offline: generating code with timestamp for uniqueness');
        return code + Date.now().toString().slice(-4);
      }
      // For other errors, continue trying
    }

    code = generateFriendCode();
    attempts++;
  }

  // Fallback: append timestamp if we can't find unique code
  return code + Date.now().toString().slice(-2);
};

/**
 * Check if user is matched with someone
 */
export const checkMatchStatus = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return userData?.matchedWith !== null && userData?.matchedWith !== undefined;
  } catch (error) {
    console.error('Error checking match status:', error);
    return false;
  }
};

/**
 * Find user by friend code
 */
export const findUserByFriendCode = async (friendCode: string): Promise<string | null> => {
  // Wait for Firestore to be ready
  await waitForFirestoreReady();
  
  try {
    const codeQuery = query(
      collection(db, 'users'),
      where('friendCode', '==', friendCode.toUpperCase())
    );
    const querySnapshot = await getDocs(codeQuery);

    if (querySnapshot.empty) {
      return null;
    }

    return querySnapshot.docs[0].id; // Return the UID
  } catch (error: any) {
    console.error('Error finding user by friend code:', error);
    
    // If offline, wait and retry once
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      try {
        await waitForFirestoreReady(5);
        const codeQuery = query(
          collection(db, 'users'),
          where('friendCode', '==', friendCode.toUpperCase())
        );
        const querySnapshot = await getDocs(codeQuery);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].id;
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    
    return null;
  }
};

/**
 * Match two users by friend codes
 */
export const matchUsers = async (currentUserId: string, partnerFriendCode: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Get current user data
    const currentUserData = await getUserData(currentUserId);
    
    if (!currentUserData) {
      return { success: false, message: 'User data not found' };
    }

    // Check if current user is already matched
    if (currentUserData.matchedWith) {
      return { success: false, message: 'You are already matched with someone' };
    }

    // Check if user is trying to match with themselves
    if (currentUserData.friendCode.toUpperCase() === partnerFriendCode.toUpperCase()) {
      return { success: false, message: 'You cannot match with yourself' };
    }

    // Find partner by friend code
    const partnerUserId = await findUserByFriendCode(partnerFriendCode);
    
    if (!partnerUserId) {
      return { success: false, message: 'Invalid friend code' };
    }

    // Get partner data
    const partnerUserData = await getUserData(partnerUserId);
    
    if (!partnerUserData) {
      return { success: false, message: 'Partner user data not found' };
    }

    // Check if partner is already matched
    if (partnerUserData.matchedWith) {
      return { success: false, message: 'This user is already matched with someone else' };
    }

    // Create bidirectional match
    const currentUserRef = doc(db, 'users', currentUserId);
    const partnerUserRef = doc(db, 'users', partnerUserId);

    await Promise.all([
      updateDoc(currentUserRef, { matchedWith: partnerUserId }),
      updateDoc(partnerUserRef, { matchedWith: currentUserId }),
    ]);

    return { success: true, message: 'Successfully matched!' };
  } catch (error: any) {
    console.error('Error matching users:', error);
    return { success: false, message: error.message || 'Failed to match users' };
  }
};

/**
 * Subscribe to user data changes
 */
export const subscribeToUserData = (
  uid: string,
  callback: (userData: UserData | null) => void
): (() => void) => {
  const userRef = doc(db, 'users', uid);
  
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as UserData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to user data:', error);
    callback(null);
  });
};

