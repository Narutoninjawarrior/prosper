import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from 'firebase/app-check';
import { getFirebaseApp } from '../firebaseConfig';
import type { FirebaseApp } from 'firebase/app';

let initPromise: Promise<void> | null = null;
let appCheckInstance: AppCheck | null = null;

export function initAppCheck(app: FirebaseApp) {
  if (import.meta.env.DEV) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN || import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
  }
  
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
  if (!siteKey) return null;

  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true
  });
}

export async function ensureAppCheckInitialized(): Promise<void> {
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
    if (!siteKey) return;

    const app = getFirebaseApp();
    if (!app) return;

    const debugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim();
    if (import.meta.env.DEV && debugToken) {
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken;
    }

    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  })();

  await initPromise;
}

export async function mergeAppCheckHeaders(
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
  if (!siteKey) return headers;

  await ensureAppCheckInitialized();
  if (!appCheckInstance) return headers;

  try {
    const result = await getToken(appCheckInstance, false);
    if (!result.token) return headers;
    return { ...headers, 'X-Firebase-AppCheck': result.token };
  } catch {
    return headers;
  }
}
