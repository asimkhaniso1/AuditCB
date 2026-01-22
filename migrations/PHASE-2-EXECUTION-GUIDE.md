# Phase 2: Database Migration Execution Guide

## 📋 Overview

This guide walks you through executing the database migrations in Supabase.

**Time Required:** 30-60 minutes  
**Difficulty:** Medium  
**Reversible:** Yes (backups created automatically)

---

## ⚠️ Before You Start

### Prerequisites Checklist

- [ ] You have admin access to your Supabase project
- [ ] You've reviewed the migration SQL files
- [ ] You understand what will be changed
- [ ] You're ready to create auth users if needed

### Backup Recommendation

While the migrations create automatic backups, it's recommended to:
1. Go to Supabase Dashboard → Database → Backups
2. Create a manual backup before proceeding
3. Note the backup timestamp

---

## 🚀 Step-by-Step Execution

### Step 0: Pre-Migration Check (5 minutes)

**Purpose:** Understand what data you have and what will be migrated

1. Open **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open `migrations/00-pre-migration-check.sql` in VS Code
5. Copy the entire contents
6. Paste into Supabase SQL Editor
7. Click **Run** (or press Ctrl+Enter)

**What to look for:**
- ✅ Number of existing users/profiles
- ✅ Number of existing auditors (if any)
- ✅ Number of auditor assignments
- ⚠️ List of auditors without auth users (you'll need to create these)

**Example Output:**
```
=== CURRENT DATA COUNTS ===
Profiles: 5
Auditors: 3
Auditor Assignments: 8
Auth Users: 5

=== AUDITORS VS USERS ANALYSIS ===
Auditors with auth users: 2
Auditors without auth users: 1

⚠️  These auditors need auth user creation:
  • John Doe (john@example.com) - Lead Auditor
```

**Action:** Note down any auditors that need auth user creation

---

### Step 1: Create Auditor Profiles Table (10 minutes)

**Purpose:** Create the new table to store auditor professional data

1. In Supabase SQL Editor, click **New Query**
2. Open `migrations/01-create-auditor-profiles-table.sql` in VS Code
3. Copy the entire contents
4. Paste into Supabase SQL Editor
5. Click **Run**

**Expected Output:**
```
✅ Auditor Profiles table created successfully!
✅ Indexes created
✅ RLS enabled with 3 policies
✅ Triggers configured

Next step: Run update-auditor-assignments-schema.sql
```

**Verification:**
```sql
-- Run this to verify table was created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'auditor_profiles';

-- Should return: auditor_profiles
```

**If you see errors:**
- "relation already exists" → Table already created, skip to Step 2
- Permission denied → Check you're logged in as admin
- Other errors → Copy error message and let me know

---

### Step 2: Update Auditor Assignments Schema (10 minutes)

**Purpose:** Add `user_id` column to assignments table

1. In Supabase SQL Editor, click **New Query**
2. Open `migrations/02-update-auditor-assignments-schema.sql` in VS Code
3. Copy the entire contents
4. Paste into Supabase SQL Editor
5. Click **Run**

**Expected Output:**
```
✅ Backup created: auditor_assignments_backup
✅ Added user_id column to auditor_assignments
✅ Migrated X assignments to use user_id
✅ Created index on user_id column

=== Data Verification ===
Total assignments: 8
Assignments with user_id: 8
Assignments with auditor_id: 8
Mismatches: 0

✅ All assignments have user_id populated
```

**Important:** Review the verification section carefully!
- All assignments should have `user_id` populated
- Mismatches should be 0 (or investigate if not)

**Verification:**
```sql
-- Check the new column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'auditor_assignments'
  AND column_name IN ('user_id', 'auditor_id');

-- Should show both columns
```

---

### Step 3: Migrate Auditor Data (15-20 minutes)

**Purpose:** Link existing auditors to user accounts

1. In Supabase SQL Editor, click **New Query**
2. Open `migrations/03-migrate-auditor-data.sql` in VS Code
3. Copy the entire contents
4. Paste into Supabase SQL Editor
5. Click **Run**

**Expected Output:**
```
=== Current Data Analysis ===
Auditors in auditors table: 3
Users in profiles table: 5
Auth users in auth.users: 5

✅ Created 1 user profiles for auditors
✅ Created 2 auditor profiles linked to users
✅ Updated 8 assignments to use user_id

⚠️  Found 1 auditors without auth users
⚠️  These need manual creation in Supabase Dashboard

=== Auditors Needing Auth User Creation ===
  • John Doe (john@example.com) - Role: Lead Auditor

=== Migration Summary ===
Total auditors: 3
Auditors with profiles: 2
Auditors with auth users: 2
Total assignments: 8
Assignments with user_id: 8

✅ All auditors with auth users have profiles
✅ All assignments have user_id
```

**Action Required:** If any auditors are listed as needing auth user creation:

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Add User"**
3. Enter the email shown in the migration output
4. Set a temporary password (e.g., `Welcome123!`)
5. Click **Create User**
6. Repeat for each auditor listed
7. **Re-run Step 3** to link the newly created users

---

### Step 4: Create Missing Auth Users (If Needed)

**Only if Step 3 showed auditors without auth users**

For each auditor listed:

1. **Supabase Dashboard → Authentication → Users**
2. Click **"Add User"**
3. Fill in:
   - Email: (from migration output)
   - Password: `Welcome123!` (temporary)
   - Auto Confirm User: ✅ **Check this box**
4. Click **Create User**

**Then re-run Step 3:**
- Copy `migrations/03-migrate-auditor-data.sql` again
- Paste and run in SQL Editor
- Verify all auditors are now linked

---

### Step 5: Final Verification (5 minutes)

Run these verification queries:

```sql
-- 1. Check auditor profiles were created
SELECT 
    u.email,
    p.full_name,
    p.role,
    ap.auditor_number,
    ap.experience
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.auditor_profiles ap ON ap.user_id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
ORDER BY p.full_name;

-- Should show all auditor users with their profiles

-- 2. Check assignments have user_id
SELECT 
    COUNT(*) as total_assignments,
    COUNT(user_id) as with_user_id,
    COUNT(auditor_id) as with_auditor_id
FROM public.auditor_assignments;

-- All three counts should match

-- 3. Check sample assignment data
SELECT 
    aa.id,
    aa.client_id,
    aa.user_id,
    p.full_name as auditor_name,
    p.role,
    aa.assigned_at
FROM public.auditor_assignments aa
JOIN public.profiles p ON p.id = aa.user_id::uuid
ORDER BY aa.assigned_at DESC
LIMIT 5;

-- Should show assignments with auditor names
```

**Expected Results:**
- All auditor users have profiles
- All assignments have `user_id`
- Sample data looks correct

---

## ✅ Success Criteria

You've successfully completed Phase 2 if:

- [ ] All 3 migration scripts ran without errors
- [ ] `auditor_profiles` table exists
- [ ] `auditor_assignments` has `user_id` column
- [ ] All auditor users have profiles in `auditor_profiles`
- [ ] All assignments have `user_id` populated
- [ ] Verification queries return expected data
- [ ] No error messages in migration output

---

## 🐛 Troubleshooting

### Error: "relation already exists"
**Solution:** Table already created. Skip that migration or drop and recreate.

### Error: "column already exists"
**Solution:** Column already added. Check if data is migrated correctly.

### Error: "foreign key constraint violation"
**Solution:** Some `user_id` values don't exist in `auth.users`. Create missing users first.

### Error: "permission denied"
**Solution:** Make sure you're logged in as admin/owner in Supabase.

### Warning: "Some assignments missing user_id"
**Solution:** Check the `auditor_id` values in those assignments. They might reference non-existent users.

### Issue: "Auditors without auth users"
**Solution:** This is expected. Create auth users manually in Supabase Dashboard.

---

## 📊 What Changed

After successful migration:

### New Tables:
- `auditor_profiles` - Professional data for auditors

### Modified Tables:
- `auditor_assignments` - Now has `user_id` column

### New Data:
- Auditor profiles linked to users
- Assignments updated to use user IDs

### Unchanged:
- `profiles` table (existing data preserved)
- `auth.users` table (existing users preserved)
- `clients` table (unchanged)
- Old `auditors` table (preserved for safety)

---

## 🔄 Rollback (If Needed)

If something went wrong:

```sql
-- Restore auditor_assignments from backup
DROP TABLE IF EXISTS public.auditor_assignments;
CREATE TABLE public.auditor_assignments AS
SELECT * FROM public.auditor_assignments_backup;

-- Recreate indexes
CREATE INDEX idx_auditor_assignments_auditor_id 
    ON public.auditor_assignments(auditor_id);
CREATE INDEX idx_auditor_assignments_client_id 
    ON public.auditor_assignments(client_id);

-- Drop new table
DROP TABLE IF EXISTS public.auditor_profiles CASCADE;

-- Verify rollback
SELECT COUNT(*) FROM public.auditor_assignments;
```

---

## 📝 Post-Migration Notes

After successful migration, make note of:

1. **How many auditor profiles were created:** _______
2. **How many assignments were updated:** _______
3. **Any auditors that needed manual auth user creation:** _______
4. **Any issues encountered:** _______

---

## ➡️ Next Steps

Once Phase 2 is complete:

1. **Update me:** Let me know the migration completed successfully
2. **Share any issues:** If you encountered problems, share the error messages
3. **Ready for Phase 3:** I'll update the frontend code to use the new schema

---

## 🆘 Need Help?

If you encounter any issues:

1. Copy the error message
2. Note which step you were on
3. Share the verification query results
4. Let me know and I'll help troubleshoot

---

**Estimated Time:** 30-60 minutes  
**Current Status:** Ready to execute  
**Next Phase:** Frontend code updates (Phase 3)
