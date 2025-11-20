import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserData } from '../services/userService';
import * as Google from 'expo-auth-session/providers/google';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileComplete: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  markProfileComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    // TODO: Replace with your Google OAuth client IDs
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        // Check if user has a complete profile (has friendCode, fullName, and gender)
        try {
          const userData = await getUserData(user.uid);
          setProfileComplete(!!(userData?.friendCode && userData?.fullName && userData?.gender));
        } catch (error) {
          console.error('Error checking user profile:', error);
          setProfileComplete(false);
        }
      } else {
        setProfileComplete(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (id_token) {
        const credential = GoogleAuthProvider.credential(id_token);
        signInWithCredential(auth, credential).catch((error) => {
          console.error('Google sign-in error:', error);
        });
      }
    } else if (response?.type === 'error') {
      console.error('Google sign-in error:', response.error);
    }
  }, [response]);

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    // New users must complete their profile (friendCode, fullName, gender)
    setProfileComplete(false);
  };

  const signInWithGoogle = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfileComplete(false); // Reset profile complete on sign out
  };

  const markProfileComplete = () => {
    setProfileComplete(true);
  };

  const value: AuthContextType = {
    user,
    loading,
    profileComplete,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    markProfileComplete,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

