import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from '@shared/api'
import type { Member } from '@shared/types'
import { CHRONIC_OPTIONS } from '@shared/constants'

// UI 表单类型（扁平字符串，便于 input 绑定）
interface MemberProfileForm {
  id: number
  name: string
  birthday: string
  relation: string
  height: string
  weight: string
  allergies: string
  dietRestrictions: string
  chronicConditions: string[]
  injuryHistory: string
  thermalSensitivity: number
  tastePreference: string
  exercisePreference: string
  bound: boolean
}

function toForm(member: Member): MemberProfileForm {
  return {
    id: member.id,
    name: member.name,
    birthday: member.birthday ?? '',
    relation: member.relation,
    height: member.profile.height?.toString() ?? '',
    weight: member.profile.weight?.toString() ?? '',
    allergies: member.profile.allergies.join('、'),
    dietRestrictions: member.profile.diet_restrictions.join('、'),
    chronicConditions: member.profile.chronic_conditions,
    injuryHistory: member.profile.injury_history,
    thermalSensitivity: member.profile.thermal_sensitivity,
    tastePreference: member.profile.taste_preference,
    exercisePreference: member.profile.exercise_preference,
    bound: member.bound,
  }
}

const EMPTY_MEMBER: MemberProfileForm = {
  id: 0,
  name: '',
  birthday: '',
  relation: '',
  height: '',
  weight: '',
  allergies: '',
  dietRestrictions: '',
  chronicConditions: [],
  injuryHistory: '',
  thermalSensitivity: 0,
  tastePreference: '',
  exercisePreference: '',
  bound: false,
}

function getAge(birthday: string) {
  if (!birthday) return '-'
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1
  return String(age)
}

function splitList(value: string) {
  return value
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toApiPayload(member: MemberProfileForm) {
  return {
    name: member.name,
    birthday: member.birthday || null,
    relation: member.relation,
    profile: {
      height: member.height ? Number(member.height) : null,
      weight: member.weight ? Number(member.weight) : null,
      allergies: splitList(member.allergies),
      diet_restrictions: splitList(member.dietRestrictions),
      chronic_conditions: member.chronicConditions,
      injury_history: member.injuryHistory,
      thermal_sensitivity: member.thermalSensitivity,
      taste_preference: member.tastePreference,
      exercise_preference: member.exercisePreference,
    },
  }
}

export default function Members() {
  const [members, setMembers] = useState<MemberProfileForm[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<MemberProfileForm>(EMPTY_MEMBER)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedId),
    [members, selectedId],
  )

  useEffect(() => {
    let alive = true
    api
      .get<Member[]>('/members')
      .then((apiMembers) => {
        if (!alive) return
        const nextMembers = apiMembers.map(toForm)
        setMembers(nextMembers)
        setSelectedId(nextMembers[0]?.id ?? null)
        setDraft(nextMembers[0] ?? EMPTY_MEMBER)
        setMessage(nextMembers.length > 0 ? '已连接后端成员数据' : '暂无成员，请先添加一位家庭成员')
      })
      .catch(() => {
        if (alive) setMessage('后端暂不可用，无法加载或保存成员档案')
      })
      .finally(() => {
        if (alive) setIsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function selectMember(member: MemberProfileForm) {
    setSelectedId(member.id)
    setDraft(member)
    setMessage('')
  }

  async function createMember() {
    try {
      const created = await api.post<Member>('/members', toApiPayload({ ...EMPTY_MEMBER, name: '新成员', relation: '家人' }))
      const form = toForm(created)
      setMembers((current) => [...current, form])
      setSelectedId(form.id)
      setDraft(form)
      setMessage('已在后端创建成员，请继续完善档案')
    } catch {
      setMessage('后端创建失败，请确认服务已启动后重试')
    }
  }

  function updateDraft(field: keyof MemberProfileForm, value: string | number | boolean | string[]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleCondition(condition: string) {
    const exists = draft.chronicConditions.includes(condition)
    updateDraft(
      'chronicConditions',
      exists
        ? draft.chronicConditions.filter((item) => item !== condition)
        : [...draft.chronicConditions, condition],
    )
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim() || !draft.relation.trim()) {
      setMessage('姓名和关系不能为空')
      return
    }
    if (!draft.id) {
      setMessage('请先添加成员后再保存档案')
      return
    }
    try {
      const saved = await api.patch<Member>(`/members/${draft.id}`, toApiPayload(draft))
      const form = toForm(saved)
      setMembers((current) => current.map((member) => (member.id === form.id ? form : member)))
      setDraft(form)
      setSelectedId(form.id)
      setMessage('成员档案已保存到后端')
    } catch {
      setMessage('后端保存失败，请稍后重试')
    }
  }

  async function deleteMember() {
    if (!draft.id) {
      setMessage('请先选择要删除的成员')
      return
    }
    if (members.length === 1) {
      setMessage('至少需要保留一位成员')
      return
    }

    try {
      await api.delete(`/members/${draft.id}`)
    } catch {
      setMessage('后端删除失败，请稍后重试')
      return
    }
    const remaining = members.filter((member) => member.id !== draft.id)
    setMembers(remaining)
    setSelectedId(remaining[0]?.id ?? null)
    setDraft(remaining[0] ?? EMPTY_MEMBER)
    setMessage('成员档案已删除')
  }

  return (
    <div className="p-10">
      <header className="mb-8 flex items-end justify-between animate-[fadeUp_0.4s_ease_both]">
        <div>
          <h2 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)]">成员管理</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            共 {members.length} 位成员，维护独立健康档案和记忆空间。{isLoading ? '正在连接后端...' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={createMember}
          className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2 text-sm text-white shadow-[var(--shadow-card)] transition-opacity hover:opacity-90"
        >
          添加成员
        </button>
      </header>

      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-6">
        <aside className="flex flex-col gap-3">
          {members.length === 0 ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-4 py-6 text-sm text-[var(--color-muted)] shadow-[var(--shadow-card)]">
              暂无成员档案
            </div>
          ) : null}
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => selectMember(member)}
              className={`rounded-[var(--radius-sm)] border px-4 py-3 text-left shadow-[var(--shadow-card)] transition-colors ${
                member.id === selectedId
                  ? 'border-[var(--color-accent)] bg-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-warm)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg text-[var(--color-fg)]">{member.name || '未命名成员'}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {member.relation || '关系待补充'} · {getAge(member.birthday)} 岁
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    member.bound
                      ? 'bg-[var(--color-sage)]/10 text-[var(--color-sage)]'
                      : 'bg-[var(--color-honey)]/10 text-[var(--color-accent)]'
                  }`}
                >
                  {member.bound ? '已绑定' : '未配对'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  ...splitList(member.allergies).slice(0, 2),
                  ...splitList(member.dietRestrictions).slice(0, 2),
                  ...member.chronicConditions.slice(0, 2),
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--color-border)] bg-white px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </aside>

        <form
          onSubmit={saveMember}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-card)]"
        >
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">
                {selectedMember?.name || '新成员'}
              </p>
              <h3 className="font-[var(--font-display)] text-2xl text-[var(--color-fg)]">健康档案</h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={deleteMember}
                disabled={!draft.id}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
              >
                删除
              </button>
              <button
                type="submit"
                className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 py-2 text-sm text-white"
              >
                保存档案
              </button>
            </div>
          </div>

          {message ? (
            <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-[var(--color-surface-warm)] px-4 py-3 text-sm text-[var(--color-fg)]">
              {message}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label="姓名">
              <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className="input" />
            </Field>
            <Field label="关系">
              <input
                value={draft.relation}
                onChange={(event) => updateDraft('relation', event.target.value)}
                className="input"
              />
            </Field>
            <Field label="生日">
              <input
                type="date"
                value={draft.birthday}
                onChange={(event) => updateDraft('birthday', event.target.value)}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="身高 cm">
                <input
                  inputMode="decimal"
                  value={draft.height}
                  onChange={(event) => updateDraft('height', event.target.value)}
                  className="input"
                />
              </Field>
              <Field label="体重 kg">
                <input
                  inputMode="decimal"
                  value={draft.weight}
                  onChange={(event) => updateDraft('weight', event.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="过敏源">
              <textarea
                value={draft.allergies}
                onChange={(event) => updateDraft('allergies', event.target.value)}
                className="input min-h-20"
                placeholder="食物、药物、环境，逗号或换行分隔"
              />
            </Field>
            <Field label="饮食限制">
              <textarea
                value={draft.dietRestrictions}
                onChange={(event) => updateDraft('dietRestrictions', event.target.value)}
                className="input min-h-20"
                placeholder="忌口、素食、清真等"
              />
            </Field>
            <Field label="慢性病">
              <div className="flex min-h-20 flex-wrap content-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] p-3">
                {CHRONIC_OPTIONS.map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => toggleCondition(condition)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      draft.chronicConditions.includes(condition)
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                        : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'
                    }`}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="伤病史">
              <textarea
                value={draft.injuryHistory}
                onChange={(event) => updateDraft('injuryHistory', event.target.value)}
                className="input min-h-20"
              />
            </Field>
            <Field label={`体感：${draft.thermalSensitivity > 0 ? '怕热' : draft.thermalSensitivity < 0 ? '怕冷' : '中性'}`}>
              <input
                type="range"
                min="-2"
                max="2"
                step="1"
                value={draft.thermalSensitivity}
                onChange={(event) => updateDraft('thermalSensitivity', Number(event.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                <span>怕冷</span>
                <span>中性</span>
                <span>怕热</span>
              </div>
            </Field>
            <Field label="口味偏好">
              <textarea
                value={draft.tastePreference}
                onChange={(event) => updateDraft('tastePreference', event.target.value)}
                className="input min-h-20"
              />
            </Field>
            <Field label="运动偏好">
              <textarea
                value={draft.exercisePreference}
                onChange={(event) => updateDraft('exercisePreference', event.target.value)}
                className="input min-h-20"
              />
            </Field>
            <Field label="设备状态">
              <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-3 text-sm text-[var(--color-fg)]">
                {draft.bound ? '已有有效移动端配对' : '暂无有效移动端配对'}
              </div>
            </Field>
          </div>
        </form>
      </div>
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
