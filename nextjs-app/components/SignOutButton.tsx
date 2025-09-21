'use client'

import { memo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SignOutButtonProps {
  collapsed?: boolean
}

function SignOutButton({ collapsed = false }: SignOutButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  if (collapsed) {
    return (
      <button
        onClick={handleSignOut}
        className="p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
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
}

export default memo(SignOutButton)