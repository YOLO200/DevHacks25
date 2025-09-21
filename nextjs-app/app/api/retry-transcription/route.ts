import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔄 [RETRY] Starting transcription retry...')
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { transcriptId } = await request.json()
    if (!transcriptId) {
      return NextResponse.json({ error: 'Transcript ID required' }, { status: 400 })
    }

    // Get transcript record
    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('*, recordings(*)')
      .eq('id', transcriptId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Check retry limit (max 3 retries)
    if (transcript.retry_count >= 3) {
      return NextResponse.json({ error: 'Maximum retry attempts reached' }, { status: 400 })
    }

    // Increment retry count and reset status
    const { error: updateError } = await supabase
      .from('transcripts')
      .update({ 
        status: 'pending',
        retry_count: transcript.retry_count + 1,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update transcript' }, { status: 500 })
    }

    // Get audio file and retry transcription
    const recording = transcript.recordings
    if (!recording?.file_path) {
      return NextResponse.json({ error: 'Recording file not found' }, { status: 404 })
    }

    // Download audio file from storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("doctor's note")
      .download(recording.file_path)

    if (downloadError || !audioData) {
      console.error('❌ [RETRY] Failed to download audio file:', downloadError)
      return NextResponse.json({ error: 'Failed to download audio file' }, { status: 500 })
    }

    // Convert to Blob and retry transcription
    const audioBlob = new Blob([audioData], { type: 'audio/mpeg' })
    
    // Start async transcription (reuse existing function)
    retryTranscriptionAsync(audioBlob, transcript.recording_id, user.id, supabase)

    console.log('✅ [RETRY] Transcription retry initiated')
    return NextResponse.json({ 
      success: true, 
      message: 'Transcription retry started',
      retryCount: transcript.retry_count + 1
    })

  } catch (error) {
    console.error('💥 [RETRY] Retry failed:', error)
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 })
  }
}

async function retryTranscriptionAsync(audioBlob: Blob, recordingId: string, userId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🔄 [RETRY-TRANSCRIBE-${recordingId}] Starting retry transcription...`)
  
  try {
    // Update status to processing
    await supabase
      .from('transcripts')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('recording_id', recordingId)

    // Create FormData for OpenAI Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.wav')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')
    
    console.log(`🌐 [RETRY-TRANSCRIBE-${recordingId}] Calling OpenAI Whisper API...`)
    
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
    console.log(`✅ [RETRY-TRANSCRIBE-${recordingId}] Transcription received, updating database...`)

    // Update transcript with completed transcription
    const { error: updateError } = await supabase
      .from('transcripts')
      .update({ 
        status: 'completed',
        transcription_text: transcriptionText,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('recording_id', recordingId)

    if (updateError) {
      console.error(`❌ [RETRY-TRANSCRIBE-${recordingId}] Database update error:`, updateError)
      throw updateError
    }

    console.log(`🎉 [RETRY-TRANSCRIBE-${recordingId}] Retry transcription completed successfully!`)
    
    // Start async structuring process for retry as well
    if (process.env.OPENAI_API_KEY) {
      console.log(`🤖 [RETRY-STRUCTURE-${recordingId}] Starting retry transcript structuring...`)
      structureRetryTranscriptAsync(transcriptionText, recordingId, supabase)
    }

  } catch (error) {
    console.error(`💥 [RETRY-TRANSCRIBE-${recordingId}] Retry transcription failed:`, error)
    
    // Update transcript status to failed with error message
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
      console.error(`💥 [RETRY-TRANSCRIBE-${recordingId}] Failed to update error status:`, updateError)
    }
  }
}

async function structureRetryTranscriptAsync(transcriptionText: string, recordingId: string, supabase: ReturnType<typeof createClient>) {
  console.log(`🤖 [RETRY-STRUCTURE-${recordingId}] Starting retry transcript structuring...`)
  
  try {
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

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const structuredTranscript = result.choices[0]?.message?.content?.trim()
    
    if (structuredTranscript) {
      console.log(`✅ [RETRY-STRUCTURE-${recordingId}] Retry structured transcript generated`)
      
      // Update transcript with structured version
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({ 
          structured_transcript: structuredTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('recording_id', recordingId)

      if (updateError) {
        console.error(`❌ [RETRY-STRUCTURE-${recordingId}] Failed to save retry structured transcript:`, updateError)
      } else {
        console.log(`🎉 [RETRY-STRUCTURE-${recordingId}] Retry structured transcript saved successfully!`)
      }
    }

  } catch (error) {
    console.error(`💥 [RETRY-STRUCTURE-${recordingId}] Retry structuring failed:`, error)
    // Don't fail the transcription if structuring fails
  }
}