# Database Migration Guide: User-Auditor Integration

## Overview

This directory contains SQL migration scripts to integrate User Management and Auditor Management into a unified system.

## Migration Files

### 01-create-auditor-profiles-table.sql
Creates the new `auditor_profiles` table to store professional auditor data linked to user accounts.

**What it does:**
- Creates `auditor_profiles` table with user_id foreign key
- Sets up indexes for performance
- Enables RLS with appropriate policies
- Creates triggers for timestamp management

**Run time:** ~30 seconds

### 02-update-auditor-assignments-schema.sql
Updates the `auditor_assignments` table to use `user_id` instead of `auditor_id`.

**What it does:**
- Adds `user_id` column
- Migrates data from `auditor_id` to `user_id`
- Creates backup table for safety
- Creates indexes

**Run time:** ~1 minute

### 03-migrate-auditor-data.sql
Migrates existing auditor data to the new unified model.

**What it does:**
- Creates user profiles for auditors without accounts
- Links auditors to users via auditor_profiles
- Updates assignments to use user IDs
- Identifies auditors needing manual auth user creation

**Run time:** ~2-3 minutes

## Execution Order

**IMPORTANT: Run these scripts in order!**

```
1. 01-create-auditor-profiles-table.sql
2. 02-update-auditor-assignments-schema.sql
3. 03-migrate-auditor-data.sql
```

## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Review current data structure
- [ ] Verify you have admin access to Supabase
- [ ] Test on staging environment first (if available)
- [ ] Notify team of maintenance window

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `01-create-auditor-profiles-table.sql`
5. Click **Run**
6. Review the output messages
7. Repeat for scripts 02 and 03

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db execute --file migrations/01-create-auditor-profiles-table.sql
supabase db execute --file migrations/02-update-auditor-assignments-schema.sql
supabase db execute --file migrations/03-migrate-auditor-data.sql
```

## Post-Migration Steps

### 1. Verify Data Migration

Run these verification queries in Supabase SQL Editor:

```sql
-- Check auditor profiles were created
SELECT COUNT(*) as profile_count FROM public.auditor_profiles;

-- Check assignments have user_id
SELECT 
    COUNT(*) as total,
    COUNT(user_id) as with_user_id
FROM public.auditor_assignments;

-- Check for auditors without auth users
SELECT 
    a.name,
    a.email
FROM public.auditors a
LEFT JOIN auth.users u ON LOWER(u.email) = LOWER(a.email)
WHERE u.id IS NULL
  AND a.email IS NOT NULL;
```

### 2. Create Missing Auth Users

If the migration identified auditors without auth users:

1. Go to **Supabase Dashboard → Authentication → Users**
2. Click **"Add User"**
3. Enter the email from the migration output
4. Set a temporary password
5. Repeat for each missing user
6. Re-run `03-migrate-auditor-data.sql` to link them

### 3. Update Frontend Code

After database migration is complete, update the frontend:

1. Update `settings-module.js` - Auto-create auditor profiles
2. Update `clients-module.js` - Use `user_id` in assignments
3. Update `advanced-modules.js` - Fetch from `auditor_profiles`
4. Test thoroughly!

## Rollback Plan

If something goes wrong:

### Rollback Script

```sql
-- Restore from backup (if you created one)
DROP TABLE IF EXISTS public.auditor_assignments;
CREATE TABLE public.auditor_assignments AS
SELECT * FROM public.auditor_assignments_backup;

-- Drop new tables
DROP TABLE IF EXISTS public.auditor_profiles CASCADE;

-- Restore indexes
CREATE INDEX idx_auditor_assignments_auditor_id 
    ON public.auditor_assignments(auditor_id);
CREATE INDEX idx_auditor_assignments_client_id 
    ON public.auditor_assignments(client_id);
```

## Common Issues & Solutions

### Issue: "relation auditor_profiles already exists"
**Solution:** Table already created. Skip to next migration.

### Issue: "column user_id already exists"
**Solution:** Column already added. Check if data is migrated correctly.

### Issue: "foreign key constraint violation"
**Solution:** Some user_ids don't exist in auth.users. Create missing auth users first.

### Issue: "duplicate key value violates unique constraint"
**Solution:** Some auditors already have profiles. This is OK - migration uses ON CONFLICT DO NOTHING.

## Verification Checklist

After running all migrations:

- [ ] `auditor_profiles` table exists
- [ ] `auditor_profiles` has RLS enabled
- [ ] `auditor_assignments` has `user_id` column
- [ ] All assignments have `user_id` populated
- [ ] Auditor profiles linked to users
- [ ] Sample queries return expected data
- [ ] No error messages in migration output

## Timeline

- **Database Migration:** 30-60 minutes
- **Frontend Updates:** 2-3 hours
- **Testing:** 2-3 hours
- **Total:** 5-7 hours

## Support

If you encounter issues:

1. Check the migration output messages
2. Run verification queries
3. Review the rollback plan
4. Check Supabase logs for errors
5. Consult the main integration plan documents

## Next Steps

After successful migration:

1. Update frontend code (see Phase 3 in main plan)
2. Test user creation with Auditor role
3. Test client assignments
4. Test access control
5. Monitor for any issues
6. Consider dropping old `auditors` table (after thorough testing)

---

**Created:** 2026-01-22  
**Version:** 1.0  
**Status:** Ready for execution
