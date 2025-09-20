'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

interface Recording {
  id: string
  title: string
  file_path: string
  duration: number
  transcription?: string
  summary?: string
  created_at: string
}

interface MedicalReport {
  id: string
  title: string
  type: 'appointment' | 'lab_result' | 'prescription' | 'diagnosis'
  content: string
  date: string
  doctor_name?: string
  created_at: string
}

export default function ReportsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [profile, setProfile] = useState<{full_name: string, user_type: 'patient' | 'caregiver'} | null>(null)
  const [activeTab, setActiveTab] = useState<'recordings' | 'reports' | 'timeline'>('recordings')
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

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

  const fetchRecordings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('recordings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setRecordings(data || [])
      }
    } catch (error) {
      console.error('Error fetching recordings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const fetchReports = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('medical_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })

        if (error) throw error
        setReports(data || [])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
  }, [supabase])

  const playRecording = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('recordings')
        .createSignedUrl(filePath, 3600)

      if (data?.signedUrl) {
        const audio = new Audio(data.signedUrl)
        audio.play()
      }
    } catch (error) {
      console.error('Error playing recording:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'appointment': return '🏥'
      case 'lab_result': return '🧪'
      case 'prescription': return '💊'
      case 'diagnosis': return '📋'
      default: return '📄'
    }
  }

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'appointment': return 'bg-blue-100 text-blue-800'
      case 'lab_result': return 'bg-green-100 text-green-800'
      case 'prescription': return 'bg-purple-100 text-purple-800'
      case 'diagnosis': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const combinedTimeline = [
    ...recordings.map(r => ({ ...r, type: 'recording', date: r.created_at })),
    ...reports.map(r => ({ ...r, type: 'report', date: r.date || r.created_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex">
      <Sidebar userType={profile.user_type} userName={profile.full_name} />

      <div className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Medical History</h1>
            <p className="text-gray-600">
              View your recorded appointments, medical reports, and health timeline
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'recordings', label: 'Recordings', icon: '🎙️' },
                { id: 'reports', label: 'Medical Reports', icon: '📋' },
                { id: 'timeline', label: 'Timeline', icon: '📅' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'recordings' | 'reports' | 'timeline')}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Recordings Tab */}
          {activeTab === 'recordings' && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Your Recordings</h3>
                <p className="text-gray-600 mt-1">All your recorded doctor appointments and conversations</p>
              </div>

              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : recordings.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🎙️</span>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No recordings yet</h4>
                  <p className="text-gray-600">Start recording your doctor visits to build your medical history</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <div key={recording.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                            <span className="text-xl">🎵</span>
                          </div>
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{recording.title}</h4>
                            <p className="text-gray-600">
                              {formatDate(recording.created_at)} • {formatTime(recording.duration)}
                            </p>
                            {recording.summary && (
                              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                                {recording.summary.substring(0, 150)}...
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => playRecording(recording.file_path)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Play recording"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setSelectedRecording(recording)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Medical Reports Tab */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Medical Reports</h3>
                <p className="text-gray-600 mt-1">Lab results, prescriptions, and medical documents</p>
              </div>

              {reports.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No reports available</h4>
                  <p className="text-gray-600">Medical reports and documents will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {reports.map((report) => (
                    <div key={report.id} className="p-6">
                      <div className="flex items-start">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mr-4">
                          <span className="text-xl">{getReportTypeIcon(report.type)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-medium text-gray-900">{report.title}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReportTypeColor(report.type)}`}>
                              {report.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">
                            {formatDate(report.date)} {report.doctor_name && `• Dr. ${report.doctor_name}`}
                          </p>
                          <p className="text-gray-700">{report.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Medical Timeline</h3>
                <p className="text-gray-600 mt-1">Chronological view of all your medical activities</p>
              </div>

              {combinedTimeline.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📅</span>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No timeline data</h4>
                  <p className="text-gray-600">Your medical timeline will appear here as you add recordings and reports</p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="space-y-6">
                    {combinedTimeline.map((item, index) => (
                      <div key={`${item.type}-${item.id}`} className="flex">
                        <div className="flex flex-col items-center mr-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.type === 'recording' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            <span className="text-lg">
                              {item.type === 'recording' ? '🎙️' : getReportTypeIcon((item as MedicalReport).type)}
                            </span>
                          </div>
                          {index < combinedTimeline.length - 1 && (
                            <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <h4 className="text-lg font-medium text-gray-900">{item.title}</h4>
                          <p className="text-gray-600 text-sm mb-2">{formatDate(item.date)}</p>
                          {item.type === 'recording' && (
                            <p className="text-gray-700">
                              Recording • {formatTime((item as Recording).duration)}
                              {(item as Recording).summary && (
                                <span className="block mt-1 text-sm">
                                  {(item as Recording).summary?.substring(0, 100)}...
                                </span>
                              )}
                            </p>
                          )}
                          {item.type === 'report' && (
                            <p className="text-gray-700">{(item as MedicalReport).content.substring(0, 150)}...</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recording Detail Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">{selectedRecording.title}</h3>
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                {formatDate(selectedRecording.created_at)} • {formatTime(selectedRecording.duration)}
              </p>

              <div className="mb-6">
                <button
                  onClick={() => playRecording(selectedRecording.file_path)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Play Recording
                </button>
              </div>

              {selectedRecording.transcription && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Transcription</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedRecording.transcription}</p>
                  </div>
                </div>
              )}

              {selectedRecording.summary && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-gray-700">{selectedRecording.summary}</p>
                  </div>
                </div>
              )}

              {!selectedRecording.transcription && !selectedRecording.summary && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No transcription or summary available for this recording.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}