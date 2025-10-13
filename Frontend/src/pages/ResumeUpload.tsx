import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { resumeAPI, profileAPI } from '../services/api'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Eye,
  Trash2,
  Loader,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Resume {
  id: number
  originalFileName: string
  storedFileName: string
  mimeType: string
  fileSize: number
  parsedJson?: any
  createdAt: string
  downloadUrl: string
}

interface AnalysisResult {
  summary: string
  recruiterPerspective: string
  hiringManagerPerspective: string
  scores: {
    atsScore: number
    overallFitScore: number
    experienceAlignmentScore: number
  }
  missingCoreSkills: string[]
  missingNiceToHaveSkills: string[]
  experienceGaps: Array<{
    title: string
    description: string
    urgency: 'high' | 'medium' | 'low'
    recommendedActions: string[]
  }>
  certificationRecommendations: string[]
  atsOptimizationTips: string[]
  learningPaths: Array<{
    focusArea: string
    rationale: string
    suggestedResources: string[]
  }>
}

export const ResumeUpload: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState<number | null>(null)
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [analysisForm, setAnalysisForm] = useState({
    desiredRole: '',
    experienceSummary: '',
    experienceYears: '',
    additionalContext: ''
  })

  useEffect(() => {
    fetchUserProfile()
  }, [])

  useEffect(() => {
    if (userProfile?.userId) {
      fetchUserResumes()
    }
  }, [userProfile?.userId])

  const fetchUserProfile = async () => {
    try {
      const response = await profileAPI.get()
      if (response.data.profile) {
        setUserProfile(response.data.profile)
      }
    } catch (error) {
      console.log('No profile found')
    }
  }

  const fetchUserResumes = async () => {
    try {
      if (userProfile?.userId) {
        const response = await resumeAPI.getUserResumes(userProfile.userId)
        if (response.data.data) {
          setResumes(response.data.data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch user resumes:', error)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await resumeAPI.upload(formData)
      const newResume = response.data.data
      
      setResumes(prev => [newResume, ...prev])
      toast.success('Resume uploaded successfully!')
      
      // Refresh the resume list to ensure we have the latest data
      await fetchUserResumes()
      
      // Automatically trigger analysis with default values
      setTimeout(async () => {
        try {
          setAnalyzing(newResume.id)
          const analysisData = {
            desiredRole: userProfile?.desiredRole || 'Software Engineer',
            experienceSummary: userProfile?.preferences?.summary || '',
            experienceYears: '3',
            additionalContext: ''
          }
          
          const analysisResponse = await resumeAPI.parse(newResume.id, analysisData)
          const result = analysisResponse.data.data.parsedJson

          console.log('Analysis response:', analysisResponse.data)
          console.log('Analysis result:', result)
          console.log('Analysis result type:', typeof result)
          console.log('Analysis result null check:', result === null)
          console.log('Analysis result undefined check:', result === undefined)

          // Update local state
          setAnalysisResult(result)
          setResumes(prev => prev.map(r =>
            r.id === newResume.id ? { ...r, parsedJson: result } : r
          ))

          // Refresh the resume list to get the latest data from database
          await fetchUserResumes()

          toast.success('Resume analyzed automatically!')
          
          // Set flag to trigger dashboard refresh
          localStorage.setItem('resumeUploaded', 'true')
        } catch (analysisError: any) {
          console.error('Auto-analysis failed:', analysisError)
          toast.error('Upload successful, but automatic analysis failed. Please analyze manually.')
          
          // Set flag to trigger dashboard refresh even if analysis failed
          localStorage.setItem('resumeUploaded', 'true')
        } finally {
          setAnalyzing(null)
        }
      }, 1000)
      
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [userProfile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024 // 15MB
  })

  const analyzeResume = async (resumeId: number) => {
    setAnalyzing(resumeId)
    try {
      const response = await resumeAPI.parse(resumeId, analysisForm)
      const result = response.data.data.parsedJson
      
      setAnalysisResult(result)
      setResumes(prev => prev.map(r => 
        r.id === resumeId ? { ...r, parsedJson: result } : r
      ))
      
      // Refresh the resume list to get the latest data from database
      await fetchUserResumes()
      
      // Set flag to trigger dashboard refresh
      localStorage.setItem('resumeUploaded', 'true')
      
      toast.success('Resume analyzed successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Analysis failed')
    } finally {
      setAnalyzing(null)
    }
  }

  const downloadAnalysisPdf = async (resumeId: number) => {
    try {
      const response = await resumeAPI.getAnalysisPdf(resumeId)
      const { downloadUrl } = response.data.data
      
      // Open download URL in new tab
      window.open(downloadUrl, '_blank')
      toast.success('Analysis PDF downloaded!')
    } catch (error: any) {
      toast.error('Failed to download analysis PDF')
    }
  }

  const deleteResume = async (resumeId: number) => {
    if (!confirm('Are you sure you want to delete this resume?')) return

    try {
      await resumeAPI.delete(resumeId)
      
      // Update local state
      setResumes(prev => prev.filter(r => r.id !== resumeId))
      
      // Refresh the resume list to ensure we have the latest data
      await fetchUserResumes()
      
      toast.success('Resume deleted successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete resume')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resume Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your resume for AI-powered analysis and skill gap detection
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} disabled={uploading} />
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-900">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive ? 'Drop your resume here' : 'Upload your resume'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Drag and drop or click to select (PDF, DOC, DOCX, TXT)
                </p>
                <p className="text-xs text-gray-400 mt-1">Max file size: 15MB</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume List */}
      {resumes.length > 0 ? (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Resumes</h3>
            <div className="space-y-4">
              {resumes.map((resume) => (
                <div key={resume.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {resume.originalFileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(resume.createdAt), 'MMM dd, yyyy')} • 
                          {(resume.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {resume.parsedJson ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Analyzed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Analyzed
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedResume(resume)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteResume(resume.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Resumes Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload your first resume to get started with AI-powered analysis
            </p>
          </div>
        </div>
      )}

      {/* Analysis Modal */}
      {selectedResume && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Resume Analysis: {selectedResume.originalFileName}
                </h3>
                <button
                  onClick={() => setSelectedResume(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {!selectedResume.parsedJson ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Desired Role
                      </label>
                      <input
                        type="text"
                        value={analysisForm.desiredRole}
                        onChange={(e) => setAnalysisForm(prev => ({ ...prev, desiredRole: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Experience Years
                      </label>
                      <input
                        type="number"
                        value={analysisForm.experienceYears}
                        onChange={(e) => setAnalysisForm(prev => ({ ...prev, experienceYears: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Experience Summary
                    </label>
                    <textarea
                      value={analysisForm.experienceSummary}
                      onChange={(e) => setAnalysisForm(prev => ({ ...prev, experienceSummary: e.target.value }))}
                      rows={3}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Brief description of your experience..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Additional Context
                    </label>
                    <textarea
                      value={analysisForm.additionalContext}
                      onChange={(e) => setAnalysisForm(prev => ({ ...prev, additionalContext: e.target.value }))}
                      rows={2}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Any additional information..."
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setSelectedResume(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => analyzeResume(selectedResume.id)}
                      disabled={analyzing === selectedResume.id}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {analyzing === selectedResume.id ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin mr-2 inline" />
                          Analyzing...
                        </>
                      ) : (
                        'Analyze Resume'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Analysis Results */}
                  {analysisResult && (
                    <>
                      {/* Scores */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-medium text-gray-900">ATS Score</h4>
                          <p className={`text-2xl font-bold ${getScoreColor(analysisResult.scores.atsScore)}`}>
                            {analysisResult.scores.atsScore}%
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-medium text-gray-900">Overall Fit</h4>
                          <p className={`text-2xl font-bold ${getScoreColor(analysisResult.scores.overallFitScore)}`}>
                            {analysisResult.scores.overallFitScore}%
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-medium text-gray-900">Experience Alignment</h4>
                          <p className={`text-2xl font-bold ${getScoreColor(analysisResult.scores.experienceAlignmentScore)}`}>
                            {analysisResult.scores.experienceAlignmentScore}%
                          </p>
                        </div>
                      </div>

                      {/* Summary */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Summary</h4>
                        <p className="text-gray-700">{analysisResult.summary}</p>
                      </div>

                      {/* Skills Gap Analysis */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-3">Skills Gap Analysis</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Missing Skills */}
                          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                            <h5 className="text-sm font-medium text-red-900 mb-3 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Skills to Develop
                            </h5>
                            <div className="space-y-2">
                              {analysisResult.missingCoreSkills.map((skill, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <span className="text-sm text-red-800">{skill}</span>
                                  <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                    High Priority
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Nice to Have Skills */}
                          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                            <h5 className="text-sm font-medium text-yellow-900 mb-3 flex items-center">
                              <Star className="h-4 w-4 mr-2" />
                              Nice to Have Skills
                            </h5>
                            <div className="space-y-2">
                              {analysisResult.missingNiceToHaveSkills?.slice(0, 3).map((skill, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <span className="text-sm text-yellow-800">{skill}</span>
                                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                                    Optional
                                  </span>
                                </div>
                              )) || (
                                <p className="text-sm text-yellow-700">No additional skills identified</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Experience Gaps */}
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-3">Experience & Knowledge Gaps</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {analysisResult.experienceGaps.map((gap, index) => (
                            <div key={index} className="bg-white border-2 border-gray-100 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold text-gray-900 text-sm">{gap.title}</h5>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getUrgencyColor(gap.urgency)}`}>
                                  {gap.urgency} priority
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{gap.description}</p>

                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <p className="text-sm font-medium text-blue-900 mb-2">🎯 Action Plan:</p>
                                <ul className="text-sm text-blue-800 space-y-1">
                                  {gap.recommendedActions.map((action, actionIndex) => (
                                    <li key={actionIndex} className="flex items-start">
                                      <span className="text-blue-500 mr-2">•</span>
                                      <span className="flex-1">{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Learning Path Indicator */}
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center text-xs text-gray-500">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  <span>Suggested learning path available</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => downloadAnalysisPdf(selectedResume.id)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF Report
                    </button>
                    <button
                      onClick={() => setSelectedResume(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
