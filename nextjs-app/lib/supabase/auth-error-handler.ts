export function handleAuthError(error: any) {
  // Check if it's a network error
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    console.warn('Network connectivity issue detected. This is likely temporary.')
    return {
      isNetworkError: true,
      shouldRetry: true,
      message: 'Network connectivity issue. Please check your internet connection.'
    }
  }

  // Check if it's an authentication refresh error
  if (error?.message?.includes('refresh') || error?.message?.includes('token')) {
    console.warn('Authentication token refresh failed. User may need to re-authenticate.')
    return {
      isAuthError: true,
      shouldSignOut: true,
      message: 'Authentication session expired. Please sign in again.'
    }
  }

  // Generic error handling
  console.error('Supabase error:', error)
  return {
    isGenericError: true,
    shouldRetry: false,
    message: 'An unexpected error occurred. Please try again.'
  }
}

// Utility function to retry failed requests
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const errorInfo = handleAuthError(error)

      if (!errorInfo.shouldRetry || i === maxRetries - 1) {
        throw error
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}