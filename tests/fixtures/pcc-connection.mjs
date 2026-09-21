// PC CONNECTION, INC. — recertification, 3–5 November 2026.
//
// PROVENANCE (read before trusting any value here)
// ------------------------------------------------
// This is a RECONSTRUCTION, not an export of the live records:
//   CERTIFICATES  verbatim from the CCI registry export (export_auditcb_clients.json,
//                 2026-08-21): numbers 22US9019 / 22US9020 / 22US9021, registration
//                 2022-12-16, current issue 2025-12-16, expiry 2026-12-15, and the
//                 scope wording, which is identical on all three.
//   PLAN FACTS    from the brief: recertification, 3–5 November 2026, Remote, Head
//                 Office (Merrimack, NH), 300 employees, Lead Auditor Muhammad Asim
//                 Khan, 3 auditor-days, recommended window 16 Sep–15 Nov 2026.
//   PROCESSES, DOCUMENTS, AUDITEES  read off the previous checklist and agenda PDFs.
//   FINDINGS      the eight follow-up clauses the previous agenda scheduled (4.1, 4.2,
//                 5.1, 7.5, 9.2, 10, A.8.16, A.8.13). Their IDs, types, dates and
//                 statuses are PLACEHOLDERS standing in for state.ncrs — the live
//                 register was not available. Regenerate from a real state export
//                 (tools/render-pcc-pdfs.mjs --state <file>) before relying on them.
// NOT KNOWN and deliberately left empty: who approved the 3-day duration and when.

export const PLAN_ID = 'plan-pcc-recert-2026';
export const CLIENT_ID = 'bbb2a55b-9c93-4e40-9d51-b63f6c55f30c';

export const STANDARDS = ['ISO/IEC 27001:2022', 'ISO 22301:2019', 'ISO/IEC 20000-1:2018'];

export const CERT_SCOPE = 'This certification encompasses the management of IT services delivered through cloud computing platforms. The certification focuses on securing information and workloads deployed in Amazon Web Services (AWS), Google Cloud Platform (GCP), and Microsoft Azure.';

export const CLIENT = {
    id: CLIENT_ID,
    name: 'PC CONNECTION, INC.',
    country: 'USA',
    address: 'Merrimack, NH, New Hampshire',
    standard: STANDARDS.join(', '),
    employees: '300',
    totalEmployees: 3000, // CCI registry figure for the whole organisation; the audited site holds 300
    sites: [{ name: 'Head Office', address: 'Merrimack, NH, New Hampshire', employees: 300, country: 'USA', city: 'Merrimack', state: 'New Hampshire' }],
    certificates: [
        ['22US9019', 'ISO/IEC 27001:2022'], ['22US9020', 'ISO 22301:2019'], ['22US9021', 'ISO/IEC 20000-1:2018']
    ].map(([certificateNo, standard], i) => ({
        id: `cert-${i + 1}`, certificateNo, standard, status: 'Active',
        initialDate: '2022-12-16', currentIssue: '2025-12-16', expiryDate: '2026-12-15', scope: CERT_SCOPE
    })),
    goodsServices: [
        { name: 'Managed IT Services' }, { name: 'Microsoft Cloud Services (Azure / M365 / CSP)' },
        { name: 'Service Desk Operations' }, { name: 'Information Security Management' },
        { name: 'Business Continuity & Disaster Recovery' }
    ],
    keyProcesses: [
        { name: 'Client Onboarding', category: 'Core' },
        { name: 'Service Desk Operations', category: 'Core' },
        { name: 'Assessment And Design Tools', category: 'Core' },
        { name: 'Incident Management', category: 'Core' },
        { name: 'Problem Management', category: 'Core' },
        { name: 'Change Management', category: 'Core' },
        { name: 'Configuration and Change Management', category: 'Core' },
        { name: 'Cloud Services Operations (Azure / M365 / CSP)', category: 'Core' },
        { name: 'Patch & Vulnerability Management', category: 'Core' },
        { name: 'Backup & Recovery Operations', category: 'Core' },
        { name: 'Business Continuity & Disaster Recovery', category: 'Core' },
        { name: 'Performance Monitoring & Reporting', category: 'Core' },
        { name: 'Continual Improvement and Process Optimization', category: 'Management' }
    ],
    contacts: [
        { name: 'Ken Mason', designation: 'Top Management', department: 'Executive Leadership' },
        { name: 'Samantha', designation: 'Process Owner', department: 'Support; Continual Improvement' }
    ],
    // Role holders the previous agenda named where no individual was recorded.
    keyPersonnel: { 'Risk owner': 'Risk Coordinator', 'Business continuity management': 'Service Continuity Manager' }
};

export const AUDITORS = [
    { id: 'aud-mak', name: 'Muhammad Asim Khan', role: 'Lead Auditor', email: 'asim@example.invalid',
      standards: STANDARDS.slice(), country: 'Pakistan' }
];

// [name, docNumber, revision] — as printed on the previous checklist. Standard,
// topic and process are NOT set here: they are derived from number and title,
// as they would be for documents uploaded without hand-entered metadata.
const RAW_DOCS = [
    ['Continual Improvement and Process Optimization SOP', '', 'Rev 8.0'],
    ['AWS MSP-3 Tier Plan', '', ''], ['Azure Managed Services - Plan Details', '', ''],
    ['Configuration and Change Management SOP', '', 'Rev 6.0'], ['Change Management - HAI Group', '', ''],
    ['TK 33730 Request HAI-Group', '', ''],
    ['ITSMS Objectives Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-008', ''],
    ['Risk Assessment Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-002', ''],
    ['Risk Management Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-006', ''],
    ['Migration Risk Assessment Process', '', 'Rev 5.0'],
    ['Supplier Management Procedure for ISO 27001', 'ISMS-PRD-009', '', '8.4, A.5.19'],
    ['Internal Audit Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-009', ''],
    ['2021 MSP- Azure Report (CNXN Internal Audit)', '', ''], ['2022 MSP- Azure Report (CNXN Internal Audit)', '', ''],
    ['Management Review Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-007', ''],
    ['Meeting Mins - UNGERBOECK', '', 'Rev 1'], ['Meeting Minutes MSP Report Review Call (October 2023)', '', ''],
    ['TK-30796', '', ''], ['TK-30953', '', ''], ['TK-30981', '', ''],
    ['Context of the Organization Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-013', ''],
    ['Interested Parties Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-010', ''],
    ['Identification of Interested Parties Procedure for ISO 22301 (Business Continuity Management)', 'BCMP-007', ''],
    ['Master SOP Template 1', '', 'Rev 0.1'],
    ['Access Control Procedure for ISO 27001', 'ISMS-PRD-001', ''],
    ['Risk Assessment Procedure for ISO 27001', 'ISMS-PRD-007', ''],
    ['Cloud Managed Services Policy Template', '', 'Rev 4.0'], ['Information Security Policies Manual', '', 'Rev 5.0'],
    ['Document Control Policy for ISO 22301 (Business Continuity Management)', 'BCMP-015', ''],
    ['Competence Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-014', ''],
    ['Personnel Training SOP', '', 'Rev 7.0'],
    ['Training and Development Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-003', ''],
    ['Training and Development Procedure for ISO 22301 (Business Continuity Management)', 'BCMP-014', ''],
    ['Awareness Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-015', ''],
    ['Awareness Sessions for PC Connection, Inc', 'ITSM-SES-001', ''],
    ['Business Continuity Awareness Procedure for ISO 22301 (Business Continuity Management)', 'BCMP-001', ''],
    ['Communication Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-014', ''],
    ['Document Control Procedure for ISO 20000-1 (IT Service Management)', 'ITSM-PRC-001', ''],
    ['Document Control Procedure for ISO 22301 (Business Continuity Management)', 'BCMP-004', ''],
    ['Assessment And Design Tools SOP', '', 'Rev 5.0'],
    ['Incident Management Process SOP', '', 'Rev 7.0'], ['Security Incident Response Process', '', 'Rev 7.0'],
    ['Security Incident Report StoneAge', '', '']
];

export const DOCS = RAW_DOCS.map(([name, docNumber, revision, linkedClauses], i) => ({
    id: `doc-${i + 1}`, name, docNumber, revision, category: 'Controlled documents',
    // Legacy uploads carry a heuristic clause link and NO standard — the shape
    // that let the old matcher apply a document to every standard.
    linkedClauses: linkedClauses || '', linkedStandards: ''
}));

// Eight findings from previous audits in the cycle. PLACEHOLDERS — see header.
const F = (n, clause, extra) => Object.assign({
    id: `NCR-PCC-${String(n).padStart(2, '0')}`, ncrNumber: `PCC-F${n}`, clientId: CLIENT_ID, client: 'PC CONNECTION, INC.',
    auditId: 'plan-pcc-s2-2025', clause, type: 'minor', severity: 'minor', status: 'Open',
    description: `Previous finding against clause ${clause}`
}, extra || {});

export const NCRS = [
    F(1, '4.1'), F(2, '4.2'), F(3, '5.1'), F(4, '7.5'), F(5, '9.2'), F(6, '10'),
    F(7, 'A.8.16', { standards: ['ISO/IEC 27001:2022'] }),
    F(8, 'A.8.13', { standards: ['ISO/IEC 27001:2022'] })
];

export const PRIOR_PLAN = { id: 'plan-pcc-s2-2025', client: 'PC CONNECTION, INC.', clientId: CLIENT_ID, standard: STANDARDS.join(', '),
    type: 'Surveillance 2', date: '2025-11-18', status: 'Completed' };

export const PLAN_BASE = {
    id: PLAN_ID, client: 'PC CONNECTION, INC.', clientId: CLIENT_ID, standard: STANDARDS.join(', '),
    type: 'Recertification', auditType: 'Recertification', auditMethod: 'Remote',
    date: '2026-11-03', endDate: '2026-11-05',
    team: ['Muhammad Asim Khan'], auditorIds: ['aud-mak'],
    selectedSites: [{ name: 'Head Office' }],
    manDays: 3, onsiteDays: 0,
    certificationCycle: {
        stage: 'Recertification', auditType: 'Recertification', standards: STANDARDS.slice(),
        recommendedWindowStart: '2026-09-16', recommendedWindowEnd: '2026-11-15', certificateExpiry: '2026-12-15',
        certificateIds: ['cert-1', 'cert-2', 'cert-3']
    },
    durationCalculation: {
        employees: 300, sites: 1, riskLevel: 'Medium', basis: 'Audit360 default v1 — Recertification band 251–500 employees',
        baselineDays: 3, imsAdjustmentPercent: 0, remoteDays: 3, onsiteDays: 0, justifiedAdjustment: 0, justification: '',
        methodologyVersion: 'Audit360 default v1', imsRuleVersion: 'Audit360 default v1', finalDays: 3,
        approvedBy: null, approvedAt: null
    },
    impartialityAssessment: { risk: 'None', notes: '' },
    // Exactly what the previous plan stored, so the scope check has a real comparison.
    scope: CERT_SCOPE
};
