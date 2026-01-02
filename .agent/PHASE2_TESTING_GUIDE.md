# AuditCB360 - Phase 2 Testing Guide

**Version**: 1.0  
**Date**: 2026-01-02  
**Purpose**: Manual testing guide for Meeting Records & Audit Evidence features

---

## 🎯 TESTING OBJECTIVES

This guide will help you test the newly implemented Phase 2 features:
1. Meeting Records (Opening/Closing Meetings)
2. Audit Evidence (Agenda, Interviewees, Documents)
3. Table of Contents with Navigation
4. Draft Watermark
5. Consistency across output formats

---

## 🚀 GETTING STARTED

### Prerequisites
- AuditCB360 application running on http://localhost:8000
- At least one client created
- At least one audit plan created
- At least one audit report in progress

### Quick Setup (If No Data Exists)
1. Navigate to **Clients** → Click **Add Client**
2. Fill in client details and save
3. Navigate to the client workspace
4. Create an **Audit Plan**
5. Start an audit execution to create a report

---

## 📝 TEST SCENARIOS

### Test 1: Meeting Records UI

**Objective**: Verify that meeting record input fields appear and function correctly

**Steps**:
1. Navigate to a client workspace
2. Open an existing audit report (or create a new one)
3. Click on the **"Summary"** or **"Report"** tab
4. Scroll down to find the **"Meeting Records"** section

**Expected Results**:
- ✅ Section header "MEETING RECORDS" is visible
- ✅ Two subsections: "Opening Meeting" and "Closing Meeting"
- ✅ Each subsection has:
  - Date/Time input field (datetime-local type)
  - Attendees textarea (comma-separated)
- ✅ Fields are styled with a light blue/gray background
- ✅ Opening Meeting label is blue (#2563eb)
- ✅ Closing Meeting label is red (#dc2626)

**Screenshot Location**: Take screenshot as `test1_meeting_records_ui.png`

---

### Test 2: Audit Evidence UI

**Objective**: Verify that audit evidence input fields appear

**Steps**:
1. In the same report view, scroll to the **"Audit Evidence"** section
2. This should appear after Meeting Records

**Expected Results**:
- ✅ Section header "AUDIT EVIDENCE" is visible
- ✅ Three input fields:
  - "Audit Agenda / Schedule" (textarea, 3 rows)
  - "Interviewees" (textarea, 3 rows, left column)
  - "Documents Reviewed" (textarea, 3 rows, right column)
- ✅ Interviewees and Documents are in a 2-column grid layout
- ✅ All fields have placeholder text

**Screenshot Location**: Take screenshot as `test2_audit_evidence_ui.png`

---

### Test 3: Data Persistence - Save Draft

**Objective**: Verify that new fields save correctly when saving a draft

**Steps**:
1. Fill in the Meeting Records fields:
   - Opening Meeting Date: Select any date/time
   - Opening Meeting Attendees: `John Doe, Jane Smith, Bob Johnson`
   - Closing Meeting Date: Select any date/time
   - Closing Meeting Attendees: `John Doe, Jane Smith, Sarah Williams`

2. Fill in the Audit Evidence fields:
   - Audit Agenda: `Day 1: Document review, Opening meeting\nDay 2: Site tour, Interviews\nDay 3: Closing meeting`
   - Interviewees: `John Doe (Quality Manager)\nJane Smith (Production Manager)\nBob Johnson (HR Manager)`
   - Documents Reviewed: `Quality Manual v2.1\nProcedure QP-001 to QP-015\nTraining Records 2025`

3. Click **"Save Draft"** button

**Expected Results**:
- ✅ Success notification appears: "Report draft saved to local storage"
- ✅ No errors in browser console (F12 → Console tab)

**Verification**:
4. Refresh the page (F5)
5. Navigate back to the same report
6. Verify all entered data is still present

**Screenshot Location**: Take screenshot as `test3_data_persistence.png`

---

### Test 4: Data Persistence - Submit for Review

**Objective**: Verify data persists when submitting for review

**Steps**:
1. With data filled in from Test 3, click **"Submit for Review"** button
2. Verify success notification appears
3. Refresh the page and navigate back to the report

**Expected Results**:
- ✅ Report status changes to "In Review"
- ✅ All meeting records and audit evidence data is preserved
- ✅ Success notification: "Report submitted for QA review"

---

### Test 5: Validation Warnings

**Objective**: Verify that validation warnings appear for missing data

**Steps**:
1. Create a new report or use an existing draft
2. Fill in ONLY the required fields (Executive Summary, Conclusion, Recommendation)
3. Leave Meeting Records and Audit Evidence fields EMPTY
4. Click **"Download PDF"** or **"Print Report"** button

**Expected Results**:
- ✅ A warning dialog appears with messages like:
  - "⚠️ Audit Agenda is missing"
  - "⚠️ List of Interviewees is missing"
  - "⚠️ Documents Reviewed list is missing"
  - "⚠️ Opening Meeting details missing"
  - "⚠️ Closing Meeting details missing"
- ✅ Dialog asks: "Do you want to continue anyway?"
- ✅ User can choose to proceed or cancel

**Screenshot Location**: Take screenshot as `test5_validation_warnings.png`

---

### Test 6: Generated Report - Print Preview

**Objective**: Verify new sections appear in the print preview

**Steps**:
1. Use a report with all fields filled (from Test 3)
2. Click **"Print Report"** button (or use the print icon)
3. A new window should open with the formatted report

**Expected Results in Print Preview**:

**Cover Page**:
- ✅ If report is NOT finalized, a large diagonal "DRAFT" watermark appears
- ✅ Watermark is semi-transparent red with border
- ✅ Watermark doesn't obscure important content

**Table of Contents** (NEW):
- ✅ TOC appears as a separate page after the cover
- ✅ All sections are listed with correct numbers
- ✅ Section numbers adjust if CAPA section exists
- ✅ Links are styled (blue, underlined)

**Section 6 or 5: Meeting Records** (NEW):
- ✅ Section header appears
- ✅ "Opening Meeting" subsection shows:
  - Date/Time (formatted from datetime input)
  - Attendees (comma-separated list)
- ✅ "Closing Meeting" subsection shows same format
- ✅ If data is missing, shows "Not recorded"

**Section 7 or 6: Audit Evidence** (NEW):
- ✅ Section header appears
- ✅ "Audit Agenda / Schedule" subsection with entered text
- ✅ "Interviewees" and "Documents Reviewed" in 2-column layout
- ✅ If data is missing, shows "None recorded" or "Agenda details pending..."

**Screenshot Locations**: 
- `test6_print_cover_with_watermark.png`
- `test6_print_toc.png`
- `test6_print_meeting_records.png`
- `test6_print_audit_evidence.png`

---

### Test 7: Generated Report - PDF Download

**Objective**: Verify PDF download works and includes new sections

**Steps**:
1. Use the same report from Test 6
2. Click **"Download PDF"** button
3. Wait for PDF generation (notification: "Generating PDF report...")
4. PDF should download automatically

**Expected Results**:
- ✅ Success notification: "PDF report generated successfully!"
- ✅ PDF file downloads with name: `Audit_Report_ClientName_ID.pdf`
- ✅ Open the PDF and verify:
  - Draft watermark appears (if not finalized)
  - Table of Contents is present
  - TOC links are clickable (click should jump to sections)
  - Meeting Records section is present with data
  - Audit Evidence section is present with data
  - All formatting matches print preview

**Screenshot Location**: Take screenshot of opened PDF as `test7_pdf_download.png`

---

### Test 8: Table of Contents Navigation

**Objective**: Verify TOC links work in PDF

**Steps**:
1. Open the downloaded PDF from Test 7
2. Go to the Table of Contents page
3. Click on different section links (e.g., "6. Meeting Records", "7. Audit Evidence")

**Expected Results**:
- ✅ Clicking a TOC link jumps to that section in the PDF
- ✅ All section links work correctly
- ✅ Section numbers in TOC match section numbers in content

**Note**: Link functionality depends on PDF viewer. Test in:
- Adobe Acrobat Reader
- Chrome PDF viewer
- Edge PDF viewer

---

### Test 9: Draft vs. Finalized Report

**Objective**: Verify watermark only appears on drafts

**Steps**:
1. Generate a report that is NOT finalized (status: Draft, In Review, or Approved)
2. Verify watermark appears
3. Finalize the report (status: Finalized/Published)
4. Generate the report again

**Expected Results**:
- ✅ Draft report: Watermark visible
- ✅ Finalized report: NO watermark
- ✅ All other content identical between versions

**Screenshot Locations**: 
- `test9_draft_with_watermark.png`
- `test9_finalized_no_watermark.png`

---

### Test 10: Cloud Upload Consistency

**Objective**: Verify cloud upload generates identical report

**Steps**:
1. Ensure Supabase is configured (or this will show a warning)
2. With a finalized report, click **"Save to Cloud"** button
3. If Supabase is configured, verify upload succeeds
4. Download the uploaded PDF from cloud storage
5. Compare with locally generated PDF

**Expected Results**:
- ✅ If Supabase configured: Upload succeeds with success notification
- ✅ If Supabase NOT configured: Warning notification appears
- ✅ Uploaded PDF is identical to downloaded PDF
- ✅ All sections present in both versions

**Note**: This test requires Supabase configuration. If not configured, verify the warning message appears correctly.

---

### Test 11: Section Numbering with/without CAPA

**Objective**: Verify dynamic section numbering works correctly

**Steps**:
1. Create/use a report WITH CAPAs (Corrective Actions)
2. Generate the report and note section numbers
3. Create/use a report WITHOUT CAPAs
4. Generate the report and note section numbers

**Expected Results**:

**With CAPAs**:
- Section 5: Corrective & Preventive Actions
- Section 6: Meeting Records
- Section 7: Audit Evidence
- Section 8: Observations
- Section 9: Conclusion

**Without CAPAs**:
- Section 5: Meeting Records
- Section 6: Audit Evidence
- Section 7: Observations
- Section 8: Conclusion

**Screenshot Locations**: 
- `test11_with_capa_numbering.png`
- `test11_without_capa_numbering.png`

---

### Test 12: Browser Compatibility

**Objective**: Verify functionality across browsers

**Browsers to Test**:
- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari (if available)

**For Each Browser**:
1. Open the application
2. Navigate to a report
3. Verify UI fields appear correctly
4. Generate PDF download
5. Verify PDF opens and displays correctly

**Expected Results**:
- ✅ UI renders correctly in all browsers
- ✅ PDF generation works in all browsers
- ✅ PDF content is identical across browsers

---

## 🐛 KNOWN ISSUES / LIMITATIONS

### Current Limitations
1. **TOC Page Numbers**: Page numbers are not shown in TOC (would require more complex PDF generation)
2. **Meeting Topics**: Only date/time and attendees are captured (no detailed topics/agenda for meetings)
3. **Image Size**: Very large images may slow PDF generation
4. **Supabase Required**: Cloud upload requires Supabase configuration

### Expected Warnings
- "Supabase credentials not configured" - Normal if not using cloud storage
- Validation warnings for empty optional fields - Expected behavior

---

## ✅ ACCEPTANCE CRITERIA

### Must Pass (Critical)
- [ ] All UI fields appear and are functional
- [ ] Data saves correctly (draft and review)
- [ ] Meeting Records section appears in generated report
- [ ] Audit Evidence section appears in generated report
- [ ] Table of Contents appears and is formatted correctly
- [ ] Draft watermark appears on non-finalized reports
- [ ] PDF download works without errors

### Should Pass (Important)
- [ ] TOC links work in PDF (browser-dependent)
- [ ] Validation warnings appear for missing data
- [ ] Section numbering adjusts correctly with/without CAPA
- [ ] Formatting is consistent across output methods
- [ ] No console errors during normal operation

### Nice to Have (Optional)
- [ ] Cloud upload works (requires Supabase)
- [ ] Works in all major browsers
- [ ] Performance is acceptable with large reports

---

## 📊 TEST RESULTS TEMPLATE

Use this template to record your test results:

```
TEST EXECUTION REPORT
Date: ___________
Tester: ___________
Browser: ___________
Version: ___________

Test 1 - Meeting Records UI: ☐ PASS ☐ FAIL
Notes: ___________

Test 2 - Audit Evidence UI: ☐ PASS ☐ FAIL
Notes: ___________

Test 3 - Data Persistence (Draft): ☐ PASS ☐ FAIL
Notes: ___________

Test 4 - Data Persistence (Review): ☐ PASS ☐ FAIL
Notes: ___________

Test 5 - Validation Warnings: ☐ PASS ☐ FAIL
Notes: ___________

Test 6 - Print Preview: ☐ PASS ☐ FAIL
Notes: ___________

Test 7 - PDF Download: ☐ PASS ☐ FAIL
Notes: ___________

Test 8 - TOC Navigation: ☐ PASS ☐ FAIL
Notes: ___________

Test 9 - Draft vs Finalized: ☐ PASS ☐ FAIL
Notes: ___________

Test 10 - Cloud Upload: ☐ PASS ☐ FAIL ☐ SKIPPED
Notes: ___________

Test 11 - Section Numbering: ☐ PASS ☐ FAIL
Notes: ___________

Test 12 - Browser Compatibility: ☐ PASS ☐ FAIL
Notes: ___________

OVERALL RESULT: ☐ PASS ☐ FAIL
Critical Issues Found: ___________
Recommendations: ___________
```

---

## 🔧 TROUBLESHOOTING

### Issue: Fields don't appear
- **Solution**: Clear browser cache and hard refresh (Ctrl+Shift+R)
- **Check**: Ensure `reporting-module.js?v=2` is loaded (check Network tab)

### Issue: Data doesn't save
- **Solution**: Check browser console for errors
- **Check**: Verify localStorage is enabled in browser

### Issue: PDF generation fails
- **Solution**: Check if `html2pdf.js` library loaded correctly
- **Check**: Look for errors in console during generation

### Issue: TOC links don't work
- **Solution**: This may be PDF viewer dependent
- **Check**: Try different PDF viewer (Adobe Reader vs Chrome)

### Issue: Watermark doesn't appear
- **Solution**: Verify report status is not "Finalized"
- **Check**: Look at `report.finalizedAt` field in data

---

## 📞 SUPPORT

If you encounter issues not covered in this guide:

1. Check browser console for errors (F12 → Console)
2. Review `IMPLEMENTATION_STATUS.md` for technical details
3. Check `reporting-module.js` source code (lines 224-260 for UI, 1057-1119 for report HTML)
4. Verify data structure in localStorage (Application tab → Local Storage)

---

## 🎉 SUCCESS!

If all critical tests pass, the Phase 2 implementation is ready for production deployment!

**Next Steps After Testing**:
1. Document any issues found
2. Fix critical bugs
3. Deploy to production environment
4. Train users on new features
5. Monitor for issues in production
6. Plan Phase 3 enhancements
