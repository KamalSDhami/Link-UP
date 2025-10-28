import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Briefcase, Users, TrendingUp, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface RecruitmentPost {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  status: 'open' | 'closed' | 'archived'
  expires_at: string | null
  created_at: string
  teams: {
    id: string
    name: string
    year: number
  } | null
  users: {
    name: string
  } | null
  applications?: { id: string }[]
}

const YEARS = [1, 2, 3, 4]

export default function RecruitmentPage() {
  const [recruitments, setRecruitments] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ year: '', skill: '', status: 'open' as '' | 'open' | 'closed' | 'archived' })

  useEffect(() => {
    loadRecruitments()
  }, [filters.status])

  const loadRecruitments = async () => {
    setLoading(true)
    try {
      await supabase.rpc('mark_expired_recruitments')
      // Ignore errors from the maintenance RPC and continue with the query
    } catch (rpcError: any) {
      console.warn('Failed to mark expired recruitments:', rpcError?.message || rpcError)
    }

    try {
      let query = supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          description,
          required_skills,
          positions_available,
          status,
          expires_at,
          created_at,
          team_id,
          posted_by,
          teams:team_id (
            id,
            name,
            year
          ),
          users:posted_by (
            name
          ),
          applications:applications (
            id
          )
        `)

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      const rawData = (data || []) as RecruitmentPost[]
      const sortedData = [...rawData]
        .map((post) => {
          const expiresAt = post.expires_at ? new Date(post.expires_at) : null
          const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false
          return isExpired && post.status === 'open'
            ? { ...post, status: 'archived' as const }
            : post
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRecruitments(sortedData)
    } catch (error: any) {
      console.error('Error loading recruitments:', error)
      toast.error('Failed to load recruitments')
      setRecruitments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRecruitments = useMemo(() => {
    return recruitments
      .filter((post) =>
        filters.year ? post.teams?.year === Number(filters.year) : true
      )
      .filter((post) =>
        filters.skill
          ? post.required_skills.some((skill) =>
              skill.toLowerCase().includes(filters.skill.toLowerCase())
            )
          : true
      )
      .filter((post) => {
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase()
        return (
          post.title.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query) ||
          post.teams?.name.toLowerCase().includes(query) ||
          post.required_skills.some((skill) => skill.toLowerCase().includes(query))
        )
      })
  }, [filters.skill, filters.year, recruitments, searchQuery])

  const allSkills = useMemo(() => {
    return Array.from(new Set(recruitments.flatMap((post) => post.required_skills))).sort()
  }, [recruitments])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-slate-900">
          <Briefcase className="h-10 w-10 text-primary-600" />
          Browse Recruitments
        </h1>
        <p className="text-slate-600">Find the perfect opportunity to join a project-ready team.</p>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, team, or skills"
                className="input-field pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.year}
              onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
            >
              <option value="">All Years</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as '' | 'open' | 'closed' | 'archived',
                }))
              }
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.skill}
              onChange={(event) => setFilters((prev) => ({ ...prev, skill: event.target.value }))}
            >
              <option value="">All Skills</option>
              {allSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>
        </div>

        {allSkills.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4" />
              Quick skill filters
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, skill: '' }))}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  filters.skill === ''
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Skills
              </button>
              {allSkills.slice(0, 10).map((skill) => (
                <button
                  key={skill}
                  onClick={() => setFilters((prev) => ({ ...prev, skill }))}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    filters.skill === skill
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {skill}
                </button>
              ))}
              {allSkills.length > 10 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
                  +{allSkills.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {filteredRecruitments.length} opportunities found
        </span>
        {filters.year && (
          <span className="rounded-full bg-primary-100 px-3 py-1 text-primary-700">
            Year {filters.year}
          </span>
        )}
        {filters.skill && (
          <span className="rounded-full bg-primary-100 px-3 py-1 text-primary-700">
            {filters.skill}
          </span>
        )}
        {filters.status && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-green-700 capitalize">
            {filters.status}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card animate-pulse">
              <div className="mb-4 h-6 w-3/4 rounded bg-slate-200"></div>
              <div className="mb-2 h-4 w-full rounded bg-slate-200"></div>
              <div className="mb-4 h-4 w-2/3 rounded bg-slate-200"></div>
              <div className="h-8 w-full rounded bg-slate-200"></div>
            </div>
          ))}
        </div>
      ) : filteredRecruitments.length === 0 ? (
        <div className="card text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 text-slate-300" />
          <h3 className="mb-2 text-xl font-semibold text-slate-900">No recruitments found</h3>
          <p className="text-slate-600">
            {searchQuery || filters.year || filters.skill
              ? 'Try adjusting your search or filters.'
              : 'Check back soon for new opportunities.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecruitments.map((recruitment) => {
            const expiresAt = recruitment.expires_at ? new Date(recruitment.expires_at) : null
            const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false
            const status = expired ? 'archived' : recruitment.status
            const applicantCount = recruitment.applications?.length ?? 0

            return (
              <Link
                key={recruitment.id}
                to={`/recruitment/${recruitment.id}`}
                className="card group transition-shadow hover:shadow-2xl"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-primary-600">
                    {recruitment.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      status === 'open'
                        ? 'bg-green-100 text-green-700'
                        : status === 'closed'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{recruitment.teams?.name ?? 'Unknown team'}</span>
                  <span>·</span>
                  <span>Year {recruitment.teams?.year ?? '-'}</span>
                </div>
                <p className="mb-4 line-clamp-2 text-sm text-slate-600">{recruitment.description}</p>
                {recruitment.required_skills.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {recruitment.required_skills.slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                        {skill}
                      </span>
                    ))}
                    {recruitment.required_skills.length > 3 && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        +{recruitment.required_skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
                  <span>{recruitment.positions_available} position(s)</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-4 w-4 text-primary-500" />
                    {applicantCount} applied
                  </span>
                  <span className={`text-xs ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                    {expiresAt
                      ? expired
                        ? `Expired ${expiresAt.toLocaleString()}`
                        : `Expires ${expiresAt.toLocaleString()}`
                      : 'No expiry set'}
                  </span>
                  <span className="font-medium text-primary-600">View details →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
