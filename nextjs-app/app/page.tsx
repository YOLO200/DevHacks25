'use client'

import { useState, useEffect } from 'react'
import Plasma from './components/Plasma'
import Threads from './components/Threads'
import PlasmaControls from './components/PlasmaControls'

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)
  const [userType, setUserType] = useState<'patient' | 'caregiver'>('patient')
  const [showCaregiverElements, setShowCaregiverElements] = useState({
    heading: false,
    description: false,
    button: false
  })
  const [componentKey, setComponentKey] = useState(0)
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false)
  
  // Plasma customization state
  const [plasmaConfig, setPlasmaConfig] = useState({
    color: '#ccb8f9',
    direction: 'forward' as 'forward' | 'reverse' | 'pingpong',
    speed: 1.0,
    scale: 2.0,
    opacity: 0.2,
    mouseInteractive: false
  })

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Handle animation sequence for both user types
  useEffect(() => {
    // Force component re-mount by updating key
    setComponentKey(prev => prev + 1)
    
    // Reset and start animation sequence for both patient and caregiver
    setShowCaregiverElements({
      heading: false,
      description: false,
      button: false
    })

    // Animate elements one by one for both user types
    const timer1 = setTimeout(() => {
      setShowCaregiverElements(prev => ({ ...prev, heading: true }))
    }, 100)

    const timer2 = setTimeout(() => {
      setShowCaregiverElements(prev => ({ ...prev, description: true }))
    }, 400)

    const timer3 = setTimeout(() => {
      setShowCaregiverElements(prev => ({ ...prev, button: true }))
    }, 700)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [userType])


  const userTypeContent = {
    patient: {
      title: "Your Personal",
      subtitle: "Medical Companion",
      description: "Take control of your healthcare journey with AI-powered assistance for recording doctor visits, managing medical information, and staying connected with your care team.",
      cta: "Start Managing Your Health"
    },
    caregiver: {
      title: "Compassionate",
      subtitle: "Care Coordination",
      description: "Support your loved ones with seamless access to their medical information, real-time updates, and powerful tools to coordinate their healthcare needs.",
      cta: "Begin Caring Together"
    }
  }

  return (
      <div className="min-h-screen bg-white relative">

      <div className="relative z-10">
        {/* Floating Header */}
        <header className="fixed top-0 left-0 right-0 z-50 pt-6 px-6">
          <div className="container mx-auto">
            <nav className="bg-white/30 backdrop-blur-lg rounded-2xl shadow-lg border border-purple-200/30 px-6 py-4 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-center">
                {/* Logo */}
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                    userType === 'patient' ? 'bg-blue-300' : 'bg-green-300'
                  }`}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className={`text-xl font-bold ${
                    userType === 'patient' ? 'text-blue-700' : 'text-green-700'
                  }`}>Medical Companion</div>
                </div>
                
                {/* Navigation */}
                <div className="hidden md:flex items-center space-x-4">
                  {userType === 'patient' && (
                    <button
                      onClick={() => setShowCustomizeMenu(!showCustomizeMenu)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all transform hover:scale-105 font-medium shadow-lg"
                    >
                      🎨 Customize
                    </button>
                  )}
                  <a href={`/login?type=${userType}`} className={`px-6 py-2 rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg ${
                    userType === 'patient' 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}>
                    Sign In
                  </a>
                </div>
              </div>
            </div>
          </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-6 text-center relative">
          {/* Background Effect */}
          <div className="absolute inset-0 overflow-hidden" style={{ width: '100%', height: '100%' }}>
            {userType === 'patient' ? (
              <Plasma
                key={`plasma-${componentKey}`}
                color={plasmaConfig.color}
                direction={plasmaConfig.direction}
                speed={plasmaConfig.speed}
                scale={plasmaConfig.scale}
                opacity={plasmaConfig.opacity}
                mouseInteractive={plasmaConfig.mouseInteractive}
              />
            ) : (
              <Threads
                key={`threads-${componentKey}`}
                color={[0.8, 0.4, 0.8]} // Purple color for caregiver
                amplitude={2.7}
                distance={0.5}
                enableMouseInteraction={false}
              />
            )}
          </div>
          
          <div className={`relative z-10 transition-all duration-1000 transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
        {/* User Type Selection */}
            <div className="mb-12">
              <div className="bg-white/90 backdrop-blur-md rounded-full p-2 shadow-lg border border-white/20 inline-block">
              <div className="flex">
                <button
                  onClick={() => setUserType('patient')}
                  className={`px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                    userType === 'patient'
                        ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                        : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                    I&apos;m a Patient
                </button>
                <button
                  onClick={() => setUserType('caregiver')}
                  className={`px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                    userType === 'caregiver'
                        ? 'bg-green-600 text-white shadow-lg transform scale-105'
                        : 'text-green-600 hover:text-green-700'
                  }`}
                >
                    I&apos;m a Caregiver
                </button>
                </div>
              </div>
            </div>

            <h1 className={`text-6xl md:text-7xl font-bold mb-6 leading-tight transition-all duration-700 transform ${
              userType === 'caregiver' ? 'text-green-700' : 'text-blue-700'
            } ${showCaregiverElements.heading ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              {userTypeContent[userType].title}{' '}
              <span className={userType === 'caregiver' ? 'text-green-800' : 'text-blue-800'}>
                {userTypeContent[userType].subtitle}
              </span>
            </h1>
            
            <p className={`text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed transition-all duration-700 transform ${
              userType === 'caregiver' ? 'text-green-600' : 'text-blue-600'
            } ${showCaregiverElements.description ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              {userTypeContent[userType].description}
            </p>
            
            <div className={`flex justify-center transition-all duration-700 transform ${
              showCaregiverElements.button ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}>
              <a
                href={`/login?type=${userType}`}
                className={`px-8 py-4 bg-white/30 backdrop-blur-lg rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                  userType === 'caregiver' 
                    ? 'border border-green-300/50 text-green-700' 
                    : 'border border-blue-300/50 text-blue-700'
                }`}
              >
                {userTypeContent[userType].cta}
              </a>
            </div>
          </div>
        </section>

        {/* Customize Menu - Only for patients */}
        {userType === 'patient' && showCustomizeMenu && (
          <PlasmaControls
            onColorChange={(color) => setPlasmaConfig(prev => ({ ...prev, color }))}
            onDirectionChange={(direction) => setPlasmaConfig(prev => ({ ...prev, direction }))}
            onSpeedChange={(speed) => setPlasmaConfig(prev => ({ ...prev, speed }))}
            onScaleChange={(scale) => setPlasmaConfig(prev => ({ ...prev, scale }))}
            onOpacityChange={(opacity) => setPlasmaConfig(prev => ({ ...prev, opacity }))}
            onMouseInteractiveChange={(mouseInteractive) => setPlasmaConfig(prev => ({ ...prev, mouseInteractive }))}
            initialValues={plasmaConfig}
          />
        )}

      </div>

    </div>
  );
}