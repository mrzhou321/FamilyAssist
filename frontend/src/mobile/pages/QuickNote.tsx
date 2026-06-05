import { useEffect, useState } from 'react'
import { useCreateNote, useQueuedNotes, useSyncQueuedNotes } from '@shared/hooks'
import { MOCK_RECENT_NOTES, MOCK_MEMBERS } from '@shared/mocks'
import { getCurrentMemberId, getCurrentMemberName, hasPairedMember } from '../session'

// 速记标签显示名，与 member 无关
const NOTE_TAGS: Record<number, { label: string; color: string }> = {
  1: { label: '习惯', color: 'var(--color-sage)' },
  2: { label: '身体', color: 'var(--color-accent)' },
  3: { label: '饮食', color: 'var(--color-honey)' },
}

export default function QuickNote() {
  const [text, setText] = useState('')
  const [memberId, setMemberId] = useState<number | null>(() => getCurrentMemberId())
  const [message, setMessage] = useState('')
  const { mutate: createNote, isPending } = useCreateNote()
  const { data: queuedNotes = [] } = useQueuedNotes()
  const { mutate: syncNotes, isPending: isSyncing } = useSyncQueuedNotes()

  useEffect(() => {
    function handleOnline() {
      syncNotes(undefined, {
        onSuccess: (count) => {
          if (count > 0) setMessage(`已同步 ${count} 条离线速记`)
        },
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncNotes])

  function handleSubmit() {
    if (!text.trim()) return
    createNote(
      { content: text, member_id: memberId ?? getCurrentMemberId(), source: 'text' },
      {
        onSuccess: () => {
          setText('')
          setMessage(navigator.onLine ? '已记下，正在理解中' : '已离线暂存，联网后自动同步')
        },
        onError: () => {
          setText('')
          setMessage('后端暂不可用，已暂存本地队列')
        },
      },
    )
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* 问候 */}
      <div className="animate-[fadeUp_0.5s_ease_both]">
        <p className="font-[var(--font-num)] italic text-[var(--color-muted)] text-sm">下午好</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)] leading-tight">
          {getCurrentMemberName()}，<span className="text-[var(--color-accent)]">随手记一笔</span>
        </h1>
        {!hasPairedMember() ? (
          <p className="mt-1 text-xs text-[var(--color-muted)]">当前使用演示身份，扫码配对后会自动切换。</p>
        ) : null}
      </div>

      {message || queuedNotes.length > 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          <div>{message || '离线速记队列等待同步'}</div>
          {queuedNotes.length > 0 ? (
            <button
              type="button"
              onClick={() => syncNotes()}
              disabled={isSyncing || !navigator.onLine}
              className="mt-2 text-xs text-[var(--color-accent)] disabled:text-[var(--color-muted)]"
            >
              {isSyncing ? '同步中…' : `待同步 ${queuedNotes.length} 条`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 便签纸输入区 */}
      <div className="relative noise tilt-1 bg-gradient-to-br from-[#FFF8E8] to-[#FDEFD3]
                      rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-card)] border border-[var(--color-border)]">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="记录家人的习惯、身体状况、饮食偏好……"
          rows={4}
          className="w-full bg-transparent resize-none outline-none font-[var(--font-body)] text-base
                     text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
        />
        <div className="flex items-center gap-3 pt-3 border-t border-dashed border-[var(--color-border)]">
          <button className="text-xl leading-none text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors">🎤</button>
          <button className="text-xl leading-none text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors">📷</button>
          <div className="ml-auto flex gap-1.5">
            {/* 全家 = null，其他成员用 id */}
            {[{ id: null, label: '全家' }, ...MOCK_MEMBERS.map(m => ({ id: m.id, label: m.role }))].map(m => (
              <button key={String(m.id)} onClick={() => setMemberId(m.id)}
                className={`text-xs px-3 py-1 rounded-full transition-colors font-[var(--font-body)]
                  ${memberId === m.id
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-white/70 text-[var(--color-muted)] border border-[var(--color-border)]'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 提交按钮 */}
      <button
        disabled={!text.trim() || isPending}
        onClick={handleSubmit}
        className="w-full py-3 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white
                   font-[var(--font-body)] text-base disabled:opacity-40 transition-opacity active:scale-[0.98]"
      >
        {isPending ? '记录中…' : '记下来'}
      </button>

      {/* 最近记录（mock，联调后替换） */}
      <div>
        <p className="font-[var(--font-num)] italic text-[var(--color-muted)] text-sm mb-3">最近记下的</p>
        <div className="flex flex-col gap-2">
          {MOCK_RECENT_NOTES.map((note, i) => {
            const member = MOCK_MEMBERS.find(m => m.id === note.member_id)
            const tag = NOTE_TAGS[i + 1] ?? { label: '记录', color: 'var(--color-muted)' }
            return (
              <div key={note.id}
                className="flex items-center gap-3 bg-[var(--color-surface-warm)] rounded-[var(--radius-sm)]
                           px-3 py-2.5 border border-[var(--color-border)] shadow-[var(--shadow-card)]
                           animate-[fadeUp_0.4s_ease_both]"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span className="text-xs px-2.5 py-0.5 rounded-full text-white whitespace-nowrap"
                  style={{ background: tag.color }}>{tag.label}</span>
                <span className="text-sm text-[var(--color-fg)] flex-1 truncate">{note.content}</span>
                <span className="text-xs text-[var(--color-muted)] shrink-0">{member?.role ?? '全家'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
