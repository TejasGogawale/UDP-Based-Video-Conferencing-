// Local meeting recording: captures this browser tab (the meeting as the
// recorder sees it) plus everyone's audio, and saves a .webm file on stop.
// Nothing is uploaded. Desktop Chromium browsers only (needs tab capture).

export const recordingSupported = () =>
  typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)

export class MeetingRecorder {
  constructor() {
    this.recorder = null
    this.chunks = []
    this.displayStream = null
    this.audioCtx = null
    this.onStopped = null
  }

  /** `audioStreams`: local mic + every remote stream, mixed into the recording. */
  async start(audioStreams, onStopped) {
    this.onStopped = onStopped
    this.displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include'
    })

    const Ctx = window.AudioContext || window.webkitAudioContext
    this.audioCtx = new Ctx()
    const destination = this.audioCtx.createMediaStreamDestination()
    for (const stream of audioStreams) {
      if (stream?.getAudioTracks().length) {
        this.audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(destination)
      }
    }

    const mixed = new MediaStream([
      ...this.displayStream.getVideoTracks(),
      ...destination.stream.getAudioTracks()
    ])
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type))
    this.chunks = []
    this.recorder = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined)
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data)
    }
    this.recorder.onstop = () => this.finish()
    // The browser's own "Stop sharing" button also ends the recording.
    this.displayStream.getVideoTracks()[0].onended = () => this.stop()
    this.recorder.start(1000)
  }

  stop() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
  }

  finish() {
    this.displayStream?.getTracks().forEach((t) => t.stop())
    this.audioCtx?.close().catch(() => {})
    if (this.chunks.length) {
      const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vit-connect-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
    this.recorder = null
    this.chunks = []
    const callback = this.onStopped
    this.onStopped = null
    callback?.()
  }

  get active() {
    return Boolean(this.recorder && this.recorder.state !== 'inactive')
  }
}
