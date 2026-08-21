import React, { useRef, useEffect, useState } from 'react'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Sparkles,
  Settings,
  Monitor,
  Check,
  Copy,
  Users
} from 'lucide-react'

export const GreenRoomLobby = ({
  stream,
  audioEnabled = true,
  videoEnabled = true,
  onToggleAudio,
  onToggleVideo,
  onJoinMeeting,
  onJoinAsPresenter,
  onOpenSettings,
  onOpenEffects,
  meetingCode,
  meetingTitle,
  activeParticipantsCount = 0,
  userName = 'You',
  visualEffect = 'none',
  visualFilter = 'none'
}) => {
  const videoRef = useRef(null)
  const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Simulated audio meter
  useEffect(() => {
    if (!audioEnabled) {
      setAudioLevel(0)
      return
    }
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 50 + 15)
    }, 120)
    return () => clearInterval(interval)
  }, [audioEnabled])

  // Compute filter styling
  let filterCss = ''
  if (visualFilter === 'warm') filterCss = 'brightness(105%) contrast(105%) sepia(20%)'
  else if (visualFilter === 'cool') filterCss = 'brightness(110%) hue-rotate(15deg)'
  else if (visualFilter === 'noir') filterCss = 'grayscale(100%) contrast(120%)'
  else if (visualFilter === 'vivid') filterCss = 'saturate(130%) contrast(110%)'

  let blurClass = ''
  if (visualEffect === 'blur-sm') blurClass = 'backdrop-blur-sm'
  else if (visualEffect === 'blur-lg') blurClass = 'backdrop-blur-md'

  const formattedCode = meetingCode
    ? `${meetingCode.slice(0, 3)}-${meetingCode.slice(3, 7)}-${meetingCode.slice(7, 10)}`
    : 'abc-defg-hij'

  return (
    <div className="min-h-[100dvh] bg-[#202124] text-white flex flex-col items-center justify-center p-4 sm:p-6 antialiased py-6">
      <div className="max-w-5xl w-full grid lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        {/* Left Column: Interactive Camera Preview */}
        <div className="lg:col-span-7 flex flex-col items-center w-full">
          <div className="relative w-full aspect-video max-w-2xl bg-[#3c4043] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-[#3c4043]/80">
            {videoEnabled && stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${blurClass}`}
                style={{ filter: filterCss || undefined }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#28292c] space-y-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-400">Camera is off</p>
              </div>
            )}

            {/* Bottom Floating Pill Controls on Video */}
            <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#202124]/85 backdrop-blur-md rounded-full border border-white/10 shadow-2xl">
              {/* Mic Toggle */}
              <button
                onClick={onToggleAudio}
                className={`p-2.5 sm:p-3 rounded-full transition-all ${
                  audioEnabled
                    ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
                    : 'bg-[#ea4335] hover:bg-[#d93025] text-white'
                }`}
                title={audioEnabled ? 'Turn off mic' : 'Turn on mic'}
              >
                {audioEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* Camera Toggle */}
              <button
                onClick={onToggleVideo}
                className={`p-2.5 sm:p-3 rounded-full transition-all ${
                  videoEnabled
                    ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
                    : 'bg-[#ea4335] hover:bg-[#d93025] text-white'
                }`}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* Effects Toggle */}
              <button
                onClick={onOpenEffects}
                className="p-2.5 sm:p-3 bg-[#3c4043] hover:bg-[#4a4e52] text-white rounded-full transition-all"
                title="Apply visual effects"
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#8ab4f8]" />
              </button>

              {/* Settings Toggle */}
              <button
                onClick={onOpenSettings}
                className="p-2.5 sm:p-3 bg-[#3c4043] hover:bg-[#4a4e52] text-white rounded-full transition-all"
                title="Audio and video settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Audio Wave Indicator on Top Right */}
            {audioEnabled && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#202124]/80 backdrop-blur-md rounded-full border border-white/10">
                <Mic className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8ab4f8]" />
                <div className="w-8 sm:w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8ab4f8] transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Action Card */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-5 sm:space-y-6 w-full">
          <div className="space-y-1.5 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl font-normal text-white">Ready to join?</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              {activeParticipantsCount === 0
                ? 'No one else is in this meeting yet'
                : `${activeParticipantsCount} ${activeParticipantsCount === 1 ? 'person is' : 'people are'} in this call`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            {/* Primary Join Button */}
            <button
              onClick={onJoinMeeting}
              className="w-full sm:flex-1 py-3.5 px-6 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-semibold text-sm rounded-full transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              Join now
            </button>

            {/* Present Button */}
            <button
              onClick={onJoinAsPresenter}
              className="w-full sm:w-auto py-3.5 px-5 bg-[#3c4043] hover:bg-[#4a4e52] text-white font-medium text-sm rounded-full transition-colors flex items-center justify-center gap-2"
            >
              <Monitor className="w-4 h-4 text-[#8ab4f8]" />
              Present
            </button>
          </div>

          {/* Meeting Info Details */}
          <div className="pt-4 border-t border-[#3c4043] w-full max-w-sm space-y-1">
            <p className="text-xs text-gray-400">Meeting code: <span className="font-mono text-gray-200">{formattedCode}</span></p>
            <p className="text-xs text-gray-400">Title: <span className="text-gray-200">{meetingTitle || 'VIT Connect Conference'}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
