import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
  Copy,
  Check,
  Info,
  Send,
  Monitor,
  Hand,
  Clock,
  AlertCircle,
  X
} from 'lucide-react'

const ConferenceRoom = () => {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  
  // States
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [participants, setParticipants] = useState([])
  const [peerMediaStates, setPeerMediaStates] = useState({})
  const [peerHandRaises, setPeerHandRaises] = useState({})
  const [handRaised, setHandRaised] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [meetingDetails, setMeetingDetails] = useState(null)
  
  // UI States
  const [showSidebar, setShowSidebar] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'participants'
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [messagesBadge, setMessagesBadge] = useState(0)

  // Refs
  const localVideoRef = useRef(null)
  const socketRef = useRef(null)
  const peerConnectionsRef = useRef({})
  const dataChannelRef = useRef({})
  
  // Stable refs for WebRTC closures
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)

  const configuration = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ]
  }

  useEffect(() => {
    initializeConference()
    
    // Timers
    const secTimer = setInterval(() => setElapsedTime(prev => prev + 1), 1000)
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000)
    
    return () => {
      clearInterval(secTimer)
      clearInterval(clockTimer)
      cleanupConference()
    }
  }, [meetingId])

  const initializeConference = async () => {
    try {
      const token = localStorage.getItem('token')
      
      // 1. Join meeting via API (handles direct links or codes, ensures registered)
      const joinResponse = await axios.post(
        `http://localhost:5000/api/meetings/${meetingId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      const meeting = joinResponse.data.meeting
      setMeetingDetails(meeting)
      
      // 2. Fetch historic chat messages
      fetchMessages(meeting.id)
      
      // 3. Request camera/mic
      await getLocalStream()
      
      // 4. Connect signaling socket
      initializeSocket(meeting.id)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to initialize conference.')
      setConnecting(false)
    }
  }

  const getLocalStream = async () => {
    try {
      // 1. Try to get both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      })
      setLocalStream(stream)
      localStreamRef.current = stream 
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (err) {
      console.warn('Failed to get video and audio, trying audio-only...', err)
      try {
        // 2. Try to get audio-only
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        })
        setLocalStream(stream)
        localStreamRef.current = stream
        setVideoEnabled(false)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      } catch (err2) {
        console.warn('Failed to get audio-only, joining with no local media...', err2)
        // 3. Join without local media
        setLocalStream(null)
        localStreamRef.current = null
        setVideoEnabled(false)
        setAudioEnabled(false)
      }
    }
  }

  const fetchMessages = async (uuid) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`http://localhost:5000/api/meetings/${uuid}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const history = response.data.messages.map(m => ({
        userName: m.author_name,
        message: m.content,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
      setChatMessages(history)
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }

  const initializeSocket = (uuid) => {
    const token = localStorage.getItem('token')
    socketRef.current = io('http://localhost:5000', {
      query: { meetingId: uuid },
      auth: { token }
    })

    socketRef.current.on('connect', () => {
      setConnecting(false)
      socketRef.current.emit('join_meeting', { meetingId: uuid })
      
      // Send initial media toggles
      socketRef.current.emit('toggle_media', {
        meetingId: uuid,
        videoEnabled,
        audioEnabled
      })
    })

    socketRef.current.on('current_users', ({ users }) => {
      setParticipants(prev => {
        const existingIds = new Set(prev.map(p => p.userId))
        const newUsers = users.filter(u => !existingIds.has(u.userId))
        return [...prev, ...newUsers]
      })
    })

    socketRef.current.on('user_joined', ({ userId, userName, dbUserId }) => {
      setParticipants(prev => {
        if (prev.some(p => p.userId === userId)) return prev
        return [...prev, { userId, userName, dbUserId }]
      })
      
      // Existing user creates offer to newly joined user
      createPeerConnection(userId, true)
      
      // Push our current states to the new user
      if (socketRef.current) {
        socketRef.current.emit('toggle_media', {
          meetingId: uuid,
          videoEnabled,
          audioEnabled
        })
        if (handRaised) {
          socketRef.current.emit('toggle_hand', {
            meetingId: uuid,
            handRaised
          })
        }
      }
    })

    socketRef.current.on('offer', async ({ from, offer }) => {
      if (!peerConnectionsRef.current[from]) {
        createPeerConnection(from, false)
      }
      await peerConnectionsRef.current[from].setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnectionsRef.current[from].createAnswer()
      await peerConnectionsRef.current[from].setLocalDescription(answer)
      socketRef.current.emit('answer', { to: from, answer })
    })

    socketRef.current.on('answer', async ({ from, answer }) => {
      if (peerConnectionsRef.current[from]) {
        await peerConnectionsRef.current[from].setRemoteDescription(new RTCSessionDescription(answer))
      }
    })

    socketRef.current.on('ice_candidate', async ({ from, candidate }) => {
      if (peerConnectionsRef.current[from]) {
        await peerConnectionsRef.current[from].addIceCandidate(new RTCIceCandidate(candidate))
      }
    })

    socketRef.current.on('chat_message', (msg) => {
      setChatMessages(prev => [...prev, msg])
      // Toggle badge count
      if (!showSidebar || activeTab !== 'chat') {
        setMessagesBadge(prev => prev + 1)
      }
    })

    socketRef.current.on('peer_media_changed', ({ userId, videoEnabled: peerVideo, audioEnabled: peerAudio }) => {
      setPeerMediaStates(prev => ({
        ...prev,
        [userId]: { videoEnabled: peerVideo, audioEnabled: peerAudio }
      }))
    })

    socketRef.current.on('peer_hand_changed', ({ userId, handRaised: peerHand }) => {
      setPeerHandRaises(prev => ({
        ...prev,
        [userId]: peerHand
      }))
    })

    socketRef.current.on('user_left', ({ userId }) => {
      cleanupPeer(userId)
    })

    socketRef.current.on('disconnect', () => {
      navigate('/dashboard')
    })
  }

  const createPeerConnection = (peerId, initiator) => {
    const peerConnection = new RTCPeerConnection(configuration)
    peerConnectionsRef.current[peerId] = peerConnection

    // Access stable refs to avoid stale closure (null stream) issues
    const activeStream = screenStreamRef.current || localStreamRef.current
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, activeStream)
      })
    }

    // Robust Track Collection: Accumulate audio and video tracks into a single stream reference 
    // to force the React ref callback on video elements to re-bind the srcObject.
    peerConnection.ontrack = (event) => {
      setRemoteStreams(prev => {
        const existingStream = prev[peerId]
        let newStream
        if (existingStream) {
          if (existingStream.getTracks().find(t => t.id === event.track.id)) {
            return prev
          }
          newStream = new MediaStream(existingStream.getTracks())
          newStream.addTrack(event.track)
        } else {
          newStream = new MediaStream([event.track])
        }
        return {
          ...prev,
          [peerId]: newStream
        }
      })
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          to: peerId,
          candidate: event.candidate
        })
      }
    }

    const dataChannel = peerConnection.createDataChannel('chat', { ordered: true })
    setupDataChannel(dataChannel, peerId)

    peerConnection.ondatachannel = (event) => {
      setupDataChannel(event.channel, peerId)
    }

    if (initiator) {
      peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
          if (socketRef.current) {
            socketRef.current.emit('offer', {
              to: peerId,
              offer: peerConnection.localDescription
            })
          }
        })
    }

    return peerConnection
  }

  const setupDataChannel = (dataChannel, peerId) => {
    dataChannelRef.current[peerId] = dataChannel
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data)
      setChatMessages(prev => [...prev, message])
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      const nextState = !videoEnabled
      setVideoEnabled(nextState)
      
      if (socketRef.current && meetingDetails) {
        socketRef.current.emit('toggle_media', {
          meetingId: meetingDetails.id,
          videoEnabled: nextState,
          audioEnabled
        })
      }
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      const nextState = !audioEnabled
      setAudioEnabled(nextState)
      
      if (socketRef.current && meetingDetails) {
        socketRef.current.emit('toggle_media', {
          meetingId: meetingDetails.id,
          videoEnabled,
          audioEnabled: nextState
        })
      }
    }
  }

  const toggleHandRaise = () => {
    const nextState = !handRaised
    setHandRaised(nextState)
    if (socketRef.current && meetingDetails) {
      socketRef.current.emit('toggle_hand', {
        meetingId: meetingDetails.id,
        handRaised: nextState
      })
    }
  }

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = stream
        const track = stream.getVideoTracks()[0]

        // Replace track on all current peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const senders = pc.getSenders()
          const videoSender = senders.find(s => s.track?.kind === 'video')
          if (videoSender) {
            videoSender.replaceTrack(track)
          }
        })

        // Show screen feed locally
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        track.onended = () => {
          stopScreenShare()
        }

        setScreenSharing(true)
      } catch (err) {
        console.error('Error sharing screen:', err)
      }
    } else {
      stopScreenShare()
    }
  }

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
    if (cameraTrack) {
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders()
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack)
        }
      })
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }

    setScreenSharing(false)
  }

  const sendChatMessage = () => {
    if (!chatInput.trim() || !meetingDetails) return

    const message = {
      meetingId: meetingDetails.id,
      userName: localStorage.getItem('userName') || 'You',
      message: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    socketRef.current.emit('send_chat', message)
    setChatInput('')
  }

  const cleanupPeer = (userId) => {
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].close()
      delete peerConnectionsRef.current[userId]
    }
    if (dataChannelRef.current[userId]) {
      dataChannelRef.current[userId].close()
      delete dataChannelRef.current[userId]
    }
    setRemoteStreams(prev => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })
    setParticipants(prev => prev.filter(p => p.userId !== userId))
    setPeerMediaStates(prev => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })
    setPeerHandRaises(prev => {
      const updated = { ...prev }
      delete updated[userId]
      return updated
    })
  }

  const cleanupConference = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    screenStreamRef.current?.getTracks().forEach(track => track.stop())
    
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close())
    peerConnectionsRef.current = {}
    
    if (socketRef.current) {
      if (meetingDetails) {
        socketRef.current.emit('leave_meeting', { meetingId: meetingDetails.id })
      }
      socketRef.current.disconnect()
    }
  }

  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  const formatCode = (code) => {
    if (!code) return ''
    const cleaned = code.replace(/[^A-Z0-9]/g, '')
    if (cleaned.length === 12) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`
    }
    return code
  }

  const handleCopyLink = () => {
    if (!meetingDetails) return
    const inviteUrl = `http://localhost:3000/conference/${formatCode(meetingDetails.meeting_code)}`
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Dynamic layout calculations
  const remotePeers = Object.entries(remoteStreams)
  const totalFeeds = 1 + remotePeers.length

  const getGridClass = () => {
    if (totalFeeds === 1) return 'grid-cols-1 max-w-3xl mx-auto h-[70vh] flex items-center justify-center'
    if (totalFeeds === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto h-[70vh] flex items-center justify-center'
    if (totalFeeds <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto'
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto'
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#202124] text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md p-8 bg-[#2d2e30] rounded-2xl text-center space-y-6 shadow-xl border border-slate-700">
          <div className="p-4 bg-red-950/20 text-red-400 border border-red-900/30 rounded-xl inline-block">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold">Connection Failed</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 bg-purple-650 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (connecting) {
    return (
      <div className="min-h-screen bg-[#202124] text-white flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm tracking-wide">Joining secure meeting space...</p>
      </div>
    )
  }

  const localInitials = getInitials(localStorage.getItem('userName') || 'You')

  return (
    <div className="h-screen bg-[#202124] text-white flex flex-col overflow-hidden font-sans select-none antialiased">
      
      {/* Top Header Bar */}
      <div className="px-6 py-4 flex justify-between items-center bg-[#202124] border-b border-[#3c4043]/50">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 bg-red-600/90 text-white text-[10px] font-bold uppercase rounded tracking-wider flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white block" />
            Live
          </div>
          <h2 className="font-semibold text-sm text-slate-200 truncate max-w-[200px] sm:max-w-xs">{meetingDetails?.title || 'Conferencing...'}</h2>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#3c4043]/40 px-3.5 py-1 rounded-lg border border-[#3c4043]">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-mono">{formatElapsedTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Workspace: Video Grid + Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          
          {/* Dynamically Styled Grid */}
          <div className={`grid gap-5 w-full ${getGridClass()}`}>
            
            {/* Local Video Stream Card */}
            <motion.div
              className={`w-full ${totalFeeds <= 2 ? 'max-w-[700px]' : ''} aspect-video bg-[#3c4043] rounded-2xl relative overflow-hidden shadow-md flex items-center justify-center`}
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${
                  videoEnabled || screenSharing ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                }`}
              />

              {/* Initials Fallback */}
              {!videoEnabled && !screenSharing && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#2d2e30]">
                  <div className="w-16 h-16 bg-[#5f6368] rounded-full flex items-center justify-center text-white text-xl font-medium border border-white/5 shadow-inner">
                    {localInitials}
                  </div>
                </div>
              )}

              {/* Name Badge */}
              <div className="absolute bottom-3 left-3 bg-[#202124]/90 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide text-slate-200 flex items-center gap-1.5 shadow-sm border border-slate-700/50">
                You {screenSharing && <span className="text-emerald-400 font-normal">(Presenting)</span>}
              </div>

              {/* Top-Right Hand Raise Badge */}
              {handRaised && (
                <div className="absolute top-3 right-3 p-2 bg-amber-500 text-slate-950 rounded-lg shadow-md border border-amber-400">
                  <Hand className="w-4 h-4 fill-slate-950" />
                </div>
              )}

              {/* Bottom-Right Mute Badge */}
              {!audioEnabled && (
                <div className="absolute bottom-3 right-3 p-2 bg-red-600/90 text-white rounded-lg shadow-md border border-red-500/20">
                  <MicOff className="w-3.5 h-3.5" />
                </div>
              )}
            </motion.div>

            {/* Remote Streams Cards */}
            {remotePeers.map(([peerId, stream]) => {
              const pInfo = participants.find(p => p.userId === peerId)
              const pName = pInfo?.userName || 'Participant'
              const pMedia = peerMediaStates[peerId] || { videoEnabled: true, audioEnabled: true }
              const pHand = peerHandRaises[peerId] || false
              const initials = getInitials(pName)
              
              return (
                <motion.div
                  key={peerId}
                  className={`w-full ${totalFeeds <= 2 ? 'max-w-[700px]' : ''} aspect-video bg-[#3c4043] rounded-2xl relative overflow-hidden shadow-md flex items-center justify-center`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <video
                    autoPlay
                    playsInline
                    ref={el => {
                      if (el) el.srcObject = stream
                    }}
                    className={`w-full h-full object-cover rounded-2xl transition-opacity duration-300 ${
                      pMedia.videoEnabled ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                    }`}
                  />
                  
                  {/* Avatar Fallback */}
                  {!pMedia.videoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#2d2e30]">
                      <div className="w-16 h-16 bg-[#5f6368] rounded-full flex items-center justify-center text-white text-xl font-medium border border-white/5 shadow-inner">
                        {initials}
                      </div>
                    </div>
                  )}

                  {/* Name Badge */}
                  <div className="absolute bottom-3 left-3 bg-[#202124]/90 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide text-slate-200 flex items-center gap-1.5 shadow-sm border border-slate-700/50">
                    {pName}
                  </div>

                  {/* Top-Right Hand Raise Badge */}
                  {pHand && (
                    <div className="absolute top-3 right-3 p-2 bg-amber-500 text-slate-950 rounded-lg shadow-md border border-amber-400">
                      <Hand className="w-4 h-4 fill-slate-950" />
                    </div>
                  )}

                  {/* Bottom-Right Mute Badge */}
                  {!pMedia.audioEnabled && (
                    <div className="absolute bottom-3 right-3 p-2 bg-red-600/90 text-white rounded-lg shadow-md border border-red-500/20">
                      <MicOff className="w-3.5 h-3.5" />
                    </div>
                  )}
                </motion.div>
              )
            })}

          </div>
        </div>

        {/* Google Meet Sidebar (Right) */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              className="w-80 bg-[#202124] border-l border-[#3c4043]/50 flex flex-col h-full z-10"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'tween', duration: 0.15 }}
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-[#3c4043]/50 flex items-center justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`font-semibold text-xs pb-1.5 border-b-2 transition-all relative uppercase tracking-wider ${
                      activeTab === 'chat' ? 'text-purple-400 border-purple-400' : 'text-slate-400 border-transparent hover:text-white'
                    }`}
                  >
                    Chat
                    {messagesBadge > 0 && activeTab !== 'chat' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-purple-500 text-white text-[9px] font-bold rounded-full">
                        {messagesBadge}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('participants')
                      setMessagesBadge(0)
                    }}
                    className={`font-semibold text-xs pb-1.5 border-b-2 transition-all uppercase tracking-wider ${
                      activeTab === 'participants' ? 'text-purple-400 border-purple-400' : 'text-slate-400 border-transparent hover:text-white'
                    }`}
                  >
                    People ({participants.length + 1})
                  </button>
                </div>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 hover:bg-[#3c4043] rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sidebar Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'chat' ? (
                  <div className="space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs">
                        No messages yet.
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="text-xs space-y-0.5">
                          <div className="flex items-baseline justify-between">
                            <span className="font-semibold text-slate-300">{msg.userName}</span>
                            <span className="text-[9px] text-slate-550">{msg.timestamp}</span>
                          </div>
                          <div className="text-slate-300 break-words leading-relaxed">{msg.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Local User */}
                    <div className="flex items-center justify-between p-2.5 bg-[#3c4043]/30 border border-[#3c4043]/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-[10px] font-medium">
                          {localInitials}
                        </div>
                        <span className="text-xs font-medium text-slate-200">You</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {handRaised && <Hand className="w-3.5 h-3.5 text-amber-400" />}
                        {audioEnabled ? <Mic className="w-3.5 h-3.5 text-slate-400" /> : <MicOff className="w-3.5 h-3.5 text-red-500" />}
                        {videoEnabled ? <VideoIcon className="w-3.5 h-3.5 text-slate-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>

                    {/* Remote Participants */}
                    {participants.map((p, idx) => {
                      const pMedia = peerMediaStates[p.userId] || { videoEnabled: true, audioEnabled: true }
                      const pHand = peerHandRaises[p.userId] || false
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 border border-[#3c4043]/30 rounded-lg bg-[#3c4043]/10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-slate-650 rounded-full flex items-center justify-center text-[10px] font-medium text-white">
                              {getInitials(p.userName)}
                            </div>
                            <span className="text-xs text-slate-300 line-clamp-1">{p.userName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {pHand && <Hand className="w-3.5 h-3.5 text-amber-400" />}
                            {pMedia.audioEnabled ? <Mic className="w-3.5 h-3.5 text-slate-400" /> : <MicOff className="w-3.5 h-3.5 text-red-500" />}
                            {pMedia.videoEnabled ? <VideoIcon className="w-3.5 h-3.5 text-slate-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar Footer (Chat Send Box) */}
              {activeTab === 'chat' && (
                <div className="p-3 border-t border-[#3c4043]/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      className="flex-1 bg-[#1a1b1f] text-white px-3 py-2 border border-[#3c4043] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                      placeholder="Send a message..."
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim()}
                      className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:bg-purple-400 flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar (Stretches across bottom - classic Google Meet style) */}
      <div className="px-6 py-4 bg-[#202124] border-t border-[#3c4043]/50 flex justify-between items-center z-20">
        
        {/* Left Side: Meeting Code display */}
        <div className="hidden sm:flex items-center gap-3 w-1/4">
          <div className="text-xs font-medium tracking-wide text-slate-300 font-mono">
            {meetingDetails ? formatCode(meetingDetails.meeting_code) : '---'}
          </div>
          <button
            onClick={() => setShowDetailsModal(!showDetailsModal)}
            title="Meeting Details"
            className={`p-1.5 rounded-full hover:bg-[#3c4043]/80 transition-all ${
              showDetailsModal ? 'bg-[#3c4043] text-white' : 'bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Info className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Center: Audio/Video Action Buttons */}
        <div className="flex items-center gap-3.5 justify-center flex-1 sm:flex-initial">
          {/* Microphone */}
          <motion.button
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            className={`p-3 rounded-full transition-all border border-transparent ${
              audioEnabled
                ? 'bg-[#3c4043] hover:bg-[#4c5054] text-white'
                : 'bg-[#ea4335] hover:bg-[#d93025] text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </motion.button>

          {/* Camera */}
          <motion.button
            onClick={toggleVideo}
            title={videoEnabled ? 'Disable Camera' : 'Enable Camera'}
            className={`p-3 rounded-full transition-all border border-transparent ${
              videoEnabled
                ? 'bg-[#3c4043] hover:bg-[#4c5054] text-white'
                : 'bg-[#ea4335] hover:bg-[#d93025] text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {videoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </motion.button>

          {/* Screen Presentation (Share Screen) */}
          <motion.button
            onClick={toggleScreenShare}
            title={screenSharing ? 'Stop Presenting' : 'Present Now'}
            className={`p-3 rounded-full transition-all border border-transparent ${
              screenSharing
                ? 'bg-[#ea4335] hover:bg-[#d93025] text-white'
                : 'bg-[#3c4043] hover:bg-[#4c5054] text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Monitor className="w-5 h-5" />
          </motion.button>

          {/* Hand Raise */}
          <motion.button
            onClick={toggleHandRaise}
            title={handRaised ? 'Lower Hand' : 'Raise Hand'}
            className={`p-3 rounded-full transition-all border border-transparent ${
              handRaised
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-[#3c4043] hover:bg-[#4c5054] text-white'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Hand className={`w-5 h-5 ${handRaised ? 'fill-slate-950' : ''}`} />
          </motion.button>

          {/* End Call / Hang Up */}
          <motion.button
            onClick={() => {
              cleanupConference()
              navigate('/dashboard')
            }}
            title="Leave Meeting"
            className="px-6 py-3 rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white text-xs font-semibold flex items-center justify-center"
            whileTap={{ scale: 0.95 }}
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            Leave
          </motion.button>
        </div>

        {/* Right Side: Toggle Sidebar views */}
        <div className="hidden sm:flex items-center gap-2 justify-end w-1/4">
          {/* Chat Toggle Button */}
          <button
            onClick={() => {
              if (showSidebar && activeTab === 'chat') {
                setShowSidebar(false)
              } else {
                setShowSidebar(true)
                setActiveTab('chat')
                setMessagesBadge(0)
              }
            }}
            title="Chat with Everyone"
            className={`p-2 rounded-lg transition-all ${
              showSidebar && activeTab === 'chat'
                ? 'bg-[#3c4043] text-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {messagesBadge > 0 && !(showSidebar && activeTab === 'chat') && (
              <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-purple-500 text-white text-[9px] font-bold rounded-full leading-none shadow-md">
                {messagesBadge}
              </span>
            )}
          </button>

          {/* People Toggle Button */}
          <button
            onClick={() => {
              if (showSidebar && activeTab === 'participants') {
                setShowSidebar(false)
              } else {
                setShowSidebar(true)
                setActiveTab('participants')
              }
            }}
            title="Show Everyone"
            className={`p-2 rounded-lg transition-all ${
              showSidebar && activeTab === 'participants'
                ? 'bg-[#3c4043] text-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

      </div>

      {/* Info Popover Modal */}
      <AnimatePresence>
        {showDetailsModal && meetingDetails && (
          <div className="absolute left-6 bottom-24 w-80 bg-[#2d2e30] border border-[#3c4043] rounded-xl p-5 shadow-2xl z-30 text-slate-200">
            <div className="flex justify-between items-start mb-3 border-b border-[#3c4043] pb-2">
              <h3 className="font-semibold text-xs text-slate-350 uppercase tracking-wider">Meeting Details</h3>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-[#3c4043] rounded-full text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-slate-500 uppercase tracking-wide text-[9px] font-semibold mb-0.5">Title</p>
                <p className="text-slate-200 font-medium">{meetingDetails.title}</p>
              </div>

              {meetingDetails.description && (
                <div>
                  <p className="text-slate-500 uppercase tracking-wide text-[9px] font-semibold mb-0.5">Description</p>
                  <p className="text-slate-350">{meetingDetails.description}</p>
                </div>
              )}

              <div className="pt-2 border-t border-[#3c4043]">
                <p className="text-slate-500 uppercase tracking-wide text-[9px] font-semibold mb-1">Joining Link</p>
                <div className="flex items-center gap-1.5 p-2 bg-[#1a1b1f] border border-[#3c4043] rounded-lg font-mono text-[10px] select-all overflow-hidden text-slate-300">
                  <span className="flex-1 truncate">
                    {`http://localhost:3000/conference/${formatCode(meetingDetails.meeting_code)}`}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1 bg-[#3c4043] hover:bg-[#4c5054] rounded text-slate-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default ConferenceRoom
