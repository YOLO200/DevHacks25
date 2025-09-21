'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Recording {
  id: string
  title: string
  duration: number
  summary?: string
  type: string
  date: string
  created_at: string
}

interface UserReport {
  id: string
  title: string
  type: 'appointment' | 'lab_result' | 'prescription' | 'diagnosis'
  content: string
  date: string
  created_at: string
}

interface Transcript {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transcription_text?: string
  structured_transcript?: string
  summary?: string
  error_message?: string
  retry_count: number
  recordings?: {
    title: string
    created_at: string
    duration: number
  }
  created_at: string
}

interface RecordingsTimelineViewProps {
  recordings: Recording[]
  reports: UserReport[]
  transcripts: Transcript[]
  activeTab: 'timeline' | 'transcripts' | 'medical-reports'
  structuredView: boolean
  expandedTranscript: string | null
  onTabChange: (tab: 'timeline' | 'transcripts' | 'medical-reports') => void
  onStructuredViewChange: (structured: boolean) => void
  onTranscriptToggle: (transcriptId: string) => void
  onTranscriptRetry: (transcriptId: string) => void
  onTranscriptRename: (transcriptId: string, newName: string) => void
  onTranscriptDelete: (transcriptId: string, title: string) => void
  showNotification: (message: string, type: 'error' | 'warning' | 'success') => void
}

export default function RecordingsTimelineView({
  recordings,
  reports,
  transcripts,
  activeTab,
  structuredView,
  expandedTranscript,
  onTabChange,
  onStructuredViewChange,
  onTranscriptToggle,
  onTranscriptRetry,
  onTranscriptRename,
  onTranscriptDelete,
  showNotification
}: RecordingsTimelineViewProps) {
  const [renamingTranscript, setRenamingTranscript] = useState<string | null>(null)
  const [newName, setNewName] = useState<string>('')

  const supabase = createClient()

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
      const transcript = transcripts.find(t => t.id === transcriptId)
      if (!transcript?.recordings) {
        throw new Error('Recording not found')
      }

      await onTranscriptRename(transcriptId, newName.trim())
      setRenamingTranscript(null)
      setNewName('')
    } catch (error) {
      console.error('Error renaming transcript:', error)
      showNotification('Failed to rename transcript', 'error')
    }
  }

  const cancelRenamingTranscript = () => {
    setRenamingTranscript(null)
    setNewName('')
  }

  const retryTranscription = (transcriptId: string) => {
    onTranscriptRetry(transcriptId)
  }

  const deleteTranscript = (transcriptId: string, title: string) => {
    onTranscriptDelete(transcriptId, title)
  }

  const toggleTranscript = (transcriptId: string) => {
    onTranscriptToggle(transcriptId)
  }

  return (
    <div>

        {/* Transcripts Tab */}
        {activeTab === 'transcripts' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Transcripts</h3>
              <p className="text-gray-600 mt-1">Audio transcriptions from your voice recordings</p>
            </div>

            {transcripts.length === 0 ? (
              <div className="p-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl">📝</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No transcripts yet</h3>
                  <p className="text-gray-600 mb-6">Your voice recording transcripts will appear here after processing.</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {transcripts.map((transcript) => (
                    <div key={transcript.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {/* Collapsed View */}
                      <div className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleTranscript(transcript.id)}>
                        {/* Left Action Buttons - Only Retry */}
                        <div className="flex flex-col space-y-1 p-2">
                          {/* Retry Button - Only show for failed transcripts */}
                          {transcript.status === 'failed' && transcript.retry_count < 3 && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                retryTranscription(transcript.id)
                              }}
                              className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                              title="Retry Transcription"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">🎙️</span>
                              </div>
                              <div className="flex-1">
                                {renamingTranscript === transcript.id ? (
                                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={newName}
                                      onChange={(e) => setNewName(e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveTranscriptName(transcript.id)
                                        if (e.key === 'Escape') cancelRenamingTranscript()
                                      }}
                                      autoFocus
                                    />
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => saveTranscriptName(transcript.id)}
                                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelRenamingTranscript}
                                        className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <h4 className="font-medium text-gray-900">{transcript.recordings?.title}</h4>
                                )}
                                <p className="text-sm text-gray-500">
                                  {new Date(transcript.recordings?.created_at || transcript.created_at).toLocaleDateString('en-US', { 
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })} • {transcript.recordings?.duration ? Math.floor(transcript.recordings.duration / 60) : 0}:{transcript.recordings?.duration ? (transcript.recordings.duration % 60).toString().padStart(2, '0') : '00'}
                                </p>
                                <div className="flex items-center mt-1">
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                    transcript.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    transcript.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    transcript.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {transcript.status === 'completed' && '✅ Completed'}
                                    {transcript.status === 'processing' && '⏳ Processing...'}
                                    {transcript.status === 'failed' && '❌ Failed'}
                                    {transcript.status === 'pending' && '⏸️ Pending'}
                                  </span>
                                  {transcript.retry_count > 0 && (
                                    <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                      Retry #{transcript.retry_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Action Buttons - Rename and Delete */}
                        <div className="flex items-center space-x-1 p-2">
                          {/* Rename Button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              startRenamingTranscript(transcript.id, transcript.recordings?.title || 'Recording')
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Rename Transcript"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          
                          {/* Delete Button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTranscript(transcript.id, transcript.recordings?.title || 'Recording')
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete Transcript"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded View */}
                      {expandedTranscript === transcript.id && (
                        <div className="border-t border-gray-200">
                          {transcript.status === 'completed' && transcript.transcription_text && (
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h5 className="font-semibold text-gray-900">Transcription</h5>
                                <div className="flex items-center space-x-2">
                                  <label className="flex items-center space-x-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={structuredView}
                                      onChange={(e) => onStructuredViewChange(e.target.checked)}
                                      className="rounded"
                                    />
                                    <span>Structured View</span>
                                  </label>
                                </div>
                              </div>
                              
                              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                {structuredView && transcript.structured_transcript ? (
                                  <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    {transcript.structured_transcript}
                                  </div>
                                ) : (
                                  <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    {transcript.transcription_text}
                                  </div>
                                )}
                              </div>

                              {transcript.summary && (
                                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                                  <h5 className="text-sm font-medium text-blue-700 mb-2">Summary</h5>
                                  <p className="text-blue-900 leading-relaxed">{transcript.summary}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {transcript.status === 'failed' && transcript.error_message && (
                            <div className="p-6">
                              <div className="bg-red-50 rounded-lg p-4">
                                <h5 className="text-sm font-medium text-red-700 mb-2">Error Details</h5>
                                <p className="text-red-800 text-sm">{transcript.error_message}</p>
                                {transcript.retry_count < 3 && (
                                  <p className="text-red-600 text-xs mt-2">You can retry this transcription up to 3 times.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

            {[...recordings.map(r => ({ ...r, type: 'recording', date: r.created_at })), ...reports.map(r => ({ ...r, type: 'report', date: r.date || r.created_at }))]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).length === 0 ? (
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
                  {[...recordings.map(r => ({ ...r, type: 'recording', date: r.created_at })), ...reports.map(r => ({ ...r, type: 'report', date: r.date || r.created_at }))]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item, index, arr) => (
                    <div key={`${item.type}-${item.id}`} className="flex">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.type === 'recording' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          <span className="text-lg">
                            {item.type === 'recording' ? '🎙️' : getReportTypeIcon((item as UserReport).type)}
                          </span>
                        </div>
                        {index < arr.length - 1 && (
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
                          <p className="text-gray-700">{(item as UserReport).content.substring(0, 150)}...</p>
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
  )
}