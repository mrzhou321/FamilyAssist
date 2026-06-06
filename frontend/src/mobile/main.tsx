import '../globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { MEMBER_AUTH_EXPIRED_EVENT } from '../shared/constants'
import MemoryVault from './pages/MemoryVault'
import PairDevice from './pages/PairDevice'
import QuickNote from './pages/QuickNote'
import TodayAdvice from './pages/TodayAdvice'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const NAV = [
  { to: '/', icon: '✎', label: '速记' },
  { to: '/advice', icon: '☀', label: '建议' },
  { to: '/memory', icon: '♥', label: '记忆' },
]

const queryClient = new QueryClient()

export function MobileApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/mobile">
        <MobileShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function MobileShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isPairing = location.pathname === '/pair'
  const { waitingWorker, refresh } = useServiceWorkerUpdate()
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    const handleExpiredMemberAuth = () => navigate('/pair', { replace: true })
    window.addEventListener(MEMBER_AUTH_EXPIRED_EVENT, handleExpiredMemberAuth)
    return () => window.removeEventListener(MEMBER_AUTH_EXPIRED_EVENT, handleExpiredMemberAuth)
  }, [navigate])

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--color-bg)]">
      {waitingWorker ? (
        <button
          type="button"
          onClick={refresh}
          className="border-b border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-2 text-xs text-white"
        >
          有新版本可用，点击刷新
        </button>
      ) : null}
      {canInstall ? (
        <button
          type="button"
          onClick={install}
          className="border-b border-[var(--color-border)] bg-white px-4 py-2 text-xs text-[var(--color-accent)]"
        >
          安装到桌面，离线也能打开
        </button>
      ) : null}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<QuickNote />} />
          <Route path="/advice" element={<TodayAdvice />} />
          <Route path="/memory" element={<MemoryVault />} />
          <Route path="/pair" element={<PairDevice />} />
        </Routes>
      </main>
      {isPairing ? null : (
        <nav className="flex border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-[var(--font-body)] transition-colors ${
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
                }`
              }
            >
              <span className="text-xl leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(() => isRunningStandalone())

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setPromptEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  return {
    canInstall: Boolean(promptEvent) && !isStandalone,
    async install() {
      if (!promptEvent) return
      await promptEvent.prompt()
      await promptEvent.userChoice
      setPromptEvent(null)
    },
  }
}

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(worker)
          }
        })
      })
    })
  }, [])

  return {
    waitingWorker,
    refresh() {
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
    },
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}
