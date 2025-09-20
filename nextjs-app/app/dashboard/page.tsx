import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import VoiceRecorder from '@/components/VoiceRecorder'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile to get the full name and user type
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, user_type')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex">
      <Sidebar userType={profile?.user_type || 'patient'} userName={profile?.full_name || user.email} />

      <div className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profile?.user_type === 'patient' ? 'Patient Dashboard' : 'Caregiver Dashboard'}
            </h1>
            <p className="text-gray-600">
              Welcome back, {profile?.full_name || user.email}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                  <span className="text-xl">🎙️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recordings</h3>
                  <p className="text-gray-600">View & manage</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                  <span className="text-xl">📊</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
                  <p className="text-gray-600">Medical history</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                  <span className="text-xl">👥</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {profile?.user_type === 'patient' ? 'Caregivers' : 'Patients'}
                  </h3>
                  <p className="text-gray-600">Manage access</p>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Recorder - Only for Patients */}
          {profile?.user_type === 'patient' && (
            <div className="mb-8">
              <VoiceRecorder userId={user.id} />
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {profile?.user_type === 'patient' ? 'Recent Medical Activity' : 'Patient Overview'}
            </h2>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">
                  {profile?.user_type === 'patient' ? '📋' : '👥'}
                </span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {profile?.user_type === 'patient'
                  ? 'Your Medical Dashboard'
                  : 'Caregiver Dashboard'
                }
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {profile?.user_type === 'patient'
                  ? 'Record your doctor visits, manage caregivers, and track your medical history using the sidebar navigation.'
                  : 'Monitor your patients, view their medical information, and coordinate care activities.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}