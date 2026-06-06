import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../shared/api'
import { MEMBER_ID_KEY, MEMBER_NAME_KEY, MEMBER_TOKEN_KEY } from '../../shared/constants'
import { detectMobileCapabilities } from '../capabilities'
import { clearMemberSession } from '../session'

interface MemberSession {
  member_id: number
  member_name: string
  access_token: string
  token_type: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

interface BarcodeDetectorWindow extends Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
}

function extractPairingToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed, window.location.origin)
    return url.searchParams.get('token')?.trim() ?? trimmed
  } catch {
    return trimmed
  }
}

export default function PairDevice() {
  const location = useLocation()
  return <PairDeviceForm key={location.search} />
}

function PairDeviceForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [isPairing, setIsPairing] = useState(false)
  const [token, setToken] = useState(() => params.get('token') ?? '')
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const [capabilities] = useState(() => detectMobileCapabilities())

  useEffect(() => () => stopScanner(), [])

  function stopScanner() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsScanning(false)
  }

  async function startScanner() {
    const BarcodeDetector = (window as BarcodeDetectorWindow).BarcodeDetector
    if (!BarcodeDetector) {
      setMessage('当前浏览器不支持扫码，可输入 token 完成配对')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('当前浏览器无法打开相机，可输入 token 完成配对')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setIsScanning(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const detector = new BarcodeDetector({ formats: ['qr_code'] })

      const scanFrame = async () => {
        const video = videoRef.current
        if (!video || !streamRef.current) return
        try {
          const [code] = await detector.detect(video)
          if (code?.rawValue) {
            const nextToken = extractPairingToken(code.rawValue)
            setToken(nextToken)
            setMessage('已识别二维码')
            stopScanner()
            return
          }
        } catch {
          setMessage('扫码失败，可输入 token 完成配对')
          stopScanner()
          return
        }
        frameRef.current = window.requestAnimationFrame(scanFrame)
      }
      frameRef.current = window.requestAnimationFrame(scanFrame)
    } catch {
      setMessage('无法打开相机，可输入 token 完成配对')
      stopScanner()
    }
  }

  async function pairDevice() {
    const pairingToken = extractPairingToken(token)
    if (!pairingToken) {
      setMessage('配对链接缺少 token')
      return
    }
    setIsPairing(true)
    try {
      const session = await api.post<MemberSession>('/pairing/exchange', {
        pairing_token: pairingToken,
        device_name: navigator.userAgent.slice(0, 80),
      })
      clearMemberSession()
      localStorage.setItem(MEMBER_TOKEN_KEY, session.access_token)
      localStorage.setItem(MEMBER_ID_KEY, String(session.member_id))
      localStorage.setItem(MEMBER_NAME_KEY, session.member_name)
      setMessage(`已绑定 ${session.member_name}`)
      window.setTimeout(() => navigate('/'), 700)
    } catch {
      setMessage('配对失败，token 可能已使用或过期')
    } finally {
      setIsPairing(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 p-5">
      <div className="animate-[fadeUp_0.4s_ease_both]">
        <p className="font-[var(--font-num)] text-sm italic text-[var(--color-muted)]">设备配对</p>
        <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-fg)] leading-tight">
          把这台手机，<span className="text-[var(--color-accent)]">带回家</span>
        </h1>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <CapabilityBadge label="相机" ready={capabilities.camera} />
          <CapabilityBadge label="扫码" ready={capabilities.barcode} />
          <CapabilityBadge label="离线壳" ready={capabilities.serviceWorker || capabilities.standalone} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--color-muted)]">
          配对 token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="input text-xs"
            placeholder="扫描二维码或粘贴 token"
          />
        </label>
        <div
          className={`mt-4 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-warm)] ${
            isScanning ? 'block' : 'hidden'
          }`}
        >
          <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--color-fg)]">
          点击确认后，系统会把一次性 token 兑换为本机长期登录凭证。此 token 只能使用一次，并会在生成后 5 分钟过期。
        </p>
        <button
          type="button"
          onClick={isScanning ? stopScanner : startScanner}
          className="mt-5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] py-3 text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-warm)]"
        >
          {isScanning ? '停止扫码' : '扫码配对'}
        </button>
        <button
          type="button"
          onClick={pairDevice}
          disabled={isPairing || !extractPairingToken(token)}
          className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] py-3 text-sm text-white disabled:opacity-50"
        >
          {isPairing ? '配对中' : '确认配对'}
        </button>
      </section>

      {message ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent)]/20 bg-white px-4 py-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-card)]">
          {message}
        </div>
      ) : null}

      <Link to="/" className="text-center text-sm text-[var(--color-muted)]">
        返回速记页
      </Link>
    </div>
  )
}

function CapabilityBadge({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-[11px] ${
        ready
          ? 'border-[var(--color-sage)]/30 bg-[var(--color-sage)]/10 text-[var(--color-sage)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-warm)] text-[var(--color-muted)]'
      }`}
    >
      {label} · {ready ? '可用' : '手动'}
    </div>
  )
}
