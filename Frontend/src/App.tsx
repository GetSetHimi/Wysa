import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './Components/ProtectedRoute'
import { Layout } from './Components/Layout'
import { PublicNavbar } from './Components/PublicNavbar'
import { HomePage } from './pages/HomePage'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Profile } from './pages/Profile'
import { ResumeUpload } from './pages/ResumeUpload'
import { Planner } from './pages/Planner'
import { Interview } from './pages/Interview'
import { Resources } from './pages/Resources'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import { useAuth } from './contexts/AuthContext'

const HomePageWrapper = () => {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }
  
  return (
    <>
      <PublicNavbar />
      <HomePage />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePageWrapper />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Admin routes */}
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
            {/* Protected routes */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="resume" element={<ResumeUpload />} />
              <Route path="planner" element={<Planner />} />
              <Route path="interview" element={<Interview />} />
              <Route path="resources" element={<Resources />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App