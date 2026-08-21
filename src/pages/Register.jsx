import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { Video, ArrowRight } from 'lucide-react'

const Register = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await register(name, email, password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1b1f] text-slate-800 dark:text-slate-200 flex flex-col antialiased">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 bg-gray-50 dark:bg-[#28292c] border border-gray-200 dark:border-[#3c4043] rounded-3xl shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Video className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-normal text-gray-900 dark:text-white">Create Account</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">to get started with VIT Connect</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-[#f28b82] rounded-xl text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white dark:bg-[#202124] border border-gray-300 dark:border-[#3c4043] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-600 dark:focus:border-[#8ab4f8]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 bg-white dark:bg-[#202124] border border-gray-300 dark:border-[#3c4043] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-600 dark:focus:border-[#8ab4f8]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white dark:bg-[#202124] border border-gray-300 dark:border-[#3c4043] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-600 dark:focus:border-[#8ab4f8]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 dark:text-[#8ab4f8] font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Register
