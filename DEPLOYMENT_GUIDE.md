# Deployment Guide for AuditCB360

AuditCB360 is a **Client-Side Single Page Application (SPA)**. It does not require a Node.js backend server to run. It can be hosted on any static file hosting service.

## 🚀 Hosting Options

### Option 1: Vercel (Recommended)
1.  Push your code to a GitHub, GitLab, or Bitbucket repository.
2.  Log in to [Vercel](https://vercel.com).
3.  Click **"Add New Project"** and import your repository.
4.  **Framework Preset**: Select "Other" or "No Framework".
5.  **Build Command**: Leave empty.
6.  **Output Directory**: Leave empty (or set to `.`/root).
7.  Click **Deploy**.

### Option 2: Netlify
1.  Log in to [Netlify](https://netlify.com).
2.  Drag and drop your project folder into the "Sites" area (Manual Deploy).
3.  **OR** connect your Git repository for continuous deployment.
    *   **Build command**: (Leave empty)
    *   **Publish directory**: `.` (Current directory)

### Option 3: Traditional Web Server (Apache/Nginx)
1.  Upload all files from the project root to your `public_html` or `www` folder.
2.  Ensure `index.html` is the default document.

---

## ⚙️ Configuration (Supabase)

To enable cloud features (Audit Logs, Cloud Backup, PDF Storage), you need to configure Supabase.

### 1. Create Supabase Project
1.  Go to [supabase.com](https://supabase.com) and create a new project.
2.  Once created, go to **Settings > API**.
3.  Note down the:
    *   **Project URL**
    *   **anon / public Key**

### 2. Set Up Database Schema
1.  Go to the **SQL Editor** in your Supabase dashboard.
2.  Open the file `supabase_schema.sql` from this project.
3.  Copy the content and paste it into the Supabase SQL Editor.
4.  Click **Run** to create the necessary tables and policies.

### 3. Set Up Storage Buckets
1.  Go to **Storage** in Supabase.
2.  Create a new bucket named `app-data`.
    *   Toggle "Public bucket" to **OFF** (Private).
    *   Add a policy to allow Authenticated users to Upload/Download.
3.  Create a new bucket named `audit-reports`.
    *   Toggle "Public bucket" to **OFF** (Private).
4.  Create a new bucket named `audit-images`.
    *   Toggle "Public bucket" to **OFF** (Private).

### 4. Connect App
1.  Open your deployed application.
2.  Go to **Settings > System Configuration**.
3.  Enter your **Supabase URL** and **Anon Key**.
4.  Click **Save Configuration**.

---

## 🔍 Verification

After deployment:
1.  Open the URL.
2.  Open the browser console (`F12`).
3.  Check for any red errors.
4.  Try creating a test Client locally.
5.  If Supabase is configured, check if a row appears in the `audit_log` table in Supabase.

## ⚠️ Important Notes

*   **Security**: Ensure your Supabase "Row Level Security" (RLS) policies are active. The provided schema enables them by default.
*   **Browser Support**: The app uses modern JavaScript (ES6+). It works best in Chrome, Firefox, Edge, and Safari (latest versions).
*   **Data Persistence**:
    *   Without Supabase: Data lives in the user's browser (`localStorage`). Clearing cache wipes data.
    *   With Supabase: Data is backed up to the cloud (`app-data` bucket) via the `DataSync` module.
