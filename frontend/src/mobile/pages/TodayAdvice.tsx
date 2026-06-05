import { useEffect, useState } from 'react'
import { DOMAINS, DOMAIN_ICONS, DOMAIN_LABELS } from '@shared/constants'
import type { Domain } from '@shared/constants'
import { DOMAIN_CARD_COLORS } from '@shared/constants/colors'
import { api } from '@shared/api'
import type { Recommendation, RecommendationBatch } from '@shared/types'
import { getCurrentMemberId, getCurrentMemberName } from '../session'

const FALLBACK: Record<Domain, Recommendation> = {
  dressing: {
    domain: 'dressing',
    content: '早晚偏凉，建议长袖加薄外套，膝盖容易不舒服时多一层保暖。',
    basis: ['妈妈怕冷', '爸爸膝盖受凉会不舒服'],
  },
  diet: {
    domain: 'diet',
    content: '饮食以清淡少油为主，避开已知忌口和过敏源。',
    basis: ['爸爸控糖', '妈妈不吃香菜'],
  },
  exercise: {
    domain: 'exercise',
    content: '适合低到中等强度活动，优先散步和拉伸。',
    basis: ['爸爸饭后喜欢散步 30 分钟'],
  },
}

export default function TodayAdvice() {
  const [recommendations, setRecommendations] = useState<Record<Domain, Recommendation>>(FALLBACK)
  const [message, setMessage] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const memberId = getCurrentMemberId()
  const memberName = getCurrentMemberName()

  useEffect(() => {
    const params = new URLSearchParams()
    DOMAINS.forEach((domain) => params.append('domains', domain))
    if (memberId !== null) params.set('member_id', String(memberId))

    api
      .get<RecommendationBatch>(`/recommendations?${params.toString()}`)
      .then(({ recommendations }) => {
        const items = recommendations.map((recommendation) => [recommendation.domain, recommendation] as const)
        setRecommendations({ ...FALLBACK, ...(Object.fromEntries(items) as Record<Domain, Recommendation>) })
        setMessage('')
      })
      .catch(() => setMessage('后端暂不可用，正在显示本地建议'))
  }, [memberId])

  async function sendFeedback(domain: Domain, content: string, accepted: boolean) {
    const key = `${domain}-${accepted ? 'yes' : 'no'}`
    setPendingKey(key)
    try {
      await api.post('/recommendations/feedback', {
        domain,
        member_id: memberId,
        content,
        accepted,
      })
      setMessage(accepted ? '已记录采纳反馈' : '已记录不合适反馈')
    } catch {
      setMessage('反馈暂未写入，稍后可重试')
    } finally {
      window.setTimeout(() => setPendingKey(''), 500)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div
        className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-sage)] to-[var(--color-accent)]
                   p-4 text-white shadow-[var(--shadow-card)] animate-[fadeUp_0.4s_ease_both]"
      >
        <p className="font-[var(--font-num)] text-sm opacity-90">广州 · 今日 · {memberName}</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-[var(--font-num)] text-5xl font-black leading-none">19°</span>
          <span className="font-[var(--font-body)] text-sm opacity-90">转晴 微风</span>
        </div>
      </div>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      {DOMAINS.map((domain, index) => {
        const advice = recommendations[domain]
        const colors = DOMAIN_CARD_COLORS[domain]
        return (
          <article
            key={domain}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-card)]
                       animate-[fadeUp_0.5s_ease_both]"
            style={{ background: colors.bg, borderColor: colors.border, animationDelay: `${0.1 + index * 0.1}s` }}
          >
            <p className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-fg)]">
              {DOMAIN_ICONS[domain]} {DOMAIN_LABELS[domain]}
            </p>
            <p className="text-sm text-[var(--color-fg)]">{advice.content}</p>
            <p className="rounded-lg border border-white bg-white/60 px-3 py-1.5 text-xs text-[var(--color-muted)]">
              依据：{advice.basis.join('；')}
            </p>
            <div className="flex gap-2">
              {[
                { label: '采纳', accepted: true },
                { label: '不合适', accepted: false },
              ].map(({ label, accepted }) => {
                const key = `${domain}-${accepted ? 'yes' : 'no'}`
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={pendingKey === key}
                    onClick={() => sendFeedback(domain, advice.content, accepted)}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-white/80 py-1.5 text-xs
                               text-[var(--color-muted)] transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {pendingKey === key ? '记录中' : label}
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
