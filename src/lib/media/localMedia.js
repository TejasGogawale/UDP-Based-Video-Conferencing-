// Camera / microphone acquisition with explicit, user-readable failure reasons.

import { createSyntheticVideoTrack } from '../../components/meet/utils/mediaFallback'

const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }

export const mediaSupported = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

export function describeMediaError(err, device) {
  const name = err?.name || ''
  if (!mediaSupported()) {
    return `This browser cannot access the ${device}. Open the meeting over HTTPS in a current browser.`
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Permission to use the ${device} was denied. Allow it in the browser's site settings, then try again.`
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return `No ${device} was found on this device.`
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return `The ${device} is in use by another app or tab. Close it there and try again.`
  }
  return `Could not start the ${device}${err?.message ? `: ${err.message}` : '.'}`
}

async function getTrack(kind, deviceId) {
  const base = kind === 'audio' ? AUDIO_CONSTRAINTS : VIDEO_CONSTRAINTS
  const attempts = deviceId
    ? [{ ...base, deviceId: { exact: deviceId } }, base, true]
    : [kind === 'video' ? { ...base, facingMode: 'user' } : base, true]
  let lastError = null
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ [kind]: constraints })
      return stream.getTracks()[0]
    } catch (err) {
      lastError = err
      // Retrying cannot help once the user has said no.
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') break
    }
  }
  throw lastError
}

/** A real microphone track, or throws an Error with a readable `.message`. */
export async function acquireMicrophone(deviceId) {
  if (!mediaSupported()) throw new Error(describeMediaError(null, 'microphone'))
  try {
    return await getTrack('audio', deviceId)
  } catch (err) {
    throw new Error(describeMediaError(err, 'microphone'))
  }
}

/**
 * A camera track, or throws an Error with a readable `.message`.
 * In development builds only, an unavailable camera falls back to a clearly
 * labelled test pattern so several tabs on one machine can be tested.
 */
export async function acquireCamera(deviceId, displayName) {
  try {
    if (!mediaSupported()) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' })
    return await getTrack('video', deviceId)
  } catch (err) {
    if (import.meta.env.DEV && err?.name !== 'NotAllowedError') {
      const synthetic = createSyntheticVideoTrack(displayName)
      if (synthetic) return synthetic
    }
    throw new Error(describeMediaError(err, 'camera'))
  }
}

/**
 * First acquisition: asks for camera and microphone in ONE request so the user
 * sees a single permission prompt, then falls back to each device alone.
 * Never throws; returns { mic, cam, micError, camError }.
 */
export async function acquireInitial({ wantMic = true, wantCam = true, displayName } = {}) {
  const out = { mic: null, cam: null, micError: null, camError: null }
  if (!wantMic && !wantCam) return out
  if (mediaSupported() && wantMic && wantCam) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: { ...VIDEO_CONSTRAINTS, facingMode: 'user' }
      })
      out.mic = stream.getAudioTracks()[0] || null
      out.cam = stream.getVideoTracks()[0] || null
      if (out.mic && out.cam) return out
    } catch {
      // Fall through and find out which device is the problem.
    }
  }
  if (wantMic && !out.mic) {
    try {
      out.mic = await acquireMicrophone()
    } catch (err) {
      out.micError = err.message
    }
  }
  if (wantCam && !out.cam) {
    try {
      out.cam = await acquireCamera(undefined, displayName)
    } catch (err) {
      out.camError = err.message
    }
  }
  return out
}

export async function listDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return { microphones: [], cameras: [], speakers: [] }
  const devices = await navigator.mediaDevices.enumerateDevices()
  const pick = (kind) => devices.filter((d) => d.kind === kind && d.deviceId)
  return {
    microphones: pick('audioinput'),
    cameras: pick('videoinput'),
    speakers: pick('audiooutput')
  }
}

export const canSelectSpeaker = () =>
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

export const canShareScreen = () => Boolean(navigator.mediaDevices?.getDisplayMedia)

export async function acquireScreen() {
  // Capped at 1080p/15fps: enough for slides and code, and within what phone
  // hardware decoders accept on the receiving side.
  // Disable voice filters on shared tab/system audio so music and video sound
  // are not suppressed by browser microphone DSP.
  return navigator.mediaDevices.getDisplayMedia({
    video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 15, max: 30 } },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: false
    },
    systemAudio: 'include',
    selfBrowserSurface: 'include'
  })
}
