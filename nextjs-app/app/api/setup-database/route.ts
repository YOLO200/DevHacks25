import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  console.log('[SETUP-DATABASE] Starting database setup...')
  
  try {
    const supabase = await createClient()
    
    // Check if scheduled_calls table exists by trying to query it
    const { data: testQuery, error: testError } = await supabase
      .from('scheduled_calls')
      .select('id')
      .limit(1)
    
    if (testError && testError.message?.includes('relation "scheduled_calls" does not exist')) {
      console.log('[SETUP-DATABASE] scheduled_calls table does not exist, creating it...')
      
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_scheduled_calls_table')
      
      if (createError) {
        console.error('[SETUP-DATABASE] Failed to create table:', createError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create scheduled_calls table',
          details: createError
        }, { status: 500 })
      }
      
      console.log('[SETUP-DATABASE] scheduled_calls table created successfully')
    } else if (testError) {
      console.error('[SETUP-DATABASE] Database error:', testError)
      return NextResponse.json({
        success: false,
        error: 'Database error',
        details: testError
      }, { status: 500 })
    } else {
      console.log('[SETUP-DATABASE] scheduled_calls table already exists')
    }
    
    // Test inserting a dummy record to check permissions
    const { data: testInsert, error: insertError } = await supabase
      .from('scheduled_calls')
      .insert({
        patient_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
        caregiver_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
        reminder_id: 1, // dummy reminder ID (required by schema)
        scheduled_time: new Date().toISOString(),
        status: 'test',
        call_attempts: 0
      })
      .select('id')
    
    if (insertError) {
      console.error('[SETUP-DATABASE] Insert test failed:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Cannot insert into scheduled_calls table',
        details: insertError
      }, { status: 500 })
    }
    
    // Clean up test record
    if (testInsert && testInsert.length > 0) {
      await supabase
        .from('scheduled_calls')
        .delete()
        .eq('id', testInsert[0].id)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      tableExists: true
    })
    
  } catch (error) {
    console.error('[SETUP-DATABASE] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Unexpected database setup error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}