-- Backfill sharing events for existing shared medical reports
-- This creates sharing events for reports that already have shared_caregivers

INSERT INTO sharing_events (
    medical_report_id,
    transcript_id,
    shared_by_user_id,
    shared_with_email,
    sharing_type,
    included_in_email,
    custom_message,
    shared_at,
    created_at
)
SELECT
    mr.id as medical_report_id,
    CASE
        WHEN t.shared_caregivers IS NOT NULL AND cardinality(t.shared_caregivers) > 0
        THEN mr.transcript_id
        ELSE NULL
    END as transcript_id,
    mr.user_id as shared_by_user_id,
    unnest(mr.shared_caregivers) as shared_with_email,
    CASE
        WHEN t.shared_caregivers IS NOT NULL AND cardinality(t.shared_caregivers) > 0
        THEN 'both'::VARCHAR
        ELSE 'medical_report'::VARCHAR
    END as sharing_type,
    FALSE as included_in_email, -- We don't know if transcript was included in email for existing shares
    'Shared before timeline tracking was implemented' as custom_message,
    mr.updated_at as shared_at, -- Use report's updated_at as approximate sharing time
    NOW() as created_at
FROM medical_reports mr
LEFT JOIN transcripts t ON t.id = mr.transcript_id AND unnest(mr.shared_caregivers) = ANY(t.shared_caregivers)
WHERE
    mr.shared_caregivers IS NOT NULL
    AND cardinality(mr.shared_caregivers) > 0
    AND NOT EXISTS (
        -- Only create events if they don't already exist
        SELECT 1 FROM sharing_events se
        WHERE se.medical_report_id = mr.id
        AND se.shared_with_email = unnest(mr.shared_caregivers)
    );

-- Create a function to automatically create sharing events when shared_caregivers is updated
CREATE OR REPLACE FUNCTION create_sharing_event_on_update()
RETURNS TRIGGER AS $$
DECLARE
    new_email TEXT;
    existing_emails TEXT[];
    transcript_shared BOOLEAN;
BEGIN
    -- Get existing shared caregivers (before update)
    IF OLD.shared_caregivers IS NOT NULL THEN
        existing_emails := OLD.shared_caregivers;
    ELSE
        existing_emails := ARRAY[]::TEXT[];
    END IF;

    -- Process each new shared caregiver email
    IF NEW.shared_caregivers IS NOT NULL THEN
        FOREACH new_email IN ARRAY NEW.shared_caregivers
        LOOP
            -- Only create event if this email wasn't already shared
            IF NOT (new_email = ANY(existing_emails)) THEN
                -- Check if transcript is also shared with this email
                SELECT CASE
                    WHEN t.shared_caregivers IS NOT NULL AND new_email = ANY(t.shared_caregivers)
                    THEN TRUE
                    ELSE FALSE
                END INTO transcript_shared
                FROM transcripts t
                WHERE t.id = NEW.transcript_id;

                -- Create sharing event
                INSERT INTO sharing_events (
                    medical_report_id,
                    transcript_id,
                    shared_by_user_id,
                    shared_with_email,
                    sharing_type,
                    included_in_email,
                    shared_at
                ) VALUES (
                    NEW.id,
                    CASE WHEN transcript_shared THEN NEW.transcript_id ELSE NULL END,
                    NEW.user_id,
                    new_email,
                    CASE WHEN transcript_shared THEN 'both' ELSE 'medical_report' END,
                    FALSE, -- Default to FALSE since we don't have this info in trigger
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create sharing events
DROP TRIGGER IF EXISTS medical_report_sharing_event_trigger ON medical_reports;
CREATE TRIGGER medical_report_sharing_event_trigger
    AFTER UPDATE OF shared_caregivers ON medical_reports
    FOR EACH ROW
    EXECUTE FUNCTION create_sharing_event_on_update();

-- Similar function for transcripts
CREATE OR REPLACE FUNCTION create_transcript_sharing_event_on_update()
RETURNS TRIGGER AS $$
DECLARE
    new_email TEXT;
    existing_emails TEXT[];
    report_already_shared BOOLEAN;
BEGIN
    -- Get existing shared caregivers (before update)
    IF OLD.shared_caregivers IS NOT NULL THEN
        existing_emails := OLD.shared_caregivers;
    ELSE
        existing_emails := ARRAY[]::TEXT[];
    END IF;

    -- Process each new shared caregiver email
    IF NEW.shared_caregivers IS NOT NULL THEN
        FOREACH new_email IN ARRAY NEW.shared_caregivers
        LOOP
            -- Only create event if this email wasn't already shared
            IF NOT (new_email = ANY(existing_emails)) THEN
                -- Check if there's already a sharing event for the medical report with this email
                SELECT EXISTS(
                    SELECT 1 FROM sharing_events se
                    JOIN medical_reports mr ON mr.id = se.medical_report_id
                    WHERE mr.transcript_id = NEW.id
                    AND se.shared_with_email = new_email
                ) INTO report_already_shared;

                -- If medical report wasn't already shared, create transcript-only sharing event
                IF NOT report_already_shared THEN
                    INSERT INTO sharing_events (
                        medical_report_id,
                        transcript_id,
                        shared_by_user_id,
                        shared_with_email,
                        sharing_type,
                        included_in_email,
                        shared_at
                    )
                    SELECT
                        mr.id,
                        NEW.id,
                        NEW.user_id,
                        new_email,
                        'transcript',
                        FALSE,
                        NOW()
                    FROM medical_reports mr
                    WHERE mr.transcript_id = NEW.id;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transcript sharing events
DROP TRIGGER IF EXISTS transcript_sharing_event_trigger ON transcripts;
CREATE TRIGGER transcript_sharing_event_trigger
    AFTER UPDATE OF shared_caregivers ON transcripts
    FOR EACH ROW
    EXECUTE FUNCTION create_transcript_sharing_event_on_update();