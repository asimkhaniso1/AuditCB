# Supabase Setup Guide for AuditCB360

This guide will help you set up Supabase for production authentication and database operations.

---

## 📋 Prerequisites

- Supabase account (free tier available at https://supabase.com)
- AuditCB360 application with latest fixes applied

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Create a new organization (if needed)
4. Click "New Project"
5. Fill in:
   - **Name:** AuditCB360
   - **Database Password:** (generate strong password)
   - **Region:** Choose closest to your users
6. Click "Create new project"
7. Wait 2-3 minutes for project to be ready

### Step 2: Get Your Credentials

1. In your Supabase project dashboard
2. Click "Settings" (gear icon) in sidebar
3. Click "API" under Project Settings
4. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

### Step 3: Configure AuditCB360

**Option A: Via Browser Console (Quick Test)**
```javascript
localStorage.setItem('supabase_url', 'https://your-project.supabase.co');
localStorage.setItem('supabase_anon_key', 'your-anon-key-here');
location.reload();
```

**Option B: Via Settings Module (Recommended)**
1. Login to AuditCB360 with demo credentials
2. Go to Settings → CB Profile
3. Add fields for Supabase URL and Key
4. Save settings

### Step 4: Create Database Schema

In Supabase SQL Editor, run this schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
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
    shifts TEXT,
    industry TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditors table
CREATE TABLE public.auditors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    standards TEXT[] DEFAULT ARRAY[]::TEXT[],
    experience INTEGER,
    domain_expertise TEXT[] DEFAULT ARRAY[]::TEXT[],
    industries TEXT[] DEFAULT ARRAY[]::TEXT[],
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Plans table
CREATE TABLE public.audit_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    standard TEXT NOT NULL,
    date DATE NOT NULL,
    cost DECIMAL(10,2),
    auditor_ids UUID[] DEFAULT ARRAY[]::UUID[],
    man_days INTEGER,
    status TEXT NOT NULL,
    objectives TEXT,
    scope TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Reports table
CREATE TABLE public.audit_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    audit_plan_id UUID REFERENCES public.audit_plans(id),
    date DATE NOT NULL,
    status TEXT NOT NULL,
    findings INTEGER DEFAULT 0,
    ncrs JSONB DEFAULT '[]'::JSONB,
    checklist_progress JSONB DEFAULT '[]'::JSONB,
    conclusion TEXT,
    recommendation TEXT,
    conformities INTEGER DEFAULT 0,
    finalized_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log table (for compliance)
CREATE TABLE public.audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID,
    user_id UUID REFERENCES auth.users(id),
    changes JSONB,
    ip_address INET
);

-- Create indexes for performance
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_audit_plans_client ON public.audit_plans(client_id);
CREATE INDEX idx_audit_reports_client ON public.audit_reports(client_id);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- Clients: All authenticated users can read, only managers/admins can write
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

CREATE POLICY "Managers can update clients"
    ON public.clients FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

-- Auditors: All authenticated users can read
CREATE POLICY "Authenticated users can view auditors"
    ON public.auditors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers can manage auditors"
    ON public.auditors FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager')
        )
    );

-- Audit Plans: Users can view, auditors+ can create/edit
CREATE POLICY "Authenticated users can view audit plans"
    ON public.audit_plans FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Auditors can create audit plans"
    ON public.audit_plans FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor')
        )
    );

-- Audit Reports: Similar to plans
CREATE POLICY "Authenticated users can view reports"
    ON public.audit_reports FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Auditors can create reports"
    ON public.audit_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Certification Manager', 'Lead Auditor', 'Auditor')
        )
    );

-- Audit Log: Append-only for all authenticated users
CREATE POLICY "Users can insert audit logs"
    ON public.audit_log FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'Admin'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auditors_updated_at BEFORE UPDATE ON public.auditors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_plans_updated_at BEFORE UPDATE ON public.audit_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_reports_updated_at BEFORE UPDATE ON public.audit_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 5: Create Test Users

In Supabase Authentication:

1. Go to Authentication → Users
2. Click "Add user"
3. Create users:

**Admin User:**
- Email: `admin@auditcb360.com`
- Password: (set strong password)
- User Metadata (JSON):
```json
{
  "name": "Admin User",
  "role": "Admin",
  "permissions": ["all"]
}
```

**Manager User:**
- Email: `manager@auditcb360.com`
- Password: (set strong password)
- User Metadata:
```json
{
  "name": "Certification Manager",
  "role": "Certification Manager",
  "permissions": ["view_all", "edit_clients", "approve_reports", "manage_auditors"]
}
```

### Step 6: Test Authentication

1. Reload AuditCB360
2. You should see login screen
3. Login with: `admin@auditcb360.com` / (your password)
4. Should successfully authenticate via Supabase!

---

## 🔒 Security Best Practices

### 1. **Never Expose Service Role Key**
- Only use the `anon` public key in frontend
- Keep `service_role` key secret (server-side only)

### 2. **Use Environment Variables**
For Vercel deployment:
```bash
# In Vercel dashboard → Settings → Environment Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. **Enable Email Confirmation**
In Supabase → Authentication → Settings:
- Enable "Confirm email"
- Configure email templates

### 4. **Set Up Password Requirements**
- Minimum 8 characters
- Require special characters
- Enable password breach detection

---

## 📊 Monitoring

### View Auth Activity:
1. Supabase → Authentication → Users
2. See login history, active sessions

### View Database Activity:
1. Supabase → Database → Logs
2. Monitor queries, errors

### Set Up Alerts:
1. Supabase → Settings → Alerts
2. Configure email alerts for:
   - Failed login attempts
   - Database errors
   - High resource usage

---

## 🔄 Data Migration

To migrate existing localStorage data to Supabase:

```javascript
// Run this in browser console after Supabase setup
async function migrateToSupabase() {
    const state = JSON.parse(localStorage.getItem('auditCB360State'));
    
    // Migrate clients
    for (const client of state.clients) {
        await SupabaseClient.db.insert('clients', client);
    }
    
    // Migrate auditors
    for (const auditor of state.auditors) {
        await SupabaseClient.db.insert('auditors', auditor);
    }
    
    console.log('Migration complete!');
}

// Run migration
migrateToSupabase();
```

---

## 🐛 Troubleshooting

### Issue: "Supabase not initialized"
**Solution:** Check credentials are set correctly
```javascript
console.log(localStorage.getItem('supabase_url'));
console.log(localStorage.getItem('supabase_anon_key'));
```

### Issue: "Row Level Security policy violation"
**Solution:** Check user has correct role in user_profiles table

### Issue: "Invalid JWT"
**Solution:** Session expired, logout and login again

### Issue: "CORS error"
**Solution:** Add your domain to Supabase → Settings → API → CORS

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
- [Database Functions](https://supabase.com/docs/guides/database/functions)

---

## ✅ Checklist

- [ ] Created Supabase project
- [ ] Copied URL and anon key
- [ ] Configured AuditCB360 with credentials
- [ ] Ran database schema SQL
- [ ] Created test users
- [ ] Tested login with Supabase
- [ ] Enabled RLS policies
- [ ] Set up email confirmation
- [ ] Configured environment variables for Vercel
- [ ] Migrated existing data (if needed)

---

**Setup complete! Your AuditCB360 is now using Supabase for production-grade authentication and database operations.** 🎉
