// API & WebSocket Configuration for VIT Connect

const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
const envSocketUrl = import.meta.env.VITE_SOCKET_URL

// In development, default to localhost:5000 if not specified
// In production (Vercel), default to configured VITE_API_URL or relative / window origin
export const API_BASE_URL = envApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin)
export const SOCKET_URL = envSocketUrl || envApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin)

// Helper methods for standardized API endpoints
export const API_ENDPOINTS = {
  auth: {
    verify: `${API_BASE_URL}/api/auth/verify`,
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
  },
  meetings: {
    base: `${API_BASE_URL}/api/meetings`,
    create: `${API_BASE_URL}/api/meetings/create`,
    schedule: `${API_BASE_URL}/api/meetings/schedule`,
    scheduledList: `${API_BASE_URL}/api/meetings/scheduled`,
    getById: (id) => `${API_BASE_URL}/api/meetings/${id}`,
    sendReminder: (id) => `${API_BASE_URL}/api/meetings/${id}/send-reminder`,
    invite: (id) => `${API_BASE_URL}/api/meetings/${id}/invite`,
    presence: (id) => `${API_BASE_URL}/api/meetings/${id}/presence`,
    calendarIcs: (id) => `${API_BASE_URL}/api/meetings/${id}/calendar.ics`,
  }
}

export default {
  API_BASE_URL,
  SOCKET_URL,
  API_ENDPOINTS
}
