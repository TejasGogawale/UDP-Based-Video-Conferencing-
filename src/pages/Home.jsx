import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const Home = () => {
  const { user } = useAuth()

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="text-center mb-20" variants={itemVariants}>
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to <span className="text-blue-600">VIT Connect</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Real-time audio and video conferencing platform designed for seamless communication and collaboration.
          </p>

          {!user ? (
            <div className="flex gap-4 justify-center">
              <Link to="/login" className="btn-primary">
                Sign In
              </Link>
              <Link to="/register" className="btn-secondary">
                Create Account
              </Link>
            </div>
          ) : (
            <Link to="/dashboard" className="btn-primary inline-block">
              Go to Dashboard
            </Link>
          )}
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="glass rounded-2xl p-8 backdrop-blur-md"
            variants={itemVariants}
            whileHover={{ y: -5 }}
          >
            <div className="text-4xl mb-4">🎥</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">HD Video</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Crystal clear video conferencing with multiple participants
            </p>
          </motion.div>

          <motion.div
            className="glass rounded-2xl p-8 backdrop-blur-md"
            variants={itemVariants}
            whileHover={{ y: -5 }}
          >
            <div className="text-4xl mb-4">🎤</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Clear Audio</h3>
            <p className="text-gray-600 dark:text-gray-400">
              High-quality audio with noise suppression for better communication
            </p>
          </motion.div>

          <motion.div
            className="glass rounded-2xl p-8 backdrop-blur-md"
            variants={itemVariants}
            whileHover={{ y: -5 }}
          >
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Live Chat</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Send messages and share information during meetings
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-20 text-center"
          variants={itemVariants}
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Features</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="text-left glass rounded-xl p-6 backdrop-blur-md">
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">✓ Instant Meetings</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Create and join meetings instantly</p>
            </div>
            <div className="text-left glass rounded-xl p-6 backdrop-blur-md">
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">✓ Multiple Participants</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Support multiple users in one conference</p>
            </div>
            <div className="text-left glass rounded-xl p-6 backdrop-blur-md">
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">✓ Camera & Mic Control</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Toggle audio and video with one click</p>
            </div>
            <div className="text-left glass rounded-xl p-6 backdrop-blur-md">
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">✓ Meeting Timer</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Track meeting duration effortlessly</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Home
