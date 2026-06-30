/**
 * Tiny local evidence storage helpers backed by IndexedDB.
 */

const DB_NAME = 'hearthlands-evidence'
const STORE_NAME = 'files'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'))
  })
}

export async function saveFile(key: string, file: File | Blob): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save evidence file.'))
    tx.onabort = () => reject(tx.error ?? new Error('Evidence save was aborted.'))
  }).finally(() => db.close())
}

export async function getFileUrl(key: string): Promise<string | null> {
  const db = await openDB()
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => {
      const blob = request.result
      resolve(blob instanceof Blob ? URL.createObjectURL(blob) : null)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to read evidence file.'))
    tx.oncomplete = () => db.close()
  })
}

export async function deleteFile(key: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete evidence file.'))
    tx.onabort = () => reject(tx.error ?? new Error('Evidence delete was aborted.'))
  }).finally(() => db.close())
}
