import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateNote, useMemberNotes, useQueuedNotes, useSyncQueuedNotes } from '@shared/hooks'
import { detectMobileCapabilities } from '../capabilities'
import { getCurrentMemberId, getCurrentMemberName, hasPairedMember } from '../session'

type NoteSource = 'text' | 'voice' | 'photo'

interface PhotoCapture {
  name: string
  type: string
  size: number
  capturedAt: string
  previewUrl: string
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike | undefined
  length: number
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: SpeechRecognitionResultLike
    length: number
  }
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

function getSpeechRecognition() {
  const speechWindow = window as SpeechRecognitionWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

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
  const [source, setSource] = useState<NoteSource>('text')
  const [isListening, setIsListening] = useState(false)
  const [photoCapture, setPhotoCapture] = useState<PhotoCapture | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const { mutate: createNote, isPending } = useCreateNote()
  const { data: queuedNotes = [] } = useQueuedNotes()
  const isPaired = hasPairedMember()
  const currentMemberName = getCurrentMemberName()
  const { data: recentNotes = [] } = useMemberNotes(memberId, isPaired)
  const { mutate: syncNotes, isPending: isSyncing } = useSyncQueuedNotes()
  const [capabilities] = useState(() => detectMobileCapabilities())
  const memberChoices = isPaired && memberId !== null ? [{ id: memberId, label: currentMemberName }] : []
  const memberLabel = new Map(memberChoices.map((member) => [member.id, member.label]))

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

  useEffect(() => () => recognitionRef.current?.stop(), [])

  useEffect(() => {
    return () => {
      if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl)
    }
  }, [photoCapture])

  function appendCapturedText(nextText: string, nextSource: NoteSource) {
    setText((current) => [current.trim(), nextText].filter(Boolean).join('\n'))
    setSource(nextSource)
  }

  function formatPhotoSize(size: number) {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
    return `${(size / 1024 / 1024).toFixed(1)}MB`
  }

  function buildPhotoNoteText(file: File) {
    const capturedAt = new Date(file.lastModified || Date.now()).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const mediaType = file.type || 'image/*'
    return `拍照记录：${file.name}\n照片信息：${mediaType}，${formatPhotoSize(file.size)}，拍摄/选择时间 ${capturedAt}`
  }

  function handleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setMessage('当前浏览器暂不支持语音输入，可先使用文字速记')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => {
      setIsListening(true)
      setMessage('正在听你说话…')
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => {
      setIsListening(false)
      setMessage('语音识别未完成，请再试一次或改用文字')
    }
    recognition.onresult = (event) => {
      const transcript = Array.from(
        { length: event.results.length },
        (_, index) => event.results[index][0]?.transcript.trim() ?? '',
      )
        .filter(Boolean)
        .join(' ')

      if (transcript) {
        appendCapturedText(transcript, 'voice')
        setMessage('语音已转成文字，可直接记下来')
      }
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  function handlePhotoCapture(file: File | undefined) {
    if (!file) return
    if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl)
    setPhotoCapture({
      name: file.name,
      type: file.type || 'image/*',
      size: file.size,
      capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
      previewUrl: URL.createObjectURL(file),
    })
    appendCapturedText(buildPhotoNoteText(file), 'photo')
    if (photoInputRef.current) photoInputRef.current.value = ''
    setMessage('照片已加入速记，补一句说明会更容易理解')
  }

  function handleSubmit() {
    const trimmedText = text.trim()
    if (!trimmedText) return
    if (!isPaired) {
      setMessage('请先由管理员生成配对码，扫码绑定后再记录家庭记忆')
      return
    }
    createNote(
      { content: trimmedText, member_id: memberId, source },
      {
        onSuccess: () => {
          setText('')
          setSource('text')
          if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl)
          setPhotoCapture(null)
          setMessage(navigator.onLine ? '已记下，正在理解中' : '已离线暂存，联网后自动同步')
        },
        onError: () => {
          setText('')
          setSource('text')
          if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl)
          setPhotoCapture(null)
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
        {!isPaired ? (
          <p className="mt-1 text-xs text-[var(--color-muted)]">先用管理员生成的配对码绑定设备，再开始记录家庭记忆。</p>
        ) : null}
      </div>

      {!isPaired ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm leading-6 text-[var(--color-fg)]">
            这台设备还没有绑定家庭成员。请让管理员在后台生成配对二维码，用手机扫码后会自动带入 token。
          </p>
          <Link
            to="/pair"
            className="mt-4 block rounded-[var(--radius-sm)] bg-[var(--color-accent)] py-3 text-center text-sm text-white"
          >
            输入配对 token
          </Link>
        </section>
      ) : null}

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

      <div className="grid grid-cols-4 gap-2">
        <CapabilityPill label="语音" ready={capabilities.speech} />
        <CapabilityPill label="拍照" ready={capabilities.camera} />
        <CapabilityPill label="离线" ready={capabilities.indexedDb} />
        <CapabilityPill label="PWA" ready={capabilities.serviceWorker || capabilities.standalone} />
      </div>

      {isPaired ? (
        <>
          <div className="relative noise tilt-1 bg-gradient-to-br from-[var(--color-note-paper-from)] to-[var(--color-note-paper-to)]
                          rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-card)] border border-[var(--color-border)]">
            <textarea
              value={text}
              onChange={e => {
                setText(e.target.value)
                setSource('text')
                if (photoCapture?.previewUrl) URL.revokeObjectURL(photoCapture.previewUrl)
                setPhotoCapture(null)
              }}
              placeholder="记录家人的习惯、身体状况、饮食偏好……"
              rows={4}
              className="w-full bg-transparent resize-none outline-none font-[var(--font-body)] text-base
                         text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
            {photoCapture ? (
              <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/70 px-3 py-2 text-xs text-[var(--color-muted)]">
                <img
                  src={photoCapture.previewUrl}
                  alt="拍照速记预览"
                  className="h-14 w-14 rounded-[var(--radius-sm)] object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[var(--color-fg)]">照片：{photoCapture.name}</p>
                  <p className="mt-1 truncate">
                    {formatPhotoSize(photoCapture.size)} · {photoCapture.type}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-3 pt-3 border-t border-dashed border-[var(--color-border)]">
              <button
                type="button"
                aria-label={isListening ? '停止语音输入' : '开始语音输入'}
                title={isListening ? '停止语音输入' : '开始语音输入'}
                onClick={handleVoiceInput}
                className={`grid h-9 w-9 place-items-center rounded-full text-xl leading-none transition-colors
                  ${isListening
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-accent)]'}`}
              >
                🎤
              </button>
              <button
                type="button"
                aria-label="拍照速记"
                title="拍照速记"
                onClick={() => photoInputRef.current?.click()}
                className="grid h-9 w-9 place-items-center rounded-full text-xl leading-none text-[var(--color-muted)]
                           transition-colors hover:bg-white/70 hover:text-[var(--color-accent)]"
              >
                📷
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handlePhotoCapture(event.target.files?.[0])}
              />
              <div className="ml-auto flex gap-1.5">
                {[{ id: null, label: '全家' }, ...memberChoices].map(m => (
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

          <button
            disabled={!text.trim() || isPending}
            onClick={handleSubmit}
            className="w-full py-3 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white
                       font-[var(--font-body)] text-base disabled:opacity-40 transition-opacity active:scale-[0.98]"
          >
            {isPending ? '记录中…' : '记下来'}
          </button>
        </>
      ) : null}

      {isPaired ? (
        <div>
          <p className="font-[var(--font-num)] italic text-[var(--color-muted)] text-sm mb-3">最近记下的</p>
          <div className="flex flex-col gap-2">
            {[...queuedNotes, ...recentNotes].slice(0, 6).map((note, i) => {
              const tag = NOTE_TAGS[i + 1] ?? { label: '记录', color: 'var(--color-muted)' }
              return (
                <div key={'queue_id' in note ? note.queue_id : note.id}
                  className="flex items-center gap-3 bg-[var(--color-surface-warm)] rounded-[var(--radius-sm)]
                             px-3 py-2.5 border border-[var(--color-border)] shadow-[var(--shadow-card)]
                             animate-[fadeUp_0.4s_ease_both]"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <span className="text-xs px-2.5 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ background: tag.color }}>{tag.label}</span>
                  <span className="text-sm text-[var(--color-fg)] flex-1 truncate">{note.content}</span>
                  <span className="text-xs text-[var(--color-muted)] shrink-0">
                    {'queue_id' in note ? '待同步' : note.member_id ? memberLabel.get(note.member_id) ?? '成员' : '全家'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CapabilityPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-[11px] ${
        ready
          ? 'border-[var(--color-sage)]/30 bg-[var(--color-sage)]/10 text-[var(--color-sage)]'
          : 'border-[var(--color-border)] bg-white text-[var(--color-muted)]'
      }`}
    >
      {label} · {ready ? '可用' : '受限'}
    </div>
  )
}
