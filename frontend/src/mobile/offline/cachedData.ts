import type { Memory, Recommendation, WeatherContext } from '@shared/types'

const DB_NAME = 'family-assister-offline'
const DB_VERSION = 3
const MEMORY_STORE = 'cached-memories'
const RECOMMENDATION_STORE = 'cached-recommendations'
const WEATHER_STORE = 'cached-weather'

type CachedMemorySet = {
  cache_key: string
  cached_at: string
  items: Memory[]
}

type CachedRecommendationSet = {
  cache_key: string
  cached_at: string
  items: Recommendation[]
}

type CachedWeather = {
  cache_key: string
  cached_at: string
  item: WeatherContext
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
      if (!db.objectStoreNames.contains(RECOMMENDATION_STORE)) {
        db.createObjectStore(RECOMMENDATION_STORE, { keyPath: 'cache_key' })
      }
      if (!db.objectStoreNames.contains(WEATHER_STORE)) {
        db.createObjectStore(WEATHER_STORE, { keyPath: 'cache_key' })
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

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
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

export async function cacheRecommendations(
  memberId: number | null,
  items: Recommendation[],
): Promise<Recommendation[]> {
  const record: CachedRecommendationSet = {
    cache_key: memoryCacheKey(memberId),
    cached_at: new Date().toISOString(),
    items,
  }
  await withStore('cached-recommendations', 'readwrite', (store) => store.put(record))
  return items
}

export async function getCachedRecommendations(memberId: number | null): Promise<Recommendation[]> {
  const record = await withStore<CachedRecommendationSet | undefined>('cached-recommendations', 'readonly', (store) =>
    store.get(memoryCacheKey(memberId)),
  )
  return record?.items ?? []
}

export async function cacheWeather(item: WeatherContext): Promise<WeatherContext> {
  const record: CachedWeather = {
    cache_key: 'today',
    cached_at: new Date().toISOString(),
    item,
  }
  await withStore('cached-weather', 'readwrite', (store) => store.put(record))
  return item
}

export async function getCachedWeather(): Promise<WeatherContext | null> {
  const record = await withStore<CachedWeather | undefined>('cached-weather', 'readonly', (store) =>
    store.get('today'),
  )
  return record?.item ?? null
}
