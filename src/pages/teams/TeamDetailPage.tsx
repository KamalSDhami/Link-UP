import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Users,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Briefcase,
  Plus,
  Crown,
  Mail,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import CreateRecruitmentModal from '@/components/CreateRecruitmentModal'

interface Team {
  id: string
  name: string
  description: string | null
  year: number
  leader_id: string
  member_count: number
  is_full: boolean
  created_at: string
}

interface TeamMember {
  id: string
  user_id: string
  joined_at: string
  users: {
    id: string
    name: string
    email: string
    section: string
    year: number
    skills: string[]
    profile_picture_url: string | null
  }
}

interface RecruitmentPost {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  status: 'open' | 'closed' | 'archived'
  created_at: string
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [recruitments, setRecruitments] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isLeader, setIsLeader] = useState(false)
  const [showRecruitmentModal, setShowRecruitmentModal] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (id) {
      loadTeamData()
    }
  }, [id, user])

  const loadTeamData = async () => {
    if (!id) return

    setLoading(true)
    try {
      // Load team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single()

      if (teamError) throw teamError
      const teamRecord = teamData as any
      setTeam(teamData)
      setIsLeader(user?.id === teamRecord.leader_id)

      // Load team members - using explicit foreign key relationship
      console.log('Loading members for team:', id)
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          joined_at,
          users:user_id (
            id,
            name,
            email,
            section,
            year,
            skills,
            profile_picture_url
          )
        `)
        .eq('team_id', id)

      console.log('Members query result:', { membersData, membersError })

      if (membersError) {
        console.error('Error loading members:', membersError)
        console.error('Full error details:', JSON.stringify(membersError, null, 2))
        toast.error('Failed to load team members')
        // Don't throw - try to show team at least
        setMembers([])
        setIsMember(false)
      } else {
        console.log('Members loaded successfully:', membersData)
        // Sort manually
        const sortedMembers = (membersData || []).sort((a: any, b: any) => 
          new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        )
        setMembers(sortedMembers as any)
        setIsMember(sortedMembers?.some((m: any) => m.user_id === user?.id) || false)
      }

      // Load recruitment posts (optional - don't fail if table doesn't exist)
      try {
        console.log('Loading recruitment posts for team:', id)
        const { data: recruitmentsData, error: recruitmentsError } = await supabase
          .from('recruitment_posts')
          .select('*')
          .eq('team_id', id)

        console.log('Recruitment query result:', { recruitmentsData, recruitmentsError })

        if (!recruitmentsError && recruitmentsData) {
          // Sort manually by created_at desc
          const sortedRecruitments = recruitmentsData.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setRecruitments(sortedRecruitments)
        } else {
          setRecruitments([])
        }
      } catch (recruitError) {
        console.log('Recruitment posts not available:', recruitError)
        setRecruitments([])
      }
    } catch (error: any) {
      console.error('Error loading team:', error)
      console.error('Full error:', JSON.stringify(error, null, 2))
      
      // Only navigate away if the team itself failed to load
      if (!team) {
        toast.error('Failed to load team details')
        navigate('/teams')
      } else {
        toast.error('Some team data failed to load')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!user || !team) return

    if (team.is_full) {
      toast.error('This team is full')
      return
    }

    setJoining(true)
    try {
      const { error } = await supabase
        .from('team_members')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          team_id: team.id,
          user_id: user.id,
        })

      if (error) throw error

      // Update member count
      await supabase
        .from('teams')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          member_count: team.member_count + 1,
          is_full: team.member_count + 1 >= 4,
        })
        .eq('id', team.id)

      toast.success('✅ Successfully joined the team!')
      loadTeamData()
    } catch (error: any) {
      console.error('Error joining team:', error)
      toast.error(error.message || 'Failed to join team')
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!user || !team || isLeader) return

    if (
      !confirm(
        'Are you sure you want to leave this team? This action cannot be undone.'
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', user.id)

      if (error) throw error

      // Update member count
      await supabase
        .from('teams')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          member_count: team.member_count - 1,
          is_full: false,
        })
        .eq('id', team.id)

      toast.success('You have left the team')
      navigate('/teams')
    } catch (error: any) {
      console.error('Error leaving team:', error)
      toast.error('Failed to leave team')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isLeader || !team) return

    if (
      !confirm(`Are you sure you want to remove ${memberName} from the team?`)
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      // Update member count
      await supabase
        .from('teams')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          member_count: team.member_count - 1,
          is_full: false,
        })
        .eq('id', team.id)

      toast.success(`${memberName} has been removed from the team`)
      loadTeamData()
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  const handleDeleteTeam = async () => {
    if (!isLeader || !team) return

    if (
      !confirm(
        `Are you sure you want to delete "${team.name}"? This action cannot be undone and will remove all team data including recruitment posts.`
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (error) throw error

      toast.success('Team deleted successfully')
      navigate('/teams')
    } catch (error: any) {
      console.error('Error deleting team:', error)
      toast.error('Failed to delete team')
    }
  }

  const handleDeleteRecruitment = async (recruitmentId: string, title: string) => {
    if (!isLeader) return

    if (
      !confirm(`Are you sure you want to delete the recruitment post "${title}"?`)
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('recruitment_posts')
        .delete()
        .eq('id', recruitmentId)

      if (error) throw error

      toast.success('Recruitment post deleted successfully')
      loadTeamData()
    } catch (error: any) {
      console.error('Error deleting recruitment:', error)
      toast.error('Failed to delete recruitment post')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Team not found
          </h2>
          <button
            onClick={() => navigate('/teams')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Teams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/teams')}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Teams
          </button>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                    {team.name}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      team.is_full
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    }`}
                  >
                    {team.is_full ? 'Full' : 'Open'}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {team.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{team.member_count}/4 members</span>
                  </div>
                  <div>Year {team.year}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!isMember && !team.is_full && (
                  <button
                    onClick={handleJoinTeam}
                    disabled={joining}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {joining ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Joining...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Join Team
                      </>
                    )}
                  </button>
                )}
                {isMember && !isLeader && (
                  <button
                    onClick={handleLeaveTeam}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <UserMinus className="w-5 h-5" />
                    Leave Team
                  </button>
                )}
                {isLeader && (
                  <>
                    <button
                      onClick={() => setShowRecruitmentModal(true)}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Post Recruitment
                    </button>
                    <button
                      onClick={handleDeleteTeam}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                      title="Delete Team"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Members */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Users className="w-6 h-6" />
                Team Members ({members.length})
              </h2>
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold">
                        {member.users.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {member.users.name}
                          </p>
                          {member.user_id === team.leader_id && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Year {member.users.year} · Section{' '}
                          {member.users.section}
                        </p>
                        {member.users.skills.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {member.users.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs rounded"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {isLeader && member.user_id !== team.leader_id && (
                      <button
                        onClick={() =>
                          handleRemoveMember(member.id, member.users.name)
                        }
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recruitment Posts */}
          <div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Briefcase className="w-6 h-6" />
                Recruitments
              </h2>
              {recruitments.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    No recruitment posts yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recruitments.map((recruitment) => (
                    <div
                      key={recruitment.id}
                      className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Link
                          to={`/recruitment/${recruitment.id}`}
                          className="flex-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {recruitment.title}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              recruitment.status === 'open'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {recruitment.status}
                          </span>
                          {isLeader && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                handleDeleteRecruitment(recruitment.id, recruitment.title)
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete recruitment post"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <Link
                        to={`/recruitment/${recruitment.id}`}
                        className="block"
                      >
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {recruitment.description}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {recruitment.positions_available} position(s) available
                        </p>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recruitment Modal */}
      {showRecruitmentModal && (
        <CreateRecruitmentModal
          teamId={team.id}
          onClose={() => setShowRecruitmentModal(false)}
          onSuccess={loadTeamData}
        />
      )}
    </div>
  )
}
