import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { motion } from 'framer-motion'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />

      <motion.div
        className="flex items-center justify-center min-h-screen px-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <h1 className="text-9xl font-bold text-blue-600 mb-4">404</h1>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Page Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 max-w-md">
            The page you're looking for doesn't exist. Let's get you back on track.
          </p>
          <Link to="/" className="btn-primary inline-block">
            Go to Home
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default NotFound
