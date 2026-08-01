import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const FALLBACK_PROJECT_ID = 'fellowship-of-the-hearth';
const FIREBASE_INIT_URL = '/__/firebase/init.json';

const envFirebaseConfig: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '',
};

let runtimeFirebaseConfig: FirebaseWebConfig | null = null;
let runtimeFirebaseConfigPromise: Promise<FirebaseWebConfig | null> | null = null;

function hasRequiredConfig(config: FirebaseWebConfig | null): config is FirebaseWebConfig {
  return Boolean(
    config &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId,
  );
}

function getActiveFirebaseConfig(): FirebaseWebConfig | null {
  if (hasRequiredConfig(envFirebaseConfig)) return envFirebaseConfig;
  if (hasRequiredConfig(runtimeFirebaseConfig)) return runtimeFirebaseConfig;
  return null;
}

function readRuntimeConfig(json: unknown): FirebaseWebConfig | null {
  if (!json || typeof json !== 'object') return null;
  const record = json as Record<string, unknown>;
  const config: FirebaseWebConfig = {
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : '',
    authDomain: typeof record.authDomain === 'string' ? record.authDomain.trim() : '',
    projectId: typeof record.projectId === 'string' ? record.projectId.trim() : '',
    storageBucket: typeof record.storageBucket === 'string' ? record.storageBucket.trim() : '',
    messagingSenderId:
      typeof record.messagingSenderId === 'string' ? record.messagingSenderId.trim() : '',
    appId: typeof record.appId === 'string' ? record.appId.trim() : '',
  };
  return hasRequiredConfig(config) ? config : null;
}

export async function ensureFirebaseConfigured(): Promise<boolean> {
  if (getActiveFirebaseConfig()) return true;
  if (typeof window === 'undefined') return false;

  if (!runtimeFirebaseConfigPromise) {
    runtimeFirebaseConfigPromise = fetch(FIREBASE_INIT_URL, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return null;
        return readRuntimeConfig(await response.json());
      })
      .catch((error) => {
        console.warn('[firebaseConfig] runtime init.json unavailable', error);
        return null;
      })
      .then((config) => {
        runtimeFirebaseConfig = config;
        return config;
      });
  }

  const config = await runtimeFirebaseConfigPromise;
  return hasRequiredConfig(config);
}

export function isFirebaseConfigured(): boolean {
  return getActiveFirebaseConfig() !== null;
}

export function getFirebaseProjectId(): string {
  return getActiveFirebaseConfig()?.projectId || envFirebaseConfig.projectId || FALLBACK_PROJECT_ID;
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getActiveFirebaseConfig();
  if (!config) return null;

  try {
    if (getApps().length === 0) {
      const app = initializeApp(config);
      import('./lib/appCheck').then(({ initAppCheck }) => initAppCheck(app));
      return app;
    }
    return getApp();
  } catch (error) {
    console.error('Firebase App initialization failed:', error);
    return null;
  }
}

export function getFirestoreDb() {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (error) {
    console.error('Firestore initialization failed:', error);
    return null;
  }
}

export function getFirebaseStorage() {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getStorage(app);
  } catch (error) {
    console.error('Firebase Storage initialization failed:', error);
    return null;
  }
}

const app = getFirebaseApp();
export default app;
