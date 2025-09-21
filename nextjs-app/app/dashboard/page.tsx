"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import VoiceRecorder from "@/components/VoiceRecorder";
import CaregiversPage from "@/components/CaregiversContent";
import AppleErrorNotification from "@/components/AppleErrorNotification";
import jsPDF from "jspdf";

interface UserProfile {
  full_name: string;
  user_type: "patient" | "caregiver";
}

interface MedicalReport {
  id: string;
  title: string;
  type: "appointment" | "lab_result" | "prescription" | "diagnosis";
  content: string;
  date: string;
  doctor_name?: string;
  created_at: string;
}

type ActiveView =
  | "dashboard"
  | "caregivers"
  | "reports"
  | "recordings"
  | "patients"
  | "care-plans"
  | "settings";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");

  // Recordings state (for timeline)
  const [recordings, setRecordings] = useState<any[]>([]);

  // Transcripts state
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(
    null
  );
  const [structuredView, setStructuredView] = useState<boolean>(true);

  // Medical reports state
  const [medicalReports, setMedicalReports] = useState<any[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [shareEmailExpanded, setShareEmailExpanded] = useState(false);

  // Caregivers state
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [selectedCaregivers, setSelectedCaregivers] = useState<string[]>([]);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Rename states
  const [renamingRecording, setRenamingRecording] = useState<string | null>(
    null
  );
  const [renamingTranscript, setRenamingTranscript] = useState<string | null>(
    null
  );
  const [renamingReport, setRenamingReport] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>("");

  // Reports state
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [activeTab, setActiveTab] = useState<
    "timeline" | "transcripts" | "medical-reports"
  >("medical-reports");

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "warning" | "success";
    isVisible: boolean;
  } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const { data } = await supabase
          .from("user_profiles")
          .select("full_name, user_type")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile(data);
        } else {
          setProfile({
            full_name: user.email || "User",
            user_type: "patient",
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [supabase, router]);

  const handleViewChange = (view: string) => {
    setActiveView(view as ActiveView);
  };

  // Fetch recordings for timeline
  const fetchRecordings = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("recordings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          // Handle case where recordings table doesn't exist
          if (
            error.code === "PGRST116" ||
            error.message?.includes('relation "recordings" does not exist')
          ) {
            console.warn(
              "Recordings table not found. Please run the database setup."
            );
            setRecordings([]);
            return;
          }
          throw error;
        }
        setRecordings(data || []);
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
      setRecordings([]); // Set empty array on error
    }
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    try {
      // For now, this function returns empty reports as we don't have a separate user_reports table
      // This is for user-uploaded medical documents (different from AI-generated medical reports)
      console.log(
        "📋 [UI] Setting empty reports (user-uploaded medical documents)"
      );
      setReports([]);
    } catch (error) {
      console.error("Error fetching reports:", error.message || error);
      setReports([]); // Set empty array on error
    }
  }, [supabase]);

  const fetchTranscripts = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("transcripts")
          .select(
            `
            id,
            recording_id,
            user_id,
            status,
            transcription_text,
            structured_transcript,
            summary,
            error_message,
            retry_count,
            created_at,
            updated_at,
            recordings (
              id,
              title,
              duration,
              created_at
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          // Handle case where transcripts table doesn't exist
          if (
            error.code === "PGRST116" ||
            error.message?.includes('relation "transcripts" does not exist')
          ) {
            console.warn(
              "Transcripts table not found. Please run the database setup."
            );
            setTranscripts([]);
            return;
          }
          throw error;
        }

        console.log(`📊 [UI] Fetched ${data?.length || 0} transcripts`);
        if (data && data.length > 0) {
          console.log(
            "🔍 [UI] Transcript data preview:",
            data.map((t) => ({
              id: t.id,
              status: t.status,
              hasRawTranscript: !!t.transcription_text,
              hasStructuredTranscript: !!t.structured_transcript,
              rawLength: t.transcription_text?.length || 0,
              structuredLength: t.structured_transcript?.length || 0,
            }))
          );
        }

        setTranscripts(data || []);
      }
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      setTranscripts([]); // Set empty array on error
    }
  }, [supabase]);

  // Fetch medical reports function
  const fetchMedicalReports = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("medical_reports")
          .select(
            `
            id,
            transcript_id,
            recording_id,
            user_id,
            patient_demographics,
            chief_complaint,
            hpi_details,
            medical_history,
            soap_note,
            red_flags,
            patient_summary,
            status,
            error_message,
            shared_caregivers,
            created_at,
            updated_at,
            recordings (
              id,
              title,
              duration,
              created_at
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          // Handle case where medical_reports table doesn't exist
          if (
            error.code === "PGRST116" ||
            error.message?.includes('relation "medical_reports" does not exist')
          ) {
            console.warn(
              "Medical reports table not found. Please run the database setup."
            );
            setMedicalReports([]);
            return;
          }
          throw error;
        }

        console.log(`📊 [UI] Fetched ${data?.length || 0} medical reports`);
        if (data && data.length > 0) {
          console.log(
            "🔍 [UI] Medical reports data preview:",
            data.map((r) => ({
              id: r.id,
              status: r.status,
              hasChiefComplaint: !!r.chief_complaint,
              hasSoapNote: !!r.soap_note,
              hasPatientSummary: !!r.patient_summary,
              redFlagsCount: r.red_flags?.length || 0,
              recordingTitle: r.recordings?.title,
            }))
          );
        }
        setMedicalReports(data || []);
      }
    } catch (error) {
      console.error(
        "Error fetching medical reports:",
        error.message || error,
        error
      );
      setMedicalReports([]); // Set empty array on error
    }
  }, [supabase]);

  // Fetch caregivers function
  const fetchCaregivers = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Fetch caregivers from caregiver_relationships table
        const { data, error } = await supabase
          .from("caregiver_relationships")
          .select(
            "id, caregiver_email, caregiver_name, relationship, status, permissions"
          )
          .eq("patient_id", user.id)
          .in("status", ["accepted", "pending"]) // Include both accepted and pending for sharing options
          .order("caregiver_name", { ascending: true });

        if (error) {
          // Handle case where caregiver_relationships table doesn't exist
          if (
            error.code === "PGRST116" ||
            error.message?.includes(
              'relation "caregiver_relationships" does not exist'
            )
          ) {
            console.warn(
              "Caregiver relationships table not found. Please run the database setup."
            );
            // Set mock data for demonstration only
            setCaregivers([
              {
                id: "mock-1",
                full_name: "Dr. Sarah Johnson",
                email: "dr.johnson@hospital.com",
                specialty: "Primary Care Physician",
                status: "accepted",
              },
              {
                id: "mock-2",
                full_name: "John Smith",
                email: "john.smith@family.com",
                specialty: "Family Member",
                status: "accepted",
              },
              {
                id: "mock-3",
                full_name: "Dr. Emily Davis",
                email: "emily.davis@cardio.com",
                specialty: "Cardiologist",
                status: "pending",
              },
            ]);
            return;
          }
          throw error;
        }

        // Transform the data to match the expected format
        const transformedCaregivers =
          data?.map((caregiver) => ({
            id: caregiver.id,
            full_name: caregiver.caregiver_name,
            email: caregiver.caregiver_email,
            specialty: caregiver.relationship,
            status: caregiver.status,
            permissions: caregiver.permissions || [],
          })) || [];

        console.log(
          `👥 [UI] Fetched ${transformedCaregivers.length} caregivers from relationships table`
        );
        if (transformedCaregivers.length > 0) {
          console.log(
            "🔍 [UI] Caregiver data preview:",
            transformedCaregivers.map((c) => ({
              name: c.full_name,
              email: c.email,
              relationship: c.specialty,
              status: c.status,
            }))
          );
        }

        setCaregivers(transformedCaregivers);
      }
    } catch (error) {
      console.error("Error fetching caregivers:", error.message || error);
      setCaregivers([]); // Set empty array on error
    }
  }, [supabase]);

  // Retry transcription function
  const retryTranscription = async (transcriptId: string) => {
    try {
      const response = await fetch("/api/retry-transcription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcriptId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Retry failed");
      }

      showNotification("Transcription retry started", "success");
      await fetchTranscripts(); // Refresh transcripts list
    } catch (error) {
      console.error("Error retrying transcription:", error);
      showNotification(
        error instanceof Error ? error.message : "Retry failed",
        "error"
      );
    }
  };

  // Delete transcript function
  const deleteTranscript = async (
    transcriptId: string,
    transcriptTitle: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete the transcript for "${transcriptTitle}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/delete-transcript", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcriptId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      showNotification("Transcript deleted successfully", "success");
      await fetchTranscripts(); // Refresh transcripts list

      // Close expanded view if the deleted transcript was open
      if (expandedTranscript === transcriptId) {
        setExpandedTranscript(null);
      }
    } catch (error) {
      console.error("Error deleting transcript:", error);
      showNotification(
        error instanceof Error ? error.message : "Delete failed",
        "error"
      );
    }
  };

  // Clean text content for PDF generation
  const cleanTextForPDF = (text: string): string => {
    if (!text) return "";

    return (
      text
        // Remove HTML tags
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        // Remove HTML entities
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Remove weird characters and artifacts
        .replace(/\[Pasted text #\d+[^\]]*\]/gi, "") // Remove "[Pasted text #1 +20 lines" type artifacts
        .replace(/\+\d+\s*lines/gi, "") // Remove "+20 lines" type artifacts
        .replace(/\[.*?\]/g, "") // Remove any other bracketed artifacts
        .replace(/\u00A0/g, " ") // Replace non-breaking spaces
        .replace(/\u2018|\u2019/g, "'") // Replace smart quotes with regular quotes
        .replace(/\u201C|\u201D/g, '"') // Replace smart double quotes
        .replace(/\u2013|\u2014/g, "-") // Replace em/en dashes with regular dash
        .replace(/\u2026/g, "...") // Replace ellipsis character
        // Clean up multiple spaces and newlines
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, "\n") // Replace multiple newlines with single newline
        .trim()
    );
  };

  // Download transcript as PDF function
  const downloadTranscript = (transcript: any) => {
    const content =
      structuredView && transcript.structured_transcript
        ? transcript.structured_transcript
        : transcript.transcription_text || "";

    // Create new PDF document
    const pdf = new jsPDF();

    // Set document properties
    const title = transcript.recordings?.title || "Recording Transcript";
    const date = new Date(transcript.created_at).toLocaleDateString();

    // Add title
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(cleanTextForPDF(title), 20, 20);

    // Add date
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${date}`, 20, 30);

    // Add transcript type
    const transcriptType =
      structuredView && transcript.structured_transcript
        ? "Structured Transcript"
        : "Raw Transcript";
    pdf.text(`Type: ${transcriptType}`, 20, 40);

    // Add separator line
    pdf.line(20, 45, 190, 45);

    // Clean and process content for PDF
    const cleanContent = cleanTextForPDF(content);

    // Split content into lines and add to PDF
    pdf.setFontSize(10);
    const splitText = pdf.splitTextToSize(cleanContent, 170); // 170 is the max width

    let yPosition = 55;
    const pageHeight = pdf.internal.pageSize.height;
    const lineHeight = 6;

    for (let i = 0; i < splitText.length; i++) {
      // Check if we need a new page
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(splitText[i], 20, yPosition);
      yPosition += lineHeight;
    }

    // Save the PDF
    const fileName = `transcript-${cleanTextForPDF(
      transcript.recordings?.title || "recording"
    ).replace(/[^a-z0-9]/gi, "-")}-${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    pdf.save(fileName);
  };

  // Toggle transcript expansion
  const toggleTranscript = (transcriptId: string) => {
    setExpandedTranscript(
      expandedTranscript === transcriptId ? null : transcriptId
    );
  };

  // Rename recording function
  const startRenamingRecording = (
    recordingId: string,
    currentTitle: string
  ) => {
    setRenamingRecording(recordingId);
    setNewName(currentTitle);
  };

  const saveRecordingName = async (recordingId: string) => {
    if (!newName.trim()) {
      showNotification("Recording name cannot be empty", "error");
      return;
    }

    try {
      const { error } = await supabase
        .from("recordings")
        .update({ title: newName.trim() })
        .eq("id", recordingId);

      if (error) {
        throw error;
      }

      showNotification("Recording renamed successfully", "success");
      setRenamingRecording(null);
      setNewName("");
      await fetchRecordings();
    } catch (error) {
      console.error("Error renaming recording:", error);
      showNotification("Failed to rename recording", "error");
    }
  };

  const cancelRenamingRecording = () => {
    setRenamingRecording(null);
    setNewName("");
  };

  // Rename transcript function
  const startRenamingTranscript = (
    transcriptId: string,
    currentTitle: string
  ) => {
    setRenamingTranscript(transcriptId);
    setNewName(currentTitle);
  };

  const saveTranscriptName = async (transcriptId: string) => {
    if (!newName.trim()) {
      showNotification("Transcript name cannot be empty", "error");
      return;
    }

    try {
      // Update the recording title through the transcript's recording_id
      const transcript = transcripts.find((t) => t.id === transcriptId);
      if (!transcript?.recording_id) {
        throw new Error("Recording not found");
      }

      const { error } = await supabase
        .from("recordings")
        .update({ title: newName.trim() })
        .eq("id", transcript.recording_id);

      if (error) {
        throw error;
      }

      showNotification("Transcript renamed successfully", "success");
      setRenamingTranscript(null);
      setNewName("");
      await fetchTranscripts();
      await fetchRecordings(); // Also refresh recordings since we updated the recording title
    } catch (error) {
      console.error("Error renaming transcript:", error);
      showNotification("Failed to rename transcript", "error");
    }
  };

  const cancelRenamingTranscript = () => {
    setRenamingTranscript(null);
    setNewName("");
  };

  // Medical report rename functions
  const startRenamingReport = (reportId: string, currentTitle: string) => {
    setRenamingReport(reportId);
    setNewName(currentTitle);
  };

  const saveReportName = async (reportId: string) => {
    if (!newName.trim()) {
      showNotification("Report name cannot be empty", "error");
      return;
    }

    try {
      // Update the recording title through the medical report's recording_id
      const report = medicalReports.find((r) => r.id === reportId);
      if (!report?.recording_id) {
        throw new Error("Recording not found");
      }

      const { error } = await supabase
        .from("recordings")
        .update({ title: newName.trim() })
        .eq("id", report.recording_id);

      if (error) {
        throw error;
      }

      showNotification("Report renamed successfully", "success");
      setRenamingReport(null);
      setNewName("");
      await fetchMedicalReports();
      await fetchRecordings(); // Also refresh recordings since we updated the recording title
    } catch (error) {
      console.error("Error renaming report:", error);
      showNotification("Failed to rename report", "error");
    }
  };

  const cancelRenamingReport = () => {
    setRenamingReport(null);
    setNewName("");
  };

  // Delete medical report function
  const deleteReport = async (reportId: string, reportTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the medical report for "${reportTitle}"?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("medical_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;

      showNotification("Medical report deleted successfully", "success");
      await fetchMedicalReports();
    } catch (error) {
      console.error("Error deleting medical report:", error);
      showNotification("Failed to delete medical report", "error");
    }
  };

  // Caregiver selection functions
  const toggleCaregiverSelection = (caregiverId: string) => {
    setSelectedCaregivers((prev) =>
      prev.includes(caregiverId)
        ? prev.filter((id) => id !== caregiverId)
        : [...prev, caregiverId]
    );
  };

  const resetShareModal = () => {
    setSelectedCaregivers([]);
    setIncludeTranscript(false);
    setShareEmailExpanded(false);
    setEmailAddress("");
    setCustomMessage("");
    setShowShareModal(null);
  };

  // Send email function
  const sendEmailReport = async () => {
    if (!emailAddress.trim()) {
      showNotification("Please enter an email address", "error");
      return;
    }

    if (!showShareModal) {
      showNotification("No report selected", "error");
      return;
    }

    setSendingEmail(true);

    try {
      const response = await fetch("/api/send-medical-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: showShareModal,
          caregiverEmails: [emailAddress.trim()],
          includeTranscript,
          customMessage: customMessage.trim() || undefined,
          recipientName: "Healthcare Provider",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      showNotification("Email sent successfully!", "success");
      setShareEmailExpanded(false);
      setEmailAddress("");
      setCustomMessage("");
    } catch (error) {
      console.error("Error sending email:", error);
      showNotification(error.message || "Failed to send email", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  // Download medical report as PDF function
  const downloadMedicalReport = (report: any) => {
    // Create new PDF document
    const pdf = new jsPDF();

    // Set document properties
    const title = report.recordings?.title || "Medical Report";
    const date = new Date(report.created_at).toLocaleDateString();

    // Add title
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("🏥 AI Medical Report", 20, 20);

    // Add report title and date
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, 20, 35);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${date}`, 20, 45);
    pdf.text(`Status: ${report.status}`, 20, 50);

    // Add separator line
    pdf.line(20, 55, 190, 55);

    let yPosition = 65;
    const pageHeight = pdf.internal.pageSize.height;
    const lineHeight = 5;

    // Add content sections
    if (report.chief_complaint) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Chief Complaint:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const chiefComplaintText = pdf.splitTextToSize(
        report.chief_complaint,
        170
      );
      pdf.text(chiefComplaintText, 20, yPosition);
      yPosition += chiefComplaintText.length * lineHeight + 10;
    }

    if (report.patient_summary) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Patient Summary:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const summaryText = pdf.splitTextToSize(report.patient_summary, 170);
      pdf.text(summaryText, 20, yPosition);
      yPosition += summaryText.length * lineHeight + 10;
    }

    if (report.red_flags && report.red_flags.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("🚨 Red Flags:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      report.red_flags.forEach((flag: string) => {
        const flagText = pdf.splitTextToSize(`• ${flag}`, 170);
        pdf.text(flagText, 25, yPosition);
        yPosition += flagText.length * lineHeight + 3;
      });
      yPosition += 5;
    }

    if (report.soap_note) {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("SOAP Note:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const soapText = pdf.splitTextToSize(report.soap_note, 170);

      // Add SOAP note with page breaks if needed
      for (let i = 0; i < soapText.length; i++) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(soapText[i], 20, yPosition);
        yPosition += lineHeight;
      }
    }

    // Save the PDF
    const fileName = `medical-report-${title
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
  };

  // Notification function
  const showNotification = (
    message: string,
    type: "error" | "warning" | "success"
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  // Fetch data when view changes
  useEffect(() => {
    if (activeView === "reports") {
      fetchRecordings(); // Fetch recordings for timeline
      fetchReports();
      fetchTranscripts(); // Fetch transcripts
      fetchMedicalReports(); // Fetch medical reports
      fetchCaregivers(); // Fetch caregivers for sharing
    }
  }, [
    activeView,
    fetchRecordings,
    fetchReports,
    fetchTranscripts,
    fetchMedicalReports,
    fetchCaregivers,
  ]);

  // Periodic refresh for transcripts in progress
  useEffect(() => {
    if (activeView === "reports" && activeTab === "transcripts") {
      const refreshInterval = setInterval(() => {
        console.log("🔄 [UI] Refreshing transcripts for updates...");
        fetchTranscripts();
      }, 2000); // Check every 2 seconds for transcript updates (faster for structured transcript updates)

      return () => clearInterval(refreshInterval);
    }
  }, [activeView, activeTab, fetchTranscripts]);

  // Periodic refresh for medical reports in progress
  useEffect(() => {
    if (activeView === "reports" && activeTab === "medical-reports") {
      const refreshInterval = setInterval(() => {
        console.log("🏥 [UI] Refreshing medical reports for updates...");
        fetchMedicalReports();
      }, 2000); // Check every 2 seconds for medical report updates

      return () => clearInterval(refreshInterval);
    }
  }, [activeView, activeTab, fetchMedicalReports]);

  // Additional refresh when transcripts list changes (to catch structured transcript updates)
  useEffect(() => {
    if (transcripts.length > 0) {
      const hasIncompleteStructuring = transcripts.some(
        (t) =>
          t.status === "completed" &&
          t.transcription_text &&
          !t.structured_transcript
      );

      if (hasIncompleteStructuring) {
        console.log(
          "🔍 [UI] Found transcripts missing structured version, will refresh more frequently"
        );
        const quickRefreshInterval = setInterval(() => {
          console.log(
            "⚡ [UI] Quick refresh for structured transcript updates..."
          );
          fetchTranscripts();
        }, 1500); // More frequent refresh when waiting for structured transcripts

        // Clear after 2 minutes to avoid infinite polling
        setTimeout(() => clearInterval(quickRefreshInterval), 120000);

        return () => clearInterval(quickRefreshInterval);
      }
    }
  }, [transcripts, fetchTranscripts]);

  // Utility functions
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "appointment":
        return "🏥";
      case "lab_result":
        return "🧪";
      case "prescription":
        return "💊";
      case "diagnosis":
        return "📋";
      default:
        return "📄";
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case "appointment":
        return "bg-blue-100 text-blue-800";
      case "lab_result":
        return "bg-green-100 text-green-800";
      case "prescription":
        return "bg-purple-100 text-purple-800";
      case "diagnosis":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderMainContent = () => {
    switch (activeView) {
      case "caregivers":
        return <CaregiversPage />;
      case "recordings":
        return <VoiceRecorder userId={userId} />;
      case "reports":
        return (
          <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Reports & Medical History
                </h1>
                <p className="text-gray-600">
                  View your recorded appointments, medical reports, and health
                  timeline
                </p>
              </div>

              {/* Tab Navigation */}
              <div className="mb-8">
                <nav className="flex space-x-8">
                  {[
                    {
                      id: "medical-reports",
                      label: "Medical Reports",
                      icon: "🏥",
                    },
                    { id: "transcripts", label: "Transcripts", icon: "📝" },
                    { id: "timeline", label: "Timeline", icon: "📅" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() =>
                        setActiveTab(
                          tab.id as
                            | "timeline"
                            | "transcripts"
                            | "medical-reports"
                        )
                      }
                      className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === tab.id
                          ? "bg-blue-100 text-blue-700 border-b-2 border-blue-500"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Transcripts Tab */}
              {activeTab === "transcripts" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">
                      Transcripts
                    </h3>
                    <p className="text-gray-600 mt-1">
                      Audio transcriptions from your voice recordings
                    </p>
                  </div>

                  {transcripts.length === 0 ? (
                    <div className="p-6"></div>
                  ) : (
                    <div className="p-6">
                      <div className="space-y-4">
                        {transcripts.map((transcript) => (
                          <div
                            key={transcript.id}
                            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                          >
                            {/* Collapsed View */}
                            <div
                              className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => toggleTranscript(transcript.id)}
                            >
                              {/* Left Action Buttons - Only Retry */}
                              <div className="flex flex-col space-y-1 p-2">
                                {/* Retry Button - Only show for failed transcripts */}
                                {transcript.status === "failed" &&
                                  transcript.retry_count < 3 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        retryTranscription(transcript.id);
                                      }}
                                      className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                                      title="Retry Transcription"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  )}
                              </div>

                              {/* Main Content */}
                              <div className="flex-1 p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">🎙️</span>
                                    </div>
                                    <div className="flex-1">
                                      {renamingTranscript === transcript.id ? (
                                        <div
                                          className="space-y-2"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) =>
                                              setNewName(e.target.value)
                                            }
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                saveTranscriptName(
                                                  transcript.id
                                                );
                                              if (e.key === "Escape")
                                                cancelRenamingTranscript();
                                            }}
                                            autoFocus
                                          />
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() =>
                                                saveTranscriptName(
                                                  transcript.id
                                                )
                                              }
                                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={cancelRenamingTranscript}
                                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <h4 className="font-medium text-gray-900">
                                          {transcript.recordings?.title}
                                        </h4>
                                      )}
                                      <p className="text-sm text-gray-500">
                                        {new Date(
                                          transcript.recordings?.created_at ||
                                            transcript.created_at
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}{" "}
                                        •{" "}
                                        {transcript.recordings?.duration
                                          ? Math.floor(
                                              transcript.recordings.duration /
                                                60
                                            )
                                          : 0}
                                        :
                                        {transcript.recordings?.duration
                                          ? (
                                              transcript.recordings.duration %
                                              60
                                            )
                                              .toString()
                                              .padStart(2, "0")
                                          : "00"}
                                      </p>
                                      <div className="flex items-center mt-1">
                                        <span
                                          className={`px-2 py-1 text-xs rounded-full font-medium ${
                                            transcript.status === "completed"
                                              ? "bg-green-100 text-green-800"
                                              : transcript.status ===
                                                "processing"
                                              ? "bg-blue-100 text-blue-800"
                                              : transcript.status === "failed"
                                              ? "bg-red-100 text-red-800"
                                              : "bg-yellow-100 text-yellow-800"
                                          }`}
                                        >
                                          {transcript.status === "completed" &&
                                            "✅ Completed"}
                                          {transcript.status === "processing" &&
                                            "⏳ Processing..."}
                                          {transcript.status === "failed" &&
                                            "❌ Failed"}
                                          {transcript.status === "pending" &&
                                            "⏸️ Pending"}
                                        </span>
                                        {transcript.retry_count > 0 && (
                                          <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                            Retry #{transcript.retry_count}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Action Buttons - Rename and Delete */}
                              <div className="flex items-center space-x-1 p-2">
                                {/* Rename Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startRenamingTranscript(
                                      transcript.id,
                                      transcript.recordings?.title ||
                                        "Recording"
                                    );
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Rename Transcript"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                {/* Delete Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTranscript(
                                      transcript.id,
                                      transcript.recordings?.title ||
                                        "Recording"
                                    );
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete Transcript"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                                {/* Expand/Collapse Arrow */}
                                <div className="flex items-center text-gray-400">
                                  <svg
                                    className="w-5 h-5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d={
                                        expandedTranscript === transcript.id
                                          ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                          : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                      }
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Expanded View */}
                            {expandedTranscript === transcript.id && (
                              <div className="border-t border-gray-200">
                                {transcript.status === "completed" &&
                                  transcript.transcription_text && (
                                    <div className="p-6">
                                      {/* Action Buttons */}
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={() =>
                                              setStructuredView(true)
                                            }
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                              structuredView
                                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                          >
                                            📋 Structured
                                          </button>
                                          <button
                                            onClick={() =>
                                              setStructuredView(false)
                                            }
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                              !structuredView
                                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            }`}
                                          >
                                            📝 Unstructured
                                          </button>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const content =
                                                structuredView &&
                                                transcript.structured_transcript
                                                  ? transcript.structured_transcript
                                                  : transcript.transcription_text ||
                                                    "";
                                              navigator.clipboard.writeText(
                                                content
                                              );
                                              showNotification(
                                                "Transcription copied to clipboard",
                                                "success"
                                              );
                                            }}
                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="Copy Text"
                                          >
                                            <svg
                                              className="w-4 h-4"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              downloadTranscript(transcript);
                                            }}
                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="Download"
                                          >
                                            <svg
                                              className="w-4 h-4"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>

                                      {/* Transcript Content */}
                                      <div className="bg-gray-50 rounded-lg p-4">
                                        <h5 className="text-sm font-medium text-gray-700 mb-3">
                                          {structuredView
                                            ? "Structured Transcription"
                                            : "Raw Transcription"}
                                          {/* Debug info */}
                                          <span className="text-xs text-gray-500 ml-2">
                                            (Structured:{" "}
                                            {transcript.structured_transcript
                                              ? "Available"
                                              : "Not Available"}
                                            )
                                          </span>
                                        </h5>
                                        <div
                                          className="transcript-content text-gray-900 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-white"
                                          style={{
                                            scrollbarWidth: "thin",
                                            scrollbarColor: "#CBD5E0 #F7FAFC",
                                          }}
                                        >
                                          {structuredView &&
                                          transcript.structured_transcript ? (
                                            <div
                                              className="structured-transcript"
                                              style={{
                                                lineHeight: "1.8",
                                              }}
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  transcript.structured_transcript
                                                    .replace(
                                                      /\n\n/g,
                                                      "<br><br>"
                                                    )
                                                    .replace(/\n/g, "<br>")
                                                    .replace(
                                                      /^Doctor:/gm,
                                                      '<strong style="color: #2563eb;">👨‍⚕️ Doctor:</strong>'
                                                    )
                                                    .replace(
                                                      /^Patient:/gm,
                                                      '<strong style="color: #059669;">👤 Patient:</strong>'
                                                    )
                                                    .replace(
                                                      /<br><strong/g,
                                                      "<br><br><strong"
                                                    ),
                                              }}
                                            />
                                          ) : (
                                            transcript.transcription_text
                                          )}
                                        </div>
                                        {/* Debug: Show both contents for comparison */}
                                        {process.env.NODE_ENV ===
                                          "development" && (
                                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                                            <p>
                                              <strong>Debug Info:</strong>
                                            </p>
                                            <p>
                                              Raw transcript length:{" "}
                                              {transcript.transcription_text
                                                ?.length || 0}
                                            </p>
                                            <p>
                                              Structured transcript length:{" "}
                                              {transcript.structured_transcript
                                                ?.length || 0}
                                            </p>
                                            <p>
                                              Current view:{" "}
                                              {structuredView
                                                ? "Structured"
                                                : "Unstructured"}
                                            </p>
                                            <p>
                                              Structured available:{" "}
                                              {transcript.structured_transcript
                                                ? "Yes"
                                                : "No"}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {transcript.summary && (
                                        <div className="mt-4 bg-blue-50 rounded-lg p-4">
                                          <h5 className="text-sm font-medium text-blue-700 mb-2">
                                            Summary
                                          </h5>
                                          <p className="text-blue-900 leading-relaxed">
                                            {transcript.summary}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                {transcript.status === "failed" &&
                                  transcript.error_message && (
                                    <div className="p-6">
                                      <div className="bg-red-50 rounded-lg p-4">
                                        <h5 className="text-sm font-medium text-red-700 mb-2">
                                          Error Details
                                        </h5>
                                        <p className="text-red-800 text-sm">
                                          {transcript.error_message}
                                        </p>
                                        {transcript.retry_count < 3 && (
                                          <p className="text-red-600 text-xs mt-2">
                                            You can retry this transcription up
                                            to 3 times.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Medical Reports Tab */}
              {activeTab === "medical-reports" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">
                      AI Medical Reports
                    </h3>
                    <p className="text-gray-600 mt-1">
                      AI-generated medical reports from voice recordings
                    </p>
                  </div>

                  {medicalReports.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🏥</span>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No medical reports yet
                      </h4>
                      <p className="text-gray-600">
                        Medical reports will be automatically generated when
                        audio transcripts are completed
                      </p>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="space-y-4">
                        {medicalReports.map((report) => (
                          <div
                            key={report.id}
                            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                          >
                            {/* Collapsed View */}
                            <div
                              className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() =>
                                setExpandedReport(
                                  expandedReport === report.id
                                    ? null
                                    : report.id
                                )
                              }
                            >
                              {/* Main Content */}
                              <div className="flex-1 p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                      <span className="text-lg">🏥</span>
                                    </div>
                                    <div className="flex-1">
                                      {renamingReport === report.id ? (
                                        <div
                                          className="space-y-2"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) =>
                                              setNewName(e.target.value)
                                            }
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                saveReportName(report.id);
                                              if (e.key === "Escape")
                                                cancelRenamingReport();
                                            }}
                                            autoFocus
                                          />
                                          <div className="flex space-x-2">
                                            <button
                                              onClick={() =>
                                                saveReportName(report.id)
                                              }
                                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={cancelRenamingReport}
                                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <h4 className="font-medium text-gray-900">
                                          {report.recordings?.title ||
                                            "Medical Report"}
                                        </h4>
                                      )}
                                      <p className="text-sm text-gray-500">
                                        {new Date(
                                          report.created_at
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}{" "}
                                        •{" "}
                                        {report.recordings?.duration
                                          ? Math.floor(
                                              report.recordings.duration / 60
                                            )
                                          : 0}
                                        :
                                        {report.recordings?.duration
                                          ? (report.recordings.duration % 60)
                                              .toString()
                                              .padStart(2, "0")
                                          : "00"}
                                      </p>
                                      <div className="flex items-center mt-1">
                                        <span
                                          className={`px-2 py-1 text-xs rounded-full font-medium ${
                                            report.status === "completed"
                                              ? "bg-green-100 text-green-800"
                                              : report.status === "processing"
                                              ? "bg-blue-100 text-blue-800"
                                              : report.status === "failed"
                                              ? "bg-red-100 text-red-800"
                                              : "bg-yellow-100 text-yellow-800"
                                          }`}
                                        >
                                          {report.status === "completed" &&
                                            "✅ Completed"}
                                          {report.status === "processing" &&
                                            "⏳ Processing..."}
                                          {report.status === "failed" &&
                                            "❌ Failed"}
                                          {report.status === "pending" &&
                                            "⏸️ Pending"}
                                        </span>
                                        {report.red_flags &&
                                          report.red_flags.length > 0 && (
                                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                              🚨 {report.red_flags.length} Red
                                              Flag
                                              {report.red_flags.length > 1
                                                ? "s"
                                                : ""}
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Action Buttons - Share, Download, Rename and Delete */}
                              <div className="flex items-center space-x-1 p-2">
                                {/* Share Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowShareModal(report.id);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Share Report"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                  </svg>
                                </button>
                                {/* Download Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadMedicalReport(report);
                                  }}
                                  disabled={report.status !== "completed"}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    report.status === "completed"
                                      ? "text-green-600 hover:bg-green-100"
                                      : "text-gray-400 cursor-not-allowed"
                                  }`}
                                  title="Download PDF"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                                {/* Rename Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startRenamingReport(
                                      report.id,
                                      report.recordings?.title ||
                                        "Medical Report"
                                    );
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Rename Report"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                {/* Delete Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteReport(
                                      report.id,
                                      report.recordings?.title ||
                                        "Medical Report"
                                    );
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                  title="Delete Report"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                                {/* Expand/Collapse Arrow */}
                                <div className="flex items-center text-gray-400">
                                  <svg
                                    className="w-5 h-5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d={
                                        expandedReport === report.id
                                          ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                          : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                      }
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Expanded View */}
                            {expandedReport === report.id && (
                              <div className="border-t border-gray-200">
                                {report.status === "completed" && (
                                  <div className="p-6">
                                    {/* Medical Report Content */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Left Column */}
                                      <div className="space-y-6">
                                        {/* Chief Complaint */}
                                        {report.chief_complaint && (
                                          <div className="bg-blue-50 rounded-lg p-4">
                                            <h5 className="text-sm font-semibold text-blue-800 mb-2">
                                              Chief Complaint
                                            </h5>
                                            <p className="text-blue-700">
                                              {report.chief_complaint}
                                            </p>
                                          </div>
                                        )}

                                        {/* Patient Demographics */}
                                        {report.patient_demographics &&
                                          Object.keys(
                                            report.patient_demographics
                                          ).length > 0 && (
                                            <div className="bg-gray-50 rounded-lg p-4">
                                              <h5 className="text-sm font-semibold text-gray-800 mb-2">
                                                Patient Demographics
                                              </h5>
                                              <div className="space-y-1 text-sm text-gray-700">
                                                {report.patient_demographics
                                                  .age && (
                                                  <p>
                                                    Age:{" "}
                                                    {
                                                      report
                                                        .patient_demographics
                                                        .age
                                                    }
                                                  </p>
                                                )}
                                                {report.patient_demographics
                                                  .gender && (
                                                  <p>
                                                    Gender:{" "}
                                                    {
                                                      report
                                                        .patient_demographics
                                                        .gender
                                                    }
                                                  </p>
                                                )}
                                                {report.patient_demographics
                                                  .other_details && (
                                                  <p>
                                                    {
                                                      report
                                                        .patient_demographics
                                                        .other_details
                                                    }
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                        {/* Red Flags */}
                                        {report.red_flags &&
                                          report.red_flags.length > 0 && (
                                            <div className="bg-red-50 rounded-lg p-4">
                                              <h5 className="text-sm font-semibold text-red-800 mb-2">
                                                🚨 Red Flags
                                              </h5>
                                              <ul className="space-y-1 text-sm text-red-700">
                                                {report.red_flags.map(
                                                  (flag, index) => (
                                                    <li key={index}>
                                                      • {flag}
                                                    </li>
                                                  )
                                                )}
                                              </ul>
                                            </div>
                                          )}
                                      </div>

                                      {/* Right Column */}
                                      <div className="space-y-6">
                                        {/* Patient Summary */}
                                        {report.patient_summary && (
                                          <div className="bg-green-50 rounded-lg p-4">
                                            <h5 className="text-sm font-semibold text-green-800 mb-2">
                                              Patient Summary
                                            </h5>
                                            <p className="text-green-700 text-sm leading-relaxed">
                                              {report.patient_summary}
                                            </p>
                                          </div>
                                        )}

                                        {/* Medical History */}
                                        {report.medical_history &&
                                          Object.keys(report.medical_history)
                                            .length > 0 && (
                                            <div className="bg-purple-50 rounded-lg p-4">
                                              <h5 className="text-sm font-semibold text-purple-800 mb-2">
                                                Medical History
                                              </h5>
                                              <div className="space-y-2 text-sm text-purple-700">
                                                {report.medical_history
                                                  .past_medical && (
                                                  <p>
                                                    <strong>
                                                      Past Medical:
                                                    </strong>{" "}
                                                    {
                                                      report.medical_history
                                                        .past_medical
                                                    }
                                                  </p>
                                                )}
                                                {report.medical_history
                                                  .medications && (
                                                  <p>
                                                    <strong>
                                                      Medications:
                                                    </strong>{" "}
                                                    {
                                                      report.medical_history
                                                        .medications
                                                    }
                                                  </p>
                                                )}
                                                {report.medical_history
                                                  .allergies && (
                                                  <p>
                                                    <strong>Allergies:</strong>{" "}
                                                    {
                                                      report.medical_history
                                                        .allergies
                                                    }
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    {/* SOAP Note */}
                                    {report.soap_note && (
                                      <div className="mt-6 bg-gray-50 rounded-lg p-4">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-3">
                                          SOAP Note
                                        </h5>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                          {report.soap_note}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {report.status === "failed" && (
                                  <div className="p-6 text-center">
                                    <div className="text-red-600 mb-2">
                                      ❌ Report generation failed
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {report.error_message ||
                                        "Unknown error occurred"}
                                    </p>
                                    <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                                      Retry Generation
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Medical Reports Tab */}
              {activeTab === "reports" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">
                      Medical Reports
                    </h3>
                    <p className="text-gray-600 mt-1">
                      Lab results, prescriptions, and medical documents
                    </p>
                  </div>

                  {reports.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📋</span>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No reports available
                      </h4>
                      <p className="text-gray-600">
                        Medical reports and documents will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {reports.map((report) => (
                        <div key={report.id} className="p-6">
                          <div className="flex items-start">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mr-4">
                              <span className="text-xl">
                                {getReportTypeIcon(report.type)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-gray-900">
                                  {report.title}
                                </h4>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${getReportTypeColor(
                                    report.type
                                  )}`}
                                >
                                  {report.type.replace("_", " ").toUpperCase()}
                                </span>
                              </div>
                              <p className="text-gray-600 mb-2">
                                {formatDate(report.date)}{" "}
                                {report.doctor_name &&
                                  `• Dr. ${report.doctor_name}`}
                              </p>
                              <p className="text-gray-700">{report.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === "timeline" && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">
                      Medical Timeline
                    </h3>
                    <p className="text-gray-600 mt-1">
                      Chronological view of all your medical activities
                    </p>
                  </div>

                  {[
                    ...recordings.map((r) => ({
                      ...r,
                      type: "recording",
                      date: r.created_at,
                    })),
                    ...reports.map((r) => ({
                      ...r,
                      type: "report",
                      date: r.date || r.created_at,
                    })),
                  ].sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  ).length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📅</span>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        No timeline data
                      </h4>
                      <p className="text-gray-600">
                        Your medical timeline will appear here as you add
                        recordings and reports
                      </p>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="space-y-6">
                        {[
                          ...recordings.map((r) => ({
                            ...r,
                            type: "recording",
                            date: r.created_at,
                          })),
                          ...reports.map((r) => ({
                            ...r,
                            type: "report",
                            date: r.date || r.created_at,
                          })),
                        ]
                          .sort(
                            (a, b) =>
                              new Date(b.date).getTime() -
                              new Date(a.date).getTime()
                          )
                          .map((item, index, arr) => (
                            <div
                              key={`${item.type}-${item.id}`}
                              className="flex"
                            >
                              <div className="flex flex-col items-center mr-4">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    item.type === "recording"
                                      ? "bg-blue-100"
                                      : "bg-green-100"
                                  }`}
                                >
                                  <span className="text-lg">
                                    {item.type === "recording"
                                      ? "🎙️"
                                      : getReportTypeIcon(
                                          (item as MedicalReport).type
                                        )}
                                  </span>
                                </div>
                                {index < arr.length - 1 && (
                                  <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-8">
                                <h4 className="text-lg font-medium text-gray-900">
                                  {item.title}
                                </h4>
                                <p className="text-gray-600 text-sm mb-2">
                                  {formatDate(item.date)}
                                </p>
                                {item.type === "recording" && (
                                  <p className="text-gray-700">
                                    Recording •{" "}
                                    {formatTime((item as Recording).duration)}
                                    {(item as Recording).summary && (
                                      <span className="block mt-1 text-sm">
                                        {(item as Recording).summary?.substring(
                                          0,
                                          100
                                        )}
                                        ...
                                      </span>
                                    )}
                                  </p>
                                )}
                                {item.type === "report" && (
                                  <p className="text-gray-700">
                                    {(item as MedicalReport).content.substring(
                                      0,
                                      150
                                    )}
                                    ...
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case "patients":
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Patients
              </h1>
              <p className="text-gray-600 mb-8">Manage your patients</p>
              <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">👤</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Patient Management
                </h3>
                <p className="text-gray-600">
                  Patient management features coming soon.
                </p>
              </div>
            </div>
          </div>
        );
      case "care-plans":
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Care Plans
              </h1>
              <p className="text-gray-600 mb-8">
                Manage care plans for your patients
              </p>
              <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📋</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Care Plans
                </h3>
                <p className="text-gray-600">
                  Care plan management features coming soon.
                </p>
              </div>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Settings
              </h1>
              <p className="text-gray-600 mb-8">Manage your account settings</p>
              <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Settings
                </h3>
                <p className="text-gray-600">
                  Account settings will be available here.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Dashboard
                </h1>
                <p className="text-gray-600">
                  Welcome back to your Medical Companion dashboard
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                  onClick={() => setActiveView("recordings")}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">🎙️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Recordings
                      </h3>
                      <p className="text-gray-600">View & manage</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView("reports")}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Reports
                      </h3>
                      <p className="text-gray-600">Medical history</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    setActiveView(
                      profile?.user_type === "patient"
                        ? "caregivers"
                        : "patients"
                    )
                  }
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                      <span className="text-xl">👥</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {profile?.user_type === "patient"
                          ? "Caregivers"
                          : "Patients"}
                      </h3>
                      <p className="text-gray-600">Manage access</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Voice Recorder - Can be shown for all users for now */}
              <div className="mb-8">
                <VoiceRecorder userId={userId} />
              </div>

              {/* Recent Activity */}
              <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Recent Medical Activity
                </h2>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Your Medical Dashboard
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Record your doctor visits, manage caregivers, and track your
                    medical history using the sidebar navigation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed and persistent */}
      <Sidebar
        userType={profile.user_type}
        userName={profile.full_name}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area - Only this changes */}
      <main className="flex-1 ml-64 min-h-screen">{renderMainContent()}</main>

      {/* Apple Error Notification */}
      {notification && (
        <AppleErrorNotification
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(null)}
          duration={5000}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Share Medical Report
                </h3>
                <button
                  onClick={() => setShowShareModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Caregiver Selection */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">
                    Select Caregivers ({selectedCaregivers.length} selected)
                  </h4>
                  {caregivers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">👥</div>
                      <p>Loading caregivers...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {caregivers.map((caregiver) => (
                        <div
                          key={caregiver.id}
                          className={`flex items-start p-3 rounded-lg border-2 transition-all cursor-pointer ${
                            selectedCaregivers.includes(caregiver.id)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-gray-50 hover:border-gray-300"
                          }`}
                          onClick={() => toggleCaregiverSelection(caregiver.id)}
                        >
                          <input
                            type="checkbox"
                            id={`caregiver-${caregiver.id}`}
                            checked={selectedCaregivers.includes(caregiver.id)}
                            onChange={() =>
                              toggleCaregiverSelection(caregiver.id)
                            }
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
                          />
                          <label
                            htmlFor={`caregiver-${caregiver.id}`}
                            className="ml-3 flex-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-gray-900 text-sm leading-tight">
                                {caregiver.full_name}
                              </div>
                              {caregiver.status && (
                                <span
                                  className={`px-2 py-1 text-xs rounded-full ${
                                    caregiver.status === "accepted"
                                      ? "bg-green-100 text-green-800"
                                      : caregiver.status === "pending"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {caregiver.status === "accepted" && "✅"}
                                  {caregiver.status === "pending" && "⏳"}
                                  {caregiver.status === "declined" && "❌"}
                                  {caregiver.status}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {caregiver.specialty || caregiver.user_type}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {caregiver.email}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attach Transcript Option */}
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeTranscript"
                      checked={includeTranscript}
                      onChange={(e) => setIncludeTranscript(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="includeTranscript"
                      className="ml-3 text-gray-900"
                    >
                      Include transcript with medical report
                    </label>
                  </div>
                </div>

                {/* Email Sharing Section */}
                <div>
                  <button
                    onClick={() => setShareEmailExpanded(!shareEmailExpanded)}
                    className="flex items-center justify-between w-full p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-medium text-blue-900">
                      Share via Email
                    </span>
                    <svg
                      className={`w-5 h-5 text-blue-700 transition-transform ${
                        shareEmailExpanded ? "rotate-180" : ""
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {shareEmailExpanded && (
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
                      <div>
                        <label
                          htmlFor="emailAddress"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="emailAddress"
                          placeholder="Enter caregiver's email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="customMessage"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Custom Message (Optional)
                        </label>
                        <textarea
                          id="customMessage"
                          placeholder="Add a personal message..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={sendEmailReport}
                        disabled={sendingEmail}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {sendingEmail ? "Sending..." : "Send Email"}
                      </button>
                      <p className="text-xs text-gray-500">
                        📧 Professional medical report will be sent via email
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={resetShareModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedCaregivers.length === 0) {
                      showNotification(
                        "Please select at least one caregiver",
                        "error"
                      );
                      return;
                    }
                    showNotification(
                      `Report will be shared with ${
                        selectedCaregivers.length
                      } caregiver(s)${
                        includeTranscript ? " (including transcript)" : ""
                      }`,
                      "success"
                    );
                    resetShareModal();
                  }}
                  disabled={selectedCaregivers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Share with {selectedCaregivers.length} Caregiver
                  {selectedCaregivers.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
