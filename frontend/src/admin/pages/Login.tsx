import { useState } from 'react'
import { api } from '@shared/api'
import { ADMIN_TOKEN_KEY } from '@shared/constants'

interface AuthToken {
  access_token: string
  token_type: string
}

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    try {
      const token = await api.post<AuthToken>('/admin/login', { username, password })
      localStorage.setItem(ADMIN_TOKEN_KEY, token.access_token)
      onLogin()
    } catch {
      setMessage('账号或密码不正确')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]"
      >
        <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">FamilyAssister</p>
        <h1 className="mt-1 font-[var(--font-display)] text-3xl text-[var(--color-fg)]">管理员登录</h1>

        {message ? (
          <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-[var(--color-surface-warm)] px-3 py-2 text-sm text-[var(--color-fg)]">
            {message}
          </div>
        ) : null}

        <label className="mt-5 flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          账号
          <input value={username} onChange={(event) => setUsername(event.target.value)} className="input" />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting || !username.trim() || !password}
          className="mt-6 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2.5 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? '登录中…' : '登录'}
        </button>
        <p className="mt-3 text-xs text-[var(--color-muted)]">默认密码可通过 ADMIN_PASSWORD 环境变量修改。</p>
      </form>
    </div>
  )
}
