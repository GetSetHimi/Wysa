import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { resourceAPI, profileAPI } from '../services/api'
import { 
  BookOpen, 
  Play, 
  FileText, 
  Download, 
  Loader, 
  CheckCircle, 
  Clock,
  Tag,
  ExternalLink,
  Brain,
  Target
} from 'lucide-react'
import toast from 'react-hot-toast'

interface GeneratedResource {
  title: string
  type: 'video' | 'article' | 'mixed'
  description: string
  duration: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  url: string
  tags: string[]
}

interface SkillGapAnalysis {
  missingSkills: string[]
  experienceGaps: Array<{
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }>
  recommendedLearningPaths: string[]
}

interface ResourceGenerationData {
  resources: GeneratedResource[]
  skillGapAnalysis: SkillGapAnalysis
  pdfPath: string
  downloadUrl: string
}

interface SavedResource {
  id: number
  title: string
  description: string
  resourceType: 'video' | 'article' | 'course' | 'book' | 'tool' | 'other'
  url?: string
  content?: string
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  completed: boolean
  completedAt?: Date
  rating?: number
  notes?: string
  source: 'ai_generated' | 'user_added' | 'recommended'
  metadata?: any
  createdAt: Date
  updatedAt: Date
}

export const Resources: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [resourceData, setResourceData] = useState<ResourceGenerationData | null>(null)
  const [savedResources, setSavedResources] = useState<SavedResource[]>([])
  const [generationForm, setGenerationForm] = useState({
    role: '',
    weeklyHours: '',
    experienceSummary: '',
    additionalContext: '',
    preferredFormat: 'mixed' as 'video' | 'article' | 'mixed',
    learningType: 'balanced' as 'project_based' | 'theory_focused' | 'balanced'
  })

  useEffect(() => {
    fetchUserProfile()
    fetchSavedResources()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await profileAPI.get()
      if (response.data.profile) {
        const profile = response.data.profile
        setGenerationForm(prev => ({
          ...prev,
          role: profile.desiredRole || '',
          weeklyHours: profile.weeklyHours?.toString() || '',
          preferredFormat: profile.preferences?.format || 'mixed',
          learningType: profile.preferences?.learningType || 'balanced'
        }))
      }
    } catch (error) {
      console.log('No profile found')
    }
  }

  const fetchSavedResources = async () => {
    try {
      if (user?.id) {
        const response = await resourceAPI.getUserResources(user.id)
        if (response.data.data) {
          setSavedResources(response.data.data)
          // If we have saved resources, show them instead of the generation form
          if (response.data.data.length > 0) {
            setGenerated(true)
          }
        }
      }
    } catch (error) {
      console.log('No saved resources found')
    }
  }

  const handleGenerateResources = async () => {
    if (!generationForm.role || !generationForm.weeklyHours) {
      toast.error('Please fill in the required fields')
      return
    }

    setLoading(true)
    try {
      const response = await resourceAPI.generate({
        role: generationForm.role,
        weeklyHours: Number(generationForm.weeklyHours),
        experienceSummary: generationForm.experienceSummary,
        additionalContext: generationForm.additionalContext,
        preferredFormat: generationForm.preferredFormat,
        learningType: generationForm.learningType
      })

      setResourceData(response.data.data)
      setGenerated(true)
      // Also fetch the saved resources to show them
      await fetchSavedResources()
      toast.success('Personalized resources generated successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate resources')
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100'
      case 'intermediate': return 'text-yellow-600 bg-yellow-100'
      case 'advanced': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return Play
      case 'article': return FileText
      case 'mixed': return BookOpen
      default: return BookOpen
    }
  }

  const getSavedResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return Play
      case 'article': return FileText
      case 'course': return BookOpen
      case 'book': return BookOpen
      case 'tool': return Target
      default: return BookOpen
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Show saved resources if they exist
  if (generated && savedResources.length > 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Learning Resources</h1>
            <p className="mt-1 text-sm text-gray-500">
              {savedResources.length} saved resources
            </p>
          </div>
          <button
            onClick={() => {
              setGenerated(false)
              setResourceData(null)
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Brain className="h-4 w-4 mr-2" />
            Generate New Resources
          </button>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedResources.map((resource) => {
            const ResourceIcon = getSavedResourceIcon(resource.resourceType)
            return (
              <div key={resource.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-2 rounded-md bg-blue-100">
                      <ResourceIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">{resource.title}</h3>
                      <p className="text-sm text-gray-500 capitalize">{resource.resourceType}</p>
                    </div>
                  </div>
                  {resource.completed && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-4">{resource.description}</p>

                <div className="flex items-center justify-between mb-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                    {resource.difficulty}
                  </span>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    {resource.estimatedHours}h
                  </div>
                </div>

                {resource.tags && resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {resource.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                    {resource.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{resource.tags.length - 3} more</span>
                    )}
                  </div>
                )}

                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Resource
                  </a>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Added {formatDate(resource.createdAt.toString())}</span>
                    <span className="capitalize">{resource.source.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (generated && resourceData) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Personalized Learning Resources</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-generated resources based on your skill gaps and preferences
          </p>
        </div>

        {/* Download PDF Button */}
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Download className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Complete Resource Guide</h3>
                <p className="text-sm text-gray-500">Download your personalized learning plan as a PDF</p>
              </div>
            </div>
            <a
              href={resourceData.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </a>
          </div>
        </div>

        {/* Skill Gap Analysis */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Skill Gap Analysis</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Missing Skills */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Missing Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {resourceData.skillGapAnalysis.missingSkills.map((skill, index) => (
                    <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience Gaps */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Experience Gaps</h4>
                <div className="space-y-2">
                  {resourceData.skillGapAnalysis.experienceGaps.map((gap, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-medium text-gray-900">{gap.title}</h5>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(gap.priority)}`}>
                          {gap.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{gap.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Resources */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recommended Learning Resources</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {resourceData.resources.map((resource, index) => {
                const ResourceIcon = getResourceIcon(resource.type)
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="p-2 rounded-md bg-blue-100">
                            <ResourceIcon className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-medium text-gray-900">{resource.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                          
                          <div className="flex items-center space-x-4 mt-3">
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="h-4 w-4 mr-1" />
                              {resource.duration}
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                              {resource.difficulty}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {resource.type}
                            </span>
                          </div>

                          {resource.tags.length > 0 && (
                            <div className="flex items-center space-x-2 mt-2">
                              <Tag className="h-4 w-4 text-gray-400" />
                              <div className="flex flex-wrap gap-1">
                                {resource.tags.map((tag, tagIndex) => (
                                  <span key={tagIndex} className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 ml-4">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate Learning Resources</h1>
        <p className="mt-1 text-sm text-gray-500">
          Get personalized learning resources based on your skill gaps and preferences
        </p>
      </div>

      {/* Generation Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Generation Settings</h3>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Desired Role *
                </label>
                <input
                  type="text"
                  value={generationForm.role}
                  onChange={(e) => setGenerationForm(prev => ({ ...prev, role: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., Software Engineer, Data Analyst"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Weekly Learning Hours *
                </label>
                <input
                  type="number"
                  value={generationForm.weeklyHours}
                  onChange={(e) => setGenerationForm(prev => ({ ...prev, weeklyHours: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="10"
                  min="1"
                  max="40"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Experience Summary
              </label>
              <textarea
                value={generationForm.experienceSummary}
                onChange={(e) => setGenerationForm(prev => ({ ...prev, experienceSummary: e.target.value }))}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Brief description of your current experience and skills..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Additional Context
              </label>
              <textarea
                value={generationForm.additionalContext}
                onChange={(e) => setGenerationForm(prev => ({ ...prev, additionalContext: e.target.value }))}
                rows={2}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Any specific learning preferences or constraints..."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Preferred Format
                </label>
                <select
                  value={generationForm.preferredFormat}
                  onChange={(e) => setGenerationForm(prev => ({ ...prev, preferredFormat: e.target.value as 'video' | 'article' | 'mixed' }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="video">Video</option>
                  <option value="article">Article</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Learning Type
                </label>
                <select
                  value={generationForm.learningType}
                  onChange={(e) => setGenerationForm(prev => ({ ...prev, learningType: e.target.value as 'project_based' | 'theory_focused' | 'balanced' }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="project_based">Project-based</option>
                  <option value="theory_focused">Theory-focused</option>
                  <option value="balanced">Balanced</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerateResources}
                disabled={loading || !generationForm.role || !generationForm.weeklyHours}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin mr-2" />
                    Generating Resources...
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5 mr-2" />
                    Generate Resources
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}