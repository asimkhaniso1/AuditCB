# Database Schema Migration - Execution Guide

## 🎯 Quick Start

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
   - Or: Supabase Dashboard → SQL Editor → New Query

2. **Copy & Run Migration**
   - Open: `MASTER_SCHEMA_MIGRATION.sql`
   - Select All (Ctrl+A) → Copy (Ctrl+C)
   - Paste in Supabase SQL Editor
   - Click **RUN** button

3. **Review Output**
   - Check for "MIGRATION COMPLETE" message
   - Review each phase status
   - Verify no error messages

4. **Test Locally**
   - Hard reload app (Ctrl+F5)
   - Add/edit a client
   - Check browser console for errors
   - Verify data syncs to Supabase

## 📊 What This Migration Does

### Phase 1: Diagnostics ✅
- Shows current table structure (read-only)

### Phase 2: Fix ID Types 🔧
- Drops foreign key constraints that block sync
- Converts all ID columns from BIGINT → TEXT
- Allows flexible ID handling (strings, timestamps, numbers)

### Phase 3: Clean Duplicates 🧹
- Merges camelCase columns → snake_case
- Preserves all data before dropping old columns
- Removes: `nextAudit`, `lastAudit`, `contactPerson`

### Phase 4: Update Schema 📝
- Adds missing JSONB columns to `settings`
- Adds missing columns to `audit_log`
- Disables RLS for smooth sync

### Phase 5: Default Settings 🎯
- Ensures default settings row exists (ID=1)
- Grants necessary permissions

## ✅ Success Indicators

After running, you should see:
```
✓ PHASE 1 COMPLETE
✓ PHASE 2 COMPLETE: ID columns converted to TEXT
✓ PHASE 3 COMPLETE: Duplicate columns cleaned
✓ PHASE 4 COMPLETE: Settings & audit_log schema updated
✓ PHASE 5 COMPLETE: Default settings row ensured
✓ ALL VERIFICATIONS COMPLETE ✅
```

## 🔍 Verification Results

The script automatically runs 5 verification queries:
1. ✅ Clients columns (should be snake_case only)
2. ✅ All ID columns are TEXT type
3. ✅ Settings has cb_settings, organization, policies
4. ✅ Settings row exists
5. ✅ Audit_log has all required columns

## ⚠️ Troubleshooting

### If Migration Fails:

1. **Check Error Message**
   - Read the SQL error carefully
   - Note which phase failed

2. **Rollback Code** (if needed)
   ```bash
   git checkout v1.0-stable-before-schema-fixes
   ```

3. **Report Issue**
   - Copy error message
   - Note which phase number failed
   - Check if partial migration occurred

### Common Issues:

**"Column already exists"**
- Safe to ignore - script handles this with `IF NOT EXISTS`

**"Cannot drop column"**
- A column might be referenced elsewhere
- Check output to see which column

**"Permission denied"**
- Ensure you're logged in as project owner
- Check Supabase project settings

## 📈 Post-Migration Testing

1. **Local App Test**
   ```
   1. Open: http://localhost:8080
   2. Navigate to Clients
   3. Add new client
   4. Edit existing client
   5. Check console - no errors?
   ```

2. **Supabase Verification**
   ```
   1. Go to Table Editor
   2. Open 'clients' table
   3. Verify new client appears
   4. Check 'settings' table has row
   ```

3. **Data Sync Check**
   ```
   1. Make change locally
   2. Check Supabase real-time updates
   3. Refresh page - data persists?
   ```

## ✨ Expected Improvements

After successful migration:
- ✅ No more "ID type mismatch" errors
- ✅ Settings sync works correctly
- ✅ Cleaner database schema
- ✅ Foreign key errors eliminated
- ✅ Audit trail persists to cloud

## 🔄 Next Steps After Success

1. Update `task.md` - mark schema fixes complete
2. Test production deployment
3. Monitor Supabase logs for 24 hours
4. Consider re-enabling RLS with proper policies

---

**Ready?** Open Supabase SQL Editor and run `MASTER_SCHEMA_MIGRATION.sql`!
