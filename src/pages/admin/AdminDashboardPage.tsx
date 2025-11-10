import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BellRing,
  Database,
  FileText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'

const quickStats = [
  {
    id: 'users',
    label: 'Total users',
    value: '—',
    trend: 'Collect metrics once analytics is wired in.',
    icon: Users,
  },
  {
    id: 'teams',
    label: 'Active teams',
    value: '—',
    trend: 'Connect to team roster counts.',
    icon: ShieldCheck,
  },
  {
    id: 'recruitment',
    label: 'Open recruitments',
    value: '—',
    trend: 'Surface active postings here.',
    icon: FileText,
  },
  {
    id: 'alerts',
    label: 'Pending reports',
    value: '0',
    trend: 'Route moderation queue once available.',
    icon: AlertTriangle,
  },
]

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

  if (!user) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Admin access required</h1>
        <p className="text-slate-600">Sign in with an administrator account to manage the platform.</p>
      </div>
    )
  }

  const isAdmin = ['super_admin', 'moderator', 'event_manager'].includes(user.role)

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
          Monitor platform activity, manage community safety, and configure features. This overview will populate with
          live data once analytics are wired in.
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
                <p className="text-xs text-slate-500">{stat.trend}</p>
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
