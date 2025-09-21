import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[DEMO-CALL-STATUS] Checking demo call configuration...')
  
  const config = {
    vapiBaseUrl: !!process.env.VAPI_BASE_URL,
    vapiPhoneNumberId: !!process.env.VAPI_PHONE_NUMBER_ID,
    vapiPrivateApiKey: !!process.env.VAPI_PRIVATE_API_KEY,
    vapiWorkflowId: !!process.env.VAPI_WORKFLOW_ID,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  
  const allConfigured = Object.values(config).every(Boolean)
  
  console.log('[DEMO-CALL-STATUS] Configuration status:', config)
  
  return NextResponse.json({
    status: allConfigured ? 'ready' : 'incomplete',
    message: allConfigured 
      ? 'Demo call system is properly configured' 
      : 'Some environment variables are missing',
    configuration: config,
    missingVariables: Object.entries(config)
      .filter(([, configured]) => !configured)
      .map(([key]) => key)
  })
}