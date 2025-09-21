"use client";

import { useState, useEffect } from "react";
import Plasma from "./components/Plasma";
import Threads from "./components/Threads";
// import PlasmaControls from "./components/PlasmaControls";

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [userType, setUserType] = useState<"patient" | "caregiver">("patient");
  const [showCaregiverElements, setShowCaregiverElements] = useState({
    heading: false,
    description: false,
    button: false,
  });
  const [componentKey, setComponentKey] = useState(0);
  // const [showCustomizeMenu, setShowCustomizeMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Plasma customization state
  const [plasmaConfig] = useState({
    color: "#4068dd",
    direction: "forward" as "forward" | "reverse" | "pingpong",
    speed: 1.0,
    scale: 2.0,
    opacity: 0.2,
    mouseInteractive: false,
  });

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Handle animation sequence for both user types
  useEffect(() => {
    // Force component re-mount by updating key
    setComponentKey((prev) => prev + 1);

    // Reset and start animation sequence for both patient and caregiver
    setShowCaregiverElements({
      heading: false,
      description: false,
      button: false,
    });

    // Animate elements one by one for both user types
    const timer1 = setTimeout(() => {
      setShowCaregiverElements((prev) => ({ ...prev, heading: true }));
    }, 100);

    const timer2 = setTimeout(() => {
      setShowCaregiverElements((prev) => ({ ...prev, description: true }));
    }, 400);

    const timer3 = setTimeout(() => {
      setShowCaregiverElements((prev) => ({ ...prev, button: true }));
    }, 700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [userType]);

  const userTypeContent = {
    patient: {
      title: "Your Personal",
      subtitle: "Medical Companion",
      description:
        "Take control of your healthcare journey with AI-powered assistance for recording doctor visits, managing medical information, and staying connected with your care team.",
      cta: "Start Managing Your Health",
    },
    caregiver: {
      title: "Compassionate",
      subtitle: "Care Coordination",
      description:
        "Support your loved ones with seamless access to their medical information, real-time updates, and powerful tools to coordinate their healthcare needs.",
      cta: "Begin Caring Together",
    },
  };

  return (
    <div className="min-h-screen bg-white relative">
      <div className="relative z-10">
        {/* Floating Header */}
        <header className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-6 px-3 sm:px-6">
          <div className="container mx-auto">
            <nav className="bg-white/30 backdrop-blur-lg rounded-xl sm:rounded-2xl shadow-lg border border-purple-200/30 px-4 sm:px-6 py-3 sm:py-4 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-center">
                  {/* Logo */}
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg ${
                        userType === "patient" ? "bg-blue-300" : "bg-green-300"
                      }`}
                    >
                      <svg
                        className="w-4 h-4 sm:w-6 sm:h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </div>
                    <div
                      className={`text-lg sm:text-xl font-bold ${
                        userType === "patient"
                          ? "text-blue-700"
                          : "text-green-700"
                      }`}
                    >
                      Medical Companion
                    </div>
                  </div>

                  {/* Desktop Navigation */}
                  <div className="hidden md:flex items-center space-x-4">
                    {/* {userType === "patient" && (
                      <button
                        onClick={() => setShowCustomizeMenu(!showCustomizeMenu)}
                        className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl hover:bg-purple-700 transition-all transform hover:scale-105 font-medium shadow-lg text-sm sm:text-base"
                      >
                        🎨 Customize
                      </button>
                    )} */}
                    <a
                      href={`/login?type=${userType}`}
                      className={`px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl transition-all transform hover:scale-105 font-medium shadow-lg text-sm sm:text-base ${
                        userType === "patient"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      Sign In
                    </a>
                  </div>

                  {/* Mobile Menu Button */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                      aria-label="Toggle mobile menu"
                    >
                      <svg
                        className={`w-6 h-6 ${
                          userType === "patient"
                            ? "text-blue-700"
                            : "text-green-700"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {showMobileMenu ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                          />
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mobile Menu */}
                {showMobileMenu && (
                  <div className="md:hidden mt-4 pt-4 border-t border-white/20">
                    <div className="flex flex-col space-y-3">
                      {/* {userType === "patient" && (
                        <button
                          onClick={() => {
                            setShowCustomizeMenu(!showCustomizeMenu);
                            setShowMobileMenu(false);
                          }}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all font-medium shadow-lg text-sm text-center"
                        >
                          🎨 Customize
                        </button>
                      )} */}
                      <a
                        href={`/login?type=${userType}`}
                        className={`px-4 py-2 rounded-lg transition-all font-medium shadow-lg text-sm text-center ${
                          userType === "patient"
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        Sign In
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 text-center relative">
          {/* Background Effect */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: "100%", height: "100%" }}
          >
            {userType === "patient" ? (
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
                color={[0.0078, 0.3529, 0.2118]} // Lighter green #025A36 for caregiver
                amplitude={2.7}
                distance={0.5}
                enableMouseInteraction={false}
              />
            )}
          </div>

          <div
            className={`relative z-10 transition-all duration-1000 transform ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            {/* User Type Selection */}
            <div className="mb-8 sm:mb-12">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 items-center justify-center">
                <button
                  onClick={() => setUserType("patient")}
                  className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 rounded-full font-semibold transition-all duration-300 text-sm sm:text-base whitespace-nowrap shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    userType === "patient"
                      ? "bg-blue-600 text-white"
                      : "bg-white/30 backdrop-blur-lg text-blue-700 border border-blue-300/50"
                  }`}
                >
                  I&apos;m a Patient
                </button>
                <button
                  onClick={() => setUserType("caregiver")}
                  className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3 rounded-full font-semibold transition-all duration-300 text-sm sm:text-base whitespace-nowrap shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    userType === "caregiver"
                      ? "bg-green-600 text-white"
                      : "bg-white/30 backdrop-blur-lg text-green-700 border border-green-300/50"
                  }`}
                >
                  I&apos;m a Caregiver
                </button>
              </div>
            </div>

            <h1
              className={`text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight transition-all duration-700 transform ${
                userType === "caregiver" ? "text-green-700" : "text-blue-700"
              } ${showCaregiverElements.heading ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
            >
              {userTypeContent[userType].title}{" "}
              <span
                className={`block sm:inline ${userType === "caregiver" ? "text-green-800" : "text-blue-800"}`}
              >
                {userTypeContent[userType].subtitle}
              </span>
            </h1>

            <p
              className={`text-base sm:text-lg md:text-xl lg:text-2xl max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed transition-all duration-700 transform px-4 sm:px-0 ${
                userType === "caregiver" ? "text-green-600" : "text-blue-600"
              } ${showCaregiverElements.description ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
            >
              {userTypeContent[userType].description}
            </p>

            <div
              className={`flex justify-center transition-all duration-700 transform px-4 sm:px-0 ${
                showCaregiverElements.button
                  ? "translate-y-0 opacity-100"
                  : "translate-y-8 opacity-0"
              }`}
            >
              <a
                href={`/login?type=${userType}`}
                className={`px-6 sm:px-8 py-3 sm:py-4 bg-white/30 backdrop-blur-lg rounded-lg sm:rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 text-center max-w-full ${
                  userType === "caregiver"
                    ? "border border-green-300/50 text-green-700"
                    : "border border-blue-300/50 text-blue-700"
                }`}
              >
                {userTypeContent[userType].cta}
              </a>
            </div>
          </div>
        </section>

        {/* Customize Menu - Only for patients */}
        {/* {userType === "patient" && showCustomizeMenu && (
          <PlasmaControls
            onColorChange={(color) =>
              setPlasmaConfig((prev) => ({ ...prev, color }))
            }
            onDirectionChange={(direction) =>
              setPlasmaConfig((prev) => ({ ...prev, direction }))
            }
            onSpeedChange={(scale) =>
              setPlasmaConfig((prev) => ({ ...prev, scale }))
            }
            onOpacityChange={(opacity) =>
              setPlasmaConfig((prev) => ({ ...prev, opacity }))
            }
            onMouseInteractiveChange={(mouseInteractive) =>
              setPlasmaConfig((prev) => ({ ...prev, mouseInteractive }))
            }
            initialValues={plasmaConfig}
          />
        )} */}
      </div>
    </div>
  );
}
