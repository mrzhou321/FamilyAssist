import '../globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import MemoryLibrary from './pages/MemoryLibrary'
import Members from './pages/Members'
import Pairing from './pages/Pairing'
import Review from './pages/Review'

const NAV = [
  { to: '/', icon: '♥', label: '成员管理' },
  { to: '/memory', icon: '✓', label: '记忆库' },
  { to: '/review', icon: '◫', label: '速记审核' },
  { to: '/qr', icon: '▦', label: '配对二维码' },
  { to: '/settings', icon: '⚙', label: '系统设置' },
]

export function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <div className="flex h-screen bg-[var(--color-bg)]">
        <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[var(--color-sidebar)]">
          <div className="border-b border-white/[0.07] px-6 py-7">
            <h1 className="font-[var(--font-display)] text-xl text-[var(--color-sidebar-fg)]">家暖</h1>
            <p className="mt-1 text-[11px] tracking-widest text-[var(--color-sidebar-muted)]">
              管家工作台
            </p>
          </div>

          <nav className="flex-1 py-4">
            {NAV.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-6 py-2.5 text-sm font-[var(--font-body)] transition-colors ${
                    isActive
                      ? 'sidebar-active text-[var(--color-sidebar-fg)]'
                      : 'text-[var(--color-sidebar-muted)] hover:bg-white/[0.04] hover:text-[var(--color-sidebar-fg)]'
                  }`
                }
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/[0.07] px-6 py-4 text-[11px] italic text-[var(--color-sidebar-muted)]">
            本地自托管 · 数据不出门
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Members />} />
            <Route path="/memory" element={<MemoryLibrary />} />
            <Route path="/review" element={<Review />} />
            <Route path="/qr" element={<Pairing />} />
            <Route path="/settings" element={<Placeholder title="系统设置" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-2xl text-[var(--color-muted)]">
      {title} · 开发中
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
