'use client'

import VoiceRecorder from '@/components/VoiceRecorder'

interface VoiceRecorderViewProps {
  userId: string
}

export default function VoiceRecorderView({ userId }: VoiceRecorderViewProps) {
  return <VoiceRecorder userId={userId} />
}