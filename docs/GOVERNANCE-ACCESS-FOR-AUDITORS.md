# Governance Module Access for Auditors

## Current Status

**Governance modules are currently HIDDEN from Auditors.**

The Governance section includes:
1. **Appeals & Complaints** - Managing appeals and complaints from clients
2. **Impartiality** - Impartiality Committee, threats register, meetings
3. **Management Review** - Management review meetings and records

## Recommended Access for Auditors

### ✅ Should Be Accessible (Read-Only or Limited):

1. **Impartiality Module**
   - **Why**: Auditors need to be aware of impartiality threats
   - **Access Level**: **Read-Only**
   - **What they can see**:
     - Threat Register (view only)
     - Committee Members (view only)
     - Meeting Minutes (view only)
   - **What they cannot do**:
     - Add/edit/delete threats
     - Add/edit committee members
     - Create/edit meetings

2. **Appeals & Complaints Module** (Conditional)
   - **Why**: Auditors may need to view complaints related to their audits
   - **Access Level**: **Read-Only** (view complaints related to their audits only)
   - **What they can see**:
     - Complaints related to clients they audit
     - Status and resolution of complaints
   - **What they cannot do**:
     - Create/edit/delete complaints
     - View complaints for other auditors

### ❌ Should Remain Restricted:

1. **Management Review Module**
   - **Why**: This is a CB-level governance function
   - **Access Level**: **No Access** (Admin/Certification Manager only)
   - **Reason**: Contains strategic CB information, performance metrics, and management decisions

## Recommended Implementation

### Option 1: Granular Access (Recommended)

Make Governance modules visible to Auditors with role-based permissions:

```javascript
// In script.js - updateNavigationForRole()
function updateNavigationForRole(role) {
    const auditorRoles = ['Auditor', 'Lead Auditor'];
    const isAuditor = auditorRoles.includes(role);

    // Hide Settings for Auditors
    const settingsNav = document.querySelector('li[data-module="settings"]');
    if (settingsNav) {
        settingsNav.style.display = isAuditor ? 'none' : '';
    }

    // Show Governance group but hide Management Review for Auditors
    const governanceHeader = document.querySelector('.nav-group-header');
    const governanceContent = governanceHeader?.nextElementSibling;
    
    if (isAuditor) {
        // Show Governance section for Auditors
        if (governanceHeader && governanceContent) {
            governanceHeader.style.display = '';
            governanceContent.style.display = '';
        }
        
        // Hide Management Review for Auditors
        const mgmtReviewNav = document.querySelector('li[data-module="management-review"]');
        if (mgmtReviewNav) {
            mgmtReviewNav.style.display = 'none';
        }
    }
}
```

### Option 2: Keep Hidden (Current Approach)

Keep all Governance modules hidden from Auditors:
- **Pros**: Simpler, cleaner UI for Auditors
- **Cons**: Auditors cannot view impartiality information

### Option 3: Separate "Auditor View" Section

Create a dedicated section for Auditors with read-only governance info:
- Add a new navigation item: "Compliance Info" or "Governance Info"
- Show read-only views of relevant governance data
- Clearly marked as "View Only"

## Recommended Approach

**I recommend Option 1 (Granular Access)** with the following configuration:

| Module | Admin | Cert Manager | Lead Auditor | Auditor |
|--------|-------|--------------|--------------|---------|
| **Appeals & Complaints** | Full Access | Full Access | Read-Only (Own Clients) | Read-Only (Own Clients) |
| **Impartiality** | Full Access | Full Access | Read-Only | Read-Only |
| **Management Review** | Full Access | Full Access | No Access | No Access |

### Benefits:
1. ✅ Auditors stay informed about impartiality requirements
2. ✅ Auditors can view complaints related to their work
3. ✅ Maintains confidentiality of strategic CB information
4. ✅ Promotes transparency and awareness

### Implementation Steps:

1. **Update `script.js`** - Modify `updateNavigationForRole()` function
2. **Update `impartiality-module.js`** - Add read-only mode for Auditors
3. **Update `appeals-complaints-module.js`** - Add read-only mode and filter by auditor
4. **Keep `management-review-module.js`** - No changes (remains Admin-only)

Would you like me to implement this granular access approach?
