import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { profileAPI } from '../services/api'
import { User, Mail, Save, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProfileData {
  desiredRole: string
  weeklyHours: number
  timezone: string
  preferences: {
    format: string
    learningType: string
    notifications: boolean
  }
  // New fields
  name?: string
  phone?: string
  currentRole?: string
  experienceYears?: number
  skills?: string[]
}

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland'
]

export const Profile: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ProfileData>()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await profileAPI.get()
        const profileData = response.data.profile || null // Handle null
        setProfile(profileData)
        reset(profileData || {}) // Reset form with empty if null
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        // Don't toast - we'll show UI message
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [reset])

  const onSubmit = async (data: ProfileData) => {
    if (!data.weeklyHours || data.weeklyHours <= 0) {
      toast.error('Weekly hours must be a positive number')
      return
    }
    setSaving(true)
    try {
      // Ensure proper data types for backend
      const submitData = {
        desiredRole: data.desiredRole,
        weeklyHours: Number(data.weeklyHours),
        timezone: data.timezone || 'UTC',
        preferences: {
          format: data.preferences?.format || 'mixed',
          learningType: data.preferences?.learningType || 'balanced',
          notifications: data.preferences?.notifications || false
        },
        name: data.name?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        currentRole: data.currentRole?.trim() || undefined,
        experienceYears: typeof data.experienceYears === 'number' ? data.experienceYears : undefined,
        skills: Array.isArray(data.skills) ? data.skills : undefined,
      }

      if (profile) {
        await profileAPI.update(submitData)
        toast.success('Profile updated successfully!')
      } else {
        await profileAPI.create(submitData)
        toast.success('Profile created successfully!')
      }
      setProfile(submitData as any)

      // Also update the form with the new data structure for consistency
      reset(submitData as any)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show create profile form if no profile exists
  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set up your profile to get started with personalized learning
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Career Goals
              </h3>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="desiredRole" className="block text-sm font-medium text-gray-700">
                    Desired Role *
                  </label>
                  <input
                    type="text"
                    id="desiredRole"
                    {...register('desiredRole', { required: 'Desired role is required' })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Software Engineer, Data Analyst"
                  />
                  {errors.desiredRole && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.desiredRole.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="weeklyHours" className="block text-sm font-medium text-gray-700">
                    Weekly Learning Hours *
                  </label>
                  <input
                    type="number"
                    id="weeklyHours"
                    min="1"
                    max="40"
                    {...register('weeklyHours', {
                      required: 'Weekly hours is required',
                      min: { value: 1, message: 'Must be at least 1 hour' },
                      max: { value: 40, message: 'Must be at most 40 hours' }
                    })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="10"
                  />
                  {errors.weeklyHours && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.weeklyHours.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Preferences
              </h3>

              <div className="space-y-6">
                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                    Timezone *
                  </label>
                  <select
                    id="timezone"
                    {...register('timezone', { required: 'Timezone is required' })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select your timezone</option>
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  {errors.timezone && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.timezone.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                      Preferred Format
                    </label>
                    <select
                      id="format"
                      {...register('preferences.format')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="video">Video</option>
                      <option value="article">Article</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="learningType" className="block text-sm font-medium text-gray-700">
                      Learning Type
                    </label>
                    <select
                      id="learningType"
                      {...register('preferences.learningType')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="project_based">Project-based</option>
                      <option value="theory_focused">Theory-focused</option>
                      <option value="balanced">Balanced</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="notifications"
                    type="checkbox"
                    {...register('preferences.notifications')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="notifications" className="ml-2 block text-sm text-gray-900">
                    Receive daily email notifications
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Profile...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your learning preferences and career goals
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-gray-900">{user?.username}</h3>
                <p className="text-sm text-gray-500 flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Career Goals
                </h3>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="desiredRole" className="block text-sm font-medium text-gray-700">
                      Desired Role
                    </label>
                    <input
                      type="text"
                      id="desiredRole"
                      {...register('desiredRole', { required: 'Desired role is required' })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g., Software Engineer, Data Analyst"
                    />
                    {errors.desiredRole && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.desiredRole.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="weeklyHours" className="block text-sm font-medium text-gray-700">
                      Weekly Learning Hours
                    </label>
                    <input
                      type="number"
                      id="weeklyHours"
                      min="1"
                      max="40"
                      {...register('weeklyHours', { 
                        required: 'Weekly hours is required',
                        min: { value: 1, message: 'Must be at least 1 hour' },
                        max: { value: 40, message: 'Must be at most 40 hours' }
                      })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="10"
                    />
                    {errors.weeklyHours && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.weeklyHours.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Career Goals
                </h3>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      {...register('name')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      {...register('phone')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="+1-555-555-5555"
                    />
                  </div>
                  <div>
                    <label htmlFor="currentRole" className="block text-sm font-medium text-gray-700">
                      Current Role
                    </label>
                    <input
                      type="text"
                      id="currentRole"
                      {...register('currentRole')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g., Frontend Developer"
                    />
                  </div>
                  <div>
                    <label htmlFor="experienceYears" className="block text-sm font-medium text-gray-700">
                      Experience (years)
                    </label>
                    <input
                      type="number"
                      id="experienceYears"
                      min="0"
                      step="0.5"
                      {...register('experienceYears')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Preferences
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                      Timezone
                    </label>
                    <select
                      id="timezone"
                      {...register('timezone', { required: 'Timezone is required' })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Select your timezone</option>
                      {timezones.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    {errors.timezone && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.timezone.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                        Preferred Format
                      </label>
                      <select
                        id="format"
                        {...register('preferences.format')}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="video">Video</option>
                        <option value="article">Article</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="learningType" className="block text-sm font-medium text-gray-700">
                        Learning Type
                      </label>
                      <select
                        id="learningType"
                        {...register('preferences.learningType')}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="project_based">Project-based</option>
                        <option value="theory_focused">Theory-focused</option>
                        <option value="balanced">Balanced</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="skills" className="block text-sm font-medium text-gray-700">
                      Key Skills (comma-separated)
                    </label>
                    <input
                      id="skills"
                      type="text"
                      onChange={(e) => {
                        const value = e.target.value
                        const arr = value
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean)
                        // set into form
                        reset({ ...(profile || {}), skills: arr } as any)
                      }}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="React, Node.js, SQL"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      id="notifications"
                      type="checkbox"
                      {...register('preferences.notifications')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="notifications" className="ml-2 block text-sm text-gray-900">
                      Receive daily email notifications
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Profile
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
