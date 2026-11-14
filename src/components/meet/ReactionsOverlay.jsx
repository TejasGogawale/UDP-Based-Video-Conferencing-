import React from 'react'

export const ReactionsOverlay = ({ reactions = [] }) => (
  <div className="pointer-events-none absolute left-3 sm:left-6 bottom-16 sm:bottom-24 z-30 flex flex-col items-start gap-2 max-w-[70vw]">
    {reactions.map((rx) => (
      <div
        key={rx.id}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] rounded-full shadow-2xl"
        style={{ animation: 'vitFloatUp 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <span className="text-2xl">{rx.emoji}</span>
        <span className="text-xs font-semibold text-white truncate max-w-[120px]">{rx.userName}</span>
      </div>
    ))}
    <style>{`
      @keyframes vitFloatUp {
        0% { opacity: 0; transform: translateY(30px) scale(0.7); }
        15% { opacity: 1; transform: translateY(0) scale(1.05); }
        80% { opacity: 1; transform: translateY(-70px) scale(1); }
        100% { opacity: 0; transform: translateY(-110px) scale(0.9); }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes vitFloatUp { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
      }
    `}</style>
  </div>
)
