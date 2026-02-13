# Server-Side Validation - Deployment Guide

## Overview
This guide covers deploying the server-side validation enhancements to Supabase.

## Prerequisites
- Supabase project set up
- Supabase CLI installed (`npm install -g supabase`)
- Database access credentials

## Step 1: Deploy SQL Policies & Constraints

### 1.1 Apply RLS Policies (if not already done)
```sql
-- In Supabase SQL Editor, run:
\i REFINE_RLS_POLICIES.sql
```

### 1.2 Apply Enhanced Validation
```sql
-- In Supabase SQL Editor, run:
\i ENHANCED_INPUT_VALIDATION.sql
```

**Expected Result:**
- ✅ CHECK constraints added to tables
- ✅ Validation triggers created
- ✅ Audit log table created
- ✅ Duplicate prevention enabled

### 1.3 Verify Constraints
```sql
-- Test invalid email (should fail)
INSERT INTO clients (name, email) VALUES ('Test', 'invalid');

-- Test short name (should fail)
INSERT INTO clients (name, email) VALUES ('A', 'test@example.com');

-- Should see error messages from constraints
```

## Step 2: Deploy Edge Functions

### 2.1 Initialize Supabase Project
```bash
cd C:\Users\Administrator\Documents\AuditCB
sup abase init
```

### 2.2 Link to Supabase Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 2.3 Deploy validate-client Function
```bash
supabase functions deploy validate-client
```

### 2.4 Deploy validate-audit-plan Function
```bash
supabase functions deploy validate-audit-plan
```

### 2.5 Test Edge Functions
```bash
# Test validate-client
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/validate-client' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Client","email":"invalid"}'

# Should return validation error
```

## Step 3: Update Client-Side Code (Next Phase)

After deployment, update modules to call validation:

```javascript
// Example in clients-module.js
async function saveClient(clientData) {
  // Call Edge Function validation
  const validation = await fetch(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/validate-client',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clientData)
    }
  );
  
  if (!validation.ok) {
    const { errors } = await validation.json();
    // Show errors to user
    errors.forEach(e => showNotification(e.message, 'error'));
    return false;
  }
  
  // Proceed with save
  return saveToSupabase(clientData);
}
```

## Verification Checklist

- [ ] RLS policies active (check Supabase Dashboard → Database → Policies)
- [ ] CHECK constraints visible (Database → Tables → Constraints)
- [ ] Triggers created (Database → Functions → Triggers)
- [ ] Edge Functions deployed (Edge Functions tab shows functions)
- [ ] Edge Functions respond (test with curl)
- [ ] Audit log table exists and RLS enabled

## Troubleshooting

### Issue: Constraints blocking legitimate data
**Solution:** Adjust regex patterns in SQL file

### Issue: Edge Functions not deploying
**Solution:** Check supabase CLI version, re-link project

### Issue: RLS blocking authenticated users
**Solution:** Review helper functions (is_admin_or_cert_manager, get_my_auditor_id)

## Next Steps

After deployment:
1. Update client-side modules to call Edge Functions
2. Add user-friendly error messages
3. Test thoroughly with different user roles
4. Monitor audit_log table for suspicious activity
