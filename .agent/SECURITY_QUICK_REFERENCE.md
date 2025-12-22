# Security Quick Reference Card

## 🚨 REMEMBER: Never trust user input!

---

## Quick Decision Tree

```
User data to display?
├─ Yes → Is it plain text?
│  ├─ Yes → Use textContent or Sanitizer.createElement()
│  └─ No (has formatting) → Use Sanitizer.sanitizeHTML()
└─ No (static content) → innerHTML is OK
```

---

## Most Common Patterns

### ✅ Pattern 1: Display User Text
```javascript
// SAFE
element.textContent = userData;

// OR
const el = Sanitizer.createElement('div', userData);
parent.appendChild(el);
```

### ✅ Pattern 2: Build Table Row
```javascript
const row = document.createElement('tr');

const cell1 = document.createElement('td');
cell1.textContent = client.name; // SAFE

const cell2 = document.createElement('td');
cell2.textContent = client.email; // SAFE

row.appendChild(cell1);
row.appendChild(cell2);
tbody.appendChild(row);
```

### ✅ Pattern 3: Validate Form Before Save
```javascript
const rules = {
    name: [
        { rule: 'required' },
        { rule: 'length', min: 2, max: 100 }
    ],
    email: [
        { rule: 'required' },
        { rule: 'email' }
    ]
};

const result = Validator.validateFormElements(fieldIds, rules);
if (!result.valid) {
    Validator.displayErrors(result.errors, fieldIds);
    return;
}

const cleanData = Sanitizer.sanitizeFormData(result.formData, fields);
// Now safe to use cleanData
```

---

## ❌ Dangerous Patterns (AVOID!)

```javascript
// ❌ NEVER DO THIS
element.innerHTML = userInput;

// ❌ NEVER DO THIS
element.innerHTML = `<div>${userData}</div>`;

// ❌ NEVER DO THIS
container.insertAdjacentHTML('beforeend', userHTML);
```

---

## Validation Rules Cheat Sheet

| Rule | Example | Use For |
|------|---------|---------|
| `required` | `{ rule: 'required' }` | Any mandatory field |
| `email` | `{ rule: 'email' }` | Email addresses |
| `phone` | `{ rule: 'phone' }` | Phone numbers |
| `url` | `{ rule: 'url' }` | Website URLs |
| `date` | `{ rule: 'date' }` | Date in YYYY-MM-DD |
| `length` | `{ rule: 'length', min: 5, max: 100 }` | Text length |
| `number` | `{ rule: 'number' }` | Numeric values |
| `range` | `{ rule: 'range', min: 1, max: 5 }` | Number in range |
| `inList` | `{ rule: 'inList', allowed: ['A','B'] }` | Dropdown values |
| `noHtmlTags` | `{ rule: 'noHtmlTags' }` | Prevent HTML injection |

---

## When to Use What

| Task | Use | Example |
|------|-----|---------|
| Show user's name | `textContent` | `el.textContent = user.name` |
| Show formatted text | `Sanitizer.sanitizeHTML()` | `el.innerHTML = Sanitizer.sanitizeHTML(desc)` |
| Create element with text | `Sanitizer.createElement()` | `Sanitizer.createElement('span', text)` |
| Validate email | `Validator.email()` | `Validator.email(input, 'Email')` |
| Validate entire form | `Validator.validateForm()` | See Pattern 3 |
| Sanitize form data | `Sanitizer.sanitizeFormData()` | See Pattern 3 |
| Escape for template | `Sanitizer.escapeHTML()` | `<td>${Sanitizer.escapeHTML(val)}</td>` |

---

## Testing Your Changes

### Test XSS Prevention:
Enter this in a text field:
```
<script>alert('XSS')</script>
```
**Expected:** Shows as text, doesn't pop alert

### Test Validation:
1. Leave required field empty → Should show error
2. Enter invalid email → Should show error  
3. Enter text too short → Should show error

---

## Common Mistakes

### ❌ Mistake 1: Forgetting to sanitize before innerHTML
```javascript
// WRONG
element.innerHTML = `<div>${userData}</div>`;

// RIGHT
element.innerHTML = `<div>${Sanitizer.escapeHTML(userData)}</div>`;
```

### ❌ Mistake 2: Not validating before saving
```javascript
// WRONG
state.clients.push({
    name: document.getElementById('name').value
});

// RIGHT
const result = Validator.validateFormElements(...);
if (!result.valid) return;
const cleanData = Sanitizer.sanitizeFormData(...);
state.clients.push(cleanData);
```

### ❌ Mistake 3: Using innerHTML for user content
```javascript
// WRONG
div.innerHTML = userName;

// RIGHT
div.textContent = userName;
```

---

## Quick Checklist Before Saving Form

- [ ] Defined validation rules
- [ ] Called `Validator.validateFormElements()`
- [ ] Checked `!result.valid` and displayed errors
- [ ] Called `Sanitizer.sanitizeFormData()`
- [ ] Using `cleanData` not raw input

---

## Need Help?

1. Check: `.agent/SECURITY_IMPLEMENTATION_GUIDE.md`
2. Check: Example in `appeals-complaints-module.js` (line 401+)
3. Check: This quick reference
4. Ask the agent!

---

**Remember: When in doubt, use `textContent` instead of `innerHTML`!** ✅
