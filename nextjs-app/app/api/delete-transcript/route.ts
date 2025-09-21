import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  console.log('🗑️ [DELETE] Starting transcript deletion...')
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { transcriptId } = await request.json()
    if (!transcriptId) {
      return NextResponse.json({ error: 'Transcript ID required' }, { status: 400 })
    }

    console.log(`🔍 [DELETE] Looking for transcript ${transcriptId} for user ${user.id}`)

    // Get transcript record to verify ownership
    const { data: transcript, error: fetchError } = await supabase
      .from('transcripts')
      .select('id, recording_id, user_id')
      .eq('id', transcriptId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !transcript) {
      console.error(`❌ [DELETE] Transcript not found or access denied:`, fetchError)
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    console.log(`✅ [DELETE] Found transcript, proceeding with deletion...`)

    // Delete the transcript record
    const { error: deleteError } = await supabase
      .from('transcripts')
      .delete()
      .eq('id', transcriptId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error(`❌ [DELETE] Failed to delete transcript:`, deleteError)
      return NextResponse.json({ error: 'Failed to delete transcript' }, { status: 500 })
    }

    console.log(`🎉 [DELETE] Transcript ${transcriptId} deleted successfully!`)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transcript deleted successfully'
    })

  } catch (error) {
    console.error('💥 [DELETE] Delete failed:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}