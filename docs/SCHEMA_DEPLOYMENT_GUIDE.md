# Database Schema Deployment Guide

## ✅ What Was Created

**File:** `DEPLOY_SCHEMA_CONSOLIDATED.sql`

A single, safe deployment script that consolidates all your schema fixes:
- Adds missing columns to `auditors`, `clients`, `audit_plans`, `audit_reports`
- Uses TEXT for all IDs (matches your application code)
- Creates performance indexes
- Adds tenancy tracking columns
- Includes verification queries

**Safety Features:**
- ✅ Uses `ADD COLUMN IF NOT EXISTS` (never drops data)
- ✅ All new columns are nullable (no data migration needed)
- ✅ No breaking changes
- ✅ RLS is commented out (optional)

---

## 📋 Deployment Steps

### Step 1: Backup Your Database (Free Tier)
**CRITICAL:** Always backup before schema changes!

**For Free Tier Users:**
1. Open `BACKUP_DATA_MANUAL.sql`
2. Run each query in Supabase SQL Editor
3. Copy the JSON output from each query
4. Save to a text file: `backup_2026-01-16.json`
5. Store safely (GitHub, local drive, cloud storage)

**Alternative:** Export data from your application's UI if available

### Step 2: Deploy the Script

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Create new query
4. Copy entire content of `DEPLOY_SCHEMA_CONSOLIDATED.sql`
5. Paste into editor
6. Click **Run**

### Step 3: Review Verification Output

The script will output:
- All columns in each table
- All indexes created
- Any errors (should be none)

**Expected Result:** No errors, all columns shown

### Step 4: Test Application

1. Refresh your application
2. Test creating/editing:
   - Clients
   - Auditors
   - Audit Plans
   - Audit Reports
3. Verify data saves correctly

---

## 🔒 Optional: Enable Row Level Security

**Only if you need multi-tenancy** (different users see different data)

### To Enable RLS:

1. **Uncomment lines in the script:**
   - Find "PART 6: ENABLE RLS (OPTIONAL)"
   - Remove `--` from the ALTER TABLE statements

2. **Deploy RLS Policies:**
   - Run `REFINE_RLS_POLICIES.sql` AFTER the main script
   - Test user permissions carefully

**Warning:** RLS without proper policies = users can't access data!

---

## 📊 What Changed

### Auditors Table
- ✅ Added: `data`, `email`, `role`, `standards`
- ✅ Added: `created_by`, `created_at`, `updated_at`

### Clients Table  
- ✅ Added: `data`, `created_by`, `created_at`, `updated_at`

### Audit Plans Table
- ✅ Added: `client_id`, `client_name`, `date`, `standard`, `type`
- ✅ Added: `lead_auditor`, `status`, `report_id`
- ✅ Added: `audit_team`, `selected_checklists`, `data`
- ✅ Added: `created_by`, `created_at`, `updated_at`

### Audit Reports Table
- ✅ Added: `client_id`, `client_name`, `plan_id`, `date`, `status`
- ✅ Added: `findings`, `conformities`
- ✅ Added: `checklist_progress`, `custom_items`, `ncrs`, `data`
- ✅ Added: `opening_meeting`, `closing_meeting`
- ✅ Added: `conclusion`, `recommendation`
- ✅ Added: `created_by`, `created_at`, `updated_at`

### Indexes Created
- 13 new indexes for performance
- On frequently queried columns (client_id, date, status, etc.)

---

## ❓ Troubleshooting

### "Column already exists" errors
✅ **OK** - The script uses `IF NOT EXISTS`, these are safe

### "Relation does not exist" errors
❌ **Problem** - Table doesn't exist. Run `STEP1_CREATE_TABLES.sql` first

### RLS locks me out
❌ **Problem** - RLS enabled without policies
**Fix:** Disable RLS or deploy proper policies

---

## 🎯 After Deployment

1. Archive old schema files (they're now redundant):
   - `FIX_AUDITORS_SCHEMA.sql`
   - `FIX_AUDIT_REPORTS_SCHEMA.sql`
   - `CLEANUP_3_TABLES_ONLY.sql`

2. Update your documentation

3. Consider deploying `ENHANCED_INPUT_VALIDATION.sql` next for database-level validation

---

## ✅ Verification Checklist

- [ ] Database backed up
- [ ] Script ran without errors
- [ ] Verification queries show new columns
- [ ] Application loads without errors
- [ ] Can create new records
- [ ] Can edit existing records
- [ ] Can view all existing data

---

**Ready to deploy?** Review the script first, then follow the steps above!
