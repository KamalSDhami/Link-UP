import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  BellRing,
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type UserRow = TableRow<'users'>

const managementShortcuts = [
  {
    title: 'User directory',
    description: 'Suspend accounts, adjust roles, and verify identities.',
    to: '/admin/users',
    icon: Users,
  },
  {
    title: 'Content moderation',
    description: 'Review reports and manage team or chat activity.',
    to: '/admin/moderation',
    icon: ShieldCheck,
  },
  {
    title: 'Events & announcements',
    description: 'Publish campus events and notify targeted cohorts.',
    to: '/admin/events',
    icon: BellRing,
  },
  {
    title: 'System settings',
    description: 'Configure platform policies, feature flags, and integrations.',
    to: '/admin/settings',
    icon: Settings,
  },
]

const checklistItems = [
  {
    title: 'Verify new moderators',
    note: 'Ensure elevated roles belong to trusted staff.',
  },
  {
    title: 'Confirm backups are recent',
    note: 'Review automated exports from Supabase or storage providers.',
  },
  {
    title: 'Audit recruitment posts',
    note: 'Archive expired listings and highlight fresh opportunities.',
  },
]

const recentActivity = [
  {
    category: 'Access',
    detail: 'Role change requested for john.doe@campus.edu',
    timestamp: '2 hours ago',
  },
  {
    category: 'System',
    detail: 'Nightly database snapshot completed successfully.',
    timestamp: '8 hours ago',
  },
  {
    category: 'Moderation',
    detail: 'New report on “AI Study Group” discussion thread.',
    timestamp: 'Yesterday',
  },
]

export default function AdminDashboardPage() {
  const { user } = useAuthStore()
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [recentUsersLoading, setRecentUsersLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    userCount: null as number | null,
    activeTeamCount: null as number | null,
    openRecruitments: null as number | null,
    pendingReports: null as number | null,
  })
  const [recentUsers, setRecentUsers] = useState<UserRow[]>([])

  if (!user) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Admin access required</h1>
        <p className="text-slate-600">Sign in with an administrator account to manage the platform.</p>
      </div>
    )
  }

  const isAdmin = ['super_admin', 'moderator', 'event_manager'].includes(user.role)

  useEffect(() => {
    if (!isAdmin) return

    const loadMetrics = async () => {
      setMetricsLoading(true)
      try {
        const { count: totalUsers, error: userCountError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        if (userCountError) throw userCountError

        const { count: activeTeams, error: teamError } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .gte('member_count', 1)

        if (teamError) throw teamError

        const { count: openRecruitments, error: recruitmentError } = await supabase
          .from('recruitment_posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')

        if (recruitmentError) throw recruitmentError

        const { count: pendingReports, error: reportsError } = await supabase
          .from('message_reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        if (reportsError) throw reportsError

        setMetrics({
          userCount: totalUsers ?? 0,
          activeTeamCount: activeTeams ?? 0,
          openRecruitments: openRecruitments ?? 0,
          pendingReports: pendingReports ?? 0,
        })
      } catch (error: any) {
        console.error('Failed to load admin metrics:', error)
        toast.error(error?.message || 'Unable to load admin metrics')
        setMetrics((previous) => ({ ...previous, userCount: null, activeTeamCount: null, openRecruitments: null, pendingReports: null }))
      } finally {
        setMetricsLoading(false)
      }
    }

    const loadRecentUsers = async () => {
      setRecentUsersLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, role, gehu_verified, created_at')
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) throw error

        setRecentUsers((data as UserRow[] | null) ?? [])
      } catch (error: any) {
        console.error('Failed to load recent users:', error)
        toast.error(error?.message || 'Unable to load user list')
        setRecentUsers([])
      } finally {
        setRecentUsersLoading(false)
      }
    }

    loadMetrics()
    loadRecentUsers()
  }, [isAdmin])

  const formatStatValue = (value: number | null) => {
    if (metricsLoading) return '…'
    if (value === null) return '—'
    return value.toLocaleString()
  }

  const quickStats = useMemo(
    () => [
      {
        id: 'users',
        label: 'Total users',
        value: formatStatValue(metrics.userCount),
        description: 'All registered student and staff accounts.',
        icon: Users,
      },
      {
        id: 'teams',
        label: 'Active teams',
        value: formatStatValue(metrics.activeTeamCount),
        description: 'Teams with at least one member onboard.',
        icon: ShieldCheck,
      },
      {
        id: 'recruitment',
        label: 'Open recruitments',
        value: formatStatValue(metrics.openRecruitments),
        description: 'Live opportunities students can apply to.',
        icon: FileText,
      },
      {
        id: 'alerts',
        label: 'Pending reports',
        value: formatStatValue(metrics.pendingReports),
        description: 'Messages flagged and awaiting moderator review.',
        icon: AlertTriangle,
      },
    ],
    [metrics, metricsLoading]
  )

  const formatJoined = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">
          Your account does not have access to the administration console. Contact a site administrator if you believe
          this is an error.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide text-primary-600">Administration</p>
        <h1 className="text-3xl font-display font-bold text-slate-900">Control center</h1>
        <p className="max-w-3xl text-slate-600">
          Monitor platform activity, manage community safety, and configure features. Key metrics refresh each time you
          open the console.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Snapshot</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.id} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</span>
                  <span className="rounded-full bg-primary-50 p-2 text-primary-600">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">System health</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Database className="h-4 w-4 text-primary-500" />
                Database status
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Connect Supabase health checks to confirm replication and RLS policies are in place.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Activity className="h-4 w-4 text-emerald-500" />
                Real-time feeds
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Highlight websocket uptime and connected clients once monitoring is hooked in.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BellRing className="h-4 w-4 text-amber-500" />
              Notifications queue
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Track queued push or email campaigns to ensure users receive timely updates.
            </p>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Details</th>
                  <th className="px-4 py-2 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentActivity.map((entry, index) => (
                  <tr key={`${entry.category}-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{entry.category}</td>
                    <td className="px-4 py-3 text-slate-700">{entry.detail}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{entry.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Replace these placeholders with audit log events sourced from Supabase once logging endpoints are ready.
          </p>
        </div>
      </section>

      <section id="users" className="card space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">User management</h2>
          </div>
          <Link
            to="/admin#users"
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-1.5 text-sm font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
          >
            View full directory
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {recentUsersLoading ? (
            <div className="flex items-center justify-center px-4 py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentUsers.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No users found. Invite students to start building the community.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentUsers.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">{entry.name || 'Unnamed user'}</td>
                    <td className="px-4 py-3 text-slate-600">{entry.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 capitalize">
                        {entry.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.gehu_verified ? (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatJoined(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Management shortcuts</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {managementShortcuts.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.title}
                  to={action.to}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 transition hover:border-primary-200 hover:bg-primary-50"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Icon className="h-4 w-4 text-primary-500" />
                    {action.title}
                  </span>
                  <span className="text-xs text-slate-500">{action.description}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Weekly checklist</h2>
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            {checklistItems.map((item) => (
              <li key={item.title} className="rounded-lg border border-slate-200 p-3">
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
