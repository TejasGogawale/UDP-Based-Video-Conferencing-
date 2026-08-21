import React, { useState } from 'react'
import { X, Copy, Check, Info, Paperclip, ShieldCheck, Link2 } from 'lucide-react'

export const MeetingDetailsDrawer = ({ onClose, meetingCode, meetingTitle }) => {
  const [copied, setCopied] = useState(false)
  const fullLink = `${window.location.origin}/conference/${meetingCode}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedCode = meetingCode
    ? `${meetingCode.slice(0, 3)}-${meetingCode.slice(3, 7)}-${meetingCode.slice(7, 10)}`
    : 'abc-defg-hij'

  return (
    <div className="w-80 md:w-96 bg-[#202124] text-white flex flex-col h-full border-l border-[#3c4043] shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-[#8ab4f8]" />
          <h2 className="text-lg font-medium text-white">Meeting details</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Title */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">
            Meeting Name
          </h3>
          <p className="text-base font-medium text-white">{meetingTitle || 'VIT Connect Conference'}</p>
        </div>

        {/* Joining Info */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Joining info
          </h3>
          <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] space-y-2">
            <p className="text-xs text-gray-300 break-all font-mono">{fullLink}</p>
            <div className="flex items-center justify-between pt-1 border-t border-[#3c4043]/60">
              <span className="text-xs text-gray-400">Meeting code: <span className="text-white font-mono">{formattedCode}</span></span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] text-xs font-semibold rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-800" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy info'}
              </button>
            </div>
          </div>
        </div>

        {/* Security / Encryption Badge */}
        <div className="p-4 bg-[#1e293b]/50 border border-blue-900/40 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#8ab4f8] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-white">Encrypted in transit</p>
            <p className="text-gray-400 leading-relaxed">
              Your audio, video, and screen sharing streams are securely encrypted peer-to-peer over DTLS-SRTP.
            </p>
          </div>
        </div>

        {/* Attachments Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Attachments
          </h3>
          <div className="py-6 px-4 border border-dashed border-[#3c4043] rounded-xl text-center">
            <p className="text-xs text-gray-400">Attachments from calendar schedules or shared files will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}
