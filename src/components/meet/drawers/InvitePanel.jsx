import React, { useState } from 'react'
import axios from 'axios'
import { Mail, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { API_ENDPOINTS } from '../../../config/api'

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const STATUS = {
  sent: { icon: CheckCircle2, color: 'text-[#81c995]', label: 'Sent' },
  failed: { icon: XCircle, color: 'text-[#f28b82]', label: 'Failed' },
  already_invited: { icon: MinusCircle, color: 'text-gray-400', label: 'Already invited' },
  skipped_self: { icon: MinusCircle, color: 'text-gray-400', label: "That's you" }
}

/** Email invitations. Shows exactly what the server reports for each address. */
export const InvitePanel = ({ meetingId }) => {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const emails = [...new Set(input.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
  const invalid = emails.filter((e) => !EMAIL_RE.test(e))

  const send = async (resend = false) => {
    setError('')
    setResult(null)
    if (!emails.length || invalid.length) {
      setError(invalid.length ? `Not a valid email: ${invalid.join(', ')}` : 'Enter at least one email address.')
      return
    }
    setSending(true)
    try {
      const res = await axios.post(API_ENDPOINTS.meetings.invite(meetingId), { emails, resend }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setResult(res.data)
      if (res.status === 200 && res.data.failed === 0) setInput('')
    } catch (err) {
      const data = err.response?.data
      if (data?.results) setResult(data)
      setError(data?.error || 'Could not reach the server to send invitations.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="invite-emails" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Invite by email</label>
      <textarea
        id="invite-emails"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        placeholder="name@example.com, another@example.com"
        className="w-full px-3 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8] resize-none"
      />
      <button
        onClick={() => send(false)}
        disabled={sending || !emails.length}
        className="w-full py-2.5 bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:opacity-50 text-[#202124] text-sm font-semibold rounded-full flex items-center justify-center gap-2"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
        {sending ? 'Sending…' : `Send invitation${emails.length > 1 ? 's' : ''}`}
      </button>

      {error && <p className="text-xs text-[#f28b82]" role="alert">{error}</p>}

      {result?.results?.length > 0 && (
        <div className="p-3 bg-[#28292c] rounded-xl border border-[#3c4043] space-y-1.5">
          {result.message && <p className="text-xs text-gray-200">{result.message}</p>}
          {result.results.map((r) => {
            const s = STATUS[r.status] || STATUS.failed
            const Icon = s.icon
            return (
              <div key={r.email} className="text-xs">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${s.color}`} />
                  <span className="truncate flex-1">{r.email}</span>
                  <span className={s.color}>{s.label}</span>
                </div>
                {r.error && <p className="pl-5 text-[11px] text-gray-400">{r.error}</p>}
              </div>
            )
          })}
          {result.results.some((r) => r.status === 'already_invited') && (
            <button onClick={() => send(true)} className="text-[11px] text-[#8ab4f8] hover:underline">Send again to everyone listed</button>
          )}
        </div>
      )}
    </div>
  )
}
