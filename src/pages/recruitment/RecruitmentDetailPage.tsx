import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { TableInsert, TableRow, TableUpdate } from '@/types/database'

interface RecruitmentDetails {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  status: 'open' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  posted_by: string
  team_id: string
  teams: {
    id: string
    name: string
    description: string | null
    year: number
    member_count: number
    is_full: boolean
  } | null
  users: {
    id: string
    name: string
    email: string
    section: string | null
    year: number | null
  } | null
}

type ApplicationRow = TableRow<'applications'>
type ApplicationInsert = TableInsert<'applications'>
type ApplicationUpdate = TableUpdate<'applications'>

export default function RecruitmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [recruitment, setRecruitment] = useState<RecruitmentDetails | null>(null)
  const [application, setApplication] = useState<ApplicationRow | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const isRecruitmentOpen = recruitment?.status === 'open'
  const isOwner = user?.id === recruitment?.posted_by

  useEffect(() => {
    if (!id) return
    loadRecruitment()
  }, [id, user?.id])

  const loadRecruitment = async () => {
    if (!id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          description,
          required_skills,
          positions_available,
          status,
          created_at,
          updated_at,
          posted_by,
          team_id,
          teams:team_id (
            id,
            name,
            description,
            year,
            member_count,
            is_full
          ),
          users:posted_by (
            id,
            name,
            email,
            section,
            year
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Recruitment not found')
          navigate('/recruitment')
          return
        }
        throw error
      }

      setRecruitment(data as RecruitmentDetails)

      if (user) {
        const { data: existingApplications, error: applicationError } = await supabase
          .from('applications')
          .select('*')
          .eq('recruitment_post_id', id)
          .eq('applicant_id', user.id)

        if (!applicationError) {
          const applications = (existingApplications ?? []) as ApplicationRow[]
          const currentApplication = applications[0] ?? null
          setApplication(currentApplication)
          setMessage(currentApplication?.message ?? '')
        }
      }
    } catch (error: any) {
      console.error('Error loading recruitment:', error)
      toast.error('Failed to load recruitment details')
      navigate('/recruitment')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !recruitment) {
      toast.error('You must be signed in to apply')
      return
    }

    if (!isRecruitmentOpen) {
      toast.error('This recruitment is not accepting applications right now')
      return
    }

    if (isOwner) {
      toast.error('You cannot apply to your own recruitment post')
      return
    }

    if (application && application.status !== 'pending') {
      toast.error('This application has already been reviewed')
      return
    }

    setSubmitting(true)
    try {
      if (application) {
        const updatePayload: ApplicationUpdate = {
          message: message.trim() || null,
        }

        const { error } = await supabase
          .from('applications')
          .update(updatePayload as never)
          .eq('id', application.id)

        if (error) throw error

        toast.success('Application updated')
      } else {
        const insertPayload: ApplicationInsert = {
          recruitment_post_id: recruitment.id,
          applicant_id: user.id,
          message: message.trim() || null,
          status: 'pending',
        }

        const { error } = await supabase
          .from('applications')
          .insert([insertPayload] as never)

        if (error) {
          if (error.code === '23505') {
            toast.error('You have already applied to this recruitment')
          } else {
            throw error
          }
        } else {
          toast.success('Application submitted')
        }
      }

      await loadRecruitment()
    } catch (error: any) {
      console.error('Error submitting application:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!recruitment) {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <button
        onClick={() => navigate('/recruitment')}
        className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to recruitments
      </button>

      <div className="card space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{recruitment.title}</h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  recruitment.status === 'open'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {recruitment.status}
              </span>
            </div>
            <p className="text-slate-600">
              Posted by {recruitment.users?.name ?? 'Unknown'} ·{' '}
              {new Date(recruitment.created_at).toLocaleDateString()}
            </p>
          </div>

          {isOwner && (
            <Link
              to="/recruitment/applications"
              className="btn-primary flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Manage applications
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {recruitment.positions_available} position(s)
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team {recruitment.teams?.name ?? 'N/A'} (Year {recruitment.teams?.year ?? '-'})
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Updated {new Date(recruitment.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">About the role</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">
              {recruitment.description}
            </p>
          </div>

          {recruitment.required_skills.length > 0 && (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Required skills</h2>
              <div className="flex flex-wrap gap-2">
                {recruitment.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recruitment.teams && (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Team overview</h2>
              <div className="space-y-3 text-slate-700">
                <p>{recruitment.teams.description || 'No team description provided yet.'}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span>Members: {recruitment.teams.member_count}/4</span>
                  <span>Status: {recruitment.teams.is_full ? 'Full' : 'Accepting members'}</span>
                  <span>Year: {recruitment.teams.year}</span>
                </div>
                <Link
                  to={`/teams/${recruitment.teams.id}`}
                  className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  View team profile →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Apply to this role</h2>

            {isOwner ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
                <CheckCircle2 className="h-4 w-4" />
                You posted this recruitment. Manage applications below.
              </div>
            ) : !isRecruitmentOpen ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                <XCircle className="h-4 w-4" />
                Applications are currently closed for this role.
              </div>
            ) : application && application.status !== 'pending' ? (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  application.status === 'accepted'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {application.status === 'accepted' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Your application was {application.status}.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmitApplication}>
                <label className="block text-sm font-medium text-slate-700">
                  Message to the team (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  placeholder="Share why you are a great fit, highlight relevant experience, or mention availability."
                  className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  disabled={submitting}
                  maxLength={600}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{message.length}/600 characters</span>
                  {application && application.status === 'pending' && (
                    <span>Updating your note keeps the request pending.</span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center"
                >
                  {submitting ? 'Submitting…' : application ? 'Update application' : 'Submit application'}
                </button>
              </form>
            )}
          </div>

          <div className="card space-y-3 text-sm text-slate-600">
            <h3 className="text-base font-semibold text-slate-900">Need help?</h3>
            <p>
              After submitting, the team leader will review your application. You can monitor your
              status here or reach out via messages if invited.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
