'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, getDbInstance } from './firebase';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type UserAccessStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  status: UserAccessStatus;
  createdAt: unknown;
  requestedAt?: unknown;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshUserData: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch or create user document from Firestore
  const fetchUserData = useCallback(async (firebaseUser: User) => {
    const db = getDbInstance();
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserData;
      // Default existing users without status to APPROVED so existing accounts are active
      if (!data.status) {
        data.status = data.isAdmin ? 'APPROVED' : 'APPROVED';
      }
      setUserData(data);
    } else {
      // Create document for new users. Default status is PENDING unless isAdmin: true
      const newUser: UserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'User',
        isAdmin: false,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        requestedAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
      setUserData(newUser);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user) {
      await fetchUserData(user);
    }
  }, [user, fetchUserData]);

  // Listen for auth state changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  // ─── Auth Methods ───────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, displayName: string) => {
    const auth = getAuthInstance();
    const db = getDbInstance();

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(credential.user, { displayName });

    const newUser: UserData = {
      uid: credential.user.uid,
      email,
      displayName,
      isAdmin: false,
      status: 'PENDING',
      createdAt: serverTimestamp(),
      requestedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), newUser);
    setUserData(newUser);
  };

  const signIn = async (email: string, password: string) => {
    const auth = getAuthInstance();
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const auth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    const auth = getAuthInstance();
    await firebaseSignOut(auth);
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, userData, loading, signIn, signUp, signInWithGoogle, signOut, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
