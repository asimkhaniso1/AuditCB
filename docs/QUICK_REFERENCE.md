# 📋 AUDITCB360 - QUICK REFERENCE

## 🚀 Daily Operations

### Check Sync Status
```javascript
// In browser console
window.SupabaseClient?.isInitialized  // Should return: true
```

### Manual Sync (if needed)
```javascript
// Sync all data to Supabase
await window.SupabaseClient.syncUsersToSupabase(window.state.users);
await window.SupabaseClient.syncClientsToSupabase(window.state.clients);
await window.SupabaseClient.syncAuditorsToSupabase(window.state.auditors);
// ... etc
```

### Upload a File
```javascript
const file = document.getElementById('fileInput').files[0];
const result = await window.SupabaseClient.uploadDocument(file, {
    name: 'Document Name',
    folder: 'documents',
    description: 'Optional description'
});
console.log('Uploaded:', result.url);
```

### Download a File
```javascript
const blob = await window.SupabaseClient.downloadFile('path/to/file.pdf');
const url = URL.createObjectURL(blob);
window.open(url);
```

### Delete a Document
```javascript
await window.SupabaseClient.deleteDocument(documentId);
```

---

## 🔍 Troubleshooting

### Data Not Syncing?
1. Check: `window.SupabaseClient?.isInitialized` → should be `true`
2. Check console for errors
3. Verify Supabase connection in dashboard
4. Check RLS policies are set

### File Upload Failing?
1. Check file size (< 50 MB)
2. Verify storage policies exist
3. Check bucket name is `Documents`
4. Check user is authenticated

### Data Not Loading?
1. Check Supabase tables have data
2. Verify auto-load runs on login
3. Check console for sync messages
4. Hard reload: `Ctrl + Shift + R`

---

## 📊 Monitoring

### Check Supabase Usage
- Dashboard → Settings → Usage
- Monitor: Database size, Storage, API calls

### View Logs
- Dashboard → Logs → All logs
- Filter by: Error, Warning, Info

### Check Storage
- Dashboard → Storage → Documents
- View: Files, Size, Recent uploads

---

## 🔧 Common Tasks

### Add New Data Type to Sync
1. Add sync functions in `supabase-client.js`
2. Add to `saveState()` in `script.js`
3. Add to login auto-load in `script.js`
4. Create Supabase table
5. Test!

### Update Schema
1. Go to Supabase → SQL Editor
2. Run ALTER TABLE commands
3. Update sync functions if needed

### Clear All Data
```javascript
localStorage.clear();
location.reload();
```

---

## 📞 Quick Links

- **Production:** https://audit.companycertification.com
- **Supabase:** https://supabase.com/dashboard
- **Vercel:** https://vercel.com/asim-khans-projects-357b8135/audit-cb
- **GitHub:** https://github.com/asimkhaniso1/AuditCB

---

## ✅ Health Check

Run this to verify everything is working:

```javascript
async function healthCheck() {
    console.log('🏥 Running Health Check...\n');
    
    // 1. Supabase Connection
    const connected = window.SupabaseClient?.isInitialized;
    console.log(`Supabase: ${connected ? '✅' : '❌'}`);
    
    // 2. Data Counts
    console.log(`Users: ${window.state.users?.length || 0}`);
    console.log(`Clients: ${window.state.clients?.length || 0}`);
    console.log(`Auditors: ${window.state.auditors?.length || 0}`);
    console.log(`Audit Plans: ${window.state.auditPlans?.length || 0}`);
    console.log(`Reports: ${window.state.auditReports?.length || 0}`);
    console.log(`Checklists: ${window.state.checklists?.length || 0}`);
    console.log(`Documents: ${window.state.documents?.length || 0}`);
    
    // 3. Current User
    console.log(`\nCurrent User: ${window.state.currentUser?.name || 'Not logged in'}`);
    
    console.log('\n✅ Health Check Complete!');
}

healthCheck();
```

---

**Keep this handy for quick reference!** 📌
