# Vercel Deployment Troubleshooting Guide

## ✅ Pre-Deployment Checklist

### 1. **Build Success Locally**
```bash
npm run build
```
- Ensure no TypeScript errors
- Ensure no ESLint errors
- Verify all pages render correctly

### 2. **Environment Variables Setup**
- Add environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OPENAI_API_KEY` (if using OpenAI)

### 3. **Database Setup**
- Run the SQL schema in Supabase SQL Editor:
```sql
-- Run the contents of supabase/schema.sql in your Supabase dashboard
```

## 🚨 Common Vercel Deployment Errors & Solutions

### **FUNCTION_INVOCATION_FAILED (500)**
**Cause:** Server-side code errors during runtime

**Solutions:**
1. Check Vercel function logs in dashboard
2. Verify environment variables are set correctly
3. Test API routes locally with `npm run build && npm start`
4. Check Supabase connection:
```javascript
// Test in a simple API route
const { data, error } = await supabase.auth.getUser()
console.log('Supabase test:', { data, error })
```

### **FUNCTION_INVOCATION_TIMEOUT (504)**
**Cause:** Functions taking too long (10s limit for Hobby, 60s for Pro)

**Solutions:**
1. Optimize database queries
2. Add proper indexes to database tables
3. Use Supabase connection pooling
4. Consider upgrading to Pro plan

### **DEPLOYMENT_BLOCKED (403)**
**Cause:** Build or deployment restrictions

**Solutions:**
1. Check if repository is private (requires Pro plan for private repos)
2. Verify team permissions
3. Check build command in Vercel settings

### **MIDDLEWARE_INVOCATION_FAILED (500)**
**Cause:** Middleware errors (common with auth middleware)

**Solutions:**
1. Test middleware locally
2. Check if cookies are being set correctly
3. Verify Supabase client configuration in middleware
4. Ensure middleware.ts doesn't have async issues:
```typescript
// Ensure proper async handling
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}
```

### **BUILD Failures**
**Common Causes & Solutions:**

1. **TypeScript Errors:**
```bash
# Fix locally first
npm run build
# Address all TypeScript errors
```

2. **Missing Dependencies:**
```bash
# Ensure all dependencies are in package.json
npm install --production
```

3. **Environment Variables in Build:**
```bash
# Ensure NEXT_PUBLIC_ variables are available at build time
```

## 🔧 Step-by-Step Deployment Process

### 1. **Initial Setup**
```bash
# 1. Push code to GitHub
git add .
git commit -m "Initial deployment setup"
git push origin main

# 2. Connect to Vercel
# - Go to vercel.com
# - Import GitHub repository
# - Configure environment variables
```

### 2. **Environment Variables Setup in Vercel**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key (if using)
```

### 3. **Database Setup**
```sql
-- In Supabase SQL Editor, run:
CREATE TABLE IF NOT EXISTS todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policies (see supabase/schema.sql for full policies)
```

### 4. **Deploy & Test**
1. Deploy on Vercel
2. Test authentication flow
3. Test database operations
4. Check browser console for errors

## 🐛 Debugging Tips

### **Check Vercel Logs**
1. Go to Vercel Dashboard → Project → Functions tab
2. Check runtime logs for errors
3. Look for specific error messages

### **Test Supabase Connection**
```javascript
// Add to a test API route
export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('todos').select('count')
    return Response.json({ success: true, data, error })
  } catch (error) {
    return Response.json({ success: false, error: error.message })
  }
}
```

### **Common Middleware Issues**
```typescript
// Ensure middleware handles edge cases
if (!user && request.nextUrl.pathname === '/') {
  // Allow home page access
  return supabaseResponse
}
```

### **CORS Issues with Supabase**
1. Check Supabase → Settings → API → CORS origins
2. Add your Vercel domain: `https://your-app.vercel.app`

## 📋 Post-Deployment Checklist

- [ ] Home page loads correctly
- [ ] Authentication works (sign up/sign in/sign out)
- [ ] Protected routes redirect properly
- [ ] Database operations work (CRUD)
- [ ] No console errors in browser
- [ ] Environment variables are set
- [ ] Supabase RLS policies are active

## 🆘 If All Else Fails

1. **Check Vercel Status**: https://www.vercel-status.com/
2. **Supabase Status**: https://status.supabase.com/
3. **Create Minimal Reproduction**:
   - Deploy a simple Next.js app first
   - Add Supabase integration step by step
4. **Contact Support**:
   - Vercel: Include deployment URL and error logs
   - Supabase: Include project reference and error details

## 🔄 Redeployment Process

If deployment fails:
```bash
# 1. Fix issues locally
npm run build  # Ensure this succeeds

# 2. Commit and push
git add .
git commit -m "Fix deployment issues"
git push origin main

# 3. Vercel will auto-redeploy
# Or trigger manual deployment in Vercel dashboard
```

Remember: Always test locally with `npm run build && npm start` before deploying to catch issues early!