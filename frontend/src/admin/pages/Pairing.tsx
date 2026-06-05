import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../../shared/api'
import type { MemberDeviceSession, PairingToken } from '../../shared/types'

interface Member {
  id: number
  name: string
  relation: string
  bound: boolean
}

export default function Pairing() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pairing, setPairing] = useState<PairingToken | null>(null)
  const [sessions, setSessions] = useState<MemberDeviceSession[]>([])
  const [message, setMessage] = useState('')
  const qrRef = useRef<HTMLCanvasElement>(null)

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedId) ?? null,
    [members, selectedId],
  )

  useEffect(() => {
    api
      .get<Member[]>('/members')
      .then((items) => {
        setMembers(items)
        if (items[0]) setSelectedId(items[0].id)
      })
      .catch(() => setMessage('后端暂不可用，无法生成配对码'))
  }, [])

  useEffect(() => {
    void loadSessions(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (!pairing || !qrRef.current) return
    QRCode.toCanvas(qrRef.current, pairing.pairing_url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 7,
      color: {
        dark: '#26312F',
        light: '#FFFFFF',
      },
    }).catch(() => setMessage('二维码渲染失败，请复制链接配对'))
  }, [pairing])

  async function loadSessions(memberId: number | null) {
    try {
      const query = memberId ? `?member_id=${memberId}` : ''
      const items = await api.get<MemberDeviceSession[]>(`/pairing/sessions${query}`)
      setSessions(items)
    } catch {
      setSessions([])
    }
  }

  async function generatePairing() {
    if (!selectedId) return
    try {
      const serverUrl = window.location.origin
      const token = await api.post<PairingToken>(
        `/pairing/members/${selectedId}?server_url=${encodeURIComponent(serverUrl)}`,
        {},
      )
      setPairing(token)
      setMessage('配对码已生成，5 分钟内有效')
      await loadSessions(selectedId)
    } catch {
      setMessage('生成配对码失败，请稍后重试')
    }
  }

  async function copyLink() {
    if (!pairing) return
    await navigator.clipboard?.writeText(pairing.pairing_url)
    setMessage('配对链接已复制')
  }

  async function revokeSession(tokenHash: string) {
    try {
      await api.post<MemberDeviceSession>(`/pairing/sessions/${tokenHash}/revoke`, {})
      setMessage('设备会话已吊销，该手机需要重新扫码配对')
      await loadSessions(selectedId)
    } catch {
      setMessage('吊销会话失败，请稍后重试')
    }
  }

  return (
    <div className="p-10">
      <header className="mb-8 animate-[fadeUp_0.4s_ease_both]">
        <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">配对二维码</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          为家庭成员生成一次性配对 token，手机端扫码后即可绑定成员身份。
        </p>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-6">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="mb-4 text-sm text-[var(--color-muted)]">选择成员</p>
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  setSelectedId(member.id)
                  setPairing(null)
                }}
                className={`rounded-[var(--radius-sm)] border px-4 py-3 text-left transition-colors ${
                  selectedId === member.id
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-warm)]'
                    : 'border-[var(--color-border)] bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[var(--color-fg)]">{member.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{member.relation}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-sage)]/10 px-2 py-0.5 text-[10px] text-[var(--color-sage)]">
                    {member.bound ? '已绑定' : '未绑定'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={generatePairing}
            disabled={!selectedId}
            className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2.5 text-sm text-white disabled:opacity-50"
          >
            生成配对码
          </button>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
          {pairing && selectedMember ? (
            <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-6">
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-4">
                <canvas
                  ref={qrRef}
                  aria-label={`${selectedMember.name} 的配对二维码`}
                  className="block aspect-square w-full rounded-lg bg-white p-3"
                />
              </div>
              <div>
                <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">
                  {selectedMember.name} · {selectedMember.relation}
                </p>
                <h3 className="mt-1 text-2xl text-[var(--color-fg)]">5 分钟有效的一次性 token</h3>
                <p className="mt-3 break-all rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  {pairing.pairing_url}
                </p>
                <p className="mt-3 text-xs text-[var(--color-muted)]">
                  过期时间：{new Date(pairing.expires_at).toLocaleString('zh-CN')}
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
                  >
                    复制链接
                  </button>
                  <button
                    type="button"
                    onClick={generatePairing}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
                  >
                    重新生成
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-[var(--color-muted)]">
              选择成员后生成配对码
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg text-[var(--color-fg)]">已绑定设备</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              吊销后，该设备的成员 token 会立即失效。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSessions(selectedId)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]"
          >
            刷新
          </button>
        </div>

        {sessions.length ? (
          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--color-surface-warm)] text-xs text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">成员</th>
                  <th className="px-4 py-3 font-medium">设备</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sessions.map((session) => (
                  <tr key={session.token_hash}>
                    <td className="px-4 py-3 text-[var(--color-fg)]">{session.member_name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      <div>{session.device_name}</div>
                      <div className="mt-1 font-[var(--font-num)] text-[10px] text-[var(--color-muted)]">
                        {session.token_hash.slice(0, 12)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 font-[var(--font-num)] text-xs text-[var(--color-muted)]">
                      {new Date(session.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          session.revoked
                            ? 'bg-[var(--color-muted)]/10 text-[var(--color-muted)]'
                            : 'bg-[var(--color-sage)]/10 text-[var(--color-sage)]'
                        }`}
                      >
                        {session.revoked ? '已吊销' : '有效'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void revokeSession(session.token_hash)}
                        disabled={session.revoked}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        吊销
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            当前成员还没有设备会话
          </div>
        )}
      </section>
    </div>
  )
}
