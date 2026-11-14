import React from 'react'
import { X } from 'lucide-react'

/** Common panel frame: full width on phones, fixed width beside the stage on larger screens. */
export const DrawerShell = ({ icon: Icon, title, onClose, children, footer }) => (
  <div className="w-full h-full bg-[#202124] text-white flex flex-col sm:border-l border-[#3c4043]">
    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#3c4043] pt-[max(0.875rem,env(safe-area-inset-top))] sm:pt-3.5">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-5 h-5 text-[#8ab4f8] shrink-0" />}
        <h2 className="text-base sm:text-lg font-medium truncate">{title}</h2>
      </div>
      <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full" aria-label="Close panel">
        <X className="w-5 h-5" />
      </button>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    {footer}
  </div>
)
