import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function CreateTeamPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [checkingVerification, setCheckingVerification] = useState(true)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    year: 1,
  })

  useEffect(() => {
    checkVerification()
  }, [user])

  const checkVerification = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('gehu_verified')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setIsVerified(data?.gehu_verified || false)
    } catch (error) {
      console.error('Error checking verification:', error)
    } finally {
      setCheckingVerification(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isVerified) {
      toast.error('You must verify your GEHU email before creating a team')
      navigate('/profile')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Team name is required')
      return
    }

    if (formData.name.length < 3) {
      toast.error('Team name must be at least 3 characters')
      return
    }

    if (formData.name.length > 50) {
      toast.error('Team name must be less than 50 characters')
      return
    }

    setLoading(true)
    try {
      // Check if user already leads a team
      const { data: existingTeam, error: teamCheckError } = await supabase
        .from('teams')
        .select('id')
        .eq('leader_id', user!.id)
        .maybeSingle()

      // maybeSingle returns null if no team found, doesn't throw error
      if (existingTeam) {
        toast.error('You already lead a team. You can only lead one team at a time.')
        setLoading(false)
        return
      }

      // Create the team
      // @ts-expect-error - Supabase type definition needs regeneration
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          year: formData.year,
          leader_id: user!.id,
          member_count: 1,
          is_full: false,
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Add leader as first team member
      // @ts-expect-error - Supabase type definition needs regeneration
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user!.id,
        })

      if (memberError) throw memberError

      toast.success('🎉 Team created successfully!')
      navigate(`/teams/${team.id}`)
    } catch (error: any) {
      console.error('Error creating team:', error)
      toast.error(error.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  if (checkingVerification) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/teams')}
          className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-secondary-600" />
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600" />
            Create New Team
          </h1>
          <p className="text-secondary-600 mt-1">
            Build your dream team and collaborate on projects
          </p>
        </div>
      </div>

      {/* Verification Warning */}
      {!isVerified && (
        <div className="card bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">
                GEHU Email Verification Required
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                You must verify your GEHU email address before creating a team.
              </p>
              <button
                onClick={() => navigate('/profile')}
                className="mt-3 btn-primary"
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Code Warriors, Design Masters"
              className="input-field"
              disabled={!isVerified || loading}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-secondary-500">
              {formData.name.length}/50 characters
            </p>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Year <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="input-field"
              disabled={!isVerified || loading}
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </select>
            <p className="mt-1 text-xs text-secondary-500">
              Select the primary year for your team
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your team's goals, projects, and what you're looking for..."
              rows={4}
              className="input-field resize-none"
              disabled={!isVerified || loading}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-secondary-500">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Guidelines */}
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-secondary-900">
                <p className="font-medium mb-2">Team Guidelines:</p>
                <ul className="space-y-1 list-disc list-inside text-secondary-600">
                  <li>You can only lead one team at a time</li>
                  <li>Team name must be unique and appropriate</li>
                  <li>You'll be automatically added as the first member</li>
                  <li>You can add more members and post recruitments after creation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/teams')}
              className="flex-1 btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isVerified || loading || !formData.name.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Create Team
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
