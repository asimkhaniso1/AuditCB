# Quick Supabase Setup for AuditCB360

**Your Production Site:** https://audit-cb.isoxpert.com/  
**GitHub Repo:** https://github.com/asimkhaniso1/AuditCB

---

## ✅ What's Already Done

1. ✅ Supabase database created
2. ✅ Linked with Vercel
3. ✅ Code has Supabase integration ready
4. ✅ Configuration UI created

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your AuditCB project
3. Click **Settings** → **API**
4. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long JWT token)

---

### Step 2: Configure in Vercel

1. Go to https://vercel.com/dashboard
2. Select your AuditCB project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```
Name: VITE_SUPABASE_URL
Value: https://your-project.supabase.co

Name: VITE_SUPABASE_ANON_KEY
Value: your-anon-key-here
```

5. Click **Save**
6. Redeploy your app (Vercel will auto-redeploy)

---

### Step 3: Run Database Schema

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Copy the SQL from `SUPABASE_SETUP_GUIDE.md` (lines 52-280)
4. Paste into SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Verify tables created: Go to **Table Editor**

**Tables you should see:**
- user_profiles
- clients
- auditors
- audit_plans
- audit_reports
- audit_log

---

### Step 4: Create Test Users

1. In Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Create an admin user:

```
Email: admin@auditcb360.com
Password: (choose a strong password)
```

4. After creating, click the user → **User Metadata** → **Raw JSON**
5. Add this metadata:

```json
{
  "name": "Admin User",
  "role": "Admin",
  "permissions": ["all"]
}
```

6. Click **Save**

---

### Step 5: Test the Integration

1. Open https://audit-cb.isoxpert.com/
2. You should see the login screen
3. Login with: `admin@auditcb360.com` / (your password)
4. Should successfully authenticate via Supabase! ✅

---

## 🔧 Alternative: Configure Locally (Development)

If you want to test locally before deploying:

1. Open the app locally
2. Login with demo credentials (admin/admin123)
3. Open browser console and run:

```javascript
SupabaseConfig.showConfigUI()
```

4. Enter your Supabase URL and anon key
5. Click **Test Connection**
6. If successful, click **Save Configuration**
7. Reload the page
8. Now login with your Supabase user

---

## 📊 Verify It's Working

### Check Authentication:
1. Login to the app
2. Open browser console
3. Run: `window.state.currentUser`
4. Should show your Supabase user info

### Check Database:
1. Create a test client in the app
2. Go to Supabase → **Table Editor** → **clients**
3. Should see the new client row

### Check Audit Log:
1. Perform some actions (create/edit/delete)
2. Go to Supabase → **Table Editor** → **audit_log**
3. Should see audit entries

---

## 🎯 What Happens Next

Once configured:
- ✅ All authentication goes through Supabase
- ✅ All data saved to Supabase database
- ✅ Audit logs saved to Supabase
- ✅ Row Level Security protects your data
- ✅ No more localStorage limitations
- ✅ Data accessible from anywhere
- ✅ Automatic backups by Supabase

---

## 🔄 Fallback Mode

If Supabase is not configured:
- App automatically uses demo authentication
- Data stored in localStorage
- Everything still works locally
- No data loss

---

## 📝 SQL Schema Quick Copy

Here's the essential schema (paste in Supabase SQL Editor):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Certification Manager', 'Lead Auditor', 'Auditor')),
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table
CREATE TABLE public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    standard TEXT NOT NULL,
    status TEXT NOT NULL,
    type TEXT NOT NULL,
    website TEXT,
    contacts JSONB DEFAULT '[]'::JSONB,
    sites JSONB DEFAULT '[]'::JSONB,
    employees INTEGER,
    industry TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log table
CREATE TABLE public.audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    user_id UUID REFERENCES auth.users(id),
    changes JSONB,
    metadata JSONB
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view clients"
    ON public.clients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers can insert clients"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

CREATE POLICY "Users can insert audit logs"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
```

**For complete schema with all tables, see `SUPABASE_SETUP_GUIDE.md`**

---

## 🆘 Troubleshooting

### "Supabase not initialized"
- Check environment variables in Vercel
- Verify credentials are correct
- Check browser console for errors

### "Invalid JWT" or "Session expired"
- Logout and login again
- Clear browser cache
- Check Supabase user exists

### "Permission denied" errors
- Check user has correct role in user_profiles table
- Verify RLS policies are created
- Check user is authenticated

### Data not saving to Supabase
- Check browser console for errors
- Verify tables exist in Supabase
- Check RLS policies allow the operation

---

## 📞 Need Help?

1. Check browser console for errors
2. Check Supabase logs: Dashboard → Logs
3. Review `SUPABASE_SETUP_GUIDE.md` for detailed setup
4. Check `implementation_plan.md` for integration details

---

**Ready to go! 🚀**

Once you complete these 5 steps, your AuditCB360 will be fully integrated with Supabase and production-ready!
