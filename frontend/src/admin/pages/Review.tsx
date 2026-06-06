import { useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'

interface Note {
  id: number
  member_id: number | null
  content: string
  source: 'text' | 'voice' | 'photo'
  status: string
  created_at: string
}

interface MemoryDraft {
  type: 'fact' | 'episode'
  domain: 'dressing' | 'diet' | 'exercise' | 'general'
  content: string
  confidence: number
}

interface ReviewCandidate {
  note_id: number
  member_id: number | null
  original: string
  candidates: MemoryDraft[]
}

const DOMAIN_LABEL = {
  dressing: '穿衣',
  diet: '饮食',
  exercise: '运动',
  general: '通用',
}

const TYPE_LABEL = {
  fact: '事实',
  episode: '情景',
}

export default function Review() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [candidate, setCandidate] = useState<ReviewCandidate | null>(null)
  const [draft, setDraft] = useState<MemoryDraft | null>(null)
  const [message, setMessage] = useState('')

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  )

  useEffect(() => {
    api
      .get<Note[]>('/notes')
      .then((items) => {
        setNotes(items)
        if (items[0]) setSelectedId(items[0].id)
      })
      .catch(() => setMessage('后端暂不可用，请先在移动端提交一条速记'))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    api
      .get<ReviewCandidate>(`/review/notes/${selectedId}`)
      .then((item) => {
        setCandidate(item)
        setDraft(item.candidates[0] ?? null)
        setMessage('')
      })
      .catch(() => {
        setCandidate(null)
        setDraft(null)
        setMessage('无法加载该速记的候选记忆')
      })
  }, [selectedId])

  function updateDraft<K extends keyof MemoryDraft>(field: K, value: MemoryDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  async function approve() {
    if (!selectedId || !draft) return
    try {
      await api.post(`/review/notes/${selectedId}/approve`, draft)
      setNotes((current) =>
        current.map((note) => (note.id === selectedId ? { ...note, status: 'reviewed' } : note)),
      )
      setMessage('候选记忆已写入记忆库')
    } catch {
      setMessage('审核通过失败，请稍后重试')
    }
  }

  async function reject() {
    if (!selectedId) return
    try {
      await api.post<Note>(`/review/notes/${selectedId}/reject`, {})
      setNotes((current) =>
        current.map((note) => (note.id === selectedId ? { ...note, status: 'rejected' } : note)),
      )
      setMessage('已忽略这条候选记忆，原始速记保留在记录中')
    } catch {
      setMessage('忽略候选失败，请稍后重试')
    }
  }

  return (
    <div className="p-10">
      <header className="mb-8 animate-[fadeUp_0.4s_ease_both]">
        <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">速记审核</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          对照原始速记和抽取结果，确认后写入家庭记忆。
        </p>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-card)]">
          <p className="px-2 pb-3 text-sm text-[var(--color-muted)]">待审核速记</p>
          <div className="flex flex-col gap-2">
            {notes.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-3 py-4 text-sm text-[var(--color-muted)]">
                暂无速记。移动端提交后会出现在这里。
              </p>
            ) : null}
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={`rounded-[var(--radius-sm)] border px-3 py-3 text-left transition-colors ${
                  note.id === selectedId
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-warm)]'
                    : 'border-[var(--color-border)] bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                    {note.status === 'reviewed' ? '???' : note.status === 'rejected' ? '???' : '???'}
                  <span className="rounded-full bg-[var(--color-sage)]/10 px-2 py-0.5 text-[10px] text-[var(--color-sage)]">
                    {note.status === 'reviewed' ? '已入库' : '待审核'}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-[var(--color-fg)]">{note.content}</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
          {selectedNote && candidate && draft ? (
            <div className="grid gap-6">
              <section>
                <p className="mb-2 text-sm text-[var(--color-muted)]">原始速记</p>
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-4 text-[var(--color-fg)]">
                  {candidate.original}
                </div>
              </section>

              <section className="grid gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--color-muted)]">候选记忆</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    置信度 {(draft.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
                    类型
                    <select
                      value={draft.type}
                      onChange={(event) => updateDraft('type', event.target.value as MemoryDraft['type'])}
                      className="input"
                    >
                      {Object.entries(TYPE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
                    领域
                    <select
                      value={draft.domain}
                      onChange={(event) => updateDraft('domain', event.target.value as MemoryDraft['domain'])}
                      className="input"
                    >
                      {Object.entries(DOMAIN_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
                  ??????
                  <textarea
                    value={draft.content}
                    onChange={(event) => updateDraft('content', event.target.value)}
                    className="input min-h-32"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reject}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-muted)]"
                  >
                    ????
                  </button>
                  <button
                    type="button"
                    onClick={approve}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2 text-sm text-white"
                  >
                    ???????
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center text-sm text-[var(--color-muted)]">
              选择一条速记查看候选记忆
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
