import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useThemeStore } from '@/store/themeStore'

export default function MainLayout() {
  const theme = useThemeStore((state) => state.theme)
  const location = useLocation()
  const inAdminMode = location.pathname.startsWith('/admin')
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 flex-1 overflow-x-hidden p-6 pb-28 lg:ml-64 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <footer
        className={`border-t ${
          inAdminMode
            ? 'border-slate-800 bg-slate-900 text-slate-300'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">
            {inAdminMode ? 'Admin mode active' : 'Linkup platform'}
          </p>
          <p>
            {inAdminMode
              ? 'Changes here affect every student workspace. Remember to review activity logs and sign out when done.'
              : `Built for collaborative teams at GEHU · © ${currentYear}`}
          </p>
        </div>
      </footer>
    </div>
  )
}
