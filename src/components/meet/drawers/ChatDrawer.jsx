import React, { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Lock, Info } from 'lucide-react'
import { DrawerShell } from './DrawerShell'

const QUICK_EMOJIS = ['👍', '👏', '❤️', '😂', '🎉', '🔥', '🙌', '💡']

const formatTime = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const ChatDrawer = ({ onClose, messages = [], onSendMessage, currentUserId, isHost, isChatLocked, onToggleChatLock }) => {
  const [text, setText] = useState('')
  const endRef = useRef(null)
  const locked = isChatLocked && !isHost

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const submit = (e) => {
    e?.preventDefault()
    if (!text.trim() || locked) return
    onSendMessage(text.trim())
    setText('')
  }

  const footer = (
    <div className="border-t border-[#3c4043] bg-[#202124] pb-safe">
      {!locked && (
        <div className="px-3 pt-2 flex items-center gap-1 overflow-x-auto">
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => setText((t) => t + emoji)} className="p-1 hover:bg-[#3c4043] rounded-lg text-base" aria-label={`Add ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="p-3">
        {locked ? (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-center text-xs text-[#f28b82] flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> The host has turned off chat for participants
          </div>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Send a message"
              aria-label="Message"
              className="flex-1 min-w-0 pl-4 pr-3 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-full text-base sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8]"
            />
            <button type="submit" disabled={!text.trim()} className="p-3 rounded-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] disabled:bg-[#3c4043]/50 disabled:text-gray-500" aria-label="Send message">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )

  return (
    <DrawerShell icon={MessageSquare} title="In-call messages" onClose={onClose} footer={footer}>
      {isHost && (
        <div className="px-5 py-3 bg-[#28292c] border-b border-[#3c4043] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Let everyone send messages</span>
          <button
            onClick={() => onToggleChatLock(!isChatLocked)}
            role="switch"
            aria-checked={!isChatLocked}
            className={`w-10 h-5 rounded-full relative ${!isChatLocked ? 'bg-[#8ab4f8]' : 'bg-gray-600'}`}
          >
            <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${!isChatLocked ? 'right-0.5' : 'left-0.5'}`} />
          </button>
        </div>
      )}
      <div className="px-5 py-3 bg-[#28292c]/60 border-b border-[#3c4043]/50 text-xs text-gray-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-[#8ab4f8] shrink-0 mt-0.5" />
        <p>Messages are visible to everyone in the call and are kept with this meeting for people who join later.</p>
      </div>
      <div className="px-4 sm:px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-gray-400 gap-2 py-12">
            <MessageSquare className="w-10 h-10 text-gray-600" />
            <p className="text-sm font-medium">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const mine = msg.authorId === currentUserId
            return (
              <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-300">{mine ? 'You' : msg.userName}</span>
                  <span className="text-[10px] text-gray-500">{formatTime(msg.createdAt)}</span>
                </div>
                <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${mine ? 'bg-[#8ab4f8]/20 border border-[#8ab4f8]/30 rounded-tr-sm' : 'bg-[#28292c] border border-[#3c4043] rounded-tl-sm'}`}>
                  <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>
    </DrawerShell>
  )
}
