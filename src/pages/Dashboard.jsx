import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { API_ENDPOINTS } from '../config/api'
import { formatMeetingCode, meetingLink, meetingRefFromInput } from '../lib/meetingCode'
import {
  Video,
  Plus,
  Link2,
  Calendar,
  Keyboard,
  ChevronDown,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  ExternalLink,
  Users,
  Mail,
  Download,
  Send,
  Sparkles,
  CalendarDays
} from 'lucide-react'
import { ScheduleModal } from '../components/meet/ScheduleModal'

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [scheduledMeetings, setScheduledMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showLaterModal, setShowLaterModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [laterMeetingLink, setLaterMeetingLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [reminderSendingId, setReminderSendingId] = useState(null)
  const [reminderToast, setReminderToast] = useState('')

  const carouselSlides = [
    {
      title: 'Google Mail & Calendar Sync',
      description: 'Schedule meetings with automated reminder emails sent to both you and your guests, plus 1-click Google Calendar sync.',
      icon: Calendar,
      color: 'from-blue-600 to-indigo-600',
      bgLight: 'bg-blue-50 dark:bg-blue-950/20'
    },
    {
      title: 'Get a link you can share',
      description: 'Click New meeting to get an instant link you can send to people you want to meet with',
      icon: Link2,
      color: 'from-indigo-600 to-violet-600',
      bgLight: 'bg-indigo-50 dark:bg-indigo-950/20'
    },
    {
      title: 'Your meeting is secure',
      description: 'No one can join a meeting unless invited or admitted by the host with high-quality media streaming',
      icon: ShieldCheck,
      color: 'from-emerald-600 to-teal-600',
      bgLight: 'bg-emerald-50 dark:bg-emerald-950/20'
    }
  ]

  useEffect(() => {
    fetchMeetings()
    fetchScheduledMeetings()
    const autoSlide = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length)
    }, 6000)
    return () => clearInterval(autoSlide)
  }, [])

  const fetchMeetings = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.meetings.base, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setMeetings(response.data.meetings || [])
    } catch (err) {
      console.warn('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduledMeetings = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.meetings.scheduledList, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setScheduledMeetings(response.data.scheduled_meetings || [])
    } catch (err) {
      console.warn('Failed to load scheduled meetings')
    }
  }

  const handleCreateLater = async () => {
    try {
      setDropdownOpen(false)
      const res = await axios.post(
        API_ENDPOINTS.meetings.create,
        { title: `Meeting - ${new Date().toLocaleDateString()}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      setLaterMeetingLink(meetingLink(res.data.meeting.meeting_code))
      setShowLaterModal(true)
      fetchMeetings()
    } catch (err) {
      console.warn('Error creating later meeting:', err)
    }
  }

  const handleCreateInstant = async () => {
    try {
      setDropdownOpen(false)
      const res = await axios.post(
        API_ENDPOINTS.meetings.create,
        { title: `Instant Meeting - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      navigate(`/conference/${res.data.meeting.meeting_code || res.data.meeting.id}`)
    } catch (err) {
      console.warn('Error creating instant meeting:', err)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(laterMeetingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoinByInput = (e) => {
    e.preventDefault()
    if (!joinInput.trim()) return
    const cleanCode = meetingRefFromInput(joinInput)
    if (cleanCode) {
      navigate(`/conference/${cleanCode}`)
    }
  }

  const handleSendReminder = async (meetingId, meetingTitle) => {
    setReminderSendingId(meetingId)
    try {
      const res = await axios.post(
        API_ENDPOINTS.meetings.sendReminder(meetingId),
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      setReminderToast(`${meetingTitle}: ${res.data.message}`)
      setTimeout(() => setReminderToast(''), 4000)
    } catch (err) {
      console.error('Failed to send reminder:', err)
      setReminderToast(err.response?.data?.error || 'Failed to send reminder email.')
      setTimeout(() => setReminderToast(''), 4000)
    } finally {
      setReminderSendingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1b1f] text-slate-800 dark:text-slate-200 flex flex-col antialiased">
      <Navbar />

      {/* Reminder Toast Notification */}
      {reminderToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#28292c] border border-blue-500 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="p-1 bg-blue-600 rounded-lg text-white">
            <Mail className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">{reminderToast}</span>
          <button onClick={() => setReminderToast('')} className="text-gray-400 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col justify-start">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column - Action Center */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 rounded-full text-blue-600 dark:text-[#8ab4f8] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Google Mail & Calendar Integrated</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight font-sans">
                Premium video meetings.<br />
                Now free for everyone.
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                Schedule meetings with automated Google Mail reminders to all participants, sync with Google Calendar, and collaborate seamlessly.
              </p>
            </div>

            {/* Action Buttons & Input */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch max-w-lg">
              {/* New Meeting Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full sm:w-auto px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                >
                  <Video className="w-4 h-4" />
                  <span>New meeting</span>
                  <ChevronDown className="w-4 h-4 ml-0.5" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-[#28292c] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3c4043] py-2 z-50 animate-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        setShowScheduleModal(true)
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-[#3c4043] flex items-center gap-3 text-xs font-semibold text-blue-600 dark:text-[#8ab4f8] transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-[#8ab4f8]" />
                      <div>
                        <div>Schedule with Google Calendar</div>
                        <div className="text-[10px] text-gray-400 font-normal">Auto reminder mails to you & guests</div>
                      </div>
                    </button>
                    <button
                      onClick={handleCreateInstant}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-[#3c4043] flex items-center gap-3 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-blue-600 dark:text-[#8ab4f8]" />
                      <span>Start an instant meeting</span>
                    </button>
                    <button
                      onClick={handleCreateLater}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-[#3c4043] flex items-center gap-3 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      <Link2 className="w-4 h-4 text-blue-600 dark:text-[#8ab4f8]" />
                      <span>Create a meeting for later</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Enter a code or link input */}
              <form onSubmit={handleJoinByInput} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Enter a code or link"
                    className="w-full pl-10 pr-4 py-3.5 bg-transparent border border-gray-300 dark:border-[#3c4043] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-600 dark:focus:border-[#8ab4f8] focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className={`px-5 py-3.5 rounded-lg text-sm font-semibold transition-colors ${
                    joinInput.trim()
                      ? 'text-blue-600 dark:text-[#8ab4f8] hover:bg-blue-50 dark:hover:bg-blue-950/30'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Join
                </button>
              </form>
            </div>

            {/* Quick Helper Line */}
            <div className="pt-4 border-t border-gray-200 dark:border-[#3c4043]/60 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <p>Google Mail and Google Calendar sync enabled</p>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="text-blue-600 dark:text-[#8ab4f8] font-medium hover:underline flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Meeting</span>
              </button>
            </div>
          </div>

          {/* Right Column - Carousel */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center text-center">
            <div className="relative w-full max-w-md p-8 rounded-3xl bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] shadow-lg flex flex-col items-center">
              {(() => {
                const CurrentSlide = carouselSlides[carouselIndex]
                const Icon = CurrentSlide.icon

                return (
                  <div className="space-y-4">
                    <div className={`w-32 h-32 rounded-full bg-gradient-to-tr ${CurrentSlide.color} flex items-center justify-center text-white shadow-xl mx-auto mb-4 animate-in zoom-in-90 duration-300`}>
                      <Icon className="w-16 h-16 stroke-[1.5]" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {CurrentSlide.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
                      {CurrentSlide.description}
                    </p>
                  </div>
                )
              })()}

              {/* Navigation Dots & Buttons */}
              <div className="flex items-center justify-between w-full mt-6 pt-4 border-t border-gray-200 dark:border-[#3c4043]">
                <button
                  onClick={() => setCarouselIndex(prev => (prev - 1 + carouselSlides.length) % carouselSlides.length)}
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#3c4043] text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {carouselSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIndex(i)}
                      className={`h-2 rounded-full transition-all ${
                        carouselIndex === i
                          ? 'w-6 bg-blue-600 dark:bg-[#8ab4f8]'
                          : 'w-2 bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCarouselIndex(prev => (prev + 1) % carouselSlides.length)}
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#3c4043] text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Meetings Section */}
        <div className="mt-14 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#3c4043]/60 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-[#8ab4f8]" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Meetings & Google Calendar Events</h2>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-[#8ab4f8] hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-blue-200 dark:border-blue-800/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Meeting</span>
            </button>
          </div>

          {scheduledMeetings.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-2xl space-y-3">
              <Calendar className="w-10 h-10 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No scheduled meetings yet.</p>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule with Google Mail & Calendar</span>
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduledMeetings.map((m) => {
                const guests = m.guest_emails || []
                const isHost = m.creator_id === user?.id
                return (
                  <div
                    key={m.id}
                    className="p-5 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-2xl flex flex-col justify-between hover:border-blue-500/60 transition-all space-y-4 group shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {m.title}
                        </h3>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-[#8ab4f8] text-[10px] font-bold rounded-md shrink-0">
                          {isHost ? 'Host' : 'Guest'}
                        </span>
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-[#8ab4f8] font-medium mt-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{m.scheduled_date || 'Upcoming'} &bull; {m.scheduled_start_time || '10:00'} - {m.scheduled_end_time || '11:00'}</span>
                      </div>

                      {/* Description if present */}
                      {m.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                          {m.description}
                        </p>
                      )}

                      {/* Attendees */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#3c4043]/50">
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                          <Users className="w-3 h-3" />
                          <span>Meeting with:</span>
                        </div>
                        {guests.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {guests.map((g, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-gray-200 dark:bg-[#1a1b1f] text-gray-700 dark:text-gray-300 text-[10px] rounded-md font-mono truncate max-w-[180px]"
                                title={g}
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">No external guests</span>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-[#3c4043]/50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/conference/${m.meeting_code || m.id}`)}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Video Call</span>
                        </button>

                        {m.google_calendar_url && (
                          <a
                            href={m.google_calendar_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white dark:bg-[#1a1b1f] hover:bg-gray-100 dark:hover:bg-[#3c4043] border border-gray-300 dark:border-[#3c4043] text-gray-700 dark:text-gray-200 rounded-xl transition-colors shrink-0"
                            title="Add to Google Calendar"
                          >
                            <img
                              src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                              alt="GCal"
                              className="w-4 h-4"
                            />
                          </a>
                        )}

                        <a
                          href={API_ENDPOINTS.meetings.calendarIcs(m.id)}
                          download
                          className="p-2 bg-gray-100 dark:bg-[#1a1b1f] hover:bg-gray-200 dark:hover:bg-[#3c4043] border border-gray-300 dark:border-[#3c4043] text-gray-500 dark:text-gray-400 rounded-xl transition-colors shrink-0"
                          title="Download .ics"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>

                      {isHost && (
                        <button
                          onClick={() => handleSendReminder(m.id, m.title)}
                          disabled={reminderSendingId === m.id}
                          className="w-full py-1.5 bg-gray-100 dark:bg-[#1a1b1f] hover:bg-gray-200 dark:hover:bg-[#3c4043] text-gray-700 dark:text-gray-300 text-[11px] font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-gray-200 dark:border-[#3c4043]"
                        >
                          <Send className="w-3 h-3 text-blue-500" />
                          <span>{reminderSendingId === m.id ? 'Sending Mails...' : 'Re-send Reminder Email'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Instant Meetings Section */}
        {meetings.length > 0 && (
          <div className="mt-14 pt-8 border-t border-gray-200 dark:border-[#3c4043]/60 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Rooms & Calls</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {meetings.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-2xl flex items-center justify-between hover:border-blue-500 transition-colors group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {formatMeetingCode(m.meeting_code)}
                      {m.active_participants > 0 && <span className="ml-2 font-sans text-emerald-500">● {m.active_participants} in call</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/conference/${m.meeting_code || m.id}`)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
                  >
                    Rejoin
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* "Here's the link to your meeting" Modal */}
      {showLaterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202124] text-gray-900 dark:text-white w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#3c4043] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Here's the link to your meeting</h3>
              <button
                onClick={() => setShowLaterModal(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later, too.
            </p>

            <div className="p-3 bg-gray-100 dark:bg-[#28292c] border border-gray-300 dark:border-[#3c4043] rounded-xl flex items-center justify-between gap-2">
              <span className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate">{laterMeetingLink}</span>
              <button
                onClick={handleCopyLink}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onScheduleSuccess={() => {
            fetchMeetings()
            fetchScheduledMeetings()
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
