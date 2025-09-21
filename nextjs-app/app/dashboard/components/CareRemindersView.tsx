"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Patient {
  id: string;
  patient_name: string;
  patient_email: string;
  relationship: string;
}

interface CareReminder {
  id: string;
  patient_id: string;
  patient_name?: string;
  name: string;
  category: "Medicine" | "Appointment" | "Activity" | "Check-in";
  time: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

interface CallLog {
  id: string;
  reminder_id: string;
  patient_id: string;
  patient_name?: string;
  scheduled_time: string;
  call_duration?: number;
  status: "completed" | "missed" | "no_answer" | "pending" | "cancelled";
  call_summary?: string;
  notes?: string;
  created_at: string;
}

export default function CareRemindersView() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [profile, setProfile] = useState<{
    full_name: string;
    user_type: "patient" | "caregiver";
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showCallForm, setShowCallForm] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<CareReminder | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showEditReminderForm, setShowEditReminderForm] = useState(false);
  const [showCallSummaryModal, setShowCallSummaryModal] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [editingReminder, setEditingReminder] = useState<CareReminder | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [reminderForm, setReminderForm] = useState({
    patient_id: "",
    name: "",
    category: "Medicine" as CareReminder["category"],
    time: "09:00",
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
    notes: "",
  });

  const [callForm, setCallForm] = useState({
    reminder_id: "",
    patient_id: "",
    scheduled_time: "",
    call_duration: 0,
    status: "completed" as CallLog["status"],
    call_summary: "",
    notes: "",
  });

  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("full_name, user_type, email")
          .eq("id", user.id)
          .single();
        setProfile(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
    return null;
  }, [supabase]);

  const fetchPatients = useCallback(
    async (profileData: any) => {
      if (!profileData?.email) return;

      try {
        const { data, error } = await supabase
          .from("caregiver_relationships")
          .select("patient_id, relationship")
          .eq("caregiver_email", profileData.email)
          .eq("status", "accepted");

        if (error) throw error;

        if (data && data.length > 0) {
          const patientIds = data.map((item) => item.patient_id);
          const { data: profiles, error: profilesError } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", patientIds);

          if (profilesError) throw profilesError;

          const profilesMap = (profiles || []).reduce(
            (acc: any, profile: any) => {
              acc[profile.id] = profile;
              return acc;
            },
            {}
          );

          const transformedPatients = data.map((item) => ({
            id: item.patient_id,
            patient_name:
              profilesMap[item.patient_id]?.full_name || "Unknown Patient",
            patient_email:
              profilesMap[item.patient_id]?.email || "Unknown Email",
            relationship: item.relationship,
          }));

          setPatients(transformedPatients);
        }
      } catch (error) {
        console.error("Error fetching patients:", error);
      }
    },
    [supabase]
  );

  const fetchReminders = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("care_reminders")
        .select("*")
        .eq("caregiver_id", user.id)
        .eq("is_active", true)
        .order("time", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map((item) => item.patient_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", patientIds);

        if (profilesError) throw profilesError;

        const profilesMap = (profiles || []).reduce(
          (acc: any, profile: any) => {
            acc[profile.id] = profile;
            return acc;
          },
          {}
        );

        const transformedReminders = data.map((item) => ({
          ...item,
          patient_name:
            profilesMap[item.patient_id]?.full_name || "Unknown Patient",
        }));

        setReminders(transformedReminders);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  }, [supabase]);

  const fetchCallLogs = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("scheduled_calls")
        .select("*")
        .eq("caregiver_id", user.id)
        .order("scheduled_time", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map((item) => item.patient_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", patientIds);

        if (profilesError) throw profilesError;

        const profilesMap = (profiles || []).reduce(
          (acc: any, profile: any) => {
            acc[profile.id] = profile;
            return acc;
          },
          {}
        );

        const transformedCallLogs = data.map((item) => ({
          ...item,
          patient_name:
            profilesMap[item.patient_id]?.full_name || "Unknown Patient",
        }));

        setCallLogs(transformedCallLogs);
      }
    } catch (error) {
      console.error("Error fetching call logs:", error);
    }
  }, [supabase]);

  useEffect(() => {
    const initializeData = async () => {
      const profileData = await fetchProfile();
      if (profileData) {
        await Promise.all([
          fetchPatients(profileData),
          fetchReminders(),
          fetchCallLogs(),
        ]);
      }
    };
    initializeData();
  }, [fetchProfile, fetchPatients, fetchReminders, fetchCallLogs]);

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("care_reminders").insert([
        {
          ...reminderForm,
          caregiver_id: user.id,
          is_active: true,
        },
      ]);

      if (error) throw error;

      setReminderForm({
        patient_id: "",
        name: "",
        category: "Medicine",
        time: "09:00",
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
        notes: "",
      });
      setShowReminderForm(false);
      await fetchReminders();
      alert("Care reminder created successfully!");
    } catch (error) {
      console.error("Error creating reminder:", error);
      alert("Failed to create reminder. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !editingReminder)
        throw new Error("No user or reminder found");

      const { error } = await supabase
        .from("care_reminders")
        .update({
          patient_id: reminderForm.patient_id,
          name: reminderForm.name,
          category: reminderForm.category,
          time: reminderForm.time,
          monday: reminderForm.monday,
          tuesday: reminderForm.tuesday,
          wednesday: reminderForm.wednesday,
          thursday: reminderForm.thursday,
          friday: reminderForm.friday,
          saturday: reminderForm.saturday,
          sunday: reminderForm.sunday,
          notes: reminderForm.notes,
        })
        .eq("id", editingReminder.id);

      if (error) throw error;

      setReminderForm({
        patient_id: "",
        name: "",
        category: "Medicine",
        time: "09:00",
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
        notes: "",
      });
      setShowEditReminderForm(false);
      setEditingReminder(null);
      await fetchReminders();
      alert("Care reminder updated successfully!");
    } catch (error) {
      console.error("Error updating reminder:", error);
      alert("Failed to update reminder. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("scheduled_calls").insert([
        {
          ...callForm,
          caregiver_id: user.id,
        },
      ]);

      if (error) throw error;

      setCallForm({
        reminder_id: "",
        patient_id: "",
        scheduled_time: "",
        call_duration: 0,
        status: "completed",
        call_summary: "",
        notes: "",
      });
      setShowCallForm(false);
      await fetchCallLogs();
      alert("Call log saved successfully!");
    } catch (error) {
      console.error("Error saving call log:", error);
      alert("Failed to save call log. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReminder = async () => {
    if (!editingReminder) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("care_reminders")
        .delete()
        .eq("id", editingReminder.id);

      if (error) throw error;

      setShowEditReminderForm(false);
      setShowDeleteConfirm(false);
      setEditingReminder(null);
      await fetchReminders();
      alert("Reminder deleted successfully!");
    } catch (error) {
      console.error("Error deleting reminder:", error);
      alert("Failed to delete reminder. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getRemindersForDate = (date: Date) => {
    const dayName = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][date.getDay()];
    return reminders.filter((reminder) => {
      if (selectedPatientId && reminder.patient_id !== selectedPatientId)
        return false;
      return reminder[dayName as keyof CareReminder] === true;
    });
  };

  const getCallLogsForDate = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];
    return callLogs.filter((log) => {
      if (selectedPatientId && log.patient_id !== selectedPatientId)
        return false;
      return log.scheduled_time?.split("T")[0] === dateString;
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPatientColor = (patientId: string) => {
    const colors = [
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-emerald-100 text-emerald-800 border-emerald-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-orange-100 text-orange-800 border-orange-200",
      "bg-pink-100 text-pink-800 border-pink-200",
      "bg-indigo-100 text-indigo-800 border-indigo-200",
      "bg-yellow-100 text-yellow-800 border-yellow-200",
      "bg-red-100 text-red-800 border-red-200",
    ];

    // Generate a consistent color based on patient ID
    let hash = 0;
    for (let i = 0; i < patientId.length; i++) {
      hash = patientId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const isDateInFuture = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const handleReminderClick = async (
    reminder: CareReminder,
    clickDate: Date
  ) => {
    if (isDateInFuture(clickDate)) {
      // Future reminder - show edit form
      setEditingReminder(reminder);
      setReminderForm({
        patient_id: reminder.patient_id,
        name: reminder.name,
        category: reminder.category,
        time: reminder.time,
        monday: reminder.monday,
        tuesday: reminder.tuesday,
        wednesday: reminder.wednesday,
        thursday: reminder.thursday,
        friday: reminder.friday,
        saturday: reminder.saturday,
        sunday: reminder.sunday,
        notes: reminder.notes || "",
      });
      setShowEditReminderForm(true);
    } else {
      // Past reminder - look for call log and show summary
      const callLog = callLogs.find(
        (log) =>
          log.reminder_id === reminder.id &&
          log.scheduled_time?.split("T")[0] ===
            clickDate.toISOString().split("T")[0]
      );

      if (callLog) {
        setSelectedCallLog(callLog);
        setShowCallSummaryModal(true);
      } else {
        alert("No call log found for this reminder.");
      }
    }
  };

  const getDayString = (reminder: CareReminder) => {
    const days = [];
    if (reminder.monday) days.push("Mon");
    if (reminder.tuesday) days.push("Tue");
    if (reminder.wednesday) days.push("Wed");
    if (reminder.thursday) days.push("Thu");
    if (reminder.friday) days.push("Fri");
    if (reminder.saturday) days.push("Sat");
    if (reminder.sunday) days.push("Sun");

    if (days.length === 7) return "Every day";
    if (days.length === 0) return "No days selected";
    return days.join(", ");
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      if (direction === "prev") {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
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

  const calendarDays = getDaysInMonth(currentMonth);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Care Reminders
          </h1>
          <p className="text-gray-600">
            Schedule and track reminder calls for your patients
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Filter & Actions
              </h2>

              {/* Patient Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setSelectedPatientId("")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedPatientId === ""
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All Patients
                </button>
                {patients.map((patient) => {
                  const patientColor = getPatientColor(patient.id);
                  const isSelected = selectedPatientId === patient.id;

                  return (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                        isSelected
                          ? patientColor + " shadow-md"
                          : patientColor + " hover:opacity-80"
                      }`}
                    >
                      {patient.patient_name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowReminderForm(true)}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Add Reminder
              </button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {currentMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateMonth("prev")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 text-sm text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateMonth("next")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day) => (
                  <div
                    key={day}
                    className="p-3 text-center text-sm font-medium text-gray-500"
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={index} className="p-2 h-32"></div>;
                }

                const dayReminders = getRemindersForDate(day);
                const dayCallLogs = getCallLogsForDate(day);
                const isToday =
                  day.toDateString() === new Date().toDateString();
                const isSelected =
                  day.toDateString() === selectedDate.toDateString();

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`p-2 h-32 border rounded-lg cursor-pointer transition-all hover:shadow-md flex flex-col ${
                      isToday
                        ? "bg-emerald-100 border-emerald-300"
                        : isSelected
                          ? "bg-blue-100 border-blue-300"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 flex-shrink-0 ${
                        isToday ? "text-emerald-800" : "text-gray-900"
                      }`}
                    >
                      {day.getDate()}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 calendar-day-scroll">
                      {dayReminders.map((reminder) => (
                        <div
                          key={reminder.id}
                          className={`text-xs px-2 py-1 rounded truncate border cursor-pointer flex-shrink-0 ${getPatientColor(reminder.patient_id)}`}
                          title={`${reminder.name} - ${formatTime(reminder.time)} (${reminder.patient_name})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReminderClick(reminder, day);
                          }}
                        >
                          📞 {formatTime(reminder.time)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reminder Form Modal */}
        {showReminderForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Add Care Reminder
                  </h3>
                  <button
                    onClick={() => setShowReminderForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
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
              </div>

              <form onSubmit={handleReminderSubmit} className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patient
                    </label>
                    <select
                      required
                      value={reminderForm.patient_id}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          patient_id: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.patient_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reminder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={reminderForm.name}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g., Daily medication check"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      required
                      value={reminderForm.category}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          category: e.target
                            .value as CareReminder["category"],
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="Medicine">Medicine</option>
                      <option value="Appointment">Appointment</option>
                      <option value="Activity">Activity</option>
                      <option value="Check-in">Check-in</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reminder Time
                    </label>
                    <input
                      type="time"
                      required
                      value={reminderForm.time}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          time: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repeat Days
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {[
                      { key: "sunday", label: "Sun" },
                      { key: "monday", label: "Mon" },
                      { key: "tuesday", label: "Tue" },
                      { key: "wednesday", label: "Wed" },
                      { key: "thursday", label: "Thu" },
                      { key: "friday", label: "Fri" },
                      { key: "saturday", label: "Sat" },
                    ].map((day) => (
                      <label
                        key={day.key}
                        className="flex flex-col items-center"
                      >
                        <span className="text-xs text-gray-600 mb-1">
                          {day.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={
                            reminderForm[
                              day.key as keyof typeof reminderForm
                            ] as boolean
                          }
                          onChange={(e) =>
                            setReminderForm((prev) => ({
                              ...prev,
                              [day.key]: e.target.checked,
                            }))
                          }
                          className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={reminderForm.notes}
                    onChange={(e) =>
                      setReminderForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="Any additional notes about this reminder"
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowReminderForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Creating..." : "Create Reminder"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Call Form Modal */}
        {showCallForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Log Care Call
                  </h3>
                  <button
                    onClick={() => setShowCallForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
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
              </div>

              <form onSubmit={handleCallSubmit} className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patient
                    </label>
                    <select
                      required
                      value={callForm.patient_id}
                      onChange={(e) =>
                        setCallForm((prev) => ({
                          ...prev,
                          patient_id: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.patient_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Call Status
                    </label>
                    <select
                      required
                      value={callForm.status}
                      onChange={(e) =>
                        setCallForm((prev) => ({
                          ...prev,
                          status: e.target.value as CallLog["status"],
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="completed">Completed</option>
                      <option value="no_answer">No Answer</option>
                      <option value="missed">Missed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduled Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={callForm.scheduled_time}
                      onChange={(e) =>
                        setCallForm((prev) => ({
                          ...prev,
                          scheduled_time: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={callForm.call_duration}
                      onChange={(e) =>
                        setCallForm((prev) => ({
                          ...prev,
                          call_duration: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Summary
                  </label>
                  <textarea
                    value={callForm.call_summary}
                    onChange={(e) =>
                      setCallForm((prev) => ({
                        ...prev,
                        call_summary: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Summarize what was discussed during the call..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={callForm.notes}
                    onChange={(e) =>
                      setCallForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Any additional notes or follow-up actions..."
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowCallForm(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Saving..." : "Save Call Log"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Reminder Form Modal */}
        {showEditReminderForm && editingReminder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Edit Care Reminder
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditReminderForm(false);
                      setEditingReminder(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
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
              </div>

              <form
                onSubmit={handleEditReminderSubmit}
                className="p-6 space-y-6"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Patient
                    </label>
                    <select
                      required
                      value={reminderForm.patient_id}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          patient_id: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.patient_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      required
                      value={reminderForm.category}
                      onChange={(e) =>
                        setReminderForm((prev) => ({
                          ...prev,
                          category: e.target
                            .value as CareReminder["category"],
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="Medicine">Medicine</option>
                      <option value="Doctor Visit">Doctor Visit</option>
                      <option value="Exercise">Exercise</option>
                      <option value="Diet">Diet</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={reminderForm.name}
                    onChange={(e) =>
                      setReminderForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., Daily medication check"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={reminderForm.time}
                    onChange={(e) =>
                      setReminderForm((prev) => ({
                        ...prev,
                        time: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Repeat Days
                  </label>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                    {[
                      { key: "monday", label: "Mon" },
                      { key: "tuesday", label: "Tue" },
                      { key: "wednesday", label: "Wed" },
                      { key: "thursday", label: "Thu" },
                      { key: "friday", label: "Fri" },
                      { key: "saturday", label: "Sat" },
                      { key: "sunday", label: "Sun" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={
                            reminderForm[
                              key as keyof typeof reminderForm
                            ] as boolean
                          }
                          onChange={(e) =>
                            setReminderForm((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="sr-only"
                        />
                        <div
                          className={`cursor-pointer px-3 py-2 rounded-lg text-center transition-colors ${
                            reminderForm[key as keyof typeof reminderForm]
                              ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-300"
                              : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={reminderForm.notes}
                    onChange={(e) =>
                      setReminderForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional notes or instructions..."
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Reminder
                  </button>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditReminderForm(false);
                        setEditingReminder(null);
                      }}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? "Updating..." : "Update Reminder"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && editingReminder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Delete Reminder
                  </h3>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
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
              </div>

              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <svg
                      className="h-6 w-6 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Are you sure you want to delete this reminder?
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    "{editingReminder.name}" for{" "}
                    {editingReminder.patient_name}
                  </p>
                  <p className="text-sm text-red-600 font-medium">
                    This action cannot be undone.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteReminder}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Deleting..." : "Delete Reminder"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Summary Modal */}
        {showCallSummaryModal && selectedCallLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Call Summary
                  </h3>
                  <button
                    onClick={() => {
                      setShowCallSummaryModal(false);
                      setSelectedCallLog(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
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
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Call Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient:</span>
                      <span className="text-gray-900">
                        {selectedCallLog.patient_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Scheduled Time:</span>
                      <span className="text-gray-900">
                        {new Date(
                          selectedCallLog.scheduled_time
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="text-gray-900">
                        {selectedCallLog.call_duration
                          ? `${selectedCallLog.call_duration} minutes`
                          : "Not recorded"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedCallLog.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : selectedCallLog.status === "missed"
                              ? "bg-red-100 text-red-800"
                              : selectedCallLog.status === "no_answer"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {selectedCallLog.status?.replace("_", " ") ||
                          "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedCallLog.call_summary && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">
                      Call Summary
                    </h4>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-gray-800">
                        {selectedCallLog.call_summary}
                      </p>
                    </div>
                  </div>
                )}

                {selectedCallLog.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-800">{selectedCallLog.notes}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setShowCallSummaryModal(false);
                      setSelectedCallLog(null);
                    }}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors"
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