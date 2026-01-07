# 🔐 SUPABASE AUTH SETUP GUIDE

## Overview
This guide will help you set up proper Supabase Authentication for your AuditCB360 application.

---

## OPTION 1: Quick Fix (Recommended for Now)

**Use public access policies** - This allows the app to work immediately without auth setup.

### Steps:
1. Run `FIX_RLS_POLICIES.sql` in Supabase SQL Editor
2. Refresh your app
3. Everything should work!

**Pros:**
- ✅ Works immediately
- ✅ No additional setup needed
- ✅ App functions normally

**Cons:**
- ⚠️ Data is publicly accessible (anyone with the URL can access)
- ⚠️ Not suitable for production with sensitive data

**When to use:** Development, testing, or if data is not sensitive

---

## OPTION 2: Proper Supabase Auth (Production Ready)

**Implement full Supabase Authentication** - Secure, production-ready solution.

### Part A: Supabase Dashboard Setup

#### 1. Enable Email Auth
1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. **Email** should already be enabled
3. Configure settings:
   - **Enable email confirmations:** OFF (for easier testing)
   - **Enable email change confirmations:** OFF
   - **Secure email change:** OFF

#### 2. Create Test Users
1. Go to **Authentication** → **Users**
2. Click **"Add user"**
3. Create users:
   - Email: `info@companycertification.com`
   - Password: `admin123` (or your choice)
   - Auto-confirm: ✅ Check this
   - Click **"Create user"**

4. Repeat for other users as needed

#### 3. Configure Auth Settings
1. Go to **Authentication** → **Settings**
2. **Site URL:** `https://audit.companycertification.com`
3. **Redirect URLs:** Add:
   - `https://audit.companycertification.com`
   - `http://localhost:8080` (for local testing)

### Part B: Update RLS Policies

Run this SQL in Supabase SQL Editor:

```sql
-- Drop public policies
DROP POLICY IF EXISTS "Allow all on clients" ON clients;
DROP POLICY IF EXISTS "Allow all on auditors" ON auditors;
DROP POLICY IF EXISTS "Allow all on audit_plans" ON audit_plans;
DROP POLICY IF EXISTS "Allow all on audit_reports" ON audit_reports;
DROP POLICY IF EXISTS "Allow all on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;
DROP POLICY IF EXISTS "Allow all on documents" ON documents;
DROP POLICY IF EXISTS "Allow all on certification_decisions" ON certification_decisions;
DROP POLICY IF EXISTS "Allow all on audit_log" ON audit_log;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can access clients" 
ON clients FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access auditors" 
ON auditors FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access audit_plans" 
ON audit_plans FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access audit_reports" 
ON audit_reports FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access checklists" 
ON checklists FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access settings" 
ON settings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access documents" 
ON documents FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access certification_decisions" 
ON certification_decisions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users can access audit_log" 
ON audit_log FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

### Part C: Update Application Code

This requires modifying your login system to use Supabase Auth instead of the current custom auth.

**Files to modify:**
1. `supabase-client.js` - Add auth methods
2. `script.js` - Update login flow
3. Remove custom auth logic

**Estimated effort:** 2-3 hours of development

---

## OPTION 3: Hybrid Approach (Best for Now)

**Use public policies now, plan for auth later**

### Steps:
1. **Now:** Run `FIX_RLS_POLICIES.sql` to make it work
2. **Later:** When ready for production, implement Option 2

### Migration Path:
1. App works immediately with public policies
2. Users can be created in Supabase Auth
3. When ready, update code to use Supabase Auth
4. Switch to authenticated policies
5. No data migration needed!

---

## 🎯 RECOMMENDATION

**For immediate use:** Choose **OPTION 1** (Quick Fix)
- Run `FIX_RLS_POLICIES.sql`
- App works immediately
- You can implement proper auth later

**For production:** Plan to implement **OPTION 2** (Proper Auth)
- More secure
- Better user management
- Industry standard

---

## 📋 Quick Decision Matrix

| Scenario | Recommended Option |
|----------|-------------------|
| Testing/Development | Option 1 (Quick Fix) |
| Internal use only | Option 1 or 3 |
| Production with sensitive data | Option 2 (Proper Auth) |
| Production launch soon | Option 3 (Hybrid) |
| Multiple users/roles | Option 2 (Proper Auth) |

---

## ⚡ Quick Start (Option 1)

**To get your app working RIGHT NOW:**

1. Open Supabase SQL Editor
2. Copy and run `FIX_RLS_POLICIES.sql`
3. Refresh your app
4. Login with your existing credentials
5. ✅ Everything works!

You can always implement proper auth later without losing data.

---

## 🔒 Security Notes

**Option 1 (Public policies):**
- Data is accessible via Supabase API
- Anyone with your Supabase URL can read/write
- Fine for development, not for sensitive production data

**Option 2 (Proper Auth):**
- Only authenticated users can access data
- Secure for production use
- Follows security best practices

---

## 📞 Next Steps

**Choose your option:**
- **Option 1:** Run `FIX_RLS_POLICIES.sql` now → App works immediately
- **Option 2:** Follow Part A, B, C above → Takes 2-3 hours
- **Option 3:** Do Option 1 now, Option 2 later → Best of both worlds

**I recommend Option 1 for now** so you can test everything, then implement Option 2 when you're ready for production.

What would you like to do?
