import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { 
  Video, 
  Link as LinkIcon, 
  Keyboard, 
  Clock, 
  Plus, 
  Copy, 
  Check, 
  X, 
  Calendar,
  ExternalLink,
  ChevronDown
} from 'lucide-react'

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Dropdown & Modal States
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showLaterModal, setShowLaterModal] = useState(false)
  const [laterMeetingLink, setLaterMeetingLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [joinInput, setJoinInput] = useState('')

  useEffect(() => {
    fetchMeetings()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchMeetings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/meetings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setMeetings(response.data.meetings || [])
    } catch (err) {
      setError('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLater = async () => {
    try {
      setDropdownOpen(false)
      const response = await axios.post(
        'http://localhost:5000/api/meetings/create',
        { title: `Meeting - ${new Date().toLocaleDateString()}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      const code = response.data.meeting.meeting_code
      const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
      setLaterMeetingLink(`http://localhost:3000/conference/${formatted}`)
      setShowLaterModal(true)
      fetchMeetings()
    } catch (err) {
      setError('Failed to create meeting')
    }
  }

  const handleCreateInstant = async () => {
    try {
      setDropdownOpen(false)
      const response = await axios.post(
        'http://localhost:5000/api/meetings/create',
        { title: `Instant Sync - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      navigate(`/conference/${response.data.meeting.id}`)
    } catch (err) {
      setError('Failed to start instant meeting')
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
    const cleanCode = joinInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleanCode) {
      navigate(`/conference/${cleanCode}`)
    }
  }

  const formatCode = (code) => {
    if (!code) return ''
    const cleaned = code.replace(/[^A-Z0-9]/g, '')
    if (cleaned.length === 12) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`
    }
    return code
  }

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1b1f] text-slate-800 dark:text-slate-200 flex flex-col antialiased">
      <Navbar />

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-12 items-center flex-1">
          {/* Left Column - Clean Action Area */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">
                Premium video meetings.<br />
                Now free for everyone.
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                We re-engineered the secure conferencing service we built for enterprise schools and businesses, VIT Connect, to make it free and accessible on any device.
              </p>
            </div>

            {/* Google Workspace Style Form Layout */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch max-w-lg">
              
              {/* New Meeting Menu */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full sm:w-auto px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Meeting
                  <ChevronDown className="w-4 h-4 ml-0.5" />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <motion.div
                        className="absolute left-0 mt-2 w-60 bg-white dark:bg-[#202124] rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 py-1 z-20 overflow-hidden"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.1 }}
                      >
                        <button
                          onClick={handleCreateLater}
                          className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-sm flex items-center gap-3 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <LinkIcon className="w-4 h-4 text-slate-400" />
                          Create a meeting for later
                        </button>
                        <button
                          onClick={handleCreateInstant}
                          className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-sm flex items-center gap-3 text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-800"
                        >
                          <Video className="w-4 h-4 text-slate-400" />
                          Start an instant meeting
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Code input area */}
              <form onSubmit={handleJoinByInput} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Enter a code or link"
                    className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-[#1a1b1f] border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white transition-all text-sm placeholder-slate-400"
                  />
                  <Keyboard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="px-5 py-3.5 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 disabled:text-slate-400 dark:disabled:text-slate-600 font-medium rounded-lg transition-colors border border-slate-300 dark:border-slate-700 focus:outline-none"
                >
                  Join
                </button>
              </form>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800 max-w-lg" />

            <div className="text-xs text-slate-400 dark:text-slate-500">
              <Link to="/join-meeting" className="text-blue-600 dark:text-blue-400 hover:underline">Learn more</Link> about security, privacy, and encryption in VIT Connect.
            </div>
          </div>

          {/* Right Column - Minimal Calendar & Workspace Clock */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            
            {/* Flat Clock Widget */}
            <div className="bg-slate-50 dark:bg-[#202124] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <Clock className="w-8 h-8 text-slate-400" />
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{timeString}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dateString}</p>
                </div>
              </div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded">
                LOCAL TIME
              </div>
            </div>

            {/* Flat Schedule Space */}
            <div className="bg-slate-50 dark:bg-[#202124] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 flex-1 min-h-[300px] flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Your Meetings
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {meetings.length} rooms
                </span>
              </div>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : meetings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <p className="text-xs text-slate-400 dark:text-slate-500">No recent meetings found.</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-0.5">Use the menu to create a new meeting code.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[280px]">
                  {meetings.map((meeting) => (
                    <div 
                      key={meeting.id}
                      className="p-3 bg-white dark:bg-[#1a1b1f] rounded-xl border border-slate-200 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <h4 className="font-medium text-slate-900 dark:text-white text-xs truncate">
                          {meeting.title || 'Untitled Meeting'}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          <span>{formatCode(meeting.meeting_code)}</span>
                          <span>•</span>
                          <span>{meeting.participant_count || 0} participants</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const formatted = formatCode(meeting.meeting_code)
                            navigator.clipboard.writeText(`http://localhost:3000/conference/${formatted}`)
                          }}
                          title="Copy invitation link"
                          className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/conference/${meeting.id}`}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-250 dark:border-slate-700 flex items-center gap-1.5"
                        >
                          Join
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Invites Copy popup */}
      <AnimatePresence>
        {showLaterModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <motion.div 
              className="absolute inset-0 bg-black/40 dark:bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLaterModal(false)}
            />

            <motion.div
              className="w-full max-w-sm bg-white dark:bg-[#202124] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xl z-10 relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
            >
              <button 
                onClick={() => setShowLaterModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-3 mt-1">
                <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Here is your meeting link</h3>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Copy this link and send it to people you want to meet with. Make sure to save it so you can use it later.
              </p>

              <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-[#1a1b1f] border border-slate-200 dark:border-slate-800 rounded-lg mb-4 text-xs font-mono">
                <span className="flex-1 text-slate-600 dark:text-slate-355 truncate select-all">{laterMeetingLink}</span>
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-slate-400 hover:text-slate-600"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={() => setShowLaterModal(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
