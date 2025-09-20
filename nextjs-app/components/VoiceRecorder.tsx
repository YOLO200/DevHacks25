'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Recording {
  id: string
  title: string
  file_path: string
  duration: number
  transcription?: string
  summary?: string
  created_at: string
}

interface VoiceRecorderProps {
  userId: string
}

export default function VoiceRecorder({ userId }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      setRecordingTime(0)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording])

  const fetchRecordings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecordings(data || [])
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      if (err?.code === 'PGRST116' || err?.message?.includes('relation "recordings" does not exist')) {
        console.warn('Recordings table not found. Please run the database setup.')
      } else {
        console.error('Error fetching recordings:', error)
      }
    }
  }, [supabase, userId])

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
    }
  }

  const uploadRecording = async (audioBlob: Blob) => {
    setIsUploading(true)
    try {
      const fileName = `recording-${Date.now()}.wav`
      const filePath = `${userId}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, audioBlob)

      if (uploadError) throw uploadError

      // Save recording metadata to database
      const { error: dbError } = await supabase
        .from('recordings')
        .insert([
          {
            user_id: userId,
            title: `Doctor Visit - ${new Date().toLocaleDateString()}`,
            file_path: filePath,
            duration: recordingTime,
            created_at: new Date().toISOString()
          }
        ])

      if (dbError) throw dbError

      await fetchRecordings()
    } catch (error) {
      console.error('Error uploading recording:', error)
      alert('Failed to save recording. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const playRecording = async (filePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('recordings')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (data?.signedUrl) {
        const audio = new Audio(data.signedUrl)
        audio.play()
      }
    } catch (error) {
      console.error('Error playing recording:', error)
    }
  }

  const deleteRecording = async (id: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage
        .from('recordings')
        .remove([filePath])

      // Delete from database
      await supabase
        .from('recordings')
        .delete()
        .eq('id', id)

      await fetchRecordings()
    } catch (error) {
      console.error('Error deleting recording:', error)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl mr-4">
            🎙️
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Doctor Visit Recorder</h3>
            <p className="text-gray-600 text-sm">Record and store your medical appointments</p>
          </div>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex flex-col items-center mb-6">
        {isRecording && (
          <div className="text-center mb-4">
            <div className="text-3xl font-mono text-red-600 mb-2">
              {formatTime(recordingTime)}
            </div>
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-red-600 font-medium">Recording in progress...</span>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isUploading}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center px-6 py-3 bg-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Stop Recording
            </button>
          )}
        </div>

        {isUploading && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Saving your recording...</p>
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
                    🎵
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">{recording.title}</h5>
                    <p className="text-sm text-gray-600">
                      {new Date(recording.created_at).toLocaleDateString()} • {formatTime(recording.duration)}
                    </p>
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
                    onClick={() => deleteRecording(recording.id, recording.file_path)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete recording"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L7.586 12l-1.293 1.293a1 1 0 101.414 1.414L9 13.414l2.293 2.293a1 1 0 001.414-1.414L11.414 12l1.293-1.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}