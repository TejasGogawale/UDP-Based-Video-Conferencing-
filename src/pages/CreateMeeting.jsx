import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import axios from 'axios'
import { motion } from 'framer-motion'
import { Video, ArrowLeft, PlusCircle, AlignLeft } from 'lucide-react'
import { API_ENDPOINTS } from '../config/api'

const CreateMeeting = () => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(
        API_ENDPOINTS.meetings.create,
        { title, description },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      navigate(`/conference/${response.data.meeting.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create meeting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#111] text-slate-800 dark:text-slate-100 flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-xl dark:shadow-none border border-slate-100 dark:border-[#2a2a2a] p-8 relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Decorative gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-600" />

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">New Meeting</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Set up a space for collaboration</p>
            </div>
          </div>

          {error && (
            <motion.div
              className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl mb-6 text-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Meeting Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:text-white transition-all text-base"
                  placeholder="e.g. Daily Sync"
                  required
                />
                <Video className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Description (Optional)
              </label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent dark:text-white transition-all text-base min-h-[100px] resize-none"
                  placeholder="What is this meeting about?"
                  rows="3"
                />
                <AlignLeft className="w-5 h-5 absolute left-4 top-4 text-slate-400" />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 text-base flex justify-center items-center"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default CreateMeeting
