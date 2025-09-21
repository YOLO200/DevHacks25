import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('[DEMO-CALL-SIMULATE] Starting simulated demo call...')
  console.log('[DEMO-CALL-SIMULATE] Request URL:', request.url)
  console.log('[DEMO-CALL-SIMULATE] Request method:', request.method)
  
  try {
    const supabase = await createClient()
    console.log('[DEMO-CALL-SIMULATE] Supabase client created')
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[DEMO-CALL-SIMULATE] Auth check result:', { hasUser: !!user, error: authError })
    
    if (authError || !user) {
      console.error('[DEMO-CALL-SIMULATE] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let requestBody;
    try {
      requestBody = await request.json()
      console.log('[DEMO-CALL-SIMULATE] Request body parsed:', requestBody)
    } catch (parseError) {
      console.error('[DEMO-CALL-SIMULATE] Failed to parse request body:', parseError)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { patient_id, reminder_id } = requestBody
    console.log(`[DEMO-CALL-SIMULATE] Request payload:`, { patient_id, reminder_id, caregiver_id: user.id })

    // Get patient profile and phone number
    const { data: patientProfile, error: patientError } = await supabase
      .from('user_profiles')
      .select('id, full_name, patient_phone_number')
      .eq('id', patient_id)
      .single()

    if (patientError || !patientProfile) {
      console.error('[DEMO-CALL-SIMULATE] Failed to fetch patient profile:', patientError)
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (!patientProfile.patient_phone_number) {
      console.error('[DEMO-CALL-SIMULATE] Patient has no phone number:', patient_id)
      return NextResponse.json({ error: 'Patient phone number not found' }, { status: 400 })
    }

    // Get caregiver profile
    const { data: caregiverProfile, error: caregiverError } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (caregiverError || !caregiverProfile) {
      console.error('[DEMO-CALL-SIMULATE] Failed to fetch caregiver profile:', caregiverError)
      return NextResponse.json({ error: 'Caregiver profile not found' }, { status: 404 })
    }

    // Get reminder details if provided
    let reminderData = null
    if (reminder_id) {
      const { data: reminder, error: reminderError } = await supabase
        .from('care_reminders')
        .select('notes, category, name')
        .eq('id', reminder_id)
        .single()

      if (reminderError) {
        console.warn('[DEMO-CALL-SIMULATE] Could not fetch reminder details:', reminderError)
      } else {
        reminderData = reminder
      }
    }

    // Create a scheduled call record for tracking
    const { data: scheduledCall, error: insertError } = await supabase
      .from('scheduled_calls')
      .insert({
        reminder_id: reminder_id || null,
        patient_id: patient_id,
        caregiver_id: user.id,
        scheduled_time: new Date().toISOString(),
        status: 'pending',
        call_attempts: 1,
        is_demo: true
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[DEMO-CALL-SIMULATE] Failed to create scheduled call record:', insertError)
      return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
    }

    console.log(`[DEMO-CALL-SIMULATE] Created scheduled call record with ID: ${scheduledCall.id}`)

    // Simulate VAPI call payload (but don't actually send it)
    const vapiPayload = {
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || 'test-phone-id',
      workflowId: process.env.VAPI_WORKFLOW_ID || 'test-workflow-id',
      customer: {
        number: patientProfile.patient_phone_number
      },
      workflowOverrides: {
        variableValues: {
          scheduled_call_id: scheduledCall.id,
          user_name: caregiverProfile.full_name || 'Caregiver',
          parent_name: patientProfile.full_name || 'Patient',
          category: reminderData?.category || 'Demo',
          Notes: reminderData?.notes || 'This is a simulated demo call from the caregiver dashboard.'
        }
      }
    }

    console.log('[DEMO-CALL-SIMULATE] Simulated VAPI payload:', JSON.stringify(vapiPayload, null, 2))

    // Simulate call progression
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API delay

    // Simulate successful call initiation
    const simulatedVapiCallId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Update the scheduled call status to in_progress
    await supabase
      .from('scheduled_calls')
      .update({ 
        status: 'in_progress',
        vapi_call_id: simulatedVapiCallId
      })
      .eq('id', scheduledCall.id)

    console.log(`[DEMO-CALL-SIMULATE] Simulated call initiated for patient ${patient_id}. Simulated Call ID: ${simulatedVapiCallId}`)

    // Simulate call completion after a few seconds
    setTimeout(async () => {
      try {
        console.log(`[DEMO-CALL-SIMULATE] Simulating call completion for ${simulatedVapiCallId}`)
        
        const completionStatus = Math.random() > 0.2 ? 'completed' : 'no_answer' // 80% success rate
        const duration = completionStatus === 'completed' ? Math.floor(Math.random() * 180) + 30 : 0 // 30-210 seconds
        
        await supabase
          .from('scheduled_calls')
          .update({ 
            status: completionStatus,
            call_duration: duration,
            call_summary: completionStatus === 'completed' 
              ? `Simulated demo call completed successfully. Duration: ${duration} seconds. Patient was responsive and the call went well.`
              : 'Patient did not answer the simulated demo call.'
          })
          .eq('id', scheduledCall.id)
          
        console.log(`[DEMO-CALL-SIMULATE] Call ${simulatedVapiCallId} completed with status: ${completionStatus}`)
      } catch (error) {
        console.error('[DEMO-CALL-SIMULATE] Error updating call completion:', error)
      }
    }, 5000) // Complete the call after 5 seconds

    return NextResponse.json({
      success: true,
      message: 'Simulated demo call initiated successfully',
      scheduledCallId: scheduledCall.id,
      vapiCallId: simulatedVapiCallId,
      patientName: patientProfile.full_name,
      patientPhone: patientProfile.patient_phone_number,
      simulation: true,
      vapiPayload: vapiPayload
    })

  } catch (error) {
    console.error('[DEMO-CALL-SIMULATE] Unexpected error:', error)
    console.error('[DEMO-CALL-SIMULATE] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}