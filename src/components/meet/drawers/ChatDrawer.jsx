import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  MessageSquare,
  Send,
  Lock,
  Smile,
  Info,
  Pin
} from 'lucide-react'

export const ChatDrawer = ({
  onClose,
  messages = [],
  onSendMessage,
  currentUser,
  isHost,
  isChatLocked,
  onToggleChatLock
}) => {
  const [inputText, setInputText] = useState('')
  const [showEmojis, setShowEmojis] = useState(false)
  const messagesEndRef = useRef(null)

  const quickEmojis = ['👍', '👏', '❤️', '😂', '🎉', '🔥', '🙌', '💡']

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!inputText.trim() || isChatLocked) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const addEmoji = (emoji) => {
    setInputText(prev => prev + emoji)
  }

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">In-call messages</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Host Settings Banner (if host) */}
      {isHost && (
        <div className="px-6 py-3 bg-[#28292c] border-b border-[#3c4043] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Let everyone send messages</span>
          <button
            onClick={() => onToggleChatLock && onToggleChatLock(!isChatLocked)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              !isChatLocked ? 'bg-[#8ab4f8]' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                !isChatLocked ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      )}

      {/* Notice Banner */}
      <div className="px-6 py-3 bg-[#28292c]/60 border-b border-[#3c4043]/50 text-xs text-gray-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-[#8ab4f8] shrink-0 mt-0.5" />
        <p>Messages can only be seen by people in the call and are deleted when the call ends.</p>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2 py-12">
            <MessageSquare className="w-10 h-10 text-gray-600 stroke-[1.5]" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-gray-500 max-w-[200px]">Send a message to everyone in this call</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.userId === currentUser?.sid || msg.authorId === currentUser?.id

            return (
              <div key={msg.id || index} className="space-y-1 group">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-gray-300">
                    {isSelf ? 'You' : msg.userName || msg.author_name || 'Participant'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  isSelf
                    ? 'bg-[#8ab4f8]/20 text-[#e8eaed] rounded-tr-none border border-[#8ab4f8]/30'
                    : 'bg-[#28292c] text-white rounded-tl-none border border-[#3c4043]'
                }`}>
                  <p className="break-words whitespace-pre-wrap">{msg.message || msg.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-4 py-2 border-t border-[#3c4043]/50 flex items-center gap-1.5 overflow-x-auto">
        {quickEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => addEmoji(emoji)}
            className="p-1 hover:bg-[#3c4043] rounded-lg text-base transition-transform hover:scale-125"
            title={`Add ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-[#3c4043] bg-[#202124]">
        {isChatLocked ? (
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-center text-xs text-[#f28b82] flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Chat has been locked by the host
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message to everyone"
                className="w-full pl-4 pr-10 py-3 bg-[#28292c] border border-[#3c4043] rounded-full text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`p-3 rounded-full transition-all ${
                inputText.trim()
                  ? 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124]'
                  : 'bg-[#3c4043]/50 text-gray-500 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
