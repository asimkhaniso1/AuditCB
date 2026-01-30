-- ==========================================
-- 72. RESTORE STORAGE BUCKETS & POICIES
-- ==========================================

-- 1. Ensure 'audit-files' bucket exists (for Logos and Evidence)
insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', true)
on conflict (id) do nothing;

-- 2. Ensure 'documents' bucket exists (for Knowledge Base)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- 3. Ensure 'audit-reports' bucket exists (for Generated PDFs)
insert into storage.buckets (id, name, public)
values ('audit-reports', 'audit-reports', false) -- Private, signed URLs only
on conflict (id) do nothing;

-- 4. Enable RLS (Commented out to avoid permission errors - typically already enabled)
-- alter table storage.objects enable row level security;

-- ==========================================
-- POLICIES FOR 'audit-files' (Logos - Public Read, Auth Write)
-- ==========================================

-- Allow Public Read
drop policy if exists "Public Access to Audit Files" on storage.objects;
create policy "Public Access to Audit Files"
on storage.objects for select
using ( bucket_id = 'audit-files' );

-- Allow Authenticated Insert (Relaxed to Public for Debugging)
drop policy if exists "Authenticated Insert to Audit Files" on storage.objects;
create policy "Authenticated Insert to Audit Files"
on storage.objects for insert
with check ( bucket_id = 'audit-files' );

-- Allow Users to Update their own uploads (or Admin)
drop policy if exists "Authenticated Update to Audit Files" on storage.objects;
create policy "Authenticated Update to Audit Files"
on storage.objects for update
using ( bucket_id = 'audit-files' );

-- Allow Users to Delete their own uploads (or Admin)
drop policy if exists "Authenticated Delete from Audit Files" on storage.objects;
create policy "Authenticated Delete from Audit Files"
on storage.objects for delete
using ( bucket_id = 'audit-files' );

-- ==========================================
-- POLICIES FOR 'documents' (Knowledge Base - Public Read, Auth Write)
-- ==========================================

-- Allow Public Read
drop policy if exists "Public Access to Documents" on storage.objects;
create policy "Public Access to Documents"
on storage.objects for select
using ( bucket_id = 'documents' );

-- Allow Authenticated Insert (Relaxed to Public for Debugging)
drop policy if exists "Authenticated Insert to Documents" on storage.objects;
create policy "Authenticated Insert to Documents"
on storage.objects for insert
with check ( bucket_id = 'documents' );

-- Allow Authenticated Update
drop policy if exists "Authenticated Update to Documents" on storage.objects;
create policy "Authenticated Update to Documents"
on storage.objects for update
using ( bucket_id = 'documents' );

-- Allow Authenticated Delete
drop policy if exists "Authenticated Delete from Documents" on storage.objects;
create policy "Authenticated Delete from Documents"
on storage.objects for delete
using ( bucket_id = 'documents' );

-- ==========================================
-- POLICIES FOR 'audit-reports' (Private - Signed URL only)
-- ==========================================

-- Allow Authenticated Read
drop policy if exists "Authenticated Read Audit Reports" on storage.objects;
create policy "Authenticated Read Audit Reports"
on storage.objects for select
using ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

-- Allow Authenticated Insert
drop policy if exists "Authenticated Insert Audit Reports" on storage.objects;
create policy "Authenticated Insert Audit Reports"
on storage.objects for insert
with check ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

-- Allow Authenticated Delete
drop policy if exists "Authenticated Delete Audit Reports" on storage.objects;
create policy "Authenticated Delete Audit Reports"
on storage.objects for delete
using ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

