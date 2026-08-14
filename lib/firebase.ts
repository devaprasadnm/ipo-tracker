import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialization — avoids errors during static export (build time)
// Firebase is only initialized when actually needed in the browser
function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

// Lazy getters — these are safe to call at module scope because they
// only initialize Firebase when accessed for the first time in the browser
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getAuthInstance(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

export function getDbInstance(): Firestore {
  if (!_db) {
    _db = getFirestore(getFirebaseApp());
  }
  return _db;
}

// Convenient accessors for client components (these will throw during SSR/build,
// which is fine because they're only used in 'use client' components)
export const auth = typeof window !== 'undefined' ? getAuthInstance() : (null as unknown as Auth);
export const db = typeof window !== 'undefined' ? getDbInstance() : (null as unknown as Firestore);

export default getFirebaseApp;
