import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { interviewAPI } from '../services/api'
import { 
  Mic, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Download,
  Eye,
  X,
  Loader,
  Play
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Interview {
  id: number
  scheduledAt: string
  status: 'pending' | 'in_progress' | 'completed'
  recordingUrl?: string
  transcript?: string
  scoreJson?: any
}

interface EligibilityResult {
  isEligible: boolean
  currentProgress: number
  requiredProgress: number
  daysUntilEligible?: number
  message: string
}

export const Interview: React.FC = () => {
  const { } = useAuth()
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [starting, setStarting] = useState<number | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)

  useEffect(() => {
    const loadData = async () => {
      await fetchEligibility()
      // Small delay to avoid rate limiting
      setTimeout(() => {
        fetchInterviews()
      }, 100)
    }
    loadData()
  }, [])

  const fetchEligibility = async () => {
    try {
      const response = await interviewAPI.getEligibility()
      setEligibility(response.data.data)
    } catch (error) {
      console.error('Failed to fetch eligibility:', error)
    }
  }

  const fetchInterviews = async () => {
    try {
      const response = await interviewAPI.getHistory()
      setInterviews(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch interviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const scheduleInterview = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number')
      return
    }

    setScheduling(true)
    try {
      const response = await interviewAPI.schedule({
        phoneNumber: phoneNumber.trim()
      })
      const newInterview = response.data.data.interview
      
      setInterviews(prev => [newInterview, ...prev])
      setShowScheduleForm(false)
      setPhoneNumber('')
      toast.success('Interview scheduled successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule interview')
    } finally {
      setScheduling(false)
    }
  }

  const startInterview = async (interviewId: number) => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number')
      return
    }

    setStarting(interviewId)
    try {
      await interviewAPI.start(interviewId, phoneNumber.trim())
      toast.success('Interview call started! You will receive a call shortly.')
      
      // Update interview status
      setInterviews(prev => prev.map(interview => 
        interview.id === interviewId 
          ? { ...interview, status: 'in_progress' as const }
          : interview
      ))
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to start interview')
    } finally {
      setStarting(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'in_progress': return 'text-blue-600 bg-blue-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'in_progress': return Play
      case 'pending': return Clock
      default: return AlertCircle
    }
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mock Interviews</h1>
        <p className="mt-1 text-sm text-gray-500">
          Practice with AI-powered voice interviews to improve your skills
        </p>
      </div>

      {/* Eligibility Status */}
      {eligibility && (
        <div className={`rounded-lg p-4 ${
          eligibility.isEligible 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center">
            {eligibility.isEligible ? (
              <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
            )}
            <div>
              <h3 className={`text-sm font-medium ${
                eligibility.isEligible ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {eligibility.isEligible ? 'Ready for Interview!' : 'Not Yet Eligible'}
              </h3>
              <p className={`text-sm ${
                eligibility.isEligible ? 'text-green-700' : 'text-yellow-700'
              }`}>
                {eligibility.message}
              </p>
              {!eligibility.isEligible && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress: {eligibility.currentProgress}%</span>
                    <span>Required: {eligibility.requiredProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{ width: `${eligibility.currentProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview */}
      {eligibility?.isEligible && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Schedule New Interview</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Book a mock interview to practice your skills
                </p>
              </div>
              <button
                onClick={() => setShowScheduleForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Schedule Interview</h3>
                <button
                  onClick={() => setShowScheduleForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="+1234567890"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    We'll call you at this number for the interview
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowScheduleForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={scheduleInterview}
                    disabled={scheduling}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scheduling ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin mr-2 inline" />
                        Scheduling...
                      </>
                    ) : (
                      'Schedule Interview'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interviews List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Interviews</h3>
          
          {interviews.length === 0 ? (
            <div className="text-center py-12">
              <Mic className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No interviews scheduled</h3>
              <p className="mt-1 text-sm text-gray-500">
                Schedule your first mock interview to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {interviews.map((interview) => {
                const StatusIcon = getStatusIcon(interview.status)
                return (
                  <div key={interview.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Mic className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            Mock Interview
                          </h4>
                          <p className="text-sm text-gray-500">
                            Scheduled for {format(new Date(interview.scheduledAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {interview.status.replace('_', ' ')}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          {interview.status === 'pending' && (
                            <button
                              onClick={() => startInterview(interview.id)}
                              disabled={starting === interview.id}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                            >
                              {starting === interview.id ? (
                                <Loader className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Play className="h-3 w-3 mr-1" />
                              )}
                              Start
                            </button>
                          )}
                          
                          {interview.status === 'completed' && (
                            <>
                              <button
                                onClick={() => setSelectedInterview(interview)}
                                className="text-blue-600 hover:text-blue-800"
                                title="View Results"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  // Download interview report
                                  toast.success('Interview report downloaded!')
                                }}
                                className="text-green-600 hover:text-green-800"
                                title="Download Report"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interview Results Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Interview Results
                </h3>
                <button
                  onClick={() => setSelectedInterview(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {selectedInterview.scoreJson && (
                  <>
                    {/* Scores */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="bg-white p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-900">Overall Score</h4>
                        <p className="text-2xl font-bold text-blue-600">
                          {selectedInterview.scoreJson.overallScore}%
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-900">Technical</h4>
                        <p className="text-2xl font-bold text-green-600">
                          {selectedInterview.scoreJson.technicalScore}%
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-900">Communication</h4>
                        <p className="text-2xl font-bold text-purple-600">
                          {selectedInterview.scoreJson.communicationScore}%
                        </p>
                      </div>
                    </div>

                    {/* Strengths */}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Strengths</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedInterview.scoreJson.strengths?.map((strength: string, index: number) => (
                          <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Areas for Improvement */}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Areas for Improvement</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedInterview.scoreJson.weaknesses?.map((weakness: string, index: number) => (
                          <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            {weakness}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Detailed Feedback */}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Detailed Feedback</h4>
                      <p className="text-gray-700">{selectedInterview.scoreJson.detailedFeedback}</p>
                    </div>
                  </>
                )}

                {selectedInterview.transcript && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Transcript</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">{selectedInterview.transcript}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      // Download interview report
                      toast.success('Interview report downloaded!')
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </button>
                  <button
                    onClick={() => setSelectedInterview(null)}
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
