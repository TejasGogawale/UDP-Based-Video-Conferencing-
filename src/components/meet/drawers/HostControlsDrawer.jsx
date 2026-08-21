import React from 'react'
import {
  X,
  Shield,
  Monitor,
  MessageSquare,
  Mic,
  Video,
  Smile,
  LogOut,
  AlertTriangle,
  Lock
} from 'lucide-react'

export const HostControlsDrawer = ({
  onClose,
  hostLocks = {},
  onToggleLock,
  onEndMeetingForAll
}) => {
  const controls = [
    {
      id: 'screenshare_disabled',
      title: 'Share their screen',
      desc: 'Allow participants to share application windows or screen',
      icon: Monitor,
      isAllowed: !hostLocks.screenshare_disabled
    },
    {
      id: 'chat_disabled',
      title: 'Send chat messages',
      desc: 'Allow participants to send in-call chat messages',
      icon: MessageSquare,
      isAllowed: !hostLocks.chat_disabled
    },
    {
      id: 'mic_disabled',
      title: 'Turn on their microphone',
      desc: 'Allow participants to unmute their microphones',
      icon: Mic,
      isAllowed: !hostLocks.mic_disabled
    },
    {
      id: 'video_disabled',
      title: 'Turn on their video',
      desc: 'Allow participants to enable their cameras',
      icon: Video,
      isAllowed: !hostLocks.video_disabled
    }
  ]

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">Host controls</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Host Management Info */}
        <div className="p-4 bg-[#28292c] rounded-2xl border border-[#3c4043] space-y-2">
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <Lock className="w-4 h-4 text-[#8ab4f8]" />
            Host management is ON
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Use these host settings to keep control over who can interact and participate in your meeting.
          </p>
        </div>

        {/* Participant Permissions */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Let participants
          </h3>

          <div className="space-y-3">
            {controls.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 bg-[#28292c] rounded-xl border border-[#3c4043]/60 hover:border-[#3c4043] transition-colors"
                >
                  <div className="flex items-start gap-3 pr-3">
                    <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => onToggleLock && onToggleLock(item.id, item.isAllowed)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      item.isAllowed ? 'bg-[#8ab4f8]' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        item.isAllowed ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Critical Actions */}
        <div className="pt-4 border-t border-[#3c4043] space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Meeting actions
          </h3>
          <button
            onClick={onEndMeetingForAll}
            className="w-full flex items-center justify-center gap-2 p-3 bg-red-600/20 hover:bg-red-600/30 text-[#f28b82] border border-red-500/40 rounded-xl text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            End call for everyone
          </button>
        </div>
      </div>
    </div>
  )
}
