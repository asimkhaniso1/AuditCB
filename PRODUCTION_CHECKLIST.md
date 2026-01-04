# Production Readiness Checklist

Use this checklist to verify the application is ready for production use.

## ✅ Functional Testing
- [ ] **Dashboard**: Loads without errors, shows summary cards.
- [ ] **Clients**: Can add, edit, and view External and Internal clients.
- [ ] **Audit Planning**: Can create an audit plan, assign auditors, and set dates.
- [ ] **Execution**:
    - [ ] Checklist renders correctly.
    - [ ] Findings (NCRs) can be raised.
    - [ ] "Save Progress" works.
- [ ] **Reporting**:
    - [ ] "Review & Finalize" tab appears for Lead Auditors.
    - [ ] Table of Contents and Meeting Records appear in the preview.
    - [ ] PDF Generation works (via Print or Download).
    - [ ] "DRAFT" watermark appears for non-finalized reports.

## 🛡️ Security & Hygiene
- [ ] **Console Logs**: The browser console should be clean of `console.log` spam (Warnings/Errors only).
- [ ] **Input Sanitization**: Try entering HTML tags like `<b>bold</b>` in a text field. It should display as text, not render as bold.
- [ ] **XSS Prevention**: innerHTML usage has been replaced with `SafeDOM` utilities.

## ☁️ Cloud Integration (Supabase)
- [ ] **Configuration**: Settings > System Configuration has valid URL/Key.
- [ ] **Connection Test**: "Test Connection" button returns success.
- [ ] **Audit Logging**: Actions (like saving a client) create entries in the Supabase `audit_log` table.
- [ ] **Data Sync**: Editing data triggers a background upload to the `app-data` storage bucket.

## 📱 Responsiveness
- [ ] Check layout on Desktop (Full screen).
- [ ] Check layout on Laptop (13-inch).
- [ ] Check sidebar toggling behavior.

## 🚀 Performance
- [ ] Initial load time is under 2 seconds.
- [ ] Transitions between modules are snappy.
