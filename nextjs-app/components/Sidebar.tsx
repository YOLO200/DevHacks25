'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

interface SidebarProps {
  userType: 'patient' | 'caregiver'
  userName: string
}

export default function Sidebar({ userType, userName }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  const patientMenuItems = [
    {
      icon: '🏠',
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      icon: '👥',
      label: 'Add Caregivers',
      href: '/caregivers',
    },
    {
      icon: '📊',
      label: 'Reports & History',
      href: '/reports',
    },
    {
      icon: '🎙️',
      label: 'Recordings',
      href: '/recordings',
    },
  ]

  const caregiverMenuItems = [
    {
      icon: '🏠',
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      icon: '👤',
      label: 'Patients',
      href: '/patients',
    },
    {
      icon: '📋',
      label: 'Care Plans',
      href: '/care-plans',
    },
    {
      icon: '📊',
      label: 'Reports',
      href: '/reports',
    },
  ]

  const menuItems = userType === 'patient' ? patientMenuItems : caregiverMenuItems

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/'
    }
    return pathname.startsWith(href)
  }

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
                {userType === 'patient' ? '👤 Patient Portal' : '🤝 Caregiver Dashboard'}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
              userType === 'patient' ? 'from-blue-500 to-purple-600' : 'from-emerald-500 to-teal-600'
            }`}>
              {userType === 'patient' ? '👤' : '🤝'}
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
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center p-3 rounded-lg transition-all duration-200 group ${
                  isActive(item.href)
                    ? userType === 'patient'
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                      : 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {!isCollapsed && (
                  <>
                    <span className="ml-3 font-medium">{item.label}</span>
                    {isActive(item.href) && (
                      <span className="ml-auto">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings & Sign Out */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed ? (
          <div className="space-y-2">
            <Link
              href="/settings"
              className="flex items-center p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
            >
              <span className="text-lg">⚙️</span>
              <span className="ml-3 text-sm font-medium">Settings</span>
            </Link>
            <div className="pt-2">
              <SignOutButton />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href="/settings"
              className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
              title="Settings"
            >
              <span className="text-lg">⚙️</span>
            </Link>
            <div className="flex justify-center">
              <button
                className="p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                title="Sign Out"
                onClick={() => {
                  // This will need to be handled by the SignOutButton component
                }}
              >
                <span className="text-lg">🚪</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}