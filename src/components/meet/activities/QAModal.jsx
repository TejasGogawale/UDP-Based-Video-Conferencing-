import React, { useState } from 'react'
import {
  X,
  HelpCircle,
  ThumbsUp,
  CheckCircle,
  Plus,
  Send,
  Trash2,
  Filter
} from 'lucide-react'

export const QAModal = ({
  onClose,
  qas = [],
  onSubmitQA,
  onUpvoteQA,
  onAnswerQA,
  currentUser,
  isHost
}) => {
  const [questionText, setQuestionText] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'unanswered' | 'answered'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!questionText.trim()) return

    onSubmitQA({
      id: `qa_${Date.now()}`,
      question: questionText.trim(),
      userName: currentUser?.name || 'Participant'
    })
    setQuestionText('')
  }

  const filteredQAs = qas
    .filter(q => {
      if (filter === 'answered') return q.isAnswered
      if (filter === 'unanswered') return !q.isAnswered
      return true
    })
    .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202124] text-white w-full max-w-lg rounded-2xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#8ab4f8]" />
            <h2 className="text-lg font-medium text-white">Q&A</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-[#3c4043] flex items-center gap-2 bg-[#28292c]">
          <span className="text-xs text-gray-400 mr-1">Filter:</span>
          {['all', 'unanswered', 'answered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-[#8ab4f8] text-[#202124] font-semibold'
                  : 'bg-[#3c4043]/50 text-gray-300 hover:bg-[#3c4043]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Questions Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredQAs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">
              No questions found. Be the first to ask a question!
            </div>
          ) : (
            filteredQAs.map((item) => {
              const isUpvoted = item.upvotedBy?.includes(currentUser?.sid)

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    item.isAnswered
                      ? 'bg-[#28292c]/50 border-green-900/30'
                      : 'bg-[#28292c] border-[#3c4043]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-300">{item.author}</span>
                        <span className="text-[10px] text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                        {item.isAnswered && (
                          <span className="px-2 py-0.5 bg-green-950/60 text-green-400 border border-green-800/40 rounded text-[10px] font-bold flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Answered
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white leading-relaxed">{item.question}</p>
                    </div>

                    {/* Upvote Button */}
                    <button
                      onClick={() => onUpvoteQA && onUpvoteQA(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                        isUpvoted
                          ? 'bg-[#8ab4f8]/20 border-[#8ab4f8] text-[#8ab4f8]'
                          : 'bg-[#202124] border-[#3c4043] text-gray-400 hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{item.upvotes || 0}</span>
                    </button>
                  </div>

                  {/* Host Action */}
                  {isHost && (
                    <div className="flex justify-end pt-3 mt-3 border-t border-[#3c4043]/50">
                      <button
                        onClick={() => onAnswerQA && onAnswerQA(item.id, !item.isAnswered)}
                        className="text-xs text-[#8ab4f8] hover:underline font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {item.isAnswered ? 'Mark unanswered' : 'Mark as answered'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[#3c4043] bg-[#202124] flex items-center gap-2">
          <input
            type="text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a question anonymously or publicly"
            className="flex-1 px-4 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-full text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8]"
          />
          <button
            type="submit"
            disabled={!questionText.trim()}
            className={`p-2.5 rounded-full transition-all ${
              questionText.trim()
                ? 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124]'
                : 'bg-[#3c4043]/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
