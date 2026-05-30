import { getAuth, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './firebaseConfig';

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}
