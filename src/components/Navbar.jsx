import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Video,
  HelpCircle,
  MessageSquare,
  Settings,
  Grid,
  LogOut,
  User,
  Shield,
  ExternalLink
} from 'lucide-react'
import { DeviceSettingsModal } from './meet/DeviceSettingsModal'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <>
      <header className="h-16 bg-white dark:bg-[#1a1b1f] border-b border-gray-200 dark:border-[#3c4043]/60 px-4 sm:px-6 flex items-center justify-between z-20 select-none">
        {/* Left: VIT Connect Logo & Branding */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg sm:text-xl font-normal text-gray-700 dark:text-gray-200 font-sans tracking-tight">
              VIT <span className="font-semibold text-blue-600 dark:text-[#8ab4f8]">Connect</span>
            </span>
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-[#8ab4f8] text-[10px] font-bold rounded">
              PRO
            </span>
          </div>
        </Link>

        {/* Right: Clock & Action Items */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Live Date & Time Clock (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
            <span>{timeString}</span>
            <span>•</span>
            <span>{dateString}</span>
          </div>

          {/* Quick Settings Icon */}
          <div className="flex items-center text-gray-600 dark:text-gray-300">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-[#28292c] rounded-full transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* User Account / Auth Actions */}
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-md hover:ring-2 hover:ring-blue-500/40 transition-all"
                title={user.name}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white dark:bg-[#28292c] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3c4043] py-4 px-3 z-50 text-gray-800 dark:text-white animate-in zoom-in-95 duration-100">
                  <div className="text-center pb-3 border-b border-gray-100 dark:border-[#3c4043]">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-2 shadow">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>

                  <div className="pt-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        navigate('/dashboard')
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:hover:bg-[#3c4043] rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <User className="w-4 h-4 text-blue-600 dark:text-[#8ab4f8]" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false)
                        logout()
                        navigate('/login')
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 dark:text-[#f28b82] hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/login"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-blue-600 dark:text-[#8ab4f8] hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      {showSettings && (
        <DeviceSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}

export default Navbar
