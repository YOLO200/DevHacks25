import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[VAPI-WEBHOOK] Received webhook request')
  
  try {
    const supabase = await createClient()
    const payload = await request.json()
    
    console.log('[VAPI-WEBHOOK] Payload received:', JSON.stringify(payload, null, 2))
    
    const { type, call } = payload
    
    if (!call || !call.id) {
      console.warn('[VAPI-WEBHOOK] No call ID in payload')
      return NextResponse.json({ success: true, message: 'No call ID provided' })
    }
    
    const callId = call.id
    const scheduledCallId = call.metadata?.scheduled_call_id || call.workflowOverrides?.variableValues?.scheduled_call_id
    
    console.log(`[VAPI-WEBHOOK] Processing ${type} event for call ${callId}, scheduled_call_id: ${scheduledCallId}`)
    
    // Find the scheduled call record
    let scheduledCall = null
    if (scheduledCallId) {
      const { data: foundCall, error: findError } = await supabase
        .from('scheduled_calls')
        .select('*')
        .eq('id', scheduledCallId)
        .single()
        
      if (findError) {
        console.error(`[VAPI-WEBHOOK] Error finding scheduled call ${scheduledCallId}:`, findError)
      } else {
        scheduledCall = foundCall
      }
    }
    
    // If we don't have a scheduled call record, try to find by vapi_call_id
    if (!scheduledCall) {
      const { data: foundCall, error: findError } = await supabase
        .from('scheduled_calls')
        .select('*')
        .eq('vapi_call_id', callId)
        .single()
        
      if (findError && findError.code !== 'PGRST116') {
        console.error(`[VAPI-WEBHOOK] Error finding scheduled call by vapi_call_id ${callId}:`, findError)
      } else if (foundCall) {
        scheduledCall = foundCall
        console.log(`[VAPI-WEBHOOK] Found scheduled call by vapi_call_id: ${foundCall.id}`)
      }
    }
    
    if (!scheduledCall) {
      console.warn(`[VAPI-WEBHOOK] No scheduled call found for VAPI call ${callId}`)
      return NextResponse.json({ success: true, message: 'No scheduled call record found' })
    }
    
    // Process different event types
    const updateData: Record<string, any> = {
      vapi_call_id: callId,
      updated_at: new Date().toISOString()
    }
    
    switch (type) {
      case 'call-started':
        updateData.status = 'in_progress'
        console.log(`[VAPI-WEBHOOK] Call ${callId} started`)
        break
        
      case 'call-ended':
        const endedReason = call.endedReason
        const duration = call.duration ? Math.round(call.duration) : null
        
        updateData.call_duration = duration
        
        switch (endedReason) {
          case 'customer-ended-call':
          case 'assistant-ended-call':
            updateData.status = 'completed'
            break
          case 'customer-did-not-answer':
            updateData.status = 'no_answer'
            break
          case 'customer-busy':
            updateData.status = 'missed'
            break
          case 'assistant-error':
          case 'phone-call-provider-error':
            updateData.status = 'failed'
            updateData.error_message = `Call ended due to ${endedReason}`
            break
          default:
            updateData.status = 'completed'
        }
        
        console.log(`[VAPI-WEBHOOK] Call ${callId} ended with reason: ${endedReason}, duration: ${duration}s, status: ${updateData.status}`)
        break
        
      case 'call-forwarded':
        console.log(`[VAPI-WEBHOOK] Call ${callId} forwarded`)
        // Don't update status for forwarded calls
        delete updateData.status
        break
        
      case 'function-call':
        console.log(`[VAPI-WEBHOOK] Function call event for ${callId}:`, call.functionCall)
        // Don't update status for function calls
        delete updateData.status
        break
        
      default:
        console.log(`[VAPI-WEBHOOK] Unhandled event type: ${type}`)
        delete updateData.status
    }
    
    // Update the scheduled call record
    const { error: updateError } = await supabase
      .from('scheduled_calls')
      .update(updateData)
      .eq('id', scheduledCall.id)
    
    if (updateError) {
      console.error(`[VAPI-WEBHOOK] Error updating scheduled call ${scheduledCall.id}:`, updateError)
      return NextResponse.json({ error: 'Failed to update call record' }, { status: 500 })
    }
    
    console.log(`[VAPI-WEBHOOK] Successfully updated scheduled call ${scheduledCall.id} with data:`, updateData)
    
    // If this is a completed call and there's a transcript, extract key information
    if (type === 'call-ended' && call.transcript && updateData.status === 'completed') {
      try {
        // Extract call summary from transcript
        const transcript = call.transcript
        let callSummary = 'Call completed successfully.'
        
        if (typeof transcript === 'string' && transcript.length > 50) {
          // Take first 500 characters as summary
          callSummary = transcript.substring(0, 500) + (transcript.length > 500 ? '...' : '')
        } else if (Array.isArray(transcript) && transcript.length > 0) {
          // If transcript is an array of messages, join them
          const messages = transcript.map(t => t.message || t.text || '').filter(Boolean)
          if (messages.length > 0) {
            callSummary = messages.join(' ').substring(0, 500)
            if (callSummary.length >= 500) callSummary += '...'
          }
        }
        
        // Update with call summary
        await supabase
          .from('scheduled_calls')
          .update({ call_summary: callSummary })
          .eq('id', scheduledCall.id)
          
        console.log(`[VAPI-WEBHOOK] Added call summary to scheduled call ${scheduledCall.id}`)
      } catch (summaryError) {
        console.error(`[VAPI-WEBHOOK] Error processing call summary:`, summaryError)
        // Don't fail the webhook for summary errors
      }
    }
    
    const processingTime = Date.now() - startTime
    console.log(`[VAPI-WEBHOOK] Successfully processed ${type} event in ${processingTime}ms`)
    
    return NextResponse.json({ success: true, message: 'Webhook processed successfully' })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`[VAPI-WEBHOOK] Error processing webhook after ${processingTime}ms:`, error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}