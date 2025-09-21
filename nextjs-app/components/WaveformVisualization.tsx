'use client'

import { useState, useEffect, useRef } from 'react'

interface WaveformProps {
  isActive?: boolean
  duration?: number
  currentTime?: number
  amplitude?: number[]
  height?: number
  color?: string
  className?: string
}

export default function WaveformVisualization({ 
  isActive = false,
  duration = 0,
  currentTime = 0,
  amplitude,
  height = 40,
  color = '#ef4444',
  className = ''
}: WaveformProps) {
  const [bars, setBars] = useState<number[]>([])
  const animationRef = useRef<number>()

  // Generate random waveform data if amplitude not provided
  useEffect(() => {
    if (!amplitude) {
      const generateBars = () => {
        const barCount = 60
        const newBars = Array.from({ length: barCount }, () => 
          Math.random() * 0.8 + 0.2
        )
        setBars(newBars)
      }
      generateBars()
    } else {
      setBars(amplitude)
    }
  }, [amplitude])

  // Animate bars when active
  useEffect(() => {
    if (isActive) {
      const animate = () => {
        setBars(prev => prev.map((bar, index) => {
          // Add slight variation to create "breathing" effect
          const variation = Math.sin(Date.now() * 0.003 + index * 0.5) * 0.1
          return Math.max(0.1, Math.min(1, bar + variation))
        }))
        animationRef.current = requestAnimationFrame(animate)
      }
      animate()
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive])

  const progressRatio = duration > 0 ? currentTime / duration : 0
  const progressIndex = Math.floor(bars.length * progressRatio)

  return (
    <div className={`flex items-center justify-center space-x-0.5 ${className}`}>
      {bars.map((bar, index) => {
        const barHeight = Math.max(4, bar * height)
        const isPlayed = index <= progressIndex
        
        return (
          <div
            key={index}
            className={`
              rounded-full transition-all duration-200 ease-out
              ${isActive ? 'animate-pulse' : ''}
            `}
            style={{
              width: '2px',
              height: `${barHeight}px`,
              backgroundColor: isPlayed ? color : `${color}60`,
              opacity: isActive ? (0.6 + bar * 0.4) : 0.7,
              transform: isActive ? `scaleY(${0.8 + bar * 0.4})` : 'scaleY(1)'
            }}
          />
        )
      })}
    </div>
  )
}