import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scheduledCallId = searchParams.get('scheduled_call_id')
    const vapiCallId = searchParams.get('vapi_call_id')

    console.log('[CALL-STATUS] Received parameters:', { 
      scheduledCallId, 
      vapiCallId,
      scheduledCallIdType: typeof scheduledCallId,
      url: request.url 
    })

    if (!scheduledCallId && !vapiCallId) {
      return NextResponse.json({ error: 'scheduled_call_id or vapi_call_id required' }, { status: 400 })
    }

    // Query for the call record with all available columns
    let query = supabase
      .from('scheduled_calls')
      .select(`
        id,
        status,
        call_duration,
        call_summary,
        transcript,
        recording_url,
        started_at,
        ended_at,
        success_evaluation,
        ended_reason,
        vapi_call_id,
        notes,
        created_at,
        updated_at
      `)
      .eq('caregiver_id', user.id)

    if (scheduledCallId) {
      query = query.eq('id', scheduledCallId)
    } else if (vapiCallId) {
      query = query.eq('vapi_call_id', vapiCallId)
    }

    const { data: callRecord, error: fetchError } = await query.single()

    if (fetchError) {
      console.error('[CALL-STATUS] Database query error:', fetchError)
      console.error('[CALL-STATUS] Query parameters:', { scheduledCallId, vapiCallId })
      
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ 
          found: false, 
          message: 'Call record not found or not yet created',
          debug: { scheduledCallId, vapiCallId, fetchError }
        })
      }
      return NextResponse.json({ 
        error: 'Failed to fetch call record',
        details: fetchError.message,
        debug: { scheduledCallId, vapiCallId, code: fetchError.code }
      }, { status: 500 })
    }

    // Determine if webhook has processed this call
    const webhookProcessed = !!(
      callRecord.call_summary || 
      callRecord.transcript || 
      callRecord.recording_url ||
      callRecord.ended_at ||
      (callRecord.status && !['pending', 'in_progress'].includes(callRecord.status))
    )

    return NextResponse.json({
      found: true,
      webhookProcessed,
      callRecord,
      summary: {
        status: callRecord.status,
        duration: callRecord.call_duration,
        hasTranscript: !!callRecord.transcript,
        hasRecording: !!callRecord.recording_url,
        hasSummary: !!callRecord.call_summary,
        success: callRecord.success_evaluation,
        endedReason: callRecord.ended_reason,
        startedAt: callRecord.started_at,
        endedAt: callRecord.ended_at
      }
    })

  } catch (error) {
    console.error('[CALL-STATUS] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}