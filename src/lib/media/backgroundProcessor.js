// Real virtual backgrounds: person segmentation (MediaPipe Image Segmenter)
// composited on a canvas. The canvas' capture track is what gets SENT to other
// participants, so everyone sees the effect - not just the local preview.
//
// Pipeline per frame:
//   camera <video> -> segmenter -> person mask
//   output = background (blurred camera | image) + camera pixels where mask says "person"

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

const MAX_WIDTH = 640
const TARGET_FPS = 24

export const COLOR_FILTERS = {
  none: '',
  warm: 'brightness(105%) contrast(105%) sepia(20%)',
  cool: 'brightness(110%) hue-rotate(15deg)',
  noir: 'grayscale(100%) contrast(120%)',
  vivid: 'saturate(130%) contrast(110%)'
}

export const BLUR_LEVELS = { 'blur-sm': 6, 'blur-lg': 14 }

/** Canvas capture is required for any effect; canvas filters only for colour grading. */
export function effectsSupport() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  const capture = Boolean(canvas?.captureStream)
  const ctx = canvas?.getContext('2d')
  return {
    backgrounds: capture && typeof WebAssembly !== 'undefined',
    colorFilters: capture && Boolean(ctx) && 'filter' in ctx
  }
}

let segmenterPromise = null
function loadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      const create = (delegate) =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true
        })
      try {
        return await create('GPU')
      } catch {
        return await create('CPU')
      }
    })().catch((err) => {
      segmenterPromise = null // allow a retry later
      throw err
    })
  }
  return segmenterPromise
}

/** Timer that keeps firing in background tabs (page timers are throttled to 1 Hz there). */
function createTicker(fps, onTick) {
  const interval = Math.round(1000 / fps)
  try {
    const blob = new Blob([`setInterval(() => postMessage(0), ${interval})`], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const worker = new Worker(url)
    worker.onmessage = onTick
    return () => {
      worker.terminate()
      URL.revokeObjectURL(url)
    }
  } catch {
    const id = setInterval(onTick, interval)
    return () => clearInterval(id)
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // keeps the canvas capturable
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The background image could not be loaded.'))
    img.src = url
  })
}

function drawCover(ctx, source, sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  ctx.drawImage(source, (dw - w) / 2, (dh - h) / 2, w, h)
}

export class BackgroundProcessor {
  constructor() {
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.out = document.createElement('canvas')
    this.outCtx = this.out.getContext('2d')
    this.person = document.createElement('canvas')
    this.personCtx = this.person.getContext('2d')
    this.maskCanvas = document.createElement('canvas')
    this.maskCtx = this.maskCanvas.getContext('2d')
    this.small = document.createElement('canvas')
    this.smallCtx = this.small.getContext('2d')

    this.effect = 'none' // none | blur-sm | blur-lg | image
    this.filter = 'none'
    this.image = null
    this.segmenter = null
    this.maskImageData = null
    this.outputTrack = null
    this.stopTicker = null
    this.busy = false
    this.lastTimestamp = 0
    this.onError = null
  }

  get needsSegmentation() {
    return this.effect !== 'none'
  }

  /**
   * Configure the effect. `effect`: 'none' | 'blur-sm' | 'blur-lg' | 'image'.
   * Throws if the model or image cannot be loaded (caller falls back to the raw camera).
   */
  async configure({ effect = 'none', filter = 'none', imageUrl = null }) {
    if (effect === 'image') {
      if (!imageUrl) throw new Error('No background image selected.')
      this.image = await loadImage(imageUrl)
    } else {
      this.image = null
    }
    if (effect !== 'none' && !this.segmenter) {
      this.segmenter = await loadSegmenter()
    }
    this.effect = effect
    this.filter = filter
  }

  /** Start processing `inputTrack`; returns the processed video track to send/preview. */
  async start(inputTrack) {
    this.stopLoop()
    this.video.srcObject = new MediaStream([inputTrack])
    await this.video.play()
    if (!this.video.videoWidth) {
      await new Promise((resolve) => this.video.addEventListener('loadeddata', resolve, { once: true }))
    }

    const scale = Math.min(1, MAX_WIDTH / this.video.videoWidth)
    const width = Math.round(this.video.videoWidth * scale)
    const height = Math.round(this.video.videoHeight * scale)
    for (const canvas of [this.out, this.person, this.maskCanvas]) {
      canvas.width = width
      canvas.height = height
    }
    this.renderFrame() // have a frame ready before the track is consumed

    if (!this.outputTrack || this.outputTrack.readyState !== 'live') {
      this.outputTrack = this.out.captureStream(TARGET_FPS).getVideoTracks()[0]
    }
    this.stopTicker = createTicker(TARGET_FPS, () => this.renderFrame())
    return this.outputTrack
  }

  renderFrame() {
    const { video, out, outCtx } = this
    if (this.busy || video.readyState < 2 || !out.width) return
    this.busy = true
    try {
      const w = out.width
      const h = out.height
      const cssFilter = COLOR_FILTERS[this.filter] || ''

      if (!this.needsSegmentation || !this.segmenter) {
        outCtx.filter = cssFilter || 'none'
        outCtx.drawImage(video, 0, 0, w, h)
        outCtx.filter = 'none'
        return
      }

      // MediaPipe requires strictly increasing timestamps.
      const timestamp = Math.max(performance.now(), this.lastTimestamp + 1)
      this.lastTimestamp = timestamp
      const result = this.segmenter.segmentForVideo(video, timestamp)
      const masks = result?.confidenceMasks
      if (!masks?.length) {
        outCtx.drawImage(video, 0, 0, w, h)
        return
      }
      // Binary selfie model: one mask = person confidence. Multi-class models put
      // background first, so the person is the complement of mask 0.
      const personMask = masks[masks.length === 1 ? 0 : 1] || masks[0]
      this.writeMask(personMask.getAsFloat32Array(), personMask.width, personMask.height)
      masks.forEach((m) => m.close())

      // 1. Background layer.
      if (this.effect === 'image' && this.image) {
        drawCover(outCtx, this.image, this.image.naturalWidth, this.image.naturalHeight, w, h)
      } else {
        this.drawBlurred(video, w, h, BLUR_LEVELS[this.effect] || BLUR_LEVELS['blur-sm'])
      }

      // 2. Person layer: mask, then keep camera pixels only where the mask is opaque.
      const pctx = this.personCtx
      pctx.globalCompositeOperation = 'source-over'
      pctx.clearRect(0, 0, w, h)
      pctx.imageSmoothingEnabled = true
      pctx.drawImage(this.maskCanvas, 0, 0, w, h)
      pctx.globalCompositeOperation = 'source-in'
      pctx.filter = cssFilter || 'none'
      pctx.drawImage(video, 0, 0, w, h)
      pctx.filter = 'none'

      outCtx.drawImage(this.person, 0, 0)
    } catch (err) {
      // A failing frame must never kill the outgoing video: show the raw camera.
      try {
        outCtx.drawImage(video, 0, 0, out.width, out.height)
      } catch {
        // video not drawable this tick
      }
      if (this.onError) {
        const handler = this.onError
        this.onError = null
        handler(err)
      }
    } finally {
      this.busy = false
    }
  }

  writeMask(values, width, height) {
    if (!this.maskImageData || this.maskImageData.width !== width || this.maskImageData.height !== height) {
      this.maskCanvas.width = width
      this.maskCanvas.height = height
      this.maskImageData = this.maskCtx.createImageData(width, height)
    }
    const data = this.maskImageData.data
    for (let i = 0, p = 3; i < values.length; i++, p += 4) {
      // Steepen the edge so hair/shoulders do not leave a translucent halo.
      const v = (values[i] - 0.35) / 0.3
      data[p] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0
    }
    this.maskCtx.putImageData(this.maskImageData, 0, 0)
  }

  /** Blur by down-scaling then up-scaling (works without canvas filter support, e.g. older Safari). */
  drawBlurred(source, w, h, strength) {
    const sw = Math.max(8, Math.round(w / strength))
    const sh = Math.max(8, Math.round(h / strength))
    this.small.width = sw
    this.small.height = sh
    this.smallCtx.imageSmoothingEnabled = true
    this.smallCtx.imageSmoothingQuality = 'high'
    this.smallCtx.drawImage(source, 0, 0, sw, sh)
    this.outCtx.imageSmoothingEnabled = true
    this.outCtx.imageSmoothingQuality = 'high'
    this.outCtx.drawImage(this.small, 0, 0, sw, sh, 0, 0, w, h)
  }

  stopLoop() {
    if (this.stopTicker) {
      this.stopTicker()
      this.stopTicker = null
    }
  }

  stop() {
    this.stopLoop()
    if (this.outputTrack) {
      this.outputTrack.stop()
      this.outputTrack = null
    }
    this.video.pause()
    this.video.srcObject = null
  }
}
