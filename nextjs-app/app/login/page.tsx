"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [userType, setUserType] = useState<"patient" | "caregiver">("patient");

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      const areaCode = digits.slice(0, 3);
      const firstPart = digits.slice(3, 6);
      const secondPart = digits.slice(6, 10);
      return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
    } else if (digits.length >= 6) {
      const areaCode = digits.slice(0, 3);
      const firstPart = digits.slice(3, 6);
      const secondPart = digits.slice(6);
      return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
    } else if (digits.length >= 3) {
      const areaCode = digits.slice(0, 3);
      const remaining = digits.slice(3);
      return `+1 (${areaCode}) ${remaining}`;
    } else if (digits.length > 0) {
      return `+1 ${digits}`;
    }
    return digits;
  }

  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam === "patient" || typeParam === "caregiver") {
      setUserType(typeParam);
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        // Sign up new user
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email,
            password,
          }
        );

        if (authError) throw authError;

        if (authData.user) {
          // Create user profile with phone number in appropriate field
          const profileData = {
            id: authData.user.id,
            email: email,
            full_name: fullName,
            user_type: userType,
            patient_phone_number: userType === 'patient' && phoneNumber ? phoneNumber : null,
            caregiver_phone_number: userType === 'caregiver' && phoneNumber ? phoneNumber : null,
            preferences: {}
          }

          const { error: profileError } = await supabase
            .from("user_profiles")
            .insert([profileData]);

          if (profileError) {
            console.error("Profile creation error:", profileError);
            throw new Error("Failed to create user profile");
          }
        }

        setMessage(
          "Account created successfully! Please check your email for verification."
        );
      } else {
        // Sign in existing user
        const { data: authData, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        if (error) throw error;

        // Validate user type matches the portal they're trying to access
        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from("user_profiles")
            .select("user_type")
            .eq("id", authData.user.id)
            .single();

          if (profileError) {
            await supabase.auth.signOut();
            throw new Error("Unable to verify account type. Please try again.");
          }

          // Check if user type matches the selected portal
          if (profile.user_type !== userType) {
            await supabase.auth.signOut();
            const currentPortal =
              userType === "patient" ? "Patient" : "Caregiver";
            const accountPortal =
              profile.user_type === "patient" ? "Patient" : "Caregiver";
            const correctUrl =
              profile.user_type === "patient"
                ? "/login?type=patient"
                : "/login?type=caregiver";
            throw new Error(
              `Access Denied: This account is registered as a ${accountPortal}. You're trying to access the ${currentPortal} portal. Please go to the ${accountPortal} portal at ${window.location.origin}${correctUrl} or create a new ${currentPortal} account.`
            );
          }
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const userTypeConfig = {
    patient: {
      title: "Patient Portal",
      subtitle: "Manage your healthcare journey",
      description:
        "Record appointments, track health insights, and share with your care team.",
      icon: "👤",
      color: "from-blue-600 to-purple-600",
      bgColor: "bg-blue-50",
    },
    caregiver: {
      title: "Caregiver Dashboard",
      subtitle: "Support your loved ones",
      description:
        "Monitor patient health, coordinate care, and stay connected with medical updates.",
      icon: "🤝",
      color: "from-emerald-600 to-teal-600",
      bgColor: "bg-emerald-50",
    },
  };

  const config = userTypeConfig[userType];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* User Type Header */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r ${config.color} text-white shadow-lg mb-4`}
          >
            <span className="text-xl mr-2">{config.icon}</span>
            <span className="font-semibold">{config.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-gray-600">{config.description}</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-200">
          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-black"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setPhoneNumber(formatted);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-black"
                    placeholder={userType === 'patient' ? "+1 (555) 123-4567" : "+1 (555) 123-4567"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {userType === 'patient' 
                      ? "For receiving care reminder calls and medical check-ins"
                      : "For making calls to patients and receiving notifications"
                    }
                  </p>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder={
                  isSignUp
                    ? "Create a password (min 6 characters)"
                    : "Enter your password"
                }
              />
            </div>

            {/* User Type Display */}
            <div
              className={`p-4 rounded-xl ${config.bgColor} border-2 border-opacity-50`}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">{config.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900">
                    Signing up as{" "}
                    {userType === "patient" ? "Patient" : "Caregiver"}
                  </div>
                  <div className="text-sm text-gray-600">{config.subtitle}</div>
                </div>
              </div>
              <Link
                href="/"
                className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
              >
                ← Change user type
              </Link>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl ${
                  message.includes("successfully") ||
                  message.includes("verification")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="text-sm">{message}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 bg-gradient-to-r ${config.color} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {isLoading
                ? "Loading..."
                : isSignUp
                  ? `Create ${userType === "patient" ? "Patient" : "Caregiver"} Account`
                  : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage("");
                setFullName("");
                setPhoneNumber("");
              }}
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
