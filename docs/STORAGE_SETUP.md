# 📁 Supabase Storage Setup Guide

## Overview
This guide will help you set up Supabase Storage for file uploads in your AuditCB360 application.

---

## Step 1: Create Storage Bucket in Supabase

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Navigate to your project

2. **Go to Storage**
   - Click "Storage" in the left sidebar
   - Click "New bucket"

3. **Create Bucket**
   - **Name:** `audit-files`
   - **Public bucket:** ✅ Check this (for public file access)
   - **File size limit:** 50 MB (or as needed)
   - **Allowed MIME types:** Leave empty (allow all) or specify:
     - `application/pdf`
     - `image/*`
     - `application/vnd.openxmlformats-officedocument.*`
     - `text/*`
   - Click "Create bucket"

4. **Set Bucket Policies** (Important!)
   
   Go to "Policies" tab and add these policies:

   **Policy 1: Allow Public Read**
   ```sql
   CREATE POLICY "Public Access"
   ON storage.objects FOR SELECT
   USING ( bucket_id = 'audit-files' );
   ```

   **Policy 2: Allow Authenticated Upload**
   ```sql
   CREATE POLICY "Authenticated users can upload"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'audit-files'
   );
   ```

   **Policy 3: Allow Authenticated Delete**
   ```sql
   CREATE POLICY "Authenticated users can delete own files"
   ON storage.objects FOR DELETE
   USING (
     bucket_id = 'audit-files'
   );
   ```

---

## Step 2: Update Documents Table Schema

Run this SQL in Supabase SQL Editor to add storage-related columns:

```sql
-- Add storage columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'documents',
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
```

---

## Step 3: Test File Upload

### In Browser Console:

```javascript
// Test file upload
async function testFileUpload() {
    // Create a test file
    const testContent = 'This is a test document';
    const blob = new Blob([testContent], { type: 'text/plain' });
    const file = new File([blob], 'test-document.txt', { type: 'text/plain' });
    
    try {
        // Upload document
        const result = await window.SupabaseClient.uploadDocument(file, {
            name: 'Test Document',
            folder: 'test',
            description: 'Testing file upload functionality'
        });
        
        console.log('✅ Upload successful!', result);
        console.log('📄 File URL:', result.url);
        return result;
    } catch (error) {
        console.error('❌ Upload failed:', error);
    }
}

// Run test
testFileUpload();
```

---

## Step 4: Usage Examples

### Upload a Document

```javascript
// From a file input element
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

const result = await window.SupabaseClient.uploadDocument(file, {
    name: 'Audit Report 2024',
    folder: 'audit-reports',
    description: 'Annual audit report',
    uploadedBy: 'john@example.com'
});

console.log('Uploaded:', result.url);
```

### Download a Document

```javascript
// Download file as Blob
const blob = await window.SupabaseClient.downloadFile('documents/1234567890_report.pdf');

// Create download link
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'report.pdf';
a.click();
URL.revokeObjectURL(url);
```

### Delete a Document

```javascript
// Delete document and its file
await window.SupabaseClient.deleteDocument(documentId);
console.log('Document deleted');
```

### List Files in a Folder

```javascript
// List all files in 'audit-reports' folder
const files = await window.SupabaseClient.listFiles('audit-reports');
console.log('Files:', files);
```

---

## Step 5: Folder Structure

Recommended folder organization:

```
audit-files/
├── documents/          # General documents
├── audit-reports/      # Audit report PDFs
├── certificates/       # ISO certificates
├── evidence/           # Audit evidence photos
├── ncr-attachments/    # NCR supporting documents
└── capa-attachments/   # CAPA supporting documents
```

---

## Available Functions

### Core Storage Functions

| Function | Description | Parameters |
|----------|-------------|------------|
| `uploadFile(file, folder)` | Upload raw file | file, folder path |
| `downloadFile(path)` | Download file as Blob | storage path |
| `deleteFile(path)` | Delete file | storage path |
| `listFiles(folder)` | List files in folder | folder path |

### Document Management Functions

| Function | Description | Parameters |
|----------|-------------|------------|
| `uploadDocument(file, metadata)` | Upload + save metadata | file, metadata object |
| `deleteDocument(id)` | Delete file + metadata | document ID |

---

## File Size Limits

**Default Limits:**
- Free tier: 1 GB total storage
- Pro tier: 100 GB total storage
- Max file size: 50 MB (configurable)

**To increase limits:**
1. Go to Supabase Dashboard → Settings → Storage
2. Adjust "Maximum file size"
3. Upgrade plan if needed for more storage

---

## Security Best Practices

1. **Use RLS Policies**
   - Restrict uploads to authenticated users
   - Implement user-specific access controls

2. **Validate File Types**
   - Check MIME types before upload
   - Sanitize filenames

3. **Set Size Limits**
   - Prevent abuse with reasonable limits
   - Monitor storage usage

4. **Use Folders**
   - Organize files by type/purpose
   - Easier to manage and secure

---

## Troubleshooting

### Issue: "Bucket not found"
**Solution:** Ensure bucket name is exactly `audit-files`

### Issue: "Permission denied"
**Solution:** Check RLS policies are set correctly

### Issue: "File too large"
**Solution:** Increase bucket size limit or compress file

### Issue: "CORS error"
**Solution:** Supabase handles CORS automatically, check bucket is public

---

## Integration with UI

### Example: Add File Upload to Document Module

```javascript
// In your document management UI
function handleFileUpload(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Show loading indicator
    window.showNotification('Uploading file...', 'info');
    
    // Upload document
    window.SupabaseClient.uploadDocument(file, {
        name: file.name,
        folder: 'documents',
        uploadedBy: window.state.currentUser.email
    })
    .then(result => {
        window.showNotification('File uploaded successfully!', 'success');
        // Refresh document list
        renderDocuments();
    })
    .catch(error => {
        window.showNotification('Upload failed: ' + error.message, 'error');
    });
}
```

---

## Next Steps

1. ✅ Create `audit-files` bucket in Supabase
2. ✅ Set bucket policies
3. ✅ Update documents table schema
4. ✅ Test file upload
5. ✅ Integrate with your UI
6. ✅ Deploy and test in production

---

## 📊 Storage Monitoring

Monitor your storage usage:
- **Dashboard:** Supabase → Storage → audit-files
- **View:** Total files, total size, recent uploads
- **Alerts:** Set up notifications for storage limits

---

**Your file storage is now ready!** 🎉

Files will be stored securely in Supabase and accessible via public URLs.
