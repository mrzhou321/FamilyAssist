import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MEMORY_TAG_COLORS } from '@shared/constants/colors'
import { useMemberMemories } from '@shared/hooks'
import { getCurrentMemberId, getCurrentMemberName, hasPairedMember } from '../session'

type MemoryDomain = 'dressing' | 'diet' | 'exercise' | 'general'
type MemoryType = 'fact' | 'episode'

const TAGS = ['全部', '穿衣', '饮食', '运动', '通用']

const DOMAIN_LABEL: Record<MemoryDomain, string> = {
  dressing: '穿衣',
  diet: '饮食',
  exercise: '运动',
  general: '通用',
}

const TYPE_LABEL: Record<MemoryType, string> = {
  fact: '事实',
  episode: '情景',
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

export default function MemoryVault() {
  const [activeTag, setActiveTag] = useState('全部')
  const isPaired = hasPairedMember()
  const memberId = getCurrentMemberId()
  const { data, isError } = useMemberMemories(memberId, isPaired)
  const hasLoadedMemories = Boolean(data && data.length > 0)
  const memories = useMemo(() => (hasLoadedMemories ? data! : []), [data, hasLoadedMemories])
  const message = isError
    ? isPaired ? '记忆加载失败，暂无可用的本地缓存' : ''
    : !navigator.onLine && hasLoadedMemories
      ? '当前离线，正在显示上次加载的记忆'
      : ''

  const filtered = useMemo(() => {
    if (activeTag === '全部') return memories
    return memories.filter((memory) => DOMAIN_LABEL[memory.domain] === activeTag)
  }, [activeTag, memories])

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="animate-[fadeUp_0.4s_ease_both]">
        <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">家的记忆</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">
          <span className="font-[var(--font-num)] font-black text-[var(--color-accent)]">
            {filtered.length}
          </span>{' '}
          条 · {getCurrentMemberName()}
        </h1>
      </div>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      {!isPaired ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm leading-6 text-[var(--color-fg)]">
            绑定设备后，这里只会显示当前成员自己的记忆；离线时也会保留最近加载过的内容。
          </p>
          <Link
            to="/pair"
            className="mt-4 block rounded-[var(--radius-sm)] bg-[var(--color-accent)] py-3 text-center text-sm text-white"
          >
            去配对
          </Link>
        </section>
      ) : null}

      {isPaired ? (
        <div className="flex gap-2 overflow-x-auto pb-1 animate-[fadeUp_0.4s_0.05s_ease_both]">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-[var(--font-body)] transition-colors ${
                activeTag === tag
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {isPaired ? (
        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[var(--color-muted)] shadow-[var(--shadow-card)]">
              还没有这一类记忆
            </div>
          ) : null}
          {filtered.map((memory, index) => {
            const tag = DOMAIN_LABEL[memory.domain]
            return (
              <article
                key={memory.id}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)]
                           px-4 py-3 shadow-[var(--shadow-card)] animate-[fadeUp_0.4s_ease_both]"
                style={{ animationDelay: `${0.1 + index * 0.06}s` }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs text-white"
                    style={{ background: MEMORY_TAG_COLORS[tag] ?? 'var(--color-muted)' }}
                  >
                    {tag}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                    {TYPE_LABEL[memory.type]}
                  </span>
                  <span className="ml-auto text-[10px] text-[var(--color-muted)]">{formatDate(memory.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--color-fg)]">{memory.content}</p>
                <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                  置信度 {(memory.confidence * 100).toFixed(0)}%
                  {memory.source_note_id ? ` · 来源 note #${memory.source_note_id}` : ''}
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
