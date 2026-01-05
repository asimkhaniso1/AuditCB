# AuditCB Offline Capability - User Guide

## Overview

AuditCB360 now supports **full offline functionality** for field auditors conducting audits on tablets or phones without internet connectivity. All audit data is saved locally and automatically synchronized when you return online.

---

## How It Works

### 1. **Before Going to the Field**
- Open AuditCB360 while connected to the internet
- The app automatically becomes available offline (Progressive Web App)
- All your assigned clients, checklists, and audit reports are cached locally

### 2. **During the Audit (Offline)**
- **Full Functionality Available**:
  - ✅ Complete checklist items (OK/NC/NA)
  - ✅ Add comments and observations
  - ✅ Create NCRs (Non-Conformity Reports)
  - ✅ Attach evidence images
  - ✅ Record opening/closing meeting details
  - ✅ Save all progress

- **Offline Indicator**:
  - When offline, you'll see a red "OFFLINE" badge in the header
  - All changes are saved to your device's local storage
  - Changes are queued for synchronization

### 3. **After Returning Online**
- **Automatic Sync**:
  - When internet connection is restored, you'll see "You are back online. Syncing data..."
  - All queued changes are automatically pushed to the cloud (Supabase)
  - You'll receive notifications showing sync progress

---

## Features Supported Offline

| Feature | Offline Support | Notes |
|---------|----------------|-------|
| View Clients | ✅ Full | All assigned clients cached |
| View Audit Reports | ✅ Full | All report data cached |
| Complete Checklists | ✅ Full | Progress saved locally |
| Create NCRs | ✅ Full | Queued for sync |
| Add Comments | ✅ Full | Saved locally |
| Attach Evidence | ✅ Full | Images stored as Base64 |
| Meeting Records | ✅ Full | Saved locally |
| Save Changes | ✅ Full | All changes queued |
| Generate Reports | ⚠️ Limited | PDF generation works offline, but AI features require internet |

---

## Installation on Mobile

### Android (Chrome)
1. Open AuditCB360 in Chrome: `http://localhost:8080` or your deployment URL
2. Tap the menu (⋮) → **Install app** or **Add to Home screen**
3. The app icon will appear on your home screen
4. Launch like a native app with full-screen mode

### iOS (Safari)
1. Open AuditCB360 in Safari
2. Tap the Share button (□↑)
3. Select **Add to Home Screen**
4. Give it a name (e.g., "AuditCB")
5. Launch from your home screen

---

## Technical Details

### What Gets Synced?
When you save changes offline, the following actions are queued:

1. **Checklist Progress** (`SAVE_CHECKLIST`)
   - All status updates (OK/NC/NA)
   - Comments and observations
   - Evidence images

2. **NCRs** (`CREATE_NCR`)
   - NCR type and severity
   - Descriptions and evidence
   - Interviewee details

3. **Meeting Records** (`SAVE_MEETINGS`)
   - Opening meeting details
   - Closing meeting summary
   - Attendees list

4. **Checklist Templates** (`SAVE_CHECKLIST_TEMPLATE`)
   - New or edited checklists
   - Clause structures

### Storage Locations

- **Local Storage**: `auditCB360State` - Main application state
- **Sync Queue**: `auditcb_sync_queue` - Pending changes waiting to sync
- **Service Worker Cache**: App files for offline access

### Sync Queue Behavior

```
[Offline] → Save Change → Add to Queue → Store Locally
                                ↓
[Online] → Detect Network → Process Queue → Sync to Supabase → Clear Queue
```

---

## Troubleshooting

### "Changes not syncing?"
1. Check internet connection (look for green checkmark or "ONLINE" indicator)
2. Open DevTools Console (F12) and look for sync messages
3. Check `localStorage` → `auditcb_sync_queue` to see pending items
4. Manually trigger sync by going offline and back online

### "Offline indicator not showing?"
- Ensure Service Worker is registered (check DevTools → Application → Service Workers)
- Clear cache and reload: Ctrl+Shift+R
- Check console for `ServiceWorker registration successful` message

### "App not installing on mobile?"
- Ensure you're using HTTPS (or localhost for testing)
- Check that `manifest.json` is properly loaded
- Clear browser cache and try again

---

## For Developers

### Files Modified

1. **`offline-manager.js`**
   - Enhanced `processSyncQueue()` with Supabase integration
   - Added action-specific sync handlers
   - Implemented retry logic

2. **`execution-module.js`**
   - Integrated `OfflineManager.queueAction()` in:
     - `saveChecklist()`
     - `createNCR()`
     - `saveMeetingRecords()`

3. **`checklist-module.js`**
   - Integrated `OfflineManager.queueAction()` in:
     - `saveChecklistFromEditor()`

### Testing Offline Mode

1. Open DevTools (F12) → Network tab
2. Select "Offline" from the throttling dropdown
3. Make changes in the app
4. Check Console for `queueAction` calls
5. Switch back to "Online"
6. Verify sync messages in Console

### Console Messages to Expect

```javascript
// When saving offline:
"OfflineManager: queueAction called: SAVE_CHECKLIST"

// When going back online:
"You are back online. Syncing data..."
"OfflineManager: Processing sync queue... 3 items"
"OfflineManager: Synced item: SAVE_CHECKLIST"
"All 3 offline changes synced successfully"
```

---

## Best Practices

1. **Sync Before Going to Field**
   - Ensure all data is up-to-date before losing connection
   - Verify clients and checklists are loaded

2. **Save Frequently**
   - Click "Save Changes" after completing each section
   - Don't rely on auto-save for critical data

3. **Check Sync Status**
   - When back online, wait for "synced successfully" notification
   - Verify changes appear in the cloud dashboard

4. **Backup Important Data**
   - Use Export feature to download audit reports
   - Keep local backups of critical evidence images

---

## Support

For issues or questions:
- Check browser console (F12) for error messages
- Verify Service Worker status in DevTools → Application tab
- Contact your system administrator with console logs
