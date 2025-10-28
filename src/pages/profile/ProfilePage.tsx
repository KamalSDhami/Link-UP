import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  Loader2,
  Camera,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// Helper function to convert name to title case
const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface UserProfile {
  id: string
  email: string
  name: string
  profile_picture_url: string | null
  section: string | null
  year: number | null
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
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

const SECTIONS = (() => {
  const sections = []
  for (let letter = 65; letter <= 90; letter++) { // A-Z
    for (let num = 1; num <= 2; num++) {
      sections.push(`${String.fromCharCode(letter)}${num}`)
    }
  }
  return sections
})()
const YEARS = [1, 2, 3, 4]
const VISIBILITY_OPTIONS = [
  { value: 'always', label: 'Always Visible', icon: Eye },
  { value: 'on_application', label: 'On Application', icon: FileText },
  { value: 'hidden', label: 'Hidden', icon: X },
]

const GENDER_OPTIONS: Array<{ value: UserProfile['gender']; label: string }> = [
  { value: null, label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<ProfileStats>({ teamCount: 0, applicationCount: 0 })
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [sendingVerification, setSendingVerification] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [editForm, setEditForm] = useState({
    name: '',
    section: '',
    year: 1,
    gender: null as UserProfile['gender'],
    skills: [] as string[],
    github_url: '',
    linkedin_url: '',
    social_visibility: 'on_application' as 'always' | 'on_application' | 'hidden',
  })

  const currentGenderLabel = profile
    ? GENDER_OPTIONS.find((option) => option.value === profile.gender)?.label ?? 'Prefer not to say'
    : 'Prefer not to say'

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadProfile()
    loadStats()
  }, [user, navigate])

  useEffect(() => {
    if (searchParams.get('verify') === '1') {
      setShowVerificationModal(true)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('verify')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const profileData = data as UserProfile
      const normalizedGender = (profileData.gender === 'prefer_not_to_say' ? null : profileData.gender) as UserProfile['gender']
      const sanitizedProfile: UserProfile = { ...profileData, gender: normalizedGender }

      setProfile(sanitizedProfile)
      setEditForm({
        name: sanitizedProfile.name || '',
        section: sanitizedProfile.section || '',
        year: sanitizedProfile.year || 1,
        gender: normalizedGender,
        skills: sanitizedProfile.skills || [],
        github_url: sanitizedProfile.github_url || '',
        linkedin_url: sanitizedProfile.linkedin_url || '',
        social_visibility: sanitizedProfile.social_visibility || 'on_application',
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

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!user || !file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      event.target.value = ''
      return
    }

    const sizeLimitMb = 2
    if (file.size > sizeLimitMb * 1024 * 1024) {
      toast.error(`Image must be smaller than ${sizeLimitMb}MB`)
      event.target.value = ''
      return
    }

    const extension = file.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/${Date.now()}.${extension}`

    setUploadingAvatar(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('profile-pictures').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      toast.success('Profile picture updated')
      await loadProfile()
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast.error(error.message || 'Failed to upload profile picture')
    } finally {
      event.target.value = ''
      setUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          profile_picture_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile picture removed')
      await loadProfile()
    } catch (error: any) {
      console.error('Error removing avatar:', error)
      toast.error(error.message || 'Failed to remove profile picture')
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmation('')
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (deletingAccount) return
    setShowDeleteModal(false)
    setDeleteConfirmation('')
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const confirmationMatches = deleteConfirmation.trim().toUpperCase() === 'DELETE'
    if (!confirmationMatches) {
      toast.error('Please type DELETE to confirm account removal')
      return
    }

    setDeletingAccount(true)
    try {
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error

      try {
        await signOut()
      } catch (signOutError) {
        console.warn('Sign out after account deletion failed:', signOutError)
      }
      toast.success('Account deleted successfully')
      navigate('/login', { replace: true })
    } catch (error: any) {
      console.error('Error deleting account:', error)
      toast.error(error.message || 'Failed to delete account')
    } finally {
      setDeletingAccount(false)
      setDeleteConfirmation('')
      setShowDeleteModal(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          name: editForm.name,
          section: editForm.section || null,
          year: editForm.year,
          gender: editForm.gender,
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
        gender: profile.gender ?? null,
        skills: profile.skills || [],
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        social_visibility: profile.social_visibility || 'on_application',
      })
    }
    setIsEditing(false)
  }

  const handleSendVerification = async () => {
    if (!verificationEmail.trim()) {
      toast.error('Please enter your GEHU email')
      return
    }

    if (!verificationEmail.endsWith('@gehu.ac.in')) {
      toast.error('Please enter a valid GEHU email address (@gehu.ac.in)')
      return
    }

    setSendingVerification(true)
    try {
      // Check if email is already used by another user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('gehu_email', verificationEmail)
        .neq('id', user!.id)
        .single()

      if (existingUser) {
        toast.error('This GEHU email is already verified by another user')
        setSendingVerification(false)
        return
      }

      // Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

      // Store OTP in database with 10-minute expiry
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 10)

      // First, delete ALL existing OTPs for this user to prevent conflicts
      // This is critical to avoid duplicate key violations
      console.log('🗑️ Deleting old OTPs for user:', user!.id)
      const { error: deleteError, count: deleteCount } = await supabase
        .from('verification_otps')
        .delete({ count: 'exact' })
        .eq('user_id', user!.id)

      if (deleteError) {
        console.error('❌ Failed to delete old OTPs:', deleteError)
        // Don't proceed if we can't delete old records
        throw new Error('Failed to clear old verification codes. Please try again.')
      }
      
      console.log(`✅ Deleted ${deleteCount || 0} old OTP(s)`)

      // Small delay to ensure delete completes in database
      await new Promise(resolve => setTimeout(resolve, 100))

      // Now insert new OTP
      console.log('📝 Inserting new OTP for email:', verificationEmail)
      const { error: otpError } = await supabase
        .from('verification_otps')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          user_id: user!.id,
          email: verificationEmail,
          otp: generatedOtp,
          expires_at: expiresAt.toISOString(),
          verified: false,
        })

      if (otpError) {
        console.error('❌ Failed to insert OTP:', otpError)
        throw otpError
      }
      
      console.log('✅ OTP inserted successfully')

      // In a real application, send email via email service (SendGrid, AWS SES, etc.)
      // For now, we'll show the OTP in console for testing
      console.log('🔐 Verification OTP:', generatedOtp)
      console.log('📧 Email:', verificationEmail)
      console.log('⏰ Expires at:', expiresAt.toLocaleString())

      toast.success(
        `Verification code sent to ${verificationEmail}!\n(Check console for testing)`,
        { duration: 5000 }
      )
      
      setOtpSent(true)

    } catch (error: any) {
      console.error('Error sending verification:', error)
      toast.error(error.message || 'Failed to send verification code')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setVerifyingOtp(true)
    try {
      // Check if OTP is valid and not expired
      const { data: otpData, error: otpError } = await supabase
        .from('verification_otps')
        .select('*')
        .eq('user_id', user!.id)
        .eq('email', verificationEmail)
        .eq('otp', otp)
        .eq('verified', false)
        .single()

      if (otpError || !otpData) {
        toast.error('Invalid or expired OTP. Please try again.')
        setVerifyingOtp(false)
        return
      }

      // Check if OTP has expired (with type assertion)
      const otpRecord = otpData as any
      if (new Date(otpRecord.expires_at) < new Date()) {
        toast.error('OTP has expired. Please request a new one.')
        setVerifyingOtp(false)
        return
      }

      // Mark OTP as verified
      await supabase
        .from('verification_otps')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({ verified: true })
        .eq('id', otpRecord.id)

      // Update user as verified
      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          gehu_verified: true,
          gehu_email: verificationEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id)

      if (updateError) throw updateError

      toast.success('🎉 GEHU email verified successfully!')
      
      // Reset modal state
      setShowVerificationModal(false)
      setVerificationEmail('')
      setOtp('')
      setOtpSent(false)
      
      // Reload profile to show verification badge
      loadProfile()

    } catch (error: any) {
      console.error('Error verifying OTP:', error)
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    setOtp('')
    setOtpSent(false)
    await handleSendVerification()
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-slate-900/70 text-white text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <span>{uploadingAvatar ? 'Uploading' : 'Change'}</span>
                </button>
              )}
            </div>

            {isEditing && profile.profile_picture_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="mt-2 text-xs font-medium text-white/90 hover:text-white underline-offset-2 hover:underline disabled:opacity-60"
                disabled={uploadingAvatar}
              >
                Remove photo
              </button>
            )}
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
                <h2 className="text-2xl font-bold">{toTitleCase(profile.name)}</h2>
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
                  <select
                    value={editForm.gender ?? ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        gender: (e.target.value || null) as UserProfile['gender'],
                      })
                    }
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-1 text-white text-sm"
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value ?? 'unspecified'} value={option.value ?? ''} className="text-slate-900">
                        {option.label}
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
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">{currentGenderLabel}</span>
                  </div>
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
              <button
                onClick={() => setShowVerificationModal(true)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="card border border-red-200 bg-red-50/60">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-900">Delete Account</h3>
            <p className="text-sm text-red-700">
              Permanently remove your account, teams, recruitments, and verification details. This action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={openDeleteModal}
            className="inline-flex items-center gap-2 rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-red-700">Confirm account deletion</h3>
                <p className="mt-2 text-sm text-slate-600">
                  This will permanently remove your profile, teams you own, applications, and verification state. Type <span className="font-semibold text-slate-900">DELETE</span> below to continue.
                </p>
              </div>
              <button
                onClick={closeDeleteModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close delete account dialog"
                disabled={deletingAccount}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="text-sm font-medium text-slate-700" htmlFor="delete-confirmation">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="input-field"
                placeholder="DELETE"
                disabled={deletingAccount}
              />
              <p className="text-xs text-slate-500">
                This action cannot be undone and you will need to re-verify if you sign up again.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeDeleteModal}
                className="btn-secondary"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={deletingAccount || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">
                {otpSent ? 'Enter Verification Code' : 'Verify GEHU Email'}
              </h3>
              <button
                onClick={() => {
                  setShowVerificationModal(false)
                  setOtpSent(false)
                  setOtp('')
                  setVerificationEmail('')
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!otpSent ? (
              // Step 1: Enter Email
              <>
                <div className="mb-6">
                  <p className="text-slate-600 text-sm mb-4">
                    Enter your GEHU institutional email address to receive a verification code.
                  </p>

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    GEHU Email Address
                  </label>
                  <input
                    type="email"
                    value={verificationEmail}
                    onChange={(e) => setVerificationEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sendingVerification && handleSendVerification()}
                    placeholder="your.name@gehu.ac.in"
                    className="input-field"
                    disabled={sendingVerification}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    A 6-digit verification code will be sent to this email
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVerificationModal(false)}
                    className="flex-1 btn-secondary"
                    disabled={sendingVerification}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendVerification}
                    className="flex-1 btn-primary"
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Code
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              // Step 2: Enter OTP
              <>
                <div className="mb-6">
                  <p className="text-slate-600 text-sm mb-4">
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-semibold text-slate-900">{verificationEmail}</span>
                  </p>

                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtp(value)
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && !verifyingOtp && handleVerifyOtp()}
                    placeholder="000000"
                    className="input-field text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                    disabled={verifyingOtp}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Code expires in 10 minutes
                  </p>

                  <button
                    onClick={handleResendOtp}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-3"
                    disabled={sendingVerification}
                  >
                    Didn't receive the code? Resend
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setOtpSent(false)
                      setOtp('')
                    }}
                    className="flex-1 btn-secondary"
                    disabled={verifyingOtp}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    className="flex-1 btn-primary"
                    disabled={verifyingOtp || otp.length !== 6}
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Verify Code
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> Only GEHU institutional email addresses (@gehu.ac.in) are accepted for verification.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

