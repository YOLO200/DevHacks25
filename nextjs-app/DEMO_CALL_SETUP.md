# Demo Call Setup Guide

## Overview
The demo call functionality allows caregivers to instantly place calls to patients using the VAPI (Voice AI Platform) integration. When a caregiver clicks the "Demo Call" button, the system will:

1. Validate patient information and phone number
2. Create a scheduled call record in the database
3. Make an API call to VAPI to initiate the call
4. Track call status and updates via webhooks
5. Log call details for review

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```env
# VAPI Configuration
VAPI_BASE_URL=https://api.vapi.ai
VAPI_PRIVATE_API_KEY=your_vapi_private_key_here
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id
VAPI_ASSISTANT_ID=your_vapi_assistant_id  
VAPI_WORKFLOW_ID=your_vapi_workflow_id
```

## Database Setup

The demo call functionality requires these database tables:

1. **scheduled_calls** - Tracks all calls (demo and scheduled)
2. **user_profiles** - Must include `patient_phone_number` field
3. **care_reminders** - Optionally includes `delivery_method` field

Run the migrations to set up these tables:

```bash
npx supabase migration up
```

## VAPI Configuration

1. **Phone Number**: Configure a phone number in VAPI for outbound calls
2. **Assistant**: Set up an AI assistant with appropriate prompts
3. **Workflow**: Create a workflow that handles the call flow
4. **Webhook**: Configure webhook URL to receive call status updates:
   - URL: `https://your-domain.com/api/vapi-webhook`
   - Events: `call-started`, `call-ended`, `function-call`

## Demo Call Process

### Frontend (CareRemindersView Component)
1. User clicks "Demo Call" button in Add Reminder or Edit Reminder modal
2. Component determines target patient (from filter, form, or editing context)
3. Shows confirmation dialog with patient name
4. Makes POST request to `/api/demo-call` endpoint
5. Shows loading state and success/error messages
6. Refreshes call logs to show new call record

### Backend (API Endpoints)

#### `/api/demo-call` (POST)
- Validates user authentication
- Fetches patient and caregiver profiles
- Creates scheduled call record with `is_demo: true`
- Calls VAPI API to initiate call
- Returns call details and status

#### `/api/vapi-webhook` (POST)
- Receives call status updates from VAPI
- Updates scheduled call records in database
- Handles events: call-started, call-ended, call-forwarded
- Extracts call summary from transcript when available

#### `/api/scheduled-calls` (GET/DELETE)
- Lists scheduled calls for authenticated caregiver
- Supports filtering by patient, demo calls only
- Allows deletion of call records

## Server-Side Logging

All demo call operations include comprehensive logging:

```
[DEMO-CALL] Starting demo call request...
[DEMO-CALL] Request payload: {"patient_id":"...", "reminder_id":"..."}
[DEMO-CALL] Created scheduled call record with ID: abc123
[DEMO-CALL] Sending payload to VAPI: {...}
[DEMO-CALL] VAPI response status: 200
[DEMO-CALL] Successfully placed call for patient xyz
```

```
[VAPI-WEBHOOK] Received webhook request
[VAPI-WEBHOOK] Processing call-started event for call abc123
[VAPI-WEBHOOK] Call abc123 ended with reason: customer-ended-call
[VAPI-WEBHOOK] Successfully updated scheduled call xyz with status: completed
```

## Usage

1. Ensure patient profiles have valid phone numbers in `patient_phone_number` field
2. Navigate to Care Reminders page as a caregiver
3. Either:
   - Select a patient filter and click "Demo Call" from any modal
   - Open Add/Edit Reminder modal and select patient, then click "Demo Call"
4. Confirm the call in the dialog
5. Monitor call status in the call logs section
6. Check server logs for detailed call progression

## Troubleshooting

### Common Issues

**"Patient phone number not found"**
- Ensure the patient profile has a valid `patient_phone_number` field
- Check that the phone number is in E.164 format (+1234567890)

**"Server configuration error"**
- Verify all VAPI environment variables are set correctly
- Check VAPI dashboard for account status and credits

**"Failed to place call via VAPI"**
- Check VAPI response in server logs
- Verify phone number ID and workflow ID are correct
- Ensure VAPI account has sufficient credits

**Webhook not updating call status**
- Verify webhook URL is configured in VAPI dashboard
- Check that webhook endpoint is publicly accessible
- Review webhook logs for processing errors

### Log Monitoring

Monitor these log streams:
- Application logs: `[DEMO-CALL]` and `[VAPI-WEBHOOK]` prefixes
- Database logs: scheduled_calls table inserts/updates
- VAPI dashboard: Call logs and webhook delivery status