import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateMeeting from './pages/CreateMeeting'
import JoinMeeting from './pages/JoinMeeting'
import ConferenceRoom from './pages/ConferenceRoom'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create-meeting" element={<ProtectedRoute><CreateMeeting /></ProtectedRoute>} />
          <Route path="/join-meeting" element={<ProtectedRoute><JoinMeeting /></ProtectedRoute>} />
          <Route path="/conference/:meetingId" element={<ProtectedRoute><ConferenceRoom /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
