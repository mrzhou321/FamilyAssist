import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../shared/api'
import { LEGACY_MEMBER_TOKEN_KEY, MEMBER_ID_KEY, MEMBER_NAME_KEY, MEMBER_TOKEN_KEY } from '../../shared/constants'

interface MemberSession {
  member_id: number
  member_name: string
  access_token: string
  token_type: string
}

export default function PairDevice() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [isPairing, setIsPairing] = useState(false)
  const token = useMemo(() => params.get('token') ?? '', [params])

  async function pairDevice() {
    if (!token) {
      setMessage('配对链接缺少 token')
      return
    }
    setIsPairing(true)
    try {
      const session = await api.post<MemberSession>('/pairing/exchange', {
        pairing_token: token,
        device_name: navigator.userAgent.slice(0, 80),
      })
      localStorage.setItem(MEMBER_TOKEN_KEY, session.access_token)
      localStorage.removeItem(LEGACY_MEMBER_TOKEN_KEY)
      localStorage.setItem(MEMBER_ID_KEY, String(session.member_id))
      localStorage.setItem(MEMBER_NAME_KEY, session.member_name)
      setMessage(`已绑定 ${session.member_name}`)
      window.setTimeout(() => navigate('/'), 700)
    } catch {
      setMessage('配对失败，token 可能已使用或过期')
    } finally {
      setIsPairing(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 p-5">
      <div className="animate-[fadeUp_0.4s_ease_both]">
        <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">设备配对</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)] leading-tight">
          把这台手机，<span className="text-[var(--color-accent)]">带回家</span>
        </h1>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-4 py-3 text-xs text-[var(--color-muted)] break-all">
          {token || '未检测到 token'}
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--color-fg)]">
          点击确认后，系统会把一次性 token 兑换为本机长期登录凭证。此 token 只能使用一次，并会在生成后 5 分钟过期。
        </p>
        <button
          type="button"
          onClick={pairDevice}
          disabled={isPairing || !token}
          className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] py-3 text-sm text-white disabled:opacity-50"
        >
          {isPairing ? '配对中' : '确认配对'}
        </button>
      </section>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <Link to="/" className="text-center text-sm text-[var(--color-muted)]">
        返回速记页
      </Link>
    </div>
  )
}
