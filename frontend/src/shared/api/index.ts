// Thin fetch wrapper — base URL from env, auth header injected automatically
import { ADMIN_AUTH_EXPIRED_EVENT, ADMIN_TOKEN_KEY, LEGACY_MEMBER_TOKEN_KEY, MEMBER_TOKEN_KEY } from '../constants'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

function getToken() {
  return window.location.pathname.startsWith('/admin')
    ? localStorage.getItem(ADMIN_TOKEN_KEY)
    : localStorage.getItem(MEMBER_TOKEN_KEY) ?? localStorage.getItem(LEGACY_MEMBER_TOKEN_KEY)
}

function expireAdminAuth(path: string) {
  if (!window.location.pathname.startsWith('/admin') || path === '/admin/login') return
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  window.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT))
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    if (res.status === 401) expireAdminAuth(path)
    throw new Error(`${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                 => request<T>(path),
  post:   <T>(path: string, body: unknown)  => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)  => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                 => request<T>(path, { method: 'DELETE' }),

  // SSE for streaming recommendations (fetch-based so Authorization header works)
  stream(path: string, onChunk: (text: string) => void, onError?: (err: Error) => void): () => void {
    const token = getToken()
    const ctrl = new AbortController()
    fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: ctrl.signal,
    }).then(async res => {
      if (!res.ok) {
        if (res.status === 401) expireAdminAuth(path)
        throw new Error(`${res.status} ${res.statusText}`)
      }
      if (!res.body) throw new Error('Response body is null')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (line.startsWith('data: ')) onChunk(line.slice(6))
        }
      }
    }).catch(err => {
      if (err?.name !== 'AbortError') onError?.(err instanceof Error ? err : new Error(String(err)))
    })
    return () => ctrl.abort()
  },
}
