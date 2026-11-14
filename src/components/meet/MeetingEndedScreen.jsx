import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Home, Star, CheckCircle, Video } from 'lucide-react'

export const MeetingEndedScreen = ({ reason = 'You left the meeting.', canRejoin = true, onRejoin, elapsedSeconds = 0 }) => {
  const navigate = useNavigate()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60

  return (
    <div className="h-app overflow-y-auto bg-[#202124] text-white flex flex-col items-center justify-center p-6 pt-safe pb-safe">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="w-16 h-16 rounded-full bg-[#3c4043] flex items-center justify-center mx-auto text-[#8ab4f8]">
          <Video className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-normal">{reason}</h1>
          {elapsedSeconds > 0 && (
            <p className="text-xs text-gray-400">Time in call: {minutes} min {seconds} sec</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {canRejoin && (
            <button onClick={onRejoin} className="w-full sm:w-auto px-6 py-3 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-semibold text-sm rounded-full flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Rejoin
            </button>
          )}
          <button onClick={() => navigate('/dashboard')} className="w-full sm:w-auto px-6 py-3 bg-[#3c4043] hover:bg-[#4a4e52] text-white font-medium text-sm rounded-full flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Return to home screen
          </button>
        </div>
        <div className="pt-6 border-t border-[#3c4043] space-y-3">
          {rating ? (
            <p className="text-xs text-green-400 flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Thanks for the feedback.</p>
          ) : (
            <>
              <p className="text-xs text-gray-400">How was the audio and video quality?</p>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} className="p-1.5" aria-label={`${star} star${star > 1 ? 's' : ''}`}>
                    <Star className={`w-6 h-6 ${hover >= star ? 'text-[#fbbc04] fill-[#fbbc04]' : 'text-gray-600'}`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
