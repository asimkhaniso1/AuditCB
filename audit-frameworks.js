// ============================================
// AUDIT FRAMEWORKS MODULE  (window.AuditFrameworks)
// ============================================
// Standalone add-on for AuditCB-360's audit report builder.
// Pure data registry — NO DOM access, NO dependency on any other report-*.js module.
// Does NOT modify any existing file — purely additive.
//
// CONTRACT:
//   window.AuditFrameworks.frameworks                        -> [{id, label, appliesWhen, requirementSources, packSections}]
//   window.AuditFrameworks.resolve(report, auditPlan)         -> [] of matched framework objects (never throws)
//   window.AuditFrameworks.requirementSourcesFor(report, plan)-> [] of {type, label, items[]} flattened + deduped by label
//   window.AuditFrameworks.packBlockDefs                      -> { blockId: {title, columns[], hint} }
//
// Consumed by report-frameworks.js to render a technical audit pack section, and by other
// report-*.js modules that may want to list applicable requirement sources.

(function (global) {
    'use strict';

    // ------------------------------------------------------------------
    // ISO 9001:2015 — Quality Management Systems
    // ------------------------------------------------------------------
    const iso9001Clauses = [
        { ref: '4.1', title: 'Understanding the organization and its context', mandatory: true },
        { ref: '4.2', title: 'Understanding the needs and expectations of interested parties', mandatory: true },
        { ref: '4.3', title: 'Determining the scope of the quality management system', mandatory: true },
        { ref: '4.4', title: 'Quality management system and its processes', mandatory: true },
        { ref: '5.1', title: 'Leadership and commitment', mandatory: true },
        { ref: '5.2', title: 'Policy', mandatory: true },
        { ref: '5.3', title: 'Organizational roles, responsibilities and authorities', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities', mandatory: true },
        { ref: '6.2', title: 'Quality objectives and planning to achieve them', mandatory: true },
        { ref: '6.3', title: 'Planning of changes', mandatory: true },
        { ref: '7.1', title: 'Resources', mandatory: true },
        { ref: '7.2', title: 'Competence', mandatory: true },
        { ref: '7.3', title: 'Awareness', mandatory: true },
        { ref: '7.4', title: 'Communication', mandatory: true },
        { ref: '7.5', title: 'Documented information', mandatory: true },
        { ref: '8.1', title: 'Operational planning and control', mandatory: true },
        { ref: '8.2', title: 'Requirements for products and services', mandatory: true },
        { ref: '8.3', title: 'Design and development of products and services', mandatory: false },
        { ref: '8.4', title: 'Control of externally provided processes, products and services', mandatory: true },
        { ref: '8.5', title: 'Production and service provision', mandatory: true },
        { ref: '8.6', title: 'Release of products and services', mandatory: true },
        { ref: '8.7', title: 'Control of nonconforming outputs', mandatory: true },
        { ref: '9.1', title: 'Monitoring, measurement, analysis and evaluation', mandatory: true },
        { ref: '9.2', title: 'Internal audit', mandatory: true },
        { ref: '9.3', title: 'Management review', mandatory: true },
        { ref: '10.1', title: 'General (improvement)', mandatory: true },
        { ref: '10.2', title: 'Nonconformity and corrective action', mandatory: true },
        { ref: '10.3', title: 'Continual improvement', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // ISO 14001:2015 — Environmental Management Systems
    // ------------------------------------------------------------------
    const iso14001Clauses = [
        { ref: '4.1', title: 'Understanding the organization and its context', mandatory: true },
        { ref: '4.2', title: 'Understanding the needs and expectations of interested parties', mandatory: true },
        { ref: '4.3', title: 'Determining the scope of the environmental management system', mandatory: true },
        { ref: '4.4', title: 'Environmental management system', mandatory: true },
        { ref: '5.1', title: 'Leadership and commitment', mandatory: true },
        { ref: '5.2', title: 'Environmental policy', mandatory: true },
        { ref: '5.3', title: 'Organizational roles, responsibilities and authorities', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities (incl. environmental aspects & compliance obligations)', mandatory: true },
        { ref: '6.2', title: 'Environmental objectives and planning to achieve them', mandatory: true },
        { ref: '7.1', title: 'Resources', mandatory: true },
        { ref: '7.2', title: 'Competence', mandatory: true },
        { ref: '7.3', title: 'Awareness', mandatory: true },
        { ref: '7.4', title: 'Communication', mandatory: true },
        { ref: '7.5', title: 'Documented information', mandatory: true },
        { ref: '8.1', title: 'Operational planning and control', mandatory: true },
        { ref: '8.2', title: 'Emergency preparedness and response', mandatory: true },
        { ref: '9.1', title: 'Monitoring, measurement, analysis and evaluation', mandatory: true },
        { ref: '9.2', title: 'Internal audit', mandatory: true },
        { ref: '9.3', title: 'Management review', mandatory: true },
        { ref: '10.1', title: 'General (improvement)', mandatory: true },
        { ref: '10.2', title: 'Nonconformity and corrective action', mandatory: true },
        { ref: '10.3', title: 'Continual improvement', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // ISO 45001:2018 — Occupational Health & Safety Management Systems
    // ------------------------------------------------------------------
    const iso45001Clauses = [
        { ref: '4.1', title: 'Understanding the organization and its context', mandatory: true },
        { ref: '4.2', title: 'Understanding the needs and expectations of workers and other interested parties', mandatory: true },
        { ref: '4.3', title: 'Determining the scope of the OH&S management system', mandatory: true },
        { ref: '4.4', title: 'OH&S management system', mandatory: true },
        { ref: '5.1', title: 'Leadership and commitment', mandatory: true },
        { ref: '5.2', title: 'OH&S policy', mandatory: true },
        { ref: '5.3', title: 'Organizational roles, responsibilities and authorities', mandatory: true },
        { ref: '5.4', title: 'Consultation and participation of workers', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities (hazard identification, risk assessment, legal requirements)', mandatory: true },
        { ref: '6.2', title: 'OH&S objectives and planning to achieve them', mandatory: true },
        { ref: '7.1', title: 'Resources', mandatory: true },
        { ref: '7.2', title: 'Competence', mandatory: true },
        { ref: '7.3', title: 'Awareness', mandatory: true },
        { ref: '7.4', title: 'Communication', mandatory: true },
        { ref: '7.5', title: 'Documented information', mandatory: true },
        { ref: '8.1', title: 'Operational planning and control (incl. elimination of hazards & reduction of risks)', mandatory: true },
        { ref: '8.2', title: 'Emergency preparedness and response', mandatory: true },
        { ref: '9.1', title: 'Monitoring, measurement, analysis and performance evaluation', mandatory: true },
        { ref: '9.2', title: 'Internal audit', mandatory: true },
        { ref: '9.3', title: 'Management review', mandatory: true },
        { ref: '10.1', title: 'General (improvement)', mandatory: true },
        { ref: '10.2', title: 'Incident, nonconformity and corrective action', mandatory: true },
        { ref: '10.3', title: 'Continual improvement', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // ISO/IEC 27001:2022 — Information Security Management Systems
    // ------------------------------------------------------------------
    const iso27001Clauses = [
        { ref: '4.1', title: 'Understanding the organization and its context', mandatory: true },
        { ref: '4.2', title: 'Understanding the needs and expectations of interested parties', mandatory: true },
        { ref: '4.3', title: 'Determining the scope of the ISMS', mandatory: true },
        { ref: '4.4', title: 'Information security management system', mandatory: true },
        { ref: '5.1', title: 'Leadership and commitment', mandatory: true },
        { ref: '5.2', title: 'Policy', mandatory: true },
        { ref: '5.3', title: 'Organizational roles, responsibilities and authorities', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities (risk assessment & treatment, Statement of Applicability)', mandatory: true },
        { ref: '6.2', title: 'Information security objectives and planning to achieve them', mandatory: true },
        { ref: '6.3', title: 'Planning of changes', mandatory: true },
        { ref: '7.1', title: 'Resources', mandatory: true },
        { ref: '7.2', title: 'Competence', mandatory: true },
        { ref: '7.3', title: 'Awareness', mandatory: true },
        { ref: '7.4', title: 'Communication', mandatory: true },
        { ref: '7.5', title: 'Documented information', mandatory: true },
        { ref: '8.1', title: 'Operational planning and control', mandatory: true },
        { ref: '8.2', title: 'Information security risk assessment', mandatory: true },
        { ref: '8.3', title: 'Information security risk treatment', mandatory: true },
        { ref: '9.1', title: 'Monitoring, measurement, analysis and evaluation', mandatory: true },
        { ref: '9.2', title: 'Internal audit', mandatory: true },
        { ref: '9.3', title: 'Management review', mandatory: true },
        { ref: '10.1', title: 'Continual improvement', mandatory: true },
        { ref: '10.2', title: 'Nonconformity and corrective action', mandatory: true }
    ];

    const iso27001AnnexA = [
        { ref: 'A.5.1', title: 'Policies for information security', mandatory: true },
        { ref: 'A.5.7', title: 'Threat intelligence', mandatory: false },
        { ref: 'A.5.9', title: 'Inventory of information and other associated assets', mandatory: true },
        { ref: 'A.5.10', title: 'Acceptable use of information and other associated assets', mandatory: true },
        { ref: 'A.5.15', title: 'Access control', mandatory: true },
        { ref: 'A.5.16', title: 'Identity management', mandatory: true },
        { ref: 'A.5.18', title: 'Access rights', mandatory: true },
        { ref: 'A.5.23', title: 'Information security for use of cloud services', mandatory: false },
        { ref: 'A.5.24', title: 'Information security incident management planning and preparation', mandatory: true },
        { ref: 'A.5.30', title: 'ICT readiness for business continuity', mandatory: false },
        { ref: 'A.5.31', title: 'Legal, statutory, regulatory and contractual requirements', mandatory: true },
        { ref: 'A.5.35', title: 'Independent review of information security', mandatory: true },
        { ref: 'A.6.1', title: 'Screening', mandatory: true },
        { ref: 'A.6.3', title: 'Information security awareness, education and training', mandatory: true },
        { ref: 'A.6.5', title: 'Responsibilities after termination or change of employment', mandatory: true },
        { ref: 'A.6.8', title: 'Information security event reporting', mandatory: true },
        { ref: 'A.7.1', title: 'Physical security perimeters', mandatory: true },
        { ref: 'A.7.2', title: 'Physical entry', mandatory: true },
        { ref: 'A.7.4', title: 'Physical security monitoring', mandatory: false },
        { ref: 'A.7.9', title: 'Security of assets off-premises', mandatory: false },
        { ref: 'A.7.10', title: 'Storage media', mandatory: true },
        { ref: 'A.8.1', title: 'User endpoint devices', mandatory: true },
        { ref: 'A.8.2', title: 'Privileged access rights', mandatory: true },
        { ref: 'A.8.8', title: 'Management of technical vulnerabilities', mandatory: true },
        { ref: 'A.8.9', title: 'Configuration management', mandatory: true },
        { ref: 'A.8.13', title: 'Information backup', mandatory: true },
        { ref: 'A.8.15', title: 'Logging', mandatory: true },
        { ref: 'A.8.16', title: 'Monitoring activities', mandatory: true },
        { ref: 'A.8.23', title: 'Web filtering', mandatory: false },
        { ref: 'A.8.24', title: 'Use of cryptography', mandatory: true },
        { ref: 'A.8.28', title: 'Secure coding', mandatory: false },
        { ref: 'A.8.32', title: 'Change management', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // API Spec Q1, 10th Edition — Quality Management System for oilfield
    // equipment manufacturing organizations
    // ------------------------------------------------------------------
    const apiQ1Clauses = [
        { ref: '4', title: 'Context of the organization', mandatory: true },
        { ref: '5', title: 'Leadership', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities', mandatory: true },
        { ref: '6.4', title: 'Contingency planning', mandatory: true },
        { ref: '7.1.5', title: 'Monitoring and measuring resources (equipment calibration)', mandatory: true },
        { ref: '7.2', title: 'Competence', mandatory: true },
        { ref: '7.5', title: 'Documented information', mandatory: true },
        { ref: '8.1', title: 'Operational planning and control', mandatory: true },
        { ref: '8.3', title: 'Design and development (product realization planning)', mandatory: true },
        { ref: '8.4', title: 'Design and development of products and services', mandatory: true },
        { ref: '8.5', title: 'Control of externally provided processes, products and services', mandatory: true },
        { ref: '8.6', title: 'Identification, traceability, and status (incl. Management of Change)', mandatory: true },
        { ref: '8.9', title: 'Production and service provision — nonconformity control', mandatory: true },
        { ref: '9', title: 'Performance evaluation', mandatory: true },
        { ref: '10', title: 'Improvement', mandatory: true }
    ];

    const apiProductSpecs = [
        { ref: 'API 7-1', title: 'Rotary Drill Stem Elements', mandatory: false },
        { ref: 'API 7-2', title: 'Threading and Gauging of Rotary Shouldered Thread Connections', mandatory: false },
        { ref: 'API RP 7G', title: 'Recommended Practice for Drill Stem Design and Operating Limits', mandatory: false },
        { ref: 'API DS-1, Vol. 3', title: 'Quality Management System Requirements for Manufacturing Organizations', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // ISO 22000:2018 / HACCP — Food Safety Management Systems
    // ------------------------------------------------------------------
    const iso22000Clauses = [
        { ref: '4.1', title: 'Understanding the organization and its context', mandatory: true },
        { ref: '4.2', title: 'Understanding the needs and expectations of interested parties', mandatory: true },
        { ref: '5.1', title: 'Leadership and commitment', mandatory: true },
        { ref: '5.2', title: 'Food safety policy', mandatory: true },
        { ref: '6.1', title: 'Actions to address risks and opportunities', mandatory: true },
        { ref: '7.1.6', title: 'Control of externally provided processes, products or services', mandatory: true },
        { ref: '7.4', title: 'Communication', mandatory: true },
        { ref: '8.2', title: 'Prerequisite programmes (PRPs)', mandatory: true },
        { ref: '8.3', title: 'Traceability system', mandatory: true },
        { ref: '8.4', title: 'Emergency preparedness and response', mandatory: true },
        { ref: '8.5', title: 'Hazard control (HACCP plan, CCPs, OPRPs)', mandatory: true },
        { ref: '8.7', title: 'Control of monitoring and measuring', mandatory: true },
        { ref: '8.9', title: 'Control of product and process nonconformities', mandatory: true },
        { ref: '9.1', title: 'Monitoring, measurement, analysis and evaluation', mandatory: true },
        { ref: '9.2', title: 'Internal audit', mandatory: true },
        { ref: '9.3', title: 'Management review', mandatory: true },
        { ref: '10.2', title: 'Nonconformity and corrective action', mandatory: true },
        { ref: '10.3', title: 'Continual improvement / update of the FSMS', mandatory: true }
    ];

    const haccpCodex = [
        { ref: 'Codex Principle 1', title: 'Conduct a hazard analysis', mandatory: true },
        { ref: 'Codex Principle 2', title: 'Determine the Critical Control Points (CCPs)', mandatory: true },
        { ref: 'Codex Principle 3', title: 'Establish critical limits', mandatory: true },
        { ref: 'Codex Principle 4', title: 'Establish a system to monitor control of CCPs', mandatory: true },
        { ref: 'Codex Principle 5', title: 'Establish corrective action', mandatory: true },
        { ref: 'Codex Principle 6', title: 'Establish verification procedures', mandatory: true },
        { ref: 'Codex Principle 7', title: 'Establish documentation and record keeping', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // ISO/IEC 17025:2017 — Testing and Calibration Laboratories
    // ------------------------------------------------------------------
    const iso17025Clauses = [
        { ref: '4.1', title: 'Impartiality', mandatory: true },
        { ref: '4.2', title: 'Confidentiality', mandatory: true },
        { ref: '5.1', title: 'Structure and legal responsibility', mandatory: true },
        { ref: '6.2', title: 'Personnel competence', mandatory: true },
        { ref: '6.3', title: 'Facilities and environmental conditions', mandatory: true },
        { ref: '6.4', title: 'Equipment', mandatory: true },
        { ref: '6.5', title: 'Metrological traceability', mandatory: true },
        { ref: '6.6', title: 'Externally provided products and services', mandatory: true },
        { ref: '7.1', title: 'Review of requests, tenders and contracts', mandatory: true },
        { ref: '7.2', title: 'Selection, verification and validation of methods', mandatory: true },
        { ref: '7.3', title: 'Sampling', mandatory: false },
        { ref: '7.6', title: 'Evaluation of measurement uncertainty', mandatory: true },
        { ref: '7.7', title: 'Ensuring the validity of results (incl. proficiency testing)', mandatory: true },
        { ref: '7.8', title: 'Reporting of results', mandatory: true },
        { ref: '7.10', title: 'Nonconforming work', mandatory: true },
        { ref: '8.2', title: 'Management system documentation', mandatory: true },
        { ref: '8.6', title: 'Improvement', mandatory: true },
        { ref: '8.7', title: 'Corrective actions', mandatory: true },
        { ref: '8.8', title: 'Internal audits', mandatory: true },
        { ref: '8.9', title: 'Management reviews', mandatory: true }
    ];

    // ------------------------------------------------------------------
    // Framework registry
    // ------------------------------------------------------------------
    const frameworks = [
        {
            id: 'iso9001',
            label: 'ISO 9001:2015',
            appliesWhen: /9001/,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO 9001:2015 Requirements', items: iso9001Clauses }
            ],
            packSections: []
        },
        {
            id: 'iso14001',
            label: 'ISO 14001:2015',
            appliesWhen: /14001/,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO 14001:2015 Requirements', items: iso14001Clauses }
            ],
            packSections: []
        },
        {
            id: 'iso45001',
            label: 'ISO 45001:2018',
            appliesWhen: /45001/,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO 45001:2018 Requirements', items: iso45001Clauses }
            ],
            packSections: []
        },
        {
            id: 'iso27001',
            label: 'ISO/IEC 27001:2022',
            appliesWhen: /27001/,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO/IEC 27001:2022 Requirements', items: iso27001Clauses },
                { type: 'iso-clause', label: 'Annex A Controls (ISO/IEC 27001:2022)', items: iso27001AnnexA }
            ],
            packSections: ['isAssetInventory', 'isAccessControl', 'isBackupReview', 'isIncidentMgmt', 'isAwareness']
        },
        {
            id: 'api-q1',
            label: 'API Spec Q1 (10th Edition)',
            appliesWhen: /API\s*(Spec\.?\s*)?Q1/i,
            requirementSources: [
                { type: 'iso-clause', label: 'API Spec Q1, 10th Edition', items: apiQ1Clauses },
                { type: 'industry', label: 'API Product Specifications', items: apiProductSpecs }
            ],
            packSections: ['apiEquipment', 'apiCalibration', 'apiGauges', 'apiThreads', 'apiNdt', 'apiMachineShop', 'apiHse', 'apiChemStorage']
        },
        {
            id: 'api-7',
            label: 'API 7-1 / 7-2 / DS-1',
            appliesWhen: /API\s*7-?[12]|DS-?1/i,
            requirementSources: [
                { type: 'industry', label: 'API Product Specifications', items: apiProductSpecs }
            ],
            packSections: ['apiEquipment', 'apiCalibration', 'apiGauges', 'apiThreads', 'apiNdt', 'apiMachineShop', 'apiHse', 'apiChemStorage']
        },
        {
            id: 'food-safety',
            label: 'ISO 22000:2018 / HACCP',
            appliesWhen: /22000|HACCP|FSSC|food/i,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO 22000:2018 Requirements', items: iso22000Clauses },
                { type: 'industry', label: 'HACCP / Codex Alimentarius', items: haccpCodex }
            ],
            packSections: ['fsHaccp', 'fsCcp', 'fsPrp', 'fsDefense', 'fsFraud', 'fsTemp']
        },
        {
            id: 'laboratory',
            label: 'ISO/IEC 17025:2017',
            appliesWhen: /17025|laborator/i,
            requirementSources: [
                { type: 'iso-clause', label: 'ISO/IEC 17025:2017 Requirements', items: iso17025Clauses }
            ],
            packSections: ['labMethodVal', 'labUncertainty', 'labRefStd', 'labPt']
        },
        {
            id: 'manufacturing',
            label: 'Manufacturing / Production Controls',
            appliesWhen: /manufactur|9001.*(manufact)|IATF|16949/i,
            requirementSources: [],
            packSections: ['mfgProdControl', 'mfgSpc', 'mfgCapability', 'mfgCalibration', 'mfgTrace', 'mfgValidation']
        }
    ];

    // ------------------------------------------------------------------
    // packBlockDefs — table shape for each technical pack block
    // ------------------------------------------------------------------
    const packBlockDefs = {
        // ISO 27001
        isAssetInventory: { title: 'Information Asset Inventory Review', columns: ['Asset / System', 'Owner', 'Classification', 'Location', 'Last Reviewed', 'Remarks'], hint: 'Verify the asset inventory per ISO/IEC 27001 A.5.9' },
        isAccessControl: { title: 'Access Control Assessment', columns: ['System/Application', 'Access Control Method', 'Privileged Accounts', 'Last Access Review', 'Status', 'Remarks'], hint: 'Verify access provisioning, review and de-provisioning per A.5.15–A.5.18' },
        isBackupReview: { title: 'Backup & Recovery Review', columns: ['System/Data Set', 'Backup Frequency', 'Retention', 'Last Restore Test', 'Status', 'Remarks'], hint: 'Verify backup and restoration testing per A.8.13' },
        isIncidentMgmt: { title: 'Incident Management Review', columns: ['Incident Ref', 'Date', 'Category', 'Response Time', 'Root Cause', 'Closure Status'], hint: 'Verify incident logging, response and lessons learned per A.5.24' },
        isAwareness: { title: 'Security Awareness & Training Review', columns: ['Role/Group', 'Training Topic', 'Date Completed', 'Coverage %', 'Next Due', 'Remarks'], hint: 'Verify awareness training coverage per A.6.3' },

        // API Q1 / API 7
        apiEquipment: { title: 'Production Equipment Assessment', columns: ['Equipment ID', 'Description', 'Location', 'Condition', 'Last Maintenance', 'Remarks'], hint: 'Verify equipment maintenance and fitness for use per API Q1 §7.1' },
        apiCalibration: { title: 'Calibration Status Assessment', columns: ['Equipment/Gauge ID', 'Description', 'Calibration Due', 'Status', 'Certificate Ref', 'Remarks'], hint: 'Verify calibration system per API Q1 §7.1.5' },
        apiGauges: { title: 'Gauge Control & Verification', columns: ['Gauge ID', 'Type', 'Master Gauge Ref', 'Verification Frequency', 'Last Verified', 'Status'], hint: 'Verify gauge control and traceability per API 7-2' },
        apiThreads: { title: 'Thread Inspection Records Review', columns: ['Product/Lot ID', 'Connection Type', 'Inspection Method', 'Inspector', 'Result', 'Disposition'], hint: 'Verify thread inspection and acceptance criteria per API 7-1/7-2' },
        apiNdt: { title: 'Non-Destructive Testing (NDT) Review', columns: ['Product/Lot ID', 'NDT Method', 'Technician Cert Level', 'Date', 'Result', 'Disposition'], hint: 'Verify NDT procedures, technician qualification and acceptance criteria' },
        apiMachineShop: { title: 'Machine Shop Process Control', columns: ['Work Center', 'Process/Operation', 'Control Method', 'Last Verification', 'Status', 'Remarks'], hint: 'Verify process control in the machine shop per API Q1 §8.5' },
        apiHse: { title: 'Health, Safety & Environment Review', columns: ['Area/Activity', 'Hazard', 'Control Measure', 'Last Inspection', 'Status', 'Remarks'], hint: 'Verify HSE controls applicable to the manufacturing site' },
        apiChemStorage: { title: 'Chemical & Hazardous Material Storage', columns: ['Material', 'Storage Location', 'SDS on File', 'Segregation/Containment', 'Last Inspection', 'Remarks'], hint: 'Verify chemical storage, labeling and SDS availability' },

        // Food safety
        fsHaccp: { title: 'HACCP Plan Review', columns: ['Process Step', 'Hazard', 'Control Measure', 'CCP/OPRP', 'Verification', 'Remarks'], hint: 'Verify the HACCP plan per ISO 22000 §8.5' },
        fsCcp: { title: 'Critical Control Point (CCP) Monitoring', columns: ['CCP', 'Critical Limit', 'Monitoring Method', 'Frequency', 'Last Deviation', 'Corrective Action'], hint: 'Verify CCP monitoring records and deviation handling' },
        fsPrp: { title: 'Prerequisite Programme (PRP) Assessment', columns: ['PRP Area', 'Requirement', 'Evidence Reviewed', 'Status', 'Remarks'], hint: 'Verify prerequisite programmes per ISO 22000 §8.2' },
        fsDefense: { title: 'Food Defense Assessment', columns: ['Vulnerability Point', 'Threat Type', 'Mitigation Measure', 'Last Review', 'Status', 'Remarks'], hint: 'Verify food defense / TACCP measures' },
        fsFraud: { title: 'Food Fraud Vulnerability Assessment', columns: ['Raw Material', 'Fraud Type', 'Vulnerability Rating', 'Mitigation Measure', 'Remarks'], hint: 'Verify food fraud / VACCP vulnerability assessment' },
        fsTemp: { title: 'Temperature Control Records Review', columns: ['Location/Equipment', 'Target Range', 'Monitoring Frequency', 'Deviations', 'Corrective Action', 'Remarks'], hint: 'Verify cold chain / temperature control records' },

        // Laboratory
        labMethodVal: { title: 'Method Validation / Verification Review', columns: ['Method/Test', 'Standard Reference', 'Validation Type', 'Date', 'Result', 'Status'], hint: 'Verify method selection, verification and validation per ISO 17025 §7.2' },
        labUncertainty: { title: 'Measurement Uncertainty Review', columns: ['Test/Measurement', 'Uncertainty Budget Ref', 'Last Evaluated', 'Expanded Uncertainty', 'Status', 'Remarks'], hint: 'Verify measurement uncertainty evaluation per §7.6' },
        labRefStd: { title: 'Reference Standards & Traceability', columns: ['Reference Standard', 'ID/Serial', 'Traceable To', 'Calibration Due', 'Status', 'Remarks'], hint: 'Verify metrological traceability per §6.5' },
        labPt: { title: 'Proficiency Testing / Interlaboratory Comparison', columns: ['Scheme/Provider', 'Test/Parameter', 'Date', 'Z-Score/Result', 'Status', 'Remarks'], hint: 'Verify PT/ILC participation and performance per §7.7' },

        // Manufacturing
        mfgProdControl: { title: 'Production Process Control Review', columns: ['Process/Line', 'Control Method', 'Control Plan Ref', 'Last Review', 'Status', 'Remarks'], hint: 'Verify production process controls' },
        mfgSpc: { title: 'Statistical Process Control (SPC) Review', columns: ['Process/Characteristic', 'Control Chart Type', 'Cpk/Ppk', 'Out-of-Control Events', 'Corrective Action', 'Remarks'], hint: 'Verify SPC application and process capability monitoring' },
        mfgCapability: { title: 'Process Capability Assessment', columns: ['Characteristic', 'Specification', 'Cp/Cpk', 'Sample Size', 'Status', 'Remarks'], hint: 'Verify process capability studies' },
        mfgCalibration: { title: 'Calibration Status Assessment', columns: ['Equipment ID', 'Description', 'Calibration Due', 'Status', 'Certificate Ref', 'Remarks'], hint: 'Verify measuring equipment calibration' },
        mfgTrace: { title: 'Product Traceability Review', columns: ['Product/Lot ID', 'Raw Material Lot(s)', 'Process Records', 'Customer/Shipment', 'Status', 'Remarks'], hint: 'Verify traceability from raw material to shipment' },
        mfgValidation: { title: 'Process Validation Review', columns: ['Process', 'Validation Method', 'Acceptance Criteria', 'Date', 'Result', 'Status'], hint: 'Verify validation of special/critical processes' }
    };

    // ------------------------------------------------------------------
    // resolve() / requirementSourcesFor()
    // ------------------------------------------------------------------
    function resolve(report, auditPlan) {
        try {
            const haystack = [
                report && report.standard,
                report && (report.audit_type || report.auditType),
                auditPlan && auditPlan.standard
            ].filter(Boolean).join(' ');

            if (!haystack) return [];

            return frameworks.filter((fw) => {
                try { return fw.appliesWhen.test(haystack); }
                catch (e) { return false; }
            });
        } catch (e) {
            return [];
        }
    }

    function requirementSourcesFor(report, auditPlan) {
        try {
            const matched = resolve(report, auditPlan);
            if (!matched.length) return [];

            const seen = new Set();
            const out = [];
            matched.forEach((fw) => {
                (fw.requirementSources || []).forEach((src) => {
                    if (!src || seen.has(src.label)) return;
                    seen.add(src.label);
                    out.push(src);
                });
            });
            return out;
        } catch (e) {
            return [];
        }
    }

    global.AuditFrameworks = { frameworks, resolve, requirementSourcesFor, packBlockDefs };
})(window);
