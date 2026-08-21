import React, { useState } from 'react'
import {
  X,
  BarChart2,
  Plus,
  Trash2,
  CheckCircle,
  Vote,
  StopCircle
} from 'lucide-react'

export const PollsModal = ({
  onClose,
  polls = [],
  onCreatePoll,
  onVotePoll,
  onEndPoll,
  currentUser,
  isHost
}) => {
  const [isCreating, setIsCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ''])
    }
  }

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index, value) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    const validOptions = options.map(o => o.trim()).filter(Boolean)
    if (!question.trim() || validOptions.length < 2) return

    onCreatePoll({
      id: `poll_${Date.now()}`,
      question: question.trim(),
      options: validOptions,
      creator: currentUser?.name || 'Host'
    })

    setQuestion('')
    setOptions(['', ''])
    setIsCreating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202124] text-white w-full max-w-lg rounded-2xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-5 h-5 text-[#8ab4f8]" />
            <h2 className="text-lg font-medium text-white">Polls</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Create Poll Form (if toggled) */}
          {isCreating ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4 bg-[#28292c] p-4 rounded-xl border border-[#3c4043]">
              <h3 className="text-sm font-semibold text-white">Create a new poll</h3>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Question</label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full px-3.5 py-2.5 bg-[#202124] border border-[#3c4043] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 block">Options</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 px-3.5 py-2 bg-[#202124] border border-[#3c4043] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8]"
                      required
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-2 text-gray-400 hover:text-red-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1 font-medium pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another option
                </button>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#3c4043]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-[#3c4043]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] rounded-lg"
                >
                  Launch Poll
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-3 bg-[#28292c] hover:bg-[#3c4043] border border-dashed border-[#3c4043] hover:border-[#8ab4f8] rounded-xl text-sm font-medium text-[#8ab4f8] flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start a poll
            </button>
          )}

          {/* Active Polls List */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Live & Past Polls ({polls.length})
            </h3>

            {polls.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No polls created in this meeting yet</p>
            ) : (
              polls.map((poll) => {
                const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0)
                const userVote = poll.votedUsers?.[currentUser?.sid]

                return (
                  <div
                    key={poll.id}
                    className="p-4 bg-[#28292c] border border-[#3c4043] rounded-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${
                          poll.isActive ? 'bg-green-950/60 text-green-400 border border-green-800/40' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {poll.isActive ? 'LIVE' : 'ENDED'}
                        </span>
                        <h4 className="text-sm font-semibold text-white">{poll.question}</h4>
                        <p className="text-[11px] text-gray-400">Created by {poll.creator} • {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>
                      </div>

                      {isHost && poll.isActive && (
                        <button
                          onClick={() => onEndPoll && onEndPoll(poll.id)}
                          className="px-2.5 py-1 bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-900/30 rounded-lg text-xs font-medium flex items-center gap-1"
                        >
                          <StopCircle className="w-3.5 h-3.5" /> End
                        </button>
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-2 pt-1">
                      {poll.options.map((opt, idx) => {
                        const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0
                        const isVoted = userVote === idx

                        return (
                          <div key={idx} className="space-y-1">
                            <button
                              disabled={!poll.isActive}
                              onClick={() => onVotePoll && onVotePoll(poll.id, idx)}
                              className={`w-full p-2.5 rounded-xl text-left text-xs font-medium border flex items-center justify-between transition-all relative overflow-hidden ${
                                isVoted
                                  ? 'border-[#8ab4f8] bg-[#8ab4f8]/15 text-white'
                                  : 'border-[#3c4043] bg-[#202124] text-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {/* Background vote progress bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-[#8ab4f8]/20 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              <span className="relative z-10 font-medium flex items-center gap-2">
                                {isVoted && <CheckCircle className="w-3.5 h-3.5 text-[#8ab4f8]" />}
                                {opt.text}
                              </span>
                              <span className="relative z-10 text-gray-400 font-mono text-[11px]">
                                {pct}% ({opt.votes || 0})
                              </span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
