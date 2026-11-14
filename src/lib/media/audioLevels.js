// Measures real audio levels of MediaStreams (Web Audio analyser) for the mic
// meters and active-speaker detection.

const POLL_MS = 150
const SPEAKING_THRESHOLD = 0.035
const HOLD_MS = 900

export class AudioLevelMonitor {
  constructor(onUpdate) {
    this.onUpdate = onUpdate || (() => {})
    this.sources = new Map() // id -> { source, analyser, buffer, trackId }
    this.ctx = null
    this.timer = null
    this.activeId = null
    this.activeSince = 0
  }

  ensureContext() {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    this.ctx = new Ctx()
    return this.ctx
  }

  /** Must be called from a user gesture at least once (browsers start contexts suspended). */
  resume() {
    const ctx = this.ensureContext()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }

  watch(id, stream) {
    const track = stream?.getAudioTracks?.()[0]
    const existing = this.sources.get(id)
    if (!track) {
      this.unwatch(id)
      return
    }
    if (existing && existing.trackId === track.id) return
    this.unwatch(id)
    const ctx = this.ensureContext()
    if (!ctx) return
    try {
      const source = ctx.createMediaStreamSource(new MediaStream([track]))
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      this.sources.set(id, { source, analyser, buffer: new Float32Array(analyser.fftSize), trackId: track.id })
      if (!this.timer) this.timer = setInterval(() => this.poll(), POLL_MS)
    } catch {
      // Stream not usable by Web Audio (ended track): ignore.
    }
  }

  unwatch(id) {
    const entry = this.sources.get(id)
    if (!entry) return
    try {
      entry.source.disconnect()
    } catch {
      // already disconnected
    }
    this.sources.delete(id)
    if (this.sources.size === 0 && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Keep only the given ids. */
  retain(ids) {
    const keep = new Set(ids)
    for (const id of [...this.sources.keys()]) {
      if (!keep.has(id)) this.unwatch(id)
    }
  }

  poll() {
    const levels = {}
    let loudestId = null
    let loudest = 0
    for (const [id, { analyser, buffer }] of this.sources) {
      analyser.getFloatTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
      const rms = Math.sqrt(sum / buffer.length)
      levels[id] = rms
      if (rms > loudest) {
        loudest = rms
        loudestId = id
      }
    }
    const now = performance.now()
    if (loudest >= SPEAKING_THRESHOLD) {
      this.activeId = loudestId
      this.activeSince = now
    } else if (this.activeId && now - this.activeSince > HOLD_MS) {
      this.activeId = null
    }
    this.onUpdate({ levels, activeSpeakerId: this.activeId })
  }

  close() {
    for (const id of [...this.sources.keys()]) this.unwatch(id)
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

/** 0..100 for a meter bar, from an RMS level. */
export const levelToPercent = (rms = 0) => Math.min(100, Math.round(Math.sqrt(rms) * 220))
