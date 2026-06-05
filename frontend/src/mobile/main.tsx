import '../globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import MemoryVault from './pages/MemoryVault'
import PairDevice from './pages/PairDevice'
import QuickNote from './pages/QuickNote'
import TodayAdvice from './pages/TodayAdvice'

const NAV = [
  { to: '/', icon: '✎', label: '速记' },
  { to: '/advice', icon: '☀', label: '建议' },
  { to: '/memory', icon: '♥', label: '记忆' },
]

export function MobileApp() {
  return (
    <BrowserRouter basename="/mobile">
      <MobileShell />
    </BrowserRouter>
  )
}

function MobileShell() {
  const location = useLocation()
  const isPairing = location.pathname === '/pair'
  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-[var(--color-bg)]">
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
)
