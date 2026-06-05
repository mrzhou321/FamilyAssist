const MEMORIES = [
  { tag: '习惯', color: 'var(--color-sage)', text: '每周三全家吃面', member: '全家', date: '3 天前' },
  { tag: '身体', color: 'var(--color-accent)', text: '妈妈怕冷，容易手脚凉', member: '妈妈', date: '1 周前' },
  { tag: '饮食', color: 'var(--color-honey)', text: '妈妈不爱香菜，喜欢清淡口味', member: '妈妈', date: '2 周前' },
  { tag: '过敏', color: '#C8704F', text: '朵朵对芒果过敏', member: '朵朵', date: '1 月前' },
  { tag: '习惯', color: 'var(--color-sage)', text: '爸爸饭后散步 30 分钟', member: '爸爸', date: '1 月前' },
  { tag: '健康', color: '#C8704F', text: '爸爸控糖，晚餐少甜食', member: '爸爸', date: '2 月前' },
]

const TAGS = ['全部', '习惯', '身体', '饮食', '健康']

export default function MemoryVault() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="animate-[fadeUp_0.4s_ease_both]">
        <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">家的记忆</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">
          <span className="font-[var(--font-num)] font-black text-[var(--color-accent)]">
            {MEMORIES.length}
          </span>{' '}
          条
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 animate-[fadeUp_0.4s_0.05s_ease_both]">
        {TAGS.map((tag, index) => (
          <button
            key={tag}
            type="button"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-[var(--font-body)] transition-colors ${
              index === 0
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {MEMORIES.map((memory, index) => (
          <article
            key={`${memory.member}-${memory.text}`}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]
                       bg-[var(--color-surface-warm)] px-4 py-3 shadow-[var(--shadow-card)]
                       animate-[fadeUp_0.4s_ease_both]"
            style={{ animationDelay: `${0.1 + index * 0.06}s` }}
          >
            <span
              className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs text-white"
              style={{ background: memory.color }}
            >
              {memory.tag}
            </span>
            <span className="flex-1 text-sm text-[var(--color-fg)]">{memory.text}</span>
            <div className="shrink-0 text-right">
              <p className="text-xs text-[var(--color-muted)]">{memory.member}</p>
              <p className="text-[10px] text-[var(--color-muted)] opacity-70">{memory.date}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
