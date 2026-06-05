const ADVICES = [
  {
    icon: '🧥',
    title: '穿衣',
    bg: '#FDF0E8',
    border: '#F0C9A8',
    text: '早晚偏凉，建议薄外套加长袖，膝盖容易不舒服的成员可以多一层保暖。',
    basis: '妈妈怕冷；爸爸膝盖受凉会不舒服。',
  },
  {
    icon: '🍲',
    title: '饮食',
    bg: '#EEF4EE',
    border: '#B8D4B8',
    text: '晚餐少油少糖，以清淡汤品为主，避开香菜和芒果相关食材。',
    basis: '爸爸控糖；妈妈不吃香菜；朵朵芒果过敏。',
  },
  {
    icon: '🚶',
    title: '运动',
    bg: '#EDF2FB',
    border: '#B4C8F0',
    text: '适合饭后散步 20-30 分钟，避免剧烈跑跳，户外注意风大时减少停留。',
    basis: '爸爸习惯饭后散步；近期膝盖需要照顾。',
  },
]

export default function TodayAdvice() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div
        className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-sage)] to-[var(--color-accent)]
                   p-4 text-white shadow-[var(--shadow-card)] animate-[fadeUp_0.4s_ease_both]"
      >
        <p className="font-[var(--font-num)] text-sm opacity-90">广州 · 今日</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-[var(--font-num)] text-5xl font-black leading-none">19°</span>
          <span className="font-[var(--font-body)] text-sm opacity-90">转晴 · 微风</span>
        </div>
      </div>

      {ADVICES.map((advice, index) => (
        <article
          key={advice.title}
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-card)]
                     animate-[fadeUp_0.5s_ease_both]"
          style={{
            background: advice.bg,
            borderColor: advice.border,
            animationDelay: `${0.1 + index * 0.1}s`,
          }}
        >
          <p className="text-lg font-semibold text-[var(--color-fg)]">
            {advice.icon} {advice.title}
          </p>
          <p className="text-sm text-[var(--color-fg)]">{advice.text}</p>
          <button
            type="button"
            className="rounded-lg border border-white bg-white/60 px-3 py-1.5 text-left text-xs text-[var(--color-muted)]"
          >
            依据：{advice.basis}
          </button>
          <div className="flex gap-2">
            {['采纳', '不合适'].map((label) => (
              <button
                key={label}
                type="button"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-white/80 py-1.5 text-xs
                           text-[var(--color-muted)] transition-transform active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
