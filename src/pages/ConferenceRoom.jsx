import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { API_ENDPOINTS, SOCKET_URL } from '../config/api'

// Meet Components
import { GreenRoomLobby } from '../components/meet/GreenRoomLobby'
import { VideoGrid } from '../components/meet/VideoGrid'
import { ControlDock } from '../components/meet/ControlDock'
import { LiveCaptions } from '../components/meet/LiveCaptions'
import { ReactionsOverlay } from '../components/meet/ReactionsOverlay'
import { MeetingEndedScreen } from '../components/meet/MeetingEndedScreen'

// Drawers
import { MeetingDetailsDrawer } from '../components/meet/drawers/MeetingDetailsDrawer'
import { PeopleDrawer } from '../components/meet/drawers/PeopleDrawer'
import { ChatDrawer } from '../components/meet/drawers/ChatDrawer'
import { ActivitiesDrawer } from '../components/meet/drawers/ActivitiesDrawer'
import { HostControlsDrawer } from '../components/meet/drawers/HostControlsDrawer'
import { VisualEffectsDrawer } from '../components/meet/drawers/VisualEffectsDrawer'

// Activities Modals
import { PollsModal } from '../components/meet/activities/PollsModal'
import { QAModal } from '../components/meet/activities/QAModal'
import { WhiteboardModal } from '../components/meet/activities/WhiteboardModal'
import { BreakoutRoomsModal } from '../components/meet/activities/BreakoutRoomsModal'
import { DeviceSettingsModal } from '../components/meet/DeviceSettingsModal'

// Utilities
import { sounds } from '../components/meet/utils/soundEffects'
import { LiveCaptionService } from '../components/meet/utils/speechRecognition'
import { createSyntheticVideoTrack } from '../components/meet/utils/mediaFallback'

const ConferenceRoom = () => {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Meeting Stages: 'lobby' | 'in_call' | 'ended'
  const [meetingStage, setMeetingStage] = useState('lobby')
  const [meetingDetails, setMeetingDetails] = useState(null)
  const [elapsedDuration, setElapsedDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Media Streams State
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({}) // userId -> MediaStream (camera/mic)
  const [localScreenStream, setLocalScreenStream] = useState(null)
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({}) // userId -> MediaStream (screen)
  const [presenterInfo, setPresenterInfo] = useState(null) // { userId, userName, isSharing, isSelf }

  // Hardware State
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [activeSpeakerId, setActiveSpeakerId] = useState(null)

  // Visual Effects
  const [visualEffect, setVisualEffect] = useState('none')
  const [visualFilter, setVisualFilter] = useState('none')

  // Meeting Roster & Chat
  const [participants, setParticipants] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [hostLocks, setHostLocks] = useState({
    chat_disabled: false,
    screenshare_disabled: false,
    mic_disabled: false,
    video_disabled: false
  })

  // Live Features & Activities
  const [reactions, setReactions] = useState([])
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [liveCaptions, setLiveCaptions] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [polls, setPolls] = useState([])
  const [qas, setQAs] = useState([])
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([])

  // Layout & UI Drawers
  const [layoutMode, setLayoutMode] = useState('auto')
  const [pinnedUserId, setPinnedUserId] = useState(null)
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [activeModal, setActiveModal] = useState(null)

  // WebRTC Dual-Mesh Refs
  const socketRef = useRef(null)
  const localStreamRef = useRef(null)
  const localScreenStreamRef = useRef(null)
  
  // Dual Peer Connections
  const mediaPCsRef = useRef({}) // userId -> RTCPeerConnection (camera/mic)
  const screenPCsRef = useRef({}) // userId -> RTCPeerConnection (screen share)
  
  // Stream Containers
  const remoteMediaStreamsRef = useRef({}) // userId -> MediaStream
  const remoteScreenStreamsRef = useRef({}) // userId -> MediaStream
  
  // Candidate Buffers
  const pendingMediaCandidatesRef = useRef({}) // userId -> Array<RTCIceCandidate>
  const pendingScreenCandidatesRef = useRef({}) // userId -> Array<RTCIceCandidate>

  const captionServiceRef = useRef(null)

  const rtcConfig = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
  }

  // Timer Clocks
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000)
    let durationInterval = null

    if (meetingStage === 'in_call') {
      durationInterval = setInterval(() => setElapsedDuration(prev => prev + 1), 1000)
    }

    return () => {
      clearInterval(clockInterval)
      if (durationInterval) clearInterval(durationInterval)
    }
  }, [meetingStage])

  // Initial Hardware Stream & Meeting Metadata
  useEffect(() => {
    initLocalMedia()
    fetchMeetingData()

    return () => {
      cleanupConference()
    }
  }, [meetingId])

  // Keyboard Shortcuts (Ctrl+D = Mic, Ctrl+E = Camera)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleToggleAudio()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleToggleVideo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [audioEnabled, videoEnabled])

  const initLocalMedia = async () => {
    try {
      let stream
      // Attempt mobile-friendly user facing constraints first
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        })
      } catch (err1) {
        // Fallback for mobile devices or browsers with simpler constraint support
        console.warn('Initial HD constraints failed, falling back to simple video/audio constraints:', err1)
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      }

      setLocalStream(stream)
      localStreamRef.current = stream
    } catch (err) {
      console.warn('Physical camera locked/unavailable (Windows/OS single-device restriction or mobile permissions). Using synthetic stream fallback:', err)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
        const combinedStream = new MediaStream()

        if (audioStream) {
          audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t))
        }

        // Attach synthetic animated video track so local multi-tab testing streams live video!
        const syntheticTrack = createSyntheticVideoTrack(user?.name || 'User')
        if (syntheticTrack) {
          combinedStream.addTrack(syntheticTrack)
        }

        setLocalStream(combinedStream)
        localStreamRef.current = combinedStream
        setVideoEnabled(true)
      } catch (e) {
        console.warn('Audio/Video fallback error:', e)
      }
    }
  }

  const fetchMeetingData = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(API_ENDPOINTS.meetings.getById(meetingId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.data?.meeting) {
        setMeetingDetails(res.data.meeting)
        if (user && res.data.meeting.creator_id === user.id) {
          setIsHost(true)
        }
      }
    } catch (e) {
      setMeetingDetails({
        meeting_code: meetingId,
        title: `Meeting ${meetingId}`
      })
    }
  }

  // -------------------------------------------------------------
  // 1. MEDIA PEER CONNECTIONS (Camera & Microphone)
  // -------------------------------------------------------------
  const getOrCreateMediaPC = async (targetUserId, isInitiator = false) => {
    if (mediaPCsRef.current[targetUserId]) {
      return mediaPCsRef.current[targetUserId]
    }

    const pc = new RTCPeerConnection(rtcConfig)
    mediaPCsRef.current[targetUserId] = pc
    pendingMediaCandidatesRef.current[targetUserId] = []

    if (!remoteMediaStreamsRef.current[targetUserId]) {
      remoteMediaStreamsRef.current[targetUserId] = new MediaStream()
    }

    // Attach local camera & microphone tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    // Incoming remote media tracks
    pc.ontrack = (event) => {
      const stream = remoteMediaStreamsRef.current[targetUserId]
      if (stream) {
        const existing = stream.getTracks().find(t => t.kind === event.track.kind)
        if (existing) {
          stream.removeTrack(existing)
        }
        stream.addTrack(event.track)
        setRemoteStreams(prev => ({
          ...prev,
          [targetUserId]: stream
        }))
      }
    }

    // ICE Candidate Generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          to: targetUserId,
          candidate: event.candidate,
          streamType: 'media'
        })
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce()
      }
    }

    // If new joiner, generate media SDP offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        if (socketRef.current) {
          socketRef.current.emit('offer', {
            to: targetUserId,
            offer: pc.localDescription,
            streamType: 'media'
          })
        }
      } catch (err) {
        console.warn('Error creating media offer:', err)
      }
    }

    return pc
  }

  const flushPendingMediaCandidates = async (targetUserId) => {
    const pc = mediaPCsRef.current[targetUserId]
    const candidates = pendingMediaCandidatesRef.current[targetUserId] || []
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      while (candidates.length > 0) {
        const cand = candidates.shift()
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch (e) {
          console.warn('Error adding media ICE candidate:', e)
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. SCREEN SHARE PEER CONNECTIONS (Dedicated Screen Stream)
  // -------------------------------------------------------------
  const createScreenPCForPeer = async (targetUserId, displayStream) => {
    if (screenPCsRef.current[targetUserId]) {
      screenPCsRef.current[targetUserId].close()
    }

    const pc = new RTCPeerConnection(rtcConfig)
    screenPCsRef.current[targetUserId] = pc
    pendingScreenCandidatesRef.current[targetUserId] = []

    // Attach screen video & screen audio tracks
    displayStream.getTracks().forEach(track => {
      pc.addTrack(track, displayStream)
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          to: targetUserId,
          candidate: event.candidate,
          streamType: 'screen'
        })
      }
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (socketRef.current) {
        socketRef.current.emit('offer', {
          to: targetUserId,
          offer: pc.localDescription,
          streamType: 'screen'
        })
      }
    } catch (err) {
      console.warn('Error creating screen offer:', err)
    }

    return pc
  }

  const handleRemoteScreenOffer = async (from, offer) => {
    if (screenPCsRef.current[from]) {
      screenPCsRef.current[from].close()
    }

    const pc = new RTCPeerConnection(rtcConfig)
    screenPCsRef.current[from] = pc
    pendingScreenCandidatesRef.current[from] = []

    if (!remoteScreenStreamsRef.current[from]) {
      remoteScreenStreamsRef.current[from] = new MediaStream()
    }

    pc.ontrack = (event) => {
      const stream = remoteScreenStreamsRef.current[from]
      if (stream) {
        const existing = stream.getTracks().find(t => t.kind === event.track.kind)
        if (existing) {
          stream.removeTrack(existing)
        }
        stream.addTrack(event.track)
        setRemoteScreenStreams(prev => ({
          ...prev,
          [from]: stream
        }))
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          to: from,
          candidate: event.candidate,
          streamType: 'screen'
        })
      }
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await flushPendingScreenCandidates(from)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (socketRef.current) {
        socketRef.current.emit('answer', {
          to: from,
          answer: pc.localDescription,
          streamType: 'screen'
        })
      }
    } catch (err) {
      console.warn('Error answering screen offer:', err)
    }
  }

  const flushPendingScreenCandidates = async (targetUserId) => {
    const pc = screenPCsRef.current[targetUserId]
    const candidates = pendingScreenCandidatesRef.current[targetUserId] || []
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      while (candidates.length > 0) {
        const cand = candidates.shift()
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch (e) {
          console.warn('Error adding screen ICE candidate:', e)
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. SOCKET.IO SIGNALING EVENT COORDINATOR
  // -------------------------------------------------------------
  const enterMeetingCall = () => {
    setMeetingStage('in_call')
    sounds.playJoinChime()

    const token = localStorage.getItem('token')
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_meeting', {
        meetingId,
        userName: user?.name || 'Participant',
        videoEnabled,
        audioEnabled
      })
    })

    socket.on('current_users', ({ users }) => {
      const activePeers = users.filter(u => u.userId !== socket.id)
      setParticipants(activePeers)

      // Initiator Rule: The new joiner creates media connections and offers to existing peers
      activePeers.forEach(remoteUser => {
        getOrCreateMediaPC(remoteUser.userId, true)
      })
    })

    socket.on('sync_meeting_state', (state) => {
      if (state.polls) setPolls(state.polls)
      if (state.qas) setQAs(state.qas)
      if (state.host_locks) setHostLocks(state.host_locks)
      if (state.recording !== undefined) setIsRecording(state.recording)
      if (state.active_presenter) {
        setPresenterInfo({
          userId: state.active_presenter.userId,
          userName: state.active_presenter.userName,
          isSharing: true,
          isSelf: state.active_presenter.userId === socket.id
        })
      }
    })

    socket.on('user_joined', (newUser) => {
      sounds.playJoinChime()
      setParticipants(prev => {
        if (prev.some(u => u.userId === newUser.userId)) return prev
        return [...prev, newUser]
      })

      // Existing occupant prepares media connection (waits for offer)
      getOrCreateMediaPC(newUser.userId, false)

      // If we are currently sharing our screen, send screen share offer to the new joiner!
      if (localScreenStreamRef.current) {
        createScreenPCForPeer(newUser.userId, localScreenStreamRef.current)
      }
    })

    // Handle Incoming Offers (Dispatched by streamType)
    socket.on('offer', async ({ from, offer, streamType }) => {
      if (streamType === 'screen') {
        await handleRemoteScreenOffer(from, offer)
      } else {
        // Media Offer
        const pc = await getOrCreateMediaPC(from, false)
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          await flushPendingMediaCandidates(from)

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('answer', {
            to: from,
            answer: pc.localDescription,
            streamType: 'media'
          })
        } catch (err) {
          console.warn('Error handling media offer:', err)
        }
      }
    })

    // Handle Incoming Answers
    socket.on('answer', async ({ from, answer, streamType }) => {
      if (streamType === 'screen') {
        const pc = screenPCsRef.current[from]
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            await flushPendingScreenCandidates(from)
          } catch (err) {
            console.warn('Error setting screen remote answer:', err)
          }
        }
      } else {
        const pc = mediaPCsRef.current[from]
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
            await flushPendingMediaCandidates(from)
          } catch (err) {
            console.warn('Error setting media remote answer:', err)
          }
        }
      }
    })

    // Handle Incoming ICE Candidates
    socket.on('ice_candidate', async ({ from, candidate, streamType }) => {
      if (streamType === 'screen') {
        const pc = screenPCsRef.current[from]
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (e) {
            console.warn('Error adding screen candidate:', e)
          }
        } else {
          if (!pendingScreenCandidatesRef.current[from]) {
            pendingScreenCandidatesRef.current[from] = []
          }
          pendingScreenCandidatesRef.current[from].push(candidate)
        }
      } else {
        const pc = mediaPCsRef.current[from]
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (e) {
            console.warn('Error adding media candidate:', e)
          }
        } else {
          if (!pendingMediaCandidatesRef.current[from]) {
            pendingMediaCandidatesRef.current[from] = []
          }
          pendingMediaCandidatesRef.current[from].push(candidate)
        }
      }
    })

    // Screen Share Remote Status Broadcast
    socket.on('peer_screen_share_changed', ({ userId, userName, isSharing }) => {
      if (isSharing) {
        setPresenterInfo({ userId, userName, isSharing: true, isSelf: false })
      } else {
        setPresenterInfo(prev => (prev?.userId === userId ? null : prev))
        if (screenPCsRef.current[userId]) {
          screenPCsRef.current[userId].close()
          delete screenPCsRef.current[userId]
        }
        if (remoteScreenStreamsRef.current[userId]) {
          delete remoteScreenStreamsRef.current[userId]
          setRemoteScreenStreams(prev => {
            const copy = { ...prev }
            delete copy[userId]
            return copy
          })
        }
      }
    })

    socket.on('chat_message', (msg) => {
      setChatMessages(prev => [...prev, msg])
      sounds.playChatPing()
      if (activeDrawer !== 'chat') {
        setUnreadMessages(prev => prev + 1)
      }
    })

    socket.on('user_reaction', (rx) => {
      sounds.playReactionPop()
      setReactions(prev => [...prev, rx])
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== rx.id))
      }, 3500)
    })

    socket.on('peer_media_changed', ({ userId, videoEnabled: v, audioEnabled: a }) => {
      setParticipants(prev => prev.map(p => {
        if (p.userId === userId) {
          return {
            ...p,
            videoEnabled: v !== undefined ? v : p.videoEnabled,
            audioEnabled: a !== undefined ? a : p.audioEnabled
          }
        }
        return p
      }))
    })

    socket.on('peer_hand_changed', ({ userId, handRaised: h }) => {
      if (h) sounds.playHandRaise()
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, handRaised: h } : p))
    })

    socket.on('caption_received', (caption) => {
      setLiveCaptions(prev => [...prev.slice(-10), caption])
    })

    socket.on('poll_updated', ({ polls: updatedPolls }) => setPolls(updatedPolls))
    socket.on('qa_updated', ({ qas: updatedQAs }) => setQAs(updatedQAs))
    socket.on('whiteboard_stroke', ({ stroke }) => setWhiteboardStrokes(prev => [...prev, stroke]))
    socket.on('whiteboard_cleared', () => setWhiteboardStrokes([]))
    socket.on('host_locks_updated', ({ host_locks }) => setHostLocks(host_locks))
    socket.on('recording_state_changed', ({ isRecording: rec }) => setIsRecording(rec))

    socket.on('user_left', ({ userId }) => {
      sounds.playLeaveChime()
      
      // Clean media connection
      if (mediaPCsRef.current[userId]) {
        mediaPCsRef.current[userId].close()
        delete mediaPCsRef.current[userId]
      }
      if (remoteMediaStreamsRef.current[userId]) {
        delete remoteMediaStreamsRef.current[userId]
        setRemoteStreams(prev => {
          const copy = { ...prev }
          delete copy[userId]
          return copy
        })
      }

      // Clean screen connection
      if (screenPCsRef.current[userId]) {
        screenPCsRef.current[userId].close()
        delete screenPCsRef.current[userId]
      }
      if (remoteScreenStreamsRef.current[userId]) {
        delete remoteScreenStreamsRef.current[userId]
        setRemoteScreenStreams(prev => {
          const copy = { ...prev }
          delete copy[userId]
          return copy
        })
      }

      if (presenterInfo?.userId === userId) {
        setPresenterInfo(null)
      }
      setParticipants(prev => prev.filter(p => p.userId !== userId))
    })
  }

  // -------------------------------------------------------------
  // 4. CONTROL HANDLERS (Audio, Video, Screen Share)
  // -------------------------------------------------------------
  const handleToggleAudio = () => {
    const newState = !audioEnabled
    setAudioEnabled(newState)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = newState))
    }
    if (socketRef.current) {
      socketRef.current.emit('toggle_media', { meetingId, audioEnabled: newState })
    }
  }

  const handleToggleVideo = () => {
    const newState = !videoEnabled
    setVideoEnabled(newState)
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => (t.enabled = newState))
    }
    if (socketRef.current) {
      socketRef.current.emit('toggle_media', { meetingId, videoEnabled: newState })
    }
  }

  // Multi-Peer Screen Sharing with Tab/System Audio
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenSharing()
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported by your mobile browser. Use a desktop browser (Chrome, Edge, Firefox, Safari) to share your screen.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always', frameRate: { ideal: 30 } },
          audio: true // Captures screen/tab audio (e.g. YouTube sound)
        })

        setLocalScreenStream(stream)
        localScreenStreamRef.current = stream
        setIsScreenSharing(true)
        setPresenterInfo({
          userId: socketRef.current?.id || 'self',
          userName: user?.name || 'You',
          isSharing: true,
          isSelf: true
        })

        // Broadcast screen share offer to all currently connected peers
        participants.forEach(peer => {
          createScreenPCForPeer(peer.userId, stream)
        })

        // Broadcast status over Socket.IO
        if (socketRef.current) {
          socketRef.current.emit('screen_share_status', {
            meetingId,
            userName: user?.name || 'You',
            isSharing: true
          })
        }

        // Native browser "Stop sharing" floating bar handler
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          videoTrack.onended = () => {
            stopScreenSharing()
          }
        }
      } catch (err) {
        console.warn('Screen share cancelled/failed:', err)
      }
    }
  }

  const stopScreenSharing = () => {
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(t => t.stop())
    }

    // Close and clean all screen peer connections
    Object.values(screenPCsRef.current).forEach(pc => pc.close())
    screenPCsRef.current = {}

    setLocalScreenStream(null)
    localScreenStreamRef.current = null
    setIsScreenSharing(false)
    setPresenterInfo(prev => (prev?.isSelf ? null : prev))

    if (socketRef.current) {
      socketRef.current.emit('screen_share_status', {
        meetingId,
        userName: user?.name || 'You',
        isSharing: false
      })
    }
  }

  const handleToggleHand = () => {
    const newState = !handRaised
    setHandRaised(newState)
    if (newState) sounds.playHandRaise()
    if (socketRef.current) {
      socketRef.current.emit('toggle_hand', {
        meetingId,
        handRaised: newState,
        userName: user?.name || 'You'
      })
    }
  }

  const handleToggleCaptions = () => {
    const newState = !captionsEnabled
    setCaptionsEnabled(newState)

    if (newState) {
      if (!captionServiceRef.current) {
        captionServiceRef.current = new LiveCaptionService(({ text, isFinal }) => {
          setLiveCaptions(prev => [...prev.slice(-10), { userName: 'You', text, isFinal }])
          if (socketRef.current) {
            socketRef.current.emit('live_caption', { meetingId, text, isFinal })
          }
        })
      }
      captionServiceRef.current.start()
    } else {
      if (captionServiceRef.current) {
        captionServiceRef.current.stop()
      }
    }
  }

  const handleSendReaction = (emoji) => {
    sounds.playReactionPop()
    if (socketRef.current) {
      socketRef.current.emit('send_reaction', {
        meetingId,
        emoji,
        userName: user?.name || 'You'
      })
    }
  }

  const handleSendMessage = (text) => {
    if (!text.trim() || !socketRef.current) return
    socketRef.current.emit('send_chat', {
      meetingId,
      message: text.trim(),
      userName: user?.name || 'You'
    })
  }

  const handleToggleDrawer = (drawerName) => {
    if (activeDrawer === drawerName) {
      setActiveDrawer(null)
    } else {
      setActiveDrawer(drawerName)
      if (drawerName === 'chat') setUnreadMessages(0)
    }
  }

  const cleanupConference = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(t => t.stop())
    }
    if (captionServiceRef.current) {
      captionServiceRef.current.stop()
    }
    
    // Close all media peer connections
    Object.values(mediaPCsRef.current).forEach(pc => pc.close())
    mediaPCsRef.current = {}
    
    // Close all screen peer connections
    Object.values(screenPCsRef.current).forEach(pc => pc.close())
    screenPCsRef.current = {}
    
    remoteMediaStreamsRef.current = {}
    remoteScreenStreamsRef.current = {}
    pendingMediaCandidatesRef.current = {}
    pendingScreenCandidatesRef.current = {}
    
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
  }

  const handleLeaveMeeting = () => {
    sounds.playLeaveChime()
    cleanupConference()
    setMeetingStage('ended')
  }

  // -------------------------------------------------------------
  // 5. RENDER STAGES
  // -------------------------------------------------------------

  // 1. Green Room Lobby
  if (meetingStage === 'lobby') {
    return (
      <GreenRoomLobby
        stream={localStream}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onJoinMeeting={enterMeetingCall}
        onJoinAsPresenter={() => {
          enterMeetingCall()
          setTimeout(() => handleToggleScreenShare(), 600)
        }}
        onOpenSettings={() => setActiveModal('settings')}
        onOpenEffects={() => handleToggleDrawer('effects')}
        meetingCode={meetingDetails?.meeting_code || meetingId}
        meetingTitle={meetingDetails?.title}
        activeParticipantsCount={participants.length}
        userName={user?.name || 'You'}
        visualEffect={visualEffect}
        visualFilter={visualFilter}
      />
    )
  }

  // 2. Meeting Ended Screen
  if (meetingStage === 'ended') {
    return (
      <MeetingEndedScreen
        onRejoin={() => {
          initLocalMedia()
          setMeetingStage('lobby')
        }}
        meetingCode={meetingDetails?.meeting_code || meetingId}
        elapsedDuration={elapsedDuration}
      />
    )
  }

  // 3. Active Conference Room
  return (
    <div
      onClick={() => {
        // Resume any pending audio contexts on user interaction
        if (typeof window !== 'undefined') {
          const AudioCtx = window.AudioContext || window.webkitAudioContext
          if (AudioCtx && sounds.ctx && sounds.ctx.state === 'suspended') {
            sounds.ctx.resume()
          }
        }
      }}
      className="h-[100dvh] min-h-[100dvh] w-full max-w-full bg-[#202124] text-white flex flex-col overflow-hidden select-none"
    >
      {/* Video Grid & Presentation Stage with Side Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        <VideoGrid
          localStream={localStream}
          remoteStreams={remoteStreams}
          localScreenStream={localScreenStream}
          remoteScreenStreams={remoteScreenStreams}
          presenterInfo={presenterInfo}
          currentUser={{
            sid: socketRef.current?.id || 'self',
            name: user?.name || 'You',
            audioEnabled,
            videoEnabled,
            handRaised
          }}
          participants={participants}
          layoutMode={layoutMode}
          pinnedUserId={pinnedUserId}
          onPinUser={setPinnedUserId}
          onMuteUser={(targetId) => {
            if (socketRef.current) {
              socketRef.current.emit('host_action', {
                meetingId,
                action: 'mute_user',
                targetUserId: targetId
              })
            }
          }}
          isHost={isHost}
          activeSpeakerId={activeSpeakerId}
          visualEffect={visualEffect}
          visualFilter={visualFilter}
          onStopScreenShare={stopScreenSharing}
        />

        {/* Slide-In Drawers (Docking on desktop, Full-Screen Overlay on mobile) */}
        {activeDrawer && (
          <div className="fixed inset-0 z-40 sm:relative sm:inset-auto sm:z-30 h-full flex justify-end">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs sm:hidden z-30"
              onClick={() => setActiveDrawer(null)}
            />
            <div className="w-full sm:w-80 md:w-96 h-full relative z-40 bg-[#202124] shadow-2xl flex flex-col">
              {activeDrawer === 'info' && (
                <MeetingDetailsDrawer
                  onClose={() => setActiveDrawer(null)}
                  meetingCode={meetingDetails?.meeting_code || meetingId}
                  meetingTitle={meetingDetails?.title}
                />
              )}

              {activeDrawer === 'people' && (
                <PeopleDrawer
                  onClose={() => setActiveDrawer(null)}
                  participants={participants}
                  currentUser={{
                    sid: socketRef.current?.id || 'self',
                    name: user?.name || 'You',
                    audioEnabled,
                    videoEnabled,
                    handRaised
                  }}
                  isHost={isHost}
                  onMuteAll={() => {
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'mute_all' })
                    }
                  }}
                  onMuteUser={(targetId) => {
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'mute_user', targetUserId: targetId })
                    }
                  }}
                  onPinUser={setPinnedUserId}
                  pinnedUserId={pinnedUserId}
                  onAddPeople={() => setActiveDrawer('info')}
                />
              )}

              {activeDrawer === 'chat' && (
                <ChatDrawer
                  onClose={() => setActiveDrawer(null)}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  currentUser={user}
                  isHost={isHost}
                  isChatLocked={hostLocks.chat_disabled}
                  onToggleChatLock={(locked) => {
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'lock_toggle', lockType: 'chat_disabled', value: locked })
                    }
                  }}
                />
              )}

              {activeDrawer === 'activities' && (
                <ActivitiesDrawer
                  onClose={() => setActiveDrawer(null)}
                  onOpenWhiteboard={() => setActiveModal('whiteboard')}
                  onOpenPolls={() => setActiveModal('polls')}
                  onOpenQA={() => setActiveModal('qa')}
                  onOpenBreakouts={() => setActiveModal('breakouts')}
                  onToggleRecording={() => {
                    const newRec = !isRecording
                    setIsRecording(newRec)
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'recording_toggle', isRecording: newRec })
                    }
                  }}
                  isRecording={isRecording}
                  onDownloadTranscript={() => {
                    const text = chatMessages.map(m => `[${m.timestamp || ''}] ${m.userName || 'User'}: ${m.message || m.content}`).join('\n')
                    const blob = new Blob([text], { type: 'text/plain' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `meeting-transcript-${meetingId}.txt`
                    a.click()
                  }}
                />
              )}

              {activeDrawer === 'host' && (
                <HostControlsDrawer
                  onClose={() => setActiveDrawer(null)}
                  hostLocks={hostLocks}
                  onToggleLock={(lockType, currentVal) => {
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'lock_toggle', lockType, value: !currentVal })
                    }
                  }}
                  onEndMeetingForAll={() => {
                    if (socketRef.current) {
                      socketRef.current.emit('host_action', { meetingId, action: 'end_meeting_for_all' })
                    }
                    handleLeaveMeeting()
                  }}
                />
              )}

              {activeDrawer === 'effects' && (
                <VisualEffectsDrawer
                  onClose={() => setActiveDrawer(null)}
                  currentEffect={visualEffect}
                  onSelectEffect={setVisualEffect}
                  currentFilter={visualFilter}
                  onSelectFilter={setVisualFilter}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Overlays */}
      <ReactionsOverlay reactions={reactions} />
      <LiveCaptions captions={liveCaptions} isVisible={captionsEnabled} />

      {/* Bottom Floating Control Dock */}
      <ControlDock
        meetingCode={meetingDetails?.meeting_code || meetingId}
        currentTime={currentTime}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        handRaised={handRaised}
        onToggleHand={handleToggleHand}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={handleToggleCaptions}
        onSendReaction={handleSendReaction}
        activeDrawer={activeDrawer}
        onToggleDrawer={handleToggleDrawer}
        participantsCount={participants.length + 1}
        unreadMessages={unreadMessages}
        isHost={isHost}
        onLeaveCall={handleLeaveMeeting}
        onOpenSettings={() => setActiveModal('settings')}
        onOpenWhiteboard={() => setActiveModal('whiteboard')}
        layoutMode={layoutMode}
        onSelectLayout={setLayoutMode}
      />

      {/* Interactive Activities Modals */}
      {activeModal === 'polls' && (
        <PollsModal
          onClose={() => setActiveModal(null)}
          polls={polls}
          onCreatePoll={(newPoll) => {
            if (socketRef.current) {
              socketRef.current.emit('create_poll', { meetingId, ...newPoll })
            }
          }}
          onVotePoll={(pollId, optionIndex) => {
            if (socketRef.current) {
              socketRef.current.emit('vote_poll', { meetingId, pollId, optionIndex })
            }
          }}
          onEndPoll={(pollId) => {
            if (socketRef.current) {
              socketRef.current.emit('end_poll', { meetingId, pollId })
            }
          }}
          currentUser={{ sid: socketRef.current?.id, name: user?.name }}
          isHost={isHost}
        />
      )}

      {activeModal === 'qa' && (
        <QAModal
          onClose={() => setActiveModal(null)}
          qas={qas}
          onSubmitQA={({ question, userName }) => {
            if (socketRef.current) {
              socketRef.current.emit('submit_qa', { meetingId, question, userName })
            }
          }}
          onUpvoteQA={(qaId) => {
            if (socketRef.current) {
              socketRef.current.emit('upvote_qa', { meetingId, qaId })
            }
          }}
          onAnswerQA={(qaId, isAnswered) => {
            if (socketRef.current) {
              socketRef.current.emit('answer_qa', { meetingId, qaId, isAnswered })
            }
          }}
          currentUser={{ sid: socketRef.current?.id, name: user?.name }}
          isHost={isHost}
        />
      )}

      {activeModal === 'whiteboard' && (
        <WhiteboardModal
          onClose={() => setActiveModal(null)}
          strokes={whiteboardStrokes}
          onDrawStroke={(stroke) => {
            if (socketRef.current) {
              socketRef.current.emit('whiteboard_draw', { meetingId, stroke })
            }
          }}
          onClearWhiteboard={() => {
            if (socketRef.current) {
              socketRef.current.emit('whiteboard_clear', { meetingId })
            }
          }}
        />
      )}

      {activeModal === 'breakouts' && (
        <BreakoutRoomsModal
          onClose={() => setActiveModal(null)}
          participants={participants}
          currentUser={{ sid: socketRef.current?.id, name: user?.name }}
          isHost={isHost}
        />
      )}

      {activeModal === 'settings' && (
        <DeviceSettingsModal
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}

export default ConferenceRoom
