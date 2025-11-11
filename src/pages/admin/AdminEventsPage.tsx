import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Filter,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  StepForward,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type {
  Event,
  EventPoll,
  EventPollOption,
  EventPollVote,
  EventRegistration,
  User,
} from '@/types'
import type { TableInsert, TableUpdate } from '@/types/database'

type LifecycleStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
type StatusFilter = 'all' | LifecycleStatus
type VisibilityFilter = 'all' | Event['visibility']

type RegistrationStatus = EventRegistration['status']

interface RegistrationSummary {
  total: number
  pending: number
  approved: number
  waitlisted: number
  rejected: number
  cancelled: number
}

interface PollSummary {
  total: number
  published: number
  totalVotes: number
}

interface AdminEventRecord {
  event: Event
  registrationSummary: RegistrationSummary
  pollSummary: PollSummary
}

interface RegistrationWithUser extends EventRegistration {
  attendee: Pick<User, 'id' | 'name' | 'email' | 'section' | 'year'> | null
  reviewer: Pick<User, 'id' | 'name'> | null
}

interface PollWithRelations extends EventPoll {
  event_poll_options: EventPollOption[]
  event_poll_votes: EventPollVote[]
}

interface EventFormState {
  title: string
  summary: string
  description: string
  eventType: Event['event_type']
  eventMode: Event['event_mode']
  location: string
  meetingLink: string
  bannerUrl: string
  startAt: string
  endAt: string
  registrationRequired: boolean
  registrationFlow: Event['registration_flow']
  maxParticipants: string
  allowWaitlist: boolean
  autoClose: boolean
  visibility: Event['visibility']
  registrationOpensAt: string
  registrationClosesAt: string
}

interface PollDraftState {
  question: string
  description: string
  opensAt: string
  closesAt: string
  isPublished: boolean
}

const REGISTRATION_TABS: Array<{ value: 'all' | 'approved' | 'pending' | 'waitlisted' | 'rejected'; label: string }> = [
  { value: 'all', label: 'All registrations' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'waitlisted', label: 'Waitlist' },
  { value: 'rejected', label: 'Rejected' },
]

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const VISIBILITY_FILTERS: Array<{ value: VisibilityFilter; label: string }> = [
  { value: 'all', label: 'All visibility' },
  { value: 'campus', label: 'Campus only' },
  { value: 'public', label: 'Public' },
]

const LIFECYCLE_META: Record<LifecycleStatus, { label: string; border: string; tint: string; text: string }> = {
  scheduled: {
    label: 'Scheduled',
    border: 'rgba(255,138,0,0.35)',
    tint: 'rgba(255,138,0,0.12)',
    text: '#FFB56B',
  },
  ongoing: {
    label: 'Ongoing',
    border: 'rgba(39,174,96,0.45)',
    tint: 'rgba(39,174,96,0.14)',
    text: '#6CE3A0',
  },
  completed: {
    label: 'Completed',
    border: 'rgba(94,106,210,0.4)',
    tint: 'rgba(94,106,210,0.15)',
    text: '#B5BFFF',
  },
  cancelled: {
    label: 'Cancelled',
    border: 'rgba(224,36,36,0.4)',
    tint: 'rgba(224,36,36,0.16)',
    text: '#FCA5A5',
  },
}

const REGISTRATION_STATUS_META: Record<RegistrationStatus, { label: string; background: string; color: string }> = {
  pending: { label: 'Pending', background: 'rgba(255,181,71,0.15)', color: '#FFB547' },
  approved: { label: 'Approved', background: 'rgba(39,174,96,0.16)', color: '#6CE3A0' },
  waitlisted: { label: 'Waitlisted', background: 'rgba(94,106,210,0.15)', color: '#B5BFFF' },
  rejected: { label: 'Rejected', background: 'rgba(224,36,36,0.18)', color: '#FCA5A5' },
  cancelled: { label: 'Cancelled', background: 'rgba(148,163,184,0.18)', color: '#CBD5F5' },
}

const EMPTY_REGISTRATION_SUMMARY: RegistrationSummary = {
  total: 0,
  pending: 0,
  approved: 0,
  waitlisted: 0,
  rejected: 0,
  cancelled: 0,
}
const EMPTY_POLL_SUMMARY: PollSummary = {
  total: 0,
  published: 0,
  totalVotes: 0,
}
const DEFAULT_EVENT_FORM: EventFormState = {
  title: '',
  summary: '',
  description: '',
  eventType: 'hackathon',
  eventMode: 'in_person',
  location: '',
  meetingLink: '',
  bannerUrl: '',
  startAt: '',
  endAt: '',
  registrationRequired: true,
  registrationFlow: 'auto_approval',
  maxParticipants: '',
  allowWaitlist: true,
  autoClose: true,
  visibility: 'campus',
  registrationOpensAt: '',
  registrationClosesAt: '',
}
const DEFAULT_POLL_DRAFT: PollDraftState = {
  question: '',
  description: '',
  opensAt: '',
  closesAt: '',
  isPublished: true,
}
function createRegistrationSummary(): RegistrationSummary {
  return { ...EMPTY_REGISTRATION_SUMMARY }
}
function createPollSummary(): PollSummary {
  return { ...EMPTY_POLL_SUMMARY }
}
function resolveLifecycleStatus(event: Event): LifecycleStatus {
  if (event.status === 'cancelled') return 'cancelled'
  const now = Date.now()
  const start = new Date(event.start_at).getTime()
  const end = new Date(event.end_at).getTime()
  if (event.status === 'ended' || end < now) {
    return 'completed'
  }
  if (event.status === 'live' || (start <= now && end >= now)) {
    return 'ongoing'
  }
  return 'scheduled'
}
function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const sameDay = start.toDateString() === end.toDateString()
  const dateFormatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (sameDay) {
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
  }
  return `${dateFormatter.format(start)} → ${dateFormatter.format(end)}`
}
function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return '—'
  const formatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return formatter.format(new Date(iso))
}
function formatRelativeDistance(iso: string | null | undefined) {
  if (!iso) return 'Unknown'
  const now = Date.now()
  const target = new Date(iso).getTime()
  const delta = target - now
  const absDelta = Math.abs(delta)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (absDelta < hour) {
    return rtf.format(Math.round(delta / minute), 'minute')
  }
  if (absDelta < day) {
    return rtf.format(Math.round(delta / hour), 'hour')
  }
  return rtf.format(Math.round(delta / day), 'day')
}
function toISO(value: string) {
  return value ? new Date(value).toISOString() : null
}
function toLocalInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function formatMode(mode: Event['event_mode']) {
  switch (mode) {
    case 'in_person':
      return 'On campus'
    case 'online':
      return 'Online'
    case 'hybrid':
      return 'Hybrid'
    default:
      return mode
  }
}

function formatVisibility(visibility: Event['visibility']) {
  return visibility === 'public' ? 'Public' : 'Campus only'
}

function formatEventType(type: Event['event_type']) {
  return type.replace(/_/g, ' ')
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`
}

function useFocusTrap<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    const container = containerRef.current
    const firstFocusable = container?.querySelector<HTMLElement>(focusableSelectors)
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [isOpen, onClose])

  return containerRef
}

interface ModalShellProps {
  title: string
  subtitle?: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  widthClass?: string
}

function ModalShell({ title, subtitle, open, onClose, children, widthClass = 'max-w-4xl' }: ModalShellProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(12, 12, 12, 0.78)', backdropFilter: 'blur(18px)' }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClass} rounded-3xl border p-6 shadow-2xl`}
        style={{
          background: 'rgba(21, 21, 21, 0.95)',
          borderColor: 'rgba(255, 138, 0, 0.25)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,138,0,0.45)]"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 max-h-[78vh] overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  )
}

export default function AdminEventsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create')
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventFormState, setEventFormState] = useState<EventFormState>(DEFAULT_EVENT_FORM)
  const [eventFormTab, setEventFormTab] = useState<'basic' | 'schedule' | 'registration' | 'visibility'>('basic')

  const [showPollsModal, setShowPollsModal] = useState(false)
  const [pollsLoading, setPollsLoading] = useState(false)
  const [polls, setPolls] = useState<PollWithRelations[]>([])
  const [pollDraft, setPollDraft] = useState<PollDraftState>(DEFAULT_POLL_DRAFT)
  const [pollOptions, setPollOptions] = useState<string[]>([])
  const [pollOptionInput, setPollOptionInput] = useState('')
  const [pollFormMode, setPollFormMode] = useState<'create' | 'edit'>('create')
  const [pollEditTarget, setPollEditTarget] = useState<PollWithRelations | null>(null)
  const [pollSaving, setPollSaving] = useState(false)

  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participants, setParticipants] = useState<RegistrationWithUser[]>([])
  const [participantTab, setParticipantTab] = useState<(typeof REGISTRATION_TABS)[number]['value']>('all')

  const [deleteTarget, setDeleteTarget] = useState<AdminEventRecord | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingEvent, setDeletingEvent] = useState(false)

  const isEventManager = user && ['event_manager', 'super_admin'].includes(user.role)

  const loadEvents = useCallback(async () => {
    if (!isEventManager) return
    setLoading(true)
    try {
      const { data: rawEvents, error } = await supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })

      if (error) throw error

      const typedEvents = (rawEvents || []) as Event[]

      const [registrationsRes, pollsRes] = await Promise.all([
        supabase.from('event_registrations').select('event_id, status'),
        supabase
          .from('event_polls')
          .select('*, event_poll_options(*), event_poll_votes(*)'),
      ])

      const registrationSummaryMap = new Map<string, RegistrationSummary>()
      if (registrationsRes.data) {
        const rows = registrationsRes.data as Array<Pick<EventRegistration, 'event_id' | 'status'>>
        rows.forEach((row) => {
          const summary = registrationSummaryMap.get(row.event_id) ?? createRegistrationSummary()
          summary.total += 1
          if (row.status === 'pending') summary.pending += 1
          if (row.status === 'approved') summary.approved += 1
          if (row.status === 'waitlisted') summary.waitlisted += 1
          if (row.status === 'rejected') summary.rejected += 1
          if (row.status === 'cancelled') summary.cancelled += 1
          registrationSummaryMap.set(row.event_id, summary)
        })
      }

      const pollSummaryMap = new Map<string, PollSummary>()
      if (pollsRes.data) {
        const pollRows = (pollsRes.data || []) as PollWithRelations[]
        pollRows.forEach((poll) => {
          const summary = pollSummaryMap.get(poll.event_id) ?? createPollSummary()
          summary.total += 1
          if (poll.is_published) summary.published += 1
          summary.totalVotes += poll.event_poll_votes.length
          pollSummaryMap.set(poll.event_id, summary)
        })
      }

      const records: AdminEventRecord[] = typedEvents.map((event) => ({
        event,
        registrationSummary: registrationSummaryMap.get(event.id) ?? createRegistrationSummary(),
        pollSummary: pollSummaryMap.get(event.id) ?? createPollSummary(),
      }))

      setEvents(records)

      if (records.length > 0 && !selectedEventId) {
        setSelectedEventId(records[0].event.id)
      }
    } catch (error: any) {
      console.error('Failed to load events', error)
      toast.error(error?.message || 'Unable to load events right now')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [isEventManager, selectedEventId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const selectedRecord = useMemo(
    () => events.find((record) => record.event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events
      .filter((record) => {
        const lifecycle = resolveLifecycleStatus(record.event)
        if (statusFilter !== 'all' && lifecycle !== statusFilter) return false
        if (visibilityFilter !== 'all' && record.event.visibility !== visibilityFilter) return false

        if (!query) return true
        const haystack = [
          record.event.title,
          record.event.summary,
          record.event.event_type,
          record.event.event_mode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })
      .sort((a, b) => new Date(a.event.start_at).getTime() - new Date(b.event.start_at).getTime())
  }, [events, search, statusFilter, visibilityFilter])

  const openCreateModal = () => {
    setEventModalMode('create')
    setEventFormState(DEFAULT_EVENT_FORM)
    setEventFormTab('basic')
    setShowEventModal(true)
  }

  const openEditModal = () => {
    if (!selectedRecord) return
    const event = selectedRecord.event
    setEventModalMode('edit')
    setEventFormState({
      title: event.title ?? '',
      summary: event.summary ?? '',
      description: event.description ?? '',
      eventType: event.event_type,
      eventMode: event.event_mode,
      location: event.location ?? '',
      meetingLink: event.meeting_link ?? '',
      bannerUrl: event.banner_url ?? '',
      startAt: toLocalInput(event.start_at),
      endAt: toLocalInput(event.end_at),
      registrationRequired: event.registration_type !== 'open',
      registrationFlow: event.registration_flow,
      maxParticipants: event.max_participants ? String(event.max_participants) : '',
      allowWaitlist: event.allow_waitlist,
      autoClose: event.auto_close,
      visibility: event.visibility,
      registrationOpensAt: toLocalInput(event.registration_opens_at),
      registrationClosesAt: toLocalInput(event.registration_closes_at),
    })
    setEventFormTab('basic')
    setShowEventModal(true)
  }

  const handleSaveEvent = async () => {
    if (!user) return
    if (!eventFormState.title.trim()) {
      toast.error('Event title is required')
      return
    }
    if (!eventFormState.startAt || !eventFormState.endAt) {
      toast.error('Provide start and end timings')
      return
    }

    const startISO = toISO(eventFormState.startAt)
    const endISO = toISO(eventFormState.endAt)

    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) {
      toast.error('End time must be after the start time')
      return
    }

    const registrationType: Event['registration_type'] = eventFormState.registrationRequired
      ? 'registration_required'
      : 'open'

    const registrationFlow: Event['registration_flow'] = !eventFormState.registrationRequired
      ? 'auto_approval'
      : eventFormState.registrationFlow

    const payload = {
      title: eventFormState.title.trim(),
      summary: eventFormState.summary.trim() || null,
      description: eventFormState.description.trim() || null,
      event_type: eventFormState.eventType,
      event_mode: eventFormState.eventMode,
      location: eventFormState.location.trim() || null,
      meeting_link: eventFormState.meetingLink.trim() || null,
      banner_url: eventFormState.bannerUrl.trim() || null,
      start_at: startISO,
      end_at: endISO,
      registration_type: registrationType,
      registration_flow: registrationFlow,
      registration_opens_at: eventFormState.registrationOpensAt ? toISO(eventFormState.registrationOpensAt) : null,
      registration_closes_at: eventFormState.registrationClosesAt ? toISO(eventFormState.registrationClosesAt) : null,
      max_participants: eventFormState.maxParticipants ? Number(eventFormState.maxParticipants) : null,
      allow_waitlist: eventFormState.allowWaitlist,
      auto_close: eventFormState.autoClose,
      visibility: eventFormState.visibility,
    }

    setSavingEvent(true)
    try {
      if (eventModalMode === 'create') {
        const insertPayload: TableInsert<'events'> = {
          ...payload,
          created_by: user.id,
          status: new Date(startISO).getTime() <= Date.now() ? 'live' : 'scheduled',
          requires_gehu_verification: true,
        }

        const { data, error } = await supabase
          .from('events')
          .insert(insertPayload as never)
          .select('*')
          .single()

        if (error) throw error

        const createdEvent = data as Event
        toast.success('Event created successfully')
        setShowEventModal(false)
        setEventFormState(DEFAULT_EVENT_FORM)
        await loadEvents()
        setSelectedEventId(createdEvent.id)
        setViewMode('detail')
      } else if (selectedRecord) {
        const updates: TableUpdate<'events'> = {
          ...payload,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('events')
          .update(updates as never)
          .eq('id', selectedRecord.event.id)

        if (error) throw error

        toast.success('Event updated')
        setShowEventModal(false)
        await loadEvents()
      }
    } catch (error: any) {
      console.error('Failed to save event', error)
      toast.error(error?.message || 'Unable to save event')
    } finally {
      setSavingEvent(false)
    }
  }

  const handleCancelEvent = async (record: AdminEventRecord) => {
    const lifecycle = resolveLifecycleStatus(record.event)
    if (lifecycle === 'cancelled') {
      toast.error('Event is already cancelled')
      return
    }

    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
        .eq('id', record.event.id)

      if (error) throw error

      toast.success('Event cancelled')
      await loadEvents()
    } catch (error: any) {
      console.error('Failed to cancel event', error)
      toast.error(error?.message || 'Unable to cancel event')
    }
  }

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm removal')
      return
    }

    setDeletingEvent(true)
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deleteTarget.event.id)

      if (error) throw error

      toast.success('Event deleted')
      setDeleteTarget(null)
      setDeleteConfirmation('')
      if (selectedEventId === deleteTarget.event.id) {
        setSelectedEventId(null)
        setViewMode('list')
      }
      await loadEvents()
    } catch (error: any) {
      console.error('Failed to remove event', error)
      toast.error(error?.message || 'Unable to delete event')
    } finally {
      setDeletingEvent(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadEvents()
    setRefreshing(false)
  }

  const openDetailView = (record: AdminEventRecord) => {
    setSelectedEventId(record.event.id)
    setViewMode('detail')
  }

  const backToList = () => {
    setViewMode('list')
  }

  const resetPollForm = () => {
    setPollDraft(DEFAULT_POLL_DRAFT)
    setPollOptions([])
    setPollOptionInput('')
    setPollFormMode('create')
    setPollEditTarget(null)
  }

  const loadPolls = useCallback(
    async (eventId: string) => {
      setPollsLoading(true)
      try {
        const { data, error } = await supabase
          .from('event_polls')
          .select('*, event_poll_options(*), event_poll_votes(*)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })

        if (error) throw error

        setPolls((data || []) as PollWithRelations[])
      } catch (error: any) {
        console.error('Failed to load polls', error)
        toast.error(error?.message || 'Unable to load polls')
        setPolls([])
      } finally {
        setPollsLoading(false)
      }
    },
    []
  )

  const openPollsManager = async () => {
    if (!selectedRecord) return
    resetPollForm()
    await loadPolls(selectedRecord.event.id)
    setShowPollsModal(true)
  }

  const handleSubmitPoll = async () => {
    if (!selectedRecord || !user) return
    if (!pollDraft.question.trim()) {
      toast.error('Poll question is required')
      return
    }
    if (pollOptions.length < 2) {
      toast.error('Add at least two options')
      return
    }

    setPollSaving(true)
    try {
      if (pollFormMode === 'create') {
        const payload: TableInsert<'event_polls'> = {
          event_id: selectedRecord.event.id,
          question: pollDraft.question.trim(),
          description: pollDraft.description.trim() || null,
          mode: 'single_choice',
          is_anonymous: true,
          is_published: pollDraft.isPublished,
          opens_at: pollDraft.opensAt ? toISO(pollDraft.opensAt) : null,
          closes_at: pollDraft.closesAt ? toISO(pollDraft.closesAt) : null,
          created_by: user.id,
        }

        const { data, error } = await supabase
          .from('event_polls')
          .insert(payload as never)
          .select('id')
          .single()

        if (error) throw error

        const poll = data as Pick<EventPoll, 'id'>

        const optionPayload: TableInsert<'event_poll_options'>[] = pollOptions.map((option, index) => ({
          poll_id: poll.id,
          label: option,
          sort_order: index,
        }))

        const { error: optionsError } = await supabase
          .from('event_poll_options')
          .insert(optionPayload as never)

        if (optionsError) throw optionsError

        toast.success('Poll created')
      } else if (pollEditTarget) {
        const updates: TableUpdate<'event_polls'> = {
          question: pollDraft.question.trim(),
          description: pollDraft.description.trim() || null,
          is_published: pollDraft.isPublished,
          opens_at: pollDraft.opensAt ? toISO(pollDraft.opensAt) : null,
          closes_at: pollDraft.closesAt ? toISO(pollDraft.closesAt) : null,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('event_polls')
          .update(updates as never)
          .eq('id', pollEditTarget.id)

        if (error) throw error

        const { error: deleteOptionsError } = await supabase
          .from('event_poll_options')
          .delete()
          .eq('poll_id', pollEditTarget.id)

        if (deleteOptionsError) throw deleteOptionsError

        const optionPayload: TableInsert<'event_poll_options'>[] = pollOptions.map((option, index) => ({
          poll_id: pollEditTarget.id,
          label: option,
          sort_order: index,
        }))

        const { error: insertOptionsError } = await supabase
          .from('event_poll_options')
          .insert(optionPayload as never)

        if (insertOptionsError) throw insertOptionsError

        toast.success('Poll updated')
      }

      resetPollForm()
      await loadPolls(selectedRecord.event.id)
      await loadEvents()
    } catch (error: any) {
      console.error('Failed to save poll', error)
      toast.error(error?.message || 'Unable to save poll')
    } finally {
      setPollSaving(false)
    }
  }

  const handleEditPoll = (poll: PollWithRelations) => {
    setPollFormMode('edit')
    setPollEditTarget(poll)
    setPollDraft({
      question: poll.question ?? '',
      description: poll.description ?? '',
      opensAt: toLocalInput(poll.opens_at),
      closesAt: toLocalInput(poll.closes_at),
      isPublished: poll.is_published,
    })
    setPollOptions(poll.event_poll_options.sort((a, b) => a.sort_order - b.sort_order).map((option) => option.label))
  }

  const handleTogglePollPublish = async (poll: PollWithRelations, nextState: boolean) => {
    try {
      const { error } = await supabase
        .from('event_polls')
        .update({ is_published: nextState, updated_at: new Date().toISOString() } as never)
        .eq('id', poll.id)

      if (error) throw error

      toast.success(`Poll ${nextState ? 'published' : 'unpublished'}`)
      if (selectedRecord) {
        await loadPolls(selectedRecord.event.id)
        await loadEvents()
      }
    } catch (error: any) {
      console.error('Failed to toggle poll publish state', error)
      toast.error(error?.message || 'Unable to update poll')
    }
  }

  const handleDeletePoll = async (poll: PollWithRelations) => {
    try {
      const { error } = await supabase
        .from('event_polls')
        .delete()
        .eq('id', poll.id)

      if (error) throw error

      toast.success('Poll deleted')
      if (selectedRecord) {
        await loadPolls(selectedRecord.event.id)
        await loadEvents()
      }
    } catch (error: any) {
      console.error('Failed to delete poll', error)
      toast.error(error?.message || 'Unable to delete poll')
    }
  }

  const loadParticipants = useCallback(async (eventId: string) => {
    setParticipantsLoading(true)
    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(
          '*,' +
            'attendee:users!event_registrations_user_id_fkey(id, name, email, section, year),' +
            'reviewer:users!event_registrations_reviewed_by_fkey(id, name)'
        )
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: true })

      if (error) throw error

      setParticipants((data || []) as RegistrationWithUser[])
    } catch (error: any) {
      console.error('Failed to load participants', error)
      toast.error(error?.message || 'Unable to load participants')
      setParticipants([])
    } finally {
      setParticipantsLoading(false)
    }
  }, [])

  const openParticipantsManager = async () => {
    if (!selectedRecord) return
    setParticipantTab('all')
    await loadParticipants(selectedRecord.event.id)
    setShowParticipantsModal(true)
  }

  const handleRegistrationStatusChange = async (
    registrationId: string,
    status: RegistrationStatus
  ) => {
    if (!selectedRecord || !user) return
    try {
      const updates: TableUpdate<'event_registrations'> = {
        status,
        reviewed_at: ['approved', 'waitlisted', 'rejected'].includes(status)
          ? new Date().toISOString()
          : null,
        reviewed_by: ['approved', 'waitlisted', 'rejected'].includes(status) ? user.id : null,
      }

      const { error } = await supabase
        .from('event_registrations')
        .update(updates as never)
        .eq('id', registrationId)

      if (error) throw error

      toast.success(`Marked as ${REGISTRATION_STATUS_META[status].label.toLowerCase()}`)
      await loadParticipants(selectedRecord.event.id)
      await loadEvents()
    } catch (error: any) {
      console.error('Failed to update registration', error)
      toast.error(error?.message || 'Unable to update registration')
    }
  }

  const handleRemoveRegistration = async (registrationId: string) => {
    if (!selectedRecord) return
    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', registrationId)

      if (error) throw error

      toast.success('Registration removed')
      await loadParticipants(selectedRecord.event.id)
      await loadEvents()
    } catch (error: any) {
      console.error('Failed to remove registration', error)
      toast.error(error?.message || 'Unable to remove registration')
    }
  }

  if (!isEventManager) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="h-12 w-12" style={{ color: 'var(--accent)' }} />
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Restricted area
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Event management tools are available to event managers and platform administrators.
        </p>
      </div>
    )
  }

  const filteredParticipants = useMemo(() => {
    if (participantTab === 'all') return participants
    return participants.filter((entry) => entry.status === participantTab)
  }, [participants, participantTab])

  const listPaneClasses = viewMode === 'detail'
    ? 'hidden space-y-4 lg:block lg:space-y-4'
    : 'space-y-4 lg:block lg:space-y-4'

  const detailPaneClasses = viewMode === 'detail'
    ? 'space-y-6 lg:block lg:space-y-6'
    : 'hidden space-y-6 lg:block lg:space-y-6'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
            Operations
          </p>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
            Event management
          </h1>
          <p className="max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
            Coordinate campus experiences, review registrations, and launch polls from a focused workspace designed for administrators.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create event
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="btn-secondary inline-flex items-center"
            disabled={refreshing || loading}
          >
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh data
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)] 2xl:grid-cols-[380px,minmax(0,1fr)]">
        <section className={listPaneClasses}>
          <div className="space-y-4">
            <div className="card space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Event library
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Browse active and historical events, then choose one to inspect or update.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="input-field pl-10"
                    placeholder="Search by title or type"
                    aria-label="Search events"
                  />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                  <select
                    value={visibilityFilter}
                    onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
                    className="input-field appearance-none pl-10"
                    aria-label="Filter by visibility"
                  >
                    {VISIBILITY_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition"
                    aria-pressed={statusFilter === option.value}
                    style={
                      statusFilter === option.value
                        ? {
                            backgroundColor: 'rgba(255,138,0,0.15)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(255,138,0,0.4)',
                          }
                        : {
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(34,34,34,0.8)',
                            backgroundColor: 'rgba(15,15,16,0.55)',
                          }
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card space-y-4">
              {loading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
                  <AlertTriangle className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      No events match your filters
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Adjust the filters or create a new event to get started.
                    </p>
                  </div>
                </div>
              ) : (
                filteredEvents.map((record) => {
                  const lifecycle = resolveLifecycleStatus(record.event)
                  const lifecycleMeta = LIFECYCLE_META[lifecycle]
                  const registrations = record.registrationSummary
                  const limit = record.event.max_participants
                  const occupancyLabel = limit
                    ? `${registrations.approved}/${limit} ${pluralize('seat', limit || 0)}`
                    : `${registrations.approved} registered`
                  const isSelected = selectedEventId === record.event.id

                  return (
                    <article
                      key={record.event.id}
                      className="rounded-2xl border p-4 transition"
                      style={
                        isSelected
                          ? {
                              borderColor: 'rgba(255,138,0,0.45)',
                              background: 'rgba(255,138,0,0.1)',
                              boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                            }
                          : {
                              borderColor: 'rgba(34,34,34,0.8)',
                              background: 'rgba(19,19,20,0.7)',
                            }
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ border: `1px solid ${lifecycleMeta.border}`, background: lifecycleMeta.tint, color: lifecycleMeta.text }}
                            >
                              {lifecycleMeta.label}
                            </span>
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs" style={{ color: 'var(--text-secondary)', background: 'rgba(26,26,28,0.6)', border: '1px solid rgba(34,34,34,0.8)' }}>
                              {formatEventType(record.event.event_type)}
                            </span>
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs" style={{ color: 'var(--text-secondary)', background: 'rgba(26,26,28,0.6)', border: '1px solid rgba(34,34,34,0.8)' }}>
                              {formatVisibility(record.event.visibility)}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {record.event.title}
                          </h3>
                          {record.event.summary && (
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {record.event.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                          <span>{formatDateRange(record.event.start_at, record.event.end_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                          <span>
                            {record.pollSummary.total} {pluralize('poll', record.pollSummary.total)} · {record.pollSummary.totalVotes}{' '}
                            {pluralize('vote', record.pollSummary.totalVotes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                          <span>{occupancyLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                          <span>{record.event.event_mode === 'online' ? record.event.meeting_link || 'Online session' : record.event.location || 'Venue TBA'}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openDetailView(record)}
                          className="btn-primary inline-flex items-center gap-2"
                          aria-label={`Open details for ${record.event.title}`}
                        >
                          Review event
                          <StepForward className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelEvent(record)}
                          className="table-action-button"
                          data-variant="warning"
                          aria-label={`Cancel ${record.event.title}`}
                        >
                          <Tag className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(record)
                            setDeleteConfirmation('')
                          }}
                          className="table-action-button"
                          data-variant="danger"
                          aria-label={`Delete ${record.event.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Updated {formatRelativeDistance(record.event.updated_at)}
                        </span>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <section className={detailPaneClasses}>
          {selectedRecord ? (
            <div className="space-y-6">
              <div className="card space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={backToList}
                      className="btn-secondary inline-flex w-fit items-center gap-2 lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to all events
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-3 py-1 text-xs" style={{ border: '1px solid rgba(34,34,34,0.8)', color: 'var(--text-secondary)' }}>
                        ID: {selectedRecord.event.id.slice(0, 8)}
                      </span>
                      <span className="rounded-full px-3 py-1 text-xs" style={{ border: '1px solid rgba(34,34,34,0.8)', color: 'var(--text-secondary)' }}>
                        {formatVisibility(selectedRecord.event.visibility)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selectedRecord.event.title}
                      </h2>
                      {selectedRecord.event.summary && (
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {selectedRecord.event.summary}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={openEditModal} className="btn-secondary inline-flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Edit event
                    </button>
                    <button
                      type="button"
                      onClick={openPollsManager}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Manage polls
                    </button>
                    <button
                      type="button"
                      onClick={openParticipantsManager}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      View participants
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelEvent(selectedRecord)}
                      className="table-action-button"
                      data-variant="warning"
                      aria-label="Cancel event"
                    >
                      <Tag className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(selectedRecord)
                        setDeleteConfirmation('')
                      }}
                      className="table-action-button"
                      data-variant="danger"
                      aria-label="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 text-sm sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>{formatDateRange(selectedRecord.event.start_at, selectedRecord.event.end_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>
                      {formatTimestamp(selectedRecord.event.start_at)} → {formatTimestamp(selectedRecord.event.end_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>
                      {selectedRecord.event.event_mode === 'online'
                        ? selectedRecord.event.meeting_link || 'Online session'
                        : selectedRecord.event.location || 'Venue to be announced'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>
                      {selectedRecord.event.registration_type === 'open'
                        ? 'Open access'
                        : selectedRecord.event.registration_flow === 'form_review'
                          ? 'Manual review'
                          : 'Automatic approval'}
                    </span>
                  </div>
                </div>

                {selectedRecord.event.description && (
                  <div className="rounded-2xl border border-[rgba(255,138,0,0.2)] bg-[rgba(255,138,0,0.08)] p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedRecord.event.description}
                  </div>
                )}
              </div>

              <div className="grid gap-5 xl:grid-cols-[2fr,1fr]">
                <section className="card space-y-5">
                  <header className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Event overview
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Core attributes and logistics for the selected event.
                      </p>
                    </div>
                  </header>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Title
                      </span>
                      <p className="text-base" style={{ color: 'var(--text-primary)' }}>
                        {selectedRecord.event.title}
                      </p>
                      {selectedRecord.event.summary && (
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {selectedRecord.event.summary}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Type & mode
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatEventType(selectedRecord.event.event_type)} · {formatMode(selectedRecord.event.event_mode)}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatVisibility(selectedRecord.event.visibility)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Schedule
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {formatDateRange(selectedRecord.event.start_at, selectedRecord.event.end_at)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Location / access
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.event.event_mode === 'online'
                          ? selectedRecord.event.meeting_link || 'Online session'
                          : selectedRecord.event.location || 'Venue to be announced'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Registrations
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {selectedRecord.event.registration_type === 'open'
                          ? 'Open access'
                          : selectedRecord.event.registration_flow === 'form_review'
                            ? 'Manual review'
                            : 'Automatic approval'}
                      </p>
                      {selectedRecord.event.max_participants && (
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          Capacity {selectedRecord.event.max_participants}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                        Created / Updated
                      </span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Created {formatTimestamp(selectedRecord.event.created_at)}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Updated {formatTimestamp(selectedRecord.event.updated_at)}
                      </p>
                    </div>
                  </div>
                  {selectedRecord.event.description && (
                    <div className="rounded-2xl border border-[rgba(255,138,0,0.2)] bg-[rgba(255,138,0,0.08)] p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {selectedRecord.event.description}
                    </div>
                  )}
                </section>

                <aside className="space-y-5">
                  <div className="card space-y-3">
                    <header className="flex items-center gap-2">
                      <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Registration status
                      </h3>
                    </header>
                    <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex items-center justify-between">
                        <span>Total requests</span>
                        <span>{selectedRecord.registrationSummary.total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Approved</span>
                        <span>{selectedRecord.registrationSummary.approved}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Pending</span>
                        <span>{selectedRecord.registrationSummary.pending}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Waitlist</span>
                        <span>{selectedRecord.registrationSummary.waitlisted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rejected</span>
                        <span>{selectedRecord.registrationSummary.rejected}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card space-y-3">
                    <header className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Poll insights
                      </h3>
                    </header>
                    <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex items-center justify-between">
                        <span>Total polls</span>
                        <span>{selectedRecord.pollSummary.total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Published</span>
                        <span>{selectedRecord.pollSummary.published}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total votes</span>
                        <span>{selectedRecord.pollSummary.totalVotes}</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="card flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
              <ClipboardList className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Select an event to manage
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Pick an event from the list to review details, manage polls, or review registrations.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <ModalShell
        title={eventModalMode === 'create' ? 'Create event' : 'Edit event'}
        subtitle="Organize event details across focused tabs before publishing."
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'basic', label: 'Basic info' },
              { value: 'schedule', label: 'Schedule' },
              { value: 'registration', label: 'Registration' },
              { value: 'visibility', label: 'Visibility' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setEventFormTab(tab.value)}
              className="rounded-full px-4 py-2 text-sm font-medium transition"
              style={
                eventFormTab === tab.value
                  ? {
                      backgroundColor: 'rgba(255,138,0,0.18)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(255,138,0,0.4)',
                    }
                  : {
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(34,34,34,0.75)',
                      backgroundColor: 'rgba(14,14,15,0.6)',
                    }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {eventFormTab === 'basic' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Event title
                </label>
                <input
                  className="input-field mt-1"
                  value={eventFormState.title}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="LinkUp Hackathon 2025"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Summary
                </label>
                <input
                  className="input-field mt-1"
                  value={eventFormState.summary}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="One-line overview for dashboards"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Description
                </label>
                <textarea
                  className="input-field mt-1 min-h-[140px]"
                  value={eventFormState.description}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Detailed overview, agenda, speaker bios..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Event type
                </label>
                <select
                  className="input-field mt-1"
                  value={eventFormState.eventType}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, eventType: event.target.value as Event['event_type'] }))
                  }
                >
                  <option value="hackathon">Hackathon</option>
                  <option value="workshop">Workshop</option>
                  <option value="seminar">Seminar</option>
                  <option value="competition">Competition</option>
                  <option value="meetup">Meetup</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Mode
                </label>
                <select
                  className="input-field mt-1"
                  value={eventFormState.eventMode}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, eventMode: event.target.value as Event['event_mode'] }))
                  }
                >
                  <option value="in_person">On campus</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Location
                </label>
                <input
                  className="input-field mt-1"
                  value={eventFormState.location}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Auditorium, Block B"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Meeting link
                </label>
                <input
                  className="input-field mt-1"
                  value={eventFormState.meetingLink}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, meetingLink: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Banner image
                </label>
                <input
                  className="input-field mt-1"
                  value={eventFormState.bannerUrl}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, bannerUrl: event.target.value }))}
                  placeholder="Optional cover visual"
                />
              </div>
            </div>
          )}

          {eventFormTab === 'schedule' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Starts at
                </label>
                <input
                  type="datetime-local"
                  className="input-field mt-1"
                  value={eventFormState.startAt}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, startAt: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Ends at
                </label>
                <input
                  type="datetime-local"
                  className="input-field mt-1"
                  value={eventFormState.endAt}
                  onChange={(event) => setEventFormState((prev) => ({ ...prev, endAt: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Registration opens
                </label>
                <input
                  type="datetime-local"
                  className="input-field mt-1"
                  value={eventFormState.registrationOpensAt}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, registrationOpensAt: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Registration closes
                </label>
                <input
                  type="datetime-local"
                  className="input-field mt-1"
                  value={eventFormState.registrationClosesAt}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, registrationClosesAt: event.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {eventFormTab === 'registration' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  id="requiresRegistration"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={eventFormState.registrationRequired}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, registrationRequired: event.target.checked }))
                  }
                />
                <label htmlFor="requiresRegistration" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Registration required to attend
                </label>
              </div>

              {eventFormState.registrationRequired && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Flow
                    </label>
                    <select
                      className="input-field mt-1"
                      value={eventFormState.registrationFlow}
                      onChange={(event) =>
                        setEventFormState((prev) => ({ ...prev, registrationFlow: event.target.value as Event['registration_flow'] }))
                      }
                    >
                      <option value="auto_approval">Auto approval</option>
                      <option value="form_review">Manual review</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Max participants
                    </label>
                    <input
                      className="input-field mt-1"
                      value={eventFormState.maxParticipants}
                      onChange={(event) => setEventFormState((prev) => ({ ...prev, maxParticipants: event.target.value }))}
                      placeholder="Leave blank for unlimited"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="allowWaitlist"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={eventFormState.allowWaitlist}
                      onChange={(event) =>
                        setEventFormState((prev) => ({ ...prev, allowWaitlist: event.target.checked }))
                      }
                    />
                    <label htmlFor="allowWaitlist" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Enable waitlist once capacity is reached
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="autoClose"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={eventFormState.autoClose}
                      onChange={(event) =>
                        setEventFormState((prev) => ({ ...prev, autoClose: event.target.checked }))
                      }
                    />
                    <label htmlFor="autoClose" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Auto close registrations at capacity
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {eventFormTab === 'visibility' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Visibility
                </label>
                <select
                  className="input-field mt-1"
                  value={eventFormState.visibility}
                  onChange={(event) =>
                    setEventFormState((prev) => ({ ...prev, visibility: event.target.value as Event['visibility'] }))
                  }
                >
                  <option value="campus">Campus only</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="rounded-2xl border border-[rgba(255,138,0,0.25)] bg-[rgba(255,138,0,0.08)] p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Visibility controls determine where the event appears in Linkup and whether external guests can view or register.
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setShowEventModal(false)} className="btn-secondary" disabled={savingEvent}>
            Cancel
          </button>
          <button type="button" onClick={handleSaveEvent} className="btn-primary inline-flex items-center gap-2" disabled={savingEvent}>
            {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {eventModalMode === 'create' ? 'Create event' : 'Save changes'}
          </button>
        </div>
      </ModalShell>

      {selectedRecord && (
        <ModalShell
          title={`Polls for ${selectedRecord.event.title}`}
          subtitle="Launch, iterate, and monitor engagement polls for this event."
          open={showPollsModal}
          onClose={() => {
            setShowPollsModal(false)
            resetPollForm()
          }}
        >
          {pollsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-4">
                <header>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {pollFormMode === 'create' ? 'Create a poll' : 'Edit poll'}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Collect quick sentiment from attendees. Options update votes when edited.
                  </p>
                </header>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Question
                    </label>
                    <input
                      className="input-field mt-1"
                      value={pollDraft.question}
                      onChange={(event) => setPollDraft((prev) => ({ ...prev, question: event.target.value }))}
                      placeholder="How would you rate the keynote?"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Description
                    </label>
                    <textarea
                      className="input-field mt-1 min-h-[100px]"
                      value={pollDraft.description}
                      onChange={(event) => setPollDraft((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Optional context for respondents"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Opens at
                    </label>
                    <input
                      type="datetime-local"
                      className="input-field mt-1"
                      value={pollDraft.opensAt}
                      onChange={(event) => setPollDraft((prev) => ({ ...prev, opensAt: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Closes at
                    </label>
                    <input
                      type="datetime-local"
                      className="input-field mt-1"
                      value={pollDraft.closesAt}
                      onChange={(event) => setPollDraft((prev) => ({ ...prev, closesAt: event.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      Options
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="input-field flex-1"
                        value={pollOptionInput}
                        onChange={(event) => setPollOptionInput(event.target.value)}
                        placeholder="Add an option"
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          if (pollOptionInput.trim()) {
                            setPollOptions((prev) => [...prev, pollOptionInput.trim()])
                            setPollOptionInput('')
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pollOptions.map((option, index) => (
                        <span
                          key={option + index}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                          style={{ border: '1px solid rgba(255,138,0,0.35)', color: 'var(--text-secondary)' }}
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== index))}
                            aria-label={`Remove ${option}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <input
                      id="pollPublished"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={pollDraft.isPublished}
                      onChange={(event) => setPollDraft((prev) => ({ ...prev, isPublished: event.target.checked }))}
                    />
                    <label htmlFor="pollPublished" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Publish immediately after saving
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pollFormMode === 'edit' && (
                    <button type="button" className="btn-secondary" onClick={resetPollForm}>
                      Cancel edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={handleSubmitPoll}
                    disabled={pollSaving}
                  >
                    {pollSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {pollFormMode === 'create' ? 'Create poll' : 'Save changes'}
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <header className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Existing polls
                  </h4>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {polls.length} total
                  </span>
                </header>
                {polls.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[rgba(255,138,0,0.35)] p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No polls yet. Launch a quick pulse to capture attendee sentiment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {polls.map((poll) => (
                      <article key={poll.id} className="rounded-2xl border border-[rgba(34,34,34,0.8)] bg-[rgba(20,20,20,0.6)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {poll.question}
                            </h5>
                            {poll.description && (
                              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {poll.description}
                              </p>
                            )}
                          </div>
                          <span
                            className="rounded-full px-3 py-1 text-xs"
                            style={{
                              border: poll.is_published ? '1px solid rgba(39,174,96,0.4)' : '1px solid rgba(148,163,184,0.4)',
                              background: poll.is_published ? 'rgba(39,174,96,0.12)' : 'rgba(148,163,184,0.12)',
                              color: poll.is_published ? '#6CE3A0' : '#CBD5F5',
                            }}
                          >
                            {poll.is_published ? 'Published' : 'Unpublished'}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>
                              {poll.opens_at ? formatTimestamp(poll.opens_at) : 'No start'} →{' '}
                              {poll.closes_at ? formatTimestamp(poll.closes_at) : 'No close'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            <span>
                              {poll.event_poll_votes.length} {pluralize('vote', poll.event_poll_votes.length)} ·{' '}
                              {poll.event_poll_options.length} options
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleEditPoll(poll)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleTogglePollPublish(poll, !poll.is_published)}
                          >
                            {poll.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            className="table-action-button"
                            data-variant="danger"
                            onClick={() => handleDeletePoll(poll)}
                            aria-label="Delete poll"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </ModalShell>
      )}

      {selectedRecord && (
        <ModalShell
          title={`Participants for ${selectedRecord.event.title}`}
          subtitle="Approve, waitlist, or remove attendees with confidence."
          open={showParticipantsModal}
          onClose={() => setShowParticipantsModal(false)}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {REGISTRATION_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setParticipantTab(tab.value)}
                  className="rounded-full px-4 py-2 text-xs font-semibold"
                  style={
                    participantTab === tab.value
                      ? {
                          backgroundColor: 'rgba(255,138,0,0.18)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(255,138,0,0.4)',
                        }
                      : {
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(34,34,34,0.75)',
                          backgroundColor: 'rgba(15,15,16,0.55)',
                        }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {participantsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[rgba(255,138,0,0.35)] p-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                No registrations yet for this filter.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[rgba(34,34,34,0.8)]">
                <table className="min-w-full divide-y divide-[rgba(34,34,34,0.8)] text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      <th className="px-4 py-2">Participant</th>
                      <th className="px-4 py-2">Joined</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(34,34,34,0.8)] text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {filteredParticipants.map((registration) => {
                      const statusMeta = REGISTRATION_STATUS_META[registration.status]
                      return (
                        <tr key={registration.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {registration.attendee?.name || 'Unknown'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {registration.attendee?.email}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {formatTimestamp(registration.submitted_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ background: statusMeta.background, color: statusMeta.color }}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="table-action-button"
                                data-variant="success"
                                onClick={() => handleRegistrationStatusChange(registration.id, 'approved')}
                                aria-label="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="table-action-button"
                                data-variant="warning"
                                onClick={() => handleRegistrationStatusChange(registration.id, 'waitlisted')}
                                aria-label="Waitlist"
                              >
                                <Tag className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="table-action-button"
                                data-variant="danger"
                                onClick={() => handleRegistrationStatusChange(registration.id, 'rejected')}
                                aria-label="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="table-action-button"
                                data-variant="muted"
                                onClick={() => handleRemoveRegistration(registration.id)}
                                aria-label="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      <ModalShell
        title="Delete event"
        subtitle={deleteTarget ? `Removing ${deleteTarget.event.title} cannot be undone.` : undefined}
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null)
          setDeleteConfirmation('')
        }}
        widthClass="max-w-lg"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[rgba(224,36,36,0.35)] bg-[rgba(224,36,36,0.12)] p-4">
            <p className="text-sm font-semibold" style={{ color: '#FCA5A5' }}>
              This action is permanent.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'rgba(252,165,165,0.75)' }}>
              Deleting this event removes all associated polls and registrations. Consider cancelling instead if you need to preserve history.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Type DELETE to confirm
            </label>
            <input
              className="input-field mt-1"
              placeholder="DELETE"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDeleteTarget(null)
                setDeleteConfirmation('')
              }}
              disabled={deletingEvent}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(224,36,36,0.92), rgba(190,18,60,0.92))',
                borderColor: 'rgba(224,36,36,0.45)',
                color: '#fff',
              }}
              onClick={handleDeleteEvent}
              disabled={deletingEvent || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
            >
              {deletingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete event
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}
