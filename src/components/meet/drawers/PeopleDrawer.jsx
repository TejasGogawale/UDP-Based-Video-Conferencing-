import React, { useState } from 'react'
import { Users, Search, Mic, MicOff, Video, VideoOff, Hand, Pin, VolumeX, UserX, Crown, Monitor, WifiOff, UserPlus } from 'lucide-react'
import { DrawerShell } from './DrawerShell'
import { InvitePanel } from './InvitePanel'

export const PeopleDrawer = ({
  onClose,
  people = [], // [{ id, name, isSelf, isOwnerHost, audioOn, videoOn, handRaised, isPresenting, connection }]
  isHost,
  meetingId,
  pinnedId,
  onPin,
  onMuteUser,
  onRemoveUser,
  onMuteAll
}) => {
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  const raised = people.filter((p) => p.handRaised)

  return (
    <DrawerShell icon={Users} title={`People (${people.length})`} onClose={onClose}>
      <div className="px-4 sm:px-5 py-4 space-y-3 border-b border-[#3c4043]">
        <div className="flex gap-2">
          <button
            onClick={() => setShowInvite((v) => !v)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-full border ${showInvite ? 'bg-[#8ab4f8]/20 border-[#8ab4f8] text-[#8ab4f8]' : 'bg-[#28292c] border-[#3c4043] text-[#8ab4f8] hover:bg-[#3c4043]'}`}
          >
            <UserPlus className="w-4 h-4" /> Add people
          </button>
          {isHost && people.length > 1 && (
            <button onClick={onMuteAll} className="flex items-center gap-1.5 px-3 py-2 bg-[#ea4335]/15 hover:bg-[#ea4335]/25 text-sm text-[#f28b82] font-medium rounded-full border border-[#ea4335]/30">
              <VolumeX className="w-4 h-4" /> Mute all
            </button>
          )}
        </div>
        {showInvite && <InvitePanel meetingId={meetingId} />}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for people"
            aria-label="Search for people"
            className="w-full pl-10 pr-4 py-2 bg-[#28292c] border border-[#3c4043] rounded-full text-base sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8]"
          />
        </div>
      </div>

      {raised.length > 0 && (
        <div className="px-5 py-2.5 bg-[#fbbc04]/10 border-b border-[#fbbc04]/20 text-xs text-[#fbbc04] flex items-center gap-1.5">
          <Hand className="w-4 h-4" /> {raised.map((p) => (p.isSelf ? 'You' : p.name)).join(', ')} raised {raised.length === 1 ? 'a hand' : 'hands'}
        </div>
      )}

      <div className="px-2 sm:px-3 py-3">
        <p className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">In call ({filtered.length})</p>
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-[#28292c] rounded-xl group">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-semibold shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{p.name}{p.isSelf ? ' (You)' : ''}</p>
                  {p.isOwnerHost && (
                    <span className="px-1.5 py-0.5 bg-blue-900/60 rounded text-[10px] text-[#8ab4f8] font-bold border border-blue-700/50 flex items-center gap-0.5 shrink-0">
                      <Crown className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  {p.isPresenting ? <><Monitor className="w-3 h-3 text-[#8ab4f8]" /> Presenting</>
                    : p.handRaised ? <><Hand className="w-3 h-3 text-[#fbbc04]" /> Hand raised</>
                      : !p.isSelf && p.connection === 'failed' ? <><WifiOff className="w-3 h-3 text-[#f28b82]" /> Media not connected</>
                        : !p.isSelf && p.connection !== 'connected' ? 'Connecting…'
                          : 'In call'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-gray-400 shrink-0">
              <button
                onClick={() => onPin(pinnedId === p.id ? null : p.id)}
                className={`p-1.5 rounded-full hover:text-white hover:bg-[#3c4043] ${pinnedId === p.id ? 'text-[#8ab4f8]' : 'sm:opacity-0 sm:group-hover:opacity-100'}`}
                aria-label={pinnedId === p.id ? `Unpin ${p.name}` : `Pin ${p.name}`}
              >
                <Pin className="w-4 h-4" />
              </button>
              <span className="p-1.5" title={p.videoOn ? 'Camera on' : 'Camera off'}>
                {p.videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-gray-500" />}
              </span>
              <span className={`p-1.5 ${p.audioOn ? 'text-gray-300' : 'text-[#f28b82]'}`} title={p.audioOn ? 'Microphone on' : 'Muted'}>
                {p.audioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </span>
              {isHost && !p.isSelf && (
                <>
                  <button onClick={() => onMuteUser(p.id)} disabled={!p.audioOn} className="p-1.5 rounded-full hover:text-[#f28b82] hover:bg-[#3c4043] disabled:opacity-30" aria-label={`Mute ${p.name}`}>
                    <VolumeX className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmRemove(p)} className="p-1.5 rounded-full hover:text-[#f28b82] hover:bg-[#3c4043]" aria-label={`Remove ${p.name}`}>
                    <UserX className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmRemove && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmRemove(null)}>
          <div className="bg-[#28292c] rounded-2xl p-5 max-w-sm w-full space-y-4 border border-[#3c4043]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="text-sm">Remove <strong>{confirmRemove.name}</strong> from the meeting?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 text-sm rounded-full hover:bg-[#3c4043]">Cancel</button>
              <button onClick={() => { onRemoveUser(confirmRemove.id); setConfirmRemove(null) }} className="px-4 py-2 text-sm rounded-full bg-[#ea4335] hover:bg-[#d93025] font-semibold">Remove</button>
            </div>
          </div>
        </div>
      )}
    </DrawerShell>
  )
}
