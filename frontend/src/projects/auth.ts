import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { ensureFirebaseConfigured } from '../firebaseConfig';
import { getFirebaseAuth } from '../firebaseAuth';

export type ProjectAuthState =
  | { status: 'checking'; user: null; error: null }
  | { status: 'unconfigured'; user: null; error: string }
  | { status: 'signed_out'; user: null; error: null }
  | { status: 'signed_in'; user: User; error: null }
  | { status: 'error'; user: null; error: string };

export async function listenToProjectAuth(onState: (state: ProjectAuthState) => void): Promise<Unsubscribe | null> {
  const configured = await ensureFirebaseConfigured();
  if (!configured) {
    onState({
      status: 'unconfigured',
      user: null,
      error: 'Hosted project rooms need Firebase web configuration before sign-in can run.',
    });
    return null;
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    onState({
      status: 'unconfigured',
      user: null,
      error: 'Firebase Auth is unavailable in this build.',
    });
    return null;
  }

  return onAuthStateChanged(
    auth,
    (user) => onState(user ? { status: 'signed_in', user, error: null } : { status: 'signed_out', user: null, error: null }),
    (error) => onState({ status: 'error', user: null, error: error.message }),
  );
}

export async function signInProjectRoom(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not configured.');
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function createProjectRoomAccount(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not configured.');
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInProjectRoomWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not configured.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signOutProjectRoom() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}
