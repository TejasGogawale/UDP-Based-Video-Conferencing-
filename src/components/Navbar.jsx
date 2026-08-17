import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-bold text-purple-600 hover:text-purple-700 transition-colors">
            VIT Connect
          </Link>

          {user ? (
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-purple-600 transition-colors font-medium">
                Dashboard
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-gray-700 dark:text-gray-300 text-sm">{user.name}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="btn-primary"
                >
                  Logout
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <Link to="/login" className="btn-secondary">
                Login
              </Link>
              <Link to="/register" className="btn-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
