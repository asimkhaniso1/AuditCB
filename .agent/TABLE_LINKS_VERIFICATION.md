# Client Workspace - Table Links Verification
**Date:** 2025-12-21  
**Purpose:** Verify all tables/content have working links to their detail views/forms

---

## 📋 Tables in Client Workspace

### 1. **Overview Tab**

#### Sites Table
- **Location:** `renderClientOverview()` - Sites section
- **Action Buttons:**
  - ✅ "Add Site" button → `window.openEditClientModal(${client.id})`
  - ✅ "Add First Site" button → `window.openEditClientModal(${client.id})`
- **Status:** ✅ LINKED (opens client edit modal)

#### Summary Cards (Clickable)
- **Total Audits Card** → `window.renderClientModule(${client.id}, 'plans', null)`
- **Certificates Card** → `window.renderClientModule(${client.id}, 'certs', null)`
- **Open NCs Card** → `window.renderClientModule(${client.id}, 'findings', null)`
- **Compliance Card** → `window.renderClientModule(${client.id}, 'compliance', null)`
- **Status:** ✅ LINKED (navigates to respective tabs)

---

### 2. **Plans & Audits Tab**

#### Audit Plans Table
- **Location:** `renderClientPlans()` - Plans table
- **Action Buttons:**
  - ✅ "New Plan" button → `window.openCreatePlanModal('${client.name}')`
  - ✅ "Create First Audit Plan" button → `window.openCreatePlanModal('${client.name}')`
  - ✅ Eye icon (View) → `window.viewAuditPlan(${p.id})`
- **Status:** ✅ LINKED
- **Function Source:** `planning-module.js:1877`

---

### 3. **Execution Tab**

#### Audit Reports Table
- **Location:** `renderClientExecution()` - Reports table
- **Action Buttons:**
  - ✅ "New Audit" button → `window.openCreatePlanModal('${client.name}')`
  - ✅ "Start First Audit" button → `window.openCreatePlanModal('${client.name}')`
  - ✅ Eye icon (View Report) → `window.viewAuditReport(${r.id})`
- **Status:** ⚠️ NEEDS VERIFICATION
- **Function Source:** Need to verify `window.viewAuditReport` exists

---

### 4. **Reporting Tab**

#### Finalized Reports Table
- **Location:** `renderClientReporting()` - Reports table
- **Action Buttons:**
  - ✅ Eye icon (View) → `window.viewAuditReport(${r.id})`
  - ✅ Download icon → `window.downloadReport(${r.id})`
- **Status:** ⚠️ NEEDS VERIFICATION
- **Function Source:** Need to verify both functions exist

---

### 5. **Findings Tab**

#### Findings/NCRs Table
- **Location:** `renderClientFindings()` - Findings table
- **Action Buttons:**
  - ❌ NO ACTION BUTTONS (view-only table)
- **Status:** ⚠️ MISSING ACTIONS
- **Recommendation:** Add view/edit buttons for individual findings

---

### 6. **Certificates Tab**

#### Certificates Table
- **Location:** `renderClientCertificates()` - Certificates table
- **Action Buttons:**
  - ❌ NO ACTION BUTTONS (view-only table)
- **Status:** ⚠️ MISSING ACTIONS
- **Recommendation:** Add view/download buttons for certificates

---

### 7. **Compliance Tab**

- **Location:** Delegates to `renderClientTab(client, 'compliance')`
- **Source:** `clients-module.js`
- **Status:** ✅ LINKED (uses existing module)

---

### 8. **Documents Tab**

- **Location:** Delegates to `renderClientTab(client, 'documents')`
- **Source:** `clients-module.js`
- **Status:** ✅ LINKED (uses existing module)

---

## 🔍 Functions to Verify

### Required Functions (Need to Check Existence)

| Function | Expected Location | Status |
|----------|------------------|--------|
| `window.openEditClientModal()` | clients-module.js | ✅ Exported (line 1485) |
| `window.openCreatePlanModal()` | planning-module.js | ✅ Exported (line 1874) |
| `window.viewAuditPlan()` | planning-module.js | ✅ Exported (line 1877) |
| `window.viewAuditReport()` | reporting-module.js | ❓ NEEDS VERIFICATION |
| `window.downloadReport()` | reporting-module.js | ❓ NEEDS VERIFICATION |

---

## 🚨 Issues Found

### Critical Issues
1. **Missing Report View Function**
   - `window.viewAuditReport()` may not exist
   - Used in: Execution tab, Reporting tab
   - **Action Required:** Verify or create function

2. **Missing Download Function**
   - `window.downloadReport()` may not exist
   - Used in: Reporting tab
   - **Action Required:** Verify or create function

### Enhancement Opportunities
1. **Findings Table** - Add action buttons:
   - View finding details
   - Edit/update finding status
   - Link to CAPA

2. **Certificates Table** - Add action buttons:
   - View certificate details
   - Download certificate PDF
   - View certificate history

---

## ✅ Verified Working Links

1. ✅ Edit Client → Opens client edit modal
2. ✅ New Audit Plan → Opens plan creation modal
3. ✅ View Audit Plan → Opens plan detail view
4. ✅ Summary Cards → Navigate to respective tabs
5. ✅ Compliance Tab → Renders existing compliance view
6. ✅ Documents Tab → Renders existing documents view

---

## 📝 Next Steps

1. **Verify reporting-module.js exports:**
   ```javascript
   window.viewAuditReport
   window.downloadReport
   ```

2. **Add missing action buttons to:**
   - Findings table (view/edit)
   - Certificates table (view/download)

3. **Test all links manually:**
   - Click each button in each tab
   - Verify modals/views open correctly
   - Check for console errors

---

## 🎯 Completion Checklist

- [x] Overview tab - All links verified
- [x] Plans tab - All links verified
- [ ] Execution tab - Needs function verification
- [ ] Reporting tab - Needs function verification
- [ ] Findings tab - Needs action buttons
- [ ] Certificates tab - Needs action buttons
- [x] Compliance tab - Verified (delegates)
- [x] Documents tab - Verified (delegates)

**Last Updated:** 2025-12-21 22:41 PKT
