import React, { useState } from 'react'
import { Copy, Check, Info, ShieldCheck, AlertTriangle } from 'lucide-react'
import { DrawerShell } from './DrawerShell'
import { InvitePanel } from './InvitePanel'
import { formatMeetingCode, meetingLink } from '../../../lib/meetingCode'

export const MeetingDetailsDrawer = ({ onClose, meeting, meetingCode, hostName, participantCount }) => {
  const [copied, setCopied] = useState(false)
  const link = meetingLink(meetingCode)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Join "${meeting?.title || 'VIT Connect meeting'}" on VIT Connect: ${link}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <DrawerShell icon={Info} title="Meeting details" onClose={onClose}>
      <div className="px-4 sm:px-5 py-5 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Meeting</h3>
          <p className="text-base font-medium">{meeting?.title || 'VIT Connect meeting'}</p>
          {meeting?.description && <p className="text-sm text-gray-400 mt-1">{meeting.description}</p>}
          <p className="text-xs text-gray-400 mt-2">
            Host: {hostName || meeting?.creator_name || 'Unknown'} · {participantCount} in call
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Joining info</h3>
          <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] space-y-2">
            <p className="text-xs text-gray-200 break-all font-mono select-all">{link}</p>
            <div className="flex items-center justify-between pt-2 border-t border-[#3c4043]/60 gap-2">
              <span className="text-xs text-gray-400">Code: <span className="text-white font-mono">{formatMeetingCode(meetingCode)}</span></span>
              <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] text-xs font-semibold rounded-lg">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy joining info'}
              </button>
            </div>
          </div>
        </div>

        {meeting?.id && <InvitePanel meetingId={meeting.id} />}

        <div className="p-4 bg-[#1e293b]/50 border border-blue-900/40 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#8ab4f8] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed">
            Audio, video and screen sharing go directly between participants' browsers and are encrypted with DTLS-SRTP.
            Chat goes through the server and is saved with the meeting.
          </p>
        </div>

        <div className="p-4 bg-[#28292c] border border-[#3c4043] rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#fbbc04] shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed">
            Every participant sends video to every other participant (mesh). Calls work best with up to about 6 people with cameras on.
          </p>
        </div>
      </div>
    </DrawerShell>
  )
}
