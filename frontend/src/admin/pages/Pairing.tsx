import { useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'

interface Member {
  id: number
  name: string
  relation: string
  bound: boolean
}

interface PairingToken {
  member_id: number
  server_url: string
  pairing_token: string
  pairing_url: string
  expires_at: string
}

function tokenCells(token: string) {
  const bits = Array.from(token).flatMap((char) => {
    const code = char.charCodeAt(0)
    return [code & 1, code & 2, code & 4, code & 8]
  })
  return Array.from({ length: 49 }, (_, index) => Boolean(bits[index % bits.length]))
}

export default function Pairing() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pairing, setPairing] = useState<PairingToken | null>(null)
  const [message, setMessage] = useState('')

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
    } catch {
      setMessage('生成配对码失败，请稍后重试')
    }
  }

  async function copyLink() {
    if (!pairing) return
    await navigator.clipboard?.writeText(pairing.pairing_url)
    setMessage('配对链接已复制')
  }

  const cells = pairing ? tokenCells(pairing.pairing_token) : []

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
                <div className="flex items-center justify-between">
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
                <div className="grid grid-cols-7 gap-1 rounded-lg bg-white p-3">
                  {cells.map((filled, index) => (
                    <span
                      key={index}
                      className={`aspect-square rounded-[2px] ${filled ? 'bg-[var(--color-fg)]' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
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
    </div>
  )
}
