import React from 'react'
import { ClosedCaption } from 'lucide-react'

export const LiveCaptions = ({ captions = [], isVisible = false }) => {
  if (!isVisible || captions.length === 0) return null

  // Show the last 2-3 active caption lines
  const activeCaptions = captions.slice(-3)

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] pointer-events-none">
      <div className="bg-[#202124]/90 backdrop-blur-md border border-[#3c4043]/80 rounded-2xl p-4 shadow-2xl space-y-2 text-center">
        {activeCaptions.map((cap, index) => (
          <div key={index} className="text-sm font-medium leading-relaxed transition-all">
            <span className="font-semibold text-[#8ab4f8] mr-2">
              {cap.userName}:
            </span>
            <span className="text-white">
              {cap.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
