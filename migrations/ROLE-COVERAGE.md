# Role Coverage: Auditor vs Lead Auditor

## Quick Answer

**YES** - The user-auditor integration covers **BOTH** roles:
- ✅ **Auditor**
- ✅ **Lead Auditor**

---

## Role Handling Across the System

### 1. Database Migration (Phase 2)

**Script: `03-migrate-auditor-data.sql`**

```sql
-- Creates profiles for BOTH roles
INSERT INTO public.auditor_profiles (...)
SELECT ...
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')  -- ✅ Both included
```

**Verification Query:**
```sql
SELECT 
    p.role,
    COUNT(*) as count
FROM public.profiles p
JOIN public.auditor_profiles ap ON ap.user_id = p.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
GROUP BY p.role;

-- Expected output:
-- Auditor       | 3
-- Lead Auditor  | 2
```

---

### 2. Frontend Auto-Creation (Phase 3)

**File: `settings-module.js`**

```javascript
// When creating a new user
if (role === 'Auditor' || role === 'Lead Auditor') {
    // ✅ Auto-create auditor profile for BOTH roles
    await createAuditorProfile(userId);
}
```

---

### 3. Access Control (Already Implemented)

**File: `script.js` - `getVisibleClients()`**

```javascript
// Roles that only see ASSIGNED clients
const filteredRoles = [
    'Lead Auditor',      // ✅ Included
    'Auditor',           // ✅ Included
    'Technical Expert'   // ✅ Also included
];

if (filteredRoles.includes(user.role)) {
    // Filter to show only assigned clients
}
```

---

### 4. Client Assignments

**Both roles can be assigned to clients:**

```javascript
// Assignment works for both
{
    userId: 'usr_123',
    clientId: 'cli_456',
    role: 'Lead Auditor'  // ✅ or 'Auditor'
}
```

---

## Role Differences

While both roles are treated similarly for the integration, they may have different permissions:

| Feature | Lead Auditor | Auditor |
|---------|--------------|---------|
| **Has Auditor Profile** | ✅ Yes | ✅ Yes |
| **Can Be Assigned to Clients** | ✅ Yes | ✅ Yes |
| **Sees Only Assigned Clients** | ✅ Yes | ✅ Yes |
| **Can Add Clients** | ❌ No | ❌ No |
| **Can Lead Audit Teams** | ✅ Yes | ❌ No* |
| **Can Approve Reports** | ✅ Yes | ❌ No* |

*These are business logic differences, not integration differences

---

## What Gets Created for Each Role

### When Creating "Lead Auditor" User:

1. **Auth User** (Supabase Auth)
   ```
   email: leadauditor@example.com
   password: Welcome123!
   ```

2. **Profile** (profiles table)
   ```
   role: 'Lead Auditor'
   full_name: 'John Doe'
   ```

3. **Auditor Profile** (auditor_profiles table)
   ```
   user_id: <auth_user_id>
   auditor_number: 'AUD-2024-001'
   experience: 0
   certifications: []
   ```

### When Creating "Auditor" User:

1. **Auth User** (Supabase Auth)
   ```
   email: auditor@example.com
   password: Welcome123!
   ```

2. **Profile** (profiles table)
   ```
   role: 'Auditor'
   full_name: 'Jane Smith'
   ```

3. **Auditor Profile** (auditor_profiles table)
   ```
   user_id: <auth_user_id>
   auditor_number: 'AUD-2024-002'
   experience: 0
   certifications: []
   ```

**Same structure, different role value!**

---

## Migration Coverage

### Existing Users That Will Get Auditor Profiles:

✅ All users with `role = 'Auditor'`  
✅ All users with `role = 'Lead Auditor'`  
❌ Users with `role = 'Admin'` (no auditor profile needed)  
❌ Users with `role = 'Certification Manager'` (no auditor profile needed)  
❌ Users with `role = 'Client'` (no auditor profile needed)

---

## Verification After Migration

Run this query to verify both roles are covered:

```sql
-- Check auditor profiles by role
SELECT 
    p.role,
    COUNT(ap.id) as profile_count,
    array_agg(p.full_name ORDER BY p.full_name) as users
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.auditor_profiles ap ON ap.user_id = u.id
WHERE p.role IN ('Auditor', 'Lead Auditor')
GROUP BY p.role
ORDER BY p.role;

-- Expected output:
-- role          | profile_count | users
-- Auditor       | 3             | {Alice, Bob, Charlie}
-- Lead Auditor  | 2             | {David, Emma}
```

---

## Summary

**Question:** Does it cover both Auditor and Lead Auditor roles?

**Answer:** ✅ **YES, absolutely!**

- Database migration handles both roles
- Frontend auto-creation handles both roles
- Access control handles both roles
- Client assignments work for both roles
- Auditor profiles created for both roles

The only difference between the two roles is in **business logic** (what they can do), not in the **technical integration** (how they're linked to users).

---

## Need to Add More Roles?

If you want to add other roles that should have auditor profiles (e.g., "Technical Expert"), just update the role check:

```javascript
// Current
if (role === 'Auditor' || role === 'Lead Auditor') {

// To add Technical Expert
if (['Auditor', 'Lead Auditor', 'Technical Expert'].includes(role)) {
```

Same for the SQL migration:

```sql
-- Current
WHERE p.role IN ('Auditor', 'Lead Auditor')

-- To add Technical Expert
WHERE p.role IN ('Auditor', 'Lead Auditor', 'Technical Expert')
```

---

**Last Updated:** 2026-01-22 17:08  
**Status:** Both roles fully supported ✅
