import React from 'react'
import { Mic, MicOff, Video, VideoOff, Sparkles, Settings, Loader2, AlertTriangle, Users, WifiOff } from 'lucide-react'
import { MediaVideo } from './media/MediaVideo'
import { levelToPercent } from '../../lib/media/audioLevels'
import { formatMeetingCode } from '../../lib/meetingCode'

function presenceText({ known, count, participants }) {
  if (!known) return 'Checking who is in the call…'
  if (count === 0) return 'No one else is here yet'
  const names = participants.map((p) => p.userName)
  if (count === 1) return `${names[0]} is in this call`
  if (count === 2) return `${names[0]} and ${names[1]} are in this call`
  return `${names[0]}, ${names[1]} and ${count - 2} more are in this call`
}

export const GreenRoomLobby = ({
  stream,
  audioEnabled,
  videoEnabled,
  micLevel = 0,
  mediaReady,
  mediaErrors = {},
  onToggleAudio,
  onToggleVideo,
  onJoinMeeting,
  onOpenSettings,
  onOpenEffects,
  meetingCode,
  meetingTitle,
  presence,
  joining,
  socketStatus,
  userName = 'You',
  effectActive
}) => {
  const hasVideo = videoEnabled && stream?.getVideoTracks().length > 0
  const initial = (userName || 'U').charAt(0).toUpperCase()

  return (
    <div className="h-app overflow-y-auto bg-[#202124] text-white pt-safe pb-safe">
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-5xl w-full grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Preview */}
          <div className="lg:col-span-7 w-full">
            <div className="relative w-full aspect-[4/3] sm:aspect-video max-h-[55dvh] lg:max-h-none mx-auto bg-[#3c4043] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
              {hasVideo ? (
                <MediaVideo
                  stream={stream}
                  mirror
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-300 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Starting camera…
                    </div>
                  }
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#28292c] gap-3 px-6 text-center">
                  {!mediaReady ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin text-[#8ab4f8]" />
                      <p className="text-sm text-gray-300">Waiting for camera and microphone permission…</p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-semibold shadow-xl">{initial}</div>
                      <p className="text-sm text-gray-400">Camera is off</p>
                    </>
                  )}
                </div>
              )}

              <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#202124]/80 rounded-full text-xs text-gray-200">{userName}</div>

              {effectActive && hasVideo && (
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#202124]/80 rounded-full text-xs text-[#c58af9] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Effect on
                </div>
              )}

              {/* Controls on the preview */}
              <div className="absolute bottom-3 sm:bottom-4 inset-x-0 flex items-center justify-center gap-3">
                <button
                  onClick={onToggleAudio}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center border border-white/20 ${audioEnabled ? 'bg-[#3c4043]/90 hover:bg-[#4a4e52]' : 'bg-[#ea4335] hover:bg-[#d93025]'}`}
                  title={audioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                  aria-label={audioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                >
                  {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  {audioEnabled && (
                    <span className="absolute -bottom-1 left-2 right-2 h-1 rounded-full bg-black/40 overflow-hidden">
                      <span className="block h-full bg-[#81c995] transition-all duration-150" style={{ width: `${levelToPercent(micLevel)}%` }} />
                    </span>
                  )}
                </button>
                <button
                  onClick={onToggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border border-white/20 ${videoEnabled ? 'bg-[#3c4043]/90 hover:bg-[#4a4e52]' : 'bg-[#ea4335] hover:bg-[#d93025]'}`}
                  title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button onClick={onOpenEffects} className="w-12 h-12 rounded-full flex items-center justify-center bg-[#3c4043]/90 hover:bg-[#4a4e52] border border-white/20" title="Backgrounds and effects" aria-label="Backgrounds and effects">
                  <Sparkles className="w-5 h-5 text-[#c58af9]" />
                </button>
                <button onClick={onOpenSettings} className="w-12 h-12 rounded-full flex items-center justify-center bg-[#3c4043]/90 hover:bg-[#4a4e52] border border-white/20" title="Audio and video settings" aria-label="Audio and video settings">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {(mediaErrors.mic || mediaErrors.cam) && (
              <div className="mt-3 space-y-2">
                {[mediaErrors.mic, mediaErrors.cam].filter(Boolean).map((msg) => (
                  <div key={msg} className="flex items-start gap-2 p-3 rounded-xl bg-[#ea4335]/10 border border-[#ea4335]/30 text-xs text-[#f6aea9]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Join card */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left gap-5">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-normal">{meetingTitle ? meetingTitle : 'Ready to join?'}</h1>
              <p className="text-sm text-gray-300 flex items-center justify-center lg:justify-start gap-2">
                <Users className="w-4 h-4 text-[#8ab4f8]" />
                <span aria-live="polite">{presenceText(presence)}</span>
              </p>
            </div>

            <button
              onClick={onJoinMeeting}
              disabled={joining || !mediaReady}
              className="w-full max-w-xs py-3.5 px-6 bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:bg-[#8ab4f8]/50 disabled:cursor-not-allowed text-[#202124] font-semibold text-sm rounded-full shadow-lg flex items-center justify-center gap-2"
            >
              {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join now'}
            </button>

            {socketStatus !== 'connected' && (
              <p className="text-xs text-[#fbbc04] flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5" /> Connecting to the meeting server…
              </p>
            )}

            <div className="pt-4 border-t border-[#3c4043] w-full max-w-xs space-y-1 text-xs text-gray-400">
              <p>Meeting code: <span className="font-mono text-gray-200">{formatMeetingCode(meetingCode)}</span></p>
              <p>You can present your screen after joining.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
