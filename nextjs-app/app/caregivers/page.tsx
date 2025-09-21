'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Caregiver {
  id: string
  caregiver_email: string
  caregiver_name: string
  relationship: string
  permissions: string[]
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

export default function CaregiversPage() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [profile, setProfile] = useState<{full_name: string, user_type: 'patient' | 'caregiver'} | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [formData, setFormData] = useState({
    caregiverEmail: '',
    caregiverName: '',
    relationship: '',
    permissions: [] as string[]
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  const availablePermissions = [
    { id: 'view_recordings', label: 'View Recordings', description: 'Access to your recorded appointments' },
    { id: 'view_reports', label: 'View Reports', description: 'Access to medical reports and history' },
    { id: 'receive_notifications', label: 'Receive Notifications', description: 'Get updates about appointments and health changes' },
    { id: 'emergency_contact', label: 'Emergency Contact', description: 'Can be contacted in case of emergency' },
  ]

  const relationshipOptions = [
    { value: 'spouse', label: 'Spouse/Partner' },
    { value: 'parent', label: 'Parent' },
    { value: 'child', label: 'Child' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'friend', label: 'Friend' },
    { value: 'professional', label: 'Professional Caregiver' },
    { value: 'other', label: 'Other' },
  ]

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, user_type')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }, [supabase])

  const fetchCaregivers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('caregiver_relationships')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setCaregivers(data || [])
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchProfile()
    fetchCaregivers()
  }, [fetchProfile, fetchCaregivers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAddCaregiver = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error } = await supabase
        .from('caregiver_relationships')
        .insert([
          {
            patient_id: user.id,
            caregiver_email: formData.caregiverEmail,
            caregiver_name: formData.caregiverName,
            relationship: formData.relationship,
            permissions: formData.permissions,
            status: 'pending'
          }
        ])

      if (error) throw error

      // Reset form
      setFormData({
        caregiverEmail: '',
        caregiverName: '',
        relationship: '',
        permissions: []
      })
      setShowAddForm(false)
      await fetchCaregivers()

      // Here you could send an email invitation to the caregiver
      alert('Caregiver invitation sent successfully!')
    } catch (error) {
      console.error('Error adding caregiver:', error)
      alert('Failed to add caregiver. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePermissionChange = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }))
  }

  const removeCaregiver = async (caregiverId: string) => {
    if (!confirm('Are you sure you want to remove this caregiver?')) return

    try {
      const { error } = await supabase
        .from('caregiver_relationships')
        .delete()
        .eq('id', caregiverId)

      if (error) throw error
      await fetchCaregivers()
    } catch (error) {
      console.error('Error removing caregiver:', error)
      alert('Failed to remove caregiver. Please try again.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'declined': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex">
      <Sidebar userType={profile.user_type} userName={profile.full_name} activeView="caregivers" onViewChange={() => {}} />

      <div className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Caregivers</h1>
            <p className="text-gray-600">
              Add trusted family members and caregivers to share your medical information
            </p>
          </div>

          {/* Add Caregiver Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Caregiver
            </button>
          </div>

          {/* Add Caregiver Form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Add New Caregiver</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddCaregiver} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Caregiver Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.caregiverName}
                      onChange={(e) => setFormData(prev => ({ ...prev, caregiverName: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder="Enter caregiver's full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.caregiverEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, caregiverEmail: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      placeholder="caregiver@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white text-left flex items-center justify-between"
                    >
                      <span className={formData.relationship ? 'text-black' : 'text-gray-500'}>
                        {formData.relationship 
                          ? relationshipOptions.find(opt => opt.value === formData.relationship)?.label 
                          : 'Select relationship'
                        }
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {showDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-auto">
                        {relationshipOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, relationship: option.value }))
                              setShowDropdown(false)
                            }}
                            className="w-full px-4 py-3 text-left text-black hover:bg-blue-50 focus:bg-blue-50 focus:outline-none first:rounded-t-xl last:rounded-b-xl"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Permissions
                  </label>
                  <div className="grid md:grid-cols-2 gap-4">
                    {availablePermissions.map((permission) => (
                      <div key={permission.id} className="flex items-start">
                        <input
                          type="checkbox"
                          id={permission.id}
                          checked={formData.permissions.includes(permission.id)}
                          onChange={() => handlePermissionChange(permission.id)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <label htmlFor={permission.id} className="text-sm font-medium text-gray-900">
                            {permission.label}
                          </label>
                          <p className="text-xs text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Adding...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Caregivers List */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Your Caregivers</h3>
              <p className="text-gray-600 mt-1">Manage your caregiver relationships and permissions</p>
            </div>

            {caregivers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">👥</span>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No caregivers added yet</h4>
                <p className="text-gray-600 mb-6">
                  Add trusted family members or caregivers to share your medical information
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  Add Your First Caregiver
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {caregivers.map((caregiver) => (
                  <div key={caregiver.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-white text-xl mr-4">
                          🤝
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{caregiver.caregiver_name}</h4>
                          <p className="text-gray-600">{caregiver.caregiver_email}</p>
                          <p className="text-sm text-gray-500 capitalize">{caregiver.relationship}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(caregiver.status)}`}>
                          {caregiver.status}
                        </span>
                        <button
                          onClick={() => removeCaregiver(caregiver.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Remove caregiver"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L7.586 12l-1.293 1.293a1 1 0 101.414 1.414L9 13.414l2.293 2.293a1 1 0 001.414-1.414L11.414 12l1.293-1.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {caregiver.permissions && caregiver.permissions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Permissions:</p>
                        <div className="flex flex-wrap gap-2">
                          {caregiver.permissions.map((permission: string) => {
                            const permissionData = availablePermissions.find(p => p.id === permission)
                            return (
                              <span
                                key={permission}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                              >
                                {permissionData?.label || permission}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}