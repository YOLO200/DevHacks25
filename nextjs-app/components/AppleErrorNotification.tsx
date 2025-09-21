'use client'

import { useState, useEffect } from 'react'

interface ErrorNotificationProps {
  message: string
  type: 'error' | 'warning' | 'success'
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function AppleErrorNotification({ 
  message, 
  type, 
  isVisible, 
  onClose, 
  duration = 5000 
}: ErrorNotificationProps) {
  const [isShowing, setIsShowing] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsShowing(true)
      if (duration > 0) {
        const timer = setTimeout(() => {
          setIsShowing(false)
          setTimeout(onClose, 300) // Wait for exit animation
        }, duration)
        return () => clearTimeout(timer)
      }
    } else {
      setIsShowing(false)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible && !isShowing) return null

  const getIcon = () => {
    switch (type) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  const getColors = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-50/95',
          border: 'border-red-200/60',
          text: 'text-red-800',
          icon: 'text-red-500'
        }
      case 'warning':
        return {
          bg: 'bg-yellow-50/95',
          border: 'border-yellow-200/60',
          text: 'text-yellow-800',
          icon: 'text-yellow-500'
        }
      case 'success':
        return {
          bg: 'bg-green-50/95',
          border: 'border-green-200/60',
          text: 'text-green-800',
          icon: 'text-green-500'
        }
    }
  }

  const colors = getColors()

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="flex justify-center pt-4 px-4">
        <div
          className={`
            ${colors.bg} ${colors.border} ${colors.text}
            backdrop-blur-xl border rounded-2xl shadow-2xl
            transition-all duration-300 ease-out pointer-events-auto
            ${isShowing 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 -translate-y-8 scale-95'
            }
            max-w-sm w-full
          `}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${colors.icon} mr-3 mt-0.5`}>
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-relaxed">
                  {message}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsShowing(false)
                  setTimeout(onClose, 300)
                }}
                className={`
                  flex-shrink-0 ml-3 p-1 rounded-lg transition-colors
                  ${colors.icon} hover:bg-black/5
                `}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}