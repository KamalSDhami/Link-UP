import { NavLink, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageCircle,
  Calendar,
  CalendarClock,
  Shield,
  UserCircle,
  UserCog,
  ShieldCheck,
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
  {
    name: 'Admin dashboard',
    to: '/admin',
    icon: Shield,
    allowedRoles: ['super_admin', 'moderator', 'event_manager'],
  },
  {
    name: 'Event management',
    to: '/events/manage',
    icon: CalendarClock,
    allowedRoles: ['super_admin', 'event_manager'],
  },
  {
    name: 'User directory',
    to: '/admin/users',
    icon: UserCog,
    allowedRoles: ['super_admin'],
  },
  {
    name: 'Moderation',
    to: '/admin/moderation',
    icon: ShieldCheck,
    allowedRoles: ['super_admin', 'moderator'],
  },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const [isVerified, setIsVerified] = useState(true) // Default to true to hide prompt initially
  const adminLinks = user
    ? adminNavigation.filter((entry) => entry.allowedRoles.includes(user.role))
    : []
  const showAdminLinks = adminLinks.length > 0

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
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:pt-16 sidebar">
        <div className="flex-1 flex flex-col min-h-0 sidebar__panel">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx('sidebar__item text-sm font-medium', {
                      'sidebar__item--active': isActive,
                    })
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={clsx('sidebar__item-icon h-5 w-5 mr-3', {
                        'text-accent': isActive,
                      })} />
                      {item.name}
                    </>
                  )}
                </NavLink>
              ))}

              {showAdminLinks && (
                <div className="pt-6 mt-6 border-t border-[color:var(--color-border)]">
                  <p className="px-3 text-xs font-semibold sidebar__section-title mb-2">
                    Administration
                  </p>
                  {adminLinks.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.to}
                      className={({ isActive }) =>
                        clsx('sidebar__item text-sm font-medium', {
                          'sidebar__item--active': isActive,
                        })
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={clsx('sidebar__item-icon h-5 w-5 mr-3', {
                            'text-accent': isActive,
                          })} />
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
            <div className="callout m-3">
              <p className="text-xs font-medium">
                Verify your GEHU email to unlock recruitment features
              </p>
              <Link
                to="/profile?verify=1"
                className="mt-2 inline-block text-xs font-semibold text-accent-light"
              >
                Verify Now →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[var(--color-bg)] border-t border-[color:var(--color-border)] z-50">
        <nav className="flex justify-around">
          {navigation.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-secondary hover:text-primary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={clsx('h-6 w-6 mb-1', isActive ? 'text-accent' : 'text-secondary')}
                  />
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
