# AuditCB360 - Administrator Guide

## 1. User Management (Admin Only)

### Adding/Inviting Users
1.  Go to **Settings > System > User Management**.
2.  Click **Invite User** to send an email invitation.
3.  Or click **Add User** to manually create a profile.

### Approving Users
-   New self-registered users appear as **"Pending"**.
-   Click the **Approve** button (Checkmark icon) to activate them.

### Role Management
-   **Admin**: Full access.
-   **Certification Manager**: Can manage clients/audits but CANNOT add/delete users.
-   **Lead Auditor/Auditor**: Restricted to assigned audits.

## 2. Organization Settings
Go to **Settings > Organization**.
-   **Designations**: Add/Edit job titles and reporting hierarchy.
-   **Permissions**: View role-based access matrix.

## 3. Deployment & Backup

### Database (Supabase)
-   The system uses Supabase.
-   Use `supabase_schema_final.sql` to restore the database structure if needed.

### Offline Sync
-   The app caches data in the browser (`localStorage`).
-   The `OfflineManager` handles syncing when connectivity returns.

## 4. Troubleshooting
-   **Logs**: Check **Settings > System > Activity Log** to see user actions (Login, Delete, etc.).
-   **Email Issues**: Check `email-service.js` configuration if emails are not sending.
