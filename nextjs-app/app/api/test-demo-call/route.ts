import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('[TEST-DEMO-CALL] Starting demo call test...')
  
  try {
    const supabase = await createClient()
    
    // Test 1: Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const authResult = {
      success: !authError && !!user,
      userId: user?.id || null,
      error: authError?.message || null
    }
    
    // Test 2: Database connection
    let dbResult;
    try {
      const { data: profiles, error: dbError } = await supabase
        .from('user_profiles')
        .select('id, full_name, user_type, patient_phone_number')
        .limit(1)
        
      dbResult = {
        success: !dbError,
        error: dbError?.message || null,
        profileCount: profiles?.length || 0
      }
    } catch (error) {
      dbResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown database error'
      }
    }
    
    // Test 3: Patient data (if authenticated)
    let patientResult = { success: false, error: 'Not authenticated' };
    if (user) {
      try {
        const { data: patients, error: patientError } = await supabase
          .from('user_profiles')
          .select('id, full_name, patient_phone_number, user_type')
          .eq('user_type', 'patient')
          .limit(5)
          
        patientResult = {
          success: !patientError,
          error: patientError?.message || null,
          patientCount: patients?.length || 0,
          patients: patients?.map(p => ({
            id: p.id,
            name: p.full_name,
            hasPhone: !!p.patient_phone_number,
            phone: p.patient_phone_number ? 'Set' : 'Missing'
          })) || []
        }
      } catch (error) {
        patientResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown patient query error'
        }
      }
    }
    
    // Test 4: Caregiver relationships (if authenticated)
    let relationshipResult = { success: false, error: 'Not authenticated' };
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, user_type')
          .eq('id', user.id)
          .single()
          
        if (profile?.user_type === 'caregiver' && profile.email) {
          const { data: relationships, error: relError } = await supabase
            .from('caregiver_relationships')
            .select('patient_id, status')
            .eq('caregiver_email', profile.email)
            .eq('status', 'accepted')
            
          relationshipResult = {
            success: !relError,
            error: relError?.message || null,
            relationshipCount: relationships?.length || 0,
            caregiverEmail: profile.email
          }
        } else {
          relationshipResult = {
            success: true,
            error: null,
            relationshipCount: 0,
            caregiverEmail: 'Not a caregiver account'
          }
        }
      } catch (error) {
        relationshipResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown relationship query error'
        }
      }
    }
    
    // Test 5: Environment variables
    const envResult = {
      hasVapiBaseUrl: !!process.env.VAPI_BASE_URL,
      hasVapiApiKey: !!process.env.VAPI_PRIVATE_API_KEY,
      hasVapiPhoneId: !!process.env.VAPI_PHONE_NUMBER_ID,
      hasVapiWorkflowId: !!process.env.VAPI_WORKFLOW_ID,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    
    const overallSuccess = authResult.success && dbResult.success && patientResult.success
    
    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess ? 'All tests passed!' : 'Some tests failed',
      timestamp: new Date().toISOString(),
      tests: {
        authentication: authResult,
        database: dbResult,
        patients: patientResult,
        relationships: relationshipResult,
        environment: envResult
      }
    })
    
  } catch (error) {
    console.error('[TEST-DEMO-CALL] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed with unexpected error',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : null
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Quick test of simulated demo call without full validation
  console.log('[TEST-DEMO-CALL] Testing simulated demo call...')
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    console.log('[TEST-DEMO-CALL] Test request body:', body)
    
    // Just return success without actually doing anything
    return NextResponse.json({
      success: true,
      message: 'Test demo call simulation completed',
      testData: {
        userId: user.id,
        requestBody: body,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('[TEST-DEMO-CALL] Test POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}