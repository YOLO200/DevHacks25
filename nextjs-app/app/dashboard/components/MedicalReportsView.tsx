"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import jsPDF from "jspdf";

interface MedicalReport {
  id: string;
  title: string;
  type: "appointment" | "lab_result" | "prescription" | "diagnosis";
  content: string;
  date: string;
  doctor_name?: string;
  created_at: string;
  recording_id?: string;
  recordings?: {
    title: string;
    created_at: string;
  };
  summary?: string;
  diagnosis?: string;
  treatment_recommendations?: string[];
  red_flags?: string[];
  soap_note?: string;
  chief_complaint?: string;
  patient_summary?: string;
  shared_caregivers?: string[];
}

interface Caregiver {
  id: string;
  caregiver_name: string;
  caregiver_email: string;
  relationship: string;
  status: string;
}

interface MedicalReportsViewProps {
  medicalReports: MedicalReport[];
  caregivers: Caregiver[];
  userId: string;
  onReportsUpdate: () => void;
  showNotification: (
    message: string,
    type: "error" | "warning" | "success"
  ) => void;
}

export default function MedicalReportsView({
  medicalReports,
  caregivers,
  userId,
  onReportsUpdate,
  showNotification,
}: MedicalReportsViewProps) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [shareEmailExpanded, setShareEmailExpanded] = useState(false);
  const [selectedCaregivers, setSelectedCaregivers] = useState<string[]>([]);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [shareTranscript, setShareTranscript] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [renamingReport, setRenamingReport] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>("");

  const supabase = createClient();

  const getSharedCaregiverNames = (sharedEmails: string[] = []) => {
    return sharedEmails
      .map(email => {
        const caregiver = caregivers.find(c => c.caregiver_email === email);
        return caregiver ? caregiver.caregiver_name : email;
      })
      .join(", ");
  };

  const getAvailableCaregivers = (report: MedicalReport) => {
    const sharedEmails = report.shared_caregivers || [];
    return caregivers.filter(c =>
      c.status === "accepted" && !sharedEmails.includes(c.caregiver_email)
    );
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleReport = (reportId: string) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

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
      onReportsUpdate();
    } catch (error) {
      console.error("Error renaming report:", error);
      showNotification("Failed to rename report", "error");
    }
  };

  const cancelRenamingReport = () => {
    setRenamingReport(null);
    setNewName("");
  };

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
      onReportsUpdate();
    } catch (error) {
      console.error("Error deleting medical report:", error);
      showNotification("Failed to delete medical report", "error");
    }
  };

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
    setShareTranscript(false);
    setShareEmailExpanded(false);
    setEmailAddress("");
    setCustomMessage("");
    setShowShareModal(null);
  };

  const shareWithSelectedCaregivers = async () => {
    if (selectedCaregivers.length === 0) {
      showNotification("Please select at least one caregiver", "error");
      return;
    }

    if (!showShareModal) {
      showNotification("No report selected", "error");
      return;
    }

    setSendingEmail(true);

    try {
      // Get caregiver emails from selected caregiver IDs
      const caregiverEmails = caregivers
        .filter((caregiver) => selectedCaregivers.includes(caregiver.id))
        .map((caregiver) => caregiver.caregiver_email);

      if (caregiverEmails.length === 0) {
        throw new Error("No valid caregiver emails found");
      }

      const response = await fetch("/api/send-medical-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: showShareModal,
          caregiverEmails,
          includeTranscript,
          shareTranscript,
          customMessage: customMessage.trim() || undefined,
          recipientName: "Healthcare Provider",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      showNotification(
        `Report shared successfully with ${caregiverEmails.length} caregiver(s)!`,
        "success"
      );
      resetShareModal();
    } catch (error) {
      console.error("Error sharing with caregivers:", error);
      showNotification(
        (error as Error).message || "Failed to share report",
        "error"
      );
    } finally {
      setSendingEmail(false);
    }
  };

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
          shareTranscript,
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
      showNotification(
        (error as Error).message || "Failed to send email",
        "error"
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const downloadMedicalReport = (report: MedicalReport) => {
    const pdf = new jsPDF();

    const title = report.recordings?.title || "Medical Report";
    const date = new Date(report.created_at).toLocaleDateString();

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("🏥 AI Medical Report", 20, 20);

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, 20, 35);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${date}`, 20, 45);

    let yPosition = 60;
    const lineHeight = 7;
    const pageHeight = pdf.internal.pageSize.height;

    if (report.summary) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Summary:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const summaryText = pdf.splitTextToSize(report.summary, 170);

      for (let i = 0; i < summaryText.length; i++) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(summaryText[i], 20, yPosition);
        yPosition += lineHeight;
      }
      yPosition += 10;
    }

    if (report.diagnosis) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Diagnosis:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const diagnosisText = pdf.splitTextToSize(report.diagnosis, 170);

      for (let i = 0; i < diagnosisText.length; i++) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(diagnosisText[i], 20, yPosition);
        yPosition += lineHeight;
      }
      yPosition += 10;
    }

    if (
      report.treatment_recommendations &&
      report.treatment_recommendations.length > 0
    ) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("💊 Treatment Recommendations:", 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      report.treatment_recommendations.forEach((rec: string) => {
        const recText = pdf.splitTextToSize(`• ${rec}`, 170);
        pdf.text(recText, 25, yPosition);
        yPosition += recText.length * lineHeight + 3;
      });
      yPosition += 5;
    }

    if (report.red_flags && report.red_flags.length > 0) {
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

      for (let i = 0; i < soapText.length; i++) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(soapText[i], 20, yPosition);
        yPosition += lineHeight;
      }
    }

    const fileName = `medical-report-${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">Medical Reports</h3>
        <p className="text-gray-600 mt-1">
          AI-generated medical reports from your voice recordings
        </p>
      </div>

      {medicalReports.length === 0 ? (
        <div className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">🏥</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No medical reports yet
            </h3>
            <p className="text-gray-600 mb-6">
              Your AI-generated medical reports will appear here after voice
              recordings are processed.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="space-y-4">
            {medicalReports.map((report) => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="flex items-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggleReport(report.id)}
                >
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">
                            {getReportTypeIcon(report.type)}
                          </span>
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
                                onChange={(e) => setNewName(e.target.value)}
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
                                  onClick={() => saveReportName(report.id)}
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
                              {report.recordings?.title}
                            </h4>
                          )}
                          <p className="text-sm text-gray-500">
                            {formatDate(report.created_at)}
                          </p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span
                              className={`px-2 py-1 text-xs rounded-full font-medium ${getReportTypeColor(report.type)}`}
                            >
                              {report.type
                                ?.replace("_", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase()) ||
                                "Report"}
                            </span>
                            {report.shared_caregivers && report.shared_caregivers.length > 0 && (
                              <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                                ✓ Shared with {getSharedCaregiverNames(report.shared_caregivers)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenamingReport(
                          report.id,
                          report.recordings?.title || "Medical Report"
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMedicalReport(report);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShareModal(report.id);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteReport(
                          report.id,
                          report.recordings?.title || "Medical Report"
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
                          d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
                          clipRule="evenodd"
                        />
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {expandedReport === report.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="space-y-6">
                      {report.chief_complaint && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            🩺 Chief Complaint
                          </h5>
                          <p className="text-gray-700 leading-relaxed">
                            {report.chief_complaint}
                          </p>
                        </div>
                      )}

                      {report.patient_summary && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            📄 Patient Summary
                          </h5>
                          <p className="text-gray-700 leading-relaxed">
                            {report.patient_summary}
                          </p>
                        </div>
                      )}

                      {report.summary && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            📄 Summary
                          </h5>
                          <p className="text-gray-700 leading-relaxed">
                            {report.summary}
                          </p>
                        </div>
                      )}

                      {report.diagnosis && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            🩺 Diagnosis
                          </h5>
                          <p className="text-gray-700 leading-relaxed">
                            {report.diagnosis}
                          </p>
                        </div>
                      )}

                      {report.treatment_recommendations &&
                        report.treatment_recommendations.length > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-900 mb-2">
                              💊 Treatment Recommendations
                            </h5>
                            <ul className="space-y-2">
                              {report.treatment_recommendations.map(
                                (rec, index) => (
                                  <li
                                    key={index}
                                    className="flex items-start space-x-2"
                                  >
                                    <span className="text-blue-500 mt-1">
                                      •
                                    </span>
                                    <span className="text-gray-700">{rec}</span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                      {report.red_flags && report.red_flags.length > 0 && (
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
                                <span className="text-red-500 mt-1">•</span>
                                <span className="text-red-700">{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.soap_note && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            📋 SOAP Note
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Share Medical Report
              </h3>
              <button
                onClick={resetShareModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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

            {/* Caregivers Section */}
            {(() => {
              const currentReport = medicalReports.find(r => r.id === showShareModal);
              const availableCaregivers = currentReport ? getAvailableCaregivers(currentReport) : [];
              const sharedCaregivers = currentReport?.shared_caregivers || [];

              return caregivers.length > 0 ? (
                <div className="mb-6">
                  {sharedCaregivers.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <h5 className="text-sm font-medium text-green-800 mb-1">
                        ✓ Already shared with:
                      </h5>
                      <p className="text-sm text-green-700">
                        {getSharedCaregiverNames(sharedCaregivers)}
                      </p>
                    </div>
                  )}

                  {availableCaregivers.length > 0 ? (
                    <>
                      <h4 className="font-medium text-gray-900 mb-3">
                        Select Caregivers to Share With:
                      </h4>
                      <div className="space-y-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {availableCaregivers.map((caregiver) => (
                          <label
                            key={caregiver.id}
                            className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCaregivers.includes(caregiver.id)}
                              onChange={() =>
                                toggleCaregiverSelection(caregiver.id)
                              }
                              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {caregiver.caregiver_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {caregiver.caregiver_email}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selectedCaregivers.length > 0 && (
                        <div className="mt-3 text-sm text-green-600 font-medium">
                          ✓ {selectedCaregivers.length} caregiver
                          {selectedCaregivers.length !== 1 ? "s" : ""} selected
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center">
                        <svg
                          className="w-5 h-5 text-blue-600 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm text-blue-800">
                          This report has been shared with all available caregivers.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-yellow-600 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-yellow-800">
                      No caregivers available. Add caregivers first to share
                      reports.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Custom Email Section */}
            <div className="mb-6">
              <button
                onClick={() => setShareEmailExpanded(!shareEmailExpanded)}
                className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <svg
                  className={`w-4 h-4 mr-1 transition-transform ${shareEmailExpanded ? "rotate-90" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {shareEmailExpanded
                  ? "Hide Email Options"
                  : "Email to Custom Address"}
              </button>
            </div>

            {shareEmailExpanded && (
              <div className="mb-6 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    placeholder="Add a personal message..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Transcript Options */}
            <div className="mb-6 space-y-4">
              <h4 className="font-medium text-gray-900">Transcript Options:</h4>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Include transcript in email
                  </span>
                  <p className="text-xs text-gray-500">
                    Include the full conversation transcript in the email content
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareTranscript}
                  onChange={(e) => setShareTranscript(e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Share transcript with caregivers
                  </span>
                  <p className="text-xs text-gray-500">
                    Allow caregivers to access the transcript in their portal (separate from email)
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {(() => {
                const currentReport = medicalReports.find(r => r.id === showShareModal);
                const availableCaregivers = currentReport ? getAvailableCaregivers(currentReport) : [];

                return (
                  <>
                    {selectedCaregivers.length > 0 && availableCaregivers.length > 0 && (
                      <button
                        onClick={shareWithSelectedCaregivers}
                        disabled={sendingEmail}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                      >
                        {sendingEmail ? (
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Sharing...
                          </div>
                        ) : (
                          `Share with ${selectedCaregivers.length} Caregiver${selectedCaregivers.length !== 1 ? "s" : ""}`
                        )}
                      </button>
                    )}
                  </>
                );
              })()}
              {shareEmailExpanded && emailAddress.trim() && (
                <button
                  onClick={sendEmailReport}
                  disabled={sendingEmail}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {sendingEmail ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Sending...
                    </div>
                  ) : (
                    "Send Email"
                  )}
                </button>
              )}
              <button
                onClick={resetShareModal}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
