export type QuickNoteSource = 'text' | 'voice' | 'photo'

export type QuickNoteStatus = 'queued' | 'synced' | 'failed'

export interface QueuedQuickNote {
  id: string
  member: string
  content: string
  source: QuickNoteSource
  photoName?: string
  createdAt: string
  status: QuickNoteStatus
}

const DB_NAME = 'family-assister-mobile'
const DB_VERSION = 1
const STORE = 'quick-notes'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
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
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
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

export async function saveQuickNote(note: QueuedQuickNote): Promise<void> {
  await withStore('readwrite', (store) => store.put(note))
}

export async function updateQuickNoteStatus(id: string, status: QuickNoteStatus): Promise<void> {
  const notes = await listQuickNotes()
  const note = notes.find((item) => item.id === id)
  if (!note) return
  await saveQuickNote({ ...note, status })
}

export async function listQuickNotes(): Promise<QueuedQuickNote[]> {
  const notes = await withStore<QueuedQuickNote[]>('readonly', (store) => store.getAll())
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function clearSyncedQuickNotes(): Promise<void> {
  const notes = await listQuickNotes()
  await Promise.all(
    notes
      .filter((note) => note.status === 'synced')
      .map((note) => withStore('readwrite', (store) => store.delete(note.id))),
  )
}
