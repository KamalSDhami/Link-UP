import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  MessageCircle, 
  Calendar,
  Shield,
  UserCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Teams', to: '/teams', icon: Users },
  { name: 'Recruitment', to: '/recruitment', icon: Briefcase },
  { name: 'Messages', to: '/messages', icon: MessageCircle },
  { name: 'Events', to: '/events', icon: Calendar },
  { name: 'Profile', to: '/profile', icon: UserCircle },
]

const adminNavigation = [
  { name: 'Admin', to: '/admin', icon: Shield },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const [isVerified, setIsVerified] = useState(true) // Default to true to hide prompt initially
  const isAdmin = user?.role === 'super_admin' || user?.role === 'moderator'

  useEffect(() => {
    const checkVerification = async () => {
      if (!user) return
      
      const { data } = await supabase
        .from('users')
        .select('gehu_verified')
        .eq('id', user.id)
        .single<{ gehu_verified: boolean }>()
      
      if (data) {
        setIsVerified(data.gehu_verified)
      }
    }
    
    checkVerification()
  }, [user])

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:pt-16">
        <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-slate-200">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`mr-3 h-5 w-5 flex-shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'
                        }`}
                      />
                      {item.name}
                    </>
                  )}
                </NavLink>
              ))}

              {isAdmin && (
                <div className="pt-6 mt-6 border-t border-slate-200">
                  <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Administration
                  </p>
                  {adminNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.to}
                      className={({ isActive }) =>
                        `group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-accent-600 to-accent-500 text-white shadow-lg'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={`mr-3 h-5 w-5 flex-shrink-0 ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'
                            }`}
                          />
                          {item.name}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </nav>
          </div>

          {/* Verification Status */}
          {user && !isVerified && (
            <div className="p-4 m-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-medium text-yellow-800">
                Verify your GEHU email to unlock recruitment features
              </p>
              <NavLink
                to="/profile"
                className="text-xs font-semibold text-yellow-700 hover:text-yellow-900 mt-2 inline-block"
              >
                Verify Now →
              </NavLink>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50">
        <nav className="flex justify-around">
          {navigation.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`h-6 w-6 mb-1 ${isActive ? 'text-primary-600' : ''}`} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  )
}
