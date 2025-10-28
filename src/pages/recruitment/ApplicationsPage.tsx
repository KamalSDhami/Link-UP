import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Briefcase,
  Users,
  Filter,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import type { TableInsert, TableRow, TableUpdate } from '@/types/database'
import { sendNotification } from '@/utils/notifications'

type ApplicantProfile = TableRow<'users'>
type ApplicationRow = TableRow<'applications'>
type ApplicationRecord = ApplicationRow & {
  applicant: ApplicantProfile | null
}
type RecruitmentRow = TableRow<'recruitment_posts'>
type RecruitmentWithApplications = RecruitmentRow & {
  teams: {
    id: string
    name: string
    year: number
  } | null
  applications: ApplicationRecord[]
}
type ApplicationUpdate = TableUpdate<'applications'>
type TeamMemberInsert = TableInsert<'team_members'>
type RecruitmentUpdate = TableUpdate<'recruitment_posts'>

export default function ApplicationsPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [recruitments, setRecruitments] = useState<RecruitmentWithApplications[]>([])
  const [filters, setFilters] = useState({ recruitmentId: 'all', status: 'pending' })
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (user?.id) {
      loadApplications()
    }
  }, [user?.id])

  const loadApplications = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          status,
          positions_available,
          expires_at,
          created_at,
          team_id,
          teams:team_id (
            id,
            name,
            year
          ),
          applications (
            id,
            applicant_id,
            message,
            status,
            applied_at,
            reviewed_at,
            applicant:users!applications_applicant_id_fkey (
              id,
              name,
              email,
              section,
              year,
              skills,
              profile_picture_url
            )
          )
        `)
        .eq('posted_by', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const normalized = ((data || []) as unknown as RecruitmentWithApplications[]).map(
        (post) => ({
          ...post,
          applications: (post.applications || []) as ApplicationRecord[],
        })
      )

      setRecruitments(normalized)
    } catch (error: any) {
      console.error('Error loading applications:', error?.message || error)
      if (error?.details || error?.hint) {
        console.error('Applications load details:', {
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
      }
      toast.error('Failed to load applications')
      setRecruitments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRecruitments = useMemo(() => {
    return recruitments
      .filter((post) => (filters.recruitmentId === 'all' ? true : post.id === filters.recruitmentId))
      .map((post) => ({
        ...post,
        applications: post.applications.filter((application) =>
          filters.status === 'all' ? true : application.status === filters.status
        ),
      }))
      .filter((post) => post.applications.length > 0)
  }, [filters.recruitmentId, filters.status, recruitments])

  const totalPending = useMemo(
    () =>
      recruitments.reduce(
        (count, post) => count + post.applications.filter((app) => app.status === 'pending').length,
        0
      ),
    [recruitments]
  )

  const handleDecision = async (
    post: RecruitmentWithApplications,
    application: ApplicationRecord,
    newStatus: 'accepted' | 'rejected'
  ) => {
    setUpdating((prev) => ({ ...prev, [application.id]: true }))
    try {
      const updatePayload: ApplicationUpdate = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('applications')
        .update(updatePayload as never)
        .eq('id', application.id)

      if (error) throw error

      if (newStatus === 'accepted') {
        const memberInsert: TeamMemberInsert = {
          team_id: post.team_id,
          user_id: application.applicant_id,
        }

        const { error: memberError } = await supabase
          .from('team_members')
          .insert([memberInsert] as never)

        if (memberError && memberError.code !== '23505') {
          throw memberError
        }

        const recruitmentPayload: RecruitmentUpdate = {
          status: post.positions_available > 1 ? 'open' : 'closed',
          expires_at: new Date().toISOString(),
        }

        if (post.positions_available > 1) {
          recruitmentPayload.positions_available = Math.max(post.positions_available - 1, 1)
        }

        const { error: recruitmentError } = await supabase
          .from('recruitment_posts')
          .update(recruitmentPayload as never)
          .eq('id', post.id)

        if (recruitmentError && recruitmentError.code !== '23514') {
          throw recruitmentError
        }

        await sendNotification({
          userId: application.applicant_id,
          type: 'team_invite',
          title: 'Application accepted',
          message: `You have been added to ${post.teams?.name ?? 'a team'} via recruitment.`,
          link: `/teams/${post.team_id}`,
        })
      }

      toast.success(`Application ${newStatus}`)
      await loadApplications()
    } catch (error: any) {
      console.error('Error updating application:', error)
      toast.error(error.message || 'Failed to update application')
    } finally {
      setUpdating((prev) => {
        const next = { ...prev }
        delete next[application.id]
        return next
      })
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-slate-900">
          <Briefcase className="h-10 w-10 text-primary-600" />
          Recruitment applications
        </h1>
        <p className="text-slate-600">
          Review applicants across all of your open recruitment posts and respond in one place.
        </p>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Recruitment</label>
            <select
              className="input-field"
              value={filters.recruitmentId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, recruitmentId: event.target.value }))
              }
            >
              <option value="all">All roles</option>
              {recruitments.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Status</label>
            <select
              className="input-field"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
            <Filter className="h-4 w-4" />
            {totalPending} pending application{totalPending === 1 ? '' : 's'} awaiting review
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card animate-pulse space-y-4">
              <div className="h-6 w-2/3 rounded bg-slate-200"></div>
              <div className="h-4 w-1/2 rounded bg-slate-200"></div>
              <div className="h-20 w-full rounded bg-slate-200"></div>
            </div>
          ))}
        </div>
      ) : filteredRecruitments.length === 0 ? (
        <div className="card text-center">
          <Users className="mx-auto mb-4 h-16 w-16 text-slate-300" />
          <h3 className="mb-2 text-xl font-semibold text-slate-900">No applications found</h3>
          <p className="text-slate-600">
            {filters.status === 'pending'
              ? 'You currently have no pending applications to review.'
              : 'Try switching filters or check back once new applications arrive.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRecruitments.map((post) => (
            <div key={post.id} className="card space-y-6">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{post.title}</h2>
                  <p className="text-sm text-slate-600">
                    {post.teams?.name ?? 'Unknown team'} · Year {post.teams?.year ?? '-'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {post.positions_available} position(s)
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Posted {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {post.applications.map((application) => (
                  <div key={application.id} className="rounded-xl border border-slate-200 p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
                        <div className="h-14 w-14 flex-shrink-0">
                          {application.applicant?.profile_picture_url ? (
                            <img
                              src={application.applicant.profile_picture_url}
                              alt={application.applicant?.name ?? 'Applicant avatar'}
                              className="h-14 w-14 rounded-full object-cover shadow-sm"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                              {(application.applicant?.name ?? 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {application.applicant?.name ?? 'Unknown applicant'}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                application.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : application.status === 'accepted'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {application.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {application.applicant?.email}
                            {application.applicant?.section && (
                              <>
                                {' '}
                                · Section {application.applicant.section}
                              </>
                            )}
                            {application.applicant?.year && (
                              <>
                                {' '}
                                · Year {application.applicant.year}
                              </>
                            )}
                          </p>
                          {application.applicant?.skills?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {application.applicant.skills.slice(0, 3).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-2 text-sm text-slate-500">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Applied {new Date(application.applied_at).toLocaleDateString()}
                        </span>
                        {application.reviewed_at && (
                          <span>Reviewed {new Date(application.reviewed_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {application.message && (
                      <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                        {application.message}
                      </div>
                    )}

                    {application.status === 'pending' && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleDecision(post, application, 'accepted')}
                          disabled={Boolean(updating[application.id])}
                          className="btn-primary flex items-center gap-2"
                        >
                          {updating[application.id] ? 'Processing...' : 'Accept'}
                          {!updating[application.id] && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDecision(post, application, 'rejected')}
                          disabled={Boolean(updating[application.id])}
                          className="btn-outline flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        >
                          {updating[application.id] ? 'Processing...' : 'Reject'}
                          {!updating[application.id] && <XCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                <span>
                  {post.applications.length} application{post.applications.length === 1 ? '' : 's'}
                  {filters.status !== 'all' && ` in ${filters.status} status`}
                </span>
                <Link
                  to={`/recruitment/${post.id}`}
                  className="text-primary-600 hover:text-primary-700"
                >
                  View role →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
