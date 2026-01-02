# Quick Test Guide - Add Client Modal

## ✅ What You Should See

### 1. All Sections Visible
- ✅ Basic Information
- ✅ Primary Contact Person
- ✅ Location
- ✅ Planning Data

### 2. Required Fields (with red *)
- Company Name *
- Industry *
- Standards *
- Contact Name *
- Total Employees *
- Number of Sites *

### 3. Optional Fields (no *)
- Website
- Contact Email
- Contact Designation
- Contact Phone
- Address, City, Country, Geotag
- Next Audit Date
- Certification Status

---

## 🧪 Quick Test Scenarios

### Test A: Minimum Required Fields
**Fill only:**
- Company Name: "ABC Corp"
- Industry: "Manufacturing"
- Standards: Select "ISO 9001:2015"
- Contact Name: "Jane Smith"
- Total Employees: 25
- Number of Sites: 1

**Leave empty:**
- Website
- Contact Email
- Next Audit Date

**Expected:** ✅ Saves successfully

---

### Test B: Invalid Optional Fields
**Fill:**
- All required fields (as above)
- Website: "not-a-url"
- Contact Email: "not-an-email"

**Expected:** ❌ Shows validation errors for Website and Email

---

### Test C: Valid Optional Fields
**Fill:**
- All required fields
- Website: "https://example.com"
- Contact Email: "john@example.com"
- Next Audit Date: "2026-06-01"

**Expected:** ✅ Saves successfully with all data

---

## 🔧 If Something Doesn't Work

### Problem: Sections still hidden
**Solution:** Hard refresh browser (Ctrl+Shift+R)

### Problem: No asterisks showing
**Solution:** Clear cache and reload

### Problem: Website/Email required when empty
**Solution:** Check browser console for JS errors, refresh page

---

## 📋 Checklist

Before testing:
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Check Network tab shows `clients-module.js` reloaded

During testing:
- [ ] All 4 sections visible in modal
- [ ] 6 fields show red asterisk (*)
- [ ] Can save with only required fields
- [ ] Website optional (no error when empty)
- [ ] Email optional (no error when empty)
- [ ] Next Audit Date optional (no error when empty)
- [ ] Invalid URL/email shows error when provided

After successful save:
- [ ] Client appears in clients list
- [ ] Client data saved correctly
- [ ] No console errors

---

**Status:** Ready for testing! 🎯
