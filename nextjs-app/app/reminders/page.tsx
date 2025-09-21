"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

interface Reminder {
  id: string;
  patient_id: string;
  caregiver_id: string;
  caregiver_name?: string;
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
  caregiver_id: string;
  scheduled_time: string;
  call_duration?: number;
  status: "completed" | "missed" | "no_answer" | "pending" | "cancelled";
  call_summary?: string;
  notes?: string;
  created_at: string;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [profile, setProfile] = useState<{
    full_name: string;
    user_type: "patient" | "caregiver";
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCallSummaryModal, setShowCallSummaryModal] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);

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

  const fetchReminders = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("care_reminders")
        .select(`
          *,
          caregiver:user_profiles!care_reminders_caregiver_id_fkey(full_name)
        `)
        .eq("patient_id", user.id)
        .eq("is_active", true)
        .order("time", { ascending: true });

      if (error) throw error;

      const transformedReminders = (data || []).map((item) => ({
        ...item,
        caregiver_name: item.caregiver?.full_name || "Unknown Caregiver",
      }));

      setReminders(transformedReminders);
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
        .eq("patient_id", user.id)
        .order("scheduled_time", { ascending: false })
        .limit(50);

      if (error) throw error;

      setCallLogs(data || []);
    } catch (error) {
      console.error("Error fetching call logs:", error);
    }
  }, [supabase]);

  useEffect(() => {
    const initializeData = async () => {
      const profileData = await fetchProfile();
      if (profileData) {
        await Promise.all([fetchReminders(), fetchCallLogs()]);
      }
    };
    initializeData();
  }, [fetchProfile, fetchReminders, fetchCallLogs]);

  const handleViewChange = (view: string) => {
    // Handle navigation to other views
    if (view === 'dashboard') {
      window.location.href = '/patient/dashboard';
    } else if (view === 'caregivers') {
      window.location.href = '/patient/caregivers';
    } else if (view === 'reports') {
      window.location.href = '/reports';
    } else if (view === 'recordings') {
      window.location.href = '/recordings';
    } else if (view === 'settings') {
      window.location.href = '/settings';
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (profile.user_type !== "patient") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            This page is only accessible to patients.
          </p>
        </div>
      </div>
    );
  }

  const todaysReminders = reminders.filter(reminder => {
    const today = new Date();
    const dayName = [
      "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"
    ][today.getDay()];

    if (selectedCategory && reminder.category !== selectedCategory) return false;
    return reminder[dayName as keyof Reminder] === true;
  });

  const upcomingReminders = reminders.slice(0, 5);

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      Medicine: "bg-blue-100 text-blue-800 border-blue-200",
      Appointment: "bg-green-100 text-green-800 border-green-200",
      Activity: "bg-purple-100 text-purple-800 border-purple-200",
      "Check-in": "bg-orange-100 text-orange-800 border-orange-200",
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="flex">
      <Sidebar
        userType={profile.user_type}
        userName={profile.full_name}
      />

      <div className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              My Reminders
            </h1>
            <p className="text-gray-600">
              View your scheduled reminders and call history
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Filter by Category
                </h2>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === ""
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All Categories
                  </button>
                  {["Medicine", "Appointment", "Activity", "Check-in"].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === category
                          ? "bg-blue-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Today's Reminders */}
          {todaysReminders.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Today's Reminders</h3>
              </div>
              <div className="p-6">
                <div className="grid gap-4">
                  {todaysReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={`p-4 rounded-lg border-l-4 ${getCategoryColor(reminder.category)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-900">{reminder.name}</h4>
                          <p className="text-sm text-gray-600">
                            {formatTime(reminder.time)} • {reminder.category}
                          </p>
                          <p className="text-sm text-gray-500">
                            Caregiver: {reminder.caregiver_name}
                          </p>
                          {reminder.notes && (
                            <p className="text-sm text-gray-600 mt-2">{reminder.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Reminders */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Upcoming Reminders</h3>
            </div>
            <div className="p-6">
              {upcomingReminders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">📅</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders set</h3>
                  <p className="text-gray-600">
                    Your caregivers haven't set any reminders yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(reminder.category)}`}>
                          {reminder.category}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{reminder.name}</h4>
                          <p className="text-sm text-gray-600">
                            {formatTime(reminder.time)} • {reminder.caregiver_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {Object.entries({
                          monday: reminder.monday,
                          tuesday: reminder.tuesday,
                          wednesday: reminder.wednesday,
                          thursday: reminder.thursday,
                          friday: reminder.friday,
                          saturday: reminder.saturday,
                          sunday: reminder.sunday,
                        })
                          .filter(([, isActive]) => isActive)
                          .map(([day]) => day.slice(0, 3))
                          .join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}