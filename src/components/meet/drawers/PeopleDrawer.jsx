import React, { useState } from 'react'
import {
  X,
  Users,
  Search,
  UserPlus,
  Mic,
  MicOff,
  Hand,
  Pin,
  MoreVertical,
  VolumeX,
  Shield,
  Crown
} from 'lucide-react'

export const PeopleDrawer = ({
  onClose,
  participants = [],
  currentUser,
  isHost,
  onMuteAll,
  onMuteUser,
  onPinUser,
  pinnedUserId,
  onAddPeople
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const allUsers = [
    {
      userId: currentUser?.sid || 'self',
      userName: currentUser?.name || 'You',
      isSelf: true,
      audioEnabled: currentUser?.audioEnabled !== false,
      videoEnabled: currentUser?.videoEnabled !== false,
      handRaised: currentUser?.handRaised || false,
      isHost: isHost
    },
    ...participants.map(p => ({
      ...p,
      isSelf: false
    }))
  ]

  const filteredUsers = allUsers.filter(u =>
    u.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const raisedHandsCount = allUsers.filter(u => u.handRaised).length

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">People ({allUsers.length})</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Host Action Bar / Add People */}
      <div className="px-6 py-4 border-b border-[#3c4043] space-y-3">
        <div className="flex gap-2">
          <button
            onClick={onAddPeople}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#28292c] hover:bg-[#3c4043] text-sm text-[#8ab4f8] font-medium rounded-full border border-[#3c4043] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add people
          </button>
          {isHost && (
            <button
              onClick={onMuteAll}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#ea4335]/15 hover:bg-[#ea4335]/25 text-sm text-[#f28b82] font-medium rounded-full border border-[#ea4335]/30 transition-colors"
              title="Mute everyone in the call"
            >
              <VolumeX className="w-4 h-4" />
              Mute all
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for people"
            className="w-full pl-10 pr-4 py-2 bg-[#28292c] border border-[#3c4043] rounded-full text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8] transition-colors"
          />
        </div>
      </div>

      {/* Raised Hands Highlight (if any) */}
      {raisedHandsCount > 0 && (
        <div className="px-6 py-2.5 bg-[#fbbc04]/10 border-b border-[#fbbc04]/20 flex items-center justify-between text-xs text-[#fbbc04]">
          <div className="flex items-center gap-1.5 font-medium">
            <Hand className="w-4 h-4" />
            {raisedHandsCount} {raisedHandsCount === 1 ? 'hand raised' : 'hands raised'}
          </div>
        </div>
      )}

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 divide-y divide-[#3c4043]/40">
        <div className="pb-2">
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            In call ({filteredUsers.length})
          </p>
        </div>

        {filteredUsers.map((user) => {
          const isPinned = pinnedUserId === user.userId

          return (
            <div
              key={user.userId}
              className="flex items-center justify-between px-2 py-2.5 hover:bg-[#28292c] rounded-xl transition-colors group"
            >
              {/* Left: Avatar & Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                  {user.userName ? user.userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate">
                      {user.userName} {user.isSelf && '(You)'}
                    </p>
                    {user.isHost && (
                      <span className="p-0.5 bg-blue-900/60 rounded text-[10px] text-[#8ab4f8] font-bold px-1.5 border border-blue-700/50 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" /> Host
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {user.handRaised ? (
                      <span className="text-[#fbbc04] font-medium flex items-center gap-1">
                        <Hand className="w-3 h-3" /> Hand raised
                      </span>
                    ) : (
                      user.isSelf ? 'Meeting Participant' : 'Joined'
                    )}
                  </p>
                </div>
              </div>

              {/* Right: Controls & Mic indicator */}
              <div className="flex items-center gap-1 text-gray-400">
                {/* Pin button */}
                <button
                  onClick={() => onPinUser && onPinUser(isPinned ? null : user.userId)}
                  className={`p-1.5 rounded-full hover:text-white hover:bg-[#3c4043] transition-colors ${
                    isPinned ? 'text-[#8ab4f8]' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title={isPinned ? 'Unpin' : 'Pin to screen'}
                >
                  <Pin className="w-4 h-4" />
                </button>

                {/* Mic Status */}
                <div
                  className={`p-1.5 rounded-full ${
                    user.audioEnabled ? 'text-gray-300' : 'text-[#f28b82] bg-red-950/30'
                  }`}
                  title={user.audioEnabled ? 'Microphone on' : 'Microphone muted'}
                >
                  {user.audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </div>

                {/* Host actions on other users */}
                {isHost && !user.isSelf && (
                  <button
                    onClick={() => onMuteUser && onMuteUser(user.userId)}
                    className="p-1.5 rounded-full hover:text-[#f28b82] hover:bg-[#3c4043] opacity-0 group-hover:opacity-100 transition-colors"
                    title="Mute user"
                  >
                    <VolumeX className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
