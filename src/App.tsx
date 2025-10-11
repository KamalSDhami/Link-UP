import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Layout Components
import MainLayout from './components/layout/MainLayout'
import AuthLayout from './components/layout/AuthLayout'

// Pages
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/auth/SignupPage'
import LoginPage from './pages/auth/LoginPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import ProfileSetupPage from './pages/auth/ProfileSetupPage'

import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import TeamsPage from './pages/teams/TeamsPage'
import TeamDetailPage from './pages/teams/TeamDetailPage'
import CreateTeamPage from './pages/teams/CreateTeamPage'
import RecruitmentPage from './pages/recruitment/RecruitmentPage'
import RecruitmentDetailPage from './pages/recruitment/RecruitmentDetailPage'
import ApplicationsPage from './pages/recruitment/ApplicationsPage'
import MessagesPage from './pages/messages/MessagesPage'
import ChatPage from './pages/messages/ChatPage'
import EventsPage from './pages/events/EventsPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

function App() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
      </Route>

      {/* Protected Routes */}
      <Route element={user ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        
        {/* Teams */}
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:id" element={<TeamDetailPage />} />
        <Route path="/teams/create" element={<CreateTeamPage />} />
        
        {/* Recruitment */}
        <Route path="/recruitment" element={<RecruitmentPage />} />
        <Route path="/recruitment/:id" element={<RecruitmentDetailPage />} />
        <Route path="/recruitment/applications" element={<ApplicationsPage />} />
        
        {/* Messages */}
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<ChatPage />} />
        
        {/* Events */}
        <Route path="/events" element={<EventsPage />} />
        
        {/* Admin */}
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
