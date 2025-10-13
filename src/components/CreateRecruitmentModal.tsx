import { useState } from 'react'
import { X, Briefcase, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface CreateRecruitmentModalProps {
  teamId: string
  onClose: () => void
  onSuccess: () => void
}

const COMMON_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Java', 'C++',
  'UI/UX Design', 'Figma', 'Photoshop', 'Video Editing',
  'Content Writing', 'Marketing', 'Project Management',
  'Data Analysis', 'Machine Learning', 'DevOps'
]

export default function CreateRecruitmentModal({
  teamId,
  onClose,
  onSuccess,
}: CreateRecruitmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    required_skills: [] as string[],
    positions_available: 1,
  })
  const [customSkill, setCustomSkill] = useState('')

  const handleAddSkill = (skill: string) => {
    if (!formData.required_skills.includes(skill)) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, skill],
      })
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter((s) => s !== skill),
    })
  }

  const handleAddCustomSkill = () => {
    const skill = customSkill.trim()
    if (skill && !formData.required_skills.includes(skill)) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, skill],
      })
      setCustomSkill('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }

    if (formData.positions_available < 1) {
      toast.error('At least 1 position must be available')
      return
    }

    setLoading(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('recruitment_posts')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          team_id: teamId,
          posted_by: user.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          required_skills: formData.required_skills,
          positions_available: formData.positions_available,
          status: 'open',
        })

      if (error) throw error

      toast.success('🎉 Recruitment post created successfully!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating recruitment:', error)
      toast.error(error.message || 'Failed to create recruitment post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Recruitment Post
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Position Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Frontend Developer, UI Designer, Content Writer"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              disabled={loading}
              maxLength={100}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formData.title.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              disabled={loading}
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Required Skills */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Required Skills
            </label>
            
            {/* Selected Skills */}
            {formData.required_skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium flex items-center gap-2"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="hover:text-indigo-900 dark:hover:text-indigo-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Skill Suggestions */}
            <div className="mb-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                Quick add:
              </p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SKILLS.filter(
                  (skill) => !formData.required_skills.includes(skill)
                ).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleAddSkill(skill)}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Skill Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomSkill()
                  }
                }}
                placeholder="Add custom skill..."
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleAddCustomSkill}
                disabled={!customSkill.trim() || loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Positions Available */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Positions Available <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.positions_available}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  positions_available: parseInt(e.target.value) || 1,
                })
              }
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              How many people are you looking to recruit?
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim() || !formData.description.trim()}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  Create Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
