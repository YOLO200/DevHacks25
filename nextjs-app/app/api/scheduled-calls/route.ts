import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('[SCHEDULED-CALLS] Fetching scheduled calls...')
  
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[SCHEDULED-CALLS] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const isDemoOnly = searchParams.get('demo_only') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query
    let query = supabase
      .from('scheduled_calls')
      .select(`
        id,
        reminder_id,
        patient_id,
        caregiver_id,
        scheduled_time,
        status,
        call_attempts,
        vapi_call_id,
        error_message,
        call_duration,
        call_summary,
        notes,
        is_demo,
        created_at,
        updated_at,
        care_reminders (
          id,
          name,
          category,
          notes
        ),
        user_profiles!scheduled_calls_patient_id_fkey (
          id,
          full_name,
          patient_phone_number
        )
      `)
      .eq('caregiver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (isDemoOnly) {
      // Filter for demo calls by looking for demo IDs (since is_demo column doesn't exist)
      query = query.like('id', 'demo_%')
    }

    const { data: scheduledCalls, error: fetchError } = await query

    if (fetchError) {
      console.error('[SCHEDULED-CALLS] Error fetching scheduled calls:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch scheduled calls' }, { status: 500 })
    }

    console.log(`[SCHEDULED-CALLS] Retrieved ${scheduledCalls?.length || 0} scheduled calls for caregiver ${user.id}`)

    return NextResponse.json({
      success: true,
      data: scheduledCalls || [],
      count: scheduledCalls?.length || 0
    })

  } catch (error) {
    console.error('[SCHEDULED-CALLS] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[SCHEDULED-CALLS] Deleting scheduled call...')
  
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[SCHEDULED-CALLS] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('id')

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 })
    }

    // Delete the scheduled call (only if it belongs to the authenticated caregiver)
    const { error: deleteError } = await supabase
      .from('scheduled_calls')
      .delete()
      .eq('id', callId)
      .eq('caregiver_id', user.id)

    if (deleteError) {
      console.error('[SCHEDULED-CALLS] Error deleting scheduled call:', deleteError)
      return NextResponse.json({ error: 'Failed to delete scheduled call' }, { status: 500 })
    }

    console.log(`[SCHEDULED-CALLS] Deleted scheduled call ${callId}`)

    return NextResponse.json({
      success: true,
      message: 'Scheduled call deleted successfully'
    })

  } catch (error) {
    console.error('[SCHEDULED-CALLS] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}