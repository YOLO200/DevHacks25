"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface CallLog {
  id: string;
  reminder_id?: string;
  patient_id: string;
  caregiver_id: string;
  scheduled_time: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'no_answer' | 'missed' | 'cancelled';
  call_attempts: number;
  vapi_call_id?: string;
  error_message?: string;
  call_duration?: number;
  call_summary?: string;
  notes?: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  patient_name?: string;
  reminder_name?: string;
  reminder_category?: string;
}

export default function CallLogsView() {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const supabase = createClient();

  useEffect(() => {
    fetchCallLogs();
  }, []);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch call logs using the same approach as CareRemindersView
      const { data, error } = await supabase
        .from("scheduled_calls")
        .select("*")
        .eq("caregiver_id", user.id)
        .order("scheduled_time", { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching call logs:', error);
        setCallLogs([]);
        return;
      }

      // Transform data and fetch patient names (same pattern as CareRemindersView)
      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map((item) => item.patient_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", patientIds);

        if (profilesError) {
          console.error('Error fetching patient profiles:', profilesError);
        }

        const profilesMap = (profiles || []).reduce(
          (acc: any, profile: any) => {
            acc[profile.id] = profile;
            return acc;
          },
          {}
        );

        // Also fetch reminder data if reminder_ids exist
        const reminderIds = data
          .filter(item => item.reminder_id)
          .map(item => item.reminder_id);
          
        let remindersMap = {};
        if (reminderIds.length > 0) {
          const { data: reminders } = await supabase
            .from('care_reminders')
            .select('id, name, category')
            .in('id', reminderIds);
            
          remindersMap = (reminders || []).reduce(
            (acc: any, reminder: any) => {
              acc[reminder.id] = reminder;
              return acc;
            },
            {}
          );
        }

        const transformedLogs = data.map((log: any) => ({
          ...log,
          patient_name: profilesMap[log.patient_id]?.full_name || 'Unknown Patient',
          reminder_name: log.reminder_id ? (remindersMap as any)[log.reminder_id]?.name || null : null,
          reminder_category: log.reminder_id ? (remindersMap as any)[log.reminder_id]?.category || null : null
        }));

        setCallLogs(transformedLogs);
      } else {
        setCallLogs([]);
      }
    } catch (error) {
      console.error('Error in fetchCallLogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'no_answer': return 'bg-yellow-100 text-yellow-800';
      case 'missed': return 'bg-orange-100 text-orange-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredLogs = callLogs.filter(log => 
    statusFilter === 'all' || log.status === statusFilter
  );

  const openModal = (log: CallLog) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Call Logs</h1>
          <p className="text-gray-600">Complete post-session details and call history</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Filter & Overview</h2>
            </div>
            
            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white shadow-sm"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="failed">Failed</option>
                <option value="no_answer">No Answer</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">
                {callLogs.length}
              </div>
              <div className="text-sm text-gray-600">Total Calls</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-4 rounded-xl border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">
                {callLogs.filter(log => log.status === 'completed').length}
              </div>
              <div className="text-sm text-emerald-700">Completed</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {callLogs.filter(log => log.status === 'failed').length}
              </div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {callLogs.filter(log => log.is_demo).length}
              </div>
              <div className="text-sm text-blue-700">Demo Calls</div>
            </div>
          </div>
        </div>

        {/* Call Logs Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {statusFilter === 'all' ? 'No call logs found' : `No ${statusFilter} calls found`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reminder
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {log.patient_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {log.reminder_name || 'N/A'}
                        </div>
                        {log.reminder_category && (
                          <div className="text-xs text-gray-500">
                            {log.reminder_category}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                          {log.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(log.call_duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(log.scheduled_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.is_demo ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.is_demo ? 'Demo' : 'Scheduled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => openModal(log)}
                          className="text-emerald-600 hover:text-emerald-900 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for Call Details */}
        {showModal && selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Call Details</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                    <div className="text-sm font-medium text-gray-900">{selectedLog.patient_name}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedLog.status)}`}>
                      {selectedLog.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <div className="text-sm text-gray-900">{formatDuration(selectedLog.call_duration)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attempts</label>
                    <div className="text-sm text-gray-900">{selectedLog.call_attempts}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
                    <div className="text-sm text-gray-900">{formatDateTime(selectedLog.scheduled_time)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <div className="text-sm text-gray-900">{selectedLog.is_demo ? 'Demo Call' : 'Scheduled Call'}</div>
                  </div>
                </div>

                {selectedLog.reminder_name && (
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Reminder</label>
                    <div className="text-sm text-emerald-900">
                      {selectedLog.reminder_name}
                      {selectedLog.reminder_category && (
                        <span className="ml-2 text-xs text-emerald-600">({selectedLog.reminder_category})</span>
                      )}
                    </div>
                  </div>
                )}

                {selectedLog.vapi_call_id && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-blue-800 mb-1">VAPI Call ID</label>
                    <div className="text-sm text-blue-900 font-mono">{selectedLog.vapi_call_id}</div>
                  </div>
                )}

                {selectedLog.call_summary && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Call Summary</label>
                    <div className="text-sm text-gray-900">{selectedLog.call_summary}</div>
                  </div>
                )}

                {selectedLog.notes && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <div className="text-sm text-gray-900">{selectedLog.notes}</div>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <label className="block text-sm font-medium text-red-800 mb-2">Error Message</label>
                    <div className="text-sm text-red-700">{selectedLog.error_message}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Created</label>
                    <div className="text-xs text-gray-700">{formatDateTime(selectedLog.created_at)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Last Updated</label>
                    <div className="text-xs text-gray-700">{formatDateTime(selectedLog.updated_at)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}