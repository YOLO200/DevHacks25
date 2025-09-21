import { NextResponse } from 'next/server'

const VAPI_BASE_URL = process.env.VAPI_BASE_URL
const VAPI_PRIVATE_API_KEY = process.env.VAPI_PRIVATE_API_KEY

export async function GET() {
  console.log('[TEST-VAPI] Testing VAPI connection...')
  
  try {
    // Check if environment variables are set
    if (!VAPI_BASE_URL || !VAPI_PRIVATE_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing VAPI environment variables',
        details: {
          hasBaseUrl: !!VAPI_BASE_URL,
          hasApiKey: !!VAPI_PRIVATE_API_KEY
        }
      }, { status: 500 })
    }

    // Test VAPI connection by fetching account info
    const response = await fetch(`${VAPI_BASE_URL}/account`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    let result = null
    try {
      result = await response.json()
    } catch (parseError) {
      console.error('[TEST-VAPI] Failed to parse response:', parseError)
    }

    console.log(`[TEST-VAPI] Response status: ${response.status}`)
    console.log(`[TEST-VAPI] Response body:`, result)

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'VAPI connection failed',
        status: response.status,
        details: result
      }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'VAPI connection successful',
      account: result,
      config: {
        baseUrl: VAPI_BASE_URL,
        hasApiKey: !!VAPI_PRIVATE_API_KEY,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || 'Not set',
        workflowId: process.env.VAPI_WORKFLOW_ID || 'Not set'
      }
    })

  } catch (error) {
    console.error('[TEST-VAPI] Error testing VAPI:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test VAPI connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}