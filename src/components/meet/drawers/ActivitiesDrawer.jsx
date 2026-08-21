import React from 'react'
import {
  X,
  Shapes,
  BarChart2,
  HelpCircle,
  PenTool,
  Radio,
  Download,
  Users2,
  ChevronRight,
  Sparkles,
  Disc
} from 'lucide-react'

export const ActivitiesDrawer = ({
  onClose,
  onOpenWhiteboard,
  onOpenPolls,
  onOpenQA,
  onOpenBreakouts,
  onToggleRecording,
  isRecording,
  onDownloadTranscript
}) => {
  const activities = [
    {
      id: 'whiteboard',
      title: 'Whiteboarding',
      desc: 'Collaborate and brainstorm on a live digital canvas',
      icon: PenTool,
      color: 'from-amber-500 to-orange-600',
      action: onOpenWhiteboard
    },
    {
      id: 'polls',
      title: 'Polls',
      desc: 'Get instant feedback with interactive live voting',
      icon: BarChart2,
      color: 'from-blue-500 to-cyan-600',
      action: onOpenPolls
    },
    {
      id: 'qa',
      title: 'Q&A',
      desc: 'Let participants submit and upvote questions',
      icon: HelpCircle,
      color: 'from-purple-500 to-indigo-600',
      action: onOpenQA
    },
    {
      id: 'breakouts',
      title: 'Breakout rooms',
      desc: 'Split participants into small group discussions',
      icon: Users2,
      color: 'from-emerald-500 to-teal-600',
      action: onOpenBreakouts
    },
    {
      id: 'recording',
      title: isRecording ? 'Stop Recording' : 'Recording',
      desc: isRecording ? 'Recording is currently in progress' : 'Record this meeting for later playback',
      icon: Disc,
      color: isRecording ? 'from-red-600 to-rose-700' : 'from-gray-600 to-slate-700',
      badge: isRecording ? '● REC' : null,
      action: onToggleRecording
    },
    {
      id: 'transcript',
      title: 'Download Transcript',
      desc: 'Export text messages and meeting session history',
      icon: Download,
      color: 'from-violet-500 to-purple-700',
      action: onDownloadTranscript
    }
  ]

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <Shapes className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">Activities</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Activities Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activities.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={item.action}
              className="w-full text-left p-4 bg-[#28292c] hover:bg-[#323639] border border-[#3c4043] hover:border-[#8ab4f8]/50 rounded-2xl transition-all duration-200 flex items-center justify-between group"
            >
              <div className="flex items-start gap-3.5 pr-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white group-hover:text-[#8ab4f8] transition-colors">
                      {item.title}
                    </h3>
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-red-600/30 border border-red-500 text-[10px] font-bold text-red-400 rounded-full animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
