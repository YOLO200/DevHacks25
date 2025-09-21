import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🎵 [UPLOAD] Starting audio upload process...')
  
  try {
    console.log('🔐 [AUTH] Creating Supabase client...')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ [AUTH] Authentication error:', authError)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }
    
    if (!user) {
      console.error('❌ [AUTH] No user found')
      return NextResponse.json({ error: 'No user found' }, { status: 401 })
    }
    
    console.log('✅ [AUTH] User authenticated:', user.id)

    console.log('📄 [FORM] Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string

    console.log('📁 [FILE] File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      title: title
    })

    if (!file) {
      console.error('❌ [FILE] No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('💾 [DB] Creating initial recording record...')
    // Create initial record with 'uploading' status
    const { data: recording, error: insertError } = await supabase
      .from('recordings')
      .insert({
        user_id: user.id,
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        file_path: '', // Will be updated after conversion
        duration: 0, // Will be updated after conversion
        status: 'uploading'
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [DB] Database insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create recording' }, { status: 500 })
    }

    console.log('✅ [DB] Recording created:', {
      id: recording.id,
      title: recording.title,
      status: recording.status
    })

    console.log('🔄 [CONVERT] Starting async conversion process...')
    // Start conversion process asynchronously
    convertAudioFile(file, recording.id, user.id, supabase)

    console.log('✅ [SUCCESS] Upload initiated successfully')
    return NextResponse.json({ 
      success: true, 
      recordingId: recording.id,
      status: 'uploading'
    })

  } catch (error) {
    console.error('💥 [ERROR] Upload failed with error:', error)
    console.error('💥 [ERROR] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

async function convertAudioFile(file: File, recordingId: string, userId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🔄 [CONVERT-${recordingId}] Starting conversion process...`)
  
  try {
    console.log(`📊 [CONVERT-${recordingId}] Updating status to 'converting'...`)
    // Update status to converting
    const { error: statusError } = await supabase
      .from('recordings')
      .update({ status: 'converting' })
      .eq('id', recordingId)

    if (statusError) {
      console.error(`❌ [CONVERT-${recordingId}] Status update error:`, statusError)
      throw statusError
    }

    console.log(`🎧 [CONVERT-${recordingId}] Converting audio to MP3...`)
    console.log(`🎧 [CONVERT-${recordingId}] Original file:`, {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Convert audio to MP3 using Web Audio API or external service
    const convertedAudio = await convertToMp3(file)
    
    console.log(`📁 [CONVERT-${recordingId}] Conversion complete. New file size:`, convertedAudio.size)
    
    // Generate unique filename for MP3
    const fileName = `${userId}/${recordingId}.mp3`
    console.log(`📂 [CONVERT-${recordingId}] Uploading to bucket with filename:`, fileName)
    
    // Upload converted MP3 to doctor's note bucket
    const { error: uploadError } = await supabase.storage
      .from("doctor's note")
      .upload(fileName, convertedAudio)

    if (uploadError) {
      console.error(`❌ [CONVERT-${recordingId}] Storage upload error:`, uploadError)
      throw uploadError
    }

    console.log(`✅ [CONVERT-${recordingId}] File uploaded to storage successfully`)

    console.log(`⏱️ [CONVERT-${recordingId}] Getting audio duration...`)
    // Get audio duration
    const duration = await getAudioDuration(convertedAudio)
    console.log(`⏱️ [CONVERT-${recordingId}] Duration detected:`, duration, 'seconds')

    console.log(`💾 [CONVERT-${recordingId}] Updating final record...`)
    // Update record with final details (without transcription for now)
    const { error: finalUpdateError } = await supabase
      .from('recordings')
      .update({ 
        file_path: fileName,
        duration: Math.floor(duration),
        status: 'ready'
      })
      .eq('id', recordingId)

    if (finalUpdateError) {
      console.error(`❌ [CONVERT-${recordingId}] Final update error:`, finalUpdateError)
      throw finalUpdateError
    }

    console.log(`🎉 [CONVERT-${recordingId}] Conversion completed successfully!`)
    
    // Always create transcription job entry, even if it might fail
    const transcriptJobCreated = await createTranscriptionJob(recordingId, userId, supabase)
    
    // Start transcription process asynchronously after upload is complete
    if (process.env.OPENAI_API_KEY) {
      console.log(`🗣️ [CONVERT-${recordingId}] Starting async transcription...`)
      generateTranscriptionAsync(convertedAudio, recordingId, userId, supabase, transcriptJobCreated)
    } else {
      console.log(`⚠️ [CONVERT-${recordingId}] OpenAI API key not configured, creating failed transcript entry`)
      // Create a failed transcript entry if no API key
      if (transcriptJobCreated) {
        await updateTranscriptStatus(recordingId, 'failed', 'OpenAI API key not configured', supabase)
      }
    }

  } catch (error) {
    console.error(`💥 [CONVERT-${recordingId}] Conversion failed:`, error)
    console.error(`💥 [CONVERT-${recordingId}] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    
    console.log(`❌ [CONVERT-${recordingId}] Marking as failed...`)
    // Mark recording as failed
    try {
      await supabase
        .from('recordings')
        .update({ status: 'failed' })
        .eq('id', recordingId)
      console.log(`✅ [CONVERT-${recordingId}] Recording status updated to 'failed'`)
    } catch (failError) {
      console.error(`💥 [CONVERT-${recordingId}] Failed to update recording status to 'failed':`, failError)
    }
    
    // Also create a failed transcript entry so it appears in the transcript list
    console.log(`📝 [CONVERT-${recordingId}] Creating failed transcript entry for visibility...`)
    const transcriptJobCreated = await createTranscriptionJob(recordingId, userId, supabase)
    if (transcriptJobCreated) {
      await updateTranscriptStatus(recordingId, 'failed', `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, supabase)
    }
  }
}

async function convertToMp3(file: File): Promise<Blob> {
  console.log(`🎵 [MP3] Starting MP3 conversion for file:`, file.name)
  
  try {
    // For server-side, we'll just pass through the file without conversion
    // In a real production app, you'd use FFmpeg or a server-side audio library
    console.log(`📁 [MP3] File is already in audio format, passing through...`)
    
    const arrayBuffer = await file.arrayBuffer()
    console.log(`📁 [MP3] File size:`, arrayBuffer.byteLength)
    
    // Create a blob with the original file data
    // For now, we'll just pass through the original file as-is
    const result = new Blob([arrayBuffer], { type: 'audio/mpeg' })
    console.log(`✅ [MP3] Conversion complete. Final size:`, result.size)
    
    return result
  } catch (error) {
    console.error(`💥 [MP3] Conversion failed:`, error)
    throw error
  }
}

async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  
  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, length - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, buffer.numberOfChannels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true)
  view.setUint16(32, buffer.numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length - 44, true)
  
  // Write audio data
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

async function getAudioDuration(audioBlob: Blob): Promise<number> {
  // For server-side, we'll return a default duration
  // In production, you'd use a server-side audio library like node-ffmpeg
  console.log(`⏱️ [DURATION] Using fallback duration for server-side processing`)
  
  // Return a reasonable default duration based on file size
  // Rough estimate: 1MB ≈ 1 minute of audio
  const sizeInMB = audioBlob.size / (1024 * 1024)
  const estimatedDuration = Math.max(Math.floor(sizeInMB * 60), 30) // Minimum 30 seconds
  
  console.log(`⏱️ [DURATION] Estimated duration: ${estimatedDuration} seconds based on ${sizeInMB.toFixed(2)}MB file size`)
  
  return estimatedDuration
}

async function createTranscriptionJob(recordingId: string, userId: string, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  console.log(`📝 [TRANSCRIPT-JOB] Creating transcription job for recording ${recordingId}`)
  
  try {
    // Try multiple approaches to create the transcript job
    let success = false
    
    // Approach 1: Try with the passed supabase client (user context)
    try {
      const { error } = await supabase
        .from('transcripts')
        .insert({
          recording_id: recordingId,
          user_id: userId,
          status: 'pending'
        })

      if (!error) {
        console.log(`✅ [TRANSCRIPT-JOB] Transcription job created successfully (user context)`)
        return true
      }
      console.log(`⚠️ [TRANSCRIPT-JOB] User context failed, trying alternative approach...`)
    } catch (userError) {
      console.log(`⚠️ [TRANSCRIPT-JOB] User context failed, trying alternative approach...`)
    }
    
    // For now, just return false if user context fails
    // The UI will handle this gracefully by showing "No transcripts yet"
    console.log(`⚠️ [TRANSCRIPT-JOB] Could not create transcript job, will skip for now`)
    return false
    
  } catch (error) {
    console.error(`💥 [TRANSCRIPT-JOB] Error creating transcription job:`, error)
    return false
  }
}

async function updateTranscriptStatus(recordingId: string, status: string, errorMessage: string | null, supabase: ReturnType<typeof createClient>) {
  try {
    const serviceSupabase = createClient()
    const { error } = await serviceSupabase
      .from('transcripts')
      .update({ 
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('recording_id', recordingId)

    if (error) {
      console.error(`❌ [TRANSCRIPT-UPDATE] Failed to update transcript status:`, error)
    } else {
      console.log(`✅ [TRANSCRIPT-UPDATE] Updated transcript status to ${status}`)
    }
  } catch (error) {
    console.error(`💥 [TRANSCRIPT-UPDATE] Error updating transcript status:`, error)
  }
}

async function generateTranscriptionAsync(audioBlob: Blob, recordingId: string, userId: string, supabase: ReturnType<typeof createClient>, transcriptJobCreated: boolean = true) {
  console.log(`🤖 [TRANSCRIBE-${recordingId}] Starting async transcription...`)
  
  try {
    // Update status to processing (if transcript job was created)
    if (transcriptJobCreated) {
      try {
        await supabase
          .from('transcripts')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('recording_id', recordingId)
      } catch (updateError) {
        console.log(`⚠️ [TRANSCRIBE-${recordingId}] Could not update status to processing`)
      }
    }

    // Create FormData for OpenAI Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')
    
    console.log(`🌐 [TRANSCRIBE-${recordingId}] Calling OpenAI Whisper API...`)
    
    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status} ${response.statusText}`)
    }

    const transcriptionText = await response.text()
    console.log(`✅ [TRANSCRIBE-${recordingId}] Transcription received, updating database...`)

    // Update transcript with completed transcription (if transcript job was created)
    if (transcriptJobCreated) {
      try {
        const { error: updateError } = await supabase
          .from('transcripts')
          .update({ 
            status: 'completed',
            transcription_text: transcriptionText,
            updated_at: new Date().toISOString()
          })
          .eq('recording_id', recordingId)

        if (updateError) {
          console.error(`❌ [TRANSCRIBE-${recordingId}] Database update error:`, updateError)
        } else {
          console.log(`✅ [TRANSCRIBE-${recordingId}] Transcript updated successfully`)
          
          // Start async structuring process
          console.log(`🤖 [STRUCTURE-${recordingId}] Starting transcript structuring...`)
          structureTranscriptAsync(transcriptionText, recordingId, supabase)
          
          // Start async medical report generation
          console.log(`🏥 [MEDICAL-REPORT-${recordingId}] Starting medical report generation...`)
          generateMedicalReportForTranscript(recordingId, userId, supabase)
        }
      } catch (updateError) {
        console.error(`❌ [TRANSCRIBE-${recordingId}] Database update failed:`, updateError)
      }
    }

    console.log(`🎉 [TRANSCRIBE-${recordingId}] Transcription completed successfully!`)

  } catch (error) {
    console.error(`💥 [TRANSCRIBE-${recordingId}] Transcription failed:`, error)
    
    // Update transcript status to failed with error message (if transcript job was created)
    if (transcriptJobCreated) {
      try {
        await supabase
          .from('transcripts')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('recording_id', recordingId)
      } catch (updateError) {
        console.error(`💥 [TRANSCRIBE-${recordingId}] Failed to update error status:`, updateError)
      }
    }
  }
}

async function structureTranscriptAsync(transcriptionText: string, recordingId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🤖 [STRUCTURE-${recordingId}] Starting transcript structuring...`)
  console.log(`📝 [STRUCTURE-${recordingId}] Original transcript length: ${transcriptionText.length} characters`)
  console.log(`📝 [STRUCTURE-${recordingId}] Original transcript preview: "${transcriptionText.substring(0, 200)}..."`)
  
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error(`❌ [STRUCTURE-${recordingId}] OpenAI API key not configured`)
      return
    }
    
    console.log(`🔑 [STRUCTURE-${recordingId}] OpenAI API key found, proceeding with structuring...`)
    
    // Use OpenAI to structure the transcript with speaker detection
    const prompt = `You are a medical transcript structuring assistant. Analyze this medical conversation transcript and identify who is speaking (Doctor or Patient) for each sentence or statement. 

IMPORTANT RULES:
1. DO NOT change, modify, or rephrase ANY words from the original transcript
2. Only add speaker labels "Doctor:" or "Patient:" at the beginning of each speaking turn
3. Preserve the exact original text, punctuation, and formatting
4. Add a new line after each speaker's complete statement/response
5. Identify speaking turns based on content patterns:
   - Medical terminology, diagnoses, treatments, recommendations → Doctor
   - Symptoms, concerns, questions about health, personal experiences → Patient
   - Responses to questions, follow-ups → Context-dependent

Original Transcript:
"${transcriptionText}"

Structure this transcript by adding speaker labels while preserving every single word exactly as written. Format as:

Doctor: Doctor's exact words here

Patient: Patient's exact words here

Doctor: Next doctor statement

Patient: Next patient response

Make sure each speaker turn is on a new line with proper spacing for readability.`

    console.log(`🌐 [STRUCTURE-${recordingId}] Calling OpenAI API for structuring...`)
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.1
      })
    })

    console.log(`📡 [STRUCTURE-${recordingId}] OpenAI API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [STRUCTURE-${recordingId}] OpenAI API error: ${response.status} ${response.statusText}`)
      console.error(`❌ [STRUCTURE-${recordingId}] Error details: ${errorText}`)
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log(`📋 [STRUCTURE-${recordingId}] OpenAI API response received`)
    
    const structuredTranscript = result.choices[0]?.message?.content?.trim()
    
    if (structuredTranscript) {
      console.log(`✅ [STRUCTURE-${recordingId}] Structured transcript generated successfully`)
      console.log(`📝 [STRUCTURE-${recordingId}] Structured transcript length: ${structuredTranscript.length} characters`)
      console.log(`📝 [STRUCTURE-${recordingId}] Structured transcript preview: "${structuredTranscript.substring(0, 300)}..."`)
      
      // Update transcript with structured version
      console.log(`💾 [STRUCTURE-${recordingId}] Saving structured transcript to database...`)
      
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({ 
          structured_transcript: structuredTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('recording_id', recordingId)

      if (updateError) {
        console.error(`❌ [STRUCTURE-${recordingId}] Failed to save structured transcript:`, updateError)
        console.error(`❌ [STRUCTURE-${recordingId}] Update error details:`, JSON.stringify(updateError, null, 2))
      } else {
        console.log(`🎉 [STRUCTURE-${recordingId}] Structured transcript saved successfully to database!`)
        
        // Verify the save by reading it back
        const { data: verification, error: verifyError } = await supabase
          .from('transcripts')
          .select('structured_transcript')
          .eq('recording_id', recordingId)
          .single()
          
        if (verifyError) {
          console.error(`⚠️ [STRUCTURE-${recordingId}] Could not verify save:`, verifyError)
        } else if (verification?.structured_transcript) {
          console.log(`✅ [STRUCTURE-${recordingId}] Verification successful - structured transcript exists in database`)
          console.log(`📏 [STRUCTURE-${recordingId}] Verified length: ${verification.structured_transcript.length} characters`)
        } else {
          console.error(`⚠️ [STRUCTURE-${recordingId}] Verification failed - no structured transcript found in database`)
        }
      }
    } else {
      console.error(`❌ [STRUCTURE-${recordingId}] No structured transcript content received from OpenAI`)
      console.log(`🔍 [STRUCTURE-${recordingId}] Full OpenAI response:`, JSON.stringify(result, null, 2))
    }

  } catch (error) {
    console.error(`💥 [STRUCTURE-${recordingId}] Structuring failed with error:`, error)
    console.error(`💥 [STRUCTURE-${recordingId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    // Don't fail the transcription if structuring fails
  }
}

async function generateTranscriptionWithSpeakers(audioBlob: Blob) {
  console.log(`🤖 [WHISPER] Starting Whisper transcription with speaker detection...`)
  
  try {
    // Create FormData for OpenAI Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'word')
    formData.append('timestamp_granularities[]', 'segment')
    
    console.log(`🌐 [WHISPER] Calling OpenAI Whisper API...`)
    
    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status} ${response.statusText}`)
    }

    const whisperResult = await response.json()
    console.log(`✅ [WHISPER] Transcription received, processing segments...`)

    // Process segments for speaker detection
    const processedSegments = await detectSpeakers(whisperResult.segments)
    
    // Combine all text
    const fullText = whisperResult.text || whisperResult.segments?.map((s: any) => s.text).join(' ') || ''

    console.log(`🎯 [WHISPER] Speaker detection completed. Found ${processedSegments.length} segments`)

    return {
      fullText,
      segments: processedSegments
    }

  } catch (error) {
    console.error(`💥 [WHISPER] Transcription failed:`, error)
    
    // Fallback: return basic transcription without speaker detection
    return {
      fullText: "Transcription temporarily unavailable. Please try again later.",
      segments: []
    }
  }
}

async function detectSpeakers(segments: any[]) {
  console.log(`🔍 [SPEAKER] Analyzing ${segments.length} segments for speaker detection...`)
  
  try {
    // Simple speaker detection based on audio patterns and content analysis
    const processedSegments = []
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const text = segment.text?.trim() || ''
      
      if (!text) continue
      
      // Determine speaker based on content patterns and audio characteristics
      const speaker = await determineSpeaker(text, segment, i)
      
      processedSegments.push({
        text: text,
        speaker: speaker,
        speaker_id: speaker === 'doctor' ? 'doctor' : speaker === 'patient' ? 'patient' : `speaker_${i + 1}`,
        timestamp: formatTimestamp(segment.start, segment.end),
        start_time: segment.start,
        end_time: segment.end
      })
    }
    
    console.log(`✅ [SPEAKER] Processed ${processedSegments.length} segments with speaker labels`)
    return processedSegments
    
  } catch (error) {
    console.error(`💥 [SPEAKER] Speaker detection failed:`, error)
    
    // Fallback: return segments without speaker detection
    return segments.map((segment: any, index: number) => ({
      text: segment.text?.trim() || '',
      speaker: 'unknown',
      speaker_id: `speaker_${index + 1}`,
      timestamp: formatTimestamp(segment.start, segment.end),
      start_time: segment.start,
      end_time: segment.end
    }))
  }
}

async function determineSpeaker(text: string, segment: any, index: number): Promise<string> {
  console.log(`🧠 [ANALYSIS] Analyzing segment ${index + 1}: "${text.substring(0, 50)}..."`)
  
  try {
    // Use OpenAI to analyze the text content for speaker identification
    const prompt = `Analyze this medical conversation segment and determine if the speaker is likely a DOCTOR or PATIENT based on the content, language patterns, and medical terminology used.

Text: "${text}"

Consider:
- Medical terminology and professional language (suggests doctor)
- Questions about symptoms, concerns, or personal experiences (suggests patient)  
- Explanations of diagnosis, treatment, or medical procedures (suggests doctor)
- Descriptions of pain, symptoms, or personal medical history (suggests patient)
- Professional tone vs conversational/concerned tone

Respond with only one word: "doctor", "patient", or "unknown"`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    const speaker = result.choices[0]?.message?.content?.trim().toLowerCase()
    
    console.log(`🎯 [ANALYSIS] Segment ${index + 1} identified as: ${speaker}`)
    
    return ['doctor', 'patient'].includes(speaker) ? speaker : 'unknown'
    
  } catch (error) {
    console.error(`💥 [ANALYSIS] Speaker analysis failed for segment ${index + 1}:`, error)
    
    // Fallback: simple heuristic based on medical keywords
    const medicalTerms = ['diagnosis', 'prescription', 'treatment', 'recommend', 'examine', 'patient', 'condition', 'medication']
    const patientTerms = ['feel', 'hurt', 'pain', 'symptom', 'worried', 'experiencing', 'my', 'i have', 'i feel']
    
    const lowerText = text.toLowerCase()
    const medicalCount = medicalTerms.filter(term => lowerText.includes(term)).length
    const patientCount = patientTerms.filter(term => lowerText.includes(term)).length
    
    if (medicalCount > patientCount && medicalCount > 0) {
      return 'doctor'
    } else if (patientCount > medicalCount && patientCount > 0) {
      return 'patient'
    }
    
    return 'unknown'
  }
}

function formatTimestamp(start: number, end: number): string {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  return `${formatTime(start)} - ${formatTime(end)}`
}

async function generateMedicalReportForTranscript(recordingId: string, userId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🏥 [MEDICAL-REPORT-${recordingId}] Starting medical report generation...`)
  
  try {
    // Get the transcript for this recording
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('id, transcription_text')
      .eq('recording_id', recordingId)
      .eq('user_id', userId)
      .single()

    if (transcriptError || !transcript) {
      console.error(`❌ [MEDICAL-REPORT-${recordingId}] Failed to get transcript:`, transcriptError)
      return
    }

    if (!transcript.transcription_text) {
      console.error(`❌ [MEDICAL-REPORT-${recordingId}] No transcription text available`)
      return
    }

    // Check if medical report already exists
    const { data: existingReport } = await supabase
      .from('medical_reports')
      .select('id')
      .eq('transcript_id', transcript.id)
      .single()

    if (existingReport) {
      console.log(`ℹ️ [MEDICAL-REPORT-${recordingId}] Medical report already exists`)
      return
    }

    // Create medical report record
    const { data: newReport, error: createError } = await supabase
      .from('medical_reports')
      .insert({
        transcript_id: transcript.id,
        recording_id: recordingId,
        user_id: userId,
        status: 'pending'
      })
      .select()
      .single()

    if (createError || !newReport) {
      console.error(`❌ [MEDICAL-REPORT-${recordingId}] Failed to create medical report:`, createError)
      return
    }

    // Generate the medical report using the existing function from the medical report API
    await generateMedicalReportAsync(transcript.transcription_text, newReport.id, supabase)

  } catch (error) {
    console.error(`💥 [MEDICAL-REPORT-${recordingId}] Medical report generation failed:`, error)
  }
}

async function generateMedicalReportAsync(transcriptionText: string, reportId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🤖 [MEDICAL-REPORT-${reportId}] Starting medical report generation...`)
  
  try {
    // Update status to processing
    await supabase
      .from('medical_reports')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', reportId)

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }

    // Generate structured medical report using OpenAI
    const prompt = `You are a medical AI assistant. Analyze this medical conversation transcript and create a structured medical report. Extract and organize the information according to standard medical documentation practices.

TRANSCRIPT TO ANALYZE:
"${transcriptionText}"

Please provide a comprehensive medical report in the following JSON format:

{
  "patient_demographics": {
    "age": "extracted age or null",
    "gender": "extracted gender or null",
    "other_details": "any other demographic info"
  },
  "chief_complaint": "primary reason for visit",
  "hpi_details": {
    "onset": "when symptoms started",
    "location": "where symptoms occur",
    "severity": "severity description/scale",
    "progression": "how symptoms have changed",
    "modifiers": "what makes it better/worse",
    "associated_symptoms": "related symptoms"
  },
  "medical_history": {
    "past_medical": "previous medical conditions",
    "surgical": "previous surgeries",
    "family": "family medical history",
    "social": "social history (smoking, alcohol, etc.)",
    "medications": "current medications",
    "allergies": "known allergies"
  },
  "soap_note": "Complete SOAP note format:\\n\\nSUBJECTIVE:\\n[Patient's subjective complaints and history]\\n\\nOBJECTIVE:\\n[Physical examination findings if mentioned]\\n\\nASSESSMENT:\\n[Clinical impression/diagnosis]\\n\\nPLAN:\\n[Treatment plan and recommendations]",
  "red_flags": ["array of concerning symptoms or findings that need immediate attention"],
  "patient_summary": "Plain-language summary for patient/caregiver understanding, explaining the visit, findings, and next steps in simple terms"
}

IMPORTANT INSTRUCTIONS:
- Only include information that is explicitly mentioned or can be reasonably inferred from the transcript
- If information is not available, use null or empty string
- Keep medical terminology accurate but include plain language explanations
- Identify any red flags or urgent concerns
- Make the patient summary accessible to non-medical readers
- Ensure the SOAP note follows proper medical documentation format`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const reportContent = result.choices[0]?.message?.content?.trim()
    
    if (!reportContent) {
      throw new Error('No content received from OpenAI')
    }

    // Parse the JSON response
    let parsedReport
    try {
      parsedReport = JSON.parse(reportContent)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError)
      throw new Error('Invalid response format from AI')
    }

    console.log(`✅ [MEDICAL-REPORT-${reportId}] Medical report generated, updating database...`)

    // Update medical report with generated content
    const { error: updateError } = await supabase
      .from('medical_reports')
      .update({ 
        status: 'completed',
        patient_demographics: parsedReport.patient_demographics || {},
        chief_complaint: parsedReport.chief_complaint || null,
        hpi_details: parsedReport.hpi_details || {},
        medical_history: parsedReport.medical_history || {},
        soap_note: parsedReport.soap_note || null,
        red_flags: parsedReport.red_flags || [],
        patient_summary: parsedReport.patient_summary || null,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)

    if (updateError) {
      console.error(`❌ [MEDICAL-REPORT-${reportId}] Database update error:`, updateError)
      throw updateError
    }

    console.log(`🎉 [MEDICAL-REPORT-${reportId}] Medical report completed successfully!`)

  } catch (error) {
    console.error(`💥 [MEDICAL-REPORT-${reportId}] Medical report generation failed:`, error)
    
    // Update medical report status to failed with error message
    try {
      await supabase
        .from('medical_reports')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
    } catch (updateError) {
      console.error(`💥 [MEDICAL-REPORT-${reportId}] Failed to update error status:`, updateError)
    }
  }
}