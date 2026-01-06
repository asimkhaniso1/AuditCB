# Full Auto-Sync Implementation Guide

## Current Status

### ✅ What's Working
- **Users (profiles table)**: Full auto-sync working
  - Saves to Supabase on every change
  - Loads from Supabase on login
  - Manual sync buttons work

### ❌ What's NOT Syncing
- **Clients** - Only in localStorage
- **Auditors** - Only in localStorage  
- **Audit Plans** - Only in localStorage
- **Checklists** - Only in localStorage
- **Reports** - Only in localStorage

## Implementation Plan

### Step 1: Add Sync Functions to supabase-client.js

Add these functions before line 727 (before the closing brace):

```javascript
/**
 * Sync clients to Supabase
 */
async syncClientsToSupabase(clients) {
    if (!this.isInitialized || !clients?.length) return;
    
    try {
        for (const client of clients) {
            const clientData = {
                id: client.id,
                name: client.name,
                standard: client.standard,
                status: client.status,
                type: client.type,
                website: client.website,
                employees: client.employees,
                shifts: client.shifts,
                industry: client.industry,
                contacts: client.contacts,
                sites: client.sites,
                updated_at: new Date().toISOString()
            };
            
            await this.client
                .from('clients')
                .upsert(clientData, { onConflict: 'id' });
        }
        Logger.info('Clients synced to Supabase');
    } catch (error) {
        Logger.error('Failed to sync clients:', error);
    }
},

/**
 * Sync auditors to Supabase
 */
async syncAuditorsToSupabase(auditors) {
    if (!this.isInitialized || !auditors?.length) return;
    
    try {
        for (const auditor of auditors) {
            const auditorData = {
                id: auditor.id,
                name: auditor.name,
                role: auditor.role,
                standards: auditor.standards,
                experience: auditor.experience,
                email: auditor.email,
                phone: auditor.phone,
                location: auditor.location,
                // Add other fields as needed
                updated_at: new Date().toISOString()
            };
            
            await this.client
                .from('auditors')
                .upsert(auditorData, { onConflict: 'id' });
        }
        Logger.info('Auditors synced to Supabase');
    } catch (error) {
        Logger.error('Failed to sync auditors:', error);
    }
},
```

### Step 2: Modify saveState() in script.js

Replace lines 958-968 with:

```javascript
// Auto-sync to Supabase if configured
if (window.SupabaseClient?.isInitialized) {
    try {
        // Sync all data types (non-blocking)
        window.SupabaseClient.syncUsersToSupabase(state.users || [])
            .catch(e => console.warn('User sync failed:', e));
        
        window.SupabaseClient.syncClientsToSupabase(state.clients || [])
            .catch(e => console.warn('Client sync failed:', e));
        
        window.SupabaseClient.syncAuditorsToSupabase(state.auditors || [])
            .catch(e => console.warn('Auditor sync failed:', e));
            
        // Add audit plans, reports, etc. as needed
    } catch (syncError) {
        console.warn('Supabase sync error:', syncError);
    }
}
```

### Step 3: Verify Supabase Table Schemas

Check that your Supabase tables have the correct columns:

#### clients table should have:
- id (int or uuid)
- name (text)
- standard (text)
- status (text)
- type (text)
- website (text)
- employees (int)
- shifts (text)
- industry (text)
- contacts (jsonb)
- sites (jsonb)
- created_at (timestamp)
- updated_at (timestamp)

#### auditors table should have:
- id (int or uuid)
- name (text)
- role (text)
- standards (text[] or jsonb)
- experience (int)
- email (text)
- phone (text)
- location (text)
- created_at (timestamp)
- updated_at (timestamp)

## Quick Start (Minimum Viable Implementation)

If you want to get clients syncing ASAP, just:

1. Add the `syncClientsToSupabase` function to `supabase-client.js`
2. Add one line to `saveState()`:
   ```javascript
   window.SupabaseClient.syncClientsToSupabase(state.clients || []).catch(e => console.warn('Client sync failed:', e));
   ```
3. Test by adding/editing a client
4. Check Supabase `clients` table to verify data is there

## Testing Checklist

After implementation:
- [ ] Add a new client → Check Supabase
- [ ] Edit a client → Check Supabase  
- [ ] Refresh page → Client should persist
- [ ] Add a new auditor → Check Supabase
- [ ] Refresh page → Auditor should persist

## Notes

- Start with clients (most used)
- Then add auditors
- Then add audit plans/reports
- Each can be added incrementally
- No risk of breaking existing user sync
