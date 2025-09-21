# Phone Number Integration - Complete Setup Guide

## Overview
This update adds comprehensive phone number support during account creation and profile management, enabling the demo call functionality to work seamlessly.

## ✅ Features Added

### 1. **Account Creation with Phone Number**
- **Optional phone number field** during signup for both patients and caregivers
- **Smart field labeling** and descriptions based on user type
- **Automatic phone formatting** (+1 (555) 123-4567 format)
- **Proper database storage** in correct field based on user type

### 2. **Clickable User Profile Section**
- **Interactive user avatar/info** in sidebar
- **Separate profile view** accessible via clicking user section
- **Visual indicators** when profile section is active
- **Works in both expanded and collapsed sidebar states**

### 3. **Comprehensive Profile Management**
- **Complete settings page** for updating profile information
- **Phone number editing** with formatting and validation
- **User type-specific help text** explaining phone number usage
- **Real-time save feedback** and error handling

## 📱 User Experience Flow

### For New Users (Signup)
1. User selects Patient or Caregiver portal
2. Fills out required fields (name, email, password)
3. **Optionally** adds phone number with auto-formatting
4. System stores phone number in appropriate database field
5. Account created with phone number ready for demo calls

### For Existing Users (Profile Update)
1. User clicks on their **profile picture/name** in sidebar
2. Opens dedicated **Profile Settings** page
3. Can update name, email, and **phone number**
4. Phone number formatted automatically as they type
5. Changes saved with confirmation message

## 🗂️ Files Modified/Created

### **Database Changes**
- `migrations/20241221000001_add_patient_phone_number.sql` - Patient phone field
- `migrations/20241221000002_add_caregiver_phone_number.sql` - Caregiver phone field

### **Frontend Components**
- `app/login/page.tsx` - Added phone number to signup form
- `app/dashboard/components/SettingsView.tsx` - **NEW** Profile management page
- `components/Sidebar.tsx` - Made user section clickable
- `app/dashboard/page.tsx` - Added profile view routing

### **Integration Points**
- `app/api/demo-call/route.ts` - Uses phone numbers from profiles
- User profiles table now properly stores phone numbers by user type

## 📋 Database Schema

```sql
-- user_profiles table now includes:
patient_phone_number TEXT        -- For patient accounts
caregiver_phone_number TEXT      -- For caregiver accounts
```

## 🎯 User Type Handling

### **Patients**
- Phone number stored in `patient_phone_number` field
- Used for **receiving** demo calls and care reminders
- Help text: "For receiving care reminder calls and medical check-ins"

### **Caregivers** 
- Phone number stored in `caregiver_phone_number` field
- Used for **notifications** and contact purposes
- Help text: "For making calls to patients and receiving notifications"

## 🔄 Demo Call Integration

The demo call functionality now works seamlessly:

1. **Phone Number Source**: Pulls from appropriate field based on patient's user type
2. **Validation**: Checks if patient has phone number before placing call
3. **Error Handling**: Clear error messages if phone number missing
4. **Call Tracking**: Full logging and status tracking in scheduled_calls table

## 🚀 Testing the Complete Flow

### **Test Account Creation**
```bash
# 1. Go to patient portal
http://localhost:3000/login?type=patient

# 2. Click "Sign Up"
# 3. Fill form including optional phone number
# 4. Verify account created with phone number
```

### **Test Profile Updates**
```bash
# 1. Login to dashboard
# 2. Click on your profile picture/name in sidebar
# 3. Update phone number
# 4. Save and verify changes
```

### **Test Demo Calls**
```bash
# 1. Login as caregiver
# 2. Ensure patient has phone number in profile
# 3. Go to Care Reminders
# 4. Click "Demo Call" button
# 5. Verify call placement with proper phone number
```

## 🎨 UI/UX Improvements

### **Signup Form**
- Clear labeling: "Phone Number (Optional)"
- Context-aware placeholders and help text
- Automatic formatting as user types
- Different descriptions for patients vs caregivers

### **Sidebar Profile Section**
- **Hover effects** on profile section
- **Active state** highlighting when viewing profile
- **Edit icon** to indicate clickability
- **Tooltip** "Edit Profile" on hover

### **Settings Page**
- **Clean, modern design** matching app theme
- **Account type indicators** and status info
- **Real-time phone formatting** 
- **Context-sensitive help** for call features
- **Save confirmation** and error handling

## 🔧 Configuration Required

1. **Run Database Migrations**:
   ```bash
   npx supabase migration up
   ```

2. **Environment Variables** (for demo calls):
   ```env
   VAPI_BASE_URL=https://api.vapi.ai
   VAPI_PRIVATE_API_KEY=your_key_here
   VAPI_PHONE_NUMBER_ID=your_phone_id
   VAPI_WORKFLOW_ID=your_workflow_id
   ```

3. **Test User Accounts**:
   - Create test patient with phone number
   - Create test caregiver account
   - Verify demo call functionality

## ✨ Ready for Production

The phone number integration is now complete and production-ready:

- ✅ **Optional during signup** - no breaking changes
- ✅ **Editable after creation** - user-friendly profile management  
- ✅ **Proper validation** - formatted phone numbers
- ✅ **Demo call integration** - seamless VAPI integration
- ✅ **Type-safe database** - separate fields for patient/caregiver
- ✅ **Modern UI/UX** - intuitive profile management

Users can now easily add and manage their phone numbers, enabling the full demo call experience! 📞✨