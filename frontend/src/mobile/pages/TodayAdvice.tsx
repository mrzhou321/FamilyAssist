import { useEffect, useState } from 'react'
import { DOMAINS, DOMAIN_ICONS, DOMAIN_LABELS } from '@shared/constants'
import type { Domain } from '@shared/constants'
import { DOMAIN_CARD_COLORS } from '@shared/constants/colors'
import { api } from '@shared/api'
import type {
  Note,
  Recommendation,
  RecommendationBasisRef,
  RecommendationBatch,
  WeatherContext,
} from '@shared/types'
import { getCurrentMemberId, getCurrentMemberName } from '../session'

const FALLBACK: Record<Domain, Recommendation> = {
  dressing: {
    domain: 'dressing',
    content: '早晚偏凉，建议长袖加薄外套，膝盖容易不舒服时多一层保暖。',
    basis: ['家人怕冷', '膝盖受凉会不舒服'],
    basis_refs: [],
  },
  diet: {
    domain: 'diet',
    content: '饮食以清淡少油为主，避开已知忌口和过敏源。',
    basis: ['控糖', '不吃香菜'],
    basis_refs: [],
  },
  exercise: {
    domain: 'exercise',
    content: '适合低到中等强度活动，优先散步和拉伸。',
    basis: ['饭后喜欢散步 30 分钟'],
    basis_refs: [],
  },
}

const FALLBACK_WEATHER: WeatherContext = {
  city: '广州',
  temperature_c: 26,
  condition: 'cloudy',
  wind: 'light breeze',
  precipitation_chance: 35,
  source: 'local-fallback',
}

function formatCondition(condition: string) {
  const map: Record<string, string> = {
    clear: '晴',
    cloudy: '多云',
    overcast: '阴',
    'light rain': '小雨',
  }
  return map[condition] ?? condition
}

export default function TodayAdvice() {
  const [recommendations, setRecommendations] = useState<Record<Domain, Recommendation>>(FALLBACK)
  const [weather, setWeather] = useState<WeatherContext>(FALLBACK_WEATHER)
  const [message, setMessage] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const [sourceNote, setSourceNote] = useState<Note | null>(null)
  const memberId = getCurrentMemberId()
  const memberName = getCurrentMemberName()

  useEffect(() => {
    let active = true
    api
      .get<WeatherContext>('/weather/today')
      .then((item) => {
        if (active) setWeather(item)
      })
      .catch(() => {
        if (active) setWeather(FALLBACK_WEATHER)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    DOMAINS.forEach((domain) => params.append('domains', domain))
    if (memberId !== null) params.set('member_id', String(memberId))

    const streamStops: Array<() => void> = []
    let active = true

    api
      .get<RecommendationBatch>(`/recommendations?${params.toString()}`)
      .then(({ recommendations }) => {
        if (!active) return
        const items = recommendations.map((recommendation) => [recommendation.domain, recommendation] as const)
        setRecommendations({ ...FALLBACK, ...(Object.fromEntries(items) as Record<Domain, Recommendation>) })
        setMessage('正在生成今日建议...')

        DOMAINS.forEach((domain) => {
          const streamParams = new URLSearchParams()
          if (memberId !== null) streamParams.set('member_id', String(memberId))
          let streamed = ''
          const stop = api.stream(
            `/recommendations/${domain}/stream?${streamParams.toString()}`,
            (chunk) => {
              if (!active) return
              streamed += chunk
              setRecommendations((current) => ({
                ...current,
                [domain]: {
                  ...current[domain],
                  content: streamed,
                },
              }))
              setMessage('')
            },
            () => {
              if (active) setMessage('流式生成暂不可用，已显示完整建议')
            },
          )
          streamStops.push(stop)
        })
      })
      .catch(() => {
        if (active) setMessage('后端暂不可用，正在显示本地建议')
      })

    return () => {
      active = false
      streamStops.forEach((stop) => stop())
    }
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

  async function openBasis(ref: RecommendationBasisRef) {
    if (!ref.source_note_id) {
      setMessage('这条依据来自种子记忆，暂无原始速记')
      return
    }
    try {
      const note = await api.get<Note>(`/notes/${ref.source_note_id}`)
      setSourceNote(note)
      setMessage('')
    } catch {
      setMessage('无法加载原始速记')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div
        className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-sage)] to-[var(--color-accent)]
                   p-4 text-white shadow-[var(--shadow-card)] animate-[fadeUp_0.4s_ease_both]"
      >
        <p className="font-[var(--font-num)] text-sm opacity-90">
          {weather.city} · 今日 · {memberName}
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-[var(--font-num)] text-5xl font-black leading-none">
            {weather.temperature_c}°
          </span>
          <span className="font-[var(--font-body)] text-sm opacity-90">
            {formatCondition(weather.condition)} · {weather.wind} · 降水 {weather.precipitation_chance}%
          </span>
        </div>
      </div>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      {sourceNote ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-muted)]">原始速记 #{sourceNote.id}</span>
            <button type="button" onClick={() => setSourceNote(null)} className="text-xs text-[var(--color-muted)]">
              关闭
            </button>
          </div>
          {sourceNote.content}
        </div>
      ) : null}

      {DOMAINS.map((domain, index) => {
        const advice = recommendations[domain]
        const colors = DOMAIN_CARD_COLORS[domain]
        const basisRefs = advice.basis_refs.length > 0
          ? advice.basis_refs
          : advice.basis.map((item, basisIndex) => ({
              memory_id: basisIndex,
              source_note_id: null,
              content: item,
            }))
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
            <div className="rounded-lg border border-white bg-white/60 px-3 py-1.5 text-xs text-[var(--color-muted)]">
              <span>依据：</span>
              {basisRefs.map((ref, basisIndex) => (
                <button
                  key={`${ref.memory_id}-${basisIndex}`}
                  type="button"
                  onClick={() => openBasis(ref)}
                  className="mr-1 underline decoration-dotted underline-offset-2"
                >
                  {ref.content}
                  {basisIndex < basisRefs.length - 1 ? '；' : ''}
                </button>
              ))}
            </div>
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
