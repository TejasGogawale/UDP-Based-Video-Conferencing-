import React, { useRef, useEffect } from 'react'
import { ParticipantTile } from './ParticipantTile'
import { Monitor, StopCircle, Pin, Volume2 } from 'lucide-react'

export const VideoGrid = ({
  localStream,
  remoteStreams = {},
  localScreenStream = null,
  remoteScreenStreams = {},
  presenterInfo = null, // { userId, userName, isSharing, isSelf }
  currentUser,
  participants = [],
  layoutMode = 'auto',
  pinnedUserId = null,
  onPinUser,
  onMuteUser,
  isHost = false,
  activeSpeakerId = null,
  visualEffect = 'none',
  visualFilter = 'none',
  onStopScreenShare
}) => {
  const presentationVideoRef = useRef(null)

  // Construct camera/mic tile list
  const allTiles = [
    {
      userId: currentUser?.sid || 'self',
      userName: currentUser?.name || 'You',
      isSelf: true,
      stream: localStream,
      audioEnabled: currentUser?.audioEnabled !== false,
      videoEnabled: currentUser?.videoEnabled !== false,
      handRaised: currentUser?.handRaised || false,
      effectType: visualEffect,
      filterStyle: visualFilter
    },
    ...participants.map(p => ({
      userId: p.userId,
      userName: p.userName || 'Participant',
      isSelf: false,
      stream: remoteStreams[p.userId] || null,
      audioEnabled: p.audioEnabled !== false,
      videoEnabled: p.videoEnabled !== false,
      handRaised: p.handRaised || false,
      effectType: 'none',
      filterStyle: 'none'
    }))
  ]

  const totalTiles = allTiles.length

  // Check if a presentation is active
  const isPresenting = Boolean(presenterInfo && presenterInfo.isSharing)
  const isSelfPresenting = Boolean(presenterInfo?.isSelf)

  const presentationStream = isSelfPresenting
    ? localScreenStream
    : (presenterInfo?.userId ? (remoteScreenStreams[presenterInfo.userId] || null) : null)

  useEffect(() => {
    const videoEl = presentationVideoRef.current
    if (videoEl && presentationStream) {
      if (videoEl.srcObject !== presentationStream) {
        videoEl.srcObject = presentationStream
      }
      videoEl.play().catch(() => {})
    }
  }, [presentationStream, isPresenting])

  // Determine pinned tile
  const pinnedTile = pinnedUserId ? allTiles.find(t => t.userId === pinnedUserId) : null

  // 1. Presentation Mode (Screen Sharing Active)
  if (isPresenting) {
    return (
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden h-full">
        {/* Main Presentation Stage */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] rounded-2xl overflow-hidden border border-[#3c4043] relative shadow-2xl">
          {presentationStream ? (
            <video
              ref={presentationVideoRef}
              autoPlay
              playsInline
              muted={isSelfPresenting} // Hear screen audio if remote presenter is sharing with audio
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-3 bg-[#1e1e1e]">
              <Monitor className="w-16 h-16 text-[#8ab4f8] animate-pulse" />
              <h3 className="text-lg font-semibold text-white">
                {isSelfPresenting ? "You're presenting to everyone" : `${presenterInfo?.userName || 'Presenter'} is presenting`}
              </h3>
              {isSelfPresenting && (
                <button
                  onClick={onStopScreenShare}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow"
                >
                  <StopCircle className="w-4 h-4" /> Stop presenting
                </button>
              )}
            </div>
          )}

          {/* Top Status Banner */}
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-[#202124]/90 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/10 shadow z-20">
            <Monitor className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span>
              {isSelfPresenting
                ? 'You are presenting to everyone'
                : `${presenterInfo?.userName || 'Participant'} is presenting`}
            </span>
          </div>

          {/* Top Right Stop Button (for self) */}
          {isSelfPresenting && (
            <div className="absolute top-3 right-3 z-20">
              <button
                onClick={onStopScreenShare}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors shadow"
              >
                <StopCircle className="w-3.5 h-3.5" /> Stop sharing
              </button>
            </div>
          )}
        </div>

        {/* Side Camera Strip - Displays all participants' camera video & audio in parallel */}
        <div className="w-full md:w-64 h-36 md:h-full flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
          {allTiles.map((tile) => (
            <div key={tile.userId} className="w-44 md:w-full h-full md:h-40 shrink-0">
              <ParticipantTile
                {...tile}
                isSpeaking={activeSpeakerId === tile.userId}
                isPinned={pinnedUserId === tile.userId}
                onPin={(pinned) => onPinUser(pinned ? tile.userId : null)}
                onMute={() => onMuteUser && onMuteUser(tile.userId)}
                isHost={isHost}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 2. Spotlight Mode (when a user tile is pinned)
  if (pinnedTile) {
    const otherTiles = allTiles.filter(t => t.userId !== pinnedTile.userId)

    return (
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden h-full">
        <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative">
          <ParticipantTile
            {...pinnedTile}
            isSpeaking={activeSpeakerId === pinnedTile.userId}
            isPinned={true}
            onPin={() => onPinUser(null)}
            onMute={() => onMuteUser && onMuteUser(pinnedTile.userId)}
            isHost={isHost}
          />
        </div>

        {otherTiles.length > 0 && (
          <div className="w-full md:w-64 h-36 md:h-full flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
            {otherTiles.map((tile) => (
              <div key={tile.userId} className="w-44 md:w-full h-full md:h-40 shrink-0">
                <ParticipantTile
                  {...tile}
                  isSpeaking={activeSpeakerId === tile.userId}
                  isPinned={false}
                  onPin={() => onPinUser(tile.userId)}
                  onMute={() => onMuteUser && onMuteUser(tile.userId)}
                  isHost={isHost}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // 3. Dynamic Tiled Grid Mode (1 to 49 participants)
  let gridClass = 'grid-cols-1 grid-rows-1'
  if (totalTiles === 2) gridClass = 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1'
  else if (totalTiles === 3 || totalTiles === 4) gridClass = 'grid-cols-1 sm:grid-cols-2 auto-rows-fr'
  else if (totalTiles === 5 || totalTiles === 6) gridClass = 'grid-cols-2 sm:grid-cols-3 auto-rows-fr'
  else if (totalTiles >= 7 && totalTiles <= 9) gridClass = 'grid-cols-2 sm:grid-cols-3 auto-rows-fr'
  else if (totalTiles >= 10) gridClass = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-fr'

  return (
    <div className="flex-1 p-2 sm:p-3 overflow-hidden h-full flex items-center justify-center">
      <div className={`w-full h-full grid gap-2 sm:gap-3 max-w-7xl max-h-full ${gridClass}`}>
        {allTiles.map((tile) => (
          <div key={tile.userId} className="w-full h-full min-h-[120px] sm:min-h-[160px] relative">
            <ParticipantTile
              {...tile}
              isSpeaking={activeSpeakerId === tile.userId}
              isPinned={pinnedUserId === tile.userId}
              onPin={(pinned) => onPinUser(pinned ? tile.userId : null)}
              onMute={() => onMuteUser && onMuteUser(tile.userId)}
              isHost={isHost}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
