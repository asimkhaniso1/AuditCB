# AuditCB-360 — Product Specification

**Document Version:** 1.0  
**Date:** 2026-04-11  
**Status:** Current  

---

## 1. Product Overview

### 1.1 Product Name
**AuditCB-360** (Audit360)

### 1.2 Product Summary
AuditCB-360 is a comprehensive ISO Certification Body Management System designed for Conformity Assessment Bodies (CBs) operating under ISO/IEC 17021-1:2015. The platform manages the complete audit lifecycle — from client onboarding and audit planning through execution, reporting, certification decisions, and governance compliance.

### 1.3 Target Users
- ISO Certification Bodies (CBs)
- Accredited audit organizations
- Quality management consultancies managing multi-standard audit programs

### 1.4 Problem Statement
Certification Bodies managing multiple clients across ISO standards (9001, 14001, 27001, 45001) face fragmented workflows — audit planning in spreadsheets, reports in Word documents, certificates tracked manually, and governance records scattered across systems. This leads to compliance gaps, scheduling conflicts, missed surveillance cycles, and audit trail failures during accreditation body assessments.

### 1.5 Solution
AuditCB-360 unifies the entire CB operation into a single web application with AI-assisted audit analysis, ISO 17021-1 compliant man-day calculations, real-time execution tracking, automated report generation, and built-in governance modules — all secured with role-based access and enterprise-grade security controls.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript (ES6+), Single Page Application |
| **UI/Styling** | Custom CSS3 (Glassmorphism design), Inter font |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Authentication** | Supabase Auth (Email/Password) |
| **File Storage** | Supabase Storage Buckets |
| **AI Engine** | Google Gemini API (gemini-2.0-flash) |
| **Email** | Nodemailer (SMTP) |
| **PDF Generation** | html2pdf.js, pdf-lib |
| **Charts** | Chart.js |
| **Error Monitoring** | Sentry |
| **Hosting** | Vercel (Serverless Functions) |
| **Build** | Node.js + Terser (minification) |

---

## 3. User Roles & Permissions

| Role | Access Level | Data Visibility |
|------|-------------|----------------|
| **Admin** | Full system access, user management, all settings | All data |
| **Certification Manager** | Client/Plan/Report CRUD, auditor assignments, certificate decisions | All data |
| **Lead Auditor** | Execute audits, create reports, manage assigned clients | Assigned clients only |
| **Auditor** | Execute audits, view assigned clients, read-only reports | Assigned clients only |
| **Technical Expert** | Audit execution participation, technical consultation | Assigned clients only |
| **Client** | View own certification status and audit history | Own organization only |

Permission enforcement occurs at two layers:
- **Database layer**: Supabase Row-Level Security (RLS) policies
- **Application layer**: UI visibility controls and API-level checks

---

## 4. Functional Modules

### 4.1 Dashboard
- Real-time KPI cards (active clients, pending audits, NCR counts, certificate status)
- Compliance trend charts (line, bar, doughnut via Chart.js)
- NCR distribution analysis (Major vs Minor over time)
- Auditor workload visualization
- Recent activity feed
- Certificate expiry alerts (90-day warning threshold)
- Industry distribution breakdown

### 4.2 Client Management
- Full CRUD for client organizations
- Multi-site management with site-level details (address, employee count, shift patterns)
- Contact directory per client (name, email, designation, department)
- Departmental structure and designation tracking
- Goods & services catalog
- Key processes documentation
- Client profile and organization overview
- Certification cycle tracking (initial, surveillance, recertification)
- Bulk import/export (CSV/Excel)
- Logo upload and branding

### 4.3 Auditor Management
- Auditor profiles with qualifications and competence records
- Role classification: Lead Auditor, Auditor, Technical Expert
- Competence matrix per ISO standard
- Standard-specific qualification tracking (ISO 9001, 14001, 27001, 45001)
- Availability and workload management
- Assignment history

### 4.4 Audit Planning
- Audit plan creation with type selection (Stage 1, Stage 2, Surveillance, Recertification, Special)
- ISO 17021-1:2015 Annex A man-day calculator
- Multi-site sampling calculation per IAF MD 1
- Audit team assignment with competence validation
- Scope, objectives, criteria, and methodology definition
- Opening/closing meeting scheduling
- Timeline and calendar view
- Status tracking (Draft, Approved, In Progress, Completed)

### 4.5 Checklist Library
- Reusable checklist templates per ISO standard
- Clause-based requirement items (e.g., ISO 9001 Clause 4.1, 5.1, 6.1)
- Per-item fields: requirement text, guidance notes, status (Conform/NC/N/A)
- Checklist editor with add/edit/delete items
- Standard-specific libraries: ISO 9001:2015, ISO 14001:2015, ISO 27001:2022, ISO 45001:2018

### 4.6 Audit Execution
- Real-time checklist execution with progress ring (SVG)
- Status marking: Conform, Non-Conformity, Not Applicable
- Keyboard shortcuts for rapid execution (C=Conform, N=NC, A=N/A, Ctrl+S=Save)
- Filter by status (Pending, Conform, NC, N/A)
- Evidence capture with multimedia support (images, documents)
- Finding classification (Major NCR, Minor NCR, Observation, Opportunity for Improvement)
- AI-powered analysis: auto-generate conclusions, classify findings, summarize compliance gaps
- Real-time progress dashboard
- Notes and comments per checklist item

### 4.7 Report Generation
- Multi-section audit reports (17+ sections)
- Dynamic cover page with CB and client logos
- Executive summary with AI-powered conclusions
- Finding details with clause references and evidence
- Previous findings status tracking
- Distribution list management
- Annexures and supporting documents
- Revision history
- PDF export with professional formatting
- Report status lifecycle: Draft → Review → Finalized

### 4.8 Certification Management
- Certificate lifecycle: Valid, Suspended, Withdrawn, Expired
- Certificate number generation
- Issue date and expiry date tracking
- Certificate renewal workflows
- Public certificate directory
- Expiry monitoring with automated alerts
- Certificate history per client

### 4.9 NCR & CAPA Tracking
- Non-Conformity Report (NCR) register
- Classification: Major / Minor
- Root cause analysis fields
- Corrective Action Plan (CAPA) tracking
- Target dates and follow-up verification
- Status workflow: Open → In Progress → Verified → Closed
- Linkage to audit findings and checklist items

### 4.10 Governance Modules

#### 4.10.1 Appeals & Complaints
- Register for client grievances per ISO 17021-1 Clause 8.3
- Investigation workflow and timeline tracking
- Resolution documentation
- Trend analysis

#### 4.10.2 Impartiality Committee
- Committee membership management per ISO 17021-1 Clause 8.2
- Conflict-of-interest assessment
- Meeting records and decisions

#### 4.10.3 Management Review
- Meeting agendas and topic tracking
- Decision recording
- Follow-up action items
- Next review scheduling

#### 4.10.4 Record Retention
- Document lifecycle management
- Retention period tracking
- Archival workflows

### 4.11 Knowledge Base
- Standards reference library
- Requirements mapping per ISO standard
- Guidance documents and best practices
- Configurable content management (via Settings)

### 4.12 Client Workspace
- Client-specific audit context view
- Organization setup (departments, designations, contacts)
- Sites & locations management
- Goods & services catalog
- Key processes documentation
- Audit history timeline

### 4.13 Settings & Administration
- User account management (create, edit, deactivate)
- Role assignment and permission configuration
- System defaults (default standard, audit types, notification preferences)
- Knowledge base content configuration
- API usage tracking and token monitoring
- Branding and logo configuration

---

## 5. AI Integration (Gemini)

### 5.1 Architecture
- Serverless proxy at `/api/gemini.js` (Vercel)
- Model: `gemini-2.0-flash` with fallback to `gemini-1.5-pro`
- CORS-secured, server-side API key management

### 5.2 AI-Powered Features
| Feature | Description |
|---------|-------------|
| Audit Conclusion Generation | Auto-generates executive summaries from checklist data and findings |
| Finding Classification | Suggests Major/Minor classification based on finding descriptions |
| Personnel Recommendation | Recommends auditor assignment based on competence and availability |
| Compliance Gap Summarization | Summarizes non-conformities into actionable compliance gap reports |
| Polish Notes | Reformats raw auditor notes into professional audit language |

### 5.3 Usage Tracking
- Token consumption monitoring per request
- Cost estimation dashboard
- Rate limiting and quota management

---

## 6. Data Model

### 6.1 Core Entities

**Client**
- Identity: name, industry, standard, status, employee count
- Structure: sites (JSONB), contacts (JSONB), departments, designations
- Operations: goods/services, key processes
- Assets: logo URL, profile description

**Audit Plan**
- Scope: client reference, standard, audit type, methodology
- Schedule: start/end dates, man-days calculation
- Team: lead auditor, team member IDs, competence validation
- Meetings: opening/closing meeting details

**Audit Report**
- Linkage: plan reference, client, audit date
- Content: executive summary, conclusion, recommendation
- Metrics: major/minor NCR counts, observation counts
- Progress: checklist completion data (JSONB)
- Attachments: evidence files, supporting documents

**Audit Finding**
- Classification: type (Major NCR, Minor NCR, OFI), clause reference
- Content: description, evidence, auditor notes
- Resolution: corrective action, target date, verification status

**Certification**
- Identity: certificate number, client reference
- Lifecycle: issue date, expiry date, status (Valid/Suspended/Withdrawn)

**Profile (User)**
- Identity: email, role, status
- Competence: qualifications, standards expertise
- Assets: avatar URL

### 6.2 Supporting Entities
- `audit_log` — System audit trail (action, entity, user, timestamp)
- `notifications` — User notifications (message, type, read status)
- `settings` — Key-value system configuration (JSONB values)
- `checklists` — Reusable checklist templates (items as JSONB)
- `appeals_complaints` — Grievance register
- `management_review` — Review meeting records
- `auditor_assignments` — Team assignment junction table

### 6.3 Data Integrity
- Row-Level Security (RLS) on all tables
- Foreign key constraints for referential integrity
- UUID primary keys for sensitive records
- JSONB for flexible nested structures (sites, contacts, checklist items)

---

## 7. Security Architecture

### 7.1 Authentication
- Supabase Auth with email/password
- Login rate limiting: 5 attempts, 15-minute lockout
- Session timeout: 8 hours
- Password policy: 8+ characters, uppercase, number, special character

### 7.2 Transport Security
- HTTPS enforcement via HSTS (max-age: 31536000)
- CORS origin validation on API endpoints

### 7.3 Application Security
- **Content Security Policy (CSP)**: Strict whitelist for scripts, styles, fonts, images
- **Subresource Integrity (SRI)**: Hash verification for all CDN-loaded scripts
- **XSS Prevention**: DOMPurify sanitization, SafeDOM helper utilities
- **SQL Injection Prevention**: Parameterized queries via Supabase client
- **No Inline Scripts**: All JavaScript via external files (CSP-compliant)
- **X-Frame-Options**: Clickjacking protection

### 7.4 Data Security
- Row-Level Security (RLS) policies on all database tables
- Role-based data visibility enforcement
- Audit trail logging for all data mutations
- Environment variable management for secrets (never client-side)

---

## 8. ISO 17021-1 Compliance Features

| ISO 17021-1 Requirement | Implementation |
|--------------------------|---------------|
| **Clause 7.1.2** — Audit time (man-days) | Man-day calculator per Annex A with employee count, shifts, sites |
| **Clause 7.2** — Audit team competence | Competence matrix validation before team assignment |
| **Clause 8.2** — Impartiality | Impartiality Committee module with conflict-of-interest assessment |
| **Clause 8.3** — Appeals & Complaints | Dedicated register with investigation and resolution workflow |
| **Clause 9.1** — Audit planning | Full planning module with scope, objectives, criteria, methodology |
| **Clause 9.3** — Audit execution | Real-time checklist execution with evidence capture |
| **Clause 9.4** — Audit reporting | Multi-section report generation with PDF export |
| **Clause 9.5** — Certification decision | Certificate lifecycle management with status tracking |
| **Clause 9.6** — Surveillance | Surveillance audit type with recurring cycle tracking |
| **IAF MD 1** — Multi-site sampling | Sampling calculation for multi-site organizations |

---

## 9. Deployment & Infrastructure

### 9.1 Architecture
```
GitHub Repository
    │
    ▼
Vercel (CI/CD + Hosting)
    ├── Static Frontend (index.html + 40 JS modules + CSS)
    │     └── CDN: Cloudflare, JSDelivr (libraries)
    │     └── Fonts: Google Fonts (Inter)
    │
    ├── Serverless APIs (Node.js 20.x)
    │     ├── /api/gemini.js (AI proxy)
    │     └── /api/send-email.js (email delivery)
    │
    └── Database: Supabase Cloud
          ├── PostgreSQL (data)
          ├── Auth (authentication)
          └── Storage (files/documents)
```

### 9.2 Environment Variables
| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_ANON_KEY` | Supabase anonymous API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `SENTRY_DSN` | Sentry error monitoring (optional) |

### 9.3 Build & Deploy
```bash
npm run build    # Minify JS via Terser → dist/
npm start        # Local dev server (http-server :8080)
npm test         # Run Vitest suite
vercel deploy    # Deploy to Vercel
```

### 9.4 Caching Strategy
- **HTML**: `no-cache` (always fresh)
- **JS/CSS**: `public, max-age=31536000, immutable` (1-year cache, versioned)
- **API responses**: In-memory cache via `api-cache.js` module
- **Client-side**: IndexedDB persistence via `idb-state-store.js`

---

## 10. Performance Characteristics

| Metric | Target |
|--------|--------|
| Initial load | ~2-3 seconds (including Supabase sync) |
| Module render | < 500ms per page transition |
| Database queries | < 100ms (RLS-optimized) |
| PDF generation | < 5 seconds for full audit report |

### Optimization Techniques
- Lazy loading for images and deferred scripts
- IndexedDB caching for offline-capable state
- API response caching layer
- Modular architecture enabling selective module loading
- CDN delivery for third-party libraries
- Terser minification for production builds

---

## 11. Monitoring & Observability

| System | Purpose |
|--------|---------|
| **Sentry** | Real-time error tracking and crash reporting |
| **Cloudflare Insights** | Anonymous usage analytics |
| **Audit Logger** | Internal system action logging to `audit_log` table |
| **API Usage Tracker** | Gemini API token consumption and cost monitoring |
| **Browser Console** | Debug-level logging via `Logger.js` |

---

## 12. Export & Integration Capabilities

### 12.1 Export Formats
- **PDF**: Audit reports, certificates, executive summaries
- **CSV/Excel**: Client lists, finding registers, audit schedules
- **QR Codes**: Audit deliverable verification codes

### 12.2 Email Integration
- Audit invitation notifications
- Report distribution
- Certificate issuance notifications
- System alerts

---

## 13. Codebase Statistics

| Metric | Value |
|--------|-------|
| Total lines of code | ~52,900 |
| JavaScript modules | 40+ |
| SQL migration files | 90+ |
| Serverless API functions | 2 |
| Supported ISO standards | 4 (9001, 14001, 27001, 45001) |
| User roles | 6 |
| Database tables | 14+ |

---

## 14. Future Roadmap

| Feature | Description |
|---------|-------------|
| Real-time Collaboration | WebSocket support for multi-user simultaneous editing |
| Offline Mode | Service Worker with background sync for field audits |
| Advanced Analytics | Predictive compliance trends and benchmarking |
| Custom Report Templates | User-configurable report layouts |
| Mobile Application | Native mobile app for on-site audit execution |
| Internationalization (i18n) | Multi-language support |
| Dark Mode | Theme toggle (CSS variable infrastructure in place) |
| Third-Party API | RESTful API for integration with external CB systems |
| Batch Processing | Bulk certificate renewal and report generation |
| Audit Trail Export | Exportable audit log reports for accreditation reviews |

---

*This document describes AuditCB-360 as of April 2026. Refer to the repository's CHANGELOG.md for version-specific updates.*
