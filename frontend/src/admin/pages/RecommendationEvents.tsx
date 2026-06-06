import { useEffect, useMemo, useState } from 'react'
import { api } from '../../shared/api'
import type { Member } from '../../shared/types'

type RecommendationDomain = 'dressing' | 'diet' | 'exercise'

interface RecommendationEvent {
  id: number
  member_id: number | null
  domain: RecommendationDomain
  content: string
  memory_ids: number[]
  basis: string[]
  created_at: string
}

type DomainFilter = 'all' | RecommendationDomain
type MemberFilter = 'all' | 'family' | string

const DOMAIN_LABEL: Record<DomainFilter, string> = {
  all: '全部领域',
  dressing: '穿衣',
  diet: '饮食',
  exercise: '运动',
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

export default function RecommendationEvents() {
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<RecommendationEvent[]>([])
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const [loadedMembers, loadedEvents] = await Promise.all([
        api.get<Member[]>('/members'),
        api.get<RecommendationEvent[]>('/recommendation-events'),
      ])
      setMembers(loadedMembers)
      setEvents(loadedEvents)
      setMessage('')
    } catch {
      setMessage('后端暂不可用，无法加载推荐记录')
    }
  }

  const memberName = useMemo(() => {
    const map = new Map<number, string>()
    members.forEach((member) => map.set(member.id, `${member.name}（${member.relation}）`))
    return map
  }, [members])

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const memberMatched =
        memberFilter === 'all' ||
        (memberFilter === 'family' && event.member_id === null) ||
        event.member_id?.toString() === memberFilter
      const domainMatched = domainFilter === 'all' || event.domain === domainFilter
      return memberMatched && domainMatched
    })
  }, [domainFilter, events, memberFilter])

  const counts = useMemo(() => {
    return events.reduce<Record<RecommendationDomain, number>>(
      (acc, event) => ({ ...acc, [event.domain]: acc[event.domain] + 1 }),
      { dressing: 0, diet: 0, exercise: 0 },
    )
  }, [events])

  return (
    <div className="p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-[fadeUp_0.4s_ease_both]">
        <div>
          <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">推荐记录</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            回看每次建议、引用记忆和生成依据，方便校验个性化是否靠谱。
          </p>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white text-center text-xs shadow-[var(--shadow-card)]">
          {(Object.keys(counts) as RecommendationDomain[]).map((domain) => (
            <div key={domain} className="min-w-20 px-3 py-2">
              <span className="block text-[10px] text-[var(--color-muted)]">{DOMAIN_LABEL[domain]}</span>
              <span className="font-[var(--font-num)] text-base text-[var(--color-fg)]">{counts[domain]}</span>
            </div>
          ))}
        </div>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <section className="mb-5 grid grid-cols-[minmax(0,1fr)_220px_180px_90px] gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)] max-[980px]:grid-cols-2">
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
            onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}
            className="input"
          >
            {(Object.keys(DOMAIN_LABEL) as DomainFilter[]).map((domain) => (
              <option key={domain} value={domain}>
                {DOMAIN_LABEL[domain]}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-4 py-2.5 text-sm text-[var(--color-muted)]">
          <span className="block text-xs">当前筛选</span>
          <span className="font-[var(--font-num)] text-lg text-[var(--color-fg)]">
            {filtered.length} / {events.length}
          </span>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-warm)]"
        >
          刷新
        </button>
      </section>

      <section className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-10 text-center text-sm text-[var(--color-muted)] shadow-[var(--shadow-card)]">
            暂无匹配的推荐记录。
          </div>
        ) : null}

        {filtered.map((event) => (
          <article
            key={event.id}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-[var(--color-accent)]">
                  {DOMAIN_LABEL[event.domain]}
                </span>
                <span>{event.member_id ? memberName.get(event.member_id) ?? `成员 #${event.member_id}` : '全家'}</span>
                <span>#{event.id}</span>
                <span>{formatTime(event.created_at)}</span>
              </div>
              <span className="rounded-full bg-[var(--color-surface-warm)] px-3 py-1 text-xs text-[var(--color-muted)]">
                引用 {event.memory_ids.length} 条记忆
              </span>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-fg)]">{event.content}</p>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_180px] gap-4 max-[980px]:grid-cols-1">
              <div>
                <p className="mb-2 text-xs text-[var(--color-muted)]">依据</p>
                <div className="flex flex-col gap-2">
                  {event.basis.length === 0 ? (
                    <p className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-3 py-2 text-sm text-[var(--color-muted)]">
                      本次建议未引用已入库记忆。
                    </p>
                  ) : null}
                  {event.basis.map((basis, index) => (
                    <p
                      key={`${event.id}-basis-${index}`}
                      className="rounded-[var(--radius-sm)] bg-[var(--color-surface-warm)] px-3 py-2 text-sm leading-6 text-[var(--color-fg)]"
                    >
                      {basis}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-[var(--color-muted)]">memory_ids</p>
                <div className="flex flex-wrap gap-2">
                  {event.memory_ids.length === 0 ? (
                    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
                      无
                    </span>
                  ) : null}
                  {event.memory_ids.map((memoryId) => (
                    <span
                      key={`${event.id}-memory-${memoryId}`}
                      className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)]"
                    >
                      #{memoryId}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
