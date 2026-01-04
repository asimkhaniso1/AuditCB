# Phase 3: Enhanced User Management & Security

## 1. Overview
This phase focuses on implementing robust user management, access control, and enhanced audit planning capabilities.

## 2. Key Objectives
- **User Management**: Create/Edit/Delete users with secure credential handling.
- **RBAC Refinement**: Granular control over "who can do what".
- **Multi-Site Sampling**: Logic for determining sample sizes (IAF MD 1 compliance).
- **Security**: Strengthened authentication and session checks.

## 3. Implementation Plan

### 3.1 User Management (High Priority)
- **Module**: `settings-module.js` (User Tab)
- **Status**: ✅ COMPLETE
- **Features**:
    - "Users" sub-tab in Settings > Organization.
    - User list view (Avatar, Name, Role, Email, Status).
    - Add/Edit User Modal.
    - Status toggle (Active/Inactive).
    - Password reset functionality (mock/Supabase).
- **Supabase Integration**: 
    - Sync with `auth.users` and `public.profiles`.

### 3.2 Role-Based Access Control
- **Module**: `auth-manager.js`, `script.js`
- **Status**: ✅ COMPLETE
- **Features**:
    - `canPerform(action, resource)` granular permission check.
    - Role-based permission matrix (Admin, Cert Manager, Lead Auditor, Auditor, Technical Expert).
    - UI gates for user management (Add, Edit, Status Toggle).

### 3.3 Multi-Site Sampling Calculator
- **Module**: `planning-module.js`
- **Status**: ✅ COMPLETE
- **Features**:
    - Input: Total Sites, Risk Level (High/Medium/Low).
    - Logic: `y = K * sqrt(n)` where K is multiplier per IAF MD 1.
    - Output: Number of sites to sample.


### 3.4 Security Hardening
- **Module**: `auth-manager.js`
- **Status**: ✅ COMPLETE
- **Features**:
    - Session timeout warning (5 min before expiry).
    - "Stay Logged In" modal prompt to extend session.
    - Activity-based session extension reset.

### 3.5 Checklist Editor Enhancement
- **Module**: `checklist-module.js`
- **Status**: ✅ COMPLETE
- **Features**:
    - Full-page editor for creating/editing checklists (removed modal).
    - Improved scrollable items table with sticky headers.
    - CSV import functionality preserved.

## 4. Completed Actions
1.  ✅ User Management UI in Settings > Organization > Users
2.  ✅ Granular RBAC with `canPerform(action, resource)`
3.  ✅ Multi-Site Sampling Calculator (IAF MD 1)
4.  ✅ Session Timeout Warning Modal
5.  ✅ Full-page Checklist Editor (no modal)

## 5. Next Phase Considerations
- Password reset functionality (Supabase Auth integration)
- Supabase sync for users table
- Two-Factor Authentication (future)

