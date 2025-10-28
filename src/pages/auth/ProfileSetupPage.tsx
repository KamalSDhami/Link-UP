import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Tag, Github, Linkedin, Eye, Loader2, CheckCircle2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { TableUpdate, TableRow } from '@/types/database'

type UserUpdate = TableUpdate<'users'>
type SocialVisibility = TableRow<'users'>['social_visibility']

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
const VISIBILITY_OPTIONS: Array<{ value: SocialVisibility; label: string; description: string }> = [
  { value: 'always', label: 'Always Visible', description: 'Everyone can see your links' },
  { value: 'on_application', label: 'On Application', description: 'Visible when you apply to teams' },
  { value: 'hidden', label: 'Hidden', description: 'Never show your links' },
]

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [formData, setFormData] = useState({
    section: '',
    year: 1,
    skills: [] as string[],
    github_url: '',
    linkedin_url: '',
    social_visibility: 'on_application' as SocialVisibility,
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      })
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.section) {
      toast.error('Please select your section')
      return
    }

    if (formData.skills.length === 0) {
      toast.error('Please add at least one skill')
      return
    }

    setLoading(true)

    try {
      if (!user?.id) {
        throw new Error('User not found')
      }

      const updateData: UserUpdate = {
        section: formData.section,
        year: formData.year,
        skills: formData.skills,
        github_url: formData.github_url || null,
        linkedin_url: formData.linkedin_url || null,
        social_visibility: formData.social_visibility,
      }

      const { error } = await supabase
        .from('users')
        .update(updateData as never)
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile setup complete! Welcome to Linkup 🎉')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Profile setup error:', error)
      toast.error(error.message || 'Failed to setup profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-accent-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold text-slate-900 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-slate-600">
            Tell us about yourself to start finding teammates
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 space-x-2">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="ml-2 text-sm font-medium text-slate-700">Account</span>
          </div>
          <div className="w-12 h-0.5 bg-primary-300" />
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <span className="ml-2 text-sm font-medium text-primary-600">Profile</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 font-bold text-sm">3</span>
            </div>
            <span className="ml-2 text-sm font-medium text-slate-400">Dashboard</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="card animate-scale-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Year and Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <GraduationCap className="inline w-4 h-4 mr-1" />
                  Current Year
                </label>
                <select
                  required
                  className="input-field"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Section
                </label>
                <select
                  required
                  className="input-field"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                >
                  <option value="">Select Section</option>
                  {SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Tag className="inline w-4 h-4 mr-1" />
                Skills & Technologies
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="e.g., React, Python, UI/UX"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="btn-primary px-6"
                >
                  Add
                </button>
              </div>

              {/* Skills Tags */}
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="hover:text-primary-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Add at least one skill. Press Enter or click Add.
              </p>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Linkedin className="w-5 h-5" />
                Social Links (Optional)
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Github className="inline w-4 h-4 mr-1" />
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://github.com/yourusername"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Linkedin className="inline w-4 h-4 mr-1" />
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://linkedin.com/in/yourusername"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                />
              </div>
            </div>

            {/* Social Visibility */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                <Eye className="inline w-4 h-4 mr-1" />
                Social Links Visibility
              </label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.social_visibility === option.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={formData.social_visibility === option.value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_visibility: e.target.value as SocialVisibility,
                        })
                      }
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-slate-900">{option.label}</div>
                      <div className="text-sm text-slate-600">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg py-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Setting up your profile...
                </>
              ) : (
                <>
                  Complete Setup
                  <CheckCircle2 className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6 text-sm text-slate-600">
          <p>
            You can update your profile anytime from the settings page
          </p>
        </div>
      </div>
    </div>
  )
}

