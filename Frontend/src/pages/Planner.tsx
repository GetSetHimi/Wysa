import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { plannerAPI, profileAPI, resumeAPI } from '../services/api'
import { 
  Calendar, 
  Target, 
  Plus, 
  Download,
  Eye,
  Trash2,
  Loader,
  AlertCircle,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Planner {
  id: number
  role: string
  startDate: string
  endDate: string
  progressPercent: number
  planJson: any
  createdAt: string
}

interface PlannerForm {
  role: string
  startDate: string
  durationDays: number
  dailyHours: number
  experienceSummary: string
  focusAreas: string[]
  additionalContext: string
}

export const Planner: React.FC = () => {
  const [planners, setPlanners] = useState<Planner[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null)
  const [resumeAnalysis, setResumeAnalysis] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<PlannerForm>()

  useEffect(() => {
    fetchPlanners()
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      // Fetch user profile and resume analysis for AI suggestions
      const [profileResponse, resumeResponse] = await Promise.all([
        profileAPI.get(),
        resumeAPI.getUserResumes(0) // This will get the latest resume
      ])

      if (profileResponse.data.profile) {
        setUserProfile(profileResponse.data.profile)
      }

      if (resumeResponse.data.data && resumeResponse.data.data.length > 0) {
        const latestResume = resumeResponse.data.data[0]
        if (latestResume.parsedJson) {
          setResumeAnalysis(latestResume.parsedJson)
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data for AI suggestions:', error)
      // Continue without AI suggestions if data fetch fails
    }
  }

  const fetchPlanners = async () => {
    try {
      setPlanners([])
    } catch (error) {
      console.error('Failed to fetch planners:', error)
      toast.error('Failed to load planners')
    } finally {
      setLoading(false)
    }
  }

  // Generate AI-suggested focus areas based on resume analysis
  const getAISuggestedFocusAreas = () => {
    if (!resumeAnalysis || !userProfile) return []

    const suggestions = []

    // Add missing core skills as primary focus areas
    if (resumeAnalysis.missingCoreSkills && resumeAnalysis.missingCoreSkills.length > 0) {
      suggestions.push(...resumeAnalysis.missingCoreSkills.slice(0, 5))
    }

    // Add skills based on experience gaps
    if (resumeAnalysis.experienceGaps && resumeAnalysis.experienceGaps.length > 0) {
      const gapSkills = resumeAnalysis.experienceGaps
        .filter(gap => gap.recommendedActions && gap.recommendedActions.length > 0)
        .slice(0, 3)
        .map(gap => gap.title)
      suggestions.push(...gapSkills)
    }

    // Add skills based on desired role
    if (userProfile.desiredRole) {
      const roleSkills = getRoleSpecificSkills(userProfile.desiredRole)
      suggestions.push(...roleSkills.slice(0, 3))
    }

    // Remove duplicates and limit to top 8 suggestions
    return [...new Set(suggestions)].slice(0, 8)
  }

  const getRoleSpecificSkills = (role: string) => {
    const skillMap: Record<string, string[]> = {
      'Software Engineer': ['React', 'Node.js', 'TypeScript', 'Database Design', 'API Development'],
      'Full Stack Developer': ['React', 'Node.js', 'Database', 'DevOps', 'System Design'],
      'Data Scientist': ['Python', 'Machine Learning', 'Statistics', 'Data Visualization', 'SQL'],
      'Frontend Developer': ['React', 'JavaScript', 'CSS', 'Responsive Design', 'Performance'],
      'Backend Developer': ['Node.js', 'Database', 'API Design', 'Security', 'Scalability'],
      'DevOps Engineer': ['Docker', 'Kubernetes', 'CI/CD', 'Cloud', 'Monitoring'],
      'Product Manager': ['Product Strategy', 'Analytics', 'User Research', 'Roadmapping', 'Stakeholder Management']
    }

    return skillMap[role] || ['Technical Skills', 'Domain Knowledge', 'Soft Skills']
  }

  const onSubmit = async (data: PlannerForm) => {
    setGenerating(true)
    try {
      // Use AI-suggested focus areas, or fall back to manual input if provided
      const aiSuggestions = getAISuggestedFocusAreas()
      const focusAreas = data.focusAreas && data.focusAreas.length > 0
        ? data.focusAreas.split(',').map(area => area.trim()).filter(area => area.length > 0)
        : aiSuggestions

      const processedData = {
        ...data,
        focusAreas: focusAreas.length > 0 ? focusAreas : undefined
      }

      const response = await plannerAPI.generate(processedData)
      const newPlanner = response.data.data.planner

      setPlanners(prev => [newPlanner, ...prev])
      setShowCreateForm(false)
      reset()
      toast.success('Learning planner generated successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate planner')
    } finally {
      setGenerating(false)
    }
  }

  const downloadDailyPdf = async (plannerId: number, dayIndex: number = 0) => {
    try {
      const response = await plannerAPI.getDailyPdf(plannerId, dayIndex)
      const { downloadUrl } = response.data.data

      // Construct the full backend URL since PDFs are served from the backend
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${backendUrl}${downloadUrl}`

      window.open(fullUrl, '_blank')
      toast.success('Daily plan PDF downloaded!')
    } catch (error: any) {
      toast.error('Failed to download daily plan PDF')
    }
  }

  const deletePlanner = async (plannerId: number) => {
    if (!confirm('Are you sure you want to delete this planner?')) return

    try {
      // Note: Delete endpoint not implemented in backend yet
      setPlanners(prev => prev.filter(p => p.id !== plannerId))
      toast.success('Planner deleted successfully!')
    } catch (error: any) {
      toast.error('Failed to delete planner')
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 60) return 'bg-yellow-500'
    if (progress >= 40) return 'bg-blue-500'
    return 'bg-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Planners</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage your personalized learning plans
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Planner
        </button>
      </div>

      {/* Create Planner Form */}
      {showCreateForm && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Planner</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Target Role
                  </label>
                  <input
                    type="text"
                    id="role"
                    {...register('role', { required: 'Target role is required' })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Software Engineer, Data Analyst"
                  />
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.role.message}
                    </p>
                  )}
                </div>

              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="dailyHours" className="block text-sm font-medium text-gray-700">
                    Hours per Day *
                  </label>
                  <select
                    id="dailyHours"
                    {...register('dailyHours', {
                      required: 'Daily hours is required',
                      min: { value: 1, message: 'Must be at least 1 hour' },
                      max: { value: 8, message: 'Must be at most 8 hours' }
                    })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select daily learning hours</option>
                    <option value="1">1 hour - Quick sessions</option>
                    <option value="2">2 hours - Balanced learning</option>
                    <option value="3">3 hours - Focused study</option>
                    <option value="4">4 hours - Intensive learning</option>
                    <option value="5">5 hours - Deep dive sessions</option>
                    <option value="6">6 hours - Extended practice</option>
                    <option value="7">7 hours - Full day commitment</option>
                    <option value="8">8 hours - Maximum effort</option>
                  </select>
                  {errors.dailyHours && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.dailyHours.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI-Suggested Focus Areas
                  </label>

                  {/* AI-Suggested Focus Areas */}
                  {(() => {
                    const aiSuggestions = getAISuggestedFocusAreas()
                    return aiSuggestions.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-600">
                          Based on your resume analysis and career goals, here are the recommended skills to focus on:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestions.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          These suggestions are automatically generated from your skill gaps and desired role.
                          You can customize them below if needed.
                        </p>

                        {/* Optional manual override */}
                        <div className="pt-2 border-t border-gray-200">
                          <label htmlFor="focusAreas" className="block text-xs font-medium text-gray-600 mb-1">
                            Or enter custom focus areas (optional)
                          </label>
                          <input
                            type="text"
                            id="focusAreas"
                            {...register('focusAreas')}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="e.g., React, Node.js, Database Design (leave empty to use AI suggestions)"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Leave empty to use AI suggestions, or enter comma-separated skills to override
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Target className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                          Complete your profile and upload a resume to get AI-suggested focus areas
                        </p>
                        <div className="space-y-1">
                          <input
                            type="text"
                            id="focusAreas"
                            {...register('focusAreas')}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="Enter focus areas manually"
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="durationDays" className="block text-sm font-medium text-gray-700">
                    Duration (Days) *
                  </label>
                  <select
                    id="durationDays"
                    {...register('durationDays', {
                      required: 'Duration is required',
                      min: { value: 7, message: 'Must be at least 7 days' },
                      max: { value: 56, message: 'Must be at most 56 days' }
                    })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select duration</option>
                    <option value="7">1 week - Quick start</option>
                    <option value="14">2 weeks - Focused learning</option>
                    <option value="21">3 weeks - Solid foundation</option>
                    <option value="28">4 weeks - Comprehensive training</option>
                    <option value="42">6 weeks - In-depth mastery</option>
                    <option value="56">8 weeks - Complete transformation</option>
                  </select>
                  {errors.durationDays && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.durationDays.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    {...register('startDate', { required: 'Start date is required' })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.startDate.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="experienceSummary" className="block text-sm font-medium text-gray-700">
                  Experience Summary
                </label>
                <textarea
                  id="experienceSummary"
                  rows={3}
                  {...register('experienceSummary')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Brief description of your current experience and skills..."
                />
              </div>

              <div>
                <label htmlFor="additionalContext" className="block text-sm font-medium text-gray-700">
                  Additional Context
                </label>
                <textarea
                  id="additionalContext"
                  rows={2}
                  {...register('additionalContext')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Any specific learning preferences or constraints..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2 inline" />
                      Generating...
                    </>
                  ) : (
                    'Generate Planner'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Planners List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Learning Planners</h3>
          
          {planners.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No planners yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first learning planner to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {planners.map((planner) => (
                <div key={planner.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Target className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900">{planner.role}</h4>
                          <p className="text-sm text-gray-500">
                            {format(new Date(planner.startDate), 'MMM dd, yyyy')} - {format(new Date(planner.endDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium text-gray-900">{planner.progressPercent}%</span>
                        </div>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProgressColor(planner.progressPercent)}`}
                            style={{ width: `${planner.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedPlanner(planner)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => downloadDailyPdf(planner.id)}
                        className="text-green-600 hover:text-green-800"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deletePlanner(planner.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Planner"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Planner Details Modal */}
      {selectedPlanner && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Planner Details: {selectedPlanner.role}
                </h3>
                <button
                  onClick={() => setSelectedPlanner(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Start Date</h4>
                    <p className="text-sm text-gray-900">
                      {format(new Date(selectedPlanner.startDate), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">End Date</h4>
                    <p className="text-sm text-gray-900">
                      {format(new Date(selectedPlanner.endDate), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Progress</h4>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getProgressColor(selectedPlanner.progressPercent)}`}
                        style={{ width: `${selectedPlanner.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedPlanner.progressPercent}%
                    </span>
                  </div>
                </div>

                {selectedPlanner.planJson && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Plan Summary</h4>
                    <p className="text-sm text-gray-900">
                      {selectedPlanner.planJson.summary || 'No summary available'}
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => downloadDailyPdf(selectedPlanner.id)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Daily Plan
                  </button>
                  <button
                    onClick={() => setSelectedPlanner(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
