# ISO 17021 Implementation - Status Update

## Status

✅ **Public Directory Functions** - COMPLETE  
✅ **Public Directory HTML Tab** - COMPLETE  
✅ **Multi-Site Sampling Calculator** - COMPLETE

---

## What's Been Implemented

### 1. Public Directory Functions (certifications-module.js)

The following functions have been added to the end of `certifications-module.js`:

- `window.updatePublicDirectory()` - Renders the directory table based on privacy settings
- `window.exportPublicDirectory()` - Exports directory as CSV
- `window.generateEmbedCode()` - Generates HTML embed code for external websites
- Updated `window.switchCertTab()` - Initializes directory when tab is opened

### 2. Public Directory Tab Button

Added to `certifications-module.js`:
```html
<button class="tab-btn" onclick="switchCertTab(this, 'public-directory')">
    <i class="fa-solid fa-globe" style="margin-right: 0.5rem;"></i>Public Directory
</button>
```

### 3. Public Directory Tab HTML Content

The HTML content for the Public Directory tab has been successfully integrated into `certifications-module.js`.

---

### 4. Multi-Site Sampling Calculator (advanced-modules.js)

Implemented the IAF MD 1 Sampling Calculator:
- **Location:** `advanced-modules.js` (modal logic) and `planning-module.js` (button integration)
- **Features:** 
    - Calculates sample size based on Total Sites, Risk Level, NCRs, and Complexity.
    - Enforces mandatory sites (HQ, Special Processes, New Sites).
    - Allows random selection of sites from the Audit Plan form.
    - Allows applying the calculated target count to the form.

**IAF MD 1 Formula Implemented:**
```
Sample Size = √n (rounded up)

Risk Adjustments:
- Low risk: 0.8 × √n
- Medium risk: 1.0 × √n
- High risk: 1.2 × √n

Minimum: 25% of total sites
Mandatory sites: HQ, special processes, sites with NCRs
```

---

## Files Modified

| File | Status | Changes |
|------|--------|---------|
| `certifications-module.js` | ✅ Complete | Public Directory tab, functions, and HTML integrated |
| `advanced-modules.js` | ✅ Complete | Multi-Site Sampling Calculator modal logic added |
| `planning-module.js` | ✅ Complete | Added "Sampling" button to create audit plan form |

---

## Testing

### Public Directory
1. Navigate to **Certifications**.
2. Click **Public Directory** tab.
3. Verify table, privacy controls, export, and embed functions.

### Multi-Site Sampling
1. Create a new **Audit Plan**.
2. In the "Audit Site(s)" section, click the **Sampling** button.
3. Enter site details in the modal.
4. Click **Calculate Sample Size**.
5. Use **Apply to Plan** or **Select Randomly** to update the plan form.
