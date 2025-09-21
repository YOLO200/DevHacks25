"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppleErrorNotification from "@/components/AppleErrorNotification";
import Sidebar from "@/components/Sidebar";

interface SharedReport {
  id: string;
  transcript_id: string;
  recording_id: string;
  user_id: string;
  patient_demographics: any;
  chief_complaint: string;
  hpi_details: any;
  medical_history: any;
  soap_note: string;
  red_flags: string[];
  patient_summary: string;
  status: string;
  error_message: string;
  shared_caregivers: string[];
  created_at: string;
  updated_at: string;
  recordings?: {
    id: string;
    title: string;
    duration: number;
    created_at: string;
  };
  transcripts?: {
    transcription_text: string;
    structured_transcript: string;
  };
}

interface SharedTranscript {
  id: string;
  recording_id: string;
  user_id: string;
  transcription_text: string;
  structured_transcript: string;
  status: string;
  created_at: string;
  updated_at: string;
  retry_count: number;
  recordings?: {
    id: string;
    title: string;
    duration: number;
    created_at: string;
  };
}

interface SharedRecording {
  id: string;
  title: string;
  duration: number;
  created_at: string;
  type: string;
  date: string;
}

type ActiveTab = "medical-reports" | "transcripts" | "timeline";

interface UserProfile {
  full_name: string;
  user_type: "patient" | "caregiver";
  email: string;
}

export default function SharedReportsPage() {
  const [sharedReports, setSharedReports] = useState<SharedReport[]>([]);
  const [sharedTranscripts, setSharedTranscripts] = useState<
    SharedTranscript[]
  >([]);
  const [sharedRecordings, setSharedRecordings] = useState<SharedRecording[]>(
    []
  );
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(
    null
  );
  const [structuredView, setStructuredView] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("medical-reports");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "warning" | "success";
    isVisible: boolean;
  } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  // Fetch shared medical reports
  const fetchSharedReports = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && userEmail) {
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
            ),
            transcripts (
              transcription_text,
              structured_transcript
            )
          `
          )
          .contains("shared_caregivers", [userEmail])
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching shared reports:", error);
          setSharedReports([]);
          return;
        }

        console.log(
          `📊 [SHARED REPORTS] Fetched ${data?.length || 0} shared medical reports`
        );
        setSharedReports((data || []) as unknown as SharedReport[]);
      }
    } catch (error) {
      console.error("Error fetching shared reports:", error);
      setSharedReports([]);
    }
  }, [supabase, userEmail]);

  // Fetch shared transcripts
  const fetchSharedTranscripts = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && userEmail) {
        // First get recordings that have been shared with this caregiver
        const { data: sharedRecordings, error: recordingsError } =
          await supabase
            .from("recordings")
            .select(
              `
              id,
              title,
              duration,
              created_at,
              shared_caregivers
            `
            )
            .contains("shared_caregivers", [userEmail]);

        if (recordingsError) {
          console.error("Error fetching shared recordings:", recordingsError);
          setSharedRecordings([]);
          setSharedTranscripts([]);
          return;
        }

        if (sharedRecordings && sharedRecordings.length > 0) {
          // Transform recordings to match expected format
          const transformedRecordings = sharedRecordings.map((recording) => ({
            ...recording,
            type: "appointment",
            date: recording.created_at,
          }));
          setSharedRecordings(transformedRecordings);

          // Now get transcripts for these shared recordings
          const recordingIds = sharedRecordings.map((r) => r.id);
          const { data: transcripts, error: transcriptsError } = await supabase
            .from("transcripts")
            .select(
              `
                id,
                recording_id,
                user_id,
                transcription_text,
                structured_transcript,
                status,
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
            .in("recording_id", recordingIds)
            .order("created_at", { ascending: false });

          if (transcriptsError) {
            console.error(
              "Error fetching shared transcripts:",
              transcriptsError
            );
            setSharedTranscripts([]);
            return;
          }

          console.log(
            `📝 [SHARED REPORTS] Fetched ${transcripts?.length || 0} shared transcripts`
          );
          setSharedTranscripts(
            (transcripts || []) as unknown as SharedTranscript[]
          );
        } else {
          setSharedRecordings([]);
          setSharedTranscripts([]);
        }
      }
    } catch (error) {
      console.error("Error fetching shared transcripts:", error);
      setSharedTranscripts([]);
      setSharedRecordings([]);
    }
  }, [supabase, userEmail]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Get user profile to get email and profile info
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("email, full_name, user_type")
          .eq("id", user.id)
          .single();

        if (!userProfile?.email) {
          showNotification("Unable to verify user email", "error");
          return;
        }

        // Redirect non-caregivers to regular dashboard
        if (userProfile.user_type !== "caregiver") {
          router.push("/dashboard");
          return;
        }

        setUserEmail(userProfile.email);
        setProfile({
          full_name: userProfile.full_name,
          user_type: userProfile.user_type,
          email: userProfile.email,
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        showNotification("Failed to load user data", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndData();
  }, [supabase, router]);

  // Fetch data when tab changes
  useEffect(() => {
    if (userEmail) {
      if (activeTab === "medical-reports") {
        fetchSharedReports();
      } else if (activeTab === "transcripts" || activeTab === "timeline") {
        fetchSharedTranscripts();
      }
    }
  }, [activeTab, userEmail, fetchSharedReports, fetchSharedTranscripts]);

  // Notification function
  const showNotification = (
    message: string,
    type: "error" | "warning" | "success"
  ) => {
    setNotification({ message, type, isVisible: true });
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleReport = (reportId: string) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  const toggleTranscript = (transcriptId: string) => {
    setExpandedTranscript(
      expandedTranscript === transcriptId ? null : transcriptId
    );
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Callback functions for RecordingsTimelineView component
  const onTranscriptRetry = async (transcriptId: string) => {
    // For shared transcripts, we might not allow retry
    showNotification("Retry not available for shared transcripts", "warning");
  };

  const onTranscriptRename = async (transcriptId: string, newName: string) => {
    // For shared transcripts, we might not allow rename
    showNotification("Rename not available for shared transcripts", "warning");
  };

  const onTranscriptDelete = async (transcriptId: string, title: string) => {
    // For shared transcripts, we might not allow delete
    showNotification("Delete not available for shared transcripts", "warning");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shared reports...</p>
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
        activeView="reports"
        onViewChange={(view) => {
          if (view === "reports") {
            // Stay on shared reports page
            return;
          } else if (view === "dashboard") {
            router.push("/dashboard");
          } else {
            // For other views, navigate to dashboard with that view
            router.push(`/dashboard?view=${view}`);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 min-h-screen">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Shared Reports & History
                </h1>
                <p className="text-gray-600">
                  Medical reports and transcripts shared with you by patients
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tab Navigation */}
          <div className="mb-8">
            <nav className="flex space-x-8">
              {[
                { id: "medical-reports", label: "Medical Reports", icon: "🏥" },
                { id: "transcripts", label: "Transcripts", icon: "📝" },
                { id: "timeline", label: "Timeline", icon: "📅" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
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

          {/* Medical Reports Tab */}
          {activeTab === "medical-reports" && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Shared Medical Reports
                </h3>
                <p className="text-gray-600 mt-1">
                  Medical reports shared with you by patients
                </p>
              </div>

              {sharedReports.length === 0 ? (
                <div className="p-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-2xl">🏥</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No shared reports yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Medical reports shared with you will appear here.
                    </p>
                    <p className="text-sm text-gray-500">
                      Your email: {userEmail}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="space-y-4">
                    {sharedReports.map((report) => (
                      <div
                        key={report.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div
                          className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer p-4"
                          onClick={() => toggleReport(report.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">🏥</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {report.recordings?.title || "Medical Report"}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {formatDate(report.created_at)}
                                </p>
                                <div className="flex items-center mt-1">
                                  <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                                    Shared Report
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedReport === report.id ? "rotate-180" : ""
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
                          </div>
                        </div>

                        {expandedReport === report.id && (
                          <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="space-y-6">
                              {report.chief_complaint && (
                                <div>
                                  <h5 className="font-semibold text-gray-900 mb-2">
                                    Chief Complaint
                                  </h5>
                                  <p className="text-gray-700 leading-relaxed">
                                    {report.chief_complaint}
                                  </p>
                                </div>
                              )}

                              {report.patient_summary && (
                                <div>
                                  <h5 className="font-semibold text-gray-900 mb-2">
                                    Patient Summary
                                  </h5>
                                  <p className="text-gray-700 leading-relaxed">
                                    {report.patient_summary}
                                  </p>
                                </div>
                              )}

                              {report.red_flags &&
                                report.red_flags.length > 0 && (
                                  <div>
                                    <h5 className="font-semibold text-red-900 mb-2">
                                      🚨 Red Flags
                                    </h5>
                                    <ul className="space-y-2">
                                      {report.red_flags.map((flag, index) => (
                                        <li
                                          key={index}
                                          className="flex items-start space-x-2"
                                        >
                                          <span className="text-red-500 mt-1">
                                            •
                                          </span>
                                          <span className="text-red-700">
                                            {flag}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                              {report.soap_note && (
                                <div>
                                  <h5 className="font-semibold text-gray-900 mb-2">
                                    SOAP Note
                                  </h5>
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                                      {report.soap_note}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transcripts Tab */}
          {activeTab === "transcripts" && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Shared Transcripts
                </h3>
                <p className="text-gray-600 mt-1">
                  Conversation transcripts shared with you by patients
                </p>
              </div>

              {sharedTranscripts.length === 0 ? (
                <div className="p-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-2xl">📝</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No shared transcripts yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Conversation transcripts shared with you will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="space-y-4">
                    {sharedTranscripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div
                          className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer p-4"
                          onClick={() => toggleTranscript(transcript.id)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">📝</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {transcript.recordings?.title ||
                                    "Conversation Transcript"}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {formatDate(transcript.created_at)}
                                  {transcript.recordings?.duration && (
                                    <span className="ml-2">
                                      •{" "}
                                      {formatTime(
                                        transcript.recordings.duration
                                      )}
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center mt-1">
                                  <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                                    Shared Transcript
                                  </span>
                                  <span
                                    className={`ml-2 px-2 py-1 text-xs rounded-full font-medium ${
                                      transcript.status === "completed"
                                        ? "bg-green-100 text-green-800"
                                        : transcript.status === "processing"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {transcript.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedTranscript === transcript.id
                                  ? "rotate-180"
                                  : ""
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
                          </div>
                        </div>

                        {expandedTranscript === transcript.id && (
                          <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="space-y-4">
                              {transcript.structured_transcript ? (
                                <div>
                                  <h5 className="font-semibold text-gray-900 mb-2">
                                    Structured Transcript
                                  </h5>
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                      {transcript.structured_transcript}
                                    </pre>
                                  </div>
                                </div>
                              ) : transcript.transcription_text ? (
                                <div>
                                  <h5 className="font-semibold text-gray-900 mb-2">
                                    Raw Transcript
                                  </h5>
                                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                      {transcript.transcription_text}
                                    </pre>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-gray-500">
                                    Transcript content is not available yet.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Shared Recordings Timeline
                </h3>
                <p className="text-gray-600 mt-1">
                  Recordings shared with you by patients in chronological order
                </p>
              </div>

              {sharedRecordings.length === 0 ? (
                <div className="p-6">
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-2xl">📅</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No shared recordings yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Recordings shared with you will appear here in timeline
                      format.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="space-y-4">
                    {sharedRecordings.map((recording) => (
                      <div
                        key={recording.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center p-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">🎙️</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  {recording.title}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {formatDate(recording.created_at)}
                                  {recording.duration && (
                                    <span className="ml-2">
                                      • {formatTime(recording.duration)}
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center mt-1">
                                  <span className="px-2 py-1 text-xs rounded-full font-medium bg-purple-100 text-purple-800">
                                    Shared Recording
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Apple Error Notification */}
      {notification && (
        <AppleErrorNotification
          message={notification.message}
          type={notification.type}
          isVisible={notification.isVisible}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
