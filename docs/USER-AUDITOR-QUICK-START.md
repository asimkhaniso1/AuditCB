# User-Auditor Integration: Quick Start Guide

## Current Architecture (Problem)

```
┌─────────────────────┐         ┌──────────────────────┐
│   Users Table       │         │   Auditors Table     │
├─────────────────────┤         ├──────────────────────┤
│ id: usr_123         │    ❌   │ id: aud_456          │
│ email: mak@...      │  NO     │ email: mak@...       │
│ name: MAK           │  LINK   │ name: MAK            │
│ role: Lead Auditor  │         │ role: Lead Auditor   │
└─────────────────────┘         └──────────────────────┘
         │                                   │
         │ Used for                          │ Used for
         │ Login & Access                    │ Assignments
         ▼                                   ▼
┌─────────────────────┐         ┌──────────────────────┐
│ getVisibleClients() │         │ auditorAssignments   │
│ filters by user.id  │         │ uses auditorId       │
└─────────────────────┘         └──────────────────────┘
                                         │
                                    MISMATCH!
                                         ▼
                            Lead Auditor sees all clients
```

## Proposed Architecture (Solution)

```
┌──────────────────────────────────────────────────────┐
│              Users Table (Primary)                   │
├──────────────────────────────────────────────────────┤
│ id: usr_123                                          │
│ email: mak@example.com                               │
│ name: MAK                                            │
│ role: Lead Auditor                                   │
│ supabaseId: uuid-from-auth                           │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ 1:1 relationship
                 │ (if role = Auditor/Lead Auditor)
                 ▼
┌──────────────────────────────────────────────────────┐
│         Auditor Profiles Table (Extension)           │
├──────────────────────────────────────────────────────┤
│ id: prof_789                                         │
│ user_id: usr_123  ◄─── FOREIGN KEY                   │
│ auditor_number: AUD-2024-001                         │
│ experience: 5                                        │
│ certifications: [...]                                │
│ industries: [...]                                    │
│ standards: [...]                                     │
└────────────────┬─────────────────────────────────────┘
                 │
                 │ Used for assignments
                 ▼
┌──────────────────────────────────────────────────────┐
│           Auditor Assignments                        │
├──────────────────────────────────────────────────────┤
│ id: asn_001                                          │
│ user_id: usr_123  ◄─── Uses user ID directly         │
│ client_id: cli_456                                   │
│ role: Lead Auditor                                   │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
         ✅ Filtering works correctly!
         getVisibleClients() uses user_id
```

---

## Implementation: Step-by-Step

### Step 1: Database Schema (Run in Supabase SQL Editor)

```sql
-- File: create-auditor-profiles-table.sql

-- 1. Create auditor_profiles table
CREATE TABLE IF NOT EXISTS public.auditor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Professional Information
    auditor_number TEXT UNIQUE,
    experience INTEGER DEFAULT 0,
    certifications JSONB DEFAULT '[]'::jsonb,
    industries JSONB DEFAULT '[]'::jsonb,
    standards JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    qualifications JSONB DEFAULT '[]'::jsonb,
    
    -- Performance Metrics
    audits_completed INTEGER DEFAULT 0,
    customer_rating DECIMAL(3,2),
    performance_score DECIMAL(5,2),
    
    -- Availability
    availability_status TEXT DEFAULT 'Available',
    max_audits_per_month INTEGER DEFAULT 10,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_auditor_profiles_user 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE,
    CONSTRAINT unique_user_id UNIQUE(user_id)
);

-- 2. Create indexes
CREATE INDEX idx_auditor_profiles_user_id 
    ON public.auditor_profiles(user_id);
CREATE INDEX idx_auditor_profiles_auditor_number 
    ON public.auditor_profiles(auditor_number);

-- 3. Enable RLS
ALTER TABLE public.auditor_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Auditor profiles viewable by authenticated users"
    ON public.auditor_profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Auditor profiles editable by admin and owner"
    ON public.auditor_profiles FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('Admin', 'Certification Manager')
        )
    );

-- 5. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_auditor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auditor_profiles_updated_at
    BEFORE UPDATE ON public.auditor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_auditor_profiles_updated_at();

-- 6. Grant permissions
GRANT ALL ON public.auditor_profiles TO authenticated;
GRANT ALL ON public.auditor_profiles TO service_role;
```

### Step 2: Update Auditor Assignments (Run in Supabase)

```sql
-- File: update-auditor-assignments-schema.sql

-- IMPORTANT: This renames the column, so backup first!

-- 1. Add new user_id column (don't drop old one yet)
ALTER TABLE public.auditor_assignments
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Copy data from auditor_id to user_id (temporary)
-- This assumes auditor_id currently stores user IDs
-- Adjust if your data structure is different
UPDATE public.auditor_assignments
SET user_id = auditor_id
WHERE user_id IS NULL;

-- 3. Create index on new column
CREATE INDEX IF NOT EXISTS idx_auditor_assignments_user_id 
    ON public.auditor_assignments(user_id);

-- 4. Verify data copied correctly
SELECT 
    COUNT(*) as total_assignments,
    COUNT(user_id) as assignments_with_user_id,
    COUNT(auditor_id) as assignments_with_auditor_id
FROM public.auditor_assignments;

-- STOP HERE - Verify the counts match before proceeding!
-- Once verified, you can drop the old column (optional, for cleanup)
-- ALTER TABLE public.auditor_assignments DROP COLUMN auditor_id;
```

### Step 3: Auto-Create Auditor Profiles (Frontend)

Add this to `settings-module.js` in the `saveUser()` function:

```javascript
// After creating the user successfully
if (!userId && (role === 'Auditor' || role === 'Lead Auditor')) {
    // Auto-create auditor profile for auditor users
    if (window.SupabaseClient?.isInitialized && newUser.supabaseId) {
        try {
            const auditorNumber = `AUD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            
            const { error: auditorProfileError } = await window.SupabaseClient.client
                .from('auditor_profiles')
                .insert([{
                    user_id: newUser.supabaseId,
                    auditor_number: auditorNumber,
                    experience: 0,
                    certifications: [],
                    industries: [],
                    standards: [],
                    availability_status: 'Available',
                    max_audits_per_month: 10
                }]);
            
            if (auditorProfileError) {
                console.warn('Auditor profile creation warning:', auditorProfileError);
                // Don't fail user creation if profile creation fails
            } else {
                Logger.info('Auditor profile created:', auditorNumber);
            }
        } catch (error) {
            Logger.error('Failed to create auditor profile:', error);
        }
    }
}
```

### Step 4: Update Assignment Logic (Frontend)

Update `clients-module.js` - find the assignment functions and change `auditorId` to `userId`:

```javascript
// OLD CODE:
const assignment = {
    id: `asn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    clientId: String(clientId),
    auditorId: String(auditorId),  // ❌ OLD
    role: role,
    assignedDate: new Date().toISOString()
};

// NEW CODE:
const assignment = {
    id: `asn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    clientId: String(clientId),
    userId: String(userId),  // ✅ NEW - use user ID directly
    role: role,
    assignedDate: new Date().toISOString()
};
```

---

## Testing Checklist

### Test 1: Create New Auditor User
1. Go to Settings → Users → Add User
2. Create user with role "Lead Auditor"
3. Check Supabase → `auditor_profiles` table
4. Verify profile was auto-created with correct `user_id`

### Test 2: Assign Auditor to Client
1. Go to Clients → Select a client
2. Assign the new auditor user
3. Check Supabase → `auditor_assignments` table
4. Verify `user_id` field is populated (not `auditor_id`)

### Test 3: Verify Access Control
1. Log in as the new auditor user
2. Go to Clients module
3. Should see ONLY assigned clients
4. Should NOT see unassigned clients

### Test 4: Verify Sidebar
1. Check "My Clients" sidebar
2. Should show only assigned clients
3. "Add Client" button should be hidden

---

## Migration for Existing Data

If you have existing auditors without user accounts:

```sql
-- File: migrate-existing-auditors.sql

-- This creates user profiles for existing auditors
-- NOTE: You'll still need to create auth users manually in Supabase Dashboard

INSERT INTO public.profiles (email, full_name, role, avatar_url)
SELECT 
    a.email,
    a.name,
    COALESCE(a.role, 'Auditor'),
    CONCAT('https://ui-avatars.com/api/?name=', 
           REPLACE(a.name, ' ', '+'), 
           '&background=random')
FROM public.auditors a
WHERE a.email IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.email = a.email
  )
ON CONFLICT (email) DO NOTHING;

-- Log auditors that need manual auth user creation
SELECT 
    a.name,
    a.email,
    'Needs auth user creation in Supabase Dashboard' as action
FROM public.auditors a
LEFT JOIN auth.users u ON u.email = a.email
WHERE u.id IS NULL
  AND a.email IS NOT NULL;
```

---

## Rollback Plan

If something goes wrong:

1. **Keep the old `auditor_id` column** (don't drop it)
2. **Add fallback logic** in code:
   ```javascript
   const assignmentUserId = assignment.user_id || assignment.auditor_id;
   ```
3. **Revert database changes** if needed:
   ```sql
   ALTER TABLE auditor_assignments DROP COLUMN user_id;
   ```

---

## Summary

**What This Fixes:**
- ✅ Unassigned auditors can no longer see all clients
- ✅ User and auditor data are properly linked
- ✅ Single source of truth for user identity
- ✅ Automatic auditor profile creation
- ✅ Simplified access control logic

**What You Need to Do:**
1. Run SQL scripts in Supabase (Step 1 & 2)
2. Update `settings-module.js` (Step 3)
3. Update `clients-module.js` (Step 4)
4. Test thoroughly (Testing Checklist)

**Time Required:**
- Database setup: 30 minutes
- Code updates: 1-2 hours
- Testing: 1-2 hours
- **Total: 3-4 hours**

Would you like me to start implementing these changes?
