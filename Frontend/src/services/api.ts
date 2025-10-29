import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://wysa-adw7.onrender.com'

// Debug: log the resolved API base URL once (helps diagnose Network Error in prod)
if (typeof window !== 'undefined') {
  // Only log in development or if explicitly enabled via env
  const shouldLog = import.meta.env.DEV || import.meta.env.VITE_LOG_API_BASE === 'true'
  if (shouldLog) {
    console.info('[api] Base URL:', API_BASE_URL)
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS
  timeout: 120000, // 2 minute timeout for AI analysis
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message)
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        type: 'network'
      })
    }

    // Handle different HTTP status codes
    const { status, data } = error.response
    
    switch (status) {
      case 401:
        localStorage.removeItem('token')
        window.location.href = '/login'
        break
      case 403:
        console.error('Access forbidden:', data.message)
        break
      case 404:
        console.error('Resource not found:', data.message)
        break
      case 429:
        console.error('Rate limit exceeded:', data.message)
        break
      case 500:
        console.error('Server error:', data.message)
        break
      default:
        console.error('API error:', data.message || 'Unknown error')
    }

    return Promise.reject({
      message: data.message || 'An error occurred',
      status,
      type: 'api'
    })
  }
)

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  signup: (username: string, email: string, password: string) =>
    api.post('/api/auth/signup', { username, email, password }),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }),
}

// Profile API
export const profileAPI = {
  get: () => api.get('/api/profile'),
  create: (data: Record<string, unknown>) => api.post('/api/profile', data),
  update: (data: Record<string, unknown>) => api.put('/api/profile', data),
}

// Resume API
export const resumeAPI = {
  upload: (formData: FormData) => api.post('/api/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  parse: (resumeId: number, data: Record<string, unknown>) => api.post(`/api/resume/parse/${resumeId}`, data, {
    timeout: 180000 // 3 minute timeout for AI analysis
  }),
  get: (resumeId: number) => api.get(`/api/resume/${resumeId}`),
  getUserResumes: (userId: number) => api.get(`/api/resume/user/${userId}`),
  getAnalysisPdf: (resumeId: number) => api.get(`/api/resume/${resumeId}/analysis-pdf`),
  delete: (resumeId: number) => api.delete(`/api/resume/${resumeId}`),
}

// Planner API
export const plannerAPI = {
  generate: (data: Record<string, unknown>) => api.post('/api/planner/generate', data),
  get: (plannerId: number) => api.get(`/api/planner/${plannerId}`),
  getUserPlanners: (userId: number) => api.get(`/api/planner/user/${userId}`),
  updateProgress: (plannerId: number, progressPercent: number) =>
    api.put(`/api/planner/${plannerId}`, { progressPercent }),
  getDailyPdf: (plannerId: number, dayIndex?: number) =>
    api.get(`/api/planner/${plannerId}/daily-pdf?dayIndex=${dayIndex || 0}`),
}


// Interview API
export const interviewAPI = {
  getEligibility: () => api.get('/api/interview/eligibility'),
  getHistory: () => api.get('/api/interview/history'),
  schedule: (data: Record<string, unknown>) => api.post('/api/interview/schedule', data),
  get: (interviewId: number) => api.get(`/api/interview/${interviewId}`),
  reschedule: (interviewId: number, scheduledAt: string) =>
    api.put(`/api/interview/${interviewId}/reschedule`, { scheduledAt }),
  cancel: (interviewId: number) => api.delete(`/api/interview/${interviewId}`),
  start: (interviewId: number, phoneNumber: string) =>
    api.post(`/api/interview/${interviewId}/start`, { phoneNumber }),
  getStatus: (interviewId: number) => api.get(`/api/interview/${interviewId}/status`),
  getReport: (interviewId: number) => api.get(`/api/interview/${interviewId}/report`),
}

// Notification API
export const notificationAPI = {
  get: () => api.get('/api/notifications'),
  create: (data: Record<string, unknown>) => api.post('/api/notifications', data),
  sendDailyPlan: (data: Record<string, unknown>) => api.post('/api/notifications/sendDailyPlan', data),
  getToday: () => api.get('/api/today'),
  testEmail: () => api.get('/api/notifications/test-email'),
  triggerAll: () => api.post('/api/notifications/trigger-all'),
  getSchedulerStatus: () => api.get('/api/notifications/scheduler-status'),
}

// PDF API
export const pdfAPI = {
  generateStudyGuide: (data: Record<string, unknown>) => api.post('/api/resources/study-guide', data),
  generatePractice: (data: Record<string, unknown>) => api.post('/api/resources/practice', data),
  generateReference: (data: Record<string, unknown>) => api.post('/api/resources/reference', data),
  list: () => api.get('/api/resources/list'),
  download: (fileName: string) => api.get(`/api/resources/download/${fileName}`),
}

// Resource Generation API
export const resourceAPI = {
  generate: (data: Record<string, unknown>) => api.post('/api/resources/generate', data),
  getStatus: (userId: number) => api.get(`/api/resources/status/${userId}`),
  getUserResources: (userId: number) => api.get(`/api/resources/user/${userId}`),
}

// Chat API
export const chatAPI = {
  send: (message: string) => api.post('/chat', { message }),
}
