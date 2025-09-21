import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to fetch a few records to see the structure
    const { data: records, error: fetchError } = await supabase
      .from('scheduled_calls')
      .select('*')
      .limit(5)

    if (fetchError) {
      console.error('[DEBUG-TABLE] Error:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch records',
        details: fetchError 
      }, { status: 500 })
    }

    // Also try to get table info
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'scheduled_calls' })
      .catch(() => ({ data: null, error: { message: 'RPC not available' } }))

    return NextResponse.json({
      success: true,
      records,
      recordCount: records?.length || 0,
      sampleRecord: records?.[0] || null,
      tableInfo: tableInfo || null,
      tableError: tableError?.message || null
    })

  } catch (error) {
    console.error('[DEBUG-TABLE] Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}