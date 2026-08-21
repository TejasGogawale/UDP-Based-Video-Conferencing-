import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  Video,
  ShieldCheck,
  Zap,
  Users,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Monitor,
  PenTool
} from 'lucide-react'

const Home = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1b1f] text-slate-800 dark:text-slate-200 flex flex-col antialiased">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 rounded-full text-xs font-semibold text-blue-600 dark:text-[#8ab4f8]">
            <Sparkles className="w-3.5 h-3.5" />
            Next-Gen Secure Video Conferencing
          </div>

          <h1 className="text-5xl sm:text-6xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight font-sans">
            Video calls and meetings for <span className="text-blue-600 dark:text-[#8ab4f8] font-semibold">everyone</span>
          </h1>

          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Connect, collaborate, and celebrate from anywhere with VIT Connect. High-definition video, live captions, interactive polls, collaborative whiteboard, and end-to-end security.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Go to Meet Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <span>Get Started for Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-[#28292c] dark:hover:bg-[#323639] text-gray-900 dark:text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-6 pt-6">
          <div className="p-8 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-3xl space-y-3 hover:border-blue-500 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-[#8ab4f8] flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">HD Video & Clear Audio</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Crystal clear WebRTC video peer streams with adaptive resolution scaling and background blur.
            </p>
          </div>

          <div className="p-8 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-3xl space-y-3 hover:border-blue-500 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PenTool className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Collaboration</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Interactive live polls, Q&A upvoting, collaborative digital whiteboard, and floating reactions.
            </p>
          </div>

          <div className="p-8 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-3xl space-y-3 hover:border-blue-500 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enterprise Security</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              JWT authentication, host moderation locks, anti-deepfake liveness watermarking, and DTLS-SRTP encryption.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home
