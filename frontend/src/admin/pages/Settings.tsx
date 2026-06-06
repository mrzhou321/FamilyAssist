import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from '../../shared/api'

interface SystemSettings {
  llm_provider: string
  generation_model: string
  embedding_model: string
  weather_api_key: string
  default_city: string
  extraction_retries: number
  dedupe_threshold: number
  cloud_llm_risk_acknowledged: boolean
}

interface ProviderCheck {
  status: 'ready' | 'degraded' | 'error'
  label: string
  detail: string
}

interface ProviderStatus {
  database: ProviderCheck
  llm: ProviderCheck
  weather: ProviderCheck
  embedding: ProviderCheck
  privacy: ProviderCheck
}

const DEFAULT_SETTINGS: SystemSettings = {
  llm_provider: 'ollama',
  generation_model: 'qwen2.5:3b',
  embedding_model: 'bge-small-zh-v1.5',
  weather_api_key: '',
  default_city: '广州',
  extraction_retries: 3,
  dedupe_threshold: 0.86,
  cloud_llm_risk_acknowledged: false,
}

const DEFAULT_PROVIDER_STATUS: ProviderStatus = {
  database: { status: 'degraded', label: '等待检查', detail: '正在读取后端状态' },
  llm: { status: 'degraded', label: '等待检查', detail: '正在读取模型 Provider' },
  weather: { status: 'degraded', label: '等待检查', detail: '正在读取天气来源' },
  embedding: { status: 'degraded', label: '等待检查', detail: '正在读取向量配置' },
  privacy: { status: 'degraded', label: '等待检查', detail: '正在读取隐私策略' },
}

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>(DEFAULT_PROVIDER_STATUS)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const [loadedSettings, loadedStatus] = await Promise.all([
        api.get<SystemSettings>('/settings'),
        api.get<ProviderStatus>('/settings/provider-status'),
      ])
      setSettings(loadedSettings)
      setProviderStatus(loadedStatus)
    } catch {
      setMessage('后端暂不可用，正在显示默认设置')
    }
  }

  function update<K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const saved = await api.patch<SystemSettings>('/settings', settings)
      setSettings(saved)
      setMessage('设置已保存')
      const status = await api.get<ProviderStatus>('/settings/provider-status')
      setProviderStatus(status)
    } catch {
      setMessage('保存失败，请稍后重试')
    }
  }

  async function cleanupExpired() {
    try {
      const result = await api.post<{ removed: number }>('/settings/cleanup-expired-memories', {})
      setMessage(`已清理 ${result.removed} 条过期记忆`)
      const status = await api.get<ProviderStatus>('/settings/provider-status')
      setProviderStatus(status)
    } catch {
      setMessage('清理失败，请稍后重试')
    }
  }

  const usesCloudProvider = settings.llm_provider !== 'ollama'

  return (
    <div className="p-10">
      <header className="mb-8 animate-[fadeUp_0.4s_ease_both]">
        <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">系统设置</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          管理模型、天气、抽取和记忆维护参数。
        </p>
      </header>

      {message ? (
        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-[1040px]:grid-cols-1">
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-5 text-xl text-[var(--color-fg)]">模型与抽取</h3>
          <div className="grid grid-cols-2 gap-4 max-[820px]:grid-cols-1">
            <Field label="LLM Provider">
              <select
                value={settings.llm_provider}
                onChange={(event) => update('llm_provider', event.target.value)}
                className="input"
              >
                <option value="ollama">Ollama 本地</option>
                <option value="deepseek">DeepSeek 云端</option>
                <option value="qwen">通义千问云端</option>
              </select>
            </Field>
            <Field label="生成模型">
              <input
                value={settings.generation_model}
                onChange={(event) => update('generation_model', event.target.value)}
                className="input"
              />
            </Field>
            <Field label="向量模型">
              <input
                value={settings.embedding_model}
                onChange={(event) => update('embedding_model', event.target.value)}
                className="input"
              />
            </Field>
            <Field label={`抽取重试次数：${settings.extraction_retries}`}>
              <input
                type="range"
                min="0"
                max="10"
                value={settings.extraction_retries}
                onChange={(event) => update('extraction_retries', Number(event.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </Field>
            <Field label={`去重阈值：${settings.dedupe_threshold.toFixed(2)}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.dedupe_threshold}
                onChange={(event) => update('dedupe_threshold', Number(event.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </Field>
          </div>

          {usesCloudProvider ? (
            <label className="mt-5 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={settings.cloud_llm_risk_acknowledged}
                onChange={(event) => update('cloud_llm_risk_acknowledged', event.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              已知晓云端 LLM 会发送速记和上下文到第三方 API
            </label>
          ) : null}
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg text-[var(--color-fg)]">运行状态</h3>
              <button
                type="button"
                onClick={loadSettings}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
              >
                刷新
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <StatusRow title="数据库" check={providerStatus.database} />
              <StatusRow title="LLM" check={providerStatus.llm} />
              <StatusRow title="天气" check={providerStatus.weather} />
              <StatusRow title="向量" check={providerStatus.embedding} />
              <StatusRow title="隐私" check={providerStatus.privacy} />
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-lg text-[var(--color-fg)]">天气服务</h3>
            <div className="flex flex-col gap-4">
              <Field label="默认城市">
                <input
                  value={settings.default_city}
                  onChange={(event) => update('default_city', event.target.value)}
                  className="input"
                />
              </Field>
              <Field label="和风天气 API Key">
                <input
                  value={settings.weather_api_key}
                  onChange={(event) => update('weather_api_key', event.target.value)}
                  className="input"
                  placeholder="可留空"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-lg text-[var(--color-fg)]">内存管理</h3>
            <button
              type="button"
              onClick={cleanupExpired}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
            >
              清理过期情景记忆
            </button>
          </section>

          <button
            type="submit"
            className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-3 text-sm text-white shadow-[var(--shadow-card)]"
          >
            保存设置
          </button>
        </aside>
      </form>
    </div>
  )
}

function StatusRow({ title, check }: { title: string; check: ProviderCheck }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted)]">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(check.status)}`}>
          {statusLabel(check.status)}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg)]">{check.label}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{check.detail}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
      <span>{label}</span>
      {children}
    </label>
  )
}

function statusLabel(status: ProviderCheck['status']) {
  if (status === 'ready') return '可用'
  if (status === 'degraded') return '降级'
  return '异常'
}

function statusClass(status: ProviderCheck['status']) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700'
  if (status === 'degraded') return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}
