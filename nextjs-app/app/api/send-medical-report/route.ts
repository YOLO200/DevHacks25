import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  console.log('📧 [EMAIL] Starting medical report email sending...')
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const { 
      reportId, 
      caregiverEmails, 
      includeTranscript, 
      customMessage,
      recipientName 
    } = await request.json()

    if (!reportId || !caregiverEmails || caregiverEmails.length === 0) {
      return NextResponse.json({ error: 'Report ID and caregiver emails are required' }, { status: 400 })
    }

    // Get the medical report data
    const { data: report, error: reportError } = await supabase
      .from('medical_reports')
      .select(`
        *,
        recordings (
          id,
          title,
          duration,
          created_at
        ),
        transcripts (
          transcription_text,
          structured_transcript
        )
      `)
      .eq('id', reportId)
      .eq('user_id', user.id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Medical report not found' }, { status: 404 })
    }

    // Get user profile for sender information
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const senderName = userProfile?.full_name || user.email || 'Medical App User'
    const senderEmail = userProfile?.email || user.email

    // Prepare email content
    const reportDate = new Date(report.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const emailSubject = `Medical Report: ${report.recordings?.title || 'Doctor Visit'} - ${reportDate}`

    // Create HTML email content
    const htmlContent = generateEmailTemplate({
      recipientName: recipientName || 'Healthcare Provider',
      senderName,
      report,
      reportDate,
      includeTranscript,
      customMessage
    })

    // Create plain text version
    const textContent = generatePlainTextEmail({
      recipientName: recipientName || 'Healthcare Provider',
      senderName,
      report,
      reportDate,
      includeTranscript,
      customMessage
    })

    console.log(`📧 [EMAIL] Sending to ${caregiverEmails.length} recipient(s)...`)

    // Send emails to all caregivers
    const emailPromises = caregiverEmails.map(async (email: string) => {
      try {
        const result = await resend.emails.send({
          from: 'Medical Reports <noreply@yourdomain.com>', // You'll need to configure this domain
          to: email,
          subject: emailSubject,
          html: htmlContent,
          text: textContent
        })
        
        console.log(`✅ [EMAIL] Sent to ${email}:`, result)
        return { email, success: true, messageId: result.data?.id }
      } catch (error) {
        console.error(`❌ [EMAIL] Failed to send to ${email}:`, error)
        return { email, success: false, error: error.message }
      }
    })

    const results = await Promise.all(emailPromises)
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    console.log(`📊 [EMAIL] Results: ${successful.length} sent, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Email sent to ${successful.length} of ${results.length} recipients`,
      results: {
        successful: successful.length,
        failed: failed.length,
        details: results
      }
    })

  } catch (error) {
    console.error('💥 [EMAIL] Email sending failed:', error)
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: error.message 
    }, { status: 500 })
  }
}

function generateEmailTemplate({ recipientName, senderName, report, reportDate, includeTranscript, customMessage }) {
  const redFlags = report.red_flags && report.red_flags.length > 0 
    ? `<div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
         <h3 style="color: #dc2626; margin: 0 0 8px 0;">🚨 Red Flags</h3>
         <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
           ${report.red_flags.map(flag => `<li>${flag}</li>`).join('')}
         </ul>
       </div>`
    : ''

  const transcript = includeTranscript && report.transcripts?.structured_transcript
    ? `<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
         <h3 style="color: #374151; margin: 0 0 12px 0;">📝 Transcript</h3>
         <div style="font-family: monospace; white-space: pre-wrap; color: #4b5563; line-height: 1.6;">
           ${report.transcripts.structured_transcript.replace(/\n/g, '<br>')}
         </div>
       </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Medical Report</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin: 0;">🏥 Medical Report</h1>
        <p style="color: #6b7280; margin: 10px 0 0 0;">Shared via Medical Voice Assistant</p>
      </div>

      <div style="margin-bottom: 30px;">
        <p>Dear ${recipientName},</p>
        <p>${senderName} has shared a medical report with you through our Medical Voice Assistant platform.</p>
        ${customMessage ? `<p style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;"><em>"${customMessage}"</em></p>` : ''}
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <h2 style="color: #1f2937; margin: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
          📋 ${report.recordings?.title || 'Doctor Visit Report'}
        </h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div>
            <strong>Date:</strong> ${reportDate}<br>
            <strong>Duration:</strong> ${report.recordings?.duration ? Math.floor(report.recordings.duration / 60) + ':' + (report.recordings.duration % 60).toString().padStart(2, '0') : 'N/A'}<br>
            <strong>Status:</strong> <span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 12px;">✅ Completed</span>
          </div>
        </div>

        ${report.chief_complaint ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #1e40af; margin: 0 0 8px 0;">Chief Complaint</h3>
            <p style="background-color: #eff6ff; padding: 12px; border-radius: 6px; margin: 0;">${report.chief_complaint}</p>
          </div>
        ` : ''}

        ${redFlags}

        ${report.patient_summary ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #059669; margin: 0 0 8px 0;">Patient Summary</h3>
            <p style="background-color: #ecfdf5; padding: 12px; border-radius: 6px; margin: 0; line-height: 1.6;">${report.patient_summary}</p>
          </div>
        ` : ''}

        ${report.soap_note ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #374151; margin: 0 0 8px 0;">SOAP Note</h3>
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; line-height: 1.5;">${report.soap_note}</div>
          </div>
        ` : ''}

        ${transcript}
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p><strong>Shared by:</strong> ${senderName}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p style="margin-top: 20px;"><em>This medical report was generated using AI analysis of voice recordings. Please verify important details and use professional judgment.</em></p>
      </div>

    </body>
    </html>
  `
}

function generatePlainTextEmail({ recipientName, senderName, report, reportDate, includeTranscript, customMessage }) {
  const redFlags = report.red_flags && report.red_flags.length > 0 
    ? `\n🚨 RED FLAGS:\n${report.red_flags.map(flag => `- ${flag}`).join('\n')}\n`
    : ''

  const transcript = includeTranscript && report.transcripts?.structured_transcript
    ? `\n📝 TRANSCRIPT:\n${report.transcripts.structured_transcript}\n`
    : ''

  return `
MEDICAL REPORT
==============

Dear ${recipientName},

${senderName} has shared a medical report with you through our Medical Voice Assistant platform.

${customMessage ? `Message: "${customMessage}"\n` : ''}

REPORT DETAILS:
---------------
Title: ${report.recordings?.title || 'Doctor Visit Report'}
Date: ${reportDate}
Duration: ${report.recordings?.duration ? Math.floor(report.recordings.duration / 60) + ':' + (report.recordings.duration % 60).toString().padStart(2, '0') : 'N/A'}
Status: ✅ Completed

${report.chief_complaint ? `CHIEF COMPLAINT:\n${report.chief_complaint}\n` : ''}

${redFlags}

${report.patient_summary ? `PATIENT SUMMARY:\n${report.patient_summary}\n` : ''}

${report.soap_note ? `SOAP NOTE:\n${report.soap_note}\n` : ''}

${transcript}

---
Shared by: ${senderName}
Generated: ${new Date().toLocaleString()}

This medical report was generated using AI analysis of voice recordings. 
Please verify important details and use professional judgment.
  `.trim()
}