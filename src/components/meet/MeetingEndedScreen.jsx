import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RotateCcw,
  Home,
  Star,
  CheckCircle,
  MessageSquareHeart,
  Video
} from 'lucide-react'

export const MeetingEndedScreen = ({
  onRejoin,
  meetingCode,
  elapsedDuration = 0
}) => {
  const navigate = useNavigate()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} min ${secs} sec`
  }

  const handleRate = (star) => {
    setRating(star)
    setFeedbackSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-[#202124] text-white flex flex-col items-center justify-center p-6 antialiased">
      <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-95 duration-200">
        {/* Camera Icon Header */}
        <div className="w-16 h-16 rounded-full bg-[#3c4043] flex items-center justify-center mx-auto shadow-xl text-[#8ab4f8]">
          <Video className="w-8 h-8" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-normal text-white">You left the meeting</h1>
          {elapsedDuration > 0 && (
            <p className="text-xs text-gray-400">
              Meeting duration: {formatDuration(elapsedDuration)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onRejoin}
            className="w-full sm:w-auto px-6 py-3 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-semibold text-xs rounded-full flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            Rejoin
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-6 py-3 bg-[#3c4043] hover:bg-[#4a4e52] text-white font-medium text-xs rounded-full flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to home screen
          </button>
        </div>

        {/* Star Rating Widget */}
        <div className="pt-6 border-t border-[#3c4043] space-y-3">
          {feedbackSubmitted ? (
            <div className="p-3 bg-[#28292c] rounded-xl border border-green-800/40 text-xs text-green-400 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Thank you for helping us improve VIT Connect!
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">How was the audio and video quality?</p>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        (hoverRating || rating) >= star
                          ? 'text-[#fbbc04] fill-[#fbbc04]'
                          : 'text-gray-600'
                      }`}
                    />
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
