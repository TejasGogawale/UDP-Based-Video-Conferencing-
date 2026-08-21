import React, { useState } from 'react'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  StopCircle,
  Hand,
  Smile,
  Sparkles,
  PenTool,
  MoreVertical,
  Info,
  Users,
  MessageSquare,
  Shapes,
  Shield,
  ClosedCaption,
  Maximize,
  Grid,
  Copy,
  Check,
  X,
  Settings,
  HelpCircle,
  BarChart2,
  HelpCircle as QAIcon,
  Layers
} from 'lucide-react'

export const ControlDock = ({
  meetingCode,
  currentTime = new Date(),
  audioEnabled = true,
  videoEnabled = true,
  onToggleAudio,
  onToggleVideo,
  isScreenSharing = false,
  onToggleScreenShare,
  handRaised = false,
  onToggleHand,
  captionsEnabled = false,
  onToggleCaptions,
  onSendReaction,
  activeDrawer = null, // 'info' | 'people' | 'chat' | 'activities' | 'host' | 'effects'
  onToggleDrawer,
  participantsCount = 1,
  unreadMessages = 0,
  isHost = false,
  onLeaveCall,
  onOpenSettings,
  onOpenWhiteboard,
  layoutMode = 'auto',
  onSelectLayout
}) => {
  const [showReactionsMenu, setShowReactionsMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const emojis = ['💖', '👍', '👏', '😂', '😮', '😢', '🤔', '👎', '🎉']

  const handleCopyCode = () => {
    if (!meetingCode) return
    navigator.clipboard.writeText(meetingCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const formattedCode = meetingCode
    ? `${meetingCode.slice(0, 3)}-${meetingCode.slice(3, 7)}-${meetingCode.slice(7, 10)}`
    : 'abc-defg-hij'

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="bg-[#202124] px-3 sm:px-6 py-2.5 sm:py-0 sm:h-20 flex items-center justify-between z-40 select-none border-t border-[#3c4043]/60 relative pb-safe">
      {/* 1. Left Section: Meeting Time & Code Info (Desktop only) */}
      <div className="hidden lg:flex items-center gap-3 text-white text-sm">
        <span className="font-medium tracking-tight text-gray-200">{timeString}</span>
        <span className="text-gray-500">|</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-[#3c4043] rounded-lg text-xs font-mono text-gray-300 hover:text-white transition-colors"
          title="Click to copy meeting code"
        >
          <span>{formattedCode}</span>
          {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      </div>

      {/* 2. Center Section: Main Controls */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3 mx-auto max-w-full">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-2.5 sm:p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            audioEnabled
              ? 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
              : 'bg-[#ea4335] hover:bg-[#d93025] text-white ring-2 ring-red-400/20'
          }`}
          title={audioEnabled ? 'Turn off microphone (Ctrl+D)' : 'Turn on microphone (Ctrl+D)'}
        >
          {audioEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-2.5 sm:p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            videoEnabled
              ? 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
              : 'bg-[#ea4335] hover:bg-[#d93025] text-white ring-2 ring-red-400/20'
          }`}
          title={videoEnabled ? 'Turn off camera (Ctrl+E)' : 'Turn on camera (Ctrl+E)'}
        >
          {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Captions CC Toggle (Desktop/Tablet) */}
        <button
          onClick={onToggleCaptions}
          className={`hidden md:flex p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            captionsEnabled
              ? 'bg-[#8ab4f8] text-[#202124]'
              : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
          }`}
          title={captionsEnabled ? 'Turn off captions' : 'Turn on captions (c)'}
        >
          <ClosedCaption className="w-5 h-5" />
        </button>

        {/* Reactions Emoji Button */}
        <div className="relative">
          <button
            onClick={() => setShowReactionsMenu(!showReactionsMenu)}
            className={`p-2.5 sm:p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
              showReactionsMenu
                ? 'bg-[#8ab4f8] text-[#202124]'
                : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
            }`}
            title="Send a reaction"
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Floating Emoji Picker Popup */}
          {showReactionsMenu && (
            <div className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 bg-[#202124] border border-[#3c4043] rounded-full p-1.5 shadow-2xl flex items-center gap-1 z-50 animate-in zoom-in-95 duration-100 max-w-[90vw] overflow-x-auto">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendReaction(emoji)
                    setShowReactionsMenu(false)
                  }}
                  className="p-1.5 sm:p-2 hover:bg-[#3c4043] rounded-full text-base sm:text-lg hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Screen Share / Present (Hidden on very small screens, accessible via More Menu) */}
        <button
          onClick={onToggleScreenShare}
          className={`hidden sm:flex p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            isScreenSharing
              ? 'bg-[#8ab4f8] text-[#202124]'
              : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
          }`}
          title={isScreenSharing ? 'Stop presenting' : 'Present now'}
        >
          {isScreenSharing ? <StopCircle className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Raise Hand Toggle */}
        <button
          onClick={onToggleHand}
          className={`p-2.5 sm:p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            handRaised
              ? 'bg-[#fbbc04] text-[#202124] ring-2 sm:ring-4 ring-[#fbbc04]/20 font-bold'
              : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
          }`}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className={`w-4 h-4 sm:w-5 sm:h-5 ${handRaised ? 'fill-current' : ''}`} />
        </button>

        {/* Visual Effects ✨ (Desktop) */}
        <button
          onClick={() => onToggleDrawer('effects')}
          className={`hidden lg:flex p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
            activeDrawer === 'effects'
              ? 'bg-[#8ab4f8] text-[#202124]'
              : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
          }`}
          title="Apply visual effects & background blur"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Whiteboard 📝 (Desktop) */}
        <button
          onClick={onOpenWhiteboard}
          className="hidden lg:flex p-3 md:p-3.5 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-white transition-all duration-200 shadow-md"
          title="Open collaborative whiteboard"
        >
          <PenTool className="w-5 h-5" />
        </button>

        {/* Chat Button directly on mobile bar for fast access */}
        <button
          onClick={() => onToggleDrawer(activeDrawer === 'chat' ? null : 'chat')}
          className={`sm:hidden p-2.5 rounded-full transition-all relative ${
            activeDrawer === 'chat' ? 'bg-[#8ab4f8] text-[#202124]' : 'bg-[#3c4043] text-white'
          }`}
          title="Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadMessages > 0 && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#8ab4f8] rounded-full animate-ping" />
          )}
        </button>

        {/* More Options ︙ */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`p-2.5 sm:p-3 md:p-3.5 rounded-full transition-all duration-200 shadow-md ${
              showMoreMenu
                ? 'bg-[#8ab4f8] text-[#202124]'
                : 'bg-[#3c4043] hover:bg-[#474a4d] text-white'
            }`}
            title="More options"
          >
            <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Mobile Bottom Sheet & Desktop Dropdown for More Options */}
          {showMoreMenu && (
            <>
              {/* Mobile Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 sm:hidden"
                onClick={() => setShowMoreMenu(false)}
              />

              <div className="fixed sm:absolute bottom-0 sm:bottom-16 left-0 sm:left-auto right-0 sm:right-0 w-full sm:w-72 bg-[#202124] border-t sm:border border-[#3c4043] rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-2 z-50 text-white animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto">
                <div className="sm:hidden flex items-center justify-between pb-3 mb-2 border-b border-[#3c4043]">
                  <span className="font-semibold text-sm">Meeting Options</span>
                  <button
                    onClick={() => setShowMoreMenu(false)}
                    className="p-1 text-gray-400 hover:text-white rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Quick Action Grid */}
                <div className="grid grid-cols-3 gap-2 sm:hidden pb-3 mb-3 border-b border-[#3c4043]">
                  <button
                    onClick={() => {
                      onToggleScreenShare()
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Monitor className={`w-5 h-5 ${isScreenSharing ? 'text-[#8ab4f8]' : 'text-gray-300'}`} />
                    <span>{isScreenSharing ? 'Stop Present' : 'Share Screen'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onToggleCaptions()
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <ClosedCaption className={`w-5 h-5 ${captionsEnabled ? 'text-[#8ab4f8]' : 'text-gray-300'}`} />
                    <span>Captions</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenWhiteboard()
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <PenTool className="w-5 h-5 text-[#8ab4f8]" />
                    <span>Whiteboard</span>
                  </button>

                  <button
                    onClick={() => {
                      onToggleDrawer('effects')
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>Effects</span>
                  </button>

                  <button
                    onClick={() => {
                      onToggleDrawer('people')
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Users className="w-5 h-5 text-blue-400" />
                    <span>People ({participantsCount})</span>
                  </button>

                  <button
                    onClick={() => {
                      onToggleDrawer('activities')
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Shapes className="w-5 h-5 text-emerald-400" />
                    <span>Activities</span>
                  </button>

                  {isHost && (
                    <button
                      onClick={() => {
                        onToggleDrawer('host')
                        setShowMoreMenu(false)
                      }}
                      className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                    >
                      <Shield className="w-5 h-5 text-yellow-400" />
                      <span>Host Tools</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onToggleDrawer('info')
                      setShowMoreMenu(false)
                    }}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Info className="w-5 h-5 text-gray-300" />
                    <span>Meeting Info</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 bg-[#28292c] hover:bg-[#3c4043] rounded-xl flex flex-col items-center gap-1.5 text-[11px] text-center"
                  >
                    <Copy className="w-5 h-5 text-gray-300" />
                    <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                {/* Common List Items */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      onSelectLayout(layoutMode === 'tiled' ? 'spotlight' : 'tiled')
                      setShowMoreMenu(false)
                    }}
                    className="w-full px-3.5 py-2.5 hover:bg-[#3c4043] rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-colors"
                  >
                    <Grid className="w-4 h-4 text-[#8ab4f8]" />
                    <span>Change layout ({layoutMode})</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {})
                      } else {
                        document.exitFullscreen().catch(() => {})
                      }
                      setShowMoreMenu(false)
                    }}
                    className="w-full px-3.5 py-2.5 hover:bg-[#3c4043] rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-colors"
                  >
                    <Maximize className="w-4 h-4 text-[#8ab4f8]" />
                    <span>Full screen</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenSettings()
                      setShowMoreMenu(false)
                    }}
                    className="w-full px-3.5 py-2.5 hover:bg-[#3c4043] rounded-xl text-left text-xs font-medium flex items-center gap-3 transition-colors border-t border-[#3c4043]/60 pt-2"
                  >
                    <Settings className="w-4 h-4 text-[#8ab4f8]" />
                    <span>Audio & video settings</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Leave Meeting Button */}
        <button
          onClick={onLeaveCall}
          className="px-3.5 sm:px-5 py-2.5 sm:py-3 md:py-3.5 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-full flex items-center justify-center gap-1.5 font-semibold text-xs transition-all duration-200 shadow-lg ring-2 sm:ring-4 ring-red-500/20"
          title="Leave call"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
        </button>
      </div>

      {/* 3. Right Section: Slide-Over Drawer Toggles (Hidden on mobile, accessible via dock or more menu) */}
      <div className="hidden sm:flex items-center gap-1 md:gap-1.5 text-white">
        {/* Info Drawer */}
        <button
          onClick={() => onToggleDrawer('info')}
          className={`p-2.5 md:p-3 rounded-full transition-colors ${
            activeDrawer === 'info' ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]'
          }`}
          title="Meeting details"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* People Drawer */}
        <button
          onClick={() => onToggleDrawer('people')}
          className={`p-2.5 md:p-3 rounded-full transition-colors relative ${
            activeDrawer === 'people' ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]'
          }`}
          title="People"
        >
          <Users className="w-5 h-5" />
          {participantsCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-[#3c4043] border border-white/20 rounded-full text-[10px] font-bold text-gray-200">
              {participantsCount}
            </span>
          )}
        </button>

        {/* Chat Drawer */}
        <button
          onClick={() => onToggleDrawer('chat')}
          className={`p-2.5 md:p-3 rounded-full transition-colors relative ${
            activeDrawer === 'chat' ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]'
          }`}
          title="Chat with everyone"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadMessages > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#8ab4f8] rounded-full animate-ping" />
          )}
        </button>

        {/* Activities Drawer */}
        <button
          onClick={() => onToggleDrawer('activities')}
          className={`p-2.5 md:p-3 rounded-full transition-colors ${
            activeDrawer === 'activities' ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]'
          }`}
          title="Activities"
        >
          <Shapes className="w-5 h-5" />
        </button>

        {/* Host Controls (Visible only if host) */}
        {isHost && (
          <button
            onClick={() => onToggleDrawer('host')}
            className={`p-2.5 md:p-3 rounded-full transition-colors ${
              activeDrawer === 'host' ? 'text-[#8ab4f8] bg-[#8ab4f8]/20' : 'text-gray-400 hover:text-white hover:bg-[#3c4043]'
            }`}
            title="Host controls"
          >
            <Shield className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
