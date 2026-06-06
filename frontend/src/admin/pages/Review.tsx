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

type StatusFilter = 'all' | 'understanding' | 'reviewed' | 'rejected'

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

const SOURCE_LABEL = {
  text: '文本',
  voice: '语音',
  photo: '照片',
}

const STATUS_META: Record<string, { label: string; tone: string; mark: string }> = {
  understanding: {
    label: '待审核',
    tone: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    mark: '待',
  },
  reviewed: {
    label: '已入库',
    tone: 'bg-[var(--color-sage)]/10 text-[var(--color-sage)]',
    mark: '入',
  },
  rejected: {
    label: '已忽略',
    tone: 'bg-slate-500/10 text-slate-500',
    mark: '忽',
  },
}

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: '全部',
  understanding: '待审核',
  reviewed: '已入库',
  rejected: '已忽略',
}

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? {
    label: status,
    tone: 'bg-slate-500/10 text-slate-500',
    mark: '记',
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function Review() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [candidate, setCandidate] = useState<ReviewCandidate | null>(null)
  const [draft, setDraft] = useState<MemoryDraft | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [message, setMessage] = useState('')
  const [failedCandidateId, setFailedCandidateId] = useState<number | null>(null)

  const counts = useMemo(() => {
    return notes.reduce<Record<StatusFilter, number>>(
      (acc, note) => {
        acc.all += 1
        if (note.status in acc) acc[note.status as StatusFilter] += 1
        return acc
      },
      { all: 0, understanding: 0, reviewed: 0, rejected: 0 },
    )
  }, [notes])

  const filteredNotes = useMemo(() => {
    if (statusFilter === 'all') return notes
    return notes.filter((note) => note.status === statusFilter)
  }, [notes, statusFilter])

  const activeSelectedId = useMemo(() => {
    if (selectedId && filteredNotes.some((note) => note.id === selectedId)) return selectedId
    return filteredNotes[0]?.id ?? null
  }, [filteredNotes, selectedId])

  const selectedNote = useMemo(
    () => filteredNotes.find((note) => note.id === activeSelectedId) ?? null,
    [activeSelectedId, filteredNotes],
  )
  const isLoadingCandidate =
    activeSelectedId !== null &&
    candidate?.note_id !== activeSelectedId &&
    failedCandidateId !== activeSelectedId

  useEffect(() => {
    api
      .get<Note[]>('/notes')
      .then((items) => {
        setNotes(items)
        setMessage('')
      })
      .catch(() => setMessage('后端暂不可用，请先在移动端提交一条速记'))
  }, [])

  useEffect(() => {
    if (!activeSelectedId) return

    let isCurrent = true
    api
      .get<ReviewCandidate>(`/review/notes/${activeSelectedId}`)
      .then((item) => {
        if (!isCurrent) return
        setCandidate(item)
        setDraft(item.candidates[0] ?? null)
        setFailedCandidateId(null)
        setMessage('')
      })
      .catch(() => {
        if (!isCurrent) return
        setCandidate(null)
        setDraft(null)
        setFailedCandidateId(activeSelectedId)
        setMessage('无法加载该速记的候选记忆')
      })

    return () => {
      isCurrent = false
    }
  }, [activeSelectedId])

  function updateDraft<K extends keyof MemoryDraft>(field: K, value: MemoryDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateSelectedStatus(status: string) {
    setNotes((current) =>
      current.map((note) => (note.id === activeSelectedId ? { ...note, status } : note)),
    )
  }

  async function approve() {
    if (!activeSelectedId || !draft) return
    const content = draft.content.trim()
    if (!content) {
      setMessage('记忆内容不能为空')
      return
    }
    if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) {
      setMessage('置信度必须在 0 到 1 之间')
      return
    }
    try {
      await api.post(`/review/notes/${activeSelectedId}/approve`, { ...draft, content })
      setDraft({ ...draft, content })
      updateSelectedStatus('reviewed')
      setMessage('候选记忆已写入记忆库')
    } catch {
      setMessage('审核通过失败，请稍后重试')
    }
  }

  async function reject() {
    if (!activeSelectedId) return
    if (selectedNote?.status === 'reviewed') {
      setMessage('已入库速记请在记忆库编辑或删除对应记忆')
      return
    }
    try {
      await api.post<Note>(`/review/notes/${activeSelectedId}/reject`, {})
      updateSelectedStatus('rejected')
      setMessage('已忽略这条候选记忆，原始速记保留在记录中')
    } catch {
      setMessage('忽略候选失败，请稍后重试')
    }
  }

  return (
    <div className="p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-[fadeUp_0.4s_ease_both]">
        <div>
          <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">速记审核</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            对照原始速记和抽取结果，校正后写入家庭记忆。
          </p>
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white text-center text-xs shadow-[var(--shadow-card)]">
          {(Object.keys(FILTER_LABEL) as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-w-20 px-3 py-2 transition-colors ${
                statusFilter === status
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-warm)]'
              }`}
            >
              <span className="block text-[10px]">{FILTER_LABEL[status]}</span>
              <span className="font-[var(--font-num)] text-base">{counts[status]}</span>
            </button>
          ))}
        </div>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-6">
        <aside className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between px-2">
            <p className="text-sm text-[var(--color-muted)]">{FILTER_LABEL[statusFilter]}速记</p>
            <p className="text-xs text-[var(--color-muted)]">{filteredNotes.length} 条</p>
          </div>
          <div className="flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto pr-1">
            {filteredNotes.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-3 py-4 text-sm text-[var(--color-muted)]">
                当前筛选下暂无速记。
              </p>
            ) : null}
            {filteredNotes.map((note) => {
              const meta = getStatusMeta(note.status)
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={`rounded-[var(--radius-sm)] border px-3 py-3 text-left transition-colors ${
                    note.id === activeSelectedId
                      ? 'border-[var(--color-accent)] bg-[var(--color-surface-warm)]'
                      : 'border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-warm)]'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <span className={`grid size-6 place-items-center rounded-full ${meta.tone}`}>
                        {meta.mark}
                      </span>
                      #{note.id} · {SOURCE_LABEL[note.source]} · {formatTime(note.created_at)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-[var(--color-fg)]">{note.content}</p>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
          {isLoadingCandidate ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--color-muted)]">
              正在加载候选记忆...
            </div>
          ) : selectedNote && candidate && draft ? (
            <div className="grid gap-6">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-[var(--color-muted)]">原始速记</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    成员 {candidate.member_id ?? '全家'} · note #{candidate.note_id}
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-4 text-[var(--color-fg)]">
                  {candidate.original}
                </div>
              </section>

              <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--color-muted)]">候选记忆</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      可直接编辑抽取结果，再写入记忆库。
                    </p>
                  </div>
                  <p className="rounded-full bg-[var(--color-surface-warm)] px-3 py-1 text-xs text-[var(--color-muted)]">
                    置信度 {(draft.confidence * 100).toFixed(0)}%
                  </p>
                </div>

                {candidate.candidates.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {candidate.candidates.map((item, index) => (
                      <button
                        key={`${item.domain}-${item.type}-${index}`}
                        type="button"
                        onClick={() => setDraft(item)}
                        className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs ${
                          draft === item
                            ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-muted)]'
                        }`}
                      >
                        候选 {index + 1}
                      </button>
                    ))}
                  </div>
                ) : null}

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
                  记忆内容
                  <textarea
                    value={draft.content}
                    onChange={(event) => updateDraft('content', event.target.value)}
                    className="input min-h-36"
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reject}
                    disabled={selectedNote.status === 'reviewed'}
                    title={selectedNote.status === 'reviewed' ? '已入库速记请在记忆库编辑或删除' : undefined}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-warm)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    忽略候选
                  </button>
                  <button
                    type="button"
                    onClick={approve}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2 text-sm text-white transition-opacity hover:opacity-90"
                  >
                    写入记忆库
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--color-muted)]">
              选择一条速记查看候选记忆
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
