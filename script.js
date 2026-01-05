// ============================================
// AUDITCB360 - MAIN APPLICATION SCRIPT
// ============================================

const DATA_VERSION = '1.3'; // Increment to force state reset

// Application State
const state = {
    version: DATA_VERSION,
    // Current User Context (For Demo Roles)
    currentUser: {
        name: 'Demo User',
        role: 'Lead Auditor'
    },
    currentModule: 'dashboard',
    clients: [
        {
            id: 1,
            name: 'Tech Solutions Ltd',
            standard: 'ISO 9001:2015',
            status: 'Active',
            type: 'external', // external = regular client, internal = CB self-audit
            nextAudit: '2024-03-15',
            website: 'https://techsolutions.com',
            contacts: [
                { name: 'Alice Whitman', designation: 'Quality Manager', phone: '+1-555-0101', email: 'alice@techsolutions.com' },
                { name: 'David Chen', designation: 'CEO', phone: '+1-555-0110', email: 'david@techsolutions.com' }
            ],
            sites: [
                { name: 'Head Office', address: '123 Tech Park', city: 'Silicon Valley', country: 'USA', geotag: '37.3382, -121.8863', employees: 100, shift: 'No' },
                { name: 'R&D Center', address: '456 Innovation Blvd', city: 'San Francisco', country: 'USA', geotag: '37.7749, -122.4194', employees: 50, shift: 'No' }
            ],
            employees: 150,
            shifts: 'No',
            industry: 'IT'
        },
        {
            id: 2,
            name: 'Global Manufacturing',
            standard: 'ISO 14001:2015',
            status: 'Active',
            type: 'external',
            nextAudit: '2024-04-20',
            website: 'https://globalmfg.com',
            contacts: [
                { name: 'Bob Builder', designation: 'Plant Manager', phone: '+1-555-0102', email: 'bob@globalmfg.com' }
            ],
            sites: [
                { name: 'Main Plant', address: '456 Industrial Way', city: 'Detroit', country: 'USA', geotag: '42.3314, -83.0458', employees: 350, shift: 'Yes' },
                { name: 'Warehouse', address: '789 Storage Blvd', city: 'Detroit', country: 'USA', geotag: '42.3500, -83.0600', employees: 150, shift: 'Yes' }
            ],
            employees: 500,
            shifts: 'Yes',
            industry: 'Manufacturing'
        },
        {
            id: 3,
            name: 'SecureData Corp',
            standard: 'ISO 27001:2022',
            status: 'Suspended',
            type: 'external',
            nextAudit: '2024-05-10',
            website: 'https://securedata.com',
            contacts: [
                { name: 'Charlie Root', designation: 'CISO', phone: '+1-555-0103', email: 'croot@securedata.com' },
                { name: 'Sarah Admin', designation: 'IT Manager', phone: '+1-555-0104', email: 'sadmin@securedata.com' }
            ],
            sites: [
                { name: 'HQ', address: '789 Cyber Lane', city: 'Austin', country: 'USA', geotag: '30.2672, -97.7431', employees: 30, shift: 'No' },
                { name: 'Data Center', address: '101 Server Road', city: 'Dallas', country: 'USA', geotag: '32.7767, -96.7970', employees: 20, shift: 'Yes' }
            ],
            employees: 50,
            shifts: 'No',
            industry: 'Financial Services'
        },
        {
            id: 999,
            name: 'AuditCB360 - Internal Operations',
            standard: 'ISO 17021-1:2015',
            status: 'Active',
            type: 'internal', // Internal client for CB self-audits (ISO 17021 Clause 8.6)
            nextAudit: '2024-06-15',
            website: '',
            contacts: [
                { name: 'Quality Manager', designation: 'Quality Manager', phone: '', email: 'quality@companycertification.com' }
            ],
            sites: [
                { name: 'Head Office', address: 'CB Headquarters', city: '', country: '', geotag: '', employees: 10, shift: 'No' }
            ],
            employees: 10,
            shifts: 'No',
            industry: 'Certification Body',
            internalAuditScopes: [
                'Certification Decision Process (7.6)',
                'Auditor Competence Management (6.1)',
                'Impartiality Management (5.2)',
                'Appeals & Complaints (9.10, 9.11)',
                'Document Control (8.3)',
                'Record Retention (8.4)',
                'Management Review (8.5)'
            ]
        }
    ],
    auditors: [
        {
            id: 1,
            name: 'John Smith',
            role: 'Lead Auditor',
            standards: ['ISO 9001', 'ISO 14001'],
            experience: 12,
            domainExpertise: ['Quality Management', 'Environmental Management'],
            industries: ['Manufacturing', 'Automotive'],
            age: 45,
            manDayRate: 800,
            email: 'john.smith@auditors.com',
            phone: '+1-555-1001',
            location: 'New York, USA',
            auditHistory: [
                { client: 'Tech Solutions Ltd', date: '2024-01-15', type: 'Surveillance' },
                { client: 'Global Manufacturing', date: '2023-11-10', type: 'Stage 2' }
            ],
            education: { degree: 'Master', fieldOfStudy: 'Industrial Engineering', specialization: 'Six Sigma Black Belt, ISO Lead Auditor' },
            hasPassport: true,
            willingToTravel: 'international',
            languages: ['English', 'Spanish'],
            pictureUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
            customerRating: 5,
            dateJoined: '2018-03-15',
            softSkills: { communication: 'excellent', reportWriting: 'excellent', analyticalSkills: 'excellent', attentionToDetail: 'good', interviewingSkills: 'excellent', timeManagement: 'good' },
            evaluations: {
                witnessAudits: [
                    { date: '2024-06-15', client: 'Tech Solutions Ltd', standard: 'ISO 9001', witnessedBy: 'Quality Manager', rating: 5, notes: 'Excellent audit technique and client rapport.' },
                    { date: '2023-03-20', client: 'Global Manufacturing', standard: 'ISO 14001', witnessedBy: 'Technical Director', rating: 4, notes: 'Good coverage of environmental aspects.' }
                ],
                performanceReviews: [
                    { date: '2024-09-01', type: 'Annual Review', rating: 5, reviewedBy: 'Certification Manager', outcome: 'Approved', notes: 'Outstanding performance. Recommended for lead auditor on complex audits.' },
                    { date: '2023-09-01', type: 'Annual Review', rating: 4, reviewedBy: 'Certification Manager', outcome: 'Approved', notes: 'Strong performance. Minor improvement in time management suggested.' }
                ],
                reportReviews: [
                    { reviewDate: '2024-11-10', reportType: 'Stage 2', client: 'Tech Solutions Ltd', reviewer: 'Quality Manager', qualityRating: 5, completenessRating: 5, technicalRating: 4, notes: 'Well-structured report with clear findings.' }
                ],
                linkedComplaints: [
                    { complaintId: 1, date: '2024-03-25', type: 'Auditor Conduct', severity: 'Low', subject: 'Auditor scheduling concern', status: 'Closed' }
                ],
                nextWitnessAuditDue: '2027-06-15',
                firstTimeAuditor: false,
                lastWitnessDate: '2024-06-15'
            }
        },
        {
            id: 2,
            name: 'Sarah Johnson',
            role: 'Auditor',
            standards: ['ISO 27001'],
            experience: 6,
            domainExpertise: ['Information Security', 'IT Governance'],
            industries: ['IT', 'Financial Services'],
            age: 35,
            manDayRate: 600,
            email: 'sarah.j@auditors.com',
            phone: '+1-555-1002',
            location: 'Chicago, USA',
            auditHistory: [
                { client: 'SecureData Corp', date: '2024-02-20', type: 'Stage 1' }
            ],
            education: { degree: 'Master', fieldOfStudy: 'Information Security', specialization: 'CISSP, CISA certified' },
            hasPassport: true,
            willingToTravel: 'regional',
            languages: ['English', 'French'],
            pictureUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
            customerRating: 4,
            dateJoined: '2020-07-01',
            softSkills: { communication: 'good', reportWriting: 'excellent', analyticalSkills: 'excellent', attentionToDetail: 'excellent', interviewingSkills: 'good', timeManagement: 'excellent' },
            evaluations: {
                witnessAudits: [],
                performanceReviews: [
                    { date: '2024-08-15', type: 'Annual Review', rating: 4, reviewedBy: 'Certification Manager', outcome: 'Approved', notes: 'Good performance. Continue development in witness audit scenarios.' }
                ],
                reportReviews: [],
                linkedComplaints: [
                    { complaintId: 2, date: '2024-10-15', type: 'Impartiality', severity: 'Medium', subject: 'Potential conflict of interest concern', status: 'Investigation' },
                    { complaintId: 3, date: '2024-12-01', type: 'Service Quality', severity: 'High', subject: 'Audit report quality issue', status: 'Investigation' }
                ],
                firstTimeAuditor: true
            }
        },
        {
            id: 3,
            name: 'Mike Chen',
            role: 'Technical Expert',
            standards: ['ISO 45001'],
            experience: 8,
            domainExpertise: ['Occupational Health', 'Safety Systems'],
            industries: ['Construction', 'Oil & Gas'],
            age: 40,
            manDayRate: 700,
            email: 'mike.chen@auditors.com',
            phone: '+1-555-1003',
            location: 'Houston, USA',
            auditHistory: [],
            education: { degree: 'Bachelor', fieldOfStudy: 'Safety Engineering', specialization: 'NEBOSH certified' },
            hasPassport: true,
            willingToTravel: 'international',
            languages: ['English', 'Mandarin', 'Cantonese'],
            pictureUrl: 'https://randomuser.me/api/portraits/men/3.jpg',
            customerRating: 4,
            dateJoined: '2019-11-20',
            softSkills: { communication: 'good', reportWriting: 'good', analyticalSkills: 'excellent', attentionToDetail: 'excellent', interviewingSkills: 'average', timeManagement: 'good' }
        }
    ],
    auditPrograms: [
        {
            id: 1,
            client: 'Tech Solutions Ltd',
            standard: 'ISO 9001:2015',
            type: 'Certification',
            cycleStart: '2023-03-15',
            cycleEnd: '2026-03-14',
            status: 'Active',
            description: 'Comprehensive QMS audit program covering all core processes and quality management principles.',
            audits: [
                { type: 'Stage 1', date: '2023-03-20', status: 'Completed' },
                { type: 'Stage 2', date: '2023-04-15', status: 'Completed' },
                { type: 'Surveillance 1', date: '2024-04-15', status: 'Completed' },
                { type: 'Surveillance 2', date: '2025-04-15', status: 'Planned' }
            ]
        },
        {
            id: 2,
            client: 'Global Manufacturing',
            standard: 'ISO 14001:2015',
            type: 'Certification',
            cycleStart: '2024-02-20',
            cycleEnd: '2027-02-19',
            status: 'Active',
            description: 'Environmental management system audit program for manufacturing operations.',
            audits: [
                { type: 'Stage 1', date: '2024-02-20', status: 'Completed' },
                { type: 'Stage 2', date: '2024-03-15', status: 'Completed' },
                { type: 'Surveillance 1', date: '2025-03-15', status: 'Planned' }
            ]
        },
        {
            id: 3,
            client: 'SecureData Corp',
            standard: 'ISO 27001:2022',
            type: 'Surveillance',
            cycleStart: '2024-05-10',
            cycleEnd: '2027-05-09',
            status: 'Pending',
            description: 'Information security management surveillance audit program.',
            audits: [
                { type: 'Stage 1', date: '2024-05-10', status: 'Planned' }
            ]
        }
    ],
    auditPlans: [
        {
            id: 1,
            client: "Tech Solutions Ltd",
            standard: "ISO 9001:2015",
            date: "2024-02-15",
            cost: 2400,
            auditors: [1],
            manDays: 3,
            status: "Completed",
            selectedChecklists: [1],
            objectives: "Verify ongoing compliance with ISO 9001:2015",
            scope: "Software Development and IT Services"
        },
        {
            id: 2,
            client: "Global Manufacturing",
            standard: "ISO 14001:2015",
            date: "2024-03-20",
            cost: 3200,
            auditors: [1, 3],
            manDays: 4,
            status: "Approved",
            selectedChecklists: [2],
            objectives: "Stage 2 Certification Audit",
            scope: "Manufacturing of Auto Parts"
        },
        {
            id: 3,
            client: "SecureData Corp",
            standard: "ISO 27001:2022",
            date: "2025-01-10",
            cost: 4000,
            auditors: [2],
            manDays: 5,
            status: "Planned",
            selectedChecklists: [4],
            objectives: "Initial Certification Audit",
            scope: "Data Center Operations"
        }
    ],
    auditReports: [
        {
            id: 101,
            client: "Tech Solutions Ltd",
            date: "2024-02-15",
            status: "Finalized",
            findings: 2,
            ncrs: [
                { type: "minor", clause: "7.5", description: "Document control procedure not fully followed for obsolete documents.", evidence: "Old version of Employee Handbook found in break room.", status: "Closed" },
                { type: "minor", clause: "8.4", description: "Supplier re-evaluation criteria not clearly defined.", evidence: "Supplier list does not show last evaluation date.", status: "Open" }
            ],
            capas: [
                { linkedNCR: "NCR-001", rootCause: "Communication gap", actionPlan: "Remove old copies.", status: "Completed" }
            ],
            checklistProgress: [
                { checklistId: "1", itemIdx: "0", status: "conform", comment: "Verified internal issues list." },
                { checklistId: "1", itemIdx: "1", status: "conform", comment: "Stakeholder matrix reviewed." },
                { checklistId: "1", itemIdx: "13", status: "nc", ncrType: "minor", ncrDescription: "Document control issue.", comment: "See NCR-001" }
            ],
            conclusion: "The QMS is generally effective. Recommended for continued certification subject to closure of minor NC.",
            recommendation: "Recommend Certification",
            conformities: 18,
            finalizedAt: "2024-02-16T10:00:00.000Z"
        },
        {
            id: 102,
            client: "Global Manufacturing",
            date: "2024-03-20",
            status: "In Progress",
            findings: 1,
            ncrs: [
                { type: "major", clause: "6.1.2", description: "Significant environmental aspects not identified for new painting line.", evidence: "Impact assessment register missing new line.", status: "Open" }
            ],
            checklistProgress: [
                { checklistId: "2", itemIdx: "0", status: "conform", comment: "Context established." },
                { checklistId: "2", itemIdx: "4", status: "nc", ncrType: "major", ncrDescription: "Aspects missing.", comment: "Major issue found." }
            ]
        }
    ],
    certificationDecisions: [
        { client: 'Tech Solutions Ltd', standard: 'ISO 9001:2015', date: '2024-01-15', decision: 'Granted' },
        { client: 'Global Manufacturing', standard: 'ISO 14001:2015', date: '2024-02-10', decision: 'Granted' }
    ],
    documents: [],
    checklists: [
        {
            id: 1,
            name: 'ISO 9001:2015 Comprehensive Audit Checklist',
            standard: 'ISO 9001:2015',
            type: 'global',
            auditType: 'Stage 2 (Implementation Audit)',
            auditScope: 'Full System',
            createdBy: 'System Admin',
            createdAt: '2024-01-01',
            updatedAt: '2025-01-01',
            clauses: [
                {
                    mainClause: '4',
                    title: 'Context of the Organization',
                    subClauses: [
                        { clause: '4.1', requirement: 'Has the organization determined external and internal issues relevant to its purpose?' },
                        { clause: '4.2', requirement: 'Have the needs and expectations of interested parties been determined?' },
                        { clause: '4.3', requirement: 'Is the scope of the quality management system determined and documented?' },
                        { clause: '4.4', requirement: 'Are QMS processes and their interactions determined and maintained?' }
                    ]
                },
                {
                    mainClause: '5',
                    title: 'Leadership',
                    subClauses: [
                        { clause: '5.1', requirement: 'Does top management demonstrate leadership and commitment to the QMS?' },
                        { clause: '5.2', requirement: 'Is the quality policy established, communicated, and understood?' },
                        { clause: '5.3', requirement: 'Are roles, responsibilities, and authorities assigned and communicated?' }
                    ]
                },
                {
                    mainClause: '6',
                    title: 'Planning',
                    subClauses: [
                        { clause: '6.1', requirement: 'Have risks and opportunities been addressed to assure results?' },
                        { clause: '6.2', requirement: 'Are quality objectives established at relevant functions and levels?' },
                        { clause: '6.3', requirement: 'Are changes to the QMS planned and carried out systematically?' }
                    ]
                },
                {
                    mainClause: '7',
                    title: 'Support',
                    subClauses: [
                        { clause: '7.1.3', requirement: 'Is the infrastructure necessary for processes provided and maintained?' },
                        { clause: '7.1.5', requirement: 'Are resources for monitoring and measurement fit for purpose?' },
                        { clause: '7.2', requirement: 'Are persons competent based on education, training, or experience?' },
                        { clause: '7.5', requirement: 'Is documented information created, updated, and controlled?' }
                    ]
                },
                {
                    mainClause: '8',
                    title: 'Operation',
                    subClauses: [
                        { clause: '8.1', requirement: 'Are processes for products and services planned and controlled?' },
                        { clause: '8.2.3', requirement: 'Are requirements for products and services reviewed before commitment?' },
                        { clause: '8.4', requirement: 'Are external providers (suppliers) evaluated and monitored?' },
                        { clause: '8.5.1', requirement: 'Is production and service provision implemented under controlled conditions?' },
                        { clause: '8.7', requirement: 'Are nonconforming outputs identified and controlled?' }
                    ]
                },
                {
                    mainClause: '9',
                    title: 'Performance Evaluation',
                    subClauses: [
                        { clause: '9.2', requirement: 'Are internal audits conducted at planned intervals?' },
                        { clause: '9.3', requirement: 'Does top management review the QMS at planned intervals?' }
                    ]
                },
                {
                    mainClause: '10',
                    title: 'Improvement',
                    subClauses: [
                        { clause: '10.2', requirement: 'Are nonconformities and corrective actions managed effectively?' }
                    ]
                }
            ]
        },
        {
            id: 2,
            name: 'ISO 14001:2015 Environmental Audit Checklist',
            standard: 'ISO 14001:2015',
            type: 'global',
            auditType: 'Surveillance',
            auditScope: 'Site-specific',
            createdBy: 'System Admin',
            createdAt: '2024-01-01',
            updatedAt: '2025-01-01',
            clauses: [
                {
                    mainClause: '4',
                    title: 'Context of the Organization',
                    subClauses: [
                        { clause: '4.1', requirement: 'Have internal/external issues affecting the EMS been determined?' },
                        { clause: '4.2', requirement: 'Are needs/expectations of interested parties (stakeholders) identified?' },
                        { clause: '4.3', requirement: 'Is the scope of the EMS defined and available as documented info?' }
                    ]
                },
                {
                    mainClause: '5',
                    title: 'Leadership',
                    subClauses: [
                        { clause: '5.2', requirement: 'Is the environmental policy established and compatible with context?' }
                    ]
                },
                {
                    mainClause: '6',
                    title: 'Planning',
                    subClauses: [
                        { clause: '6.1.2', requirement: 'Have environmental aspects and significant impacts been identified?' },
                        { clause: '6.1.3', requirement: 'Does the organization have access to compliance obligations/laws?' },
                        { clause: '6.1.4', requirement: 'Are actions planned to address significant aspects and obligations?' },
                        { clause: '6.2', requirement: 'Are environmental objectives established and measurable where feasible?' }
                    ]
                },
                {
                    mainClause: '7',
                    title: 'Support',
                    subClauses: [
                        { clause: '7.2', requirement: 'Are persons doing work affecting environmental performance competent?' },
                        { clause: '7.3', requirement: 'Are persons aware of the policy and their contribution to the EMS?' },
                        { clause: '7.4', requirement: 'Are internal and external communications processes established?' },
                        { clause: '7.5', requirement: 'Is documented information required by ISO 14001 controlled?' }
                    ]
                },
                {
                    mainClause: '8',
                    title: 'Operation',
                    subClauses: [
                        { clause: '8.1', requirement: 'Are operational controls established for significant aspects?' },
                        { clause: '8.2', requirement: 'Are emergency preparedness and response procedures in place?' }
                    ]
                },
                {
                    mainClause: '9',
                    title: 'Performance Evaluation',
                    subClauses: [
                        { clause: '9.1.1', requirement: 'Is environmental performance monitored, measured, and analyzed?' },
                        { clause: '9.1.2', requirement: 'Is compliance with legal requirements evaluated periodically?' },
                        { clause: '9.2', requirement: 'Are internal audits conducted to determine if EMS conforms and is effective?' },
                        { clause: '9.3', requirement: 'Is management review conducted to ensure continuing suitability?' }
                    ]
                },
                {
                    mainClause: '10',
                    title: 'Improvement',
                    subClauses: [
                        { clause: '10.2', requirement: 'Are nonconformities reacted to and root causes eliminated?' },
                        { clause: '10.3', requirement: 'Is the EMS continually improved to enhance performance?' }
                    ]
                }
            ]
        },
        {
            id: 3,
            name: 'ISO 45001:2018 OHS Audit Checklist',
            standard: 'ISO 45001:2018',
            type: 'global',
            auditType: 'Recertification',
            auditScope: 'Full System',
            createdBy: 'System Admin',
            createdAt: '2024-01-01',
            updatedAt: '2025-01-01',
            clauses: [
                {
                    mainClause: '4',
                    title: 'Context of the Organization',
                    subClauses: [
                        { clause: '4.1', requirement: 'Has the organization determined context relevant to OHS purpose?' },
                        { clause: '4.2', requirement: 'Are needs and expectations of workers and interested parties determined?' },
                        { clause: '4.3', requirement: 'Is the scope of the OH&S management system documented?' }
                    ]
                },
                {
                    mainClause: '5',
                    title: 'Leadership',
                    subClauses: [
                        { clause: '5.1', requirement: 'Does management take overall responsibility and accountability for OHS?' },
                        { clause: '5.2', requirement: 'Is there an OHS Policy that includes commitment to safe working conditions?' },
                        { clause: '5.4', requirement: 'Are processes for consultation and participation of workers established?' }
                    ]
                },
                {
                    mainClause: '6',
                    title: 'Planning',
                    subClauses: [
                        { clause: '6.1.2.1', requirement: 'Is there an ongoing process for hazard identification?' },
                        { clause: '6.1.2.2', requirement: 'Are assessment of OHS risks and other risks to the OHS system conducted?' },
                        { clause: '6.1.3', requirement: 'Are legal and other requirements determined and up to date?' },
                        { clause: '6.2', requirement: 'Are OHS objectives established to maintain and improve the OHS system?' }
                    ]
                },
                {
                    mainClause: '7',
                    title: 'Support',
                    subClauses: [
                        { clause: '7.2', requirement: 'Are workers competent on the basis of education, training or experience?' },
                        { clause: '7.3', requirement: 'Are workers aware of incident implications and their right to remove themselves?' },
                        { clause: '7.4', requirement: 'Are internal and external communications relevant to the OHS system done?' }
                    ]
                },
                {
                    mainClause: '8',
                    title: 'Operation',
                    subClauses: [
                        { clause: '8.1.2', requirement: 'Is the hierarchy of controls used to eliminate hazards and reduce risks?' },
                        { clause: '8.1.3', requirement: 'Is there a process for the implementation and control of planned changes?' },
                        { clause: '8.1.4', requirement: 'Are procurement processes and contractors controlled regarding OHS?' },
                        { clause: '8.2', requirement: 'Are potential emergency situations prepared for and responded to?' }
                    ]
                },
                {
                    mainClause: '9',
                    title: 'Performance Evaluation',
                    subClauses: [
                        { clause: '9.1.1', requirement: 'Is OHS performance and effectiveness monitored and evaluated?' },
                        { clause: '9.1.2', requirement: 'Is evaluation of compliance with legal requirements carried out?' },
                        { clause: '9.2', requirement: 'Are internal audits conducted effectively?' },
                        { clause: '9.3', requirement: 'Is management review conducted?' }
                    ]
                },
                {
                    mainClause: '10',
                    title: 'Improvement',
                    subClauses: [
                        { clause: '10.2', requirement: 'Are incidents and nonconformities investigated and acted upon?' }
                    ]
                }
            ]
        },
        {
            id: 4,
            name: 'ISO 27001 Information Security Checklist',
            standard: 'ISO 27001:2022',
            type: 'global',
            auditType: 'Stage 1 (Documentation Review)',
            auditScope: 'Process-specific',
            createdBy: 'System Admin',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-20',
            clauses: [
                {
                    mainClause: '4',
                    title: 'Context of the Organization',
                    subClauses: [
                        { clause: '4.1', requirement: 'Understanding the organization and its context' },
                        { clause: '4.2', requirement: 'Understanding the needs and expectations of interested parties' }
                    ]
                },
                {
                    mainClause: '5',
                    title: 'Leadership',
                    subClauses: [
                        { clause: '5.1', requirement: 'Leadership and commitment' },
                        { clause: '5.2', requirement: 'Information Security Policy' }
                    ]
                },
                {
                    mainClause: '6',
                    title: 'Planning',
                    subClauses: [
                        { clause: '6.1.2', requirement: 'Information security risk assessment' },
                        { clause: '6.1.3', requirement: 'Information security risk treatment' },
                        { clause: '6.2', requirement: 'Information security objectives' }
                    ]
                },
                {
                    mainClause: 'A',
                    title: 'Annex A Controls',
                    subClauses: [
                        { clause: 'A.5', requirement: 'Organizational controls' },
                        { clause: 'A.6', requirement: 'People controls' },
                        { clause: 'A.7', requirement: 'Physical controls' },
                        { clause: 'A.8', requirement: 'Technological controls' }
                    ]
                }
            ]
        }
    ],
    // ISO 17021-1 Compliance: Appeals & Complaints Register
    appeals: [
        {
            id: 1,
            clientId: 1,
            clientName: 'Tech Solutions Ltd',
            type: 'Certification Decision',
            subject: 'Appeal against Minor NC classification',
            description: 'Client appeals the classification of NC-001 as minor, requesting reclassification as observation.',
            dateReceived: '2024-02-20',
            dueDate: '2024-03-20',
            status: 'Resolved',
            assignedTo: 'Impartiality Committee',
            resolution: 'Appeal upheld. NC reclassified as OFI.',
            dateResolved: '2024-03-15',
            history: [
                { date: '2024-02-20', action: 'Received', user: 'Admin', notes: 'Appeal logged' },
                { date: '2024-02-22', action: 'Under Review', user: 'John Smith', notes: 'Assigned to committee' },
                { date: '2024-03-15', action: 'Resolved', user: 'Committee Chair', notes: 'Decision communicated to client' }
            ]
        },
        {
            id: 2,
            clientId: 2,
            clientName: 'Global Manufacturing',
            type: 'Audit Process',
            subject: 'Appeal regarding audit scope',
            description: 'Client appeals the inclusion of warehouse operations in the audit scope, claiming it was not agreed upon.',
            dateReceived: '2024-11-10',
            dueDate: '2024-12-10',
            status: 'Under Review',
            assignedTo: 'Impartiality Committee',
            resolution: '',
            dateResolved: '',
            history: [
                { date: '2024-11-10', action: 'Received', user: 'Admin', notes: 'Appeal logged' },
                { date: '2024-11-12', action: 'Under Review', user: 'Certification Manager', notes: 'Reviewing original audit plan' }
            ]
        }
    ],
    complaints: [
        {
            id: 1,
            source: 'Client',
            clientName: 'Global Manufacturing',
            relatedAuditId: 2,
            type: 'Auditor Conduct',
            severity: 'Low',
            auditorsInvolved: [1],
            subject: 'Auditor scheduling concern',
            description: 'Client raised concern about late arrival of auditor on Day 2 of the audit.',
            dateReceived: '2024-03-25',
            dueDate: '2024-04-10',
            status: 'Closed',
            investigator: 'Quality Manager',
            findings: 'Auditor was delayed due to traffic. No systemic issue identified.',
            correctiveAction: 'Reminder issued to all auditors about punctuality and communication.',
            resolution: 'Apology letter sent to client. Internal process reminder issued.',
            dateResolved: '2024-04-05',
            history: [
                { date: '2024-03-25', action: 'Received', user: 'Admin', notes: 'Complaint logged' },
                { date: '2024-03-26', action: 'Acknowledged', user: 'Quality Manager', notes: 'Acknowledgment sent to client' },
                { date: '2024-04-01', action: 'Investigation', user: 'Quality Manager', notes: 'Auditor interviewed' },
                { date: '2024-04-05', action: 'Closed', user: 'Quality Manager', notes: 'Resolution communicated' }
            ]
        },
        {
            id: 2,
            source: 'Public',
            clientName: '',
            relatedAuditId: null,
            type: 'Impartiality',
            severity: 'Medium',
            auditorsInvolved: [2],
            subject: 'Potential conflict of interest concern',
            description: 'Anonymous report suggesting an auditor may have prior business relationship with a certified client.',
            dateReceived: '2024-10-15',
            dueDate: '2024-11-15',
            status: 'Investigation',
            investigator: 'Impartiality Committee',
            findings: '',
            correctiveAction: '',
            resolution: '',
            dateResolved: '',
            history: [
                { date: '2024-10-15', action: 'Received', user: 'Admin', notes: 'Complaint logged from anonymous source' },
                { date: '2024-10-16', action: 'Acknowledged', user: 'Certification Manager', notes: 'Escalated to Impartiality Committee' },
                { date: '2024-10-20', action: 'Investigation', user: 'Impartiality Committee', notes: 'Reviewing auditor assignments and declarations' }
            ]
        },
        {
            id: 3,
            source: 'Client',
            clientName: 'SecureData Corp',
            relatedAuditId: 3,
            type: 'Service Quality',
            severity: 'High',
            auditorsInvolved: [2],
            subject: 'Audit report quality issue',
            description: 'Client reports that the Stage 1 audit report contained factual errors regarding their IT infrastructure.',
            dateReceived: '2024-12-01',
            dueDate: '2024-12-15',
            status: 'Investigation',
            investigator: 'Technical Review Panel',
            findings: '',
            correctiveAction: '',
            resolution: '',
            dateResolved: '',
            history: [
                { date: '2024-12-01', action: 'Received', user: 'Admin', notes: 'Complaint logged' },
                { date: '2024-12-02', action: 'Acknowledged', user: 'Quality Manager', notes: 'Report under technical review' }
            ]
        }
    ],
    settings: {
        standards: ['ISO 9001:2015', 'ISO 14001:2015', 'ISO 27001:2022', 'ISO 45001:2018'],
        roles: ['Lead Auditor', 'Auditor', 'Technical Expert'],
        isAdmin: true  // Toggle for admin privileges (simulated)
    },
    // Auditor-Client Assignments for role-based filtering
    // Auditors only see clients they are assigned to
    // Synced with Supabase auditor_assignments table
    auditorAssignments: [
        // Example assignments for demo
        { auditorId: 1, clientId: 1 },  // John Smith -> Tech Solutions
        { auditorId: 1, clientId: 2 },  // John Smith -> Global Manufacturing
        { auditorId: 2, clientId: 3 },  // Sarah Johnson -> SecureData Corp
        { auditorId: 3, clientId: 2 }   // Mike Chen -> Global Manufacturing
    ]
};

// Global Exports for Modules
window.state = state;
// State initialized successfully
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;

// ============================================
// ROLE-BASED FILTERING UTILITIES
// ============================================
// Auditors only see assigned clients/plans/reports
// Cert Managers and Admins see everything

/**
 * Get clients visible to the current user based on role and assignments
 * @returns {Array} Filtered client array
 */
function getVisibleClients() {
    const user = window.state.currentUser;
    const allClients = window.state.clients || [];

    if (!user) return allClients; // No user = show all (demo mode)

    // Roles that see ALL clients (management roles)
    const fullAccessRoles = ['Admin', 'Certification Manager'];

    // Roles that only see ASSIGNED clients (auditor roles)
    const filteredRoles = ['Lead Auditor', 'Auditor', 'Technical Expert'];

    // Admin and Cert Manager see all clients
    if (fullAccessRoles.includes(user.role)) {
        return allClients;
    }

    // Auditors (Lead Auditor, Auditor, Technical Expert) see only assigned clients
    if (filteredRoles.includes(user.role)) {
        // Find matching auditor profile
        const auditor = window.state.auditors.find(a =>
            a.name === user.name || a.email === user.email
        );

        if (!auditor) {
            console.warn('Current user has auditor role but no matching auditor profile found.');
            return [];
        }

        // Get assignments for this auditor
        const assignments = window.state.auditorAssignments || [];
        const assignedClientIds = assignments
            .filter(a => a.auditorId === auditor.id)
            .map(a => a.clientId);

        // Filter clients based on assignments
        return allClients.filter(client => assignedClientIds.includes(client.id));
    }

    // Client Role sees ONLY their own organization
    if (user.role === 'Client') {
        // In a real app, user would be linked to client ID.
        // For demo, we match by name or assume single client context if implemented?
        // Simplistic check: if user.name matches client name or contact
        return allClients.filter(c => c.name === user.name || c.contacts.some(contact => contact.email === user.email));
    }

    return []; // Default: no access
}

/**
 * Get audit plans visible to the current user
 * Plans are visible if:
 * 1. Client is currently assigned to the auditor, OR
 * 2. Auditor was on the audit team (historical records retained)
 * @returns {Array} Filtered audit plans
 */
function getVisiblePlans() {
    const user = window.state.currentUser;
    const allPlans = window.state.auditPlans || [];

    if (!user) return allPlans;

    // Admin and Cert Manager see all
    if (user.role === 'Admin' || user.role === 'Certification Manager' || user.name === 'Demo User') {
        return allPlans;
    }

    // Find auditor profile for the current user
    const auditor = window.state.auditors.find(a =>
        a.email === user.email || a.name === user.name
    );

    // Get visible client names for current assignments
    const visibleClients = getVisibleClients();
    const visibleClientNames = visibleClients.map(c => c.name);

    return allPlans.filter(p => {
        // Show if client is currently assigned
        if (visibleClientNames.includes(p.client)) return true;

        // Also show if auditor was on the team (historical records)
        if (auditor && p.team && Array.isArray(p.team)) {
            if (p.team.includes(auditor.name)) return true;
        }
        if (auditor && p.auditors && Array.isArray(p.auditors)) {
            if (p.auditors.includes(auditor.id)) return true;
        }

        return false;
    });
}

/**
 * Get audit reports visible to the current user
 * Reports are visible if:
 * 1. Client is currently assigned to the auditor, OR
 * 2. Auditor was part of the audit (historical records retained)
 * @returns {Array} Filtered audit reports
 */
function getVisibleReports() {
    const user = window.state.currentUser;
    const allReports = window.state.auditReports || [];

    if (!user) return allReports;

    // Admin and Cert Manager see all
    if (user.role === 'Admin' || user.role === 'Certification Manager' || user.name === 'Demo User') {
        return allReports;
    }

    // Find auditor profile for the current user
    const auditor = window.state.auditors.find(a =>
        a.email === user.email || a.name === user.name
    );

    // Get visible client names for current assignments
    const visibleClients = getVisibleClients();
    const visibleClientNames = visibleClients.map(c => c.name);

    // Get visible plans to check team membership
    const allPlans = window.state.auditPlans || [];

    return allReports.filter(r => {
        // Show if client is currently assigned
        if (visibleClientNames.includes(r.client)) return true;

        // Also show if auditor was on the plan's team (historical records)
        if (auditor && r.planId) {
            const plan = allPlans.find(p => p.id === r.planId);
            if (plan) {
                if (plan.team && Array.isArray(plan.team) && plan.team.includes(auditor.name)) return true;
                if (plan.auditors && Array.isArray(plan.auditors) && plan.auditors.includes(auditor.id)) return true;
            }
        }

        // Check if auditor created or is assigned to the report
        if (auditor && r.leadAuditor === auditor.name) return true;

        return false;
    });
}

// Export filter utilities globally
window.getVisibleClients = getVisibleClients;
window.getVisiblePlans = getVisiblePlans;
window.getVisibleReports = getVisibleReports;

// Global Error Handling
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
    if (window.showNotification) {
        window.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    if (window.showNotification) {
        window.showNotification('Operation failed. Check console for details.', 'error');
    }
});

// State Management with Performance Optimizations
let saveTimeout;
let lastSaveSize = 0;

function saveState() {
    // Debounce saves to prevent excessive localStorage writes
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const stateJSON = JSON.stringify(state);
            const sizeInMB = new Blob([stateJSON]).size / 1024 / 1024;
            lastSaveSize = sizeInMB;

            // Check storage quota (warn at 4.5MB, 90% of typical 5MB limit)
            if (sizeInMB > 4.5) {
                console.warn(`Storage usage high: ${sizeInMB.toFixed(2)}MB / 5MB`);
                window.showNotification(
                    `Storage usage: ${sizeInMB.toFixed(2)}MB. Consider exporting old data.`,
                    'warning'
                );
            }

            localStorage.setItem('auditCB360State', stateJSON);
        } catch (e) {
            console.error('Save failed:', e);
            if (e.name === 'QuotaExceededError') {
                window.showNotification(
                    'Storage limit exceeded! Please export and clear old data.',
                    'error'
                );
            } else {
                console.warn('LocalStorage not available:', e);
            }
        }
    }, 500); // Wait 500ms before saving
}

// Get current storage usage
function getStorageStats() {
    return {
        sizeMB: lastSaveSize,
        percent: (lastSaveSize / 5) * 100,
        itemCount: {
            clients: state.clients?.length || 0,
            auditors: state.auditors?.length || 0,
            auditPlans: state.auditPlans?.length || 0,
            auditReports: state.auditReports?.length || 0,
            checklists: state.checklists?.length || 0
        }
    };
}

window.getStorageStats = getStorageStats;

function loadState() {
    try {
        const saved = localStorage.getItem('auditCB360State');
        if (saved) {
            const data = JSON.parse(saved);
            // Check version compatibility
            if (data.version === DATA_VERSION) {
                Object.assign(state, data);

                // SAFETY: Ensure currentUser is always initialized (fix for legacy null values)
                if (!state.currentUser) {
                    state.currentUser = {
                        name: 'Demo User',
                        role: 'Lead Auditor'
                    };
                }
            } else {
                window.Logger.warn('Core', `Version mismatch (Store: ${data.version}, App: ${DATA_VERSION}). Resetting to defaults.`);
                // Do not load saved data, keep strictly default mock data
                // We'll save the new default state naturally on next edit
            }
        }

        // Migrate checklists to hierarchical format if needed
        migrateChecklistsToHierarchy();
    } catch (e) {
        console.warn('LocalStorage not available:', e);
    }
}

// Migrate old flat checklists to hierarchical format
function migrateChecklistsToHierarchy() {
    const defaultHierarchicalChecklists = getDefaultHierarchicalChecklists();

    if (!state.checklists || state.checklists.length === 0) {
        state.checklists = defaultHierarchicalChecklists;
        saveState();
        return;
    }

    // Check if any checklist needs migration (has items but no clauses)
    let needsUpdate = false;

    state.checklists = state.checklists.map(checklist => {
        // If already hierarchical, keep it
        if (checklist.clauses && checklist.clauses.length > 0) {
            return checklist;
        }

        // Check if this is a default checklist that should use new hierarchical data
        const defaultVersion = defaultHierarchicalChecklists.find(d => d.id === checklist.id);
        if (defaultVersion && defaultVersion.clauses) {
            needsUpdate = true;
            return {
                ...checklist,
                clauses: defaultVersion.clauses,
                auditType: checklist.auditType || defaultVersion.auditType,
                auditScope: checklist.auditScope || defaultVersion.auditScope
            };
        }

        // For custom checklists with flat items, convert to simple hierarchy
        if (checklist.items && checklist.items.length > 0 && !checklist.clauses) {
            needsUpdate = true;
            const clauseGroups = {};

            checklist.items.forEach(item => {
                const mainNum = (item.clause || '').split('.')[0] || 'General';
                if (!clauseGroups[mainNum]) {
                    clauseGroups[mainNum] = {
                        mainClause: mainNum,
                        title: mainNum === 'General' ? 'General Requirements' : `Clause ${mainNum}`,
                        subClauses: []
                    };
                }
                clauseGroups[mainNum].subClauses.push({
                    clause: item.clause || '',
                    requirement: item.requirement || ''
                });
            });

            return {
                ...checklist,
                clauses: Object.values(clauseGroups)
            };
        }

        return checklist;
    });

    // IMPORTANT: Restore any missing default checklists
    defaultHierarchicalChecklists.forEach(defaultChecklist => {
        const exists = state.checklists.find(c => c.id === defaultChecklist.id);
        if (!exists) {
            window.Logger.info('Core', 'Restoring missing default checklist: ' + defaultChecklist.name);
            state.checklists.push(defaultChecklist);
            needsUpdate = true;
        }
    });

    if (needsUpdate) {
        saveState();
        window.Logger.info('Core', 'Checklists migrated to hierarchical format');
    }
}

// Default hierarchical checklists (reference copy for migration)
function getDefaultHierarchicalChecklists() {
    return [
        {
            id: 1,
            name: 'ISO 9001:2015 Comprehensive Audit Checklist',
            standard: 'ISO 9001:2015',
            type: 'global',
            auditType: 'Stage 2 (Implementation Audit)',
            auditScope: 'Full System',
            clauses: [
                {
                    mainClause: '4', title: 'Context of the Organization', subClauses: [
                        { clause: '4.1', requirement: 'Has the organization determined external and internal issues relevant to its purpose?' },
                        { clause: '4.2', requirement: 'Have the needs and expectations of interested parties been determined?' },
                        { clause: '4.3', requirement: 'Is the scope of the quality management system determined and documented?' },
                        { clause: '4.4', requirement: 'Are QMS processes and their interactions determined and maintained?' }
                    ]
                },
                {
                    mainClause: '5', title: 'Leadership', subClauses: [
                        { clause: '5.1', requirement: 'Does top management demonstrate leadership and commitment to the QMS?' },
                        { clause: '5.2', requirement: 'Is the quality policy established, communicated, and understood?' },
                        { clause: '5.3', requirement: 'Are roles, responsibilities, and authorities assigned and communicated?' }
                    ]
                },
                {
                    mainClause: '6', title: 'Planning', subClauses: [
                        { clause: '6.1', requirement: 'Have risks and opportunities been addressed to assure results?' },
                        { clause: '6.2', requirement: 'Are quality objectives established at relevant functions and levels?' },
                        { clause: '6.3', requirement: 'Are changes to the QMS planned and carried out systematically?' }
                    ]
                },
                {
                    mainClause: '7', title: 'Support', subClauses: [
                        { clause: '7.1.3', requirement: 'Is the infrastructure necessary for processes provided and maintained?' },
                        { clause: '7.1.5', requirement: 'Are resources for monitoring and measurement fit for purpose?' },
                        { clause: '7.2', requirement: 'Are persons competent based on education, training, or experience?' },
                        { clause: '7.5', requirement: 'Is documented information created, updated, and controlled?' }
                    ]
                },
                {
                    mainClause: '8', title: 'Operation', subClauses: [
                        { clause: '8.1', requirement: 'Are processes for products and services planned and controlled?' },
                        { clause: '8.2.3', requirement: 'Are requirements for products and services reviewed before commitment?' },
                        { clause: '8.4', requirement: 'Are external providers (suppliers) evaluated and monitored?' },
                        { clause: '8.5.1', requirement: 'Is production and service provision implemented under controlled conditions?' },
                        { clause: '8.7', requirement: 'Are nonconforming outputs identified and controlled?' }
                    ]
                },
                {
                    mainClause: '9', title: 'Performance Evaluation', subClauses: [
                        { clause: '9.2', requirement: 'Are internal audits conducted at planned intervals?' },
                        { clause: '9.3', requirement: 'Does top management review the QMS at planned intervals?' }
                    ]
                },
                {
                    mainClause: '10', title: 'Improvement', subClauses: [
                        { clause: '10.2', requirement: 'Are nonconformities and corrective actions managed effectively?' }
                    ]
                }
            ]
        },
        {
            id: 2,
            name: 'ISO 14001:2015 Environmental Audit Checklist',
            standard: 'ISO 14001:2015',
            type: 'global',
            auditType: 'Surveillance',
            auditScope: 'Site-specific',
            clauses: [
                {
                    mainClause: '4', title: 'Context of the Organization', subClauses: [
                        { clause: '4.1', requirement: 'Have internal/external issues affecting the EMS been determined?' },
                        { clause: '4.2', requirement: 'Are needs/expectations of interested parties identified?' },
                        { clause: '4.3', requirement: 'Is the scope of the EMS defined and documented?' }
                    ]
                },
                {
                    mainClause: '6', title: 'Planning', subClauses: [
                        { clause: '6.1.2', requirement: 'Have environmental aspects and impacts been identified?' },
                        { clause: '6.1.3', requirement: 'Are compliance obligations determined?' },
                        { clause: '6.2', requirement: 'Are environmental objectives established and measurable?' }
                    ]
                },
                {
                    mainClause: '8', title: 'Operation', subClauses: [
                        { clause: '8.1', requirement: 'Are operational controls for significant aspects established?' },
                        { clause: '8.2', requirement: 'Are emergency preparedness procedures in place?' }
                    ]
                },
                {
                    mainClause: '9', title: 'Performance Evaluation', subClauses: [
                        { clause: '9.1.2', requirement: 'Is compliance with legal requirements evaluated?' },
                        { clause: '9.2', requirement: 'Are internal audits conducted?' }
                    ]
                }
            ]
        },
        {
            id: 3,
            name: 'ISO 45001:2018 OHS Audit Checklist',
            standard: 'ISO 45001:2018',
            type: 'global',
            auditType: 'Recertification',
            auditScope: 'Full System',
            clauses: [
                {
                    mainClause: '5', title: 'Leadership', subClauses: [
                        { clause: '5.1', requirement: 'Does management take responsibility for OHS?' },
                        { clause: '5.4', requirement: 'Are worker consultation processes established?' }
                    ]
                },
                {
                    mainClause: '6', title: 'Planning', subClauses: [
                        { clause: '6.1.2.1', requirement: 'Is hazard identification ongoing?' },
                        { clause: '6.1.3', requirement: 'Are legal requirements determined?' }
                    ]
                },
                {
                    mainClause: '8', title: 'Operation', subClauses: [
                        { clause: '8.1.2', requirement: 'Is hierarchy of controls used?' },
                        { clause: '8.2', requirement: 'Is emergency preparedness in place?' }
                    ]
                }
            ]
        },
        {
            id: 4,
            name: 'ISO 27001 Information Security Checklist',
            standard: 'ISO 27001:2022',
            type: 'global',
            auditType: 'Stage 1 (Documentation Review)',
            auditScope: 'Process-specific',
            clauses: [
                {
                    mainClause: '5', title: 'Leadership', subClauses: [
                        { clause: '5.1', requirement: 'Leadership and commitment' },
                        { clause: '5.2', requirement: 'Information Security Policy' }
                    ]
                },
                {
                    mainClause: '6', title: 'Planning', subClauses: [
                        { clause: '6.1.2', requirement: 'Information security risk assessment' },
                        { clause: '6.1.3', requirement: 'Information security risk treatment' }
                    ]
                },
                {
                    mainClause: 'A', title: 'Annex A Controls', subClauses: [
                        { clause: 'A.5', requirement: 'Organizational controls' },
                        { clause: 'A.6', requirement: 'People controls' },
                        { clause: 'A.7', requirement: 'Physical controls' },
                        { clause: 'A.8', requirement: 'Technological controls' }
                    ]
                }
            ]
        }
    ];
}

loadState();

// Helper functions (Safe ID Generation)
function getNextId(collection) {
    if (!state[collection]) return 1;
    const items = state[collection];
    return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
}

function addRecord(collection, data) {
    const newRecord = { id: getNextId(collection), ...data };
    state[collection].push(newRecord);
    saveState();
    return newRecord;
}

function updateRecord(collection, id, data) {
    const index = state[collection].findIndex(item => item.id === id);
    if (index !== -1) {
        state[collection][index] = { ...state[collection][index], ...data };
        saveState();
        return state[collection][index];
    }
    return null;
}

function deleteRecord(collection, id) {
    const index = state[collection].findIndex(item => item.id === id);
    if (index !== -1) {
        state[collection].splice(index, 1);
        saveState();
        return true;
    }
    return false;
}

// DOM Elements
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
// Capture global sidebar content early to ensure it can be restored
const navListElement = document.querySelector('.main-nav ul');
const globalSidebarHTML = navListElement ? navListElement.innerHTML : '';

// Export important items to window for modules to access
window.state = state;
window.contentArea = contentArea;
window.saveData = saveState;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderModule = renderModule;
window.globalSidebarHTML = globalSidebarHTML;

// Navigation Handler (using delegation at document level for maximum robustness)
document.addEventListener('click', (e) => {
    const item = e.target.closest('li[data-module]');
    if (item) {
        const moduleName = item.getAttribute('data-module');
        window.location.hash = moduleName;
    }
});

// Hash-based Routing
function handleRouteChange() {
    const hash = window.location.hash.substring(1); // Remove #

    // Check if we are leaving a client workspace
    if (!hash.startsWith('client/') && window.state && window.state.activeClientId) {
        if (typeof window.backToDashboard === 'function') {
            window.backToDashboard();
        }
    }

    if (!hash || hash === 'dashboard') {
        renderModule('dashboard', false);
        updateActiveNavItem('dashboard');
    } else if (hash.startsWith('client/')) {
        const parts = hash.split('/');
        const clientId = parseInt(parts[1]);
        const subModule = parts[2] || 'overview';
        if (typeof window.selectClient === 'function') {
            // If already in client workspace, just switch tab
            if (window.state.activeClientId === clientId) {
                window.renderClientModule(clientId, subModule);
            } else {
                window.selectClient(clientId);
                window.renderClientModule(clientId, subModule);
            }
        } else {
            // Fallback if client-workspace script not loaded
            renderModule('clients', false);
        }
    } else {
        renderModule(hash, false);
        updateActiveNavItem(hash);
    }
}

function updateActiveNavItem(moduleName) {
    const currentNavItems = document.querySelectorAll('.main-nav li');
    currentNavItems.forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('data-module') === moduleName);
    });
}

window.addEventListener('hashchange', handleRouteChange);

// Module Loader
const loadedModules = new Set();

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (loadedModules.has(src)) {
            resolve();
            return;
        }
        const script = document.createElement('script');

        // Handle file protocol (avoid query params for local files if strict)
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            script.src = src;
        } else {
            // Add timestamp to prevent caching issues on web servers
            script.src = `${src}?v=${window.appTimestamp || (window.appTimestamp = Date.now())}`;
        }

        script.onload = () => {
            loadedModules.add(src);
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${src}`);
            reject(new Error(`Failed to load ${src}`));
        };
        document.body.appendChild(script);
    });
}

// Render Functions
async function renderModule(moduleName, syncHash = true) {
    // If we want to sync the hash and it's different, update it and return
    // handleRouteChange will then call renderModule(moduleName, false)
    if (syncHash && window.location.hash !== '#' + moduleName) {
        window.location.hash = moduleName;
        return;
    }

    // Update Title
    const titleMap = {
        'dashboard': 'Dashboard',
        'clients': 'Client Management',
        'auditors': 'Auditor Management',
        'audit-programs': 'Audit Programs',
        'audit-planning': 'Audit Planning',
        'checklists': 'Checklist Library',
        'manday-calculator': 'Man-Day Calculator',
        'multisite-sampling': 'Multi-Site Sampling Calculator',
        'audit-execution': 'Audit Execution',
        'audit-reporting': 'Audit Reporting Dashboard',
        'certification': 'Certification Decisions',
        'documents': 'Document Management',
        'impartiality': 'Impartiality Committee',
        'management-review': 'Management Review',
        'internal-audit': 'Internal Audit',
        'settings': 'Settings'
    };
    pageTitle.textContent = titleMap[moduleName] || 'Dashboard';

    // Show Loading State
    contentArea.innerHTML = '<div class="fade-in" style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary-color);"></i></div>';

    try {
        // Scripts are now pre-loaded in index.html, no need for dynamic loading

        // Render Specific Content
        switch (moduleName) {
            case 'dashboard':
                if (typeof renderDashboardEnhanced === 'function') {
                    renderDashboardEnhanced();
                } else {
                    renderDashboard();
                }
                break;
            case 'clients':
                if (typeof renderClientsEnhanced === 'function') {
                    renderClientsEnhanced();
                } else {
                    renderClients();
                }
                break;
            case 'auditors':
                if (typeof renderAuditorsEnhanced === 'function') {
                    renderAuditorsEnhanced();
                } else {
                    renderAuditors();
                }
                break;
            case 'audit-programs':
                if (typeof renderAuditProgramsEnhanced === 'function') {
                    renderAuditProgramsEnhanced();
                } else {
                    renderAuditPrograms();
                }
                break;
            case 'audit-planning':
                if (typeof renderAuditPlanningEnhanced === 'function') {
                    renderAuditPlanningEnhanced();
                } else {
                    renderAuditPlanning();
                }
                break;
            case 'audit-execution':
                if (typeof renderAuditExecutionEnhanced === 'function') {
                    renderAuditExecutionEnhanced();
                } else {
                    renderAuditExecution();
                }
                break;
            case 'audit-reporting':
                if (typeof renderReportingModule === 'function') {
                    renderReportingModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'certification':
                if (typeof renderCertificationModule === 'function') {
                    renderCertificationModule();
                } else {
                    contentArea.innerHTML = '<div class="alert alert-info">Certification module under construction</div>';
                }
                break;
            case 'appeals-complaints':
                if (typeof renderAppealsComplaintsModule === 'function') {
                    renderAppealsComplaintsModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'impartiality':
                if (typeof renderImpartialityModule === 'function') {
                    renderImpartialityModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'ncr-capa':
                if (typeof renderNCRCAPAModule === 'function') {
                    renderNCRCAPAModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'management-review':
                if (typeof renderManagementReviewModule === 'function') {
                    renderManagementReviewModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'internal-audit':
                if (typeof renderInternalAuditModule === 'function') {
                    renderInternalAuditModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'manday-calculator':
                if (typeof renderManDayCalculator === 'function') {
                    renderManDayCalculator();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'multisite-sampling':
                if (typeof renderMultiSiteSamplingCalculator === 'function') {
                    renderMultiSiteSamplingCalculator();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'documents':
                if (typeof renderDocumentsEnhanced === 'function') {
                    renderDocumentsEnhanced();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'checklists':
                if (typeof renderChecklistLibrary === 'function') {
                    renderChecklistLibrary();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'record-retention':
                if (typeof renderRecordRetentionModule === 'function') {
                    renderRecordRetentionModule();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            case 'settings':
                // Restrict Settings access to Admin and Certification Manager only
                const settingsRole = window.state.currentUser?.role;
                const canAccessSettings = settingsRole === 'Admin' || settingsRole === 'Certification Manager';

                if (!canAccessSettings) {
                    contentArea.innerHTML = `
                        <div class="fade-in" style="text-align: center; padding: 3rem;">
                            <i class="fa-solid fa-lock" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                            <h3>Access Restricted</h3>
                            <p style="color: var(--text-secondary);">Settings are only accessible to Admins and Certification Managers.</p>
                            <button class="btn btn-primary" onclick="window.location.hash = 'dashboard'">
                                <i class="fa-solid fa-arrow-left" style="margin-right: 0.5rem;"></i>Return to Dashboard
                            </button>
                        </div>
                    `;
                } else if (typeof renderSettings === 'function') {
                    renderSettings();
                } else {
                    renderPlaceholder(moduleName);
                }
                break;
            default:
                renderPlaceholder(moduleName);
        }
    } catch (error) {
        console.error('Error loading module:', error);
        contentArea.innerHTML = `
            <div class="fade-in" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h3>Error Loading Module</h3>
                <p style="color: var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="renderModule('${moduleName}')">
                    <i class="fa-solid fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderDashboard() {
    // Audit Compliance Alerts
    const alerts = [];
    (state.auditors || []).forEach(aud => {
        const evals = aud.evaluations || {};
        const nextDue = evals.nextWitnessAuditDue;
        const isFirstTime = evals.firstTimeAuditor;
        const witnessAudits = evals.witnessAudits || [];

        if (isFirstTime && witnessAudits.length === 0) {
            alerts.push({ type: 'First Time', msg: `${aud.name} - Witness Required`, id: aud.id, severity: 'high' });
        } else if (nextDue && new Date(nextDue) < new Date()) {
            alerts.push({ type: 'Overdue', msg: `${aud.name} - Overdue`, id: aud.id, severity: 'critical' });
        }
    });
    const dashboardHTML = `
        <div class="dashboard-grid fade-in">
            <div class="card stat-card">
                <h3>Total Clients</h3>
                <p class="stat-value">${state.clients.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Active Auditors</h3>
                <p class="stat-value">${state.auditors.length}</p>
            </div>
            <div class="card stat-card">
                <h3>Pending Audits</h3>
                <p class="stat-value">3</p>
            </div>
            <div class="card stat-card">
                <h3>Certificates Issued</h3>
                <p class="stat-value">12</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-top: 2rem;">
            <div class="card fade-in">
                <h3>Recent Activity</h3>
                <p style="color: var(--text-secondary); margin-top: 1rem;">No recent activity to show.</p>
            </div>

            <div class="card fade-in">
                <h3><i class="fa-solid fa-bell" style="color: #f59e0b; margin-right: 0.5rem;"></i>Compliance Alerts</h3>
                ${alerts.length > 0 ? `
                    <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${alerts.map(alert => `
                            <div style="padding: 0.75rem; border-radius: 6px; background: ${alert.severity === 'critical' ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${alert.severity === 'critical' ? '#dc2626' : '#d97706'}; cursor: pointer;" onclick="state.currentModule = 'auditors'; renderAuditors(); setTimeout(() => renderAuditorDetail(${alert.id}), 100);">
                                <div style="font-weight: 600; font-size: 0.9rem; color: ${alert.severity === 'critical' ? '#991b1b' : '#92400e'};">${alert.type}</div>
                                <div style="font-size: 0.85rem; color: ${alert.severity === 'critical' ? '#7f1d1d' : '#78350f'};">${alert.msg}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p style="color: var(--text-secondary); margin-top: 1rem; font-size: 0.9rem;">
                        <i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 0.5rem;"></i>All compliance checks passed.
                    </p>
                `}
            </div>
        </div>
    `;
    contentArea.innerHTML = dashboardHTML;
}

function renderClients() {
    contentArea.innerHTML = '<p>Loading Clients...</p>';
}

function renderAuditors() {
    contentArea.innerHTML = '<p>Loading Auditors...</p>';
}

function renderAuditPrograms() {
    contentArea.innerHTML = '<p>Loading Audit Programs...</p>';
}

function renderAuditPlanning() {
    contentArea.innerHTML = '<p>Loading Audit Planning...</p>';
}

function renderAuditExecution() {
    contentArea.innerHTML = '<p>Loading Audit Execution...</p>';
}

function renderCertification() {
    const rows = (state.certificationDecisions || []).map(decision => `
        <tr>
            <td>${window.UTILS.escapeHtml(decision.client)}</td>
            <td>${window.UTILS.escapeHtml(decision.standard)}</td>
            <td>${window.UTILS.escapeHtml(decision.date)}</td>
            <td><span class="status-badge status-${window.UTILS.escapeHtml(decision.decision || '').toLowerCase().replace(' ', '-')}">${window.UTILS.escapeHtml(decision.decision)}</span></td>
            <td>
                <button class="btn btn-sm" style="color: var(--primary-color);"><i class="fa-solid fa-file-certificate"></i></button>
            </td>
        </tr>
    `).join('');

    const html = `
        <div class="fade-in">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Standard</th>
                            <th>Decision Date</th>
                            <th>Decision</th>
                            <th>Certificate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    contentArea.innerHTML = html;
}

function renderPlaceholder(moduleName) {
    contentArea.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: 3rem;">
            <i class="fa-solid fa-person-digging" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
            <h3>${moduleName.replace('-', ' ').toUpperCase()} Module</h3>
            <p style="color: var(--text-secondary);">This module is currently under development.</p>
        </div>
    `;
}

// Notification Helper - Theme Aware
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'fade-in';

    // Theme-aware colors
    const colors = {
        success: { bg: '#059669', border: '#10b981', icon: 'fa-check-circle' },
        error: { bg: '#dc2626', border: '#ef4444', icon: 'fa-times-circle' },
        warning: { bg: '#d97706', border: '#f59e0b', icon: 'fa-exclamation-triangle' },
        info: { bg: '#2563eb', border: '#3b82f6', icon: 'fa-info-circle' }
    };
    const style = colors[type] || colors.success;

    notification.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${style.bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px ${style.border};
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 500;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
    `;

    notification.innerHTML = `
        <i class="fa-solid ${style.icon}" style="font-size: 1.25rem;"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal Helpers
function openModal(title, body, onSave) {
    if (title) {
        document.getElementById('modal-title').textContent = title;
    }
    if (body) {
        document.getElementById('modal-body').innerHTML = body;
    }
    if (onSave) {
        const saveBtn = document.getElementById('modal-save');
        saveBtn.onclick = onSave;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    // Reset modal content
    document.getElementById('modal-title').textContent = 'Modal Title';
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-save').onclick = null;
    document.getElementById('modal-save').textContent = 'Save'; // Reset button text
}

// Export to window for global access
window.openModal = openModal;
window.closeModal = closeModal;

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
        closeModal();
    }
});

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

function toggleMobileMenu() {
    sidebar.classList.toggle('mobile-open');
    mobileOverlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
}

// Close mobile menu when navigation item is clicked (Delegation at document level)
document.addEventListener('click', (e) => {
    if (e.target.closest('li[role="button"]')) {
        closeMobileMenu();
    }
});

// Keyboard Navigation Support (Delegation at document level)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('li[role="button"]');
        if (item) {
            e.preventDefault();
            item.click();
        }
    }
});

// ESC key to close mobile menu and modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeMobileMenu();
        if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
            closeModal();
        }
    }
});

// Export helper function for use in modules
window.saveData = saveState;

// Lazy-loading modal wrapper functions
// These load modules on demand when create/add buttons are clicked
const modalFunctionCache = {};

async function lazyLoadModal(modulePath, functionName) {
    // Load the module if not already loaded
    try {
        await loadScript(modulePath);

        // Retry finding the function for up to 1 second
        let retries = 10;
        while (retries > 0) {
            if (typeof window[functionName] === 'function') {
                window[functionName]();
                return;
            }
            await new Promise(r => setTimeout(r, 100)); // Wait 100ms
            retries--;
        }

        console.error(`Function ${functionName} not found after loading ${modulePath}`);
        showNotification(`Error loading ${functionName}. Please refresh the page.`, 'error');
    } catch (error) {
        console.error(`Error loading module ${modulePath}:`, error);
        showNotification(`Failed to load module: ${error.message}`, 'error');
    }
}

// Initial Render
// User Profile / Role Switcher - positioned at bottom of left sidebar
function renderRoleSwitcher() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Remove existing container if present
    const existing = document.getElementById('role-switcher-container');
    if (existing) existing.remove();

    // Initialize currentUser if it doesn't exist
    if (!state.currentUser) {
        state.currentUser = {
            name: 'Demo User',
            role: 'Admin',
            isDemo: true
        };
    }

    const switcher = document.createElement('div');
    switcher.id = 'role-switcher-container';
    switcher.style.cssText = 'padding: 1rem; border-top: 1px solid var(--border-color); margin-top: auto;';

    // Check if this is a real authenticated user (from Supabase)
    const isRealUser = state.currentUser && !state.currentUser.isDemo && state.currentUser.email;

    if (isRealUser) {
        // Show simple logout button for authenticated users (profile is in header)
        switcher.innerHTML = `
            <button onclick="window.logoutUser()" class="btn btn-sm" style="width: 100%; background: rgba(220, 38, 38, 0.1); color: #f87171; border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px;">
                <i class="fa-solid fa-sign-out-alt" style="margin-right: 0.5rem;"></i>Logout
            </button>
        `;
    } else {
        // Show Login Button for production
        switcher.innerHTML = `
            <div style="padding: 0.5rem 0;">
                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">Please login to access the system.</p>
                <button onclick="window.renderLoginModal()" class="btn btn-sm btn-primary" style="width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    <i class="fa-solid fa-lock" style="margin-right: 0.5rem;"></i> Login
                </button>
            </div>
        `;
    }
    sidebar.appendChild(switcher);
}

// Render Login Modal
window.renderLoginModal = function () {
    const modalHtml = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="width: 64px; height: 64px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.75rem;">
                <i class="fa-solid fa-shield-halved"></i>
            </div>
            <h3 style="margin: 0; color: #1e293b;">Admin Login</h3>
            <p style="color: #64748b; margin-top: 0.5rem;">Secure Access Portal</p>
        </div>
        <form onsubmit="event.preventDefault(); window.loginUser(this);">
            <div class="form-group" style="margin-bottom: 1rem;">
                <label>Email</label>
                <input type="email" name="email" class="form-control" placeholder="admin@auditcb.com" required>
            </div>
             <div class="form-group" style="margin-bottom: 1.5rem;">
                <label>Password</label>
                <input type="password" name="password" class="form-control" placeholder="••••••" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem; font-size: 1rem;">
                Sign In
            </button>
        </form>
    `;

    // Use existing modal infrastructure if available, or simple sweetalert/custom
    // Assuming simple-modal structure exists in index.html (modal-container)
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer'); // Usually has buttons

    if (modalTitle && modalBody) {
        modalTitle.textContent = '';
        modalBody.innerHTML = modalHtml;
        if (modalFooter) modalFooter.style.display = 'none'; // Hide default buttons
        window.openModal();
    } else {
        // Fallback
        alert('Login Modal Error: UI not found');
    }
};

// Handle Login Logic
window.loginUser = function (form) {
    const email = form.email.value;
    const password = form.password.value;

    // 1. Check against local users (Admin)
    const users = window.state.users || [];
    // Ensure default admin exists if list is empty (fallback)
    if (users.length === 0) {
        users.push({
            id: 1,
            name: 'System Admin',
            email: 'info@companycertification.com',
            role: 'Admin',
            password: 'admin' // Simple plain text for prototype
        });
        window.state.users = users;
    }

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

    if (user) {
        window.state.currentUser = user;
        window.saveData();
        window.showNotification('Login Successful', 'success');
        window.closeModal();
        window.renderRoleSwitcher(); // Re-render sidebar
        window.location.reload(); // Reload to apply full permissions
    } else {
        window.showNotification('Invalid email or password', 'error');
    }
};

// Exit demo mode and set as real Admin user
window.exitDemoMode = function () {
    state.currentUser = {
        name: 'Admin User',
        email: 'admin@companycertification.com',
        role: 'Admin',
        isDemo: false
    };
    saveState();
    renderRoleSwitcher();
    updateNavigationForRole('Admin');
    window.showNotification('Logged in as Admin. Demo mode disabled.', 'success');
    handleRouteChange();
};

// Logout user
window.logoutUser = function () {
    if (confirm('Are you sure you want to logout?')) {
        state.currentUser = {
            name: 'Demo User',
            role: 'Admin',
            isDemo: true
        };
        saveState();
        renderRoleSwitcher();
        updateNavigationForRole('Admin');
        window.showNotification('Logged out successfully', 'success');
        window.location.hash = 'dashboard';
    }
};

window.switchUserRole = function (role) {
    if (!state.currentUser) {
        state.currentUser = { name: 'Demo User', role: role };
    } else {
        state.currentUser.role = role;
    }

    // Update navigation visibility based on role
    updateNavigationForRole(role);

    window.showNotification(`Switched role to: ${role}`, 'info');
    // Re-render current module to reflect permissions
    const hash = window.location.hash.substring(1) || 'dashboard';
    handleRouteChange();
};

// Update navigation items visibility based on user role
function updateNavigationForRole(role) {
    const auditorRoles = ['Auditor', 'Lead Auditor'];
    const isAuditor = auditorRoles.includes(role);

    // Hide Settings for Auditors
    const settingsNav = document.querySelector('li[data-module="settings"]');
    if (settingsNav) {
        settingsNav.style.display = isAuditor ? 'none' : '';
    }

    // Hide Governance group for Auditors (optional but good for cleaner UX)
    const governanceHeader = document.querySelector('.nav-group-header');
    const governanceContent = governanceHeader?.nextElementSibling;
    if (governanceHeader && governanceContent) {
        governanceHeader.style.display = isAuditor ? 'none' : '';
        governanceContent.style.display = isAuditor ? 'none' : '';
    }
}
window.updateNavigationForRole = updateNavigationForRole;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (not demo mode)
    const isLoggedIn = state.currentUser && !state.currentUser.isDemo && state.currentUser.email;

    if (!isLoggedIn) {
        // Show fullscreen login overlay
        showLoginOverlay();
        return; // Don't proceed with app initialization
    }

    // User is logged in - proceed normally
    renderRoleSwitcher();
    updateCBLogoDisplay();
    if (state.currentUser?.role) {
        updateNavigationForRole(state.currentUser.role);
    }
    if (window.location.hash) {
        handleRouteChange();
    } else {
        window.location.hash = 'dashboard';
    }
});

// Fullscreen Login Overlay
function showLoginOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    overlay.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 3rem; width: 400px; max-width: 90vw; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 2rem; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);">
                    <i class="fa-solid fa-shield-halved"></i>
                </div>
                <h2 style="margin: 0; color: #1e293b; font-size: 1.75rem; font-weight: 700;">AuditCB360</h2>
                <p style="color: #64748b; margin-top: 0.5rem;">ISO Certification Body Management</p>
            </div>
            
            <form id="login-form" onsubmit="event.preventDefault(); window.handleLoginSubmit(this);">
                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; font-size: 0.9rem;">Email Address</label>
                    <input type="email" name="email" placeholder="info@companycertification.com" required 
                        style="width: 100%; padding: 0.875rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; transition: all 0.2s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';"
                        onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none';">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; font-size: 0.9rem;">Password</label>
                    <input type="password" name="password" placeholder="••••••••" required
                        style="width: 100%; padding: 0.875rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; transition: all 0.2s; box-sizing: border-box;"
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';"
                        onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none';">
                </div>
                
                <button type="submit" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);"
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 10px -1px rgba(37, 99, 235, 0.4)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(37, 99, 235, 0.3)';">
                    <i class="fa-solid fa-right-to-bracket" style="margin-right: 0.5rem;"></i>
                    Sign In
                </button>
            </form>
            
            <p style="text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 2rem;">
                Secure access for authorized personnel only
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
}

// Handle Login Form Submission
window.handleLoginSubmit = function (form) {
    const email = form.email.value;
    const password = form.password.value;

    // Ensure default admin exists
    if (!window.state.users || window.state.users.length === 0) {
        window.state.users = [{
            id: 1,
            name: 'System Admin',
            email: 'info@companycertification.com',
            role: 'Admin',
            password: 'admin'
        }];
    }

    const user = window.state.users.find(u =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (user) {
        // Login successful
        window.state.currentUser = {
            ...user,
            isDemo: false
        };
        window.saveData();

        // Remove overlay and initialize app
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.remove();

        // Initialize the app
        renderRoleSwitcher();
        updateCBLogoDisplay();
        updateNavigationForRole(user.role);
        window.location.hash = 'dashboard';
        handleRouteChange();

        window.showNotification(`Welcome, ${user.name}!`, 'success');
    } else {
        window.showNotification('Invalid email or password', 'error');
    }
};

// Update CB Logo in Sidebar Header
function updateCBLogoDisplay() {
    const logoContainer = document.getElementById('cb-logo-display');
    if (!logoContainer) return;

    const logoUrl = state.cbSettings?.logoUrl;
    const cbName = state.cbSettings?.cbName || 'AuditCB360';

    if (logoUrl && logoUrl.startsWith('data:')) {
        // Replace entire header with just the logo
        logoContainer.innerHTML = `<img src="${logoUrl}" style="max-height: 40px; max-width: 180px; object-fit: contain;" alt="${cbName}">`;
    } else {
        // Default: icon + text
        logoContainer.innerHTML = `<i class="fa-solid fa-certificate"></i><h1>${cbName}</h1>`;
    }
}
window.updateCBLogoDisplay = updateCBLogoDisplay;

// Client Sidebar Toggle
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const clientSidebar = document.getElementById('client-sidebar');

if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
        clientSidebar.classList.toggle('collapsed');
        const isCollapsed = clientSidebar.classList.contains('collapsed');
        sidebarToggleBtn.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });
}

// Side Bar Group Toggle
window.toggleNavGroup = function (header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.group-arrow');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        content.classList.remove('collapsed');
        arrow.classList.remove('fa-chevron-down');
        arrow.classList.add('fa-chevron-up');
    } else {
        content.style.display = 'none';
        content.classList.add('collapsed');
        arrow.classList.remove('fa-chevron-up');
        arrow.classList.add('fa-chevron-down');
    }
};
