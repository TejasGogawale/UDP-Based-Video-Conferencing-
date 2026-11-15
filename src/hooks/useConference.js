// Single owner of a meeting session: signaling socket, peer mesh, local
// devices, and the server-authoritative roster. Components read state from
// here and call the returned actions; none of them keep their own copy of
// participants or streams.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS, SOCKET_URL } from '../config/api'
import { DEFAULT_ICE_SERVERS, PeerMesh } from '../lib/rtc/PeerMesh'
import {
  acquireCamera, acquireInitial, acquireMicrophone, acquireScreen, canShareScreen, listDevices
} from '../lib/media/localMedia'
import { AudioLevelMonitor } from '../lib/media/audioLevels'
import { BackgroundProcessor, effectsSupport } from '../lib/media/backgroundProcessor'
import { LivenessVerifier } from '../lib/media/livenessVerifier'
import { LiveCaptionService, captionsSupported } from '../components/meet/utils/speechRecognition'
import { MeetingRecorder, recordingSupported } from '../lib/media/recorder'
import { sounds } from '../components/meet/utils/soundEffects'

const DEFAULT_ICE = DEFAULT_ICE_SERVERS
const CAPTION_TTL_MS = 7000
const MAX_CAPTION_LINES = 4
const MAX_CHAT = 300

const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const liveTrack = (t) => (t && t.readyState === 'live' ? t : null)
const stopTrack = (t) => {
  try {
    t?.stop()
  } catch {
    // already stopped
  }
}

export function useConference({ meetingRef, user }) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null

  // ---------------- render state ----------------
  const [stage, setStage] = useState('loading') // loading | lobby | joining | in_call | ended | not_found
  const [endInfo, setEndInfo] = useState(null) // { reason, canRejoin }
  const [meeting, setMeeting] = useState(null)
  const [selfId, setSelfId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [lobbyPresence, setLobbyPresence] = useState({ count: 0, participants: [], known: false })
  const [roster, setRoster] = useState([])
  const [remoteMedia, setRemoteMedia] = useState({}) // peerId -> { streamId: { stream, hasVideo, videoFlowing } }
  const [peerStates, setPeerStates] = useState({})
  const [peerStats, setPeerStats] = useState({})
  const [socketStatus, setSocketStatus] = useState('connecting') // connecting | connected | reconnecting
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [joinedAt, setJoinedAt] = useState(null)

  const [localStream, setLocalStream] = useState(null)
  const [localScreenStream, setLocalScreenStream] = useState(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [mediaErrors, setMediaErrors] = useState({ mic: null, cam: null })
  const [mediaReady, setMediaReady] = useState(false)
  const [devices, setDevices] = useState({ microphones: [], cameras: [], speakers: [] })
  const [selectedDevices, setSelectedDevices] = useState({ mic: '', cam: '', speaker: '' })

  const [effect, setEffect] = useState({ background: 'none', imageUrl: null, filter: 'none' })
  const [effectStatus, setEffectStatus] = useState({ loading: false, error: null })

  const [handRaised, setHandRaised] = useState(false)
  const [levels, setLevels] = useState({})
  const [activeSpeakerId, setActiveSpeakerId] = useState(null)

  const [chatMessages, setChatMessages] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [reactions, setReactions] = useState([])
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [captionsDemand, setCaptionsDemand] = useState(false)
  const [captionLines, setCaptionLines] = useState([])
  const [captionError, setCaptionError] = useState(null)

  const [polls, setPolls] = useState([])
  const [qas, setQAs] = useState([])
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([])
  const [hostLocks, setHostLocks] = useState({
    chat_disabled: false, screenshare_disabled: false, mic_disabled: false, video_disabled: false
  })
  const [recording, setRecording] = useState(null) // { userId, userName } | null
  const [notices, setNotices] = useState([])
  const [audioBlocked, setAudioBlocked] = useState(false)

  // ---------------- imperative refs ----------------
  const socketRef = useRef(null)
  const meshRef = useRef(null)
  const iceServersRef = useRef(DEFAULT_ICE)
  const clientIdRef = useRef(newId()) // one per page load; reconnects of this page reuse it
  const outStreamsRef = useRef(null)
  if (!outStreamsRef.current && typeof MediaStream !== 'undefined') {
    outStreamsRef.current = { camera: new MediaStream(), screen: new MediaStream() }
  }
  const stageRef = useRef(stage)
  const selfIdRef = useRef(null)
  const meetingIdRef = useRef(null)
  const pendingSignalsRef = useRef([])
  const micRef = useRef(null)
  const rawCamRef = useRef(null)
  const sentCamRef = useRef(null)
  const screenRef = useRef(null)
  const processorRef = useRef(null)
  const camOpRef = useRef(Promise.resolve())
  const audioEnabledRef = useRef(true)
  const videoEnabledRef = useRef(true)
  const effectRef = useRef(effect)
  const selectedRef = useRef(selectedDevices)
  const hostLocksRef = useRef(hostLocks)
  const isHostRef = useRef(false)
  const chatOpenRef = useRef(false)
  const levelMonitorRef = useRef(null)
  const livenessVerifierRef = useRef(null)
  const captionServiceRef = useRef(null)
  const recorderRef = useRef(null)
  const relayPeersRef = useRef(new Set())
  const relayTxRef = useRef({ timer: null, videoEl: null, canvas: null, ctx: null, track: null })
  const relayRxRef = useRef(new Map()) // peerId -> { canvas, ctx, stream }
  const remoteMediaRef = useRef({})
  const rosterRef = useRef([])
  // Incremented on every mount/unmount; async media work started under an older
  // generation releases what it acquired instead of using it (StrictMode-safe).
  const genRef = useRef(0)
  const pendingInitRef = useRef(null)

  stageRef.current = stage
  effectRef.current = effect
  selectedRef.current = selectedDevices
  hostLocksRef.current = hostLocks
  isHostRef.current = isHost
  remoteMediaRef.current = remoteMedia
  rosterRef.current = roster

  // ---------------- helpers ----------------
  const notify = useCallback((message, tone = 'info') => {
    if (import.meta.env.DEV) console.info('[notice]', tone, message)
    const id = newId()
    setNotices((prev) => [...prev.slice(-3), { id, message, tone }])
    setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 5000)
  }, [])

  const dismissNotice = useCallback((id) => setNotices((prev) => prev.filter((n) => n.id !== id)), [])

  const emit = useCallback((event, payload = {}) => {
    const socket = socketRef.current
    if (socket?.connected) socket.emit(event, payload)
  }, [])

  /** Publish the current local tracks to the preview, the meters and every peer. */
  const publishLocal = useCallback(() => {
    const mic = liveTrack(micRef.current)
    const cam = videoEnabledRef.current ? liveTrack(sentCamRef.current) : null
    const tracks = [mic, cam].filter(Boolean)
    setLocalStream(tracks.length ? new MediaStream(tracks) : null)
    meshRef.current?.setLocalTracks({ mic, cam })
    if (levelMonitorRef.current) {
      if (mic) levelMonitorRef.current.watch('self', new MediaStream([mic]))
      else levelMonitorRef.current.unwatch('self')
    }
    livenessVerifierRef.current?.setTracks({
      videoTrack: videoEnabledRef.current ? liveTrack(rawCamRef.current) : null,
      audioTrack: audioEnabledRef.current ? mic : null
    })
  }, [])

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await listDevices())
    } catch {
      // enumerateDevices unavailable
    }
  }, [])

  // ---------------- camera pipeline (serialised) ----------------
  const runCamOp = useCallback((op) => {
    camOpRef.current = camOpRef.current.then(op).catch((err) => console.warn('[media] camera op failed', err))
    return camOpRef.current
  }, [])

  /** Route the raw camera through the background processor when an effect is on. */
  const applyCameraPipeline = useCallback(async () => {
    const raw = liveTrack(rawCamRef.current)
    const { background, imageUrl, filter } = effectRef.current
    const wantsProcessing = raw && (background !== 'none' || filter !== 'none')
    if (!raw) {
      processorRef.current?.stop()
      sentCamRef.current = null
      return
    }
    if (!wantsProcessing || !effectsSupport().backgrounds) {
      processorRef.current?.stop()
      sentCamRef.current = raw
      return
    }
    if (!processorRef.current) processorRef.current = new BackgroundProcessor()
    const processor = processorRef.current
    setEffectStatus({ loading: background !== 'none', error: null })
    try {
      await processor.configure({ effect: background, filter, imageUrl })
      processor.onError = (err) => {
        console.warn('[effects] frame processing failed', err)
        notify('Background effect stopped working on this device and was turned off.', 'error')
        setEffect((prev) => ({ ...prev, background: 'none' }))
      }
      sentCamRef.current = await processor.start(raw)
      setEffectStatus({ loading: false, error: null })
    } catch (err) {
      console.warn('[effects] could not enable effect', err)
      processor.stop()
      sentCamRef.current = raw
      effectRef.current = { ...effectRef.current, background: 'none' }
      setEffect((prev) => ({ ...prev, background: 'none' }))
      setEffectStatus({
        loading: false,
        error: err?.message?.includes('image')
          ? err.message
          : 'Background effects could not load on this device or network. Your camera is shown without an effect.'
      })
    }
  }, [notify])

  const camEndedRef = useRef(null)
  /** The camera track ended without us stopping it (unplugged, taken by the OS,
   *  or a capture-session race). Try the camera once more before giving up. */
  const handleCamEnded = useCallback(() => runCamOp(async () => {
    if (import.meta.env.DEV) console.info('[media] camera track ended')
    if (!videoEnabledRef.current || liveTrack(rawCamRef.current)) return
    try {
      const cam = await acquireCamera(selectedRef.current.cam || undefined, user?.name)
      cam.onended = () => camEndedRef.current?.()
      rawCamRef.current = cam
      await applyCameraPipeline()
      publishLocal()
      return
    } catch {
      // fall through: camera really is gone
    }
    notify('Your camera was disconnected.', 'error')
    videoEnabledRef.current = false
    setVideoEnabled(false)
    sentCamRef.current = null
    rawCamRef.current = null
    processorRef.current?.stop()
    publishLocal()
    emit('media_state', { videoEnabled: false })
    refreshDevices()
  }), [applyCameraPipeline, emit, notify, publishLocal, refreshDevices, runCamOp, user?.name])
  camEndedRef.current = handleCamEnded

  const handleMicEnded = useCallback(async () => {
    notify('Your microphone was disconnected. Trying the default microphone…', 'error')
    try {
      const mic = await acquireMicrophone()
      mic.enabled = audioEnabledRef.current
      mic.onended = handleMicEnded
      micRef.current = mic
      setSelectedDevices((prev) => ({ ...prev, mic: mic.getSettings?.().deviceId || '' }))
      setMediaErrors((prev) => ({ ...prev, mic: null }))
    } catch (err) {
      micRef.current = null
      audioEnabledRef.current = false
      setAudioEnabled(false)
      setMediaErrors((prev) => ({ ...prev, mic: err.message }))
      emit('media_state', { audioEnabled: false })
    }
    publishLocal()
    refreshDevices()
  }, [emit, notify, publishLocal, refreshDevices])

  const startCamera = useCallback(() => runCamOp(async () => {
    if (!liveTrack(rawCamRef.current)) {
      const gen = genRef.current
      const cam = await acquireCamera(selectedRef.current.cam || undefined, user?.name)
      if (gen !== genRef.current) {
        stopTrack(cam)
        return
      }
      cam.onended = handleCamEnded
      rawCamRef.current = cam
      setSelectedDevices((prev) => ({ ...prev, cam: cam.getSettings?.().deviceId || prev.cam }))
    }
    await applyCameraPipeline()
    setMediaErrors((prev) => ({ ...prev, cam: null }))
    publishLocal()
  }), [applyCameraPipeline, handleCamEnded, publishLocal, runCamOp, user?.name])

  const stopCamera = useCallback(() => runCamOp(async () => {
    processorRef.current?.stop()
    stopTrack(rawCamRef.current) // turns the camera light off
    rawCamRef.current = null
    sentCamRef.current = null
    publishLocal()
  }), [publishLocal, runCamOp])

  const releaseAllMedia = useCallback(() => {
    processorRef.current?.stop()
    stopTrack(rawCamRef.current)
    stopTrack(micRef.current)
    screenRef.current?.getTracks().forEach(stopTrack)
    rawCamRef.current = null
    sentCamRef.current = null
    micRef.current = null
    screenRef.current = null
    setLocalStream(null)
    setLocalScreenStream(null)
    levelMonitorRef.current?.unwatch('self')
  }, [])

  /** Acquire mic + camera for the lobby preview (single permission prompt). */
  const initMedia = useCallback(async () => {
    setMediaReady(false)
    const gen = genRef.current
    const wantCam = videoEnabledRef.current
    // Overlapping initialisations (React StrictMode's discarded mount, a quick
    // rejoin) share ONE device request. Two concurrent requests for the same
    // camera share a capture session in Chrome, so stopping the "extra" one
    // ended the camera for the one actually in use.
    if (!pendingInitRef.current) {
      pendingInitRef.current = acquireInitial({ wantMic: true, wantCam, displayName: user?.name })
        .finally(() => { pendingInitRef.current = null })
    }
    const result = await pendingInitRef.current
    if (import.meta.env.DEV) {
      console.info('[media] initial', JSON.stringify({ gen, current: genRef.current, wantCam, mic: Boolean(result.mic), cam: Boolean(result.cam), micError: result.micError, camError: result.camError }))
    }
    if (gen !== genRef.current) {
      // A newer initialisation awaiting the same request adopts these tracks.
      // Release them only if nobody did (the component really unmounted).
      setTimeout(() => {
        if (!result.adopted) {
          stopTrack(result.mic)
          stopTrack(result.cam)
        }
      }, 0)
      return
    }
    result.adopted = true
    if (result.mic) {
      result.mic.enabled = audioEnabledRef.current
      result.mic.onended = handleMicEnded
      micRef.current = result.mic
    } else {
      audioEnabledRef.current = false
      setAudioEnabled(false)
    }
    if (result.cam) {
      result.cam.onended = handleCamEnded
      rawCamRef.current = result.cam
      await runCamOp(applyCameraPipeline)
    } else if (wantCam) {
      videoEnabledRef.current = false
      setVideoEnabled(false)
    }
    setMediaErrors({ mic: result.micError, cam: result.camError })
    setSelectedDevices((prev) => ({
      ...prev,
      mic: result.mic?.getSettings?.().deviceId || prev.mic,
      cam: result.cam?.getSettings?.().deviceId || prev.cam
    }))
    publishLocal()
    setMediaReady(true)
    refreshDevices() // labels are only visible after permission is granted
  }, [applyCameraPipeline, handleCamEnded, handleMicEnded, publishLocal, refreshDevices, runCamOp, user?.name])

  // ---------------- mesh lifecycle ----------------
  const stopRelayTx = useCallback(() => {
    const tx = relayTxRef.current
    if (tx.timer) {
      clearInterval(tx.timer)
      tx.timer = null
    }
    if (tx.videoEl) {
      try {
        tx.videoEl.pause()
        tx.videoEl.srcObject = null
      } catch {
        // ignore
      }
      tx.videoEl = null
      tx.track = null
    }
  }, [])

  const syncRelayTx = useCallback(() => {
    const tx = relayTxRef.current
    if (relayPeersRef.current.size === 0 || stageRef.current !== 'in_call') {
      stopRelayTx()
      return
    }
    if (tx.timer) return
    tx.timer = setInterval(() => {
      if (relayPeersRef.current.size === 0 || !videoEnabledRef.current) return
      const camTrack = liveTrack(sentCamRef.current)
      if (!camTrack || typeof document === 'undefined') return
      try {
        if (tx.track !== camTrack || !tx.videoEl) {
          tx.track = camTrack
          const v = document.createElement('video')
          v.muted = true
          v.playsInline = true
          v.srcObject = new MediaStream([camTrack])
          v.play().catch(() => {})
          tx.videoEl = v
        }
        if (!tx.canvas) {
          tx.canvas = document.createElement('canvas')
          tx.canvas.width = 320
          tx.canvas.height = 180
          tx.ctx = tx.canvas.getContext('2d')
        }
        if (tx.videoEl.readyState >= 2 && tx.ctx) {
          tx.ctx.drawImage(tx.videoEl, 0, 0, 320, 180)
          const frame = tx.canvas.toDataURL('image/jpeg', 0.5)
          emit('media_relay', { streamKind: 'camera', frame, ts: Date.now() })
        }
      } catch {
        // Ignore canvas capture errors in headless environments
      }
    }, 260)
  }, [emit, stopRelayTx])

  const teardownMesh = useCallback(() => {
    meshRef.current?.close()
    meshRef.current = null
    pendingSignalsRef.current = []
    relayPeersRef.current.clear()
    stopRelayTx()
    for (const rx of relayRxRef.current.values()) {
      rx.stream?.getTracks?.().forEach(stopTrack)
    }
    relayRxRef.current.clear()
    setRemoteMedia({})
    setPeerStates({})
    setPeerStats({})
  }, [stopRelayTx])

  const buildMesh = useCallback((myId) => {
    teardownMesh()
    const mesh = new PeerMesh({
      selfId: myId,
      iceServers: iceServersRef.current,
      outStreams: outStreamsRef.current,
      sendSignal: (to, data) => emit('signal', { to, data }),
      onRemoteStreams: (peerId, streams) => {
        setRemoteMedia((prev) => {
          const next = { ...prev }
          if (streams && Object.keys(streams).length) next[peerId] = streams
          else delete next[peerId]
          return next
        })
      },
      onPeerState: (peerId, state) => {
        setPeerStates((prev) => {
          const next = { ...prev }
          if (!state) {
            delete next[peerId]
          } else if (state === 'failed' && relayRxRef.current.has(peerId)) {
            // Keep tile in 'connected' state while HTTPS WebSocket relay is active
            next[peerId] = 'connected'
          } else {
            next[peerId] = state
          }
          return next
        })
      },
      onRelayNeeded: (peerId, needed) => {
        if (needed) relayPeersRef.current.add(peerId)
        else relayPeersRef.current.delete(peerId)
        syncRelayTx()
      },
      onPeerStats: (peerId, stats) => {
        setPeerStats((prev) => ({ ...prev, [peerId]: stats }))
        emit('telemetry_report', {
          plf: (stats.lossPct || 0) / 100,
          jitterMs: stats.jitterMs || 0,
          rttMs: stats.rtt ?? 30,
          uplinkKbps: stats.uplinkKbps || 2500,
          cpuUtilPct: 20
        })
      }
    })
    meshRef.current = mesh
    if (import.meta.env.DEV) window.__vitMesh = mesh // debugging aid, dev builds only
    const mic = liveTrack(micRef.current)
    const cam = videoEnabledRef.current ? liveTrack(sentCamRef.current) : null
    const screenTracks = screenRef.current
    mesh.setLocalTracks({
      mic,
      cam,
      screen: liveTrack(screenTracks?.getVideoTracks()[0]) || null,
      screenAudio: liveTrack(screenTracks?.getAudioTracks()[0]) || null
    })
    const queued = pendingSignalsRef.current
    pendingSignalsRef.current = []
    queued.forEach(({ from, data }) => mesh.handleSignal(from, data))
    return mesh
  }, [emit, teardownMesh])

  // ---------------- screen share ----------------
  const stopScreenShare = useCallback((silent = false) => {
    const stream = screenRef.current
    if (!stream) return
    stream.getTracks().forEach(stopTrack)
    screenRef.current = null
    setLocalScreenStream(null)
    meshRef.current?.setLocalTracks({ screen: null, screenAudio: null })
    emit('screen_share_status', { isSharing: false })
    if (!silent) notify('You stopped presenting.')
  }, [emit, notify])

  const startScreenShare = useCallback(async () => {
    if (!canShareScreen()) {
      notify('This browser cannot share its screen. Mobile browsers do not support screen sharing; use a desktop browser to present.', 'error')
      return
    }
    if (hostLocksRef.current.screenshare_disabled && !isHostRef.current) {
      notify('The host has turned off screen sharing for participants.', 'error')
      return
    }
    const gen = genRef.current
    let stream
    try {
      stream = await acquireScreen()
    } catch (err) {
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        notify(`Screen sharing failed: ${err?.message || err}`, 'error')
      }
      return
    }
    if (gen !== genRef.current || stageRef.current !== 'in_call') {
      stream.getTracks().forEach(stopTrack)
      return
    }
    const video = stream.getVideoTracks()[0]
    video.onended = () => stopScreenShare() // browser's own "Stop sharing" button
    screenRef.current = stream
    setLocalScreenStream(stream)
    meshRef.current?.setLocalTracks({ screen: video, screenAudio: stream.getAudioTracks()[0] || null })
    emit('screen_share_status', { isSharing: true, streamId: outStreamsRef.current.screen.id })
  }, [emit, notify, stopScreenShare])

  const toggleScreenShare = useCallback(() => {
    if (screenRef.current) stopScreenShare()
    else startScreenShare()
  }, [startScreenShare, stopScreenShare])

  // ---------------- captions ----------------
  const pushCaption = useCallback((speakerId, userName, text, isFinal) => {
    const now = Date.now()
    setCaptionLines((prev) => {
      const lines = prev.filter((l) => now - l.updatedAt < CAPTION_TTL_MS)
      // An open (non-final) line for this speaker is REPLACED, never appended to.
      const openIdx = lines.findIndex((l) => l.speakerId === speakerId && !l.isFinal)
      const line = { id: openIdx >= 0 ? lines[openIdx].id : newId(), speakerId, userName, text, isFinal, updatedAt: now }
      if (openIdx >= 0) lines[openIdx] = line
      else lines.push(line)
      return lines.slice(-MAX_CAPTION_LINES)
    })
  }, [])

  // Expire old caption lines.
  useEffect(() => {
    if (!captionLines.length) return undefined
    const timer = setInterval(() => {
      const now = Date.now()
      setCaptionLines((prev) => {
        const next = prev.filter((l) => now - l.updatedAt < CAPTION_TTL_MS)
        return next.length === prev.length ? prev : next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [captionLines.length])

  // Transcribe our own microphone whenever anyone in the room wants captions.
  const shouldTranscribe = stage === 'in_call' && captionsDemand && audioEnabled && Boolean(micRef.current)
  useEffect(() => {
    if (!shouldTranscribe) {
      captionServiceRef.current?.stop()
      return undefined
    }
    if (!captionsSupported()) {
      if (captionsEnabled) setCaptionError('Your browser cannot transcribe speech (Firefox has no speech recognition). Others can still see captions from supported browsers.')
      return undefined
    }
    if (!captionServiceRef.current) {
      captionServiceRef.current = new LiveCaptionService(
        ({ text, isFinal }) => {
          pushCaption(selfIdRef.current || 'self', 'You', text, isFinal)
          emit('live_caption', { text, isFinal })
        },
        (message) => setCaptionError(message)
      )
    }
    captionServiceRef.current.start()
    return () => captionServiceRef.current?.stop()
  }, [shouldTranscribe, captionsEnabled, emit, pushCaption])

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      const next = !prev
      emit('captions_toggle', { enabled: next })
      if (!next) setCaptionError(null)
      return next
    })
  }, [emit])

  // ---------------- socket ----------------
  const handleSignal = useCallback(({ from, data }) => {
    if (meshRef.current) meshRef.current.handleSignal(from, data)
    else pendingSignalsRef.current.push({ from, data })
  }, [])

  const endCall = useCallback((reason, { canRejoin = true, notifyServer = true } = {}) => {
    if (notifyServer) emit('leave_meeting')
    if (recorderRef.current?.active) recorderRef.current.stop()
    livenessVerifierRef.current?.stop()
    captionServiceRef.current?.stop()
    stopScreenShare(true)
    teardownMesh()
    releaseAllMedia()
    setRoster([])
    setSelfId(null)
    selfIdRef.current = null
    setHandRaised(false)
    setCaptionLines([])
    setReactions([])
    setStage('ended')
    setEndInfo({ reason, canRejoin })
  }, [emit, releaseAllMedia, stopScreenShare, teardownMesh])

  const joinPayload = useCallback(() => ({
    meetingId: meetingIdRef.current || meetingRef,
    clientId: clientIdRef.current,
    audioEnabled: audioEnabledRef.current && Boolean(liveTrack(micRef.current)),
    videoEnabled: videoEnabledRef.current && Boolean(liveTrack(sentCamRef.current)),
    cameraStreamId: outStreamsRef.current.camera.id
  }), [meetingRef])

  useEffect(() => {
    if (!token) return undefined

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketStatus('connected')
      if (stageRef.current === 'in_call' || stageRef.current === 'joining') {
        // New socket id after a reconnect: rebuild media connections from scratch.
        teardownMesh()
        socket.emit('join_meeting', joinPayload())
      } else {
        socket.emit('watch_meeting', { meetingId: meetingIdRef.current || meetingRef })
      }
    })
    socket.on('disconnect', (reason) => {
      setSocketStatus('reconnecting')
      if (reason === 'io server disconnect' && stageRef.current === 'in_call') socket.connect()
    })
    socket.on('connect_error', () => setSocketStatus('reconnecting'))

    socket.on('presence_update', ({ count, participants }) => {
      setLobbyPresence({ count, participants, known: true })
    })
    socket.on('meeting_error', ({ code, message }) => {
      if (code === 'not_found') setStage('not_found')
      else notify(message, 'error')
    })

    socket.on('joined', (payload) => {
      selfIdRef.current = payload.selfId
      meetingIdRef.current = payload.meeting.id
      setSelfId(payload.selfId)
      setMeeting(payload.meeting)
      setIsHost(payload.isHost)
      setRoster(payload.participants)
      setChatMessages(payload.chatHistory || [])
      const state = payload.state || {}
      setPolls(state.polls || [])
      setQAs(state.qas || [])
      setWhiteboardStrokes(state.whiteboard || [])
      if (state.host_locks) setHostLocks(state.host_locks)
      setRecording(state.recording || null)
      setCaptionsDemand(Boolean(state.captionsDemand))
      const mesh = buildMesh(payload.selfId)
      mesh.syncPeers(payload.participants.map((p) => p.userId).filter((id) => id !== payload.selfId))
      if (payload.livenessSeed) {
        if (!livenessVerifierRef.current) {
          livenessVerifierRef.current = new LivenessVerifier({
            onProof: (proof) => socketRef.current?.emit('liveness_proof', proof)
          })
        }
        livenessVerifierRef.current.setTracks({
          videoTrack: videoEnabledRef.current ? liveTrack(rawCamRef.current) : null,
          audioTrack: audioEnabledRef.current ? liveTrack(micRef.current) : null
        })
        livenessVerifierRef.current.setSeed(payload.livenessSeed)
        livenessVerifierRef.current.start()
      }
      if (stageRef.current !== 'in_call') {
        setStage('in_call')
        setJoinedAt(Date.now())
        sounds.playJoinChime()
      }
      // Re-assert state that the server may have lost on reconnect.
      if (screenRef.current) {
        socket.emit('screen_share_status', { isSharing: true, streamId: outStreamsRef.current.screen.id })
      }
      if (captionsEnabledRef.current) socket.emit('captions_toggle', { enabled: true })
      if (handRaisedRef.current) socket.emit('toggle_hand', { handRaised: true })
    })

    socket.on('roster_update', ({ participants }) => {
      const myId = selfIdRef.current
      if (!myId) return
      const prevIds = new Set(rosterRef.current.map((p) => p.userId))
      const nextIds = new Set(participants.map((p) => p.userId))
      if (participants.some((p) => !prevIds.has(p.userId) && p.userId !== myId)) sounds.playJoinChime()
      if (rosterRef.current.some((p) => !nextIds.has(p.userId) && p.userId !== myId)) sounds.playLeaveChime()
      const raisedBefore = new Set(rosterRef.current.filter((p) => p.handRaised).map((p) => p.userId))
      if (participants.some((p) => p.handRaised && !raisedBefore.has(p.userId) && p.userId !== myId)) {
        sounds.playHandRaise()
      }
      setRoster(participants)
      meshRef.current?.syncPeers(participants.map((p) => p.userId).filter((id) => id !== myId))
    })

    socket.on('signal', handleSignal)
    socket.on('media_relay', ({ from, frame }) => {
      if (!from || !frame || from === selfIdRef.current || typeof Image === 'undefined') return
      // Also make sure we reciprocate relay frames back to a peer that is relaying to us
      if (!relayPeersRef.current.has(from)) {
        relayPeersRef.current.add(from)
        syncRelayTx()
      }
      let rx = relayRxRef.current.get(from)
      if (!rx && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d')
        const stream = canvas.captureStream ? canvas.captureStream(12) : null
        rx = { canvas, ctx, stream }
        relayRxRef.current.set(from, rx)
      }
      if (!rx?.ctx || !rx?.stream) return
      const img = new Image()
      img.onload = () => {
        rx.ctx.drawImage(img, 0, 0, 320, 180)
        setRemoteMedia((prev) => {
          const existing = prev[from] || {}
          const hasNativeVideo = Object.entries(existing).some(
            ([k, v]) => k !== 'relay-camera' && v?.videoFlowing
          )
          if (hasNativeVideo) return prev
          return {
            ...prev,
            [from]: {
              ...existing,
              'relay-camera': { stream: rx.stream, hasVideo: true, videoFlowing: true }
            }
          }
        })
        setPeerStates((prev) => (prev[from] === 'connected' ? prev : { ...prev, [from]: 'connected' }))
      }
      img.src = frame
    })
    socket.on('liveness_update', ({ userId, liveness }) => {
      if (!userId || !liveness) return
      setRoster((prev) => prev.map((p) => (p.userId === userId ? { ...p, liveness } : p)))
    })
    socket.on('swarm_topology_update', ({ userId, telemetry, swarm }) => {
      if (!userId) return
      setRoster((prev) =>
        prev.map((p) => ({
          ...p,
          telemetry: p.userId === userId && telemetry ? telemetry : p.telemetry,
          isSuperPeer: swarm ? p.userId === swarm.superPeerId : p.isSuperPeer,
          isBackupSuperPeer: swarm ? p.userId === swarm.backupSuperPeerId : p.isBackupSuperPeer,
          topologyMode: swarm?.mode || p.topologyMode
        }))
      )
    })

    socket.on('chat_message', (msg) => {
      setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg].slice(-MAX_CHAT)))
      if (msg.userId !== selfIdRef.current) {
        sounds.playChatPing()
        if (!chatOpenRef.current) setUnreadMessages((n) => n + 1)
      }
    })
    socket.on('user_reaction', (rx) => {
      sounds.playReactionPop()
      setReactions((prev) => [...prev.slice(-12), rx])
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== rx.id)), 3500)
    })
    socket.on('captions_demand', ({ active }) => setCaptionsDemand(Boolean(active)))
    socket.on('caption_received', ({ userId, userName, text, isFinal }) => {
      if (captionsEnabledRef.current) pushCaption(userId, userName, text, isFinal)
    })
    socket.on('poll_updated', ({ polls: next }) => setPolls(next))
    socket.on('qa_updated', ({ qas: next }) => setQAs(next))
    socket.on('whiteboard_stroke', ({ stroke }) => setWhiteboardStrokes((prev) => [...prev, stroke]))
    socket.on('whiteboard_cleared', () => setWhiteboardStrokes([]))
    socket.on('host_locks_updated', ({ host_locks: locks }) => {
      setHostLocks(locks)
      if (isHostRef.current) return
      if (locks.mic_disabled && audioEnabledRef.current) {
        audioEnabledRef.current = false
        setAudioEnabled(false)
        if (micRef.current) micRef.current.enabled = false
        socket.emit('media_state', { audioEnabled: false })
        notify('The host has turned off microphones for participants.')
      }
      if (locks.video_disabled && videoEnabledRef.current) {
        videoEnabledRef.current = false
        setVideoEnabled(false)
        stopCameraRef.current?.()
        socket.emit('media_state', { videoEnabled: false })
        notify('The host has turned off cameras for participants.')
      }
      if (locks.screenshare_disabled && screenRef.current) {
        stopScreenShareRef.current?.(true)
        notify('The host has turned off screen sharing for participants.')
      }
    })
    socket.on('recording_state_changed', ({ recording: rec }) => {
      setRecording(rec)
      if (rec && rec.userId !== selfIdRef.current) notify(`${rec.userName} started recording this meeting.`)
    })
    socket.on('host_command', ({ action, by, reason }) => {
      if (action === 'mute') {
        audioEnabledRef.current = false
        setAudioEnabled(false)
        if (micRef.current) micRef.current.enabled = false
        socket.emit('media_state', { audioEnabled: false })
        notify(`${by || 'The host'} muted your microphone.`)
      } else if (action === 'removed') {
        endCallRef.current?.(`${by || 'The host'} removed you from the meeting.`, { canRejoin: false, notifyServer: false })
      } else if (action === 'stop_presenting') {
        stopScreenShareRef.current?.(true)
        if (reason) notify(reason)
      } else if (action === 'denied' && reason) {
        notify(reason, 'error')
      }
    })
    socket.on('meeting_ended', ({ by }) => {
      endCallRef.current?.(`${by || 'The host'} ended the meeting for everyone.`, { canRejoin: false, notifyServer: false })
    })
    socket.on('session_replaced', () => {
      endCallRef.current?.('You joined this meeting from another window.', { canRejoin: true, notifyServer: false })
    })

    // Tell the server immediately when the page goes away (refresh, tab close),
    // instead of waiting for the heartbeat to time out.
    const onPageHide = () => {
      if (stageRef.current === 'in_call') socket.emit('leave_meeting')
      socket.disconnect()
    }
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      if (stageRef.current === 'in_call') socket.emit('leave_meeting')
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, meetingRef])

  // Stable refs to latest callbacks used inside long-lived socket handlers.
  const endCallRef = useRef(endCall)
  const stopScreenShareRef = useRef(stopScreenShare)
  const stopCameraRef = useRef(stopCamera)
  const captionsEnabledRef = useRef(captionsEnabled)
  const handRaisedRef = useRef(handRaised)
  endCallRef.current = endCall
  stopScreenShareRef.current = stopScreenShare
  stopCameraRef.current = stopCamera
  captionsEnabledRef.current = captionsEnabled
  handRaisedRef.current = handRaised

  // ---------------- mount: meeting info, ICE servers, media ----------------
  useEffect(() => {
    genRef.current += 1
    let cancelled = false
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    levelMonitorRef.current = new AudioLevelMonitor(({ levels: next, activeSpeakerId: speaker }) => {
      setLevels(next)
      setActiveSpeakerId(speaker)
    })

    axios.get(API_ENDPOINTS.meetings.getById(meetingRef), { headers })
      .then((res) => {
        if (cancelled) return
        setMeeting(res.data.meeting)
        meetingIdRef.current = res.data.meeting.id
        setIsHost(Boolean(user && res.data.meeting.creator_id === user.id))
        setStage((s) => (s === 'loading' ? 'lobby' : s))
      })
      .catch((err) => {
        if (cancelled) return
        if (err.response?.status === 404) setStage('not_found')
        else {
          setStage((s) => (s === 'loading' ? 'lobby' : s))
          notify('Could not load meeting details. Check your connection.', 'error')
        }
      })

    axios.get(`${API_BASE_URL}/api/ice-servers`, { headers })
      .then((res) => {
        if (!cancelled && res.data?.iceServers?.length) iceServersRef.current = res.data.iceServers
      })
      .catch(() => {})

    initMedia()

    const onDeviceChange = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      cancelled = true
      genRef.current += 1
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (recorderRef.current?.active) recorderRef.current.stop()
      livenessVerifierRef.current?.close()
      livenessVerifierRef.current = null
      captionServiceRef.current?.stop()
      captionServiceRef.current = null
      meshRef.current?.close()
      meshRef.current = null
      releaseAllMedia()
      levelMonitorRef.current?.close()
      levelMonitorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingRef, token])

  // Feed remote camera audio into the level monitor (active speaker).
  useEffect(() => {
    const monitor = levelMonitorRef.current
    if (!monitor) return
    const ids = ['self']
    for (const p of roster) {
      if (p.userId === selfId) continue
      const media = remoteMedia[p.userId]
      if (!media) continue
      const cam = (p.cameraStreamId && media[p.cameraStreamId]) ||
        Object.entries(media).find(([id]) => id !== p.screenStreamId)?.[1]
      if (cam?.stream) {
        monitor.watch(p.userId, cam.stream)
        ids.push(p.userId)
      }
    }
    monitor.retain(ids)
  }, [remoteMedia, roster, selfId])

  // ---------------- actions ----------------
  const joinMeeting = useCallback(() => {
    if (stageRef.current !== 'lobby') return
    levelMonitorRef.current?.resume()
    sounds.init?.()
    setStage('joining')
    stageRef.current = 'joining'
    const socket = socketRef.current
    if (socket?.connected) socket.emit('join_meeting', joinPayload())
    // Otherwise the 'connect' handler joins as soon as the socket is up.
  }, [joinPayload])

  const leaveMeeting = useCallback(() => {
    sounds.playLeaveChime()
    endCall('You left the meeting.', { canRejoin: true })
  }, [endCall])

  const rejoin = useCallback(() => {
    setEndInfo(null)
    setChatMessages([])
    setUnreadMessages(0)
    setStage('lobby')
    stageRef.current = 'lobby'
    emit('watch_meeting', { meetingId: meetingIdRef.current || meetingRef })
    initMedia()
  }, [emit, initMedia, meetingRef])

  const toggleAudio = useCallback(async () => {
    const next = !audioEnabledRef.current
    if (next && hostLocksRef.current.mic_disabled && !isHostRef.current && stageRef.current === 'in_call') {
      notify('The host has turned off microphones for participants.', 'error')
      return
    }
    if (next && !liveTrack(micRef.current)) {
      try {
        const mic = await acquireMicrophone(selectedRef.current.mic || undefined)
        mic.onended = handleMicEnded
        micRef.current = mic
        setMediaErrors((prev) => ({ ...prev, mic: null }))
        refreshDevices()
      } catch (err) {
        setMediaErrors((prev) => ({ ...prev, mic: err.message }))
        notify(err.message, 'error')
        return
      }
    }
    audioEnabledRef.current = next
    setAudioEnabled(next)
    if (micRef.current) micRef.current.enabled = next
    publishLocal()
    emit('media_state', { audioEnabled: next })
  }, [emit, handleMicEnded, notify, publishLocal, refreshDevices])

  const toggleVideo = useCallback(async () => {
    const next = !videoEnabledRef.current
    if (next && hostLocksRef.current.video_disabled && !isHostRef.current && stageRef.current === 'in_call') {
      notify('The host has turned off cameras for participants.', 'error')
      return
    }
    videoEnabledRef.current = next
    setVideoEnabled(next)
    if (next) {
      try {
        await startCamera()
        if (!liveTrack(rawCamRef.current)) throw new Error('Camera did not start.')
      } catch (err) {
        videoEnabledRef.current = false
        setVideoEnabled(false)
        setMediaErrors((prev) => ({ ...prev, cam: err.message }))
        notify(err.message, 'error')
        emit('media_state', { videoEnabled: false })
        return
      }
    } else {
      await stopCamera()
    }
    emit('media_state', { videoEnabled: next })
  }, [emit, notify, startCamera, stopCamera])

  const selectMicrophone = useCallback(async (deviceId) => {
    try {
      const mic = await acquireMicrophone(deviceId)
      mic.enabled = audioEnabledRef.current
      mic.onended = handleMicEnded
      const old = micRef.current
      micRef.current = mic
      if (old) {
        old.onended = null
        stopTrack(old)
      }
      setSelectedDevices((prev) => ({ ...prev, mic: deviceId }))
      setMediaErrors((prev) => ({ ...prev, mic: null }))
      publishLocal()
    } catch (err) {
      notify(err.message, 'error')
    }
  }, [handleMicEnded, notify, publishLocal])

  const selectCamera = useCallback((deviceId) => runCamOp(async () => {
    setSelectedDevices((prev) => ({ ...prev, cam: deviceId }))
    selectedRef.current = { ...selectedRef.current, cam: deviceId }
    if (!videoEnabledRef.current) return
    try {
      const cam = await acquireCamera(deviceId, user?.name)
      cam.onended = handleCamEnded
      const old = rawCamRef.current
      rawCamRef.current = cam
      if (old) {
        old.onended = null
        stopTrack(old)
      }
      await applyCameraPipeline()
      publishLocal()
    } catch (err) {
      notify(err.message, 'error')
    }
  }), [applyCameraPipeline, handleCamEnded, notify, publishLocal, runCamOp, user?.name])

  const selectSpeaker = useCallback((deviceId) => {
    setSelectedDevices((prev) => ({ ...prev, speaker: deviceId }))
  }, [])

  const setVisualEffect = useCallback((patch) => {
    const next = { ...effectRef.current, ...patch }
    effectRef.current = next
    setEffect(next)
    setEffectStatus((prev) => ({ ...prev, error: null }))
    return runCamOp(async () => {
      await applyCameraPipeline()
      publishLocal()
    })
  }, [applyCameraPipeline, publishLocal, runCamOp])

  const toggleHand = useCallback(() => {
    setHandRaised((prev) => {
      const next = !prev
      if (next) sounds.playHandRaise()
      emit('toggle_hand', { handRaised: next })
      return next
    })
  }, [emit])

  const sendChat = useCallback((text) => {
    if (text?.trim()) emit('send_chat', { message: text.trim() })
  }, [emit])

  const sendReaction = useCallback((emoji) => emit('send_reaction', { emoji }), [emit])

  const setChatOpen = useCallback((open) => {
    chatOpenRef.current = open
    if (open) setUnreadMessages(0)
  }, [])

  const hostAction = useCallback((action, extra = {}) => emit('host_action', { action, ...extra }), [emit])

  const toggleRecording = useCallback(async () => {
    if (recorderRef.current?.active) {
      recorderRef.current.stop()
      return
    }
    if (!recordingSupported()) {
      notify('Recording needs a desktop browser that can capture a tab (Chrome or Edge).', 'error')
      return
    }
    const recorder = new MeetingRecorder()
    recorderRef.current = recorder
    const audioStreams = [micRef.current ? new MediaStream([micRef.current]) : null]
    for (const media of Object.values(remoteMediaRef.current)) {
      for (const { stream } of Object.values(media)) audioStreams.push(stream)
    }
    try {
      await recorder.start(audioStreams, () => {
        emit('recording_status', { isRecording: false })
        notify('Recording saved to your downloads.')
      })
      emit('recording_status', { isRecording: true })
    } catch (err) {
      if (err?.name !== 'NotAllowedError') notify(`Recording could not start: ${err?.message || err}`, 'error')
    }
  }, [emit, notify])

  const activities = useMemo(() => ({
    createPoll: (poll) => emit('create_poll', poll),
    votePoll: (pollId, optionIndex) => emit('vote_poll', { pollId, optionIndex }),
    endPoll: (pollId) => emit('end_poll', { pollId }),
    submitQA: ({ question }) => emit('submit_qa', { question }),
    upvoteQA: (qaId) => emit('upvote_qa', { qaId }),
    answerQA: (qaId, isAnswered) => emit('answer_qa', { qaId, isAnswered }),
    drawStroke: (stroke) => {
      setWhiteboardStrokes((prev) => [...prev, stroke])
      emit('whiteboard_draw', { stroke })
    },
    clearWhiteboard: () => emit('whiteboard_clear')
  }), [emit])

  const resumeAudio = useCallback(() => {
    levelMonitorRef.current?.resume()
    window.dispatchEvent(new Event('vit:resume-audio'))
    setAudioBlocked(false)
  }, [])

  // ---------------- derived ----------------
  const self = roster.find((p) => p.userId === selfId) || null
  const others = roster.filter((p) => p.userId !== selfId)
  const presenter = roster.find((p) => p.isPresenting) || null

  const connectionQuality = useMemo(() => {
    if (!online) return 'offline'
    if (socketStatus !== 'connected') return 'reconnecting'
    const values = Object.values(peerStats).map((s) => s.quality)
    if (values.includes('poor')) return 'poor'
    if (values.includes('fair')) return 'fair'
    return 'good'
  }, [online, peerStats, socketStatus])

  return {
    // state
    stage, endInfo, meeting, selfId, self, isHost, lobbyPresence, roster, others, presenter,
    remoteMedia, peerStates, peerStats, socketStatus, online, connectionQuality, joinedAt,
    localStream, localScreenStream, isScreenSharing: Boolean(localScreenStream),
    audioEnabled, videoEnabled, mediaErrors, mediaReady, devices, selectedDevices,
    effect, effectStatus, effectsSupported: effectsSupport(),
    handRaised, levels, activeSpeakerId: activeSpeakerId === 'self' ? selfId : activeSpeakerId,
    chatMessages, unreadMessages, reactions,
    captionsEnabled, captionsDemand, captionLines, captionError, captionsSupported: captionsSupported(),
    polls, qas, whiteboardStrokes, hostLocks, recording, isRecordingLocally: Boolean(recorderRef.current?.active),
    notices, audioBlocked, canShareScreen: canShareScreen(),
    // actions
    joinMeeting, leaveMeeting, rejoin, toggleAudio, toggleVideo, toggleScreenShare, stopScreenShare,
    selectMicrophone, selectCamera, selectSpeaker, refreshDevices, setVisualEffect,
    toggleHand, toggleCaptions, sendChat, sendReaction, setChatOpen, hostAction, toggleRecording,
    activities, notify, dismissNotice, resumeAudio, setAudioBlocked
  }
}
