'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface UserProfile {
  full_name: string
  user_type: 'patient' | 'caregiver'
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('dashboard')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, user_type')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile(data)
        } else {
          // Fallback if profile doesn't exist
          setProfile({
            full_name: user.email || 'User',
            user_type: 'patient'
          })
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null // Will redirect to login
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed and persistent */}
      <Sidebar 
        userType={profile.user_type} 
        userName={profile.full_name}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Main Content Area - Only this changes between pages */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}