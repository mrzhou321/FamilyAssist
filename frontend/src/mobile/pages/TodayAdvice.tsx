import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  cacheRecommendations,
  cacheWeather,
  getCachedRecommendations,
  getCachedWeather,
} from '../offline/cachedData'
import { getCurrentMemberId, getCurrentMemberName, hasPairedMember } from '../session'

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
  const [recommendations, setRecommendations] = useState<Partial<Record<Domain, Recommendation>>>({})
  const [weather, setWeather] = useState<WeatherContext | null>(null)
  const [message, setMessage] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const [sourceNote, setSourceNote] = useState<Note | null>(null)
  const isPaired = hasPairedMember()
  const memberId = getCurrentMemberId()
  const memberName = getCurrentMemberName()

  useEffect(() => {
    if (!isPaired) return
    let active = true
    api
      .get<WeatherContext>('/weather/today')
      .then((item) => {
        void cacheWeather(item)
        if (active) setWeather(item)
      })
      .catch(async () => {
        const cached = await getCachedWeather()
        if (active) setWeather(cached)
      })
    return () => {
      active = false
    }
  }, [isPaired])

  useEffect(() => {
    if (!isPaired) return
    const params = new URLSearchParams()
    DOMAINS.forEach((domain) => params.append('domains', domain))
    if (memberId !== null) params.set('member_id', String(memberId))
    params.set('record_events', 'false')

    const streamStops: Array<() => void> = []
    let active = true

    api
      .get<RecommendationBatch>(`/recommendations?${params.toString()}`)
      .then(({ recommendations }) => {
        if (!active) return
        void cacheRecommendations(memberId, recommendations)
        const items = recommendations.map((recommendation) => [recommendation.domain, recommendation] as const)
        const baseRecommendations = Object.fromEntries(items) as Partial<Record<Domain, Recommendation>>
        setRecommendations(baseRecommendations)
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
                  ...baseRecommendations[domain],
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
      .catch(async () => {
        const cached = await getCachedRecommendations(memberId)
        if (!active) return
        if (cached.length > 0) {
          const items = cached.map((recommendation) => [recommendation.domain, recommendation] as const)
          setRecommendations(Object.fromEntries(items) as Partial<Record<Domain, Recommendation>>)
          setMessage('当前离线，正在显示上次加载的建议')
        } else {
          setRecommendations({})
          setMessage('后端暂不可用，暂无可用的本地建议缓存')
        }
      })

    return () => {
      active = false
      streamStops.forEach((stop) => stop())
    }
  }, [isPaired, memberId])

  async function sendFeedback(domain: Domain, content: string, accepted: boolean) {
    if (!isPaired) {
      setMessage('请先配对设备，再反馈建议是否合适')
      return
    }
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
    if (!isPaired) {
      setMessage('请先配对设备，再查看建议依据')
      return
    }
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
          {weather ? `${weather.city} · 今日 · ${memberName}` : `今日 · ${memberName}`}
        </p>
        {weather ? (
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-[var(--font-num)] text-5xl font-black leading-none">
              {weather.temperature_c}°
            </span>
            <span className="font-[var(--font-body)] text-sm opacity-90">
              {formatCondition(weather.condition)} · {weather.wind} · 降水 {weather.precipitation_chance}%
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm opacity-90">天气加载中，离线时会使用上次缓存</p>
        )}
      </div>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      {!isPaired ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm leading-6 text-[var(--color-fg)]">
            配对后，今日建议会结合当前成员的记忆、健康档案和天气生成；离线时会保留上次加载过的建议。
          </p>
          <Link
            to="/pair"
            className="mt-4 block rounded-[var(--radius-sm)] bg-[var(--color-accent)] py-3 text-center text-sm text-white"
          >
            去配对
          </Link>
        </section>
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

      {isPaired ? DOMAINS.map((domain, index) => {
        const advice = recommendations[domain]
        const colors = DOMAIN_CARD_COLORS[domain]
        if (!advice) {
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
              <p className="text-sm text-[var(--color-muted)]">暂无可用建议，联网后会自动加载真实建议。</p>
            </article>
          )
        }
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
      }) : null}
    </div>
  )
}
