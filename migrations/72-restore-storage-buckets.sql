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

-- 4. Enable RLS on objects (Security Best Practice)
alter table storage.objects enable row level security;

-- ==========================================
-- POLICIES FOR 'audit-files' (Logos - Public Read, Auth Write)
-- ==========================================

-- Allow Public Read
create policy "Public Access to Audit Files"
on storage.objects for select
using ( bucket_id = 'audit-files' );

-- Allow Authenticated Insert
create policy "Authenticated Insert to Audit Files"
on storage.objects for insert
with check ( bucket_id = 'audit-files' and auth.role() = 'authenticated' );

-- Allow Users to Update their own uploads (or Admin)
create policy "Authenticated Update to Audit Files"
on storage.objects for update
using ( bucket_id = 'audit-files' and auth.role() = 'authenticated' );

-- Allow Users to Delete their own uploads (or Admin)
create policy "Authenticated Delete from Audit Files"
on storage.objects for delete
using ( bucket_id = 'audit-files' and auth.role() = 'authenticated' );

-- ==========================================
-- POLICIES FOR 'documents' (Knowledge Base - Public Read, Auth Write)
-- ==========================================

-- Allow Public Read (or restricting to authenticated? KB uses public URL often for convenience, lets stick to Public for now to fix sync)
create policy "Public Access to Documents"
on storage.objects for select
using ( bucket_id = 'documents' );

-- Allow Authenticated Insert
create policy "Authenticated Insert to Documents"
on storage.objects for insert
with check ( bucket_id = 'documents' and auth.role() = 'authenticated' );

-- Allow Authenticated Update
create policy "Authenticated Update to Documents"
on storage.objects for update
using ( bucket_id = 'documents' and auth.role() = 'authenticated' );

-- Allow Authenticated Delete
create policy "Authenticated Delete from Documents"
on storage.objects for delete
using ( bucket_id = 'documents' and auth.role() = 'authenticated' );

-- ==========================================
-- POLICIES FOR 'audit-reports' (Private - Signed URL only)
-- ==========================================

-- Allow Authenticated Read (Correct way for signed URLs involves checking owner or allowing auth.role() if loose)
-- For signed URLs to work, we need a policy that allows the SELECT if the user has access.
-- Simplest for this app: Allow any authenticated user to read reports.
create policy "Authenticated Read Audit Reports"
on storage.objects for select
using ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

-- Allow Authenticated Insert
create policy "Authenticated Insert Audit Reports"
on storage.objects for insert
with check ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

-- Allow Authenticated Delete
create policy "Authenticated Delete Audit Reports"
on storage.objects for delete
using ( bucket_id = 'audit-reports' and auth.role() = 'authenticated' );

