import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, 
  Briefcase, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  UserPlus,
  FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// Helper function to convert name to title case
const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface DashboardStats {
  teamCount: number
  applicationCount: number
  unreadMessages: number
  recruitmentPosts: number
}

interface UserProfile {
  name: string
  section: string | null
  year: number | null
  gehu_verified: boolean
  skills: string[]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    teamCount: 0,
    applicationCount: 0,
    unreadMessages: 0,
    recruitmentPosts: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      // Load all data in parallel for faster loading
      const [
        { data: profileData },
        { count: teamCount },
        { count: applicationCount },
        { count: unreadMessages },
        { count: recruitmentPosts }
      ] = await Promise.all([
        // Load user profile
        supabase
          .from('users')
          .select('name, section, year, gehu_verified, skills')
          .eq('id', user.id)
          .single(),
        
        // Load team count
        supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Load application count
        supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('applicant_id', user.id),
        
        // Load unread notifications count
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
        
        // Load active recruitment posts count
        supabase
          .from('recruitment_posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
      ])

      if (profileData) {
        setProfile(profileData)
      }

      setStats({
        teamCount: teamCount || 0,
        applicationCount: applicationCount || 0,
        unreadMessages: unreadMessages || 0,
        recruitmentPosts: recruitmentPosts || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const isProfileComplete = profile?.section && profile?.year && profile.skills.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="card bg-gradient-to-r from-primary-600 to-accent-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">
              Welcome back, {profile?.name ? toTitleCase(profile.name) : 'User'}! 👋
            </h1>
            <p className="text-primary-100">
              {isProfileComplete
                ? 'Your profile is complete. Start exploring teams!'
                : 'Please complete your profile to unlock all features'}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Users className="w-12 h-12" />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion Alert */}
      {!isProfileComplete && (
        <div className="card bg-amber-50 border-2 border-amber-200 animate-slide-in">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">
                Complete Your Profile
              </h3>
              <p className="text-amber-700 text-sm mb-3">
                Add your year, section, and skills to start creating or joining teams
              </p>
              <Link
                to="/profile-setup"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
              >
                Complete Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.teamCount}</h3>
          <p className="text-slate-600 text-sm">Your Teams</p>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.applicationCount}</h3>
          <p className="text-slate-600 text-sm">Applications Sent</p>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            {stats.unreadMessages > 0 && (
              <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                {stats.unreadMessages}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.unreadMessages}</h3>
          <p className="text-slate-600 text-sm">Unread Notifications</p>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{stats.recruitmentPosts}</h3>
          <p className="text-slate-600 text-sm">Open Positions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-display font-bold text-slate-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/teams"
            className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Browse Teams</h3>
              <p className="text-sm text-slate-600">Find your perfect team</p>
            </div>
          </Link>

          <Link
            to="/teams/create"
            className="flex items-center gap-4 p-4 bg-gradient-to-br from-accent-50 to-accent-100 rounded-xl hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-accent-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Create Team</h3>
              <p className="text-sm text-slate-600">Start your own team</p>
            </div>
          </Link>

          <Link
            to="/recruitment"
            className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Find Opportunities</h3>
              <p className="text-sm text-slate-600">Browse open positions</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Profile Summary */}
      {isProfileComplete && (
        <div className="card">
          <h2 className="text-xl font-display font-bold text-slate-900 mb-4">
            Your Profile
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-slate-700">
                Year {profile.year} · Section {profile.section}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {profile.gehu_verified ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-slate-700">GEHU Email Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className="text-slate-700">
                    GEHU Email Not Verified ·{' '}
                    <Link to="/settings" className="text-primary-600 hover:underline">
                      Verify Now
                    </Link>
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

