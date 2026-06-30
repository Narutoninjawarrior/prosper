import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from '../firebaseConfig'
import { forgeNodeToSandboxObject, type SandboxObject } from './sandboxObjects'

export type SandboxSyncStatus = 'local' | 'syncing' | 'live' | 'error'

export function useSandboxFirestore(): {
  remoteObjects: SandboxObject[]
  status: SandboxSyncStatus
} {
  const [remoteObjects, setRemoteObjects] = useState<SandboxObject[]>([])
  const [status, setStatus] = useState<SandboxSyncStatus>(
    isFirebaseConfigured() ? 'syncing' : 'local'
  )

  useEffect(() => {
    const db = getFirestoreDb()
    if (!db) {
      setStatus('local')
      return
    }

    const ref = doc(db, 'three_forge', 'world_state')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRemoteObjects([])
          setStatus('live')
          return
        }
        const nodes = (snap.data().nodes ?? []) as Record<string, unknown>[]
        const mapped = nodes
          .map(forgeNodeToSandboxObject)
          .filter((o): o is SandboxObject => o != null)
        setRemoteObjects(mapped)
        setStatus('live')
      },
      () => {
        setStatus('error')
      }
    )

    return () => unsub()
  }, [])

  return { remoteObjects, status }
}
