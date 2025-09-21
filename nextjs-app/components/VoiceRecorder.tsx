'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Recording {
  id: string
  title: string
  file_path: string
  duration: number
  status: 'uploading' | 'converting' | 'ready' | 'failed'
  transcription?: string
  summary?: string
  created_at: string
}

interface VoiceRecorderProps {
  userId: string
  autoStart?: boolean
}

export default function VoiceRecorder({ userId, autoStart = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [renamingRecording, setRenamingRecording] = useState<string | null>(null)
  const [newName, setNewName] = useState<string>('')
  
  // Audio playback state
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused])

  const fetchRecordings = useCallback(async () => {
    // Don't fetch if userId is not available yet
    if (!userId) {
      console.log('⏳ [FETCH] UserId not available yet, skipping fetch')
      return
    }

    console.log('📊 [FETCH] Fetching recordings for user:', userId)
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ [FETCH] Database error:', error)
        throw error
      }
      
      console.log('✅ [FETCH] Found recordings:', data?.length || 0)
      setRecordings(data || [])
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      if (err?.code === 'PGRST116' || err?.message?.includes('relation "recordings" does not exist')) {
        console.warn('⚠️ [FETCH] Recordings table not found. Please run the database setup.')
      } else {
        console.error('💥 [FETCH] Error fetching recordings:', error)
      }
    }
  }, [supabase, userId])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [currentAudio])

  // Periodic refresh for recordings in progress
  useEffect(() => {
    // Always refresh periodically when component is mounted
    // The fetchRecordings function will handle checking what's actually in progress
    const refreshInterval = setInterval(() => {
      fetchRecordings()
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(refreshInterval)
  }, [fetchRecordings]) // Only depend on fetchRecordings

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        await uploadRecording(audioBlob)

        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Unable to access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      setRecordingTime(0)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }

  const uploadRecording = async (audioBlob: Blob, fileName?: string, customTitle?: string) => {
    setIsUploading(true)
    setUploadProgress(0)
    try {
      const finalFileName = fileName || `recording-${Date.now()}.wav`
      const formData = new FormData()
      
      // Convert blob to file
      const file = new File([audioBlob], finalFileName, { type: audioBlob.type })
      formData.append('file', file)
      formData.append('title', customTitle || `Doctor Visit - ${new Date().toLocaleDateString()}`)

      // Call conversion API
      const response = await fetch('/api/convert-audio', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadProgress(100)
      await fetchRecordings()
    } catch (error) {
      console.error('Error uploading recording:', error)
      alert('Failed to save recording. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const playRecording = async (filePath: string, recordingId: string) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setIsPlaying(false)
        setPlayingRecordingId(null)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }

      const { data } = await supabase.storage
        .from("doctor's note")
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (data?.signedUrl) {
        const audio = new Audio(data.signedUrl)
        
        // Set up audio event listeners
        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration)
        })
        
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime)
          setPlaybackProgress((audio.currentTime / audio.duration) * 100)
        })
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false)
          setPlayingRecordingId(null)
          setCurrentTime(0)
          setPlaybackProgress(0)
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
          }
        })
        
        audio.addEventListener('error', (e) => {
          console.error('Audio playback error:', e)
          setIsPlaying(false)
          setPlayingRecordingId(null)
        })
        
        setCurrentAudio(audio)
        setPlayingRecordingId(recordingId)
        setIsPlaying(true)
        await audio.play()
      }
    } catch (error) {
      console.error('Error playing recording:', error)
      setIsPlaying(false)
      setPlayingRecordingId(null)
    }
  }

  const pausePlayback = () => {
    if (currentAudio && isPlaying) {
      currentAudio.pause()
      setIsPlaying(false)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }

  const resumePlayback = () => {
    if (currentAudio && !isPlaying) {
      currentAudio.play()
      setIsPlaying(true)
    }
  }

  const stopPlayback = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setIsPlaying(false)
      setPlayingRecordingId(null)
      setCurrentTime(0)
      setPlaybackProgress(0)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }

  const seekTo = (time: number) => {
    if (currentAudio) {
      currentAudio.currentTime = time
      setCurrentTime(time)
      setPlaybackProgress((time / duration) * 100)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a']
    const allowedExtensions = ['.mp3', '.wav', '.m4a']
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('Please select a valid audio file (MP3, WAV, or M4A)')
      return
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB')
      return
    }

    const fileName = `uploaded-${Date.now()}-${file.name}`
    const customTitle = `Uploaded Audio - ${file.name}`
    
    await uploadRecording(file, fileName, customTitle)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const deleteRecording = async (id: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return
    
    try {
      // Delete from storage
      await supabase.storage
        .from("doctor's note")
        .remove([filePath])

      // Delete from database
      await supabase
        .from('recordings')
        .delete()
        .eq('id', id)

      await fetchRecordings()
    } catch (error) {
      console.error('Error deleting recording:', error)
      alert('Failed to delete recording. Please try again.')
    }
  }

  const startRenaming = (recordingId: string, currentTitle: string) => {
    setRenamingRecording(recordingId)
    setNewName(currentTitle)
  }

  const saveRecordingName = async (recordingId: string) => {
    if (!newName.trim()) return
    
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ title: newName.trim() })
        .eq('id', recordingId)
        .eq('user_id', userId)

      if (error) throw error

      setRenamingRecording(null)
      setNewName('')
      await fetchRecordings()
    } catch (error) {
      console.error('Error renaming recording:', error)
      alert('Failed to rename recording. Please try again.')
    }
  }

  const cancelRenaming = () => {
    setRenamingRecording(null)
    setNewName('')
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Doctor Visit Recorder
          </h1>
          <p className="text-gray-600">
            Record and store your medical appointments
          </p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">

      {/* Recording Controls */}
      <div className="flex flex-col items-center mb-6">
        {isRecording && (
          <div className="text-center mb-4">
            <div className={`text-3xl font-mono mb-2 ${isPaused ? 'text-orange-600' : 'text-red-600'}`}>
              {formatTime(recordingTime)}
            </div>
            <div className="flex items-center justify-center">
              {isPaused ? (
                <>
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                  <span className="text-orange-600 font-medium">Recording paused</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                  <span className="text-red-600 font-medium">Recording in progress...</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          {!isRecording ? (
            <>
              <button
                onClick={startRecording}
                disabled={isUploading}
                className="flex items-center justify-center px-8 py-4 bg-white/30 backdrop-blur-lg rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 border border-blue-300/50 text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                Start Recording
              </button>
              
              <button
                onClick={triggerFileUpload}
                disabled={isUploading}
                className="flex items-center justify-center px-8 py-4 bg-white/30 backdrop-blur-lg rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 border border-green-300/50 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Upload Audio File
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/m4a"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          ) : (
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Pause/Resume Button */}
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className={`flex items-center justify-center px-8 py-4 bg-white/30 backdrop-blur-lg rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                  isPaused 
                    ? 'border border-green-300/50 text-green-700' 
                    : 'border border-orange-300/50 text-orange-700'
                }`}
              >
                {isPaused ? (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Resume
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Pause
                  </>
                )}
              </button>

              {/* Stop Button */}
              <button
                onClick={stopRecording}
                className="flex items-center justify-center px-8 py-4 bg-white/30 backdrop-blur-lg rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 border border-red-300/50 text-red-700"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop Recording
              </button>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4 text-center w-full max-w-xs">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm mb-2">Saving your recording...</p>
            {uploadProgress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        )}
        
        {/* File Upload Instructions */}
        {!isRecording && (
          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Record live audio or upload MP3, WAV, M4A files (max 50MB)
            </p>
          </div>
        )}
      </div>

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Your Recordings</h4>
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div key={recording.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      {recording.title.includes('Uploaded') ? '📁' : '🎵'}
                    </div>
                    <div className="flex-1">
                      {renamingRecording === recording.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRecordingName(recording.id)
                              if (e.key === 'Escape') cancelRenaming()
                            }}
                            autoFocus
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveRecordingName(recording.id)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelRenaming}
                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h5 className="font-medium text-gray-900">{recording.title}</h5>
                          <p className="text-sm text-gray-600">
                            {new Date(recording.created_at).toLocaleDateString()} • {formatTime(recording.duration)}
                            {recording.status !== 'ready' && (
                              <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                                recording.status === 'uploading' ? 'bg-blue-100 text-blue-800' :
                                recording.status === 'converting' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {recording.status === 'uploading' && 'Uploading...'}
                                {recording.status === 'converting' && 'Converting...'}
                                {recording.status === 'failed' && 'Failed'}
                              </span>
                            )}
                            {recording.status === 'ready' && recording.title.includes('Uploaded') && (
                              <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                                Uploaded File
                              </span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    {/* Audio Player Controls */}
                    {recording.status === 'ready' && (
                      <div className="flex items-center space-x-2 mb-2">
                        {playingRecordingId === recording.id ? (
                          <>
                            <button
                              onClick={isPlaying ? pausePlayback : resumePlayback}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title={isPlaying ? 'Pause' : 'Resume'}
                            >
                              {isPlaying ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={stopPlayback}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Stop"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <span className="text-sm text-gray-600">
                              {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}
                            </span>
                          </>
                        ) : (
                          <button
                            onClick={() => playRecording(recording.file_path, recording.id)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Play"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Progress Bar for Currently Playing Recording */}
                    {playingRecordingId === recording.id && (
                      <div className="w-full mb-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-100" 
                            style={{ width: `${playbackProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startRenaming(recording.id, recording.title)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteRecording(recording.id, recording.file_path)}
                        className="px-3 py-1 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}