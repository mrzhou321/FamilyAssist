export interface MobileCapabilities {
  speech: boolean
  camera: boolean
  barcode: boolean
  indexedDb: boolean
  serviceWorker: boolean
  standalone: boolean
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
  BarcodeDetector?: unknown
}

export function detectMobileCapabilities(): MobileCapabilities {
  const capabilityWindow = window as SpeechRecognitionWindow
  return {
    speech: Boolean(capabilityWindow.SpeechRecognition ?? capabilityWindow.webkitSpeechRecognition),
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    barcode: Boolean(capabilityWindow.BarcodeDetector),
    indexedDb: 'indexedDB' in window,
    serviceWorker: 'serviceWorker' in navigator,
    standalone: isRunningStandalone(),
  }
}

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

