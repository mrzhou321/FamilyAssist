import type { Memory } from '@shared/types'

const DB_NAME = 'family-assister-offline'
const DB_VERSION = 2
const MEMORY_STORE = 'cached-memories'

type CachedMemorySet = {
  cache_key: string
  cached_at: string
  items: Memory[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queued-notes')) {
        db.createObjectStore('queued-notes', { keyPath: 'queue_id' })
      }
      if (!db.objectStoreNames.contains(MEMORY_STORE)) {
        db.createObjectStore(MEMORY_STORE, { keyPath: 'cache_key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withMemoryStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEMORY_STORE, mode)
    const store = transaction.objectStore(MEMORY_STORE)
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

export function memoryCacheKey(memberId: number | null) {
  return memberId === null ? 'all' : `member-${memberId}`
}

export async function cacheMemories(memberId: number | null, items: Memory[]): Promise<Memory[]> {
  const record: CachedMemorySet = {
    cache_key: memoryCacheKey(memberId),
    cached_at: new Date().toISOString(),
    items,
  }
  await withMemoryStore('readwrite', (store) => store.put(record))
  return items
}

export async function getCachedMemories(memberId: number | null): Promise<Memory[]> {
  const record = await withMemoryStore<CachedMemorySet | undefined>('readonly', (store) =>
    store.get(memoryCacheKey(memberId)),
  )
  return record?.items ?? []
}
