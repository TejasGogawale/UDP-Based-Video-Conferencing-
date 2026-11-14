import React from 'react'
import { ClosedCaption, AlertTriangle } from 'lucide-react'

/**
 * Caption overlay. Sits above the control dock (inside the stage), so it never
 * covers the controls. Each line is one speaker's utterance; interim text
 * updates in place.
 */
export const LiveCaptions = ({ lines = [], isVisible, error }) => {
  if (!isVisible) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 sm:bottom-5 z-30 flex justify-center px-3">
      <div className="w-full max-w-3xl space-y-1.5" aria-live="polite">
        {error && (
          <div className="mx-auto w-fit max-w-full flex items-start gap-2 px-3 py-2 rounded-xl bg-[#202124]/95 text-xs text-[#fbbc04] border border-[#fbbc04]/30">
            <AlertTriangle className="w-4 h-4 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {lines.length === 0 && !error && (
          <div className="mx-auto w-fit flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202124]/80 text-xs text-gray-300">
            <ClosedCaption className="w-4 h-4" /> Captions are on. Waiting for someone to speak…
          </div>
        )}
        {lines.map((line) => (
          <div key={line.id} className="bg-black/75 rounded-xl px-3 py-2 text-sm sm:text-base leading-snug text-white">
            <span className="font-semibold text-[#8ab4f8] mr-2">{line.userName}</span>
            <span className={line.isFinal ? '' : 'text-gray-200'}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
