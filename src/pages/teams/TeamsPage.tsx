import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, UserCheck, Plus, TrendingUp, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

interface Team {
  id: string
  name: string
  description: string | null
  year: number
  member_count: number
  is_full: boolean
  leader_id: string
  purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
  max_size: number
  users?: {
    name: string
    section: string
  }
}

const YEARS = [1, 2, 3, 4]

const PURPOSE_LABELS: Record<Team['purpose'], string> = {
  hackathon: 'Hackathon',
  college_event: 'College Event',
  pbl: 'Project Based Learning',
  other: 'Other',
}
const SECTIONS = (() => {
  const sections = []
  for (let letter = 65; letter <= 90; letter++) { // A-Z
    for (let num = 1; num <= 2; num++) {
      sections.push(`${String.fromCharCode(letter)}${num}`)
    }
  }
  return sections
})()

export default function TeamsPage() {
  const { user } = useAuthStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    year: '',
    section: '',
    showFull: true,
  })

  useEffect(() => {
    if (user?.id) {
      loadTeams()
    } else {
      setTeams([])
    }
  }, [filters, user?.id])

  const loadTeams = async () => {
    setLoading(true)
    try {
      if (!user?.id) {
        setTeams([])
        setLoading(false)
        return
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      const teamIds = membershipData?.map((member: any) => member.team_id) || []

      if (teamIds.length === 0) {
        setTeams([])
        setLoading(false)
        return
      }

      // First, get teams
      let query = supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.year) {
        query = query.eq('year', parseInt(filters.year))
      }

      if (!filters.showFull) {
        query = query.eq('is_full', false)
      }

      const { data: teamsData, error: teamsError } = await query

      if (teamsError) throw teamsError

      // Get unique leader IDs
      const leaderIds = [...new Set(teamsData.map((team: any) => team.leader_id))]

      // Fetch leader details
      const { data: leadersData, error: leadersError } = await supabase
        .from('users')
        .select('id, name, section')
        .in('id', leaderIds)

      if (leadersError) throw leadersError

      // Map leaders to teams
      const leadersMap = new Map(leadersData?.map((leader: any) => [leader.id, leader]) || [])
      
      const teamsWithLeaders = teamsData.map((team: any) => ({
        ...team,
        users: leadersMap.get(team.leader_id)
      }))

      // Filter by section in memory if needed
      let filteredData = teamsWithLeaders
      if (filters.section) {
        filteredData = filteredData.filter(
          (team) => team.users?.section === filters.section
        )
      }

      setTeams(filteredData)
    } catch (error: any) {
      console.error('Error loading teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = useMemo(
    () =>
      teams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teams, searchQuery]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
            Browse Teams
          </h1>
          <p className="text-slate-600">
            Find the perfect team for your next project
          </p>
        </div>
        <Link to="/teams/create" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Team
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search teams..."
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
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <select
              className="input-field"
              value={filters.section}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
            >
              <option value="">All Sections</option>
              {SECTIONS.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
          </div>

          {/* Show Full Teams Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer h-full px-4 py-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={filters.showFull}
                onChange={(e) =>
                  setFilters({ ...filters, showFull: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-slate-700">Show Full Teams</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span>{filteredTeams.length} teams found</span>
        </div>
        {filters.year && (
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full">
            Year {filters.year}
          </span>
        )}
        {filters.section && (
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full">
            Section {filters.section}
          </span>
        )}
        {!filters.showFull && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
            Available only
          </span>
        )}
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No teams found
          </h3>
          <p className="text-slate-600 mb-6">
            {searchQuery || filters.year || filters.section
              ? 'Try adjusting your search filters'
              : 'You have not joined any teams yet.'}
          </p>
          <Link to="/teams/create" className="btn-primary inline-flex">
            <Plus className="w-5 h-5 mr-2" />
            Create Team
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.id}`}
              className="card hover:shadow-xl transition-all group"
            >
              {/* Team Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-display font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                  {team.name}
                </h3>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    team.is_full
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {team.is_full ? 'Full' : 'Open'}
                </span>
              </div>

              {/* Description */}
              <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                {team.description || 'No description provided'}
              </p>

              {/* Team Info */}
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>
                    {team.member_count}/{team.max_size} members
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  <span>{PURPOSE_LABELS[team.purpose]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">Year {team.year}</span>
                </div>
              </div>

              {/* Leader Info */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <UserCheck className="w-4 h-4 text-primary-600" />
                <span className="text-sm text-slate-700">
                  Led by{' '}
                  <span className="font-medium">{team.users?.name}</span>
                  {team.users?.section && (
                    <span className="text-slate-500">
                      {' '}
                      · Section {team.users.section}
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

