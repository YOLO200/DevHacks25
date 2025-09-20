'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const [userType, setUserType] = useState<'patient' | 'caregiver'>('patient')

  useEffect(() => {
    setIsVisible(true)
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const patientFeatures = [
    {
      icon: "🎙️",
      title: "Record Doctor Conversations",
      description: "Easily record and store your doctor appointments for future reference.",
      items: ["Audio recording during visits", "Secure cloud storage", "Easy playback and review"],
      color: "from-blue-400 to-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      icon: "📋",
      title: "Medical Notes & Summaries",
      description: "AI-powered summaries of your medical conversations and key insights.",
      items: ["Automatic transcription", "Key points extraction", "Treatment plan highlights"],
      color: "from-green-400 to-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: "👨‍⚕️",
      title: "Share with Caregivers",
      description: "Securely share your medical information with trusted family and caregivers.",
      items: ["Selective sharing controls", "Real-time updates", "Permission management"],
      color: "from-purple-400 to-purple-600",
      bgColor: "bg-purple-50"
    }
  ]

  const caregiverFeatures = [
    {
      icon: "👥",
      title: "Patient Dashboard",
      description: "Monitor multiple patients and access their shared medical information.",
      items: ["Multi-patient overview", "Recent updates feed", "Important alerts"],
      color: "from-emerald-400 to-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      icon: "🔔",
      title: "Real-time Notifications",
      description: "Stay informed about patient appointments, updates, and important changes.",
      items: ["Appointment reminders", "New recording alerts", "Critical updates"],
      color: "from-orange-400 to-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      icon: "📊",
      title: "Care Coordination",
      description: "Track patient progress and coordinate care with healthcare providers.",
      items: ["Progress tracking", "Care task management", "Communication tools"],
      color: "from-pink-400 to-pink-600",
      bgColor: "bg-pink-50"
    }
  ]

  const currentFeatures = userType === 'patient' ? patientFeatures : caregiverFeatures

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-6 pt-8">
          <nav className="flex justify-between items-center">
            <div className="text-2xl font-bold text-gray-800">Medical Companion</div>
            <div className="hidden md:flex space-x-6">
              <a href="#features" className="text-gray-600 hover:text-gray-800 transition-colors">Features</a>
              <a href="#about" className="text-gray-600 hover:text-gray-800 transition-colors">About</a>
              <a href={`/login?type=${userType}`} className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-all transform hover:scale-105">Get Started</a>
            </div>
          </nav>
        </header>

        {/* User Type Selection */}
        <section className="container mx-auto px-6 pt-12">
          <div className="flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg border border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setUserType('patient')}
                  className={`px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                    userType === 'patient'
                      ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  👤 I&apos;m a Patient
                </button>
                <button
                  onClick={() => setUserType('caregiver')}
                  className={`px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                    userType === 'caregiver'
                      ? 'bg-emerald-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🤝 I&apos;m a Caregiver
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20 text-center">
          <div className={`transition-all duration-1000 transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              {userTypeContent[userType].title}{' '}
              <span className={`bg-gradient-to-r ${
                userType === 'patient' ? 'from-blue-600 to-purple-600' : 'from-emerald-600 to-teal-600'
              } bg-clip-text text-transparent`}>
                {userTypeContent[userType].subtitle}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              {userTypeContent[userType].description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <a
                href={`/login?type=${userType}`}
                className={`group relative px-8 py-4 bg-gradient-to-r ${
                  userType === 'patient' 
                    ? 'from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                    : 'from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                } text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1`}
              >
                <span className="relative z-10">{userTypeContent[userType].cta}</span>
              </a>
              <a
                href="#features"
                className="px-8 py-4 bg-white/80 backdrop-blur-sm text-gray-800 rounded-full font-semibold text-lg border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              >
                Explore Features
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {userType === 'patient' ? 'Patient-Focused' : 'Caregiver-Centered'}{' '}
              <span className={`bg-gradient-to-r ${
                userType === 'patient' ? 'from-blue-600 to-purple-600' : 'from-emerald-600 to-teal-600'
              } bg-clip-text text-transparent`}>
                Features
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {userType === 'patient' 
                ? 'Powerful tools designed specifically for patients to manage their healthcare journey'
                : 'Comprehensive solutions for caregivers to provide the best possible support'
              }
            </p>
          </div>

          {/* Feature Showcase */}
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
              {/* Feature Cards */}
              <div className="space-y-6">
                {currentFeatures.map((feature, index) => (
                  <div
                    key={`${userType}-${index}`}
                    className={`p-6 rounded-2xl cursor-pointer transition-all duration-500 transform ${
                      currentFeature === index
                        ? `${feature.bgColor} scale-105 shadow-2xl border-2 border-opacity-50`
                        : 'bg-white/60 backdrop-blur-sm hover:bg-white/80 shadow-lg hover:shadow-xl'
                    }`}
                    onClick={() => setCurrentFeature(index)}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${feature.color} text-white shadow-lg`}>
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                        <p className="text-gray-600 mb-3">{feature.description}</p>
                        <div className={`space-y-1 transition-all duration-500 overflow-hidden ${
                          currentFeature === index ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          {feature.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center text-sm text-gray-600">
                              <div className={`w-2 h-2 bg-gradient-to-r ${
                                userType === 'patient' ? 'from-blue-400 to-purple-400' : 'from-emerald-400 to-teal-400'
                              } rounded-full mr-3`}></div>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Feature Visualization */}
              <div className="relative">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
                  <div className={`transition-all duration-700 transform ${
                    isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                  }`}>
                    <div className={`w-full h-64 rounded-2xl bg-gradient-to-br ${currentFeatures[currentFeature].color} flex items-center justify-center text-6xl text-white shadow-xl`}>
                      {currentFeatures[currentFeature].icon}
                    </div>
                    <div className="mt-6 text-center">
                      <h4 className="text-2xl font-bold text-gray-900 mb-2">
                        {currentFeatures[currentFeature].title}
                      </h4>
                      <p className="text-gray-600">
                        {currentFeatures[currentFeature].description}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-300 rounded-full opacity-20 animate-bounce"></div>
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-pink-300 rounded-full opacity-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-20 text-center">
          <div className={`bg-gradient-to-r ${
            userType === 'patient' 
              ? 'from-blue-600 to-purple-600' 
              : 'from-emerald-600 to-teal-600'
          } rounded-3xl p-12 shadow-2xl`}>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
              {userType === 'patient' 
                ? 'Ready to Take Control of Your Health?' 
                : 'Ready to Provide Better Care?'
              }
            </h3>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              {userType === 'patient'
                ? 'Join thousands of patients who are taking charge of their healthcare with Medical Companion.'
                : 'Join compassionate caregivers who trust Medical Companion to help them provide exceptional care.'
              }
            </p>
            <a
              href={`/login?type=${userType}`}
              className="inline-block px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
            >
              {userTypeContent[userType].cta}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}