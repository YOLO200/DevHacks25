"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  user_type: "patient" | "caregiver";
  patient_phone_number?: string;
  caregiver_phone_number?: string;
  preferences?: any;
}

export default function SettingsView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
  });

  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        full_name: data.full_name || "",
        email: data.email || "",
        phone_number:
          data.user_type === "patient"
            ? data.patient_phone_number || ""
            : data.caregiver_phone_number || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      setMessage("Failed to load profile information.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    setMessage("");

    try {
      // Prepare update data
      const updateData: any = {
        full_name: formData.full_name,
        email: formData.email,
      };

      // Add phone number to appropriate field based on user type
      if (profile.user_type === "patient") {
        updateData.patient_phone_number = formData.phone_number || null;
      } else {
        updateData.caregiver_phone_number = formData.phone_number || null;
      }

      const { error } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (error) throw error;

      // Update auth email if it changed
      if (formData.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email,
        });

        if (emailError) {
          console.warn("Failed to update auth email:", emailError);
          setMessage(
            "Profile updated, but email change requires verification. Check your inbox."
          );
        } else {
          setMessage("Profile updated successfully!");
        }
      } else {
        setMessage("Profile updated successfully!");
      }

      // Refresh profile data
      await fetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhoneFormat = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
        6,
        10
      )}`;
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
        6
      )}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Profile Not Found
          </h1>
          <p className="text-gray-600">
            Unable to load your profile information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">
            Manage your account information and preferences
          </p>
        </div>

        {/* Profile Settings Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl bg-gradient-to-br ${
                profile.user_type === "patient"
                  ? "from-blue-500 to-purple-600"
                  : "from-emerald-500 to-teal-600"
              }`}
            >
              {profile.user_type === "patient" ? "👤" : "🤝"}
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-900">
                {profile.full_name}
              </h2>
              <p className="text-gray-600 capitalize">
                {profile.user_type} Account
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    full_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number{" "}
                <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => {
                  const formatted = handlePhoneFormat(e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    phone_number: formatted,
                  }));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  profile.user_type === "patient"
                    ? "(555) 123-4567"
                    : "Enter your phone number"
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                {profile.user_type === "patient"
                  ? "Required for receiving care reminder calls and medical check-ins"
                  : "Used for making calls to patients and receiving notifications"}
              </p>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl ${
                  message.includes("successfully")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="text-sm">{message}</div>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    full_name: profile.full_name || "",
                    email: profile.email || "",
                    phone_number:
                      profile.user_type === "patient"
                        ? profile.patient_phone_number || ""
                        : profile.caregiver_phone_number || "",
                  });
                  setMessage("");
                }}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Account Type Info */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Account Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Account Type:</span>
              <span className="font-medium text-gray-900 capitalize">
                {profile.user_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account ID:</span>
              <span className="font-mono text-sm text-gray-700">
                {profile.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone Number Status:</span>
              <span
                className={`font-medium ${
                  formData.phone_number
                    ? "text-green-600"
                    : "text-orange-600"
                }`}
              >
                {formData.phone_number ? "Configured" : "Not Set"}
              </span>
            </div>
          </div>
        </div>

        {/* Call Features Info */}
        {profile.user_type === "patient" && (
          <div className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-start">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                <span className="text-blue-600 text-lg">📞</span>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-2">
                  Call Features
                </h4>
                <p className="text-blue-700 text-sm">
                  {formData.phone_number
                    ? "Your phone number is configured for receiving care reminder calls and medical check-ins from your caregivers."
                    : "Add your phone number to receive care reminder calls and medical check-ins from your caregivers."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}