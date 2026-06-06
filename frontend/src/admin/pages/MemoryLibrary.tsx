import { useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'

interface Member {
  id: number
  name: string
  relation: string
}

interface Memory {
  id: number
  member_id: number | null
  type: 'fact' | 'episode'
  domain: 'dressing' | 'diet' | 'exercise' | 'general'
  content: string
  confidence: number
  source_note_id: number | null
  expires_at: string | null
  created_at: string
}

const DOMAIN_LABEL = {
  all: '全部领域',
  dressing: '穿衣',
  diet: '饮食',
  exercise: '运动',
  general: '通用',
}

const TYPE_LABEL = {
  all: '全部类型',
  fact: '事实',
  episode: '情景',
}

export default function MemoryLibrary() {
  const [members, setMembers] = useState<Member[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [editing, setEditing] = useState<Memory | null>(null)
  const [memberFilter, setMemberFilter] = useState('all')
  const [domainFilter, setDomainFilter] = useState<keyof typeof DOMAIN_LABEL>('all')
  const [typeFilter, setTypeFilter] = useState<keyof typeof TYPE_LABEL>('all')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([api.get<Member[]>('/members'), api.get<Memory[]>('/memories')])
      .then(([apiMembers, apiMemories]) => {
        setMembers(apiMembers)
        setMemories(apiMemories)
      })
      .catch(() => setMessage('后端暂不可用，无法加载记忆库'))
  }, [])

  const memberName = useMemo(() => {
    const map = new Map<number, string>()
    members.forEach((member) => map.set(member.id, `${member.name}（${member.relation}）`))
    return map
  }, [members])

  const filtered = memories.filter((memory) => {
    const memberMatched =
      memberFilter === 'all' ||
      (memberFilter === 'family' && memory.member_id === null) ||
      memory.member_id?.toString() === memberFilter
    const domainMatched = domainFilter === 'all' || memory.domain === domainFilter
    const typeMatched = typeFilter === 'all' || memory.type === typeFilter
    return memberMatched && domainMatched && typeMatched
  })

  function formatExpiry(value: string | null) {
    if (!value) return '长期'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function toDateTimeLocal(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offsetMs = date.getTimezoneOffset() * 60 * 1000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  }

  function fromDateTimeLocal(value: string) {
    return value ? new Date(value).toISOString() : null
  }

  function updateEditing<K extends keyof Memory>(field: K, value: Memory[K]) {
    setEditing((current) => (current ? { ...current, [field]: value } : current))
  }

  async function saveMemory() {
    if (!editing) return
    try {
      const saved = await api.patch<Memory>(`/memories/${editing.id}`, {
        member_id: editing.member_id,
        type: editing.type,
        domain: editing.domain,
        content: editing.content,
        confidence: editing.confidence,
        expires_at: editing.expires_at,
      })
      setMemories((current) => current.map((memory) => (memory.id === saved.id ? saved : memory)))
      setEditing(saved)
      setMessage('记忆已保存')
    } catch {
      setMessage('保存失败，请稍后重试')
    }
  }

  async function deleteMemory(memory: Memory) {
    try {
      await api.delete(`/memories/${memory.id}`)
      setMemories((current) => current.filter((item) => item.id !== memory.id))
      if (editing?.id === memory.id) setEditing(null)
      setMessage('记忆已删除')
    } catch {
      setMessage('删除失败，请稍后重试')
    }
  }

  return (
    <div className="p-10">
      <header className="mb-8 flex items-end justify-between animate-[fadeUp_0.4s_ease_both]">
        <div>
          <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">记忆库</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            查看已沉淀的家庭记忆，按成员、领域和类型快速筛选。
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] bg-white px-4 py-2 text-sm text-[var(--color-muted)] shadow-[var(--shadow-card)]">
          {filtered.length} / {memories.length} 条
        </div>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <section className="mb-5 grid grid-cols-3 gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          成员
          <select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} className="input">
            <option value="all">全部成员</option>
            <option value="family">全家</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}（{member.relation}）
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          领域
          <select
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value as keyof typeof DOMAIN_LABEL)}
            className="input"
          >
            {Object.entries(DOMAIN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          类型
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as keyof typeof TYPE_LABEL)}
            className="input"
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[120px_80px_80px_minmax(0,1fr)_110px_110px_110px] border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-xs text-[var(--color-muted)]">
          <span>成员</span>
          <span>领域</span>
          <span>类型</span>
          <span>内容</span>
          <span>来源</span>
          <span>时效</span>
          <span>操作</span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-muted)]">没有匹配的记忆</div>
        ) : null}
        {filtered.map((memory) => (
          <article
            key={memory.id}
            className="grid grid-cols-[120px_80px_80px_minmax(0,1fr)_110px_110px_110px] items-start gap-0 border-b border-[var(--color-border)] px-4 py-3 text-sm last:border-0"
          >
            <span className="text-[var(--color-muted)]">
              {memory.member_id ? memberName.get(memory.member_id) ?? `成员 #${memory.member_id}` : '全家'}
            </span>
            <span className="text-[var(--color-accent)]">{DOMAIN_LABEL[memory.domain]}</span>
            <span className="text-[var(--color-muted)]">{TYPE_LABEL[memory.type]}</span>
            <span className="text-[var(--color-fg)]">
              {memory.content}
              <span className="ml-2 text-[10px] text-[var(--color-muted)]">
                {(memory.confidence * 100).toFixed(0)}%
              </span>
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              {memory.source_note_id ? `note #${memory.source_note_id}` : '种子数据'}
            </span>
            <span className="text-xs text-[var(--color-muted)]">{formatExpiry(memory.expires_at)}</span>
            <span className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditing(memory)}
                className="text-[var(--color-accent)]"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => deleteMemory(memory)}
                className="text-[var(--color-muted)]"
              >
                删除
              </button>
            </span>
          </article>
        ))}
      </section>

      {editing ? (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg text-[var(--color-fg)]">编辑记忆 #{editing.id}</h3>
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-[var(--color-muted)]">
              关闭
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
              成员
              <select
                value={editing.member_id ?? 'family'}
                onChange={(event) =>
                  updateEditing(
                    'member_id',
                    event.target.value === 'family' ? null : Number(event.target.value),
                  )
                }
                className="input"
              >
                <option value="family">全家</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}（{member.relation}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
              领域
              <select
                value={editing.domain}
                onChange={(event) => updateEditing('domain', event.target.value as Memory['domain'])}
                className="input"
              >
                {Object.entries(DOMAIN_LABEL)
                  .filter(([value]) => value !== 'all')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
              类型
              <select
                value={editing.type}
                onChange={(event) => updateEditing('type', event.target.value as Memory['type'])}
                className="input"
              >
                {Object.entries(TYPE_LABEL)
                  .filter(([value]) => value !== 'all')
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
              置信度
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={editing.confidence}
                onChange={(event) => updateEditing('confidence', Number(event.target.value))}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
              过期时间
              <input
                type="datetime-local"
                value={toDateTimeLocal(editing.expires_at)}
                onChange={(event) => updateEditing('expires_at', fromDateTimeLocal(event.target.value))}
                className="input"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => updateEditing('expires_at', null)}
            className="mt-3 text-xs text-[var(--color-muted)]"
          >
            设为长期有效
          </button>

          <label className="mt-4 flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
            内容
            <textarea
              value={editing.content}
              onChange={(event) => updateEditing('content', event.target.value)}
              className="input min-h-28"
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => deleteMemory(editing)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
            >
              删除记忆
            </button>
            <button
              type="button"
              onClick={saveMemory}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2 text-sm text-white"
            >
              保存记忆
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
