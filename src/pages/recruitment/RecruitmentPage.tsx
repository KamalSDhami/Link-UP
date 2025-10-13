import { useState, useEffect } from 'react'
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
  created_at: string
  teams: {
    id: string
    name: string
    year: number
  }
  users: {
    name: string
  }
}

export default function RecruitmentPage() {
  const [recruitments, setRecruitments] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    year: '',
    skill: '',
    status: 'open',
  })

  useEffect(() => {
    loadRecruitments()
  }, [filters])

  const loadRecruitments = async () => {
    setLoading(true)
    try {
      console.log('Loading recruitments...')
      let query = supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          description,
          required_skills,
          positions_available,
          status,
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
          )
        `)

      console.log('Recruitment query built')
      
      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      console.log('Recruitment query result:', { data, error })

      if (error) {
        console.error('Recruitment query error:', error)
        throw error
      }

      // Filter by year if selected
      let filteredData = data || []
      if (filters.year) {
        filteredData = filteredData.filter(
          (post: any) => post.teams?.year === parseInt(filters.year)
        )
      }

      // Filter by skill if selected
      if (filters.skill) {
        filteredData = filteredData.filter((post: any) =>
          post.required_skills.some((skill: string) =>
            skill.toLowerCase().includes(filters.skill.toLowerCase())
          )
        )
      }

      // Sort manually since .order() causes issues
      filteredData = filteredData.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      console.log('Filtered recruitments:', filteredData)
      setRecruitments(filteredData as any)
    } catch (error: any) {
      console.error('Error loading recruitments:', error)
      toast.error('Failed to load recruitments')
    } finally {
      setLoading(false)
    }
  }

  // Get all unique skills from all recruitment posts
  const allSkills = Array.from(
    new Set(recruitments.flatMap((r) => r.required_skills))
  ).sort()

  const filteredRecruitments = recruitments.filter(
    (recruitment) =>
      recruitment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recruitment.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recruitment.teams?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recruitment.required_skills.some((skill) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-secondary-900 mb-2 flex items-center gap-3">
          <Briefcase className="w-10 h-10 text-primary-600" />
          Browse Recruitments
        </h1>
        <p className="text-secondary-600">
          Find your next opportunity and join amazing teams
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
              <input
                type="text"
                placeholder="Search by title, team, or skills..."
                className="input-field pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <select
              className="input-field"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            >
              <option value="">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

        {/* Skill Filter Pills */}
        {allSkills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-secondary-200">
            <p className="text-sm text-secondary-600 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter by skill:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters({ ...filters, skill: '' })}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filters.skill === ''
                    ? 'bg-primary-600 text-white'
                    : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                }`}
              >
                All Skills
              </button>
              {allSkills.slice(0, 10).map((skill) => (
                <button
                  key={skill}
                  onClick={() => setFilters({ ...filters, skill })}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.skill === skill
                      ? 'bg-primary-600 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {skill}
                </button>
              ))}
              {allSkills.length > 10 && (
                <span className="px-3 py-1 text-sm text-secondary-500">
                  +{allSkills.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-secondary-600 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span>{filteredRecruitments.length} opportunities found</span>
        </div>
        {filters.year && (
          <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full">
            Year {filters.year}
          </span>
        )}
        {filters.skill && (
          <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full">
            {filters.skill}
          </span>
        )}
        {filters.status && (
          <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full capitalize">
            {filters.status} positions
          </span>
        )}
      </div>        {/* Recruitment Posts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 animate-pulse"
              >
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : filteredRecruitments.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-12 text-center">
            <Briefcase className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No recruitments found
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchQuery || filters.year || filters.skill
                ? 'Try adjusting your search filters'
                : 'Check back later for new opportunities!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecruitments.map((recruitment) => (
              <Link
                key={recruitment.id}
                to={`/recruitment/${recruitment.id}`}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {recruitment.title}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                      recruitment.status === 'open'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {recruitment.status}
                  </span>
                </div>

                {/* Team Info */}
                <div className="flex items-center gap-2 mb-3 text-sm text-slate-600 dark:text-slate-400">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{recruitment.teams?.name}</span>
                  <span>·</span>
                  <span>Year {recruitment.teams?.year}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {recruitment.description}
                </p>

                {/* Skills */}
                {recruitment.required_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {recruitment.required_skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                    {recruitment.required_skills.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">
                        +{recruitment.required_skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {recruitment.positions_available} position(s)
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                    View Details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
