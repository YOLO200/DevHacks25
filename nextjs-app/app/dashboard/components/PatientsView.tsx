"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface PatientInvitation {
  id: string;
  patient_id: string;
  caregiver_email: string;
  caregiver_name: string;
  relationship: string;
  permissions: string[];
  status: "pending" | "accepted" | "declined";
  created_at: string;
  patient_name?: string;
  patient_email?: string;
}

interface ExistingPatient {
  id: string;
  patient_id: string;
  caregiver_email: string;
  caregiver_name: string;
  relationship: string;
  permissions: string[];
  status: "accepted";
  created_at: string;
  patient_name?: string;
  patient_email?: string;
}

export default function PatientsView() {
  const [invitations, setInvitations] = useState<PatientInvitation[]>([]);
  const [existingPatients, setExistingPatients] = useState<ExistingPatient[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string;
    user_type: "patient" | "caregiver";
    email: string;
  } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<ExistingPatient | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const supabase = createClient();

  const availablePermissions = [
    {
      id: "view_recordings",
      label: "View Recordings",
      description: "Access to recorded appointments",
    },
    {
      id: "view_reports",
      label: "View Reports",
      description: "Access to medical reports and history",
    },
    {
      id: "receive_notifications",
      label: "Receive Notifications",
      description: "Get updates about appointments and health changes",
    },
    {
      id: "emergency_contact",
      label: "Emergency Contact",
      description: "Can be contacted in case of emergency",
    },
  ];

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("full_name, user_type, email")
          .eq("id", user.id)
          .single();

        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [supabase]);

  const fetchPatientData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !profile?.email) {
        return;
      }


      // First, let's check if there are any caregiver_relationships at all
      const { data: allRelationships, error: allError } = await supabase
        .from("caregiver_relationships")
        .select("*");

      if (allError)
        console.error("Error fetching all relationships:", allError);

      // Fetch invitations where caregiver_email matches current user's email and status is pending
      const { data: invitationData, error: invitationError } = await supabase
        .from("caregiver_relationships")
        .select("*")
        .eq("caregiver_email", profile.email)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (invitationError) throw invitationError;

      // Fetch accepted relationships
      const { data: acceptedData, error: acceptedError } = await supabase
        .from("caregiver_relationships")
        .select("*")
        .eq("caregiver_email", profile.email)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (acceptedError) throw acceptedError;

      // Fetch patient profiles separately using patient_id
      const patientIds = [
        ...(invitationData || []).map((inv) => inv.patient_id),
        ...(acceptedData || []).map((acc) => acc.patient_id),
      ];


      let patientProfiles = {};
      if (patientIds.length > 0) {
        // First, let's try to fetch all user profiles to see what's available
        const { data: allProfiles, error: allProfilesError } = await supabase
          .from("user_profiles")
          .select("id, full_name, email, user_type");


        // Now try to fetch the specific patient profiles
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", patientIds);

        if (profilesError)
          console.error("Error fetching patient profiles:", profilesError);

        // Create a lookup object
        patientProfiles = (profiles || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});

      }

      // Transform the data to include patient information
      const transformedInvitations = (invitationData || []).map(
        (invitation) => {
          const patientProfile = patientProfiles[invitation.patient_id];
          return {
            ...invitation,
            patient_name: patientProfile?.full_name || "Unknown Patient",
            patient_email: patientProfile?.email || "Unknown Email",
          };
        }
      );

      const transformedAccepted = (acceptedData || []).map((patient) => {
        const patientProfile = patientProfiles[patient.patient_id];
        return {
          ...patient,
          patient_name: patientProfile?.full_name || "Unknown Patient",
          patient_email: patientProfile?.email || "Unknown Email",
        };
      });


      setInvitations(transformedInvitations);
      setExistingPatients(transformedAccepted);
    } catch (error) {
      console.error("Error fetching patient data:", error);
    }
  }, [supabase, profile?.email]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile?.email) {
      fetchPatientData();
    }
  }, [fetchPatientData, profile?.email]);

  const handleInvitationResponse = async (
    invitationId: string,
    response: "accepted" | "declined"
  ) => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("caregiver_relationships")
        .update({
          status: response,
          // If accepting, we could also update caregiver_id to link to the user account
          // But for now, we'll keep it email-based
        })
        .eq("id", invitationId);

      if (error) throw error;

      await fetchPatientData();

      if (response === "accepted") {
        alert(
          "Invitation accepted! You can now access this patient's information."
        );
      } else {
        alert("Invitation declined.");
      }
    } catch (error) {
      console.error("Error responding to invitation:", error);
      alert("Failed to respond to invitation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const removePatientRelationship = async (
    relationshipId: string,
    patientName: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to stop caring for ${patientName}? This will remove your access to their information.`
      )
    )
      return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("caregiver_relationships")
        .delete()
        .eq("id", relationshipId);

      if (error) throw error;

      await fetchPatientData();
      alert("Relationship removed successfully.");
    } catch (error) {
      console.error("Error removing relationship:", error);
      alert("Failed to remove relationship. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const viewPatientProfile = (patientId: string) => {
    const patient = existingPatients.find(p => p.patient_id === patientId);
    if (patient) {
      setSelectedPatient(patient);
      setShowProfileModal(true);
    }
  };

  const viewPatientReports = (patientId: string) => {
    window.location.href = '/reports';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "declined":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (profile.user_type !== "caregiver") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            This page is only accessible to caregivers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            My Patients
          </h1>
          <p className="text-gray-600">
            Manage your patient relationships and respond to invitations
          </p>
        </div>



        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">📬</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Invitations
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {invitations.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">🤝</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Patients
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {existingPatients.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Relationships
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {invitations.length + existingPatients.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Pending Invitations
              </h3>
              <p className="text-gray-600 mt-1">
                Patients who have invited you to be their caregiver
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xl mr-4">
                        👤
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {invitation.patient_name}
                        </h4>
                        <p className="text-gray-600">
                          {invitation.patient_email}
                        </p>
                        <p className="text-sm text-gray-500">
                          Relationship: {invitation.relationship}
                        </p>
                        <p className="text-xs text-gray-400">
                          Invited on{" "}
                          {new Date(
                            invitation.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          invitation.status
                        )}`}
                      >
                        {invitation.status}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            handleInvitationResponse(
                              invitation.id,
                              "accepted"
                            )
                          }
                          disabled={isLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            handleInvitationResponse(
                              invitation.id,
                              "declined"
                            )
                          }
                          disabled={isLoading}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>

                  {invitation.permissions &&
                    invitation.permissions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Requested Permissions:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {invitation.permissions.map(
                            (permission: string) => {
                              const permissionData =
                                availablePermissions.find(
                                  (p) => p.id === permission
                                );
                              return (
                                <span
                                  key={permission}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                                >
                                  {permissionData?.label || permission}
                                </span>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Patients Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">My Patients</h3>
            <p className="text-gray-600 mt-1">
              Patients you are currently caring for
            </p>
          </div>

          {existingPatients.length === 0 && invitations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No patients yet
              </h4>
              <p className="text-gray-600 mb-6">
                Patients will need to invite you to become their caregiver.
                Once invited, you&apos;ll see their invitations here.
              </p>
            </div>
          ) : existingPatients.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No active patients
              </h4>
              <p className="text-gray-600">
                You have pending invitations above. Accept them to start
                caring for patients.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {existingPatients.map((patient) => (
                <div key={patient.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-white text-xl mr-4">
                        🤝
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {patient.patient_name}
                        </h4>
                        <p className="text-sm text-gray-500 capitalize">
                          Relationship: {patient.relationship}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          patient.status
                        )}`}
                      >
                        {patient.status}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            viewPatientProfile(patient.patient_id)
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() =>
                            viewPatientReports(patient.patient_id)
                          }
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          View Reports
                        </button>
                        <button
                          onClick={() =>
                            removePatientRelationship(
                              patient.id,
                              patient.patient_name || "this patient"
                            )
                          }
                          disabled={isLoading}
                          className="w-10 h-10 flex items-center justify-center text-lg hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                          title="Remove relationship"
                        >
                          <span className="group-hover:scale-110 transition-transform">🗑️</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {patient.permissions && patient.permissions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Your Permissions:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {patient.permissions.map((permission: string) => {
                          const permissionData = availablePermissions.find(
                            (p) => p.id === permission
                          );
                          return (
                            <span
                              key={permission}
                              className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md"
                            >
                              {permissionData?.label || permission}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient Profile Modal */}
        {showProfileModal && selectedPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">Patient Profile</h3>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Patient Basic Info */}
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl mr-4">
                    🤝
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{selectedPatient.patient_name}</h4>
                    <p className="text-gray-600">{selectedPatient.patient_email}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      Relationship: {selectedPatient.relationship}
                    </p>
                  </div>
                </div>

                {/* Connection Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Connection Details</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Connected Since:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(selectedPatient.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPatient.status)}`}>
                        {selectedPatient.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Caregiver:</span>
                      <span className="text-sm text-gray-900">{selectedPatient.caregiver_name}</span>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                {selectedPatient.permissions && selectedPatient.permissions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Your Permissions</h5>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedPatient.permissions.map((permission: string) => {
                        const permissionData = availablePermissions.find(p => p.id === permission);
                        return (
                          <div key={permission} className="flex items-start p-3 bg-emerald-50 rounded-lg">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <div>
                              <p className="text-sm font-medium text-emerald-800">
                                {permissionData?.label || permission}
                              </p>
                              <p className="text-xs text-emerald-600">
                                {permissionData?.description || 'Permission granted'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      viewPatientReports(selectedPatient.patient_id);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Reports & Recordings
                  </button>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}