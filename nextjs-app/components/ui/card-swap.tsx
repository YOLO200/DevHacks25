'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

interface CardSwapProps {
  cards: {
    id: string
    title: string
    content: React.ReactNode
    background?: string
    icon?: React.ReactNode
  }[]
  className?: string
  cardClassName?: string
  autoSwap?: boolean
  interval?: number
}

export default function CardSwap({
  cards,
  className,
  cardClassName,
  autoSwap = false,
  interval = 3000
}: CardSwapProps) {
  const [currentCard, setCurrentCard] = useState(0)

  // Auto swap functionality
  useEffect(() => {
    if (!autoSwap) return

    const timer = setInterval(() => {
      setCurrentCard((prev) => (prev + 1) % cards.length)
    }, interval)

    return () => clearInterval(timer)
  }, [autoSwap, interval, cards.length])

  const nextCard = () => {
    setCurrentCard((prev) => (prev + 1) % cards.length)
  }

  const prevCard = () => {
    setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length)
  }

  return (
    <div className={clsx('relative overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -300 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={clsx(
            'bg-white rounded-xl shadow-lg p-6 border border-gray-200',
            cardClassName,
            cards[currentCard].background
          )}
        >
          <div className="flex items-start gap-4">
            {cards[currentCard].icon && (
              <div className="flex-shrink-0">
                {cards[currentCard].icon}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {cards[currentCard].title}
              </h3>
              <div className="text-gray-600">
                {cards[currentCard].content}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={prevCard}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          ←
        </button>
        
        <div className="flex gap-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentCard(index)}
              className={clsx(
                'w-2 h-2 rounded-full transition-colors',
                index === currentCard ? 'bg-blue-600' : 'bg-gray-300'
              )}
            />
          ))}
        </div>
        
        <button
          onClick={nextCard}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}