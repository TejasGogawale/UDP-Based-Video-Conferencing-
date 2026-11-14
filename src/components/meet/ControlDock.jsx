import React, { useEffect, useState } from 'react'
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, StopCircle, Hand, Smile, Sparkles, PenTool,
  MoreVertical, Info, Users, MessageSquare, Shapes, Shield, ClosedCaption, Maximize, LayoutGrid,
  Copy, Check, X, Settings, Circle
} from 'lucide-react'
import { formatMeetingCode, meetingLink } from '../../lib/meetingCode'

const EMOJIS = ['💖', '👍', '👏', '😂', '😮', '😢', '🤔', '👎', '🎉']

const RoundButton = ({ active, danger, onClick, title, children, className = '', badge }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={`relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab4f8] ${
      danger ? 'bg-[#ea4335] hover:bg-[#d93025] text-white' : active ? 'bg-[#8ab4f8] text-[#202124]' : 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
    } ${className}`}
  >
    {children}
    {badge}
  </button>
)

const SheetItem = ({ icon: Icon, label, onClick, active, disabled, hint, tone = 'text-gray-200' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-3 bg-[#28292c] hover:bg-[#3c4043] disabled:opacity-50 disabled:hover:bg-[#28292c] rounded-xl flex flex-col items-center gap-1.5 text-[11px] leading-tight text-center min-h-[72px] justify-center"
    title={hint || label}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-[#8ab4f8]' : tone}`} />
    <span>{label}</span>
  </button>
)

export const ControlDock = ({
  meetingCode,
  currentTime = new Date(),
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  isScreenSharing,
  canShareScreen,
  onToggleScreenShare,
  handRaised,
  onToggleHand,
  captionsEnabled,
  onToggleCaptions,
  onSendReaction,
  activeDrawer,
  onToggleDrawer,
  participantsCount = 1,
  unreadMessages = 0,
  isHost,
  onLeaveCall,
  onOpenSettings,
  onOpenWhiteboard,
  hasPresentation,
  layoutMode,
  onSelectLayout,
  isRecording,
  onToggleRecording
}) => {
  const [showReactions, setShowReactions] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!showMore && !showReactions) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowMore(false)
        setShowReactions(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMore, showReactions])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink(meetingCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; the info drawer shows the link for manual copy.
      onToggleDrawer('info')
    }
  }

  const run = (fn) => () => {
    setShowMore(false)
    fn?.()
  }

  const time = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const layoutLabel = layoutMode === 'gallery' ? 'Gallery' : layoutMode === 'spotlight' ? 'Spotlight' : 'Auto'
  const nextLayout = layoutMode === 'auto' ? 'gallery' : layoutMode === 'gallery' ? 'spotlight' : 'auto'

  return (
    <div className="relative z-40 bg-[#202124] border-t border-[#3c4043]/60 pb-safe pl-safe pr-safe">
      <div className="h-16 sm:h-20 px-2 sm:px-4 flex items-center justify-between gap-2">
        {/* Left: time and code (desktop) */}
        <div className="hidden lg:flex items-center gap-3 text-sm text-gray-200 min-w-0 w-64">
          <span className="font-medium">{time}</span>
          <span className="text-gray-500">|</span>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#3c4043] rounded-lg text-xs font-mono text-gray-300 truncate" title="Copy meeting link">
            <span className="truncate">{formatMeetingCode(meetingCode)}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Center: primary controls */}
        <div className="flex-1 lg:flex-none flex items-center justify-center gap-2 sm:gap-3">
          <RoundButton danger={!audioEnabled} onClick={onToggleAudio} title={audioEnabled ? 'Turn off microphone (Ctrl+D)' : 'Turn on microphone (Ctrl+D)'}>
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </RoundButton>
          <RoundButton danger={!videoEnabled} onClick={onToggleVideo} title={videoEnabled ? 'Turn off camera (Ctrl+E)' : 'Turn on camera (Ctrl+E)'}>
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </RoundButton>

          <RoundButton className="hidden md:flex" active={captionsEnabled} onClick={onToggleCaptions} title={captionsEnabled ? 'Turn off captions' : 'Turn on captions'}>
            <ClosedCaption className="w-5 h-5" />
          </RoundButton>

          <div className="relative hidden sm:block">
            <RoundButton active={showReactions} onClick={() => setShowReactions((v) => !v)} title="Send a reaction">
              <Smile className="w-5 h-5" />
            </RoundButton>
            {showReactions && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#202124] border border-[#3c4043] rounded-full p-1.5 shadow-2xl flex items-center gap-0.5 z-50">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => { onSendReaction(emoji); setShowReactions(false) }} className="p-1.5 hover:bg-[#3c4043] rounded-full text-lg hover:scale-125 transition-transform" aria-label={`React ${emoji}`}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <RoundButton
            className="hidden sm:flex"
            active={isScreenSharing}
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Stop presenting' : canShareScreen ? 'Present now' : 'Screen sharing is not available in this browser'}
          >
            {isScreenSharing ? <StopCircle className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </RoundButton>

          <RoundButton className="hidden sm:flex" active={handRaised} onClick={onToggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}>
            <Hand className={`w-5 h-5 ${handRaised ? 'fill-current' : ''}`} />
          </RoundButton>

          {/* Chat sits in the primary row on phones. */}
          <RoundButton
            className="sm:hidden"
            active={activeDrawer === 'chat'}
            onClick={() => onToggleDrawer('chat')}
            title="Chat"
            badge={unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#8ab4f8] text-[#202124] text-[10px] font-bold flex items-center justify-center">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          >
            <MessageSquare className="w-5 h-5" />
          </RoundButton>

          <RoundButton active={showMore} onClick={() => setShowMore((v) => !v)} title="More options">
            <MoreVertical className="w-5 h-5" />
          </RoundButton>

          <button
            onClick={onLeaveCall}
            title="Leave call"
            aria-label="Leave call"
            className="shrink-0 h-11 sm:h-12 px-5 sm:px-6 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-full flex items-center justify-center shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Right: panels (tablet/desktop) */}
        <div className="hidden sm:flex items-center gap-0.5 lg:w-64 lg:justify-end">
          {[
            { id: 'info', icon: Info, title: 'Meeting details' },
            { id: 'people', icon: Users, title: 'People', count: participantsCount },
            { id: 'chat', icon: MessageSquare, title: 'Chat', dot: unreadMessages > 0 },
            { id: 'activities', icon: Shapes, title: 'Activities' },
            ...(isHost ? [{ id: 'host', icon: Shield, title: 'Host controls' }] : [])
          ].map(({ id, icon: Icon, title, count, dot }) => (
            <button
              key={id}
              onClick={() => onToggleDrawer(id)}
              title={title}
              aria-label={title}
              className={`relative p-2.5 rounded-full transition-colors ${activeDrawer === id ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-300 hover:text-white hover:bg-[#3c4043]'}`}
            >
              <Icon className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#5f6368] rounded-full text-[10px] font-bold text-white flex items-center justify-center">{count}</span>
              )}
              {dot && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#8ab4f8] rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {showMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 sm:bg-transparent" onClick={() => setShowMore(false)} />
          <div
            role="dialog"
            aria-label="More options"
            className="fixed sm:absolute z-50 inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-20 sm:right-4 lg:right-72 sm:w-80 bg-[#202124] border-t sm:border border-[#3c4043] rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 max-h-[75dvh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-white">Meeting options</span>
              <button onClick={() => setShowMore(false)} className="p-1.5 text-gray-400 hover:text-white rounded-full" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reactions (phones) */}
            <div className="sm:hidden flex items-center justify-between gap-1 mb-3 p-1.5 bg-[#28292c] rounded-2xl">
              {EMOJIS.slice(0, 7).map((emoji) => (
                <button key={emoji} onClick={run(() => onSendReaction(emoji))} className="flex-1 py-1.5 text-xl rounded-xl hover:bg-[#3c4043]" aria-label={`React ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SheetItem
                icon={isScreenSharing ? StopCircle : Monitor}
                label={isScreenSharing ? 'Stop presenting' : 'Share screen'}
                active={isScreenSharing}
                onClick={run(onToggleScreenShare)}
                hint={canShareScreen ? undefined : 'Mobile browsers cannot share their screen'}
              />
              <SheetItem icon={Hand} label={handRaised ? 'Lower hand' : 'Raise hand'} active={handRaised} onClick={run(onToggleHand)} />
              <SheetItem icon={ClosedCaption} label={captionsEnabled ? 'Captions on' : 'Captions'} active={captionsEnabled} onClick={run(onToggleCaptions)} />
              <SheetItem icon={Users} label={`People (${participantsCount})`} onClick={run(() => onToggleDrawer('people'))} tone="text-blue-300" />
              <SheetItem icon={Sparkles} label="Effects" onClick={run(() => onToggleDrawer('effects'))} tone="text-purple-300" />
              <SheetItem icon={LayoutGrid} label={`Layout: ${layoutLabel}`} onClick={run(() => onSelectLayout(nextLayout))} />
              <SheetItem icon={PenTool} label="Whiteboard" onClick={run(onOpenWhiteboard)} />
              <SheetItem icon={Shapes} label="Activities" onClick={run(() => onToggleDrawer('activities'))} tone="text-emerald-300" />
              <SheetItem icon={Circle} label={isRecording ? 'Stop recording' : 'Record'} active={isRecording} onClick={run(onToggleRecording)} tone="text-red-300" />
              {isHost && <SheetItem icon={Shield} label="Host controls" onClick={run(() => onToggleDrawer('host'))} tone="text-yellow-300" />}
              <SheetItem icon={Info} label="Meeting info" onClick={run(() => onToggleDrawer('info'))} />
              <SheetItem icon={copied ? Check : Copy} label={copied ? 'Link copied' : 'Copy link'} onClick={copyLink} />
              <SheetItem icon={Settings} label="Settings" onClick={run(onOpenSettings)} />
              <SheetItem
                icon={Maximize}
                label="Full screen"
                onClick={run(() => {
                  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
                  else document.exitFullscreen?.().catch(() => {})
                })}
              />
            </div>
            {hasPresentation && (
              <p className="mt-3 text-[11px] text-gray-400">Tip: use the layout switch at the top to see everyone's camera while someone presents.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
