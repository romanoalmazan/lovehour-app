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
  addDoc,
  serverTimestamp,
  onSnapshot,
  enableNetwork,
  runTransaction,
  arrayUnion,
  orderBy
} from 'firebase/firestore';
import { db, storage, ensureFirestoreNetwork } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { generateFriendCode } from '../utils/friendCodeGenerator';

/**
 * Ensure Firestore is ready for operations
 */
const ensureFirestoreReady = async (): Promise<void> => {
  await ensureFirestoreNetwork();
};

export interface UserData {
  friendCode: string;
  matchedWith: string | null;
  createdAt: any;
  email?: string;
  displayName?: string;
  fullName?: string;
  gender?: 'male' | 'female' | 'other';
  photos?: string[];
}

export interface Photo {
  id?: string;
  url: string;
  caption: string;
  createdAt: any;
}

/**
 * Get user data from Firestore, create document if it doesn't exist
 * Handles offline scenarios by trying cache as fallback
 */
export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userRef = doc(db, 'users', uid);

  // Wait for Firestore to be ready and connected
  await ensureFirestoreReady();
  
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
          await ensureFirestoreReady();
        
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
      const existingUser = await findUserByFriendCode(code);
      if (!existingUser) {
        return code; // Code is unique
      }
    } catch (error: any) {
      console.warn(`Error checking code uniqueness for ${code}:`, error);

      // If offline or network error, we can't guarantee uniqueness
      // Generate a more unique code using timestamp
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        console.warn('Offline: generating code with timestamp for uniqueness');
        return code + Date.now().toString().slice(-4);
      }

      // For permission errors, we can't check uniqueness
      if (error.code === 'permission-denied') {
        console.warn('Permission denied checking code uniqueness, using timestamp fallback');
        return code + Date.now().toString().slice(-4);
      }

      // For other errors, continue trying with a new code
    }

    code = generateFriendCode();
    attempts++;
  }

  // Fallback: append timestamp if we can't find unique code after max attempts
  console.warn(`Could not generate unique code after ${maxAttempts} attempts, using timestamp fallback`);
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
 * Verify that a match is mutual and valid
 */
export const verifyMutualMatch = async (uid: string): Promise<{ isValid: boolean; partnerData?: UserData; reason?: string }> => {
  try {
    const userData = await getUserData(uid);

    if (!userData?.matchedWith) {
      return { isValid: false, reason: 'User is not matched' };
    }

    const partnerData = await getUserData(userData.matchedWith);

    if (!partnerData) {
      return { isValid: false, reason: 'Partner data not found' };
    }

    // Check if partner also has this user as matchedWith
    if (partnerData.matchedWith !== uid) {
      return { isValid: false, reason: 'Match is not mutual' };
    }

    return { isValid: true, partnerData };
  } catch (error) {
    console.error('Error verifying mutual match:', error);
    return { isValid: false, reason: 'Error verifying match' };
  }
};

/**
 * Unmatch users (for cases where match becomes invalid)
 */
export const unmatchUsers = async (currentUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    await ensureFirestoreReady();

    const verification = await verifyMutualMatch(currentUserId);

    if (!verification.isValid) {
      return { success: false, message: verification.reason || 'Match is not valid' };
    }

    const partnerId = verification.partnerData?.matchedWith;
    if (!partnerId) {
      return { success: false, message: 'Partner ID not found' };
    }

    // Use transaction to unmatch both users atomically
    await runTransaction(db, async (transaction) => {
      const currentUserRef = doc(db, 'users', currentUserId);
      const partnerUserRef = doc(db, 'users', partnerId);

      transaction.update(currentUserRef, { matchedWith: null });
      transaction.update(partnerUserRef, { matchedWith: null });
    });

    return { success: true, message: 'Successfully unmatched' };
  } catch (error: any) {
    console.error('Error unmatching users:', error);
    return { success: false, message: error.message || 'Failed to unmatch' };
  }
};

/**
 * Find user by friend code with retry logic
 */
export const findUserByFriendCode = async (friendCode: string): Promise<string | null> => {
  const normalizedCode = friendCode.toUpperCase();

  // Wait for Firestore to be ready
  await ensureFirestoreReady();

  let lastError: any = null;

  // Try up to 3 times with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const codeQuery = query(
        collection(db, 'users'),
        where('friendCode', '==', normalizedCode)
      );
      const querySnapshot = await getDocs(codeQuery);

      if (querySnapshot.empty) {
        return null; // Code doesn't exist, not an error
      }

      // Validate that we got exactly one result
      if (querySnapshot.docs.length > 1) {
        console.warn(`Multiple users found with friend code ${normalizedCode}. This should not happen.`);
        // Return the first one, but this indicates a data integrity issue
      }

      return querySnapshot.docs[0].id; // Return the UID
    } catch (error: any) {
      console.error(`Error finding user by friend code (attempt ${attempt + 1}):`, error);
      lastError = error;

      // If it's a network error, wait and retry
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        if (attempt < 2) { // Don't wait after the last attempt
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          console.log(`Network error, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          await ensureFirestoreReady(); // Re-establish connection
        }
      } else {
        // For non-network errors (like permission denied), don't retry
        break;
      }
    }
  }

  // If we get here, all retries failed
  console.error('Failed to find user by friend code after all retries:', lastError);
  return null;
};

/**
 * Match two users by friend codes using a Firestore transaction for atomicity
 */
export const matchUsers = async (currentUserId: string, partnerFriendCode: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Wait for Firestore to be ready
    await ensureFirestoreReady();

    // Find partner by friend code first
    const partnerUserId = await findUserByFriendCode(partnerFriendCode);

    if (!partnerUserId) {
      return { success: false, message: 'Invalid friend code. Please check the code and try again.' };
    }

    if (partnerUserId === currentUserId) {
      return { success: false, message: 'You cannot match with yourself' };
    }

    // Use transaction to ensure atomic matching
    const result = await runTransaction(db, async (transaction) => {
      // Get both user documents
      const currentUserRef = doc(db, 'users', currentUserId);
      const partnerUserRef = doc(db, 'users', partnerUserId);

      const [currentUserSnap, partnerUserSnap] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(partnerUserRef)
      ]);

      // Check if documents exist
      if (!currentUserSnap.exists()) {
        throw new Error('Your user data was not found. Please try logging out and back in.');
      }

      if (!partnerUserSnap.exists()) {
        throw new Error('Partner user data not found. The friend code may be invalid.');
      }

      const currentUserData = currentUserSnap.data() as UserData;
      const partnerUserData = partnerUserSnap.data() as UserData;

      // Check if current user is already matched
      if (currentUserData.matchedWith) {
        throw new Error('You are already matched with someone. Please unmatch first if you want to match with someone else.');
      }

      // Check if partner is already matched
      if (partnerUserData.matchedWith) {
        throw new Error('This user is already matched with someone else. Please try a different friend code.');
      }

      // Check if user is trying to match with themselves (double check)
      if (currentUserData.friendCode.toUpperCase() === partnerFriendCode.toUpperCase()) {
        throw new Error('You cannot match with yourself');
      }

      // Perform the mutual match
      transaction.update(currentUserRef, { matchedWith: partnerUserId });
      transaction.update(partnerUserRef, { matchedWith: currentUserId });

      return { success: true, message: 'Successfully matched! You can now start your Love Hour together.' };
    });

    return result;
  } catch (error: any) {
    console.error('Error matching users:', error);

    // Handle specific transaction errors
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      return { success: false, message: 'Network connection lost. Please check your internet connection and try again.' };
    }

    if (error.code === 'permission-denied') {
      return { success: false, message: 'Permission denied. Please check Firestore security rules.' };
    }

    // Return the error message or a generic one
    return { success: false, message: error.message || 'Failed to match with partner. Please try again.' };
  }
};

/**
 * Create a complete user profile with friend code after sign-up
 */
export const createUserProfile = async (
  uid: string,
  profileData: { fullName: string; gender: 'male' | 'female' | 'other' }
): Promise<{ success: boolean; message: string }> => {
  try {
    await ensureFirestoreReady();

    // Generate a unique friend code
    const friendCode = await generateUniqueFriendCode();

    // Create the complete user document
    const userRef = doc(db, 'users', uid);
    const userData: UserData = {
      friendCode,
      matchedWith: null,
      createdAt: serverTimestamp(),
      fullName: profileData.fullName,
      gender: profileData.gender,
    };

    await setDoc(userRef, userData);

    return { success: true, message: 'Profile created successfully!' };
  } catch (error: any) {
    console.error('Error creating user profile:', error);
    return { success: false, message: error.message || 'Failed to create profile' };
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

/**
 * Get user photos from Firestore subcollection
 * @param userId - The user ID
 * @returns Promise with array of Photo objects, ordered by createdAt descending
 */
export const getUserPhotos = async (userId: string): Promise<Photo[]> => {
  try {
    await ensureFirestoreReady();

    const photosCollection = collection(db, 'users', userId, 'photos');
    const photosQuery = query(photosCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(photosQuery);

    const photos: Photo[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      photos.push({
        id: doc.id,
        url: data.url,
        caption: data.caption || '',
        createdAt: data.createdAt
      });
    });

    return photos;
  } catch (error: any) {
    console.error('Error fetching user photos:', error);
    // If subcollection doesn't exist or is empty, return empty array
    return [];
  }
};

/**
 * Upload user image to Firebase Storage and save URL with caption to Firestore subcollection
 * @param userId - The user ID
 * @param imageUri - Local URI of the image to upload
 * @param caption - Required caption for the image
 * @returns Promise with download URL or error
 */
export const uploadUserImage = async (
  userId: string,
  imageUri: string,
  caption: string
): Promise<{ success: boolean; downloadURL?: string; error?: string }> => {
  try {
    // Validate caption
    if (!caption || caption.trim().length === 0) {
      return {
        success: false,
        error: 'Caption is required'
      };
    }

    // Wait for Firestore to be ready
    await ensureFirestoreReady();

    // 1. Convert URI to Blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // 2. Create a reference to the file in Firebase Storage
    const timestamp = Date.now();
    const filename = `users/${userId}/images/${timestamp}.jpg`;
    const storageRef = ref(storage, filename);

    // 3. Upload the file
    const uploadTask = uploadBytesResumable(storageRef, blob);

    // Wait for upload to complete
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking (optional - can be used for UI)
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload progress:', Math.round(progress) + '%');
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully
          resolve();
        }
      );
    });

    // 4. Get the download URL
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

    // 5. Save to Firestore subcollection with caption
    const photosCollection = collection(db, 'users', userId, 'photos');
    await addDoc(photosCollection, {
      url: downloadURL,
      caption: caption.trim(),
      createdAt: serverTimestamp()
    });

    return { success: true, downloadURL };
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload image'
    };
  }
};

