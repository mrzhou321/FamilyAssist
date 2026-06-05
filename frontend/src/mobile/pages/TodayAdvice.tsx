import { useEffect, useState } from 'react'
import { api } from '../../shared/api'

type Domain = 'dressing' | 'diet' | 'exercise'

interface Recommendation {
  domain: Domain
  content: string
  basis: string[]
}

interface AdviceView {
  domain: Domain
  icon: string
  title: string
  bg: string
  border: string
  fallback: string
  fallbackBasis: string[]
}

const ADVICE_META: AdviceView[] = [
  {
    domain: 'dressing',
    icon: '🧥',
    title: '穿衣',
    bg: '#FDF0E8',
    border: '#F0C9A8',
    fallback: '早晚偏凉，建议薄外套加长袖，膝盖容易不舒服的成员可以多一层保暖。',
    fallbackBasis: ['妈妈怕冷', '爸爸膝盖受凉会不舒服'],
  },
  {
    domain: 'diet',
    icon: '🍲',
    title: '饮食',
    bg: '#EEF4EE',
    border: '#B8D4B8',
    fallback: '晚餐少油少糖，以清淡汤品为主，避开香菜和芒果相关食材。',
    fallbackBasis: ['爸爸控糖', '妈妈不吃香菜', '朵朵芒果过敏'],
  },
  {
    domain: 'exercise',
    icon: '🚶',
    title: '运动',
    bg: '#EDF2FB',
    border: '#B4C8F0',
    fallback: '适合饭后散步 20-30 分钟，避免剧烈跑跳，户外注意风大时减少停留。',
    fallbackBasis: ['爸爸习惯饭后散步', '近期膝盖需要照顾'],
  },
]

function mergeAdvice(meta: AdviceView, recommendation?: Recommendation) {
  return {
    ...meta,
    text: recommendation?.content ?? meta.fallback,
    basis: recommendation?.basis.length ? recommendation.basis : meta.fallbackBasis,
  }
}

export default function TodayAdvice() {
  const [recommendations, setRecommendations] = useState<Partial<Record<Domain, Recommendation>>>({})
  const [message, setMessage] = useState('')
  const [feedbackKey, setFeedbackKey] = useState('')

  useEffect(() => {
    Promise.all(
      ADVICE_META.map((meta) =>
        api
          .get<Recommendation>(`/recommendations/${meta.domain}?member_id=1`)
          .then((recommendation) => [meta.domain, recommendation] as const),
      ),
    )
      .then((items) => {
        setRecommendations(Object.fromEntries(items) as Partial<Record<Domain, Recommendation>>)
      })
      .catch(() => setMessage('后端暂不可用，正在显示本地建议'))
  }, [])

  async function sendFeedback(domain: Domain, content: string, accepted: boolean) {
    const key = `${domain}-${accepted ? 'yes' : 'no'}`
    setFeedbackKey(key)
    try {
      await api.post('/recommendations/feedback', {
        domain,
        member_id: 1,
        content,
        accepted,
      })
      setMessage(accepted ? '已记录采纳反馈' : '已记录不合适反馈')
    } catch {
      setMessage('反馈记录失败，请稍后重试')
    } finally {
      window.setTimeout(() => setFeedbackKey(''), 600)
    }
  }

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

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      {ADVICE_META.map((meta, index) => {
        const advice = mergeAdvice(meta, recommendations[meta.domain])
        return (
          <article
            key={advice.domain}
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
            <div className="rounded-lg border border-white bg-white/60 px-3 py-1.5 text-xs text-[var(--color-muted)]">
              依据：{advice.basis.join('；')}
            </div>
            <div className="flex gap-2">
              {[
                { label: '采纳', accepted: true },
                { label: '不合适', accepted: false },
              ].map(({ label, accepted }) => {
                const key = `${advice.domain}-${accepted ? 'yes' : 'no'}`
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => sendFeedback(advice.domain, advice.text, accepted)}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-white/80 py-1.5 text-xs
                               text-[var(--color-muted)] transition-transform active:scale-95 disabled:opacity-50"
                    disabled={feedbackKey === key}
                  >
                    {feedbackKey === key ? '记录中' : label}
                  </button>
                )
              })}
            </div>
          </article>
        )
      })}
    </div>
  )
}
