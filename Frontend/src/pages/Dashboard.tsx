import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { notificationAPI, profileAPI, resumeAPI } from '../services/api'
import {
  Calendar,
  FileText,
  Mic,
  TrendingUp,
  Target,
  BookOpen,
  CheckCircle,
  User,
  Upload,
  Star,
  Brain,
  Plus,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'


interface UserProfile {
  id: number
  userId: number
  desiredRole: string
  weeklyHours: number
  timezone: string
  preferences: any
}

interface ResumeAnalysis {
  id: number
  originalFileName: string
  parsedJson?: {
    scores: {
      atsScore: number
      overallFitScore: number
      experienceAlignmentScore: number
      keywordOptimizationScore: number
      formatScore: number
      sectionCompletenessScore: number
    }
    summary: string
    missingCoreSkills: string[]
    experienceGaps: Array<{
      title: string
      description: string
      urgency: 'high' | 'medium' | 'low'
    }>
    atsOptimizationTips: string[]
    additionalNotes?: string
  }
  createdAt: string
}

type OnboardingStep = 'profile' | 'resume' | 'planner' | 'complete'

export const Dashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('profile')
  const [showLearningPlanForm] = useState(false)
  const [todayTasks, setTodayTasks] = useState<Array<{
    title: string
    description?: string | null
    durationMins?: number | null
    resourceLinks?: string[] | null
    status?: string
  }>>([])

  const checkUserSetup = useCallback(async () => {
    try {
      // Check if user is authenticated first
      if (!user) {
        setOnboardingStep('profile')
        setLoading(false)
        return
      }

      // Check if user has a profile
      const profileResponse = await profileAPI.get()
      if (profileResponse.data.profile) {
        setUserProfile(profileResponse.data.profile)

        // Check for resume analysis
        try {
          const resumeResponse = await resumeAPI.getUserResumes(profileResponse.data.profile.userId)
          console.log('Resume response:', resumeResponse.data)
          if (resumeResponse.data.data && resumeResponse.data.data.length > 0) {
            const latestResume = resumeResponse.data.data[0]
            console.log('Latest resume:', latestResume)
            console.log('Resume parsedJson:', latestResume.parsedJson)
            console.log('Resume parsedJson type:', typeof latestResume.parsedJson)
            console.log('Resume parsedJson null check:', latestResume.parsedJson === null)
            console.log('Resume parsedJson undefined check:', latestResume.parsedJson === undefined)
            
            if (latestResume.parsedJson && latestResume.parsedJson !== null && latestResume.parsedJson !== undefined) {
              console.log('Resume analysis found:', latestResume.parsedJson)
              setResumeAnalysis(latestResume)
            } else {
              console.log('No parsedJson in resume - resume needs to be analyzed')
              setResumeAnalysis(null)
            }
          } else {
            console.log('No resumes found for user')
            setResumeAnalysis(null)
          }
        } catch (resumeError) {
          console.error('Error fetching resume analysis:', resumeError)
          setResumeAnalysis(null)
        }

        // Check if user has any planners (onboarding is complete if they have planners)
        try {
          const { plannerAPI } = await import('../services/api')
          const plannersResponse = await plannerAPI.getUserPlanners(userProfile?.userId || 0)

          if (plannersResponse.data.data && plannersResponse.data.data.length > 0) {
            // User has planners - onboarding is complete!
            setOnboardingStep('complete')
          } else {
            // User has no planners - need to create one
            setOnboardingStep('planner')
          }
        } catch (plannerError) {
          console.error('Error checking user planners:', plannerError)
          setOnboardingStep('planner')
        }
      } else {
        setOnboardingStep('profile')
      }
    } catch (error: any) {
      console.error('Failed to check user setup:', error)
      // If it's an authentication error (401), user needs to login
      if (error.status === 401) {
        setOnboardingStep('profile')
      } else {
        setOnboardingStep('profile')
      }
    } finally {
      setLoading(false)
    }
  }, [user, userProfile?.userId])

  const fetchToday = useCallback(async () => {
    try {
      const response = await notificationAPI.getToday()
      const data = response.data?.data
      if (data && Array.isArray(data.tasks)) {
        setTodayTasks(data.tasks)
      } else {
        setTodayTasks([])
      }
    } catch (e) {
      setTodayTasks([])
    }
  }, [])

  const refreshData = useCallback(async () => {
    setLoading(true)
    await checkUserSetup()
    await fetchToday()
  }, [checkUserSetup, fetchToday])

  useEffect(() => {
    // Wait for authentication to complete before checking user setup
    if (!authLoading) {
      checkUserSetup()
      fetchToday()
    }
  }, [authLoading, checkUserSetup, fetchToday])

  // Refresh data when component mounts (e.g., navigating to dashboard)
  useEffect(() => {
    if (user && !authLoading) {
      console.log('Dashboard mounted, refreshing data...')
      refreshData()
    }
  }, [user, authLoading, refreshData])

  // Check for resume upload completion and refresh data
  useEffect(() => {
    const checkForResumeUpload = () => {
      const resumeUploaded = localStorage.getItem('resumeUploaded')
      if (resumeUploaded === 'true') {
        console.log('Resume upload detected, refreshing dashboard...')
        localStorage.removeItem('resumeUploaded') // Clear the flag
        refreshData()
      }
    }

    // Check immediately
    checkForResumeUpload()

    // Check periodically (every 2 seconds) when on dashboard
    const interval = setInterval(checkForResumeUpload, 2000)

    return () => clearInterval(interval)
  }, [refreshData])

  // Refresh data when user changes (e.g., after login)
  useEffect(() => {
    if (user && !authLoading) {
      checkUserSetup()
      fetchToday()
    }
  }, [user, authLoading, checkUserSetup, fetchToday])

  // Auto-refresh dashboard when window gains focus (e.g., returning from resume upload)
  useEffect(() => {
    const handleFocus = () => {
      if (user && !authLoading) {
        console.log('Window focused, refreshing dashboard data...')
        refreshData()
      }
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && user && !authLoading) {
        console.log('Page visible, refreshing dashboard data...')
        refreshData()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, authLoading, refreshData])

  const [learningPlanForm, setLearningPlanForm] = useState({
    role: '',
    weeklyHours: '',
    dailyHours: '',
    experienceSummary: '',
    additionalContext: ''
  })

  // AI-suggested focus areas functions (same as in Planner)
  const getAISuggestedFocusAreas = () => {
    if (!resumeAnalysis || !userProfile || !resumeAnalysis.parsedJson) return []

    const suggestions = []
    const parsedData = resumeAnalysis.parsedJson

    // Add missing core skills as primary focus areas
    if (parsedData.missingCoreSkills && parsedData.missingCoreSkills.length > 0) {
      suggestions.push(...parsedData.missingCoreSkills.slice(0, 5))
    }

    // Add skills based on experience gaps
    if (parsedData.experienceGaps && parsedData.experienceGaps.length > 0) {
      const gapSkills = parsedData.experienceGaps
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

  const getCompletedTasks = () => todayTasks.filter(t => t.status === 'completed').length
  const getTotalTasks = () => todayTasks.length

  const getOnboardingSteps = () => {
    const steps = [
      {
        id: 'profile' as OnboardingStep,
        name: 'Profile Setup',
        description: 'Set your career goals and preferences',
        icon: User,
        completed: onboardingStep !== 'profile',
        href: '/profile'
      },
      {
        id: 'resume' as OnboardingStep,
        name: 'Resume Upload',
        description: 'Upload your resume for AI analysis',
        icon: Upload,
        completed: onboardingStep === 'planner' || onboardingStep === 'complete',
        href: '/resume'
      },
      {
        id: 'planner' as OnboardingStep,
        name: 'Learning Planner',
        description: 'Generate your personalized learning plan',
        icon: Calendar,
        completed: onboardingStep === 'complete',
        href: '/planner'
      }
    ]
    return steps
  }

  const handleCreateLearningPlan = async () => {
    try {
      const { plannerAPI, resourceAPI } = await import('../services/api')

      // Validate form data
      if (!learningPlanForm.role.trim()) {
        toast.error('Please enter a desired role');
        return;
      }

      if (!learningPlanForm.dailyHours) {
        toast.error('Please select daily learning hours');
        return;
      }

      const dailyHours = Number(learningPlanForm.dailyHours);
      const weeklyHours = dailyHours * 7;
      const durationDays = Math.ceil(weeklyHours / 2);

      // Get AI-suggested focus areas
      const aiSuggestions = getAISuggestedFocusAreas()

      // Create the learning plan
      await plannerAPI.generate({
        role: learningPlanForm.role.trim(),
        startDate: new Date().toISOString().split('T')[0],
        durationDays,
        dailyHours: dailyHours,
        experienceSummary: learningPlanForm.experienceSummary?.trim() || '',
        focusAreas: aiSuggestions.length > 0 ? aiSuggestions : undefined,
        additionalContext: learningPlanForm.additionalContext?.trim() || ''
      })

      toast.success('Learning plan created successfully!')

      // Automatically generate personalized resources using user's profile preferences
      try {
        await resourceAPI.generate({
          role: learningPlanForm.role,
          dailyHours: dailyHours,
          weeklyHours: weeklyHours,
          experienceSummary: learningPlanForm.experienceSummary,
          additionalContext: learningPlanForm.additionalContext,
          preferredFormat: userProfile?.preferences?.format || 'mixed',
          learningType: userProfile?.preferences?.learningType || 'balanced'
        })

        toast.success(
          <div>
            <p>Resources generated automatically!</p>
            <p className="text-sm mt-1">
              <a href="/resources" className="text-blue-600 hover:text-blue-800 underline">
                View your personalized resources →
              </a>
            </p>
          </div>,
          { duration: 5000 }
        )
      } catch (resourceError: any) {
        console.error('Resource generation failed:', resourceError)
        toast.success(
          <div>
            <p>Learning plan created successfully!</p>
            <p className="text-sm mt-1">
              <a href="/resources" className="text-blue-600 hover:text-blue-800 underline">
                Generate personalized resources →
              </a>
            </p>
          </div>,
          { duration: 5000 }
        )
      }


      // Refresh dashboard data to show the new active planner
      await checkUserSetup()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create learning plan')
    }
  }

  const stats = [
    {
      name: 'Active Planners',
      value: 'View Plans',
      icon: Target,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show onboarding flow if user hasn't completed setup
  if (onboardingStep !== 'complete') {
    const onboardingSteps = getOnboardingSteps()
    const currentStepIndex = onboardingSteps.findIndex(step => step.id === onboardingStep)

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Wysa AI Career Coach!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Let's get you set up for your personalized learning journey
          </p>
        </div>

        {/* Onboarding Progress */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Your Setup Journey
              </h3>
              <div className="text-sm text-gray-500">
                Step {currentStepIndex + 1} of {onboardingSteps.length}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {Math.round(((currentStepIndex + (onboardingSteps[currentStepIndex]?.completed ? 1 : 0)) / onboardingSteps.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${((currentStepIndex + (onboardingSteps[currentStepIndex]?.completed ? 1 : 0)) / onboardingSteps.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {onboardingSteps.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Connection Line */}
                  {index < onboardingSteps.length - 1 && (
                    <div className={`absolute left-4 top-8 w-0.5 h-8 ${
                      step.completed ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}

                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                    step.completed
                      ? 'border-green-200 bg-green-50'
                      : index === currentStepIndex
                      ? 'border-blue-200 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      step.completed
                        ? 'bg-green-100'
                        : index === currentStepIndex
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}>
                      {step.completed ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : index === currentStepIndex ? (
                        <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                      ) : (
                        <step.icon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className={`text-sm font-medium ${
                        step.completed
                          ? 'text-green-900'
                          : index === currentStepIndex
                          ? 'text-blue-900'
                          : 'text-gray-500'
                      }`}>
                        {step.name}
                      </p>
                      <p className={`text-xs mt-1 ${
                        step.completed
                          ? 'text-green-700'
                          : index === currentStepIndex
                          ? 'text-blue-700'
                          : 'text-gray-400'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                    <div className="ml-4">
                      <Link
                        to={step.href}
                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          step.completed
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : index === currentStepIndex
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 transform scale-105'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {step.completed ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete
                          </>
                        ) : index === currentStepIndex ? (
                          <>
                            <step.icon className="h-4 w-4 mr-2" />
                            Continue
                          </>
                        ) : (
                          <>
                            <step.icon className="h-4 w-4 mr-2" />
                            Start
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Step Action */}
        <div className="bg-gradient-to-br from-white to-blue-50 shadow rounded-lg border-2 border-blue-100">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center">
              <div className="relative mb-6">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                  onboardingStep === 'profile' ? 'bg-gradient-to-br from-blue-100 to-blue-200' :
                  onboardingStep === 'resume' ? 'bg-gradient-to-br from-green-100 to-green-200' :
                  'bg-gradient-to-br from-purple-100 to-purple-200'
                }`}>
                  {onboardingStep === 'profile' && <User className="h-10 w-10 text-blue-600" />}
                  {onboardingStep === 'resume' && <Upload className="h-10 w-10 text-green-600" />}
                  {onboardingStep === 'planner' && <Calendar className="h-10 w-10 text-purple-600" />}
                </div>
                {/* Pulsing ring for current step */}
                <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-ping opacity-20"></div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {onboardingSteps[currentStepIndex]?.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2 max-w-md mx-auto">
                {onboardingSteps[currentStepIndex]?.description}
              </p>

              {/* Step Benefits */}
              <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium">What you'll get:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {onboardingStep === 'profile' && (
                    <>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Personalized recommendations</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Skill gap analysis</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Career roadmap</span>
                    </>
                  )}
                  {onboardingStep === 'resume' && (
                    <>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">ATS score analysis</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">Keyword optimization</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">Experience insights</span>
                    </>
                  )}
                  {onboardingStep === 'planner' && (
                    <>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">Daily learning tasks</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">Progress tracking</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">Achievement system</span>
                    </>
                  )}
                </div>
              </div>

              {(() => {
                const currentStep = onboardingSteps[currentStepIndex];
                const StepIcon = currentStep?.icon || Calendar;
                return (
                  <Link
                    to={currentStep?.href}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    <StepIcon className="h-5 w-5 mr-2" />
                    {onboardingStep === 'profile' && 'Set Up Profile'}
                    {onboardingStep === 'resume' && 'Upload Resume'}
                    {onboardingStep === 'planner' && 'Create Learning Plan'}
                  </Link>
                );
              })()}

              <p className="text-xs text-gray-400 mt-3">
                Takes less than 2 minutes • No credit card required
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.username}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here's your learning progress for today
        </p>
      </div>

      {/* Role Readiness Card */}
      {resumeAnalysis && resumeAnalysis.parsedJson && userProfile && (
        <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-lg rounded-xl border-2 border-indigo-100 transform hover:scale-105 transition-all duration-300">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-md bg-indigo-100">
                    <Target className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
                <div className="ml-5">
                  <h3 className="text-lg font-medium text-gray-900">Role Readiness</h3>
                  <p className="text-sm text-gray-500">Your journey to {userProfile.desiredRole}</p>
                </div>
              </div>
            </div>

            {/* Readiness Score Circle */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="3"
                  />
                  {/* Progress circle */}
                  <path
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#readinessGradient)"
                    strokeWidth="3"
                    strokeDasharray={`${resumeAnalysis.parsedJson.scores.overallFitScore}, 100`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="readinessGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F46E5" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-indigo-600">
                      {resumeAnalysis.parsedJson.scores.overallFitScore}%
                    </span>
                    <p className="text-xs text-gray-500 mt-1">Ready</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Readiness Status */}
            <div className="text-center mb-6">
              <p className={`text-lg font-semibold ${
                resumeAnalysis.parsedJson.scores.overallFitScore >= 80 ? 'text-green-600' :
                resumeAnalysis.parsedJson.scores.overallFitScore >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {resumeAnalysis.parsedJson.scores.overallFitScore >= 80 ? '🎉 Excellent Progress!' :
                 resumeAnalysis.parsedJson.scores.overallFitScore >= 60 ? '👍 Good Progress!' : '💪 Getting Started!'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {resumeAnalysis.parsedJson.scores.overallFitScore >= 80 ? 'You\'re well-prepared for this role' :
                 resumeAnalysis.parsedJson.scores.overallFitScore >= 60 ? 'You\'re making solid progress' : 'Keep learning and improving'}
              </p>
            </div>

            {/* Focus Areas */}
            {resumeAnalysis.parsedJson.missingCoreSkills && resumeAnalysis.parsedJson.missingCoreSkills.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Key Focus Areas:</p>
                <div className="flex flex-wrap gap-2">
                  {resumeAnalysis.parsedJson.missingCoreSkills.slice(0, 4).map((skill, index) => (
                    <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {skill}
                    </span>
                  ))}
                  {resumeAnalysis.parsedJson.missingCoreSkills.length > 4 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      +{resumeAnalysis.parsedJson.missingCoreSkills.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATS Score and Learning Plan Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ATS Score Card */}
        {resumeAnalysis && resumeAnalysis.parsedJson ? (
          <div className="bg-gradient-to-br from-white via-blue-50 to-cyan-50 shadow-lg rounded-xl border-2 border-blue-100 transform hover:scale-105 transition-all duration-300">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${
                    resumeAnalysis.parsedJson.scores.atsScore >= 80 ? 'bg-green-100' :
                    resumeAnalysis.parsedJson.scores.atsScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <Star className={`h-6 w-6 ${
                      resumeAnalysis.parsedJson.scores.atsScore >= 80 ? 'text-green-600' :
                      resumeAnalysis.parsedJson.scores.atsScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Resume ATS Score</h3>
                  <p className="text-sm text-gray-500">Based on your latest resume analysis</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    {/* Circular Progress Indicator */}
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        {/* Background circle */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="2"
                        />
                        {/* Progress circle */}
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={
                            resumeAnalysis.parsedJson.scores.atsScore >= 80 ? '#10B981' :
                            resumeAnalysis.parsedJson.scores.atsScore >= 60 ? '#F59E0B' : '#EF4444'
                          }
                          strokeWidth="2"
                          strokeDasharray={`${resumeAnalysis.parsedJson.scores.atsScore}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-lg font-bold ${
                          resumeAnalysis.parsedJson.scores.atsScore >= 80 ? 'text-green-600' :
                          resumeAnalysis.parsedJson.scores.atsScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {resumeAnalysis.parsedJson.scores.atsScore}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${
                        resumeAnalysis.parsedJson.scores.atsScore >= 80 ? 'text-green-700' :
                        resumeAnalysis.parsedJson.scores.atsScore >= 60 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {resumeAnalysis.parsedJson.scores.atsScore >= 80 ? 'Excellent' :
                         resumeAnalysis.parsedJson.scores.atsScore >= 60 ? 'Good' : 'Needs Work'}
                      </p>
                      <p className="text-xs text-gray-500">ATS Score</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Overall Fit</p>
                    <p className="text-lg font-medium text-gray-900">
                      {resumeAnalysis.parsedJson.scores.overallFitScore}%
                    </p>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Keywords</span>
                      <span className="text-xs font-medium">{resumeAnalysis.parsedJson.scores.keywordOptimizationScore}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Format</span>
                      <span className="text-xs font-medium">{resumeAnalysis.parsedJson.scores.formatScore}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Sections</span>
                      <span className="text-xs font-medium">{resumeAnalysis.parsedJson.scores.sectionCompletenessScore}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Experience</span>
                      <span className="text-xs font-medium">{resumeAnalysis.parsedJson.scores.experienceAlignmentScore}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Overall Fit</span>
                      <span className="text-xs font-medium">{resumeAnalysis.parsedJson.scores.overallFitScore}%</span>
                    </div>
                  </div>
                </div>

                {/* ATS Tips */}
                {resumeAnalysis.parsedJson.atsOptimizationTips && resumeAnalysis.parsedJson.atsOptimizationTips.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">ATS Optimization Tips:</p>
                    <div className="space-y-1">
                      {resumeAnalysis.parsedJson.atsOptimizationTips.slice(0, 2).map((tip, index) => (
                        <p key={index} className="text-xs text-gray-600 flex items-start">
                          <span className="text-blue-500 mr-1">•</span>
                          {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {resumeAnalysis.parsedJson.missingCoreSkills && resumeAnalysis.parsedJson.missingCoreSkills.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Missing Core Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {resumeAnalysis.parsedJson.missingCoreSkills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {skill}
                        </span>
                      ))}
                      {resumeAnalysis.parsedJson.missingCoreSkills.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          +{resumeAnalysis.parsedJson.missingCoreSkills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {resumeAnalysis.parsedJson.additionalNotes && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-xs text-blue-800">{resumeAnalysis.parsedJson.additionalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-md bg-gray-100">
                    <FileText className="h-6 w-6 text-gray-600" />
                  </div>
                </div>
                <div className="ml-5 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Resume Analysis</h3>
                  <p className="text-sm text-gray-500">Upload your resume to get ATS score and skill gap analysis</p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/resume"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resume
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Learning Plan Card */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-md bg-green-100">
                  <Brain className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-lg font-medium text-gray-900">Learning Plan</h3>
                <p className="text-sm text-gray-500">Create your personalized learning journey</p>
              </div>
            </div>
            
            <div className="mt-4">
              {onboardingStep === 'complete' ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    You have an active learning plan. View your progress and manage your plans.
                  </p>
                  <div className="flex space-x-3">
                    <Link
                      to="/planner"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Manage Plans
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a personalized learning plan based on your profile and resume analysis.
                  </p>
                  <button
                    onClick={() => {}}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Learning Plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Learning Progress Overview */}
      {resumeAnalysis && resumeAnalysis.parsedJson && userProfile && (
        <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 shadow-lg rounded-xl border-2 border-green-100 transform hover:scale-105 transition-all duration-300">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-md bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="ml-5">
                  <h3 className="text-lg font-medium text-gray-900">Learning Progress</h3>
                  <p className="text-sm text-gray-500">Track your skill development journey</p>
                </div>
              </div>
            </div>

            {/* Progress Metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {resumeAnalysis.parsedJson.missingCoreSkills ? 
                      Math.round((resumeAnalysis.parsedJson.scores.overallFitScore / 100) * resumeAnalysis.parsedJson.missingCoreSkills.length) : 0}
                  </div>
                  <div className="text-sm text-gray-600">Skills Improved</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {todayTasks.length > 0 ? Math.round((getCompletedTasks() / getTotalTasks()) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Daily Completion</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {Math.floor((new Date().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                  </div>
                  <div className="text-sm text-gray-600">Days Learning</div>
                </div>
              </div>
            </div>

            {/* Skill Progress */}
            {resumeAnalysis.parsedJson.missingCoreSkills && resumeAnalysis.parsedJson.missingCoreSkills.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Skill Development Progress</h4>
                <div className="space-y-3">
                  {resumeAnalysis.parsedJson.missingCoreSkills.slice(0, 5).map((skill, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{skill}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                            style={{ width: `${Math.random() * 80 + 20}%` }} // Simulated progress
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">
                          {Math.floor(Math.random() * 80 + 20)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/resume"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-gray-300"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                  <FileText className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" />
                  Upload Resume
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Get AI-powered resume analysis
                </p>
              </div>
            </Link>

            <Link
              to="/planner"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-gray-300"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-50 text-green-700 ring-4 ring-white">
                  <Calendar className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" />
                  Create Planner
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Generate personalized learning plan
                </p>
              </div>
            </Link>

            <Link
              to="/interview"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-gray-300"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-50 text-purple-700 ring-4 ring-white">
                  <Mic className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" />
                  Mock Interview
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Practice with AI interviewer
                </p>
              </div>
            </Link>

            <Link
              to="/resources"
              className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg border border-gray-200 hover:border-gray-300"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-orange-50 text-orange-700 ring-4 ring-white">
                  <BookOpen className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">
                  <span className="absolute inset-0" />
                  Resources
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Download study materials
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Learning Plan Form Modal */}
      {showLearningPlanForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Create Learning Plan
                </h3>
                <button
                  onClick={() => {}}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Desired Role *
                  </label>
                  <input
                    type="text"
                    value={learningPlanForm.role}
                    onChange={(e) => setLearningPlanForm(prev => ({ ...prev, role: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Software Engineer, Data Analyst"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Daily Learning Hours *
                  </label>
                  <select
                    value={learningPlanForm.dailyHours}
                    onChange={(e) => setLearningPlanForm(prev => ({ ...prev, dailyHours: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
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
                </div>

                {/* AI-Suggested Focus Areas */}
                {(() => {
                  const aiSuggestions = resumeAnalysis && userProfile ? getAISuggestedFocusAreas() : []
                  return aiSuggestions.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI-Suggested Focus Areas
                      </label>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">
                          Based on your resume analysis and career goals:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {aiSuggestions.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          These skills will be automatically included in your learning plan
                        </p>
                      </div>
                    </div>
                  ) : null
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Experience Summary
                  </label>
                  <textarea
                    value={learningPlanForm.experienceSummary}
                    onChange={(e) => setLearningPlanForm(prev => ({ ...prev, experienceSummary: e.target.value }))}
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
                    value={learningPlanForm.additionalContext}
                    onChange={(e) => setLearningPlanForm(prev => ({ ...prev, additionalContext: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Any specific learning preferences or constraints..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {}}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLearningPlan}
                    disabled={!learningPlanForm.role || !learningPlanForm.weeklyHours}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Brain className="h-4 w-4 mr-2 inline" />
                    Create Learning Plan
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
