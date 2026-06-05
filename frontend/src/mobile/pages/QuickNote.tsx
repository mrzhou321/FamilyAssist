import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  listQuickNotes,
  saveQuickNote,
  updateQuickNoteStatus,
} from '../storage/quickNoteQueue'
import type { QueuedQuickNote, QuickNoteSource } from '../storage/quickNoteQueue'
import { api } from '../../shared/api'

const MEMBERS = ['全家', '爸爸', '妈妈', '朵朵']

const SAMPLE_NOTES: QueuedQuickNote[] = [
  {
    id: 'sample-1',
    member: '爸爸',
    content: '爸爸晚饭后喜欢散步 30 分钟，膝盖受凉会不舒服。',
    source: 'text',
    createdAt: '2026-06-05T08:30:00.000Z',
    status: 'synced',
  },
  {
    id: 'sample-2',
    member: '朵朵',
    content: '朵朵对芒果过敏。',
    source: 'text',
    createdAt: '2026-06-04T12:10:00.000Z',
    status: 'synced',
  },
  {
    id: 'sample-3',
    member: '妈妈',
    content: '妈妈不吃香菜，喜欢清淡一点的汤。',
    source: 'text',
    createdAt: '2026-06-03T10:20:00.000Z',
    status: 'synced',
  },
]

type SpeechRecognitionConstructor = new () => SpeechRecognition

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: { transcript: string }
    }
    length: number
  }
}

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition
}

function makeQuickNote(
  content: string,
  member: string,
  source: QuickNoteSource,
  photoName?: string,
): QueuedQuickNote {
  const cryptoId = window.crypto?.randomUUID?.()
  return {
    id: cryptoId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    member,
    content,
    source,
    photoName,
    createdAt: new Date().toISOString(),
    status: navigator.onLine ? 'queued' : 'failed',
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function QuickNote() {
  const [text, setText] = useState('')
  const [member, setMember] = useState('全家')
  const [photoName, setPhotoName] = useState<string>()
  const [notes, setNotes] = useState<QueuedQuickNote[]>([])
  const [toast, setToast] = useState('')
  const [isListening, setIsListening] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const speechAvailable = useMemo(() => {
    if (typeof window === 'undefined') return false
    return Boolean(getSpeechRecognition())
  }, [])

  useEffect(() => {
    let alive = true
    listQuickNotes().then((queuedNotes) => {
      if (alive) setNotes([...queuedNotes, ...SAMPLE_NOTES])
    })
    return () => {
      alive = false
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  function startVoiceInput() {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      setToast('当前浏览器暂不支持语音输入')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, index) => event.results[index][0].transcript)
        .join('')
      setText((current) => `${current}${current ? '\n' : ''}${transcript}`)
    }
    recognition.onerror = () => {
      setToast('语音识别失败，请改用文字记录')
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoName(file.name)
    setToast('已附上照片，提交后会进入后台理解')
  }

  async function submitNote() {
    const trimmed = text.trim()
    if (!trimmed) return

    const note = makeQuickNote(trimmed, member, photoName ? 'photo' : 'text', photoName)
    const start = performance.now()
    await saveQuickNote(note)
    let savedNote = note
    if (navigator.onLine) {
      try {
        await api.post('/notes', {
          member_id: member === '全家' ? null : MEMBERS.indexOf(member),
          content: note.content,
          source: note.source,
        })
        savedNote = { ...note, status: 'synced' }
        await updateQuickNoteStatus(note.id, 'synced')
      } catch {
        savedNote = { ...note, status: 'queued' }
      }
    }
    setNotes((current) => [savedNote, ...current])
    setText('')
    setPhotoName(undefined)
    if (photoInputRef.current) photoInputRef.current.value = ''
    const elapsed = Math.round(performance.now() - start)
    setToast(`已记下，正在理解中。本地响应 ${elapsed}ms`)
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="animate-[fadeUp_0.5s_ease_both]">
        <p className="font-[var(--font-num)] italic text-[var(--color-muted)] text-sm">下午好</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)] leading-tight">
          想到什么，<span className="text-[var(--color-accent)]">随手记一笔</span>
        </h1>
      </div>

      <div
        className="relative noise bg-gradient-to-br from-[#FFF8E8] to-[#FDEFD3]
                   rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-card)] border border-[var(--color-border)]"
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="记录家人的习惯、身体状况、饮食偏好..."
          rows={5}
          className="w-full bg-transparent resize-none outline-none font-[var(--font-body)] text-base
                     text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
        />

        {photoName ? (
          <div className="mb-3 rounded-lg bg-white/70 border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
            照片附件：{photoName}
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-3 border-t border-dashed border-[var(--color-border)]">
          <button
            type="button"
            onClick={startVoiceInput}
            aria-label="语音输入"
            className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
              isListening
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-white/70 text-[var(--color-muted)] border-[var(--color-border)]'
            }`}
            title={speechAvailable ? '语音输入' : '当前浏览器暂不支持语音输入'}
          >
            <span aria-hidden="true">🎙</span>
          </button>

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="拍照记录"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-[var(--color-muted)]
                       border border-[var(--color-border)] transition-colors hover:text-[var(--color-accent)]"
            title="拍照记录"
          >
            <span aria-hidden="true">📷</span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoChange}
          />

          <div className="ml-auto flex gap-1.5 overflow-x-auto">
            {MEMBERS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setMember(name)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full transition-colors font-[var(--font-body)]
                  ${
                    member === name
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/70 text-[var(--color-muted)] border border-[var(--color-border)]'
                  }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={submitNote}
        disabled={!text.trim()}
        className="w-full py-3 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white
                   font-[var(--font-body)] text-base disabled:opacity-40 transition-opacity
                   active:scale-[0.98]"
      >
        记下来
      </button>

      {toast ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {toast}
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-[var(--font-num)] italic text-[var(--color-muted)] text-sm">最近记下的</p>
          <p className="text-xs text-[var(--color-muted)]">
            {navigator.onLine ? '在线，等待后台同步' : '离线，已暂存本地'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {notes.slice(0, 8).map((item, index) => (
            <article
              key={item.id}
              className="flex items-start gap-3 bg-[var(--color-surface-warm)] rounded-[var(--radius-sm)]
                         px-3 py-2.5 border border-[var(--color-border)] shadow-[var(--shadow-card)]
                         animate-[fadeUp_0.4s_ease_both]"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className="text-xs px-2.5 py-0.5 rounded-full text-white font-[var(--font-body)] whitespace-nowrap bg-[var(--color-sage)]">
                {item.member}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-fg)] line-clamp-2">{item.content}</p>
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                  {item.source === 'photo' ? '照片速记' : '文字速记'} · {formatTime(item.createdAt)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                {item.status === 'synced' ? '已入库' : '待同步'}
              </span>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
