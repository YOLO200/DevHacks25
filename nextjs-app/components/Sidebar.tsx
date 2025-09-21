'use client'

import { useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  userType: 'patient' | 'caregiver'
  userName: string
  activeView: string
  onViewChange: (view: string) => void
}

// Memoized navigation item component
const NavItem = memo(({ viewKey, icon, label, isActive, isCollapsed, userType, onClick }: {
  viewKey: string
  icon: string
  label: string
  isActive: boolean
  isCollapsed: boolean
  userType: 'patient' | 'caregiver'
  onClick: (view: string) => void
}) => (
  <li>
    <button
      onClick={() => onClick(viewKey)}
      className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${
        isActive
          ? userType === 'patient'
            ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
            : 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className="text-xl">{icon}</span>
      {!isCollapsed && <span className="ml-3 font-medium text-left">{label}</span>}
    </button>
  </li>
))

NavItem.displayName = 'NavItem'

// Memoized sign out button
const SignOutButton = memo(({ isCollapsed }: { isCollapsed: boolean }) => {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Sign out error:', error)
      // Fallback to direct navigation if router fails
      window.location.href = '/login'
    }
  }

  if (isCollapsed) {
    return (
      <button
        onClick={handleSignOut}
        className="p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors w-full"
        title="Sign Out"
      >
        <span className="text-lg">🚪</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
    >
      Sign Out
    </button>
  )
})

SignOutButton.displayName = 'SignOutButton'

function Sidebar({ userType, userName, activeView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isPatient = userType === 'patient'

  // Menu items for different user types
  const patientMenuItems = [
    { viewKey: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { viewKey: 'caregivers', icon: '👥', label: 'Add Caregivers' },
    { viewKey: 'reports', icon: '📊', label: 'Reports & History' },
    { viewKey: 'recordings', icon: '🎙️', label: 'Recordings' },
  ]

  const caregiverMenuItems = [
    { viewKey: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { viewKey: 'patients', icon: '👤', label: 'Patients' },
    { viewKey: 'care-reminders', icon: '📞', label: 'Care Reminders' },
    { viewKey: 'reports', icon: '📊', label: 'Reports & Recordings' },
  ]

  const menuItems = isPatient ? patientMenuItems : caregiverMenuItems

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } h-screen fixed left-0 top-0 z-50 flex flex-col`}>
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-bold text-gray-900">Medical Companion</h2>
              <p className="text-sm text-gray-600">
                {isPatient ? '👤 Patient Portal' : '🤝 Caregiver Dashboard'}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg bg-gradient-to-br ${
              isPatient ? 'from-blue-500 to-purple-600' : 'from-emerald-500 to-teal-600'
            }`}>
              {isPatient ? '👤' : '🤝'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userType}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <NavItem
              key={item.viewKey}
              viewKey={item.viewKey}
              icon={item.icon}
              label={item.label}
              isActive={activeView === item.viewKey}
              isCollapsed={isCollapsed}
              userType={userType}
              onClick={onViewChange}
            />
          ))}
        </ul>
      </nav>

      {/* Settings & Sign Out */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed ? (
          <div className="space-y-2">
            <button
              onClick={() => onViewChange('settings')}
              className="w-full flex items-center p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
            >
              <span className="text-lg">⚙️</span>
              <span className="ml-3 text-sm font-medium">Settings</span>
            </button>
            <SignOutButton isCollapsed={false} />
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => onViewChange('settings')}
              className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
              title="Settings"
            >
              <span className="text-lg">⚙️</span>
            </button>
            <SignOutButton isCollapsed={true} />
          </div>
        )}
      </div>
    </div>
  )
}

// Only memoize the main component to prevent unnecessary re-renders when parent re-renders
export default memo(Sidebar)