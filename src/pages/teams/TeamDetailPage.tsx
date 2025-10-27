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

interface JoinRequest {
  id: string
  team_id: string
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  created_at: string
  reviewed_at: string | null
  users?: {
    id: string
    name: string
    email: string
    section: string
    year: number
    profile_picture_url: string | null
  }
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
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null)
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
  const [processingRequests, setProcessingRequests] = useState<Record<string, 'approve' | 'reject'>>({})

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

      let userIsMember = false

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
        userIsMember = sortedMembers?.some((m: any) => m.user_id === user?.id) || false
        setMembers(sortedMembers as any)
        setIsMember(userIsMember)
      }

      // Load join requests so leaders can approve them and members see pending status
      try {
        const { data: joinRequestsData, error: joinRequestsError } = await supabase
          .from('team_join_requests')
          .select(`
            id,
            team_id,
            requester_id,
            status,
            message,
            created_at,
            reviewed_at,
            users:requester_id (
              id,
              name,
              email,
              section,
              year,
              profile_picture_url
            )
          `)
          .eq('team_id', id)

        if (joinRequestsError) {
          console.error('Error loading join requests:', joinRequestsError)
          setPendingRequests([])
          setJoinRequest(null)
        } else {
          const requests = (joinRequestsData as unknown as JoinRequest[]) || []
          setPendingRequests(requests.filter((request) => request.status === 'pending'))

          if (user && !userIsMember) {
            const currentRequest = requests.find(
              (request) => request.requester_id === user.id
            )
            setJoinRequest(
              currentRequest && currentRequest.status !== 'approved'
                ? currentRequest
                : null
            )
          } else {
            setJoinRequest(null)
          }
        }
      } catch (joinRequestsCatchError: any) {
        console.warn('Join requests unavailable:', joinRequestsCatchError?.message || joinRequestsCatchError)
        setPendingRequests([])
        setJoinRequest(null)
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

  const handleRequestToJoin = async () => {
    if (!user || !team) return

    if (team.is_full) {
      toast.error('This team is full')
      return
    }

    if (joinRequest?.status === 'pending') {
      toast.error('Your join request is already pending review')
      return
    }

    setJoining(true)
    try {
      if (joinRequest && joinRequest.status === 'rejected') {
        const { error: updateError } = await supabase
          .from('team_join_requests')
          // @ts-expect-error - Supabase type definition needs regeneration
          .update({
            status: 'pending',
            reviewed_at: null,
          })
          .eq('id', joinRequest.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('team_join_requests')
          // @ts-expect-error - Supabase type definition needs regeneration
          .insert({
            team_id: team.id,
            requester_id: user.id,
          })

        if (insertError) throw insertError
      }

      toast.success(
        joinRequest && joinRequest.status === 'rejected'
          ? 'Join request resubmitted to the team leader'
          : 'Join request sent to the team leader'
      )
      loadTeamData()
    } catch (error: any) {
      console.error('Error requesting to join team:', error)
      const message =
        error?.code === '23505'
          ? 'You already have a pending join request for this team'
          : error.message || 'Failed to send join request'
      toast.error(message)
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

  const handleApproveRequest = async (request: JoinRequest) => {
    if (!team || !isLeader) return

    if (team.is_full) {
      toast.error('This team is already full')
      return
    }

    setProcessingRequests((state) => ({ ...state, [request.id]: 'approve' }))

    try {
      const { error: memberError } = await supabase
        .from('team_members')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          team_id: team.id,
          user_id: request.requester_id,
        })

      if (memberError) throw memberError

      await supabase
        .from('teams')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          member_count: team.member_count + 1,
          is_full: team.member_count + 1 >= 4,
        })
        .eq('id', team.id)

      await supabase
        .from('team_join_requests')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      toast.success(`${request.users?.name || 'Member'} added to the team`)
      loadTeamData()
    } catch (error: any) {
      console.error('Error approving join request:', error)
      const message =
        error?.code === '23505'
          ? 'This student already belongs to another team'
          : error.message || 'Failed to approve join request'
      toast.error(message)
    } finally {
      setProcessingRequests((state) => {
        const next = { ...state }
        delete next[request.id]
        return next
      })
    }
  }

  const handleRejectRequest = async (request: JoinRequest) => {
    if (!team || !isLeader) return

    setProcessingRequests((state) => ({ ...state, [request.id]: 'reject' }))

    try {
      const { error } = await supabase
        .from('team_join_requests')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) throw error

      toast.success('Join request rejected')
      loadTeamData()
    } catch (error: any) {
      console.error('Error rejecting join request:', error)
      toast.error(error.message || 'Failed to reject request')
    } finally {
      setProcessingRequests((state) => {
        const next = { ...state }
        delete next[request.id]
        return next
      })
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Team not found</h2>
        <button
          onClick={() => navigate('/teams')}
          className="text-primary-600 hover:text-primary-700"
        >
          Back to Teams
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <button
        onClick={() => navigate('/teams')}
        className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Teams
      </button>

      <div className="card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
              <span
                className={`badge ${
                  team.is_full ? 'badge-error' : 'badge-success'
                } text-xs uppercase tracking-wide`}
              >
                {team.is_full ? 'Full' : 'Open'}
              </span>
            </div>
            <p className="text-slate-600">
              {team.description || 'No description provided'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {team.member_count}/4 members
              </span>
              <span>Year {team.year}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isMember && (
              <button
                onClick={handleRequestToJoin}
                disabled={joining || team.is_full || joinRequest?.status === 'pending'}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {joining ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                {team.is_full
                  ? 'Team Full'
                  : joinRequest?.status === 'pending'
                    ? 'Request Pending'
                    : joinRequest?.status === 'rejected'
                      ? 'Resubmit Request'
                      : 'Request To Join'}
              </button>
            )}

            {isMember && !isLeader && (
              <button
                onClick={handleLeaveTeam}
                className="btn-outline flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <UserMinus className="h-5 w-5" />
                Leave Team
              </button>
            )}

            {isLeader && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowRecruitmentModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Post Recruitment
                </button>
                <button
                  onClick={handleDeleteTeam}
                  className="btn-outline flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  title="Delete Team"
                >
                  <Trash2 className="h-5 w-5" />
                  Delete Team
                </button>
              </div>
            )}
          </div>
        </div>

        {!isMember && joinRequest?.status === 'pending' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-700">
            <CheckCircle2 className="h-4 w-4" />
            Waiting for the team leader to review your request.
          </div>
        )}

        {!isMember && joinRequest?.status === 'rejected' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            Your previous request was declined. Update your profile and try again.
          </div>
        )}

        {team.is_full && !isMember && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
            <XCircle className="h-4 w-4" />
            This team is currently full.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <Users className="h-6 w-6" />
              Team Members ({members.length})
            </h2>
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-600">
                      {member.users.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{member.users.name}</p>
                        {member.user_id === team.leader_id && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Year {member.users.year} · Section {member.users.section}
                      </p>
                      {member.users.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {member.users.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-600"
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
                      onClick={() => handleRemoveMember(member.id, member.users.name)}
                      className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50"
                      title="Remove member"
                    >
                      <UserMinus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isLeader && (
            <div className="card">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
                <UserPlus className="h-6 w-6" />
                Pending Join Requests
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-slate-600">No pending requests right now.</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {request.users?.name || 'Unknown student'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {request.users?.email}
                          </p>
                          {request.users?.section && request.users?.year && (
                            <p className="text-xs text-slate-500">
                              Year {request.users.year} · Section {request.users.section}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Requested {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          disabled={processingRequests[request.id] === 'approve'}
                          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
                        >
                          {processingRequests[request.id] === 'approve' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request)}
                          disabled={processingRequests[request.id] === 'reject'}
                          className="btn-outline flex items-center gap-2 border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:border-red-400 disabled:opacity-60"
                        >
                          {processingRequests[request.id] === 'reject' ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-red-500"></div>
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <Briefcase className="h-6 w-6" />
              Recruitments
            </h2>
            {recruitments.length === 0 ? (
              <div className="py-8 text-center">
                <Briefcase className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="text-sm text-slate-600">No recruitment posts yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recruitments.map((recruitment) => (
                  <div key={recruitment.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <Link
                        to={`/recruitment/${recruitment.id}`}
                        className="flex-1 font-medium text-slate-900 transition-colors hover:text-primary-600"
                      >
                        {recruitment.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            recruitment.status === 'open'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-200 text-slate-600'
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
                            className="rounded border border-red-200 p-1 text-red-600 transition-colors hover:bg-red-50"
                            title="Delete recruitment post"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Link to={`/recruitment/${recruitment.id}`} className="block">
                      <p className="mb-2 text-sm text-slate-600 line-clamp-2">
                        {recruitment.description}
                      </p>
                      <p className="text-xs text-slate-500">
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
