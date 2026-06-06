import { ApiError, api } from '@shared/api'
import type { Note, NoteCreatePayload } from '@shared/types'

export type QueuedNote = NoteCreatePayload & {
  queue_id: string
  queued_at: string
}

const DB_NAME = 'family-assister-offline'
const DB_VERSION = 3
const STORE_NAME = 'queued-notes'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queue_id' })
      }
      if (!db.objectStoreNames.contains('cached-memories')) {
        db.createObjectStore('cached-memories', { keyPath: 'cache_key' })
      }
      if (!db.objectStoreNames.contains('cached-recommendations')) {
        db.createObjectStore('cached-recommendations', { keyPath: 'cache_key' })
      }
      if (!db.objectStoreNames.contains('cached-weather')) {
        db.createObjectStore('cached-weather', { keyPath: 'cache_key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export async function enqueueNote(note: NoteCreatePayload): Promise<QueuedNote> {
  const queued: QueuedNote = {
    ...note,
    queue_id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    queued_at: new Date().toISOString(),
  }
  await withStore('readwrite', (store) => store.put(queued))
  return queued
}

export async function listQueuedNotes(): Promise<QueuedNote[]> {
  const notes = await withStore<QueuedNote[]>('readonly', (store) => store.getAll())
  return notes.sort((a, b) => a.queued_at.localeCompare(b.queued_at))
}

export async function removeQueuedNote(queueId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(queueId))
}

export async function syncQueuedNotes(): Promise<number> {
  if (!navigator.onLine) return 0
  const queued = await listQueuedNotes()
  let synced = 0
  for (const note of queued) {
    try {
      await api.post<Note>('/notes', {
        member_id: note.member_id,
        content: note.content,
        source: note.source,
      })
      await removeQueuedNote(note.queue_id)
      synced += 1
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        await removeQueuedNote(note.queue_id)
      }
      // Keep transient failures queued and continue syncing later notes.
    }
  }
  return synced
}
