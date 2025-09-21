"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import VoiceRecorder from "@/components/VoiceRecorder";

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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

      {/* Main Content Area */}
      <div className="flex-1 ml-64">

        {/* Dashboard Content */}
        {activeView === "dashboard" && (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {profile.user_type === "patient"
                    ? "Patient Dashboard"
                    : "Caregiver Dashboard"}
                </h1>
                <p className="text-gray-600">
                  Welcome back, {profile.full_name}
                </p>
              </div>

              {/* Voice Recorder - Only for Patients */}
              {profile.user_type === "patient" && (
                <div className="mb-8">
                  <VoiceRecorder userId={userId} />
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {profile.user_type === "patient"
                    ? "Recent Medical Activity"
                    : "Patient Overview"}
                </h2>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">
                      {profile.user_type === "patient" ? "📋" : "👥"}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {profile.user_type === "patient"
                      ? "Your Medical Dashboard"
                      : "Caregiver Dashboard"}
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    {profile.user_type === "patient"
                      ? "Record your doctor visits, manage caregivers, and track your medical history using the sidebar navigation."
                      : "Monitor your patients, view their medical information, and coordinate care activities."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Caregivers View - Only for Patients */}
        {activeView === "caregivers" && profile.user_type === "patient" && (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Caregivers</h1>
              <p className="text-gray-600">Manage your caregivers here.</p>
            </div>
          </div>
        )}

        {/* Other views would be handled here */}
      </div>
    </div>
  );
}