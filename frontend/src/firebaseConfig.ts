import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "PLACEHOLDER_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cottagecommons.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cottagecommons-ledger",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cottagecommons-ledger.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "PLACEHOLDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "PLACEHOLDER_APP_ID"
};

export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey !== "PLACEHOLDER_API_KEY" &&
    firebaseConfig.apiKey.trim().length > 0
  );
}

export function getFirebaseProjectId(): string {
  return firebaseConfig.projectId;
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  try {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (error) {
    console.error("Firebase App initialization failed:", error);
    return null;
  }
}

export function getFirestoreDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (error) {
    console.error("Firestore initialization failed:", error);
    return null;
  }
}

// Default export for backwards compatibility
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export default app;
