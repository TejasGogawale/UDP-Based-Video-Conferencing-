import React, { useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  Users,
  Copy,
  Check,
  Plus,
  Mail,
  ExternalLink,
  Download,
  AlertCircle,
  Video,
  Send,
  Sparkles
} from 'lucide-react'
import axios from 'axios'
import { API_ENDPOINTS } from '../../config/api'

export const ScheduleModal = ({ onClose, onScheduleSuccess }) => {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [description, setDescription] = useState('')
  const [guestInput, setGuestInput] = useState('')
  const [guestEmails, setGuestEmails] = useState([])
  const [sendEmail, setSendEmail] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Result state after scheduling
  const [scheduledResult, setScheduledResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const validateEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())
  }

  const handleAddGuest = (e) => {
    if (e) e.preventDefault()
    const trimmed = guestInput.trim().toLowerCase()
    if (!trimmed) return

    if (!validateEmail(trimmed)) {
      setError('Please enter a valid email address (e.g. colleague@example.com)')
      return
    }

    if (guestEmails.includes(trimmed)) {
      setError('This email has already been added to the guest list')
      return
    }

    setGuestEmails([...guestEmails, trimmed])
    setGuestInput('')
    setError('')
  }

  const handleRemoveGuest = (emailToRemove) => {
    setGuestEmails(guestEmails.filter(e => e !== emailToRemove))
  }

  const handleKeyDownGuest = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddGuest()
    }
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Meeting title is required')
      return
    }

    setError('')
    setLoading(true)

    // Include any typed guest in input box
    let finalGuests = [...guestEmails]
    if (guestInput.trim() && validateEmail(guestInput.trim())) {
      const trimmed = guestInput.trim().toLowerCase()
      if (!finalGuests.includes(trimmed)) {
        finalGuests.push(trimmed)
      }
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        API_ENDPOINTS.meetings.schedule,
        {
          title: title.trim(),
          date,
          start_time: startTime,
          end_time: endTime,
          description: description.trim(),
          guest_emails: finalGuests,
          send_email: sendEmail
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      setScheduledResult(response.data)
      if (onScheduleSuccess) {
        onScheduleSuccess(response.data.meeting)
      }
    } catch (err) {
      console.error('Error scheduling meeting:', err)
      setError(err.response?.data?.error || 'Failed to schedule meeting. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!scheduledResult?.meeting_link) return
    navigator.clipboard.writeText(scheduledResult.meeting_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#202124] text-white w-full max-w-xl rounded-3xl border border-[#3c4043] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3c4043] bg-[#28292c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-xl text-[#8ab4f8]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Schedule with Google Mail & Calendar</h2>
              <p className="text-[11px] text-gray-400">VIT Connect Automated Reminder & Event Sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3c4043] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {scheduledResult ? (
            /* Success & Action Screen */
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 bg-gradient-to-b from-blue-950/40 to-[#28292c] rounded-2xl border border-blue-800/40 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Meeting Scheduled!</h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Automated reminders & Google Calendar sync have been generated.
                  </p>
                </div>

                {/* Meeting Summary Badge */}
                <div className="bg-[#202124] border border-[#3c4043] rounded-xl p-3 text-left space-y-1 text-xs">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#8ab4f8]" />
                    <span>{scheduledResult.meeting?.title}</span>
                  </div>
                  <div className="text-gray-300 flex items-center gap-2 pt-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{scheduledResult.meeting?.scheduled_date} &bull; {scheduledResult.meeting?.scheduled_start_time} - {scheduledResult.meeting?.scheduled_end_time}</span>
                  </div>
                  {scheduledResult.meeting?.guest_emails?.length > 0 && (
                    <div className="text-gray-400 flex items-center gap-2 pt-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{scheduledResult.meeting?.guest_emails?.length} Person(s) invited</span>
                    </div>
                  )}
                </div>

                {/* Email Dispatch Status */}
                {scheduledResult.email_notifications && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-left text-xs space-y-1.5">
                    <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Google Mail Reminders Dispatched:</span>
                    </div>
                    <ul className="text-gray-300 space-y-1 pl-4 list-disc text-[11px]">
                      <li>Host Reminder sent to <strong>You</strong></li>
                      {scheduledResult.meeting?.guest_emails?.map((g, idx) => (
                        <li key={idx}>Invitation & reminder sent to <strong>{g}</strong></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons: 1-Click Google Calendar & Direct Link */}
              <div className="space-y-3">
                <a
                  href={scheduledResult.google_calendar_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-colors text-sm shadow-md"
                >
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                    alt="Google Calendar"
                    className="w-5 h-5"
                  />
                  <span>Add to Google Calendar</span>
                  <ExternalLink className="w-4 h-4 ml-auto text-gray-500" />
                </a>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <a
                    href={API_ENDPOINTS.meetings.calendarIcs(scheduledResult.meeting?.id)}
                    download
                    className="flex-1 py-2.5 px-3 bg-[#28292c] hover:bg-[#3c4043] border border-[#3c4043] text-gray-200 font-medium rounded-xl flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    <span>Download .ics Invite</span>
                  </a>

                  <a
                    href={`/conference/${scheduledResult.meeting?.meeting_code || scheduledResult.meeting?.id}`}
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-sm"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Room Now</span>
                  </a>
                </div>

                {/* Meeting Link with Copy Button */}
                <div className="p-3 bg-[#28292c] border border-[#3c4043] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 font-mono truncate">{scheduledResult.meeting_link}</span>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-900" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#3c4043] hover:bg-[#4a4e52] text-xs font-semibold rounded-xl text-white transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            /* Scheduling Form */
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Meeting Title <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning, Project Review, Client Sync"
                  className="w-full px-3.5 py-2.5 bg-[#28292c] border border-[#3c4043] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8] transition-colors"
                  required
                />
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white focus:outline-none focus:border-[#8ab4f8]"
                    required
                  />
                </div>
              </div>

              {/* Guest / Person to Meet With */}
              <div>
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    <span>Person(s) you are meeting with (Guest Emails)</span>
                  </span>
                  <span className="text-[11px] text-gray-400">Press Enter or comma</span>
                </label>

                {/* Chips list */}
                {guestEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {guestEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/60 border border-blue-700/60 text-blue-300 rounded-lg text-xs"
                      >
                        <Mail className="w-3 h-3" />
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuest(email)}
                          className="text-blue-400 hover:text-white rounded-full ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={guestInput}
                      onChange={(e) => setGuestInput(e.target.value)}
                      onKeyDown={handleKeyDownGuest}
                      placeholder="e.g. colleague@company.com"
                      className="w-full pl-9 pr-3.5 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGuest}
                    className="px-3.5 py-2 bg-[#3c4043] hover:bg-[#4a4e52] text-xs font-semibold rounded-xl text-white transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Description / Agenda */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Agenda / Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add meeting agenda, discussion topics, or preparation notes..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-[#28292c] border border-[#3c4043] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8ab4f8] resize-none"
                />
              </div>

              {/* Email Notification Option */}
              <div className="p-3 bg-[#28292c] border border-[#3c4043] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/20 text-[#8ab4f8] rounded-lg">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Automated Google Mail Reminders</p>
                    <p className="text-[11px] text-gray-400">Send reminder emails to you and all invited participants</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#3c4043]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-medium text-gray-400 hover:text-white rounded-xl hover:bg-[#3c4043] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-bold bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:opacity-50 text-[#202124] rounded-xl flex items-center gap-2 transition-all shadow-md"
                >
                  {loading ? (
                    <span>Scheduling & Sending Mails...</span>
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Schedule & Send Reminders</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
