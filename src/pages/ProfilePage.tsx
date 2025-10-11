import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  GraduationCap,
  Github,
  Linkedin,
  Edit2,
  Save,
  X,
  Shield,
  Users,
  FileText,
  Tag,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string
  email: string
  name: string
  profile_picture_url: string | null
  section: string | null
  year: number | null
  skills: string[]
  github_url: string | null
  linkedin_url: string | null
  social_visibility: 'always' | 'on_application' | 'hidden'
  gehu_verified: boolean
  gehu_email: string | null
  role: string
  created_at: string
}

interface ProfileStats {
  teamCount: number
  applicationCount: number
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F']
const YEARS = [1, 2, 3, 4]
const VISIBILITY_OPTIONS = [
  { value: 'always', label: 'Always Visible', icon: Eye },
  { value: 'on_application', label: 'On Application', icon: FileText },
  { value: 'hidden', label: 'Hidden', icon: X },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<ProfileStats>({ teamCount: 0, applicationCount: 0 })
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  
  const [editForm, setEditForm] = useState({
    name: '',
    section: '',
    year: 1,
    skills: [] as string[],
    github_url: '',
    linkedin_url: '',
    social_visibility: 'on_application' as 'always' | 'on_application' | 'hidden',
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadProfile()
    loadStats()
  }, [user, navigate])

  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setProfile(data)
      setEditForm({
        name: data.name || '',
        section: data.section || '',
        year: data.year || 1,
        skills: data.skills || [],
        github_url: data.github_url || '',
        linkedin_url: data.linkedin_url || '',
        social_visibility: data.social_visibility || 'on_application',
      })
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!user) return

    try {
      const { count: teamCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { count: applicationCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id)

      setStats({
        teamCount: teamCount || 0,
        applicationCount: applicationCount || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          section: editForm.section || null,
          year: editForm.year,
          skills: editForm.skills,
          github_url: editForm.github_url || null,
          linkedin_url: editForm.linkedin_url || null,
          social_visibility: editForm.social_visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile updated successfully!')
      setIsEditing(false)
      loadProfile()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const addSkill = () => {
    if (skillInput.trim() && !editForm.skills.includes(skillInput.trim())) {
      setEditForm({
        ...editForm,
        skills: [...editForm.skills, skillInput.trim()],
      })
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setEditForm({
      ...editForm,
      skills: editForm.skills.filter((s) => s !== skill),
    })
  }

  const handleCancel = () => {
    if (profile) {
      setEditForm({
        name: profile.name || '',
        section: profile.section || '',
        year: profile.year || 1,
        skills: profile.skills || [],
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        social_visibility: profile.social_visibility || 'on_application',
      })
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Profile not found</h2>
          <p className="text-slate-600">Unable to load your profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-600 mt-1">Manage your profile information</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="btn-secondary"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Profile Header Card */}
      <div className="card bg-gradient-to-r from-primary-600 to-accent-600 text-white">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30">
              {profile.profile_picture_url ? (
                <img
                  src={profile.profile_picture_url}
                  alt={profile.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-2xl font-bold bg-white/20 border-2 border-white/30 rounded-lg px-3 py-1 text-white placeholder-white/60"
                  placeholder="Your Name"
                />
              ) : (
                <h2 className="text-2xl font-bold">{profile.name}</h2>
              )}
              {profile.gehu_verified && (
                <div className="flex items-center gap-1 px-3 py-1 bg-green-500/30 rounded-full border border-green-400/50">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">GEHU Verified</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-primary-100 mb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{profile.email}</span>
              </div>
              {profile.gehu_verified && profile.gehu_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{profile.gehu_email}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {isEditing ? (
                <>
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-1 text-white text-sm"
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year} className="text-slate-900">
                        Year {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-1 text-white text-sm"
                  >
                    <option value="" className="text-slate-900">Select Section</option>
                    {SECTIONS.map((section) => (
                      <option key={section} value={section} className="text-slate-900">
                        Section {section}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  {profile.year && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg">
                      <GraduationCap className="w-4 h-4" />
                      <span className="text-sm font-medium">Year {profile.year}</span>
                    </div>
                  )}
                  {profile.section && (
                    <div className="px-3 py-1 bg-white/20 rounded-lg">
                      <span className="text-sm font-medium">Section {profile.section}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.teamCount}</p>
              <p className="text-sm text-slate-600">Teams Joined</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.applicationCount}</p>
              <p className="text-sm text-slate-600">Applications</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {isEditing ? editForm.skills.length : profile.skills.length}
              </p>
              <p className="text-sm text-slate-600">Skills</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-slate-900">Skills & Technologies</h3>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill (e.g., React, Python, UI/UX)"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={addSkill}
                className="btn-primary"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {editForm.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill)}
                    className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : profile.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No skills added yet</p>
        )}
      </div>

      {/* Social Links Section */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Github className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-slate-900">Social Links</h3>
        </div>

        <div className="space-y-4">
          {/* GitHub */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Github className="inline w-4 h-4 mr-1" />
              GitHub Profile
            </label>
            {isEditing ? (
              <input
                type="url"
                value={editForm.github_url}
                onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                placeholder="https://github.com/yourusername"
                className="input-field"
              />
            ) : profile.github_url ? (
              <a
                href={profile.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 hover:underline"
              >
                {profile.github_url}
              </a>
            ) : (
              <p className="text-slate-500 text-sm">Not added</p>
            )}
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Linkedin className="inline w-4 h-4 mr-1" />
              LinkedIn Profile
            </label>
            {isEditing ? (
              <input
                type="url"
                value={editForm.linkedin_url}
                onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/yourusername"
                className="input-field"
              />
            ) : profile.linkedin_url ? (
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 hover:underline"
              >
                {profile.linkedin_url}
              </a>
            ) : (
              <p className="text-slate-500 text-sm">Not added</p>
            )}
          </div>

          {/* Visibility Settings */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Social Links Visibility
            </label>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        editForm.social_visibility === option.value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={editForm.social_visibility === option.value}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            social_visibility: e.target.value as 'always' | 'on_application' | 'hidden',
                          })
                        }
                        className="sr-only"
                      />
                      <Icon className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-medium text-slate-900">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg w-fit">
                {VISIBILITY_OPTIONS.find((opt) => opt.value === profile.social_visibility)?.label ||
                  'On Application'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GEHU Verification Section */}
      {!profile.gehu_verified && (
        <div className="card bg-amber-50 border-2 border-amber-200">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">GEHU Verification Pending</h3>
              <p className="text-amber-700 text-sm mb-3">
                Verify your GEHU email to unlock team creation and additional features
              </p>
              <button className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm">
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

