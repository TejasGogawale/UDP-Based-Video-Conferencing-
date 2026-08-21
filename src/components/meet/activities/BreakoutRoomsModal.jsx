import React, { useState } from 'react'
import {
  X,
  Users2,
  Shuffle,
  Clock,
  Play,
  RotateCcw
} from 'lucide-react'

export const BreakoutRoomsModal = ({
  onClose,
  participants = [],
  currentUser,
  isHost
}) => {
  const [numRooms, setNumRooms] = useState(2)
  const [timerMinutes, setTimerMinutes] = useState(10)
  const [rooms, setRooms] = useState([])
  const [isActive, setIsActive] = useState(false)

  const allAttendees = [
    { userId: currentUser?.sid || 'self', userName: `${currentUser?.name || 'You'} (Host)` },
    ...participants
  ]

  const handleShuffle = () => {
    const shuffled = [...allAttendees].sort(() => 0.5 - Math.random())
    const newRooms = Array.from({ length: numRooms }, (_, i) => ({
      id: i + 1,
      name: `Breakout Room ${i + 1}`,
      members: []
    }))

    shuffled.forEach((user, index) => {
      const roomIdx = index % numRooms
      newRooms[roomIdx].members.push(user)
    })

    setRooms(newRooms)
  }

  const handleStartBreakouts = () => {
    if (rooms.length === 0) handleShuffle()
    setIsActive(true)
  }

  const handleEndBreakouts = () => {
    setIsActive(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202124] text-white w-full max-w-lg rounded-2xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-2.5">
            <Users2 className="w-5 h-5 text-[#8ab4f8]" />
            <h2 className="text-lg font-medium text-white">Breakout rooms</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Number of rooms</label>
              <select
                value={numRooms}
                onChange={(e) => {
                  setNumRooms(Number(e.target.value))
                  setRooms([])
                }}
                disabled={isActive}
                className="w-full px-3 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-sm text-white focus:outline-none focus:border-[#8ab4f8]"
              >
                {[2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} rooms</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Timer (minutes)</label>
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                disabled={isActive}
                className="w-full px-3 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-sm text-white focus:outline-none focus:border-[#8ab4f8]"
              >
                {[5, 10, 15, 20, 30].map(m => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={handleShuffle}
              disabled={isActive}
              className="text-xs text-[#8ab4f8] hover:underline font-medium flex items-center gap-1.5"
            >
              <Shuffle className="w-4 h-4" /> Shuffle participants
            </button>
            <span className="text-xs text-gray-400">{allAttendees.length} participants in total</span>
          </div>

          {/* Rooms Grid */}
          <div className="space-y-3">
            {(rooms.length > 0 ? rooms : Array.from({ length: numRooms }, (_, i) => ({
              id: i + 1,
              name: `Breakout Room ${i + 1}`,
              members: []
            }))).map((room) => (
              <div key={room.id} className="p-3.5 bg-[#28292c] border border-[#3c4043] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>{room.name}</span>
                  <span className="text-gray-400">{room.members.length} people</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {room.members.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">Click shuffle to assign members</span>
                  ) : (
                    room.members.map((m, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-[#202124] border border-[#3c4043] rounded-full text-[11px] text-gray-300">
                        {m.userName}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3c4043] bg-[#28292c] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-[#3c4043]"
          >
            Close
          </button>
          {isActive ? (
            <button
              onClick={handleEndBreakouts}
              className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              End breakout rooms
            </button>
          ) : (
            <button
              onClick={handleStartBreakouts}
              className="px-4 py-2 text-xs font-semibold bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] rounded-lg flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Open rooms
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
