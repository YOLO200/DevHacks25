'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { handleAuthError } from '@/lib/supabase/auth-error-handler'

export default function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()

    // Listen for auth state changes and handle errors
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully')
        }

        if (event === 'SIGNED_OUT') {
          // Clear any cached data when user signs out
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('supabase.auth.token')
          }
        }
      }
    )

    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      const errorInfo = handleAuthError(error)

      if (errorInfo.isNetworkError) {
        console.warn('Network error detected:', errorInfo.message)
        // Don't show error to user for network issues during development
        event.preventDefault()
      } else if (errorInfo.isAuthError) {
        console.warn('Auth error detected:', errorInfo.message)
        // Optionally redirect to login or show a toast
        if (errorInfo.shouldSignOut) {
          supabase.auth.signOut()
        }
        event.preventDefault()
      }
    }

    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      const errorInfo = handleAuthError(error)

      if (errorInfo.isNetworkError || errorInfo.isAuthError) {
        console.warn('Global error caught:', errorInfo.message)
        event.preventDefault()
      }
    }

    // Add global error listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return <>{children}</>
}