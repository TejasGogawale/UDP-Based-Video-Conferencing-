import React from 'react'

export const ReactionsOverlay = ({ reactions = [] }) => {
  return (
    <div className="fixed bottom-24 left-8 z-40 pointer-events-none flex flex-col items-start gap-2 max-w-sm">
      {reactions.map((rx) => (
        <div
          key={rx.id}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#202124]/90 backdrop-blur-md border border-[#3c4043] rounded-full shadow-2xl animate-float-up"
          style={{
            animation: 'floatUp 3s cubic-bezier(0.22, 1, 0.36, 1) forwards'
          }}
        >
          <span className="text-2xl animate-bounce">{rx.emoji}</span>
          <span className="text-xs font-semibold text-white truncate max-w-[120px]">
            {rx.userName}
          </span>
        </div>
      ))}

      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translateY(0) scale(1.1);
          }
          80% {
            opacity: 1;
            transform: translateY(-80px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-130px) scale(0.85);
          }
        }
      `}</style>
    </div>
  )
}
