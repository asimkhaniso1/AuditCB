# Security Implementation Guide
**XSS Prevention & Form Validation**

## Overview

This guide shows how to use the new `Validator` and `Sanitizer` utilities to secure AuditCB360 against XSS attacks and ensure data integrity.

---

## Table of Contents

1. [Quick Start Examples](#quick-start)
2. [Using Sanitizer (XSS Prevention)](#using-sanitizer)
3. [Using Validator (Form Validation)](#using-validator)
4. [Migration Checklist](#migration-checklist)
5. [Common Patterns](#common-patterns)

---

## Quick Start

### Before (❌ UNSAFE):
```javascript
// XSS Vulnerable!
const complaint = {
    subject: document.getElementById('complaint-subject').value
};

contentArea.innerHTML = `<h3>${complaint.subject}</h3>`;
```

### After (✅ SAFE):
```javascript
// Sanitize + Validate
const subjectValue = document.getElementById('complaint-subject').value;

// Option 1: Use textContent (safest for plain text)
const h3 = document.createElement('h3');
h3.textContent = subjectValue;
contentArea.appendChild(h3);

// Option 2: Use Sanitizer helper
const h3 = Sanitizer.createElement('h3', subjectValue);
contentArea.appendChild(h3);

// Option 3: If you MUST use innerHTML
contentArea.innerHTML = Sanitizer.sanitizeHTML(`<h3>${Sanitizer.escapeHTML(subjectValue)}</h3>`);
```

---

## Using Sanitizer (XSS Prevention)

### 1. Sanitizing User Input for Display

```javascript
// ✅ For plain text fields (names, subjects, etc.)
const safeName = Sanitizer.sanitizeText(userInput);

// ✅ For rich text fields (descriptions with formatting)
const safeDescription = Sanitizer.sanitizeHTML(userInput);

// ✅ For URLs
const safeURL = Sanitizer.sanitizeURL(userInput);
```

### 2. Building Safe HTML Templates

**Pattern A: Use createElement** (Recommended)
```javascript
// Create element with safe text content
const row = document.createElement('tr');
row.innerHTML = `
    <td><strong>ID:</strong></td>
    <td></td>
`;
const td = row.querySelector('td:last-child');
td.textContent = complaint.subject; // Auto-escapes!

tableBody.appendChild(row);
```

**Pattern B: Escape Before Interpolation**
```javascript
const data = Sanitizer.prepareTemplateData(complaint, ['subject', 'description']);

const html = `
    <div class="card">
        <h3>${data.subject}</h3>
        <p>${data.description}</p>
    </div>
`;

contentArea.innerHTML = Sanitizer.sanitizeHTML(html);
```

**Pattern C: Use Sanitizer.createElement**
```javascript
const container = document.createElement('div');
container.className = 'card';

const title = Sanitizer.createElement('h3', complaint.subject);
const desc = Sanitizer.createElement('p', complaint.description);

container.appendChild(title);
container.appendChild(desc);
contentArea.appendChild(container);
```

### 3. Sanitizing Form Data

```javascript
const rawFormData = {
    subject: document.getElementById('subject').value,
    description: document.getElementById('description').value,
    notes: document.getElementById('notes').value
};

// Sanitize all fields
const cleanData = Sanitizer.sanitizeFormData(
    rawFormData,
    ['subject', 'description'], // Plain text fields
    ['notes'] // Allow limited HTML (bold, italic)
);

// Now safe to save
window.state.complaints.push(cleanData);
```

---

## Using Validator (Form Validation)

### 1. Basic Field Validation

```javascript
// Validate single field
const emailResult = Validator.email(emailInput, 'Email Address');
if (!emailResult.valid) {
    alert(emailResult.error); // "Email Address must be a valid email"
}
```

### 2. Form Validation with Rules

```javascript
// Define validation rules
const rules = {
    subject: [
        { rule: 'required', fieldName: 'Subject' },
        { rule: 'length', min: 5, max: 200, fieldName: 'Subject' },
        { rule: 'noHtmlTags', fieldName: 'Subject' }
    ],
    email: [
        { rule: 'required', fieldName: 'Email' },
        { rule: 'email', fieldName: 'Email' }
    ],
    severity: [
        { rule: 'required', fieldName: 'Severity' },
        { rule: 'inList', allowed: ['Low', 'Medium', 'High', 'Critical'] }
    ]
};

// Collect form data
const formData = {
    subject: document.getElementById('complaint-subject').value,
    email: document.getElementById('complaint-email').value,
    severity: document.getElementById('complaint-severity').value
};

// Validate
const result = Validator.validateForm(formData, rules);

if (!result.valid) {
    // Show errors
    for (const [field, error] of Object.entries(result.errors)) {
        console.error(`${field}: ${error}`);
    }
    window.showNotification('Please fix the form errors', 'error');
    return;
}

// Data is valid, proceed...
```

### 3. Validate and Display Errors on Form

```javascript
// Map field names to element IDs
const fieldIds = {
    subject: 'complaint-subject',
    email: 'contact-email',
    severity: 'complaint-severity'
};

// Validate form elements directly
const result = Validator.validateFormElements(fieldIds, rules);

if (!result.valid) {
    // Display errors next to fields
    Validator.displayErrors(result.errors, fieldIds);
    return;
}

// Clear errors and proceed
Validator.clearErrors(fieldIds);

// Sanitize validated data
const cleanData = Sanitizer.sanitizeFormData(result.formData, Object.keys(fieldIds));

// Save to state
window.state.complaints.push(cleanData);
```

### 4. Custom Validators

```javascript
const rules = {
    auditDate: [
        { rule: 'required' },
        { 
            rule: 'custom',
            validator: (value, fieldName) => {
                const date = new Date(value);
                const today = new Date();
                
                if (date < today) {
                    return { valid: false, error: `${fieldName} cannot be in the past` };
                }
                return { valid: true };
            }
        }
    ]
};
```

---

## Migration Checklist

### High Priority Files (XSS Risk):

- [ ] `advanced-modules.js` - Auditor details, complaints display
- [ ] `appeals-complaints-module.js` - ALL form handlers
- [ ] `clients-module.js` - Client details, contacts
- [ ] `execution-module.js` - Findings, observations  
- [ ] `planning-module.js` - Audit plans, teams
- [ ] `reporting-module.js` - Report generation

### For Each File:

1. **Find all `innerHTML` assignments**
   - Search: `innerHTML`
   - Review if user data is being inserted

2. **Replace unsafe patterns**:
   ```javascript
   // ❌ BEFORE
   element.innerHTML = `<div>${userData}</div>`;
   
   // ✅ AFTER
   const div = Sanitizer.createElement('div', userData);
   element.appendChild(div);
   
   // OR
   element.innerHTML = Sanitizer.sanitizeHTML(`<div>${Sanitizer.escapeHTML(userData)}</div>`);
   ```

3. **Add validation to form handlers**:
   ```javascript
   // ❌ BEFORE
   const data = {
       name: document.getElementById('name').value
   };
   state.clients.push(data);
   
   // ✅ AFTER
   const rules = {
       name: [
           { rule: 'required' },
           { rule: 'length', min: 2, max: 100 }
       ]
   };
   
   const result = Validator.validateFormElements(
       { name: 'client-name' },
       rules
   );
   
   if (!result.valid) {
       Validator.displayErrors(result.errors, { name: 'client-name' });
       return;
   }
   
   const cleanData = Sanitizer.sanitizeFormData(result.formData, ['name']);
   state.clients.push(cleanData);
   ```

---

## Common Patterns

### Pattern 1: Table Row Generation

```javascript
// ✅ SAFE
function renderComplaintsTable(complaints) {
    const tbody = document.getElementById('complaints-tbody');
    tbody.innerHTML = ''; // Clear
    
    complaints.forEach(c => {
        const row = document.createElement('tr');
        
        // Use textContent for user data
        const idCell = document.createElement('td');
        idCell.textContent = `CMP-${String(c.id).padStart(3, '0')}`;
        
        const subjectCell = document.createElement('td');
        subjectCell.textContent = c.subject; // Auto-escapes
        
        const statusCell = document.createElement('td');
        statusCell.innerHTML = `<span class="badge">${Sanitizer.escapeHTML(c.status)}</span>`;
        
        row.appendChild(idCell);
        row.appendChild(subjectCell);
        row.appendChild(statusCell);
        tbody.appendChild(row);
    });
}
```

### Pattern 2: Modal Form with Validation

```javascript
function openNewComplaintModal() {
    const fieldIds = {
        source: 'complaint-source',
        subject: 'complaint-subject',
        description: 'complaint-description',
        severity: 'complaint-severity'
    };
    
    const rules = {
        source: [{ rule: 'required' }],
        subject: [
            { rule: 'required' },
            { rule: 'length', min: 10, max: 200 }
        ],
        description: [
            { rule: 'required' },
            { rule: 'length', min: 20, max: 2000 }
        ],
        severity: [
            { rule: 'required' },
            { rule: 'inList', allowed: ['Low', 'Medium', 'High', 'Critical'] }
        ]
    };
    
    document.getElementById('modal-save').onclick = function() {
        // Validate
        const result = Validator.validateFormElements(fieldIds, rules);
        
        if (!result.valid) {
            Validator.displayErrors(result.errors, fieldIds);
            window.showNotification('Please fix form errors', 'error');
            return;
        }
        
        // Sanitize
        const cleanData = Sanitizer.sanitizeFormData(
            result.formData,
            ['source', 'subject', 'description', 'severity']
        );
        
        // Save
        const newComplaint = {
            id: generateId(),
            ...cleanData,
            dateReceived: new Date().toISOString().split('T')[0],
            status: 'New'
        };
        
        window.state.complaints.push(newComplaint);
        window.saveData();
        window.closeModal();
        window.showNotification('Complaint added', 'success');
    };
}
```

### Pattern 3: Search/Filter with User Input

```javascript
function searchClients(query) {
    // Sanitize search query
    const safeQuery = Sanitizer.sanitizeText(query).toLowerCase();
    
    const filtered = window.state.clients.filter(c => 
        c.name.toLowerCase().includes(safeQuery) ||
        c.industry.toLowerCase().includes(safeQuery)
    );
    
    renderClientsList(filtered);
}
```

---

## Testing Checklist

After implementing security:

1. **Test XSS Prevention**:
   - Try entering: `<script>alert('XSS')</script>`
   - Should display as text, not execute

2. **Test Validation**:
   - Try submitting empty required fields
   - Try invalid email formats
   - Try exceeding max length

3. **Test Legitimate Use**:
   - Enter normal text with special chars (`John's Audit`, `Q&A`, etc.)
   - Should work normally

---

## Quick Reference

| Task | Use | Example |
|------|-----|---------|
| Display user text | `textContent` or `Sanitizer.createElement` | `el.textContent = name` |
| Display HTML from user | `Sanitizer.sanitizeHTML()` | `innerHTML = Sanitizer.sanitizeHTML(html)` |
| Escape for template | `Sanitizer.escapeHTML()` | `<td>${Sanitizer.escapeHTML(val)}</td>` |
| Validate form | `Validator.validateForm()` | See Pattern 2 |
| Show validation errors | `Validator.displayErrors()` | See Pattern 2 |
| Sanitize URL | `Sanitizer.sanitizeURL()` | `href = Sanitizer.sanitizeURL(url)` |

---

## Next Steps

1. Review the example implementations in this guide
2. Start with high-risk modules (complaints, auditor details)
3. Use find/replace to locate `innerHTML` usage
4. Apply appropriate patterns from this guide
5. Test thoroughly

**Remember**: Security is not optional. Every user input is potentially malicious until proven safe!
