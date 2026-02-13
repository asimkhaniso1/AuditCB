# User & Auditor Management Integration Plan

## Current Situation Analysis

### Problem Statement
Currently, the system has **TWO SEPARATE** management systems:

1. **User Management** (`window.state.users`)
   - Managed in Settings → Users tab
   - Stores authentication and role information
   - Fields: `id`, `email`, `name`, `role`, `status`, `avatar`, `supabaseId`
   - Used for: Login, permissions, access control

2. **Auditor Management** (`window.state.auditors`)
   - Managed in Auditors module
   - Stores professional auditor information
   - Fields: `id`, `name`, `email`, `role`, `experience`, `certifications`, `industries`, `standards`, etc.
   - Used for: Client assignments, audit scheduling, competency tracking

### The Disconnect
- A user with role "Lead Auditor" or "Auditor" may NOT have a corresponding auditor profile
- An auditor profile may NOT have a corresponding user account
- Client assignments use `auditorId` which references `auditors` table
- Access control uses `userId` which references `users` table
- **This causes the filtering issue we just fixed!**

---

## Proposed Solution: Unified User-Auditor Model

### Architecture Decision: Single Source of Truth

**Option A: Users as Primary (Recommended)**
- `users` table is the single source of truth
- Auditor-specific data stored as extended profile
- Link: `users.id` = `auditor_profiles.user_id`

**Option B: Separate but Linked**
- Keep both tables separate
- Add explicit linking field
- Link: `users.auditor_id` → `auditors.id`

**Recommendation: Option A** - Users as primary with auditor profiles as extensions

---

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Create Auditor Profiles Table (Supabase)

```sql
-- Create auditor_profiles table
CREATE TABLE IF NOT EXISTS public.auditor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Professional Information
    auditor_number TEXT UNIQUE,
    experience INTEGER DEFAULT 0,
    certifications JSONB DEFAULT '[]',
    industries JSONB DEFAULT '[]',
    standards JSONB DEFAULT '[]',
    languages JSONB DEFAULT '[]',
    
    -- Qualifications
    qualifications JSONB DEFAULT '[]',
    training_records JSONB DEFAULT '[]',
    
    -- Performance
    audits_completed INTEGER DEFAULT 0,
    customer_rating DECIMAL(3,2),
    performance_score DECIMAL(5,2),
    
    -- Availability
    availability_status TEXT DEFAULT 'Available',
    max_audits_per_month INTEGER DEFAULT 10,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.auditor_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
            WHERE id = auth.uid() AND role IN ('Admin', 'Certification Manager')
        )
    );

-- Create indexes
CREATE INDEX idx_auditor_profiles_user_id ON public.auditor_profiles(user_id);
CREATE INDEX idx_auditor_profiles_auditor_number ON public.auditor_profiles(auditor_number);
```

#### 1.2 Update Auditor Assignments Table

```sql
-- Update auditor_assignments to reference users.id instead of auditors.id
ALTER TABLE public.auditor_assignments
    RENAME COLUMN auditor_id TO user_id;

-- Add foreign key constraint
ALTER TABLE public.auditor_assignments
    ADD CONSTRAINT fk_auditor_assignments_user
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_auditor_assignments_auditor_id;
CREATE INDEX idx_auditor_assignments_user_id ON public.auditor_assignments(user_id);
```

---

### Phase 2: Data Migration

#### 2.1 Migrate Existing Auditors to Users

```sql
-- Migration script to create users for existing auditors
-- This should be run ONCE during deployment

DO $$
DECLARE
    auditor_record RECORD;
    new_user_id UUID;
BEGIN
    -- Loop through existing auditors
    FOR auditor_record IN 
        SELECT * FROM public.auditors
    LOOP
        -- Check if user already exists with this email
        SELECT id INTO new_user_id
        FROM auth.users
        WHERE email = auditor_record.email;
        
        IF new_user_id IS NULL THEN
            -- User doesn't exist, create via Supabase Auth
            -- NOTE: This requires admin API or manual creation
            -- For now, just create profile entry
            INSERT INTO public.profiles (email, full_name, role)
            VALUES (
                auditor_record.email,
                auditor_record.name,
                auditor_record.role
            )
            ON CONFLICT (email) DO NOTHING;
            
            -- Log for manual user creation
            RAISE NOTICE 'Need to create user for: % (%)', 
                auditor_record.name, auditor_record.email;
        END IF;
        
        -- Create auditor profile linked to user
        INSERT INTO public.auditor_profiles (
            user_id,
            auditor_number,
            experience,
            certifications,
            industries,
            standards,
            qualifications,
            audits_completed,
            customer_rating
        )
        SELECT 
            COALESCE(new_user_id, (SELECT id FROM public.profiles WHERE email = auditor_record.email LIMIT 1)),
            auditor_record.auditor_number,
            auditor_record.experience,
            auditor_record.certifications,
            auditor_record.industries,
            auditor_record.standards,
            auditor_record.qualifications,
            auditor_record.audits_completed,
            auditor_record.customer_rating
        WHERE auditor_record.email IS NOT NULL
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;
```

#### 2.2 Update Auditor Assignments

```sql
-- Update existing assignments to use user IDs
UPDATE public.auditor_assignments aa
SET user_id = (
    SELECT ap.user_id
    FROM public.auditor_profiles ap
    JOIN public.auditors a ON a.id = ap.old_auditor_id
    WHERE a.id = aa.auditor_id
)
WHERE EXISTS (
    SELECT 1 FROM public.auditors a
    WHERE a.id = aa.auditor_id
);
```

---

### Phase 3: Frontend Code Updates

#### 3.1 Update User Creation Flow

**File:** `settings-module.js`

```javascript
// When creating a user with Auditor/Lead Auditor role
window.saveUser = async function (userId) {
    // ... existing user creation code ...
    
    // If role is Auditor or Lead Auditor, create auditor profile
    if (!userId && (role === 'Auditor' || role === 'Lead Auditor')) {
        if (window.SupabaseClient?.isInitialized) {
            try {
                // Create auditor profile
                const { error: profileError } = await window.SupabaseClient.client
                    .from('auditor_profiles')
                    .insert([{
                        user_id: newUser.supabaseId || newUser.id,
                        auditor_number: `AUD-${Date.now()}`,
                        experience: 0,
                        certifications: [],
                        industries: [],
                        standards: [],
                        availability_status: 'Available'
                    }]);
                
                if (profileError) {
                    console.warn('Auditor profile creation warning:', profileError);
                }
            } catch (error) {
                Logger.error('Failed to create auditor profile:', error);
            }
        }
    }
};
```

#### 3.2 Update Auditor Module

**File:** `advanced-modules.js` (Auditors module)

```javascript
// Change from managing separate auditors to managing user auditor profiles
function renderAuditorsModule() {
    // Get users with Auditor/Lead Auditor roles
    const auditorUsers = window.state.users.filter(u => 
        u.role === 'Auditor' || u.role === 'Lead Auditor'
    );
    
    // Fetch auditor profiles for these users
    // Display combined user + auditor profile data
}

// When adding new auditor, create user first
function addNewAuditor() {
    // Redirect to Settings → Users → Add User
    // OR embed user creation in auditor form
    // Then create auditor profile
}
```

#### 3.3 Update Client Assignment Logic

**File:** `clients-module.js`

```javascript
// Update assignment to use user IDs
window.assignAuditorToClient = async function(clientId, userId, role) {
    const assignment = {
        id: `asn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        clientId: String(clientId),
        userId: String(userId), // Changed from auditorId
        role: role,
        assignedDate: new Date().toISOString()
    };
    
    // ... rest of assignment logic ...
};
```

#### 3.4 Update getVisibleClients (Already Done!)

**File:** `script.js`

```javascript
// Already updated to use user.id directly
// No changes needed - this is why we fixed it earlier!
```

---

### Phase 4: UI/UX Updates

#### 4.1 Unified Auditor Management Interface

**Option 1: Single Interface**
- Remove separate "Auditors" module
- Add "Auditor Profile" tab in user edit modal
- Manage everything from Settings → Users

**Option 2: Linked Interface (Recommended)**
- Keep "Auditors" module for professional data
- Link to user account from auditor profile
- Show user status in auditor list
- Add "Create User Account" button for auditors without users

#### 4.2 Visual Indicators

- Show badge in Auditors list: "✅ Has User Account" or "⚠️ No Login"
- Show badge in Users list: "👤 Auditor Profile" for auditor users
- Link between the two interfaces

---

### Phase 5: Synchronization Strategy

#### 5.1 Auto-Create Auditor Profile

```javascript
// When user with Auditor role is created
if (user.role === 'Auditor' || user.role === 'Lead Auditor') {
    // Auto-create auditor profile
    createAuditorProfile(user.id);
}
```

#### 5.2 Auto-Create User Account

```javascript
// When auditor is created without user account
function createAuditorWithUser(auditorData) {
    // 1. Create user account first
    const user = await createUser({
        email: auditorData.email,
        name: auditorData.name,
        role: auditorData.role || 'Auditor'
    });
    
    // 2. Create auditor profile linked to user
    const auditorProfile = await createAuditorProfile({
        user_id: user.id,
        ...auditorData
    });
    
    return { user, auditorProfile };
}
```

---

## Benefits of This Approach

### 1. **Single Source of Truth**
- User ID is the primary identifier
- No more confusion between user ID and auditor ID
- Simplified access control logic

### 2. **Automatic Synchronization**
- User creation auto-creates auditor profile (if role is Auditor)
- User deletion auto-deletes auditor profile (CASCADE)
- Role changes reflected immediately

### 3. **Better Security**
- RLS policies based on user authentication
- Clear ownership and permissions
- Audit trail linked to user accounts

### 4. **Simplified Assignment Logic**
- Assignments use user ID directly
- No need to match email/name
- Consistent across all modules

### 5. **Improved UX**
- Single place to manage auditor users
- Clear relationship between login and professional profile
- No duplicate data entry

---

## Migration Checklist

### Pre-Migration
- [ ] Backup all data (users, auditors, assignments)
- [ ] Document current auditor-user mappings
- [ ] Test migration script on staging environment

### Database Migration
- [ ] Create `auditor_profiles` table
- [ ] Update `auditor_assignments` table
- [ ] Run data migration script
- [ ] Verify data integrity
- [ ] Enable RLS policies

### Code Updates
- [ ] Update user creation flow
- [ ] Update auditor module
- [ ] Update assignment logic
- [ ] Update filtering logic (already done!)
- [ ] Update sync functions

### Testing
- [ ] Test user creation with Auditor role
- [ ] Test auditor profile creation
- [ ] Test client assignments
- [ ] Test access control
- [ ] Test data synchronization

### Deployment
- [ ] Deploy database changes
- [ ] Deploy code changes
- [ ] Monitor for errors
- [ ] Verify all existing assignments work

---

## Rollback Plan

If issues occur:

1. **Keep old `auditors` table** (don't drop it)
2. **Add fallback logic** to check both user_id and old auditor_id
3. **Gradual migration** - support both systems temporarily
4. **Data reconciliation** - script to sync back if needed

---

## Timeline Estimate

- **Phase 1 (Schema):** 2-3 hours
- **Phase 2 (Migration):** 3-4 hours
- **Phase 3 (Frontend):** 6-8 hours
- **Phase 4 (UI/UX):** 4-6 hours
- **Phase 5 (Testing):** 4-6 hours

**Total:** 19-27 hours (2.5-3.5 days)

---

## Alternative: Quick Fix (Temporary)

If full migration is too complex right now:

### Temporary Linking Strategy

1. **Add `user_id` field to existing `auditors` table**
2. **Auto-link on login** - match user to auditor by email
3. **Use user_id for assignments** if available, fall back to auditor_id
4. **Gradually migrate** to full unified model

This allows immediate fixes while planning full migration.

---

## Recommendation

**Implement the full unified model (Phases 1-5)** for long-term stability and maintainability.

**Start with:** 
1. Phase 1 (Database schema)
2. Phase 3.1 (Auto-create auditor profiles for new users)
3. Gradually migrate existing data

This provides immediate benefits while allowing time for complete migration.
