import React, { useRef, useEffect } from 'react'
import {
  Mic,
  MicOff,
  Pin,
  Maximize2,
  Hand,
  VolumeX,
  Volume2
} from 'lucide-react'

export const ParticipantTile = ({
  stream,
  userName = 'Participant',
  isSelf = false,
  audioEnabled = true,
  videoEnabled = true,
  handRaised = false,
  isSpeaking = false,
  isPinned = false,
  onPin,
  onMute,
  isHost = false,
  filterStyle = 'none',
  effectType = 'none'
}) => {
  const videoRef = useRef(null)
  const audioRef = useRef(null)

  // Attach and play video stream
  useEffect(() => {
    const videoEl = videoRef.current
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream
      }
      videoEl.play().catch(() => {})
    }
  }, [stream, videoEnabled])

  // Dedicated Audio Element for Remote Participants (Guarantees uninterrupted audio playback)
  useEffect(() => {
    const audioEl = audioRef.current
    if (audioEl && stream && !isSelf) {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream
      }
      audioEl.play().catch(() => {})
    }
  }, [stream, isSelf, audioEnabled])

  // CSS Filter computations
  let filterCss = ''
  if (filterStyle === 'warm') filterCss = 'brightness(105%) contrast(105%) sepia(20%)'
  else if (filterStyle === 'cool') filterCss = 'brightness(110%) hue-rotate(15deg)'
  else if (filterStyle === 'noir') filterCss = 'grayscale(100%) contrast(120%)'
  else if (filterStyle === 'vivid') filterCss = 'saturate(130%) contrast(110%)'

  let blurClass = ''
  if (effectType === 'blur-sm') blurClass = 'backdrop-blur-sm'
  else if (effectType === 'blur-lg') blurClass = 'backdrop-blur-md'

  return (
    <div
      className={`relative w-full h-full bg-[#3c4043] rounded-2xl overflow-hidden group select-none transition-all duration-200 border-2 ${
        isSpeaking
          ? 'border-[#8ab4f8] shadow-[0_0_20px_rgba(138,180,248,0.4)]'
          : 'border-transparent'
      }`}
    >
      {/* Dedicated Hidden Audio Playback for Remote Streams */}
      {!isSelf && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={false}
          className="hidden"
        />
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isSelf ? '-scale-x-100' : ''
        } ${blurClass} ${videoEnabled && stream ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
        style={{ filter: filterCss || undefined }}
      />

      {/* Dynamic Audio-Reactive Avatar Placeholder when video is off */}
      {(!videoEnabled || !stream) && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#28292c]">
          <div className="relative">
            {/* Animated ripple rings when speaking */}
            {isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full bg-[#8ab4f8]/20 animate-ping" />
                <div className="absolute -inset-3 rounded-full border border-[#8ab4f8]/40 animate-pulse" />
              </>
            )}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-2xl md:text-3xl font-bold text-white shadow-xl">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </div>
      )}

      {/* Floating Name Pill & Mic Status */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#202124]/80 backdrop-blur-md rounded-full text-xs font-medium text-white shadow-md z-10 border border-white/10 max-w-[80%] truncate">
        <span className="truncate">{userName} {isSelf && '(You)'}</span>
        <div className="shrink-0">
          {audioEnabled ? (
            <div className={`p-0.5 ${isSpeaking ? 'text-[#8ab4f8]' : 'text-gray-300'}`}>
              <Mic className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-0.5 text-[#f28b82]">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Top Left: Hand Raised Badge */}
      {handRaised && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#fbbc04] text-[#202124] text-xs font-bold rounded-full shadow-lg z-10 animate-bounce">
          <Hand className="w-3.5 h-3.5 fill-current" />
          <span>Hand raised</span>
        </div>
      )}

      {/* Top Right: Quick Action Overlay on Hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {/* Pin button */}
        <button
          onClick={() => onPin && onPin(!isPinned)}
          className={`p-2 rounded-full backdrop-blur-md transition-colors shadow ${
            isPinned
              ? 'bg-[#8ab4f8] text-[#202124]'
              : 'bg-[#202124]/80 text-white hover:bg-[#3c4043]'
          }`}
          title={isPinned ? 'Unpin' : 'Pin tile to main stage'}
        >
          <Pin className="w-4 h-4" />
        </button>

        {/* Host Mute Action */}
        {isHost && !isSelf && onMute && (
          <button
            onClick={onMute}
            className="p-2 rounded-full bg-[#202124]/80 text-white hover:bg-red-600/80 backdrop-blur-md transition-colors shadow"
            title="Mute participant"
          >
            <VolumeX className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
