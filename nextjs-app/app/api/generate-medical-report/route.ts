import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🏥 [MEDICAL-REPORT] Starting medical report generation...')
  
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

    // Get transcript data
    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('*, recordings(*)')
      .eq('id', transcriptId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    if (transcript.status !== 'completed' || !transcript.transcription_text) {
      return NextResponse.json({ error: 'Transcript not ready for medical report generation' }, { status: 400 })
    }

    // Check if medical report already exists
    const { data: existingReport } = await supabase
      .from('medical_reports')
      .select('id')
      .eq('transcript_id', transcriptId)
      .single()

    if (existingReport) {
      return NextResponse.json({ 
        success: true, 
        message: 'Medical report already exists',
        reportId: existingReport.id 
      })
    }

    // Create medical report record
    const { data: newReport, error: createError } = await supabase
      .from('medical_reports')
      .insert({
        transcript_id: transcriptId,
        recording_id: transcript.recording_id,
        user_id: user.id,
        status: 'pending'
      })
      .select()
      .single()

    if (createError || !newReport) {
      console.error('❌ [MEDICAL-REPORT] Failed to create medical report record:', createError)
      return NextResponse.json({ error: 'Failed to create medical report' }, { status: 500 })
    }

    // Start async medical report generation
    generateMedicalReportAsync(transcript.transcription_text, newReport.id, supabase)

    console.log('✅ [MEDICAL-REPORT] Medical report generation initiated')
    return NextResponse.json({ 
      success: true, 
      message: 'Medical report generation started',
      reportId: newReport.id
    })

  } catch (error) {
    console.error('💥 [MEDICAL-REPORT] Generation failed:', error)
    return NextResponse.json({ error: 'Medical report generation failed' }, { status: 500 })
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