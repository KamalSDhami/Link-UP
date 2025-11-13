import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarPlus,
  Loader2,
  CheckCircle2,
  Clock,
  ClipboardList,
  Send,
  Trash2,
  Plus,
  X,
  RefreshCw,
  Vote,
  FileText,
  ShieldCheck,
  BarChart3,
  SlidersHorizontal,
  UserCheck,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type {
  Event,
  EventForm,
  EventPoll,
  EventPollOption,
  EventPollVote,
  EventRegistration,
  User,
} from '@/types'
import type { Json, TableInsert, TableUpdate } from '@/types/database'

interface FormFieldDefinition {
  id: string
  label: string
  type: 'short_text' | 'paragraph' | 'select' | 'multi_select'
  required: boolean
  placeholder?: string | null
  options?: string[]
}

interface NewFieldDraft {
  label: string
  type: FormFieldDefinition['type']
  required: boolean
  placeholder: string
  options: string
}

interface NewEventDraft {
  title: string
  summary: string
  description: string
  eventType: Event['event_type']
  eventMode: Event['event_mode']
  visibility: Event['visibility']
  startAt: string
  endAt: string
  location: string
  meetingLink: string
  bannerUrl: string
  registrationType: Event['registration_type']
  registrationFlow: Event['registration_flow']
  registrationOpensAt: string
  registrationClosesAt: string
  maxParticipants: string
  allowWaitlist: boolean
  autoClose: boolean
}

interface EventEditorState {
  status: Event['status']
  registrationOpensAt: string
  registrationClosesAt: string
  maxParticipants: string
  allowWaitlist: boolean
  autoClose: boolean
  visibility: Event['visibility']
}

interface PollDraft {
  question: string
  description: string
  opensAt: string
  closesAt: string
  isPublished: boolean
}

interface RegistrationWithUser extends EventRegistration {
  attendee: Pick<User, 'id' | 'name' | 'email' | 'section' | 'year'> | null
  reviewer: Pick<User, 'id' | 'name'> | null
}

interface PollWithRelations extends EventPoll {
  event_poll_options: EventPollOption[]
  event_poll_votes: EventPollVote[]
}

const STATUS_OPTIONS: Event['status'][] = ['draft', 'scheduled', 'live', 'ended', 'cancelled']

const defaultNewEvent: NewEventDraft = {
  title: '',
  summary: '',
  description: '',
  eventType: 'hackathon',
  eventMode: 'in_person',
  visibility: 'campus',
  startAt: '',
  endAt: '',
  location: '',
  meetingLink: '',
  bannerUrl: '',
  registrationType: 'registration_required',
  registrationFlow: 'auto_approval',
  registrationOpensAt: '',
  registrationClosesAt: '',
  maxParticipants: '',
  allowWaitlist: true,
  autoClose: true,
}

const defaultFieldDraft: NewFieldDraft = {
  label: '',
  type: 'short_text',
  required: true,
  placeholder: '',
  options: '',
}

const defaultPollDraft: PollDraft = {
  question: '',
  description: '',
  opensAt: '',
  closesAt: '',
  isPublished: false,
}

const defaultFormInfo = {
  title: 'Registration Form',
  description: '',
}

const formatInputValue = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toISO = (value: string) => (value ? new Date(value).toISOString() : null)

const slugifyFieldId = (label: string) =>
  `${label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`

export default function EventManagerPage() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()

  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([])
  const [formFields, setFormFields] = useState<FormFieldDefinition[]>([])
  const [formInfo, setFormInfo] = useState(defaultFormInfo)
  const [polls, setPolls] = useState<PollWithRelations[]>([])
  const [newEvent, setNewEvent] = useState<NewEventDraft>(defaultNewEvent)
  const [newField, setNewField] = useState<NewFieldDraft>(defaultFieldDraft)
  const [eventEditor, setEventEditor] = useState<EventEditorState | null>(null)
  const [newPoll, setNewPoll] = useState<PollDraft>(defaultPollDraft)
  const [newPollOptions, setNewPollOptions] = useState<string[]>([])
  const [pollOptionDraft, setPollOptionDraft] = useState('')

  const [savingEvent, setSavingEvent] = useState(false)
  const [updatingEvent, setUpdatingEvent] = useState(false)
  const [savingForm, setSavingForm] = useState(false)
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [refreshingEvent, setRefreshingEvent] = useState(false)

  const requestedEventId = searchParams.get('event')

  const isEventManager = user && ['event_manager', 'super_admin', 'god'].includes(user.role)

  const loadEvents = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      let query = supabase
        .from('events')
        .select('*')
        .order('start_at', { ascending: true })

  if (!['super_admin', 'god'].includes(user.role)) {
        query = query.eq('created_by', user.id)
      }

      const { data, error } = await query

      if (error) throw error

      const typedData = (data || []) as Event[]
      setEvents(typedData)

      if (requestedEventId && typedData.some((evt) => evt.id === requestedEventId)) {
        setSelectedEventId(requestedEventId)
      } else if (!selectedEventId && typedData.length > 0) {
        setSelectedEventId(typedData[0].id)
      }
    } catch (error: any) {
      console.error('Failed to load events', error)
      toast.error('Could not load events for management')
    } finally {
      setIsLoading(false)
    }
  }, [requestedEventId, selectedEventId, user])

  const loadEventDetails = useCallback(
    async (eventId: string) => {
      if (!user || !eventId) return
      setRefreshingEvent(true)
      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle()

        if (eventError) throw eventError
        if (!eventData) {
          toast.error('Event not found or inaccessible')
          setSelectedEvent(null)
          return
        }

        const eventRecord = eventData as Event
        setSelectedEvent(eventRecord)
        setEvents((prev) => prev.map((evt) => (evt.id === eventRecord.id ? eventRecord : evt)))

        const [formRes, registrationsRes, pollsRes] = await Promise.all([
          supabase
            .from('event_forms')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle(),
          supabase
            .from('event_registrations')
            .select(
              '*,' +
                'attendee:users!event_registrations_user_id_fkey(id, name, email, section, year),' +
                'reviewer:users!event_registrations_reviewed_by_fkey(id, name)'
            )
            .eq('event_id', eventId)
            .order('submitted_at', { ascending: true }),
          supabase
            .from('event_polls')
            .select('*, event_poll_options(*), event_poll_votes(*)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false }),
        ])

        if (formRes.error && formRes.error.code !== 'PGRST116') throw formRes.error
        const rawForm = formRes.data as EventForm | null
        if (rawForm?.form_schema && typeof rawForm.form_schema === 'object') {
          const schema = rawForm.form_schema as { version?: number; fields?: FormFieldDefinition[] }
          const fields = Array.isArray(schema.fields)
            ? schema.fields.map((field) => ({
                id: field.id,
                label: field.label,
                type: field.type ?? 'short_text',
                required: field.required ?? false,
                placeholder: field.placeholder ?? '',
                options: field.options ?? [],
              }))
            : []
          setFormFields(fields)
          setFormInfo({
            title: rawForm.title ?? defaultFormInfo.title,
            description: rawForm.description ?? '',
          })
        } else {
          setFormFields([])
          setFormInfo(defaultFormInfo)
        }

        if (registrationsRes.error) throw registrationsRes.error
  const registrationRows = (registrationsRes.data || []) as RegistrationWithUser[]
        setRegistrations(registrationRows)

        if (pollsRes.error) throw pollsRes.error
        setPolls((pollsRes.data || []) as PollWithRelations[])

        setEventEditor({
          status: eventRecord.status,
          registrationOpensAt: formatInputValue(eventRecord.registration_opens_at),
          registrationClosesAt: formatInputValue(eventRecord.registration_closes_at),
          maxParticipants: eventRecord.max_participants ? String(eventRecord.max_participants) : '',
          allowWaitlist: eventRecord.allow_waitlist,
          autoClose: eventRecord.auto_close,
          visibility: eventRecord.visibility,
        })
      } catch (error: any) {
        console.error('Failed to load event details', error)
        toast.error('Could not load event details')
      } finally {
        setRefreshingEvent(false)
      }
    },
    [user]
  )

  useEffect(() => {
    if (!isEventManager) return
    loadEvents()
  }, [isEventManager, loadEvents])

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null)
      return
    }
    loadEventDetails(selectedEventId)
  }, [loadEventDetails, selectedEventId])

  const registrationStats = useMemo(() => {
    return registrations.reduce(
      (acc, registration) => {
        acc.total += 1
        acc[registration.status] = (acc[registration.status] ?? 0) + 1
        return acc
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        waitlisted: 0,
        rejected: 0,
        cancelled: 0,
      } as Record<string, number>
    )
  }, [registrations])

  const handleCreateEvent = async (eventObject: React.FormEvent<HTMLFormElement>) => {
    eventObject.preventDefault()
    if (!user) return

    if (!newEvent.title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (!newEvent.startAt || !newEvent.endAt) {
      toast.error('Start and end date/time are required')
      return
    }

    const startISO = toISO(newEvent.startAt)
    const endISO = toISO(newEvent.endAt)

    if (!startISO || !endISO || new Date(endISO) <= new Date(startISO)) {
      toast.error('End time must be after the start time')
      return
    }

    if (newEvent.registrationType === 'registration_required' && newEvent.registrationFlow === 'form_review') {
      toast.success('Remember to configure the registration form after creating the event.')
    }

    setSavingEvent(true)
    try {
      const payload: TableInsert<'events'> = {
        title: newEvent.title.trim(),
        summary: newEvent.summary.trim() || null,
        description: newEvent.description.trim() || null,
        event_type: newEvent.eventType,
        event_mode: newEvent.eventMode,
        visibility: newEvent.visibility,
        start_at: startISO,
        end_at: endISO,
        location: newEvent.location.trim() || null,
        meeting_link: newEvent.meetingLink.trim() || null,
        banner_url: newEvent.bannerUrl.trim() || null,
        registration_type: newEvent.registrationType,
        registration_flow: newEvent.registrationType === 'open' ? 'auto_approval' : newEvent.registrationFlow,
        registration_opens_at: newEvent.registrationOpensAt ? toISO(newEvent.registrationOpensAt) : null,
        registration_closes_at: newEvent.registrationClosesAt ? toISO(newEvent.registrationClosesAt) : null,
        max_participants: newEvent.maxParticipants ? Number(newEvent.maxParticipants) : null,
        requires_gehu_verification: true,
        allow_waitlist: newEvent.allowWaitlist,
        auto_close: newEvent.autoClose,
        status: new Date(startISO) <= new Date() ? 'live' : 'scheduled',
        created_by: user.id,
      }

      const { data, error } = await supabase
        .from('events')
        .insert(payload as any)
        .select('*')
        .single()

      if (error) throw error

      const createdEvent = data as Event

      toast.success('Event created successfully')
      setNewEvent(defaultNewEvent)
      await loadEvents()
      if (createdEvent?.id) {
        setSelectedEventId(createdEvent.id)
      }
    } catch (error: any) {
      console.error('Failed to create event', error)
      toast.error('Could not create the event')
    } finally {
      setSavingEvent(false)
    }
  }

  const handleUpdateEvent = async () => {
    if (!selectedEvent || !eventEditor) return
    setUpdatingEvent(true)
    try {
      const updates: TableUpdate<'events'> = {
        status: eventEditor.status,
        registration_opens_at: eventEditor.registrationOpensAt ? toISO(eventEditor.registrationOpensAt) : null,
        registration_closes_at: eventEditor.registrationClosesAt ? toISO(eventEditor.registrationClosesAt) : null,
        max_participants: eventEditor.maxParticipants ? Number(eventEditor.maxParticipants) : null,
        allow_waitlist: eventEditor.allowWaitlist,
        auto_close: eventEditor.autoClose,
        visibility: eventEditor.visibility,
      }

      const { error } = await supabase
        .from('events')
  .update(updates as never)
        .eq('id', selectedEvent.id)

      if (error) throw error

      toast.success('Event details updated')
      await loadEventDetails(selectedEvent.id)
    } catch (error: any) {
      console.error('Failed to update event', error)
      toast.error('Could not update event details')
    } finally {
      setUpdatingEvent(false)
    }
  }

  const handleAddField = () => {
    if (!newField.label.trim()) {
      toast.error('Field label is required')
      return
    }

    const options = ['select', 'multi_select'].includes(newField.type)
      ? newField.options
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []

    if ((newField.type === 'select' || newField.type === 'multi_select') && options.length === 0) {
      toast.error('Provide at least one option for selection fields')
      return
    }

    const field: FormFieldDefinition = {
      id: slugifyFieldId(newField.label),
      label: newField.label.trim(),
      type: newField.type,
      required: newField.required,
      placeholder: newField.placeholder.trim() || undefined,
      options,
    }

    setFormFields((prev) => [...prev, field])
    setNewField(defaultFieldDraft)
  }

  const handleRemoveField = (fieldId: string) => {
    setFormFields((prev) => prev.filter((field) => field.id !== fieldId))
  }

  const handleSaveForm = async () => {
    if (!selectedEvent) return
    if (!formFields.length) {
      toast.error('Add at least one field before saving the form')
      return
    }

    setSavingForm(true)
    try {
      const schema: Json = {
        version: 1,
        fields: formFields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder ?? null,
          options: field.options ?? [],
        })),
      }

      const payload: TableInsert<'event_forms'> = {
        event_id: selectedEvent.id,
        title: formInfo.title || 'Registration Form',
        description: formInfo.description?.trim() || null,
        form_schema: schema,
        is_active: true,
      }

      const { error } = await supabase
        .from('event_forms')
        .upsert(payload as any, { onConflict: 'event_id' })

      if (error) throw error

      toast.success('Registration form saved')
      await loadEventDetails(selectedEvent.id)
    } catch (error: any) {
      console.error('Failed to save form', error)
      toast.error('Could not save the registration form')
    } finally {
      setSavingForm(false)
    }
  }

  const handleRegistrationStatus = async (registrationId: string, status: EventRegistration['status']) => {
    if (!selectedEvent || !user) return
    try {
      const updates: TableUpdate<'event_registrations'> = {
        status,
        reviewed_at: ['approved', 'waitlisted', 'rejected'].includes(status) ? new Date().toISOString() : null,
        reviewed_by: ['approved', 'waitlisted', 'rejected'].includes(status) ? user.id : null,
      }
      const { error } = await supabase
        .from('event_registrations')
  .update(updates as never)
        .eq('id', registrationId)

      if (error) throw error

      toast.success(`Registration marked as ${status}`)
      await loadEventDetails(selectedEvent.id)
    } catch (error: any) {
      console.error('Failed to update registration status', error)
      toast.error('Could not update registration')
    }
  }

  const handleAddPollOption = () => {
    if (!pollOptionDraft.trim()) {
      toast.error('Poll option cannot be empty')
      return
    }
    setNewPollOptions((prev) => [...prev, pollOptionDraft.trim()])
    setPollOptionDraft('')
  }

  const handleCreatePoll = async () => {
    if (!selectedEvent || !user) return
    if (!newPoll.question.trim()) {
      toast.error('Poll question is required')
      return
    }
    if (newPollOptions.length < 2) {
      toast.error('Add at least two options for a poll')
      return
    }

    setCreatingPoll(true)
    try {
      const pollPayload: TableInsert<'event_polls'> = {
        event_id: selectedEvent.id,
        question: newPoll.question.trim(),
        description: newPoll.description.trim() || null,
        mode: 'single_choice' as EventPoll['mode'],
        is_anonymous: true,
        is_published: newPoll.isPublished,
        opens_at: newPoll.opensAt ? toISO(newPoll.opensAt) : null,
        closes_at: newPoll.closesAt ? toISO(newPoll.closesAt) : null,
        created_by: user.id,
      }

      const { data: pollData, error: pollError } = await supabase
        .from('event_polls')
        .insert(pollPayload as any)
        .select('id')
        .single()

      if (pollError) throw pollError

      const pollRecord = pollData as Pick<EventPoll, 'id'>
      if (!pollRecord?.id) {
        throw new Error('Poll creation did not return an identifier')
      }

      const optionsPayload: TableInsert<'event_poll_options'>[] = newPollOptions.map((option, index) => ({
        poll_id: pollRecord.id,
        label: option,
        sort_order: index,
      }))

      const { error: optionsError } = await supabase
        .from('event_poll_options')
        .insert(optionsPayload as any)

      if (optionsError) throw optionsError

      toast.success('Poll created successfully')
      setNewPoll(defaultPollDraft)
      setNewPollOptions([])
      await loadEventDetails(selectedEvent.id)
    } catch (error: any) {
      console.error('Failed to create poll', error)
      toast.error('Could not create poll')
    } finally {
      setCreatingPoll(false)
    }
  }

  const handleTogglePollPublish = async (pollId: string, nextState: boolean) => {
    try {
      const updates: TableUpdate<'event_polls'> = { is_published: nextState }
      const { error } = await supabase
        .from('event_polls')
  .update(updates as never)
        .eq('id', pollId)

      if (error) throw error

      toast.success(`Poll ${nextState ? 'published' : 'unpublished'}`)
      if (selectedEvent) {
        await loadEventDetails(selectedEvent.id)
      }
    } catch (error: any) {
      console.error('Failed to toggle poll publish state', error)
      toast.error('Could not update poll state')
    }
  }

  const handleDeletePoll = async (pollId: string) => {
    if (!selectedEvent) return
    const confirmed = window.confirm('Delete this poll? This action cannot be undone.')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('event_polls')
        .delete()
        .eq('id', pollId)

      if (error) throw error

      toast.success('Poll deleted')
      await loadEventDetails(selectedEvent.id)
    } catch (error: any) {
      console.error('Failed to delete poll', error)
      toast.error('Could not delete poll')
    }
  }

  if (!isEventManager) {
    return (
      <div className="card space-y-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary-500" />
        <h2 className="text-xl font-semibold text-slate-900">Restricted area</h2>
        <p className="text-sm text-slate-600">
          Event management tools are available only to event managers and platform administrators.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Event management</h1>
          <p className="text-slate-600">
            Plan, publish, and track student events. Manage registrations, forms, and polls from one workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadEvents()}
          className="btn-secondary inline-flex items-center"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
        <div className="space-y-6">
          <form onSubmit={handleCreateEvent} className="card space-y-4">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-slate-900">Create event</h2>
            </div>

            <div className="space-y-3">
              <input
                className="input-field"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
              <input
                className="input-field"
                placeholder="Short summary"
                value={newEvent.summary}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, summary: event.target.value }))}
              />
              <textarea
                className="input-field min-h-[100px]"
                placeholder="Detailed description (supports rich text or HTML)"
                value={newEvent.description}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Event type</label>
                <select
                  className="input-field"
                  value={newEvent.eventType}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, eventType: event.target.value as Event['event_type'] }))}
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
                <label className="form-label">Mode</label>
                <select
                  className="input-field"
                  value={newEvent.eventMode}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, eventMode: event.target.value as Event['event_mode'] }))}
                >
                  <option value="in_person">On campus</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="form-label">Starts</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={newEvent.startAt}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, startAt: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Ends</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={newEvent.endAt}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, endAt: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="form-label">Location</label>
                <input
                  className="input-field"
                  placeholder="e.g., Auditorium B2"
                  value={newEvent.location}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, location: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Meeting link</label>
                <input
                  className="input-field"
                  placeholder="https://..."
                  value={newEvent.meetingLink}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, meetingLink: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Banner image URL</label>
                <input
                  className="input-field"
                  placeholder="Optional cover image"
                  value={newEvent.bannerUrl}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, bannerUrl: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Visibility</label>
                <select
                  className="input-field"
                  value={newEvent.visibility}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, visibility: event.target.value as Event['visibility'] }))}
                >
                  <option value="campus">Campus only</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900">Registration settings</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label">Registration type</label>
                  <select
                    className="input-field"
                    value={newEvent.registrationType}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, registrationType: event.target.value as Event['registration_type'] }))}
                  >
                    <option value="registration_required">Requires registration</option>
                    <option value="open">Open access</option>
                  </select>
                </div>
                {newEvent.registrationType === 'registration_required' && (
                  <div>
                    <label className="form-label">Registration flow</label>
                    <select
                      className="input-field"
                      value={newEvent.registrationFlow}
                      onChange={(event) => setNewEvent((prev) => ({ ...prev, registrationFlow: event.target.value as Event['registration_flow'] }))}
                    >
                      <option value="auto_approval">Instant approval</option>
                      <option value="form_review">Application + review</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">Registration opens</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={newEvent.registrationOpensAt}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, registrationOpensAt: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Registration closes</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={newEvent.registrationClosesAt}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, registrationClosesAt: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Max participants</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    placeholder="Unlimited"
                    value={newEvent.maxParticipants}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, maxParticipants: event.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="allowWaitlist"
                    type="checkbox"
                    checked={newEvent.allowWaitlist}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, allowWaitlist: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  <label htmlFor="allowWaitlist" className="text-sm text-slate-700">
                    Enable waitlist when capacity is reached
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="autoClose"
                    type="checkbox"
                    checked={newEvent.autoClose}
                    onChange={(event) => setNewEvent((prev) => ({ ...prev, autoClose: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  <label htmlFor="autoClose" className="text-sm text-slate-700">
                    Auto close registrations when capacity reached
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary inline-flex items-center justify-center"
              disabled={savingEvent}
            >
              {savingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Create event
            </button>
          </form>

          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-slate-900">My events</h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                No events created yet. Use the form above to schedule your first event.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      evt.id === selectedEventId
                        ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                        : 'border-slate-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{evt.title}</div>
                      <span className="text-xs uppercase tracking-wide text-slate-500">{evt.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(evt.start_at))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {selectedEvent ? (
            <>
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
                      <p className="text-xs text-slate-500">Manage status and registration windows</p>
                    </div>
                  </div>
                  {refreshingEvent && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
                </div>

                {eventEditor && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="form-label">Status</label>
                      <select
                        className="input-field"
                        value={eventEditor.status}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, status: event.target.value as Event['status'] })
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Visibility</label>
                      <select
                        className="input-field"
                        value={eventEditor.visibility}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, visibility: event.target.value as Event['visibility'] })
                        }
                      >
                        <option value="campus">Campus only</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Registration opens</label>
                      <input
                        type="datetime-local"
                        className="input-field"
                        value={eventEditor.registrationOpensAt}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, registrationOpensAt: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="form-label">Registration closes</label>
                      <input
                        type="datetime-local"
                        className="input-field"
                        value={eventEditor.registrationClosesAt}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, registrationClosesAt: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="form-label">Max participants</label>
                      <input
                        type="number"
                        min={1}
                        className="input-field"
                        value={eventEditor.maxParticipants}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, maxParticipants: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="editAllowWaitlist"
                        type="checkbox"
                        checked={eventEditor.allowWaitlist}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, allowWaitlist: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary-600"
                      />
                      <label htmlFor="editAllowWaitlist" className="text-sm text-slate-700">
                        Allow waitlist when seats are full
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="editAutoClose"
                        type="checkbox"
                        checked={eventEditor.autoClose}
                        onChange={(event) =>
                          setEventEditor((prev) => prev && { ...prev, autoClose: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary-600"
                      />
                      <label htmlFor="editAutoClose" className="text-sm text-slate-700">
                        Auto close registrations at capacity
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                  <span>Total registrations: {registrationStats.total}</span>
                  <span className="text-amber-600">Pending: {registrationStats.pending}</span>
                  <span className="text-emerald-600">Approved: {registrationStats.approved}</span>
                  <span className="text-indigo-600">Waitlisted: {registrationStats.waitlisted}</span>
                  <span className="text-rose-600">Rejected: {registrationStats.rejected}</span>
                </div>

                <button
                  type="button"
                  onClick={handleUpdateEvent}
                  className="btn-secondary inline-flex items-center"
                  disabled={updatingEvent}
                >
                  {updatingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Save changes
                </button>
              </div>

              <div className="card space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Registration requests</h2>
                </div>

                {registrations.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                    No registrations yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Student</th>
                          <th className="px-3 py-2">Submitted</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {registrations.map((reg) => (
                          <tr key={reg.id}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{reg.attendee?.name ?? '—'}</div>
                              <div className="text-xs text-slate-500">{reg.attendee?.email}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
                                new Date(reg.submitted_at)
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs capitalize text-slate-500">{reg.status}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn-ghost inline-flex items-center text-xs text-emerald-600 hover:text-emerald-700"
                                  onClick={() => handleRegistrationStatus(reg.id, 'approved')}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost inline-flex items-center text-xs text-indigo-600 hover:text-indigo-700"
                                  onClick={() => handleRegistrationStatus(reg.id, 'waitlisted')}
                                >
                                  <Clock className="mr-1 h-4 w-4" /> Waitlist
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost inline-flex items-center text-xs text-rose-600 hover:text-rose-700"
                                  onClick={() => handleRegistrationStatus(reg.id, 'rejected')}
                                >
                                  <X className="mr-1 h-4 w-4" /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedEvent.registration_flow === 'form_review' && (
                <div className="card space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Registration form</h2>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="input-field"
                      placeholder="Form title"
                      value={formInfo.title}
                      onChange={(event) => setFormInfo((prev) => ({ ...prev, title: event.target.value }))}
                    />
                    <input
                      className="input-field"
                      placeholder="Form description"
                      value={formInfo.description}
                      onChange={(event) => setFormInfo((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    {formFields.length === 0 ? (
                      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                        No fields yet. Add questions to capture responses from students.
                      </div>
                    ) : (
                      formFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{field.label}</div>
                            <div className="text-xs text-slate-500">
                              {field.type.replace('_', ' ')} · {field.required ? 'Required' : 'Optional'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(field.id)}
                            className="rounded-full bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="input-field"
                        placeholder="Question label"
                        value={newField.label}
                        onChange={(event) => setNewField((prev) => ({ ...prev, label: event.target.value }))}
                      />
                      <select
                        className="input-field"
                        value={newField.type}
                        onChange={(event) => setNewField((prev) => ({ ...prev, type: event.target.value as FormFieldDefinition['type'] }))}
                      >
                        <option value="short_text">Short text</option>
                        <option value="paragraph">Paragraph</option>
                        <option value="select">Dropdown</option>
                        <option value="multi_select">Checkboxes</option>
                      </select>
                      <input
                        className="input-field"
                        placeholder="Placeholder (optional)"
                        value={newField.placeholder}
                        onChange={(event) => setNewField((prev) => ({ ...prev, placeholder: event.target.value }))}
                      />
                      {(newField.type === 'select' || newField.type === 'multi_select') && (
                        <input
                          className="input-field"
                          placeholder="Options (comma separated)"
                          value={newField.options}
                          onChange={(event) => setNewField((prev) => ({ ...prev, options: event.target.value }))}
                        />
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={newField.required}
                        onChange={(event) => setNewField((prev) => ({ ...prev, required: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600"
                      />
                      Required field
                    </label>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="btn-ghost inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add field
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveForm}
                    className="btn-secondary inline-flex items-center"
                    disabled={savingForm}
                  >
                    {savingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                    Save form
                  </button>
                </div>
              )}

              <div className="card space-y-4">
                <div className="flex items-center gap-2">
                  <Vote className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Polls</h2>
                </div>

                {polls.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                    No polls created yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {polls.map((poll) => (
                      <div key={poll.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{poll.question}</div>
                            {poll.description && <div className="text-xs text-slate-500">{poll.description}</div>}
                            <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                              {poll.is_published ? 'Published' : 'Draft'} · {poll.event_poll_votes.length} votes
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-ghost inline-flex items-center text-xs text-primary-600 hover:text-primary-700"
                              onClick={() => handleTogglePollPublish(poll.id, !poll.is_published)}
                            >
                              <Send className="mr-1 h-4 w-4" /> {poll.is_published ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost inline-flex items-center text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => handleDeletePoll(poll.id)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" /> Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {poll.opens_at && (
                            <div>
                              Opens: {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(poll.opens_at))}
                            </div>
                          )}
                          {poll.closes_at && (
                            <div>
                              Closes: {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(poll.closes_at))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="input-field"
                      placeholder="Poll question"
                      value={newPoll.question}
                      onChange={(event) => setNewPoll((prev) => ({ ...prev, question: event.target.value }))}
                    />
                    <input
                      className="input-field"
                      placeholder="Short description"
                      value={newPoll.description}
                      onChange={(event) => setNewPoll((prev) => ({ ...prev, description: event.target.value }))}
                    />
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={newPoll.opensAt}
                      onChange={(event) => setNewPoll((prev) => ({ ...prev, opensAt: event.target.value }))}
                    />
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={newPoll.closesAt}
                      onChange={(event) => setNewPoll((prev) => ({ ...prev, closesAt: event.target.value }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={newPoll.isPublished}
                      onChange={(event) => setNewPoll((prev) => ({ ...prev, isPublished: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    Publish immediately after creating
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input-field"
                      placeholder="Add poll option"
                      value={pollOptionDraft}
                      onChange={(event) => setPollOptionDraft(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddPollOption}
                      className="btn-ghost inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add
                    </button>
                  </div>
                  {newPollOptions.length > 0 && (
                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="font-semibold text-slate-600">Options:</div>
                      {newPollOptions.map((option, index) => (
                        <div key={`${option}-${index}`} className="rounded bg-slate-100 px-2 py-1">
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCreatePoll}
                    className="btn-secondary inline-flex items-center"
                    disabled={creatingPoll}
                  >
                    {creatingPoll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Vote className="mr-2 h-4 w-4" />}
                    Create poll
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center gap-4 py-16 text-center">
              <AlertCircle className="h-12 w-12 text-slate-300" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Select an event to manage</h2>
                <p className="text-sm text-slate-600">Choose an event from the left sidebar to view registrations and polls.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
