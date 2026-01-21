# Client Organizational Fields - Missing Sync Fix

## Problem
Departments, designations, goods/services, and key processes are NOT being synced to/from Supabase.

## Solution

### 1. Database Schema (REQUIRED - Run this first!)
Run the SQL in `add-client-org-fields.sql` in your Supabase SQL Editor to add the missing columns.

### 2. JavaScript Changes (supabase-client.js)

#### Change 1: Update `syncClientsToSupabase` (around line 1039-1055)
**Find:**
```javascript
const clientsData = clients.map(client => ({
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type,
    website: client.website || null,
    employees: client.employees || 0,
    shifts: client.shifts || 'No',
    industry: client.industry || null,
    contacts: client.contacts || [],
    sites: client.sites || [],
    contact_person: client.contactPerson || null,
    next_audit: client.nextAudit || null,
    last_audit: client.lastAudit || null,
    updated_at: new Date().toISOString()
}));
```

**Replace with:**
```javascript
const clientsData = clients.map(client => ({
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type,
    website: client.website || null,
    employees: client.employees || 0,
    shifts: client.shifts || 'No',
    industry: client.industry || null,
    contacts: client.contacts || [],
    sites: client.sites || [],
    departments: client.departments || [],
    designations: client.designations || [],
    goods_services: client.goodsServices || [],
    key_processes: client.keyProcesses || [],
    contact_person: client.contactPerson || null,
    next_audit: client.nextAudit || null,
    last_audit: client.lastAudit || null,
    updated_at: new Date().toISOString()
}));
```

#### Change 2: Update `upsertClient` (around line 988-1005)
**Find:**
```javascript
const clientData = {
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type || 'Organization',
    website: client.website || null,
    employees: client.employees || 0,
    shifts: client.shifts || 'No',
    industry: client.industry || null,
    contacts: client.contacts || [],
    sites: client.sites || [],
    // Derived fields if not present
    contact_person: client.contactPerson || (client.contacts?.[0]?.name) || null,
    next_audit: client.nextAudit || null,
    last_audit: client.lastAudit || null,
    updated_at: new Date().toISOString()
};
```

**Replace with:**
```javascript
const clientData = {
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type || 'Organization',
    website: client.website || null,
    employees: client.employees || 0,
    shifts: client.shifts || 'No',
    industry: client.industry || null,
    contacts: client.contacts || [],
    sites: client.sites || [],
    departments: client.departments || [],
    designations: client.designations || [],
    goods_services: client.goodsServices || [],
    key_processes: client.keyProcesses || [],
    // Derived fields if not present
    contact_person: client.contactPerson || (client.contacts?.[0]?.name) || null,
    next_audit: client.nextAudit || null,
    last_audit: client.lastAudit || null,
    updated_at: new Date().toISOString()
};
```

#### Change 3: Update `syncClientsFromSupabase` (around line 1120-1135)
**Find:**
```javascript
const mappedClient = {
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type,
    website: client.website,
    employees: client.employees,
    shifts: client.shifts,
    industry: client.industry,
    contacts: client.contacts || [],
    sites: client.sites || [],
    contactPerson: client.contact_person,
    nextAudit: client.next_audit,
    lastAudit: client.last_audit,
    updatedAt: client.updated_at
};
```

**Replace with:**
```javascript
const mappedClient = {
    id: client.id,
    name: client.name,
    standard: client.standard,
    status: client.status,
    type: client.type,
    website: client.website,
    employees: client.employees,
    shifts: client.shifts,
    industry: client.industry,
    contacts: client.contacts || [],
    sites: client.sites || [],
    departments: client.departments || [],
    designations: client.designations || [],
    goodsServices: client.goods_services || [],
    keyProcesses: client.key_processes || [],
    contactPerson: client.contact_person,
    nextAudit: client.next_audit,
    lastAudit: client.last_audit,
    updatedAt: client.updated_at
};
```

## Testing
1. Run the SQL migration
2. Make the JavaScript changes
3. Refresh your app (Ctrl+F5)
4. Add a department/designation to a client
5. Check Supabase Table Editor - the data should be in the new columns
6. Refresh the page - the data should persist
