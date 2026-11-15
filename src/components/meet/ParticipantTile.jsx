import React, { useState } from 'react'
import { Mic, MicOff, Pin, PinOff, Hand, VolumeX, UserX, Monitor, WifiOff, Loader2, Crown, ShieldCheck, ShieldAlert } from 'lucide-react'
import { MediaVideo } from './media/MediaVideo'
import { levelToPercent } from '../../lib/media/audioLevels'

const Avatar = ({ name, speaking, size = 'md' }) => {
  const initial = (name || 'U').trim().charAt(0).toUpperCase()
  const dims = size === 'sm' ? 'w-10 h-10 text-base' : 'w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl'
  return (
    <div className="relative">
      {speaking && <div className="absolute -inset-2 rounded-full border-2 border-[#8ab4f8]/70 animate-pulse" />}
      <div className={`${dims} rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center font-semibold text-white shadow-xl`}>
        {initial}
      </div>
    </div>
  )
}

/**
 * One participant's camera tile. All state comes from props (roster + media);
 * the tile never decides on its own whether someone is "really" there.
 */
export const ParticipantTile = ({
  name = 'Participant',
  isSelf = false,
  isOwnerHost = false,
  stream = null,
  relayFrame = null,
  videoOn = false,
  audioOn = true,
  handRaised = false,
  isPresenting = false,
  speaking = false,
  level = 0,
  connection = 'connected', // connecting | connected | reconnecting | failed
  quality = null,
  liveness = null,
  pinned = false,
  compact = false,
  mirror = false,
  canModerate = false,
  onPin,
  onMute,
  onRemove
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const hasStreamVideo = Boolean(stream && stream.getVideoTracks && stream.getVideoTracks().length > 0)
  const showVideo = videoOn && ( Boolean(relayFrame) || hasStreamVideo )

  const placeholder = (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#28292c] gap-2 px-2 text-center">
      <Avatar name={name} speaking={speaking && audioOn} size={compact ? 'sm' : 'md'} />
      {!compact && !isSelf && connection === 'connecting' && (
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Connecting…</span>
      )}
    </div>
  )

  // Camera is on but no frames yet (still connecting, or media blocked by the network).
  const waitingForVideo = (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#28292c] gap-2 px-3 text-center">
      <Avatar name={name} size={compact ? 'sm' : 'md'} />
      {!compact && (
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          {isSelf ? 'Starting camera…' : `Waiting for ${name}'s video…`}
        </span>
      )}
    </div>
  )

  return (
    <div
      data-testid="participant-tile"
      data-name={name}
      data-self={isSelf ? 'true' : 'false'}
      data-connection={connection}
      className={`relative w-full h-full bg-[#3c4043] rounded-xl sm:rounded-2xl overflow-hidden group select-none border-2 transition-colors ${
        speaking && audioOn ? 'border-[#8ab4f8] shadow-[0_0_16px_rgba(138,180,248,0.35)]' : 'border-transparent'
      }`}
    >
      {showVideo ? (
        relayFrame ? (
          <img
            src={relayFrame}
            alt={name}
            className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''}`}
          />
        ) : (
          <MediaVideo stream={stream} mirror={mirror} fallback={waitingForVideo} />
        )
      ) : (
        placeholder
      )}

      {/* Connection problems are stated, never shown as a silent black tile. */}
      {!isSelf && (connection === 'failed' || connection === 'reconnecting') && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1.5 p-3 text-center z-10">
          <WifiOff className="w-5 h-5 text-[#f28b82]" />
          {!compact && (
            <p className="text-xs text-gray-200 max-w-[16rem]">
              {connection === 'failed'
                ? `Can't connect to ${name}'s audio/video. A TURN relay may be required on this network.`
                : `Reconnecting to ${name}…`}
            </p>
          )}
        </div>
      )}

      {/* Name pill */}
      <div className="absolute bottom-1.5 left-1.5 sm:bottom-2.5 sm:left-2.5 flex items-center gap-1.5 pl-2 pr-1.5 py-1 bg-[#202124]/80 backdrop-blur-md rounded-full text-[11px] sm:text-xs font-medium text-white z-20 max-w-[85%]">
        {isOwnerHost && <Crown className="w-3 h-3 text-[#fbbc04] shrink-0" />}
        {isPresenting && <Monitor className="w-3 h-3 text-[#8ab4f8] shrink-0" />}
        <span className="truncate">{name}{isSelf ? ' (You)' : ''}</span>
        {audioOn ? (
          <span className="relative w-4 h-4 shrink-0 flex items-center justify-center">
            <Mic className={`w-3.5 h-3.5 ${speaking ? 'text-[#8ab4f8]' : 'text-gray-300'}`} />
            <span
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-[#8ab4f8] rounded-full transition-all duration-150"
              style={{ height: `${Math.min(12, levelToPercent(level) / 8)}px` }}
            />
          </span>
        ) : (
          <MicOff className="w-3.5 h-3.5 text-[#f28b82] shrink-0" aria-label="Microphone muted" />
        )}
        {quality === 'poor' && !isSelf && <WifiOff className="w-3 h-3 text-[#fbbc04] shrink-0" aria-label="Poor connection" />}
        {liveness?.status === 'verified' && (
          <span
            className="shrink-0 flex items-center text-[#81c995]"
            title={`${liveness.reason || 'Live feed verified'} (${liveness.score}% confidence)`}
            data-testid="liveness-badge"
            data-liveness="verified"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </span>
        )}
        {(liveness?.status === 'synthetic' || liveness?.status === 'tampered') && (
          <span
            className="shrink-0 flex items-center text-[#f28b82]"
            title={`${liveness.reason || 'Synthetic/unverified media feed'} (${liveness.score}% confidence)`}
            data-testid="liveness-badge"
            data-liveness={liveness.status}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {handRaised && (
        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 flex items-center gap-1 px-2 py-1 bg-[#fbbc04] text-[#202124] text-[11px] font-bold rounded-full shadow z-20">
          <Hand className="w-3.5 h-3.5 fill-current" />
          {!compact && <span>Hand raised</span>}
        </div>
      )}

      {/* Actions: visible on hover (desktop) or after a tap (touch). */}
      {(onPin || canModerate) && (
        <div
          className={`absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 flex items-center gap-1 z-20 transition-opacity ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {onPin && (
            <button
              onClick={() => onPin(!pinned)}
              className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md shadow ${pinned ? 'bg-[#8ab4f8] text-[#202124]' : 'bg-[#202124]/80 text-white hover:bg-[#3c4043]'}`}
              title={pinned ? 'Unpin' : 'Pin to main stage'}
              aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
            >
              {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
          )}
          {canModerate && !isSelf && audioOn && (
            <button onClick={onMute} className="p-1.5 sm:p-2 rounded-full bg-[#202124]/80 text-white hover:bg-red-600/80 backdrop-blur-md shadow" title={`Mute ${name}`} aria-label={`Mute ${name}`}>
              <VolumeX className="w-4 h-4" />
            </button>
          )}
          {canModerate && !isSelf && onRemove && (
            <button onClick={onRemove} className="p-1.5 sm:p-2 rounded-full bg-[#202124]/80 text-white hover:bg-red-600/80 backdrop-blur-md shadow" title={`Remove ${name}`} aria-label={`Remove ${name}`}>
              <UserX className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Touch devices have no hover: a tap toggles the action buttons. */}
      {(onPin || canModerate) && (
        <button
          className="absolute inset-0 z-[5] sm:hidden"
          aria-label={`Show actions for ${name}`}
          onClick={() => setMenuOpen((v) => !v)}
        />
      )}
    </div>
  )
}
