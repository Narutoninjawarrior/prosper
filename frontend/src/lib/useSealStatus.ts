import { useState, useEffect } from 'react';
import { getFirebaseAuth } from '../firebaseAuth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';
export type SealStatus = 'loading' | 'unsealed' | 'sealed';

export function useSealStatus() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [sealStatus, setSealStatus] = useState<SealStatus>('loading');
  const [sealKey, setSealKey] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthStatus('unauthenticated');
      setSealStatus('unsealed');
      return;
    }

    return auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAuthStatus('unauthenticated');
        setSealStatus('unsealed');
        return;
      }
      setAuthStatus('authenticated');
      setSealStatus('loading');
      
      try {
        const db = getFirestore();
        const docRef = doc(db, 'wallet_identities', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().public_key) {
          setSealStatus('sealed');
          setSealKey(snap.data().public_key);
        } else {
          setSealStatus('unsealed');
        }
      } catch (err) {
        console.error("Failed to check seal status", err);
        setSealStatus('unsealed');
      }
    });
  }, []);

  return { authStatus, sealStatus, sealKey, setSealStatus };
}
