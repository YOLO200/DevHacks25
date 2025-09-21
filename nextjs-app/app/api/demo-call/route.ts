import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const VAPI_BASE_URL = process.env.VAPI_BASE_URL
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID
const VAPI_PRIVATE_API_KEY = process.env.VAPI_PRIVATE_API_KEY
const VAPI_WORKFLOW_ID = process.env.VAPI_WORKFLOW_ID

export async function POST(request: NextRequest) {
  console.log('[DEMO-CALL] Starting demo call request...')
  
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[DEMO-CALL] Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { patient_id, reminder_id } = await request.json()
    console.log(`[DEMO-CALL] Request payload:`, { patient_id, reminder_id, caregiver_id: user.id })

    // Validate required environment variables
    const missingVars = []
    if (!VAPI_BASE_URL) missingVars.push('VAPI_BASE_URL')
    if (!VAPI_PHONE_NUMBER_ID) missingVars.push('VAPI_PHONE_NUMBER_ID')
    if (!VAPI_PRIVATE_API_KEY) missingVars.push('VAPI_PRIVATE_API_KEY')
    if (!VAPI_WORKFLOW_ID) missingVars.push('VAPI_WORKFLOW_ID')
    
    if (missingVars.length > 0) {
      console.error('[DEMO-CALL] Missing required environment variables:', missingVars.join(', '))
      return NextResponse.json({ 
        error: 'Server configuration error', 
        details: `Missing environment variables: ${missingVars.join(', ')}` 
      }, { status: 500 })
    }

    // Validate that VAPI_PHONE_NUMBER_ID looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(VAPI_PHONE_NUMBER_ID)) {
      console.error('[DEMO-CALL] VAPI_PHONE_NUMBER_ID must be a UUID, not a phone number')
      return NextResponse.json({ 
        error: 'Invalid VAPI phone number ID configuration', 
        details: 'VAPI_PHONE_NUMBER_ID must be a UUID from your VAPI dashboard, not the actual phone number. Example: 12345678-1234-1234-1234-123456789abc'
      }, { status: 500 })
    }

    console.log(`[DEMO-CALL] Using VAPI phone number ID: ${VAPI_PHONE_NUMBER_ID}`)
    console.log(`[DEMO-CALL] Using VAPI workflow ID: ${VAPI_WORKFLOW_ID}`)

    // Get patient profile and phone number
    const { data: patientProfile, error: patientError } = await supabase
      .from('user_profiles')
      .select('id, full_name, patient_phone_number')
      .eq('id', patient_id)
      .single()

    if (patientError || !patientProfile) {
      console.error('[DEMO-CALL] Failed to fetch patient profile:', patientError)
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (!patientProfile.patient_phone_number) {
      console.error('[DEMO-CALL] Patient has no phone number:', patient_id)
      return NextResponse.json({ error: 'Patient phone number not found' }, { status: 400 })
    }

    // Convert phone number to E.164 format
    const formatPhoneToE164 = (phone: string): string => {
      // Remove all non-digit characters
      const digits = phone.replace(/\D/g, '')
      
      // If it starts with 1 and has 11 digits, it's already formatted
      if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`
      }
      
      // If it has 10 digits, add US country code
      if (digits.length === 10) {
        return `+1${digits}`
      }
      
      // If it already starts with +, return as is
      if (phone.startsWith('+')) {
        return phone
      }
      
      // Default: assume US and add +1
      return `+1${digits}`
    }

    const formattedPhoneNumber = formatPhoneToE164(patientProfile.patient_phone_number)
    console.log(`[DEMO-CALL] Original phone: ${patientProfile.patient_phone_number}, Formatted: ${formattedPhoneNumber}`)

    // Get caregiver profile
    const { data: caregiverProfile, error: caregiverError } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    if (caregiverError || !caregiverProfile) {
      console.error('[DEMO-CALL] Failed to fetch caregiver profile:', caregiverError)
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
        console.warn('[DEMO-CALL] Could not fetch reminder details:', reminderError)
      } else {
        reminderData = reminder
      }
    }

    // Try to create a scheduled call record for tracking (optional)
    console.log('[DEMO-CALL] Attempting to create scheduled call record...')
    let scheduledCall = null;
    
    try {
      // For demo calls without a reminder, we need to handle the NOT NULL constraint
      // Let's create a minimal record that satisfies the schema requirements
      let insertPayload;
      
      if (reminder_id) {
        // We have a reminder, use it
        insertPayload = {
          reminder_id: reminder_id,
          patient_id: patient_id,
          caregiver_id: user.id,
          scheduled_time: new Date().toISOString(),
          status: 'pending',
          call_attempts: 1
        }
      } else {
        // No reminder provided - this is a standalone demo call
        // We need to either create a dummy reminder or skip database creation
        console.warn('[DEMO-CALL] No reminder_id provided for demo call, skipping database record creation')
        scheduledCall = { id: `demo_${Date.now()}` } // Use a demo ID for VAPI
      }

      // Only try to insert if we have a valid payload (i.e., reminder_id exists)
      if (insertPayload) {
        const { data: insertResult, error: insertError } = await supabase
          .from('scheduled_calls')
          .insert(insertPayload)
          .select('id')
          .single()

        if (insertError) {
          console.warn('[DEMO-CALL] Failed to create scheduled call record (continuing anyway):', insertError)
          console.warn('[DEMO-CALL] This might be due to missing table or permissions')
        } else {
          scheduledCall = insertResult;
          console.log(`[DEMO-CALL] Created scheduled call record with ID: ${scheduledCall.id}`)
        }
      }
    } catch (dbError) {
      console.warn('[DEMO-CALL] Database call record creation failed (continuing anyway):', dbError)
    }

    // Prepare VAPI payload
    const vapiPayload = {
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      workflowId: VAPI_WORKFLOW_ID,
      customer: {
        number: formattedPhoneNumber
      },
      workflowOverrides: {
        variableValues: {
          scheduled_call_id: scheduledCall?.id || `demo_${Date.now()}`,
          user_name: caregiverProfile.full_name || 'Caregiver',
          parent_name: patientProfile.full_name || 'Patient',
          category: reminderData?.category || 'Demo',
          Notes: reminderData?.notes || 'This is a demo call from the caregiver dashboard.'
        }
      }
    }

    console.log('[DEMO-CALL] Sending payload to VAPI:', JSON.stringify(vapiPayload, null, 2))

    // Make the VAPI call
    const vapiResponse = await fetch(`${VAPI_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(vapiPayload)
    })

    let vapiResult = null
    try {
      vapiResult = await vapiResponse.json()
    } catch (parseError) {
      console.error('[DEMO-CALL] Failed to parse VAPI response as JSON:', parseError)
    }

    console.log(`[DEMO-CALL] VAPI response status: ${vapiResponse.status}`)
    console.log(`[DEMO-CALL] VAPI response body:`, vapiResult)

    if (!vapiResponse.ok) {
      console.error('[DEMO-CALL] VAPI call failed:', vapiResult)
      
      // Update the scheduled call status to failed
      if (scheduledCall?.id) {
        await supabase
          .from('scheduled_calls')
          .update({ 
            status: 'failed',
            error_message: `VAPI error: ${vapiResult?.message || 'Unknown error'}`
          })
          .eq('id', scheduledCall.id)
      }

      return NextResponse.json({ 
        error: 'Failed to place call via VAPI',
        details: vapiResult 
      }, { status: 500 })
    }

    // Update the scheduled call status to in_progress
    if (scheduledCall?.id) {
      await supabase
        .from('scheduled_calls')
        .update({ 
          status: 'in_progress',
          vapi_call_id: vapiResult?.id || null
        })
        .eq('id', scheduledCall.id)
    }

    console.log(`[DEMO-CALL] Successfully placed call for patient ${patient_id}. VAPI Call ID: ${vapiResult?.id}`)

    return NextResponse.json({
      success: true,
      message: 'Demo call placed successfully',
      scheduledCallId: scheduledCall?.id || null,
      vapiCallId: vapiResult?.id,
      patientName: patientProfile.full_name,
      patientPhone: formattedPhoneNumber,
      originalPhoneNumber: patientProfile.patient_phone_number,
      databaseRecordCreated: !!scheduledCall
    })

  } catch (error) {
    console.error('[DEMO-CALL] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}