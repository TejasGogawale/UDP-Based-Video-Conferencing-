// Web Speech API integration for real-time speech-to-text Live Captions in VIT Connect

export class LiveCaptionService {
  constructor(onCaptionCallback) {
    this.recognition = null
    this.isListening = false
    this.onCaption = onCaptionCallback
    this.init()
  }

  init() {
    if (typeof window === 'undefined') return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'en-US'

      this.recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        const text = finalTranscript || interimTranscript
        if (text && this.onCaption) {
          this.onCaption({
            text: text.trim(),
            isFinal: Boolean(finalTranscript)
          })
        }
      }

      this.recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition error:', event.error)
        }
      }

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start()
          } catch (e) {
            // Already started or suspended
          }
        }
      }
    }
  }

  start() {
    if (this.recognition && !this.isListening) {
      try {
        this.isListening = true
        this.recognition.start()
      } catch (e) {
        console.warn('Error starting speech recognition:', e)
      }
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.isListening = false
      try {
        this.recognition.stop()
      } catch (e) {
        console.warn('Error stopping speech recognition:', e)
      }
    }
  }

  isSupported() {
    return Boolean(this.recognition)
  }
}
