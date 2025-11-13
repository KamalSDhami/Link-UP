import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Tag,
  Radio,
  Search,
  Filter,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Event, EventRegistration } from '@/types'

type EventState = 'upcoming' | 'live' | 'ended' | 'cancelled'

interface EventRecord {
  event: Event
  state: EventState
  registration: EventRegistration | null
}

const EVENT_TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'competition', label: 'Competition' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'other', label: 'Other' },
]

const EVENT_STATE_LABELS: Record<EventState, { label: string; accent: string }> = {
  upcoming: { label: 'Upcoming', accent: 'text-blue-600 bg-blue-100' },
  live: { label: 'Live now', accent: 'text-emerald-600 bg-emerald-100' },
  ended: { label: 'Ended', accent: 'text-slate-600 bg-slate-200' },
  cancelled: { label: 'Cancelled', accent: 'text-red-600 bg-red-100' },
}

function computeEventState(evt: Event): EventState {
  if (evt.status === 'cancelled') {
    return 'cancelled'
  }

  const now = new Date()
  const start = new Date(evt.start_at)
  const end = new Date(evt.end_at)

  if (end.getTime() < now.getTime()) {
    return 'ended'
  }

  if (start.getTime() <= now.getTime() && end.getTime() >= now.getTime()) {
    return 'live'
  }

  return 'upcoming'
}

function formatDateRange(startISO: string, endISO: string) {
  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const start = new Date(startISO)
  const end = new Date(endISO)

  const sameDay = start.toDateString() === end.toDateString()

  if (sameDay) {
    return `${formatter.format(start)} – ${new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(end)}`
  }

  return `${formatter.format(start)} → ${formatter.format(end)}`
}

function describeRegistration(evt: Event) {
  if (evt.registration_type === 'open') {
    return 'Open access — no registration required'
  }

  if (evt.registration_flow === 'form_review') {
    return 'Registration via application form'
  }

  return 'Instant registration (auto approval)'
}

export default function EventsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<EventRecord[]>([])
  const [activeTab, setActiveTab] = useState<EventState>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })

      if (error) throw error

      const typedEvents = (eventsData || []) as Event[]

  let registrationsMap = new Map<string, EventRegistration | null>()

      if (user?.id) {
        const { data: registrationsData, error: registrationsError } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('user_id', user.id)

        if (registrationsError) throw registrationsError

        const typedRegistrations = (registrationsData || []) as EventRegistration[]
        registrationsMap = new Map(
          typedRegistrations.map((registration) => [registration.event_id, registration])
        )
      }

      const filtered = typedEvents
        .filter((evt) => {
          if (evt.status === 'draft' && evt.created_by !== user?.id && !['event_manager', 'super_admin', 'god'].includes(user?.role ?? '')) {
            return false
          }
          return true
        })
        .map<EventRecord>((evt) => ({
          event: evt,
          state: computeEventState(evt),
          registration: registrationsMap.get(evt.id) ?? null,
        }))

      setEvents(filtered)
    } catch (error: any) {
      console.error('Failed to load events', error)
      toast.error('Unable to load events right now')
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(
    () =>
      events.reduce(
        (acc, record) => {
          acc[record.state] = (acc[record.state] ?? 0) + 1
          return acc
        },
        { upcoming: 0, live: 0, ended: 0, cancelled: 0 } as Record<EventState, number>
      ),
    [events]
  )

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return events
      .filter((record) => record.state === activeTab)
      .filter((record) => (typeFilter === 'all' ? true : record.event.event_type === typeFilter))
      .filter((record) => {
        if (!query) return true

        const haystack = [
          record.event.title,
          record.event.summary,
          record.event.description,
          record.event.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })
  }, [events, activeTab, typeFilter, searchQuery])

  const isEventManager = user && ['event_manager', 'super_admin', 'god'].includes(user.role)

  const renderBadge = (record: EventRecord) => {
    const { accent, label } = EVENT_STATE_LABELS[record.state]
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>
        {label}
      </span>
    )
  }

  const tabItems: EventState[] = ['upcoming', 'live', 'ended', 'cancelled']

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Events &amp; Opportunities</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Discover upcoming events, live sessions, and recaps tailored for GEHU students.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isEventManager && (
            <>
              <Link to="/events/manage" className="btn-secondary hidden md:inline-flex">
                <Radio className="mr-2 h-4 w-4" />
                Manage events
              </Link>
              <Link to="/events/manage" className="btn-primary inline-flex md:hidden">
                <Radio className="mr-2 h-4 w-4" />
                Manage
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="input-field pl-9"
                placeholder="Search events, speakers, or locations"
              />
            </div>
            <div className="relative sm:w-48">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="input-field appearance-none pl-9 pr-8"
              >
                {EVENT_TYPE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabItems.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="rounded-full border px-4 py-2 text-sm font-medium transition-all"
              style={
                activeTab === tab
                  ? {
                      borderColor: 'var(--accent)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--accent)',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    }
                  : {
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              <span className="mr-2">{EVENT_STATE_LABELS[tab].label}</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--accent)' }}>
                {counts[tab] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="h-12 w-12" style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>No events in this section yet</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Try exploring another category or check back later for new announcements.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredEvents.map((record) => (
            <div key={record.event.id} className="card flex flex-col gap-4 border-l-4" style={{ borderColor: 'transparent', borderLeftColor: 'var(--accent)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {renderBadge(record)}
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--text-primary)' }}>
                      {record.event.event_type.replace('_', ' ')}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--text-primary)' }}>
                      {record.event.visibility === 'public' ? 'Public' : 'Campus only'}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{record.event.title}</h3>
                  {record.event.summary && (
                    <p className="mt-2 text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{record.event.summary}</p>
                  )}
                </div>
                {record.event.banner_url && (
                  <img
                    src={record.event.banner_url}
                    alt={record.event.title}
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                  />)
                }
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>{formatDateRange(record.event.start_at, record.event.end_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>{describeRegistration(record.event)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>{record.event.location || (record.event.event_mode === 'online' ? 'Online session' : 'Location coming soon')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>
                    {record.event.max_participants ? `${record.event.max_participants} seats` : 'Unlimited capacity'}
                  </span>
                </div>
              </div>

              {record.registration && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--accent)' }}>
                  <div className="font-medium">
                    You are {record.registration.status === 'approved' ? 'registered' : record.registration.status} for this event.
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Submitted on {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.registration.submitted_at))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/events/${record.event.id}`}
                  className="btn-primary inline-flex items-center"
                >
                  View details
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>

                {record.event.registration_type === 'registration_required' && !record.registration && (
                  <Link
                    to={`/events/${record.event.id}#register`}
                    className="btn-secondary inline-flex items-center"
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    Register now
                  </Link>
                )}

                {isEventManager && record.event.created_by === user?.id && (
                  <Link
                    to={`/events/manage?event=${record.event.id}`}
                    className="btn-ghost inline-flex items-center text-sm"
                    style={{ color: 'var(--accent)' }}
                  >
                    Manage event
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
