// Live captions via the browser's Web Speech API.
//
// Each participant transcribes their OWN microphone and relays the text, so
// captions are always attributed to the right speaker. Support varies:
//   Chrome / Edge (desktop): supported (audio is sent to the browser vendor's speech service)
//   Safari (macOS / iOS 14.5+): partial
//   Firefox: not supported
//   Chrome on Android: may pause while the microphone is held by the call

const ERROR_MESSAGES = {
  'not-allowed': 'Captions need microphone permission for speech recognition.',
  'service-not-allowed': 'Speech recognition is blocked on this device or browser.',
  'audio-capture': 'No microphone is available for captions.',
  network: 'The speech recognition service is unreachable. Check your connection.',
  'language-not-supported': 'Speech recognition does not support this language.'
}
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])

export const captionsSupported = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

export class LiveCaptionService {
  /**
   * onCaption({ text, isFinal }) - interim results REPLACE the previous interim
   * text for the current utterance; a final result closes it.
   * onError(message) - readable reason captions stopped or cannot start.
   */
  constructor(onCaption, onError) {
    this.onCaption = onCaption
    this.onError = onError || (() => {})
    this.recognition = null
    this.wanted = false
    this.running = false
    this.restartTimer = null
    this.restartDelay = 300
    this.init()
  }

  init() {
    if (!captionsSupported()) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onstart = () => {
      this.running = true
      this.restartDelay = 300
    }

    recognition.onresult = (event) => {
      // Report only what changed in this event. Results before resultIndex were
      // already delivered; re-sending them is what caused duplicated captions.
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript?.trim()
        if (!transcript) continue
        if (result.isFinal) {
          this.onCaption({ text: transcript, isFinal: true })
        } else {
          interim += (interim ? ' ' : '') + transcript
        }
      }
      if (interim) this.onCaption({ text: interim, isFinal: false })
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (FATAL_ERRORS.has(event.error)) {
        this.wanted = false
        this.onError(ERROR_MESSAGES[event.error])
      } else if (event.error === 'network') {
        this.restartDelay = Math.min(this.restartDelay * 2, 8000)
        this.onError(ERROR_MESSAGES.network)
      }
    }

    recognition.onend = () => {
      this.running = false
      // The engine stops by itself after silence; keep it alive while wanted.
      if (this.wanted) {
        clearTimeout(this.restartTimer)
        this.restartTimer = setTimeout(() => this.tryStart(), this.restartDelay)
      }
    }

    this.recognition = recognition
  }

  tryStart() {
    if (!this.recognition || !this.wanted || this.running) return
    try {
      this.recognition.start()
    } catch {
      // start() throws if a session is still closing; onend will retry.
    }
  }

  start() {
    if (!this.recognition) {
      this.onError('Live captions are not supported by this browser. Use Chrome, Edge or Safari.')
      return false
    }
    this.wanted = true
    this.tryStart()
    return true
  }

  stop() {
    this.wanted = false
    clearTimeout(this.restartTimer)
    if (this.recognition && this.running) {
      try {
        this.recognition.stop()
      } catch {
        // not running
      }
    }
  }

  isSupported() {
    return Boolean(this.recognition)
  }
}
