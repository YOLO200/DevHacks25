'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import CaregiversPage from '@/components/CaregiversContent'
import AppleErrorNotification from '@/components/AppleErrorNotification'
import MedicalReportsView from './components/MedicalReportsView'
import RecordingsTimelineView from './components/RecordingsTimelineView'
import VoiceRecorderView from './components/VoiceRecorderView'
import CareRemindersView from './components/CareRemindersView'
import PatientsView from './components/PatientsView'
import SettingsView from './components/SettingsView'
import jsPDF from 'jspdf'

interface UserProfile {
  full_name: string
  user_type: 'patient' | 'caregiver'
}

interface Recording {
  id: string
  title: string
  duration: number
  summary?: string
  type: string
  date: string
}

interface UserReport {
  id: string
  title: string
  type: 'appointment' | 'lab_result' | 'prescription' | 'diagnosis'
  content: string
  date: string
  doctor_name?: string
  created_at: string
}



type ActiveView = 'dashboard' | 'caregivers' | 'reports' | 'recordings' | 'patients' | 'care-reminders' | 'settings' | 'profile'

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  
  
  // Recordings state (for timeline)
  const [recordings, setRecordings] = useState<any[]>([])
  
  // Transcripts state
  const [transcripts, setTranscripts] = useState<any[]>([])
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null)
  const [structuredView, setStructuredView] = useState<boolean>(true)
  
  // Medical reports state (for MedicalReportsView component)
  const [medicalReports, setMedicalReports] = useState<any[]>([])
  
  // Caregivers state
  const [caregivers, setCaregivers] = useState<any[]>([])
  
  // Rename states
  const [renamingRecording, setRenamingRecording] = useState<string | null>(null)
  const [renamingTranscript, setRenamingTranscript] = useState<string | null>(null)
  const [newName, setNewName] = useState<string>('')
  
  // Reports state
  const [reports, setReports] = useState<UserReport[]>([])
  const [activeTab, setActiveTab] = useState<'timeline' | 'transcripts' | 'medical-reports'>('medical-reports')
  
  // Notification state
  const [notification, setNotification] = useState<{
    message: string
    type: 'error' | 'warning' | 'success'
    isVisible: boolean
  } | null>(null)
  
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        setUserId(user.id)

        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, user_type')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile(data)
        } else {
          setProfile({
            full_name: user.email || 'User',
            user_type: 'patient'
          })
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [supabase, router])

  const handleViewChange = (view: string) => {
    setActiveView(view as ActiveView)
  }


  // Fetch recordings for timeline
  const fetchRecordings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('recordings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          // Handle case where recordings table doesn't exist
          if (error.code === 'PGRST116' || error.message?.includes('relation "recordings" does not exist')) {
            console.warn('Recordings table not found. Please run the database setup.')
            setRecordings([])
            return
          }
          throw error
        }
        setRecordings(data || [])
      }
    } catch (error) {
      console.error('Error fetching recordings:', error)
      setRecordings([]) // Set empty array on error
    }
  }, [supabase])

  const fetchReports = useCallback(async () => {
    try {
      // For now, this function returns empty reports as we don't have a separate user_reports table
      // This is for user-uploaded medical documents (different from AI-generated medical reports)
      console.log('📋 [UI] Setting empty reports (user-uploaded medical documents)')
      setReports([])
    } catch (error) {
      console.error('Error fetching reports:', (error as Error).message || error)
      setReports([]) // Set empty array on error
    }
  }, [supabase])

  const fetchTranscripts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('transcripts')
          .select(`
            id,
            recording_id,
            user_id,
            status,
            transcription_text,
            structured_transcript,
            summary,
            error_message,
            retry_count,
            created_at,
            updated_at,
            recordings (
              id,
              title,
              duration,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          // Handle case where transcripts table doesn't exist
          if (error.code === 'PGRST116' || error.message?.includes('relation "transcripts" does not exist')) {
            console.warn('Transcripts table not found. Please run the database setup.')
            setTranscripts([])
            return
          }
          throw error
        }
        
        console.log(`📊 [UI] Fetched ${data?.length || 0} transcripts`)
        if (data && data.length > 0) {
          console.log('🔍 [UI] Transcript data preview:', data.map(t => ({
            id: t.id,
            status: t.status,
            hasRawTranscript: !!t.transcription_text,
            hasStructuredTranscript: !!t.structured_transcript,
            rawLength: t.transcription_text?.length || 0,
            structuredLength: t.structured_transcript?.length || 0
          })))
        }
        
        setTranscripts(data || [])
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error)
      setTranscripts([]) // Set empty array on error
    }
  }, [supabase])

  // Fetch medical reports function (for MedicalReportsView component)
  const fetchMedicalReports = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('medical_reports')
          .select(`
            id,
            transcript_id,
            recording_id,
            user_id,
            patient_demographics,
            chief_complaint,
            hpi_details,
            medical_history,
            soap_note,
            red_flags,
            patient_summary,
            status,
            error_message,
            shared_caregivers,
            created_at,
            updated_at,
            recordings (
              id,
              title,
              duration,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          // Handle case where medical_reports table doesn't exist
          if (error.code === 'PGRST116' || error.message?.includes('relation "medical_reports" does not exist')) {
            console.warn('Medical reports table not found. Please run the database setup.')
            setMedicalReports([])
            return
          }
          throw error
        }
        
        setMedicalReports(data || [])
      }
    } catch (error) {
      console.error('Error fetching medical reports:', (error as Error).message || error, error)
      setMedicalReports([]) // Set empty array on error
    }
  }, [supabase])

  // Fetch caregivers function
  const fetchCaregivers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch caregivers from caregiver_relationships table
        const { data, error } = await supabase
          .from('caregiver_relationships')
          .select('id, caregiver_email, caregiver_name, relationship, status, permissions')
          .eq('patient_id', user.id)
          .in('status', ['accepted', 'pending']) // Include both accepted and pending for sharing options
          .order('caregiver_name', { ascending: true })

        if (error) {
          // Handle case where caregiver_relationships table doesn't exist
          if (error.code === 'PGRST116' || error.message?.includes('relation "caregiver_relationships" does not exist')) {
            console.warn('Caregiver relationships table not found. Please run the database setup.')
            // Set mock data for demonstration only
            setCaregivers([
              {
                id: 'mock-1',
                full_name: 'Dr. Sarah Johnson',
                email: 'dr.johnson@hospital.com',
                specialty: 'Primary Care Physician',
                status: 'accepted'
              },
              {
                id: 'mock-2', 
                full_name: 'John Smith',
                email: 'john.smith@family.com',
                specialty: 'Family Member',
                status: 'accepted'
              },
              {
                id: 'mock-3',
                full_name: 'Dr. Emily Davis',
                email: 'emily.davis@cardio.com', 
                specialty: 'Cardiologist',
                status: 'pending'
              }
            ])
            return
          }
          throw error
        }
        
        // Transform the data to match the expected format
        const transformedCaregivers = data?.map(caregiver => ({
          id: caregiver.id,
          full_name: caregiver.caregiver_name,
          email: caregiver.caregiver_email,
          specialty: caregiver.relationship,
          status: caregiver.status,
          permissions: caregiver.permissions || []
        })) || []
        
        console.log(`👥 [UI] Fetched ${transformedCaregivers.length} caregivers from relationships table`)
        if (transformedCaregivers.length > 0) {
          console.log('🔍 [UI] Caregiver data preview:', transformedCaregivers.map(c => ({
            name: c.full_name,
            email: c.email,
            relationship: c.specialty,
            status: c.status
          })))
        }
        
        setCaregivers(transformedCaregivers)
      }
    } catch (error) {
      console.error('Error fetching caregivers:', (error as Error).message || error)
      setCaregivers([]) // Set empty array on error
    }
  }, [supabase])

  // Retry transcription function
  const retryTranscription = async (transcriptId: string) => {
    try {
      const response = await fetch('/api/retry-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcriptId })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Retry failed')
      }

      showNotification('Transcription retry started', 'success')
      await fetchTranscripts() // Refresh transcripts list
    } catch (error) {
      console.error('Error retrying transcription:', error)
      showNotification(error instanceof Error ? error.message : 'Retry failed', 'error')
    }
  }

  // Delete transcript function
  const deleteTranscript = async (transcriptId: string, transcriptTitle: string) => {
    if (!confirm(`Are you sure you want to delete the transcript for "${transcriptTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/delete-transcript', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcriptId })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Delete failed')
      }

      showNotification('Transcript deleted successfully', 'success')
      await fetchTranscripts() // Refresh transcripts list
      
      // Close expanded view if the deleted transcript was open
      if (expandedTranscript === transcriptId) {
        setExpandedTranscript(null)
      }
    } catch (error) {
      console.error('Error deleting transcript:', error)
      showNotification(error instanceof Error ? error.message : 'Delete failed', 'error')
    }
  }

  // Clean text content for PDF generation
  const cleanTextForPDF = (text: string): string => {
    if (!text) return ''
    
    return text
      // Remove HTML tags
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      // Remove HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Remove weird characters and artifacts
      .replace(/\[Pasted text #\d+[^\]]*\]/gi, '') // Remove "[Pasted text #1 +20 lines" type artifacts
      .replace(/\+\d+\s*lines/gi, '') // Remove "+20 lines" type artifacts
      .replace(/\[.*?\]/g, '') // Remove any other bracketed artifacts
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .replace(/\u2018|\u2019/g, "'") // Replace smart quotes with regular quotes
      .replace(/\u201C|\u201D/g, '"') // Replace smart double quotes
      .replace(/\u2013|\u2014/g, '-') // Replace em/en dashes with regular dash
      .replace(/\u2026/g, '...') // Replace ellipsis character
      // Clean up multiple spaces and newlines
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim()
  }

  // Download transcript as PDF function
  const downloadTranscript = (transcript: any) => {
    const content = structuredView && transcript.structured_transcript 
      ? transcript.structured_transcript 
      : transcript.transcription_text || ''
    
    // Create new PDF document
    const pdf = new jsPDF()
    
    // Set document properties
    const title = transcript.recordings?.title || 'Recording Transcript'
    const date = new Date(transcript.created_at).toLocaleDateString()
    
    // Add title
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(cleanTextForPDF(title), 20, 20)
    
    // Add date
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Date: ${date}`, 20, 30)
    
    // Add transcript type
    const transcriptType = structuredView && transcript.structured_transcript ? 'Structured Transcript' : 'Raw Transcript'
    pdf.text(`Type: ${transcriptType}`, 20, 40)
    
    // Add separator line
    pdf.line(20, 45, 190, 45)
    
    // Clean and process content for PDF
    const cleanContent = cleanTextForPDF(content)
    
    // Split content into lines and add to PDF
    pdf.setFontSize(10)
    const splitText = pdf.splitTextToSize(cleanContent, 170) // 170 is the max width
    
    let yPosition = 55
    const pageHeight = pdf.internal.pageSize.height
    const lineHeight = 6
    
    for (let i = 0; i < splitText.length; i++) {
      // Check if we need a new page
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        yPosition = 20
      }
      
      pdf.text(splitText[i], 20, yPosition)
      yPosition += lineHeight
    }
    
    // Save the PDF
    const fileName = `transcript-${cleanTextForPDF(transcript.recordings?.title || 'recording').replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)
  }

  // Toggle transcript expansion
  const toggleTranscript = (transcriptId: string) => {
    setExpandedTranscript(expandedTranscript === transcriptId ? null : transcriptId)
  }

  // Rename recording function
  const startRenamingRecording = (recordingId: string, currentTitle: string) => {
    setRenamingRecording(recordingId)
    setNewName(currentTitle)
  }

  const saveRecordingName = async (recordingId: string) => {
    if (!newName.trim()) {
      showNotification('Recording name cannot be empty', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('recordings')
        .update({ title: newName.trim() })
        .eq('id', recordingId)

      if (error) {
        throw error
      }

      showNotification('Recording renamed successfully', 'success')
      setRenamingRecording(null)
      setNewName('')
      await fetchRecordings()
    } catch (error) {
      console.error('Error renaming recording:', error)
      showNotification('Failed to rename recording', 'error')
    }
  }

  const cancelRenamingRecording = () => {
    setRenamingRecording(null)
    setNewName('')
  }

  // Rename transcript function
  const startRenamingTranscript = (transcriptId: string, currentTitle: string) => {
    setRenamingTranscript(transcriptId)
    setNewName(currentTitle)
  }

  const saveTranscriptName = async (transcriptId: string) => {
    if (!newName.trim()) {
      showNotification('Transcript name cannot be empty', 'error')
      return
    }

    try {
      // Update the recording title through the transcript's recording_id
      const transcript = transcripts.find(t => t.id === transcriptId)
      if (!transcript?.recording_id) {
        throw new Error('Recording not found')
      }

      const { error } = await supabase
        .from('recordings')
        .update({ title: newName.trim() })
        .eq('id', transcript.recording_id)

      if (error) {
        throw error
      }

      showNotification('Transcript renamed successfully', 'success')
      setRenamingTranscript(null)
      setNewName('')
      await fetchTranscripts()
      await fetchRecordings() // Also refresh recordings since we updated the recording title
    } catch (error) {
      console.error('Error renaming transcript:', error)
      showNotification('Failed to rename transcript', 'error')
    }
  }

  const cancelRenamingTranscript = () => {
    setRenamingTranscript(null)
    setNewName('')
  }









  // Notification function
  const showNotification = (message: string, type: 'error' | 'warning' | 'success') => {
    setNotification({ message, type, isVisible: true })
  }

  // Callback functions for RecordingsTimelineView component
  const onTranscriptRetry = async (transcriptId: string) => {
    await retryTranscription(transcriptId)
  }

  const onTranscriptRename = async (transcriptId: string, newName: string) => {
    if (!newName.trim()) {
      showNotification('Transcript name cannot be empty', 'error')
      return
    }

    try {
      // Update the recording title through the transcript's recording_id
      const transcript = transcripts.find(t => t.id === transcriptId)
      if (!transcript?.recording_id) {
        throw new Error('Recording not found')
      }

      const { error } = await supabase
        .from('recordings')
        .update({ title: newName.trim() })
        .eq('id', transcript.recording_id)

      if (error) {
        throw error
      }

      showNotification('Transcript renamed successfully', 'success')
      await fetchTranscripts()
      await fetchRecordings() // Also refresh recordings since we updated the recording title
    } catch (error) {
      console.error('Error renaming transcript:', error)
      showNotification('Failed to rename transcript', 'error')
    }
  }

  const onTranscriptDelete = async (transcriptId: string, title: string) => {
    await deleteTranscript(transcriptId, title)
  }

  // Callback for when medical reports are updated
  const handleReportsUpdate = useCallback(() => {
    // Refresh related data when reports are updated
    fetchRecordings()
    fetchTranscripts()
    fetchMedicalReports()
    fetchCaregivers()
  }, [fetchRecordings, fetchTranscripts, fetchMedicalReports, fetchCaregivers])

  // Fetch data when view changes
  useEffect(() => {
    if (activeView === 'reports') {
      fetchRecordings() // Fetch recordings for timeline
      fetchReports()
      fetchTranscripts() // Fetch transcripts
      fetchMedicalReports() // Fetch medical reports
      fetchCaregivers() // Fetch caregivers for sharing
    }
  }, [activeView, fetchRecordings, fetchReports, fetchTranscripts, fetchMedicalReports, fetchCaregivers])

  // Periodic refresh for transcripts in progress
  useEffect(() => {
    if (activeView === 'reports' && activeTab === 'transcripts') {
      const refreshInterval = setInterval(() => {
        console.log('🔄 [UI] Refreshing transcripts for updates...')
        fetchTranscripts()
      }, 2000) // Check every 2 seconds for transcript updates (faster for structured transcript updates)
      
      return () => clearInterval(refreshInterval)
    }
  }, [activeView, activeTab, fetchTranscripts])

  // Periodic refresh for medical reports in progress
  useEffect(() => {
    if (activeView === 'reports' && activeTab === 'medical-reports') {
      const refreshInterval = setInterval(() => {
        console.log('🏥 [UI] Refreshing medical reports for updates...')
        fetchMedicalReports()
      }, 2000) // Check every 2 seconds for medical report updates
      
      return () => clearInterval(refreshInterval)
    }
  }, [activeView, activeTab, fetchMedicalReports])

  // Additional refresh when transcripts list changes (to catch structured transcript updates)
  useEffect(() => {
    if (transcripts.length > 0) {
      const hasIncompleteStructuring = transcripts.some(t => 
        t.status === 'completed' && 
        t.transcription_text && 
        !t.structured_transcript
      )
      
      if (hasIncompleteStructuring) {
        console.log('🔍 [UI] Found transcripts missing structured version, will refresh more frequently')
        const quickRefreshInterval = setInterval(() => {
          console.log('⚡ [UI] Quick refresh for structured transcript updates...')
          fetchTranscripts()
        }, 1500) // More frequent refresh when waiting for structured transcripts
        
        // Clear after 2 minutes to avoid infinite polling
        setTimeout(() => clearInterval(quickRefreshInterval), 120000)
        
        return () => clearInterval(quickRefreshInterval)
      }
    }
  }, [transcripts, fetchTranscripts])


  // Utility functions
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

  const renderMainContent = () => {
    switch (activeView) {
      case 'caregivers':
        return <CaregiversPage />
      case 'recordings':
        return <VoiceRecorderView userId={userId} />
      case 'reports':
        return (
          <>
            {activeTab === 'medical-reports' && (
              <div className="p-8 bg-gray-50 min-h-screen">
                <div className="max-w-6xl mx-auto">
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Medical History</h1>
                    <p className="text-gray-600">
                      View your recorded appointments, medical reports, and health timeline
                    </p>
                  </div>
                  <div className="mb-8">
                    <nav className="flex space-x-8">
                      {[
                        { id: 'medical-reports', label: 'Medical Reports', icon: '🏥' },
                        { id: 'transcripts', label: 'Transcripts', icon: '📝' },
                        { id: 'timeline', label: 'Timeline', icon: '📅' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as 'timeline' | 'transcripts' | 'medical-reports')}
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
                  <MedicalReportsView
                    medicalReports={medicalReports}
                    caregivers={caregivers}
                    userId={userId}
                    onReportsUpdate={handleReportsUpdate}
                    showNotification={showNotification}
                  />
                </div>
              </div>
            )}
            {(activeTab === 'transcripts' || activeTab === 'timeline') && (
              <RecordingsTimelineView
                recordings={recordings}
                reports={reports}
                transcripts={transcripts}
                activeTab={activeTab}
                structuredView={structuredView}
                expandedTranscript={expandedTranscript}
                onTabChange={setActiveTab}
                onStructuredViewChange={setStructuredView}
                onTranscriptToggle={toggleTranscript}
                onTranscriptRetry={onTranscriptRetry}
                onTranscriptRename={onTranscriptRename}
                onTranscriptDelete={onTranscriptDelete}
                showNotification={showNotification}
              />
            )}
          </>
        )
      case 'patients':
        return <PatientsView />
      case 'care-reminders':
        return <CareRemindersView />
      case 'settings':
        return <SettingsView />
      case 'profile':
        return <SettingsView />
      default:
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Dashboard
                </h1>
                <p className="text-gray-600">
                  Welcome back to your Medical Companion dashboard
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                  onClick={() => setActiveView('recordings')}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">🎙️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Recordings</h3>
                      <p className="text-gray-600">View & manage</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('reports')}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
                      <p className="text-gray-600">Medical history</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView(profile?.user_type === 'patient' ? 'caregivers' : 'patients')}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">👥</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {profile?.user_type === 'patient' ? 'Caregivers' : 'Patients'}
                      </h3>
                      <p className="text-gray-600">Manage access</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Voice Recorder - Can be shown for all users for now */}
              <div className="mb-8">
                <VoiceRecorderView userId={userId} />
              </div>

              {/* Recent Activity */}
              <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Recent Medical Activity
                </h2>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Your Medical Dashboard
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Record your doctor visits, manage caregivers, and track your medical history using the sidebar navigation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed and persistent */}
      <Sidebar 
        userType={profile.user_type} 
        userName={profile.full_name}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area - Only this changes */}
      <main className="flex-1 ml-64 min-h-screen">
        {renderMainContent()}
      </main>


      {/* Apple Error Notification */}
      {notification && (
        <AppleErrorNotification 
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(null)}
          duration={5000}
        />
      )}

    </div>
  )
}