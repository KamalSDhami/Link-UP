import { Link } from 'react-router-dom'
import { Bell, User, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'

export default function Navbar() {
  const { user, signOut } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    if (!user) return

    // Fetch unread notifications count
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      setUnreadCount(count || 0)
    }

    fetchUnreadCount()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 glass">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">L</span>
            </div>
            <span className="text-2xl font-display font-bold text-gradient">Linkup</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 animate-in">
                  <div className="px-4 py-2 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <NotificationsList userId={user?.id || ''} />
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {user?.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {user ? getInitials(user.name) : 'U'}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700 hidden md:block">
                  {user?.name}
                </span>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 animate-in">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-4 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">View Profile</span>
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center space-x-2 px-4 py-2 hover:bg-red-50 text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

function NotificationsList({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setNotifications(data || [])
      })
  }, [userId])

  if (notifications.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-slate-500">
        <p className="text-sm">No notifications yet</p>
      </div>
    )
  }

  return (
    <div>
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
            !notif.read ? 'bg-primary-50' : ''
          }`}
        >
          <p className="text-sm font-medium text-slate-900">{notif.title}</p>
          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
        </div>
      ))}
    </div>
  )
}
