// Web Audio API procedural sound synthesizer for VIT Connect sound cues
// Operates without any external audio file dependencies

class SoundSynthesizer {
  constructor() {
    this.ctx = null
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
  }

  playJoinChime() {
    try {
      this.init()
      if (!this.ctx) return
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const now = this.ctx.currentTime
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'sine'

      // VIT Connect signature join dual chime: G5 (784Hz) -> C6 (1046.5Hz)
      osc1.frequency.setValueAtTime(783.99, now)
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15)

      osc2.frequency.setValueAtTime(523.25, now)
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15)

      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(this.ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.45)
      osc2.stop(now + 0.45)
    } catch (e) {
      console.warn('Audio synthesis error:', e)
    }
  }

  playLeaveChime() {
    try {
      this.init()
      if (!this.ctx) return
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      // VIT Connect leave tone: C6 (1046.5Hz) -> F5 (698.46Hz)
      osc.frequency.setValueAtTime(1046.50, now)
      osc.frequency.exponentialRampToValueAtTime(698.46, now + 0.25)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch (e) {
      console.warn('Audio synthesis error:', e)
    }
  }

  playHandRaise() {
    try {
      this.init()
      if (!this.ctx) return
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now) // E5
      osc.frequency.setValueAtTime(880.00, now + 0.08) // A5

      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.28)
    } catch (e) {
      console.warn('Audio synthesis error:', e)
    }
  }

  playChatPing() {
    try {
      this.init()
      if (!this.ctx) return
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(987.77, now) // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08) // E6

      gain.gain.setValueAtTime(0.10, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.2)
    } catch (e) {
      console.warn('Audio synthesis error:', e)
    }
  }

  playReactionPop() {
    try {
      this.init()
      if (!this.ctx) return
      if (this.ctx.state === 'suspended') this.ctx.resume()

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06)

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.12)
    } catch (e) {
      console.warn('Audio synthesis error:', e)
    }
  }
}

export const sounds = new SoundSynthesizer()
