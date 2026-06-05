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
        <div className="grid grid-cols-[120px_90px_90px_minmax(0,1fr)_110px] border-b border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-xs text-[var(--color-muted)]">
          <span>成员</span>
          <span>领域</span>
          <span>类型</span>
          <span>内容</span>
          <span>来源</span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-muted)]">没有匹配的记忆</div>
        ) : null}
        {filtered.map((memory) => (
          <article
            key={memory.id}
            className="grid grid-cols-[120px_90px_90px_minmax(0,1fr)_110px] items-start gap-0 border-b border-[var(--color-border)] px-4 py-3 text-sm last:border-0"
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
          </article>
        ))}
      </section>
    </div>
  )
}
