// ============================================
// CHECKLIST STANDARDS REGISTRY  (window.ChecklistStandards)
// ============================================
// Authoritative, scope-gated source of truth for what a given ISO standard
// actually requires. Pure data + pure functions — NO DOM access, no dependency
// on any other module.
//
// WHY THIS FILE EXISTS
// --------------------
// The checklist generator used to resolve a standard through
// settings-kb.js getBuiltInClauses(), whose final line was
// `return iso9001Clauses; // Default fallback`. Any standard it did not
// recognise — ISO/IEC 27001, ISO 22301, ISO/IEC 20000-1 — was silently handed
// the full ISO 9001 quality clause set. That is how a three-standard
// integrated ISMS/BCMS/SMS recertification checklist ended up auditing
// Customer Focus, "QMS processes", Design & Development (8.3) and monitoring
// and measuring equipment (7.1.5).
//
// The rule this module enforces: a standard that is not in the registry
// generates NOTHING. It never borrows another standard's clauses, and it never
// infers a requirement from a matching clause number.
//
// THE CLAUSE-NUMBER TRAP
// ----------------------
// Identical clause numbers across ISO standards are NOT identical
// requirements. Clause 8.3 alone means:
//     ISO 9001:2015      8.3  Design and development of products and services
//     ISO/IEC 27001:2022 8.3  Information security risk treatment
//     ISO 22301:2019     8.3  Business continuity strategies and solutions
//     ISO/IEC 20000-1    8.3  Relationship and agreement
// Improvement is numbered differently again: 27001 has 10.1 Continual
// improvement / 10.2 Nonconformity, while 22301 and 20000-1 have those two the
// other way round. Consolidation therefore keys on `shared` — a concept key —
// never on the clause number.
//
// CONTRACT
//   window.ChecklistStandards.resolve(input)        -> {standards[], unresolved[]}
//   window.ChecklistStandards.clausesFor(ids)       -> [{stdId, ref, title, ...}]
//   window.ChecklistStandards.controlsFor(id)       -> [{ref, title, theme, tier}]
//   window.ChecklistStandards.themesFor(ids)        -> [{stdId, id, label, ...}]
//   window.ChecklistStandards.consolidate(ids)      -> {common[], specific[]}
//   window.ChecklistStandards.isKnownRef(id, ref)   -> boolean
//   window.ChecklistStandards.lookupRef(ids, ref)   -> [{stdId, ref, title}]
//   window.ChecklistStandards.RECERT_PRIORITIES     -> [{id, label, shared, prompt}]

(function (global) {
    'use strict';

    // ── Shared-concept keys ───────────────────────────────────────────
    // Two clauses from different standards share a key only when the
    // REQUIREMENT is genuinely the same activity, so one question can honestly
    // evidence both. Anything whose intent differs keeps `shared: null` and is
    // audited separately, whatever its number.
    const SHARED = {
        CONTEXT_ISSUES: 'context.issues',
        CONTEXT_PARTIES: 'context.parties',
        CONTEXT_SCOPE: 'context.scope',
        CONTEXT_SYSTEM: 'context.system',
        LEAD_COMMITMENT: 'leadership.commitment',
        LEAD_POLICY: 'leadership.policy',
        LEAD_ROLES: 'leadership.roles',
        PLAN_RISK_ACTIONS: 'planning.risk-actions',
        PLAN_OBJECTIVES: 'planning.objectives',
        PLAN_CHANGES: 'planning.changes',
        SUP_RESOURCES: 'support.resources',
        SUP_COMPETENCE: 'support.competence',
        SUP_AWARENESS: 'support.awareness',
        SUP_COMMUNICATION: 'support.communication',
        SUP_DOCINFO: 'support.documented-information',
        OP_PLANNING: 'operation.planning-and-control',
        PERF_MONITORING: 'performance.monitoring',
        PERF_INTERNAL_AUDIT: 'performance.internal-audit',
        PERF_MGMT_REVIEW: 'performance.management-review',
        IMP_NONCONFORMITY: 'improvement.nonconformity-corrective-action',
        IMP_CONTINUAL: 'improvement.continual'
    };

    // Human-readable label for each consolidated group, used as the question
    // stem when more than one standard shares it.
    const SHARED_LABEL = {
        'context.issues': 'Understanding the organization and its context',
        'context.parties': 'Needs and expectations of interested parties',
        'context.scope': 'Scope of the management system(s)',
        'context.system': 'The management system and its processes',
        'leadership.commitment': 'Leadership and commitment',
        'leadership.policy': 'Policy',
        'leadership.roles': 'Roles, responsibilities and authorities',
        'planning.risk-actions': 'Actions to address risks and opportunities',
        'planning.objectives': 'Objectives and planning to achieve them',
        'planning.changes': 'Planning of changes',
        'support.resources': 'Resources',
        'support.competence': 'Competence',
        'support.awareness': 'Awareness',
        'support.communication': 'Communication',
        'support.documented-information': 'Documented information',
        'operation.planning-and-control': 'Operational planning and control',
        'performance.monitoring': 'Monitoring, measurement, analysis and evaluation',
        'performance.internal-audit': 'Internal audit',
        'performance.management-review': 'Management review',
        'improvement.nonconformity-corrective-action': 'Nonconformity and corrective action',
        'improvement.continual': 'Continual improvement'
    };

    // The auditor's question for each shared concept, used when two or more
    // selected standards genuinely share it and the requirement is therefore
    // tested once. `{systems}` is replaced with the selected systems, e.g.
    // "the ISMS, BCMS and SMS", so the consolidated question still forces the
    // auditor to see the evidence for each system rather than accepting one.
    const SHARED_PROMPT = {
        'context.issues': 'Confirm the external and internal issues relevant to {systems} are determined, reviewed and current, and that they demonstrably feed the risk assessment(s) and objectives. Establish what has changed since the previous audit.',
        'context.parties': 'Verify the interested parties relevant to {systems} and their requirements — including legal, regulatory and contractual obligations — are identified, kept current, and reflected in the requirements the organisation manages against.',
        'context.scope': 'Take the documented scope statement of each of {systems} and test its boundaries: which locations, people, technologies and interfaces are inside it, what is excluded and on what stated justification, and where one system’s boundary meets another’s. Probe an activity near the edge and establish which system owns it.',
        'context.system': 'Verify the processes needed for {systems} and their interactions are determined, that the integration between them is deliberate rather than incidental, and that each system is maintained and continually improved.',
        'leadership.commitment': 'Interview top management to establish how they demonstrate commitment to {systems}: integration into business processes, resources provided, direction given to those who contribute, and how they satisfy themselves the systems achieve their intended results.',
        'leadership.policy': 'Verify the policy for each of {systems} is established, appropriate to purpose, includes the required commitments, is available as documented information, and is communicated and understood. Note whether an integrated policy genuinely addresses each standard’s required commitments.',
        'leadership.roles': 'Confirm the roles, responsibilities and authorities for {systems} are assigned, communicated and understood — and that the people named can describe what they are accountable for. Verify reporting on performance to top management.',
        'planning.risk-actions': 'Verify risks and opportunities relevant to {systems} are determined and actioned, that the actions are proportionate and integrated into the system processes, and that their effectiveness is evaluated.',
        'planning.objectives': 'Review the objectives set for each of {systems}: measurable, consistent with policy, resourced, assigned, monitored and communicated. Verify actual achievement against target and what happened where targets were missed.',
        'planning.changes': 'Verify changes to {systems} are planned rather than incidental — establish what has changed since the previous audit and confirm the purpose, consequences, resources and responsibilities were considered before the change was made.',
        'support.resources': 'Confirm the resources needed to establish, implement, maintain and improve {systems} are determined and provided — people, infrastructure and technology — and test that against what the operation actually needs.',
        'support.competence': 'Verify competence requirements are defined for roles affecting {systems}, that competence is evidenced for a sample of people including recent joiners and role changes, and that any actions taken to acquire competence were evaluated for effect.',
        'support.awareness': 'Test awareness with staff across functions: the policy, their contribution to the effectiveness of {systems}, and the implications of not conforming. Awareness is evidenced by what people can tell you, not by an attendance sheet.',
        'support.communication': 'Verify internal and external communication relevant to {systems} is determined — what, when, with whom and how — and sample evidence that it happens as planned.',
        'support.documented-information': 'Test the control of documented information across {systems} by representative sampling: creation and update, approval, identification, version control, availability where used, and retention and disposition. Sample across systems rather than document by document.',
        'operation.planning-and-control': 'Verify the processes needed to meet the requirements of {systems} are planned, implemented and controlled, that criteria are established, and that outsourced and externally provided processes are identified and controlled.',
        'performance.monitoring': 'Confirm what is monitored and measured for {systems}, by what methods, when and by whom — then verify the results are analysed and evaluated, not merely collected. Sample the actual data for the period.',
        'performance.internal-audit': 'Verify the internal audit programme covers every requirement of each of {systems}, at planned intervals, by competent and impartial auditors. Sample audit reports for depth of evidence and confirm findings were reported to management and closed.',
        'performance.management-review': 'Verify management review is conducted at planned intervals with every required input for each of {systems}, and that the outputs include decisions on improvement, change and resources. Trace one decision through to implementation.',
        'improvement.nonconformity-corrective-action': 'Sample nonconformities raised across {systems}: reaction and correction, evaluation of the need to eliminate the cause, root cause analysis, action taken, review of effectiveness, and any change to the system. Confirm records are retained.',
        'improvement.continual': 'Establish how the organisation continually improves the suitability, adequacy and effectiveness of {systems}, and evidence improvements actually delivered since the previous audit.'
    };

    // ── ISO/IEC 27001:2022 — Information Security Management System ───
    // clause tuple: [ref, title, shared|null, mandatory]
    const ISO27001_CLAUSES = [
        ['4.1', 'Understanding the organization and its context', SHARED.CONTEXT_ISSUES, true],
        ['4.2', 'Understanding the needs and expectations of interested parties', SHARED.CONTEXT_PARTIES, true],
        ['4.3', 'Determining the scope of the information security management system', SHARED.CONTEXT_SCOPE, true],
        ['4.4', 'Information security management system', SHARED.CONTEXT_SYSTEM, true],
        ['5.1', 'Leadership and commitment', SHARED.LEAD_COMMITMENT, true],
        ['5.2', 'Policy', SHARED.LEAD_POLICY, true],
        ['5.3', 'Organizational roles, responsibilities and authorities', SHARED.LEAD_ROLES, true],
        ['6.1.1', 'Actions to address risks and opportunities — general', SHARED.PLAN_RISK_ACTIONS, true],
        ['6.1.2', 'Information security risk assessment', null, true],
        ['6.1.3', 'Information security risk treatment and Statement of Applicability', null, true],
        ['6.2', 'Information security objectives and planning to achieve them', SHARED.PLAN_OBJECTIVES, true],
        ['6.3', 'Planning of changes', SHARED.PLAN_CHANGES, true],
        ['7.1', 'Resources', SHARED.SUP_RESOURCES, true],
        ['7.2', 'Competence', SHARED.SUP_COMPETENCE, true],
        ['7.3', 'Awareness', SHARED.SUP_AWARENESS, true],
        ['7.4', 'Communication', SHARED.SUP_COMMUNICATION, true],
        ['7.5', 'Documented information', SHARED.SUP_DOCINFO, true],
        ['8.1', 'Operational planning and control', SHARED.OP_PLANNING, true],
        ['8.2', 'Information security risk assessment (performance of)', null, true],
        ['8.3', 'Information security risk treatment (implementation of)', null, true],
        ['9.1', 'Monitoring, measurement, analysis and evaluation', SHARED.PERF_MONITORING, true],
        ['9.2', 'Internal audit', SHARED.PERF_INTERNAL_AUDIT, true],
        ['9.3', 'Management review', SHARED.PERF_MGMT_REVIEW, true],
        ['10.1', 'Continual improvement', SHARED.IMP_CONTINUAL, true],
        ['10.2', 'Nonconformity and corrective action', SHARED.IMP_NONCONFORMITY, true]
    ];

    // Annex A of ISO/IEC 27001:2022 — all 93 controls.
    // tuple: [ref, title, theme, tier]  (tier 1 = sample first on a
    // recertification of an IT/cloud service provider; tier 2 = sample when
    // the SoA, risk treatment plan or previous findings point at it)
    const ISO27001_ANNEX_A = [
        // A.5 Organizational controls (37)
        ['A.5.1', 'Policies for information security', 'governance', 1],
        ['A.5.2', 'Information security roles and responsibilities', 'governance', 1],
        ['A.5.3', 'Segregation of duties', 'governance', 2],
        ['A.5.4', 'Management responsibilities', 'governance', 2],
        ['A.5.5', 'Contact with authorities', 'incident', 2],
        ['A.5.6', 'Contact with special interest groups', 'incident', 2],
        ['A.5.7', 'Threat intelligence', 'vulnerability', 2],
        ['A.5.8', 'Information security in project management', 'change', 2],
        ['A.5.9', 'Inventory of information and other associated assets', 'asset', 1],
        ['A.5.10', 'Acceptable use of information and other associated assets', 'asset', 1],
        ['A.5.11', 'Return of assets', 'hr-access', 2],
        ['A.5.12', 'Classification of information', 'asset', 1],
        ['A.5.13', 'Labelling of information', 'asset', 2],
        ['A.5.14', 'Information transfer', 'asset', 2],
        ['A.5.15', 'Access control', 'hr-access', 1],
        ['A.5.16', 'Identity management', 'hr-access', 1],
        ['A.5.17', 'Authentication information', 'hr-access', 1],
        ['A.5.18', 'Access rights', 'hr-access', 1],
        ['A.5.19', 'Information security in supplier relationships', 'supplier', 1],
        ['A.5.20', 'Addressing information security within supplier agreements', 'supplier', 1],
        ['A.5.21', 'Managing information security in the ICT supply chain', 'supplier', 2],
        ['A.5.22', 'Monitoring, review and change management of supplier services', 'supplier', 1],
        ['A.5.23', 'Information security for use of cloud services', 'cloud', 1],
        ['A.5.24', 'Information security incident management planning and preparation', 'incident', 1],
        ['A.5.25', 'Assessment and decision on information security events', 'incident', 1],
        ['A.5.26', 'Response to information security incidents', 'incident', 1],
        ['A.5.27', 'Learning from information security incidents', 'incident', 1],
        ['A.5.28', 'Collection of evidence', 'incident', 2],
        ['A.5.29', 'Information security during disruption', 'continuity', 1],
        ['A.5.30', 'ICT readiness for business continuity', 'continuity', 1],
        ['A.5.31', 'Legal, statutory, regulatory and contractual requirements', 'compliance', 1],
        ['A.5.32', 'Intellectual property rights', 'compliance', 2],
        ['A.5.33', 'Protection of records', 'compliance', 2],
        ['A.5.34', 'Privacy and protection of PII', 'compliance', 1],
        ['A.5.35', 'Independent review of information security', 'governance', 1],
        ['A.5.36', 'Compliance with policies, rules and standards for information security', 'compliance', 1],
        ['A.5.37', 'Documented operating procedures', 'governance', 2],
        // A.6 People controls (8)
        ['A.6.1', 'Screening', 'hr-access', 1],
        ['A.6.2', 'Terms and conditions of employment', 'hr-access', 2],
        ['A.6.3', 'Information security awareness, education and training', 'hr-access', 1],
        ['A.6.4', 'Disciplinary process', 'hr-access', 2],
        ['A.6.5', 'Responsibilities after termination or change of employment', 'hr-access', 1],
        ['A.6.6', 'Confidentiality or non-disclosure agreements', 'supplier', 2],
        ['A.6.7', 'Remote working', 'hr-access', 1],
        ['A.6.8', 'Information security event reporting', 'incident', 1],
        // A.7 Physical controls (14)
        ['A.7.1', 'Physical security perimeters', 'physical', 1],
        ['A.7.2', 'Physical entry', 'physical', 1],
        ['A.7.3', 'Securing offices, rooms and facilities', 'physical', 2],
        ['A.7.4', 'Physical security monitoring', 'physical', 2],
        ['A.7.5', 'Protecting against physical and environmental threats', 'physical', 2],
        ['A.7.6', 'Working in secure areas', 'physical', 2],
        ['A.7.7', 'Clear desk and clear screen', 'physical', 2],
        ['A.7.8', 'Equipment siting and protection', 'physical', 2],
        ['A.7.9', 'Security of assets off-premises', 'physical', 2],
        ['A.7.10', 'Storage media', 'physical', 2],
        ['A.7.11', 'Supporting utilities', 'physical', 2],
        ['A.7.12', 'Cabling security', 'physical', 2],
        ['A.7.13', 'Equipment maintenance', 'physical', 2],
        ['A.7.14', 'Secure disposal or re-use of equipment', 'physical', 2],
        // A.8 Technological controls (34)
        ['A.8.1', 'User endpoint devices', 'endpoint', 1],
        ['A.8.2', 'Privileged access rights', 'hr-access', 1],
        ['A.8.3', 'Information access restriction', 'hr-access', 1],
        ['A.8.4', 'Access to source code', 'development', 2],
        ['A.8.5', 'Secure authentication', 'hr-access', 1],
        ['A.8.6', 'Capacity management', 'operations', 1],
        ['A.8.7', 'Protection against malware', 'endpoint', 1],
        ['A.8.8', 'Management of technical vulnerabilities', 'vulnerability', 1],
        ['A.8.9', 'Configuration management', 'change', 1],
        ['A.8.10', 'Information deletion', 'asset', 2],
        ['A.8.11', 'Data masking', 'asset', 2],
        ['A.8.12', 'Data leakage prevention', 'asset', 2],
        ['A.8.13', 'Information backup', 'continuity', 1],
        ['A.8.14', 'Redundancy of information processing facilities', 'continuity', 1],
        ['A.8.15', 'Logging', 'monitoring', 1],
        ['A.8.16', 'Monitoring activities', 'monitoring', 1],
        ['A.8.17', 'Clock synchronization', 'monitoring', 2],
        ['A.8.18', 'Use of privileged utility programs', 'hr-access', 2],
        ['A.8.19', 'Installation of software on operational systems', 'change', 2],
        ['A.8.20', 'Networks security', 'network', 1],
        ['A.8.21', 'Security of network services', 'network', 2],
        ['A.8.22', 'Segregation of networks', 'network', 2],
        ['A.8.23', 'Web filtering', 'network', 2],
        ['A.8.24', 'Use of cryptography', 'crypto', 1],
        ['A.8.25', 'Secure development life cycle', 'development', 2],
        ['A.8.26', 'Application security requirements', 'development', 2],
        ['A.8.27', 'Secure system architecture and engineering principles', 'development', 2],
        ['A.8.28', 'Secure coding', 'development', 2],
        ['A.8.29', 'Security testing in development and acceptance', 'development', 2],
        ['A.8.30', 'Outsourced development', 'development', 2],
        ['A.8.31', 'Separation of development, test and production environments', 'development', 2],
        ['A.8.32', 'Change management', 'change', 1],
        ['A.8.33', 'Test information', 'development', 2],
        ['A.8.34', 'Protection of information systems during audit testing', 'monitoring', 2]
    ];

    // What an auditor actually does to sample a control, by control theme.
    // A single "verify this control is implemented" template repeated across
    // twenty controls is the same repetition the clause dump had — it tells the
    // auditor nothing they could not read off the control title.
    const CONTROL_THEME_PROMPT = {
        governance: 'Establish who owns it, when it was last reviewed and approved, and how the organisation knows it is being followed. Ask for the review record, not the document.',
        incident: 'Trace a real event from detection to closure and check this control did its part — timing, decision, record and the handover to the next step.',
        vulnerability: 'Take the current findings list and check this control against it: how the weakness was identified, what the agreed remediation window was, and whether it was met or formally accepted.',
        change: 'Pick a change that went into production this period and follow it through this control — what was assessed, who authorised it, and what the record shows afterwards.',
        asset: 'Pick two assets holding information in the certified scope and test this control on them, including whether the register reflects reality rather than the last time someone tidied it.',
        'hr-access': 'Take named individuals — a recent joiner, a mover and a leaver — and test this control against their actual accounts and entitlements on the day of the audit.',
        supplier: 'Take a supplier with access to information in scope and test this control against the signed agreement and the last performance or assurance review.',
        cloud: 'Test this control on the live tenant with the administrator present: what is configured now, who can change it, and how a drift from the agreed baseline would be noticed.',
        continuity: 'Ask for the last successful test or invocation and check this control against the evidence it produced — the result, not the schedule.',
        compliance: 'Identify the obligation this control serves, then check the organisation can show it is met today and knows when the obligation last changed.',
        physical: 'Walk the area and observe this control operating, then compare what you see against the access records and the alarm or monitoring log for the period.',
        endpoint: 'Take devices in current use and check this control on them directly — enrolment, configuration and current status — against the fleet report.',
        monitoring: 'Follow one alert or log entry from generation to the action it caused, and check retention, protection and who is accountable for reviewing it.',
        network: 'Review the current configuration against the approved design, and check how an unauthorised change to it would be detected.',
        crypto: 'Identify where this control applies in the services in scope, verify the algorithms and key handling in use, and confirm who holds key management responsibility.',
        development: 'Take a recent piece of work through this control — the requirement, the check performed, the evidence retained, and what happened when it failed.',
        operations: 'Test this control against the current operational data for the period and confirm the thresholds that trigger action are defined and were acted on.'
    };

    // ── ISO 22301:2019 — Business Continuity Management System ────────
    const ISO22301_CLAUSES = [
        ['4.1', 'Understanding the organization and its context', SHARED.CONTEXT_ISSUES, true],
        ['4.2', 'Understanding the needs and expectations of interested parties', SHARED.CONTEXT_PARTIES, true],
        ['4.3', 'Determining the scope of the business continuity management system', SHARED.CONTEXT_SCOPE, true],
        ['4.4', 'Business continuity management system', SHARED.CONTEXT_SYSTEM, true],
        ['5.1', 'Leadership and commitment', SHARED.LEAD_COMMITMENT, true],
        ['5.2', 'Policy', SHARED.LEAD_POLICY, true],
        ['5.3', 'Roles, responsibilities and authorities', SHARED.LEAD_ROLES, true],
        ['6.1', 'Actions to address risks and opportunities', SHARED.PLAN_RISK_ACTIONS, true],
        ['6.2', 'Business continuity objectives and planning to achieve them', SHARED.PLAN_OBJECTIVES, true],
        ['6.3', 'Planning changes to the business continuity management system', SHARED.PLAN_CHANGES, true],
        ['7.1', 'Resources', SHARED.SUP_RESOURCES, true],
        ['7.2', 'Competence', SHARED.SUP_COMPETENCE, true],
        ['7.3', 'Awareness', SHARED.SUP_AWARENESS, true],
        ['7.4', 'Communication', SHARED.SUP_COMMUNICATION, true],
        ['7.5', 'Documented information', SHARED.SUP_DOCINFO, true],
        ['8.1', 'Operational planning and control', SHARED.OP_PLANNING, true],
        ['8.2.2', 'Business impact analysis', null, true],
        ['8.2.3', 'Risk assessment', null, true],
        ['8.3', 'Business continuity strategies and solutions', null, true],
        ['8.4', 'Business continuity plans and procedures', null, true],
        ['8.4.2', 'Response structure', null, true],
        ['8.4.3', 'Warning and communication', null, true],
        ['8.5', 'Exercise programme', null, true],
        ['8.6', 'Evaluation of business continuity documentation and capabilities', null, true],
        ['9.1', 'Monitoring, measurement, analysis and evaluation', SHARED.PERF_MONITORING, true],
        ['9.2', 'Internal audit', SHARED.PERF_INTERNAL_AUDIT, true],
        ['9.3', 'Management review', SHARED.PERF_MGMT_REVIEW, true],
        ['10.1', 'Nonconformity and corrective action', SHARED.IMP_NONCONFORMITY, true],
        ['10.2', 'Continual improvement', SHARED.IMP_CONTINUAL, true]
    ];

    // ── ISO/IEC 20000-1:2018 — Service Management System ──────────────
    const ISO20000_CLAUSES = [
        ['4.1', 'Understanding the organization and its context', SHARED.CONTEXT_ISSUES, true],
        ['4.2', 'Understanding the needs and expectations of interested parties', SHARED.CONTEXT_PARTIES, true],
        ['4.3', 'Determining the scope of the service management system', SHARED.CONTEXT_SCOPE, true],
        ['4.4', 'Service management system', SHARED.CONTEXT_SYSTEM, true],
        ['5.1', 'Leadership and commitment', SHARED.LEAD_COMMITMENT, true],
        ['5.2', 'Policy', SHARED.LEAD_POLICY, true],
        ['5.3', 'Organizational roles, responsibilities and authorities', SHARED.LEAD_ROLES, true],
        ['6.1', 'Actions to address risks and opportunities', SHARED.PLAN_RISK_ACTIONS, true],
        ['6.2', 'Service management objectives and planning to achieve them', SHARED.PLAN_OBJECTIVES, true],
        ['6.3', 'Plan the service management system', SHARED.PLAN_CHANGES, true],
        ['7.1', 'Resources', SHARED.SUP_RESOURCES, true],
        ['7.2', 'Competence', SHARED.SUP_COMPETENCE, true],
        ['7.3', 'Awareness', SHARED.SUP_AWARENESS, true],
        ['7.4', 'Communication', SHARED.SUP_COMMUNICATION, true],
        ['7.5', 'Documented information', SHARED.SUP_DOCINFO, true],
        ['7.6', 'Knowledge', null, true],
        ['8.1', 'Operational planning and control', SHARED.OP_PLANNING, true],
        ['8.2.1', 'Service delivery', null, true],
        ['8.2.2', 'Plan the services', null, true],
        ['8.2.3', 'Control of parties involved in the service lifecycle', null, true],
        ['8.2.4', 'Service catalogue management', null, true],
        ['8.2.5', 'Asset management', null, true],
        ['8.2.6', 'Configuration management', null, true],
        ['8.3.2', 'Business relationship management', null, true],
        ['8.3.3', 'Service level management', null, true],
        ['8.3.4', 'Supplier management', null, true],
        ['8.4.1', 'Budgeting and accounting for services', null, true],
        ['8.4.2', 'Demand management', null, true],
        ['8.4.3', 'Capacity management', null, true],
        ['8.5.1', 'Change management', null, true],
        ['8.5.2', 'Service design and transition', null, true],
        ['8.5.3', 'Release and deployment management', null, true],
        ['8.6.1', 'Incident management', null, true],
        ['8.6.2', 'Service request management', null, true],
        ['8.6.3', 'Problem management', null, true],
        ['8.7.1', 'Service availability management', null, true],
        ['8.7.2', 'Service continuity management', null, true],
        ['8.7.3', 'Information security management', null, true],
        ['9.1', 'Monitoring, measurement, analysis and evaluation', SHARED.PERF_MONITORING, true],
        ['9.2', 'Internal audit', SHARED.PERF_INTERNAL_AUDIT, true],
        ['9.3', 'Management review', SHARED.PERF_MGMT_REVIEW, true],
        ['9.4', 'Service reporting', null, true],
        ['10.1', 'Nonconformity and corrective action', SHARED.IMP_NONCONFORMITY, true],
        ['10.2', 'Continual improvement', SHARED.IMP_CONTINUAL, true]
    ];

    // ── Process-based operational themes ──────────────────────────────
    // These are what an auditor actually walks: the operation, not the
    // paperwork. Each theme names the clause(s)/control(s) of ITS OWN standard
    // that it evidences, so a theme can never be generated for a standard that
    // is not in the audit scope.
    // tuple: [id, label, refs[], prompt]
    const ISO27001_THEMES = [
        ['isms-risk', 'Information security risk assessment and treatment', ['6.1.2', '6.1.3', '8.2', '8.3'],
            'Walk the current information security risk assessment: confirm the criteria are applied consistently, risk owners are named, the treatment plan is approved by risk owners, and the Statement of Applicability agrees with the treatments actually in place. Trace two treated risks through to implemented controls and residual risk acceptance.'],
        ['isms-soa', 'Statement of Applicability and control implementation', ['6.1.3'],
            'Confirm the Statement of Applicability is current, states inclusion/exclusion justification for every Annex A control, and matches the controls sampled during this audit. Note any control marked applicable but not evidenced.'],
        ['isms-access', 'Access lifecycle — joiners, movers, leavers and privileged access', ['A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.6.1', 'A.6.5', 'A.8.2', 'A.8.5'],
            'Sample joiners, movers and leavers since the previous audit: verify screening before access, access granted against an approved role, privileged accounts justified and reviewed, and access removed on the leaving date. Confirm the periodic access review has been performed for the systems in scope.'],
        ['isms-cloud', 'Cloud services security', ['A.5.23', 'A.5.19', 'A.5.20', 'A.5.22'],
            'For the cloud platforms in the certified scope, verify the security requirements were defined before adoption, the shared responsibility split is documented and understood, tenant and administrative access is controlled, and the provider’s performance and security posture is monitored.'],
        ['isms-supplier', 'Supplier and ICT supply chain security', ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.6.6'],
            'Sample suppliers with access to information or systems in scope: verify security requirements are in the agreement, the supplier is assessed on a defined cycle, and changes to the supplied service go through review.'],
        ['isms-vuln', 'Technical vulnerability and patch management', ['A.8.8', 'A.5.7', 'A.8.9'],
            'Trace vulnerability identification through to remediation for the period: confirm sources are monitored, severity drives the remediation timescale, exceptions are risk-accepted and time-bound, and the current backlog is within the organisation’s own thresholds.'],
        ['isms-incident', 'Information security incident management', ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.6.8'],
            'Sample information security events and incidents recorded since the previous audit: verify classification against the defined criteria, response within the defined timescales, notification obligations met, and lessons learned fed back into controls or risk assessment.'],
        ['isms-backup', 'Backup, logging and monitoring', ['A.8.13', 'A.8.15', 'A.8.16', 'A.8.14'],
            'Verify backups are performed and restore-tested for the systems in scope, that security-relevant logs are generated, protected and retained, and that monitoring produces alerts someone actually acts on — sample one alert through to closure.'],
        ['isms-crypto', 'Cryptography and secure configuration', ['A.8.24', 'A.8.9', 'A.8.20'],
            'Confirm the cryptographic policy is applied to data at rest and in transit for the services in scope, key management responsibilities are assigned, and system hardening baselines are defined and monitored for drift.']
    ];

    const ISO22301_THEMES = [
        ['bcms-bia', 'Business impact analysis', ['8.2.2'],
            'Verify the BIA is current, covers the prioritised activities in the certified scope, and derives RTOs, RPOs and minimum business continuity objectives from stated impact criteria. Confirm dependencies (people, ICT, suppliers, facilities) are identified for each prioritised activity.'],
        ['bcms-risk', 'Business continuity risk assessment', ['8.2.3'],
            'Confirm disruption risks to prioritised activities and their resources are assessed and treated, and that the assessment is consistent with the BIA outputs.'],
        ['bcms-strategy', 'Continuity strategies and solutions', ['8.3'],
            'Verify the selected continuity strategies and solutions meet the RTOs from the BIA, that the resource requirements are provided for, and that the solutions are actually implemented — not just documented.'],
        ['bcms-plans', 'Business continuity plans and response structure', ['8.4', '8.4.2', '8.4.3'],
            'Sample the business continuity and incident response plans: confirm the response structure, roles and triggers are defined, plans name the activities they recover and within what timeframe, and the warning and communication arrangements cover interested parties.'],
        ['bcms-exercise', 'Exercise programme and evaluation', ['8.5', '8.6'],
            'Review the exercises performed since the previous audit against the exercise programme: confirm objectives, scope, post-exercise reports, findings raised, and that the resulting corrective actions were implemented and re-evaluated.'],
        ['bcms-disruption', 'Actual disruptions and invocation', ['8.4', '10.1'],
            'For any actual disruption or plan invocation since the previous audit, verify the response followed the plan, achieved times were measured against RTO/RPO, and the post-incident review produced improvement actions.']
    ];

    const ISO20000_THEMES = [
        ['sms-slm', 'Service level management and service catalogue', ['8.3.3', '8.2.4'],
            'Sample the current SLAs and the service catalogue: confirm they are agreed with the customer, the targets are measurable, actual performance is measured against them for the period, and shortfalls are reviewed with the customer.'],
        ['sms-incident', 'Incident management', ['8.6.1'],
            'Sample incidents across the period including at least one major incident: verify recording, classification, prioritisation, escalation, resolution within target, customer communication and closure.'],
        ['sms-request', 'Service request fulfilment', ['8.6.2'],
            'Sample service requests: verify they are fulfilled through the defined procedure, within the agreed target, and are distinguishable from incidents in the records.'],
        ['sms-problem', 'Problem management', ['8.6.3'],
            'Verify problems are identified from incident trends, root cause analysis is performed, known errors are recorded, and permanent fixes are implemented and measured for effect.'],
        ['sms-change', 'Change management', ['8.5.1'],
            'Sample changes including at least one emergency change: verify assessment, authorisation by the defined authority, testing, back-out planning, scheduling, and post-implementation review. Confirm unsuccessful changes are analysed.'],
        ['sms-release', 'Release and deployment management', ['8.5.3'],
            'Sample releases deployed since the previous audit: verify acceptance criteria, release records, deployment into the live environment, and verification that the release achieved its intended outcome.'],
        ['sms-config', 'Configuration and asset management', ['8.2.5', '8.2.6'],
            'Verify configuration items in scope are recorded with the defined attributes and relationships, the CMDB is verified at planned intervals, and discrepancies are corrected. Trace one live service to its configuration items.'],
        ['sms-capacity', 'Capacity and availability management', ['8.4.3', '8.7.1'],
            'Verify capacity and availability requirements are agreed, monitored against target, and forecast — and that capacity or availability shortfalls result in planned action.'],
        ['sms-continuity', 'Service continuity management', ['8.7.2'],
            'Verify service continuity requirements are agreed with customers, plans exist for the services in scope, and continuity plans are tested at planned intervals with results acted on.'],
        ['sms-supplier', 'Supplier management and parties in the service lifecycle', ['8.3.4', '8.2.3'],
            'Sample external suppliers and any internal supplier or customer acting as a supplier: verify documented agreements, defined interfaces, performance monitored against agreed targets, and disputes and escalations handled through the defined route.'],
        ['sms-brm', 'Business relationship management and customer satisfaction', ['8.3.2'],
            'Verify the customer relationship is managed through a named contact, service performance is reviewed with customers at planned intervals, complaints are handled through a defined route, and customer satisfaction is measured and acted on.'],
        ['sms-reporting', 'Service reporting', ['9.4'],
            'Verify service reports are produced as agreed, contain the agreed content and are used for decision making — trace one reported shortfall to the action it triggered.'],
        ['sms-security', 'Information security management within the SMS', ['8.7.3'],
            'Verify the information security controls applied to the services in scope are defined, implemented and operated as part of service delivery.'],
        ['sms-budget', 'Budgeting and accounting for services', ['8.4.1'],
            'Verify service costs are budgeted, tracked against actuals and accounted for at the level defined by the organisation.']
    ];

    // ── Recertification / surveillance priorities ─────────────────────
    // ISO/IEC 17021-1 puts these at the front of a recertification: they are
    // where the evidence of a working system lives. `shared` names the concept
    // the question evidences; the generator resolves it to the real clause
    // number of each selected standard, so nothing is invented. A null `shared`
    // means no single clause owns it — the item carries no citation rather than
    // a guessed one.
    // tuple: [id, label, shared|null, prompt, refsBy|null]
    // `refsBy` carries an explicit per-standard citation for a priority that no
    // single shared concept owns. A priority with neither `shared` nor `refsBy`
    // is handed to the auditor without a citation rather than given a guessed
    // one (see the "never invent a reference" rule).
    const RECERT_PRIORITIES = [
        ['prev-findings', 'Previous audit findings and their corrective actions',
            SHARED.IMP_NONCONFORMITY,
            'Review every nonconformity, observation and opportunity for improvement raised at the previous audits in this certification cycle. Verify root cause analysis, action taken, evidence of implementation, and the organisation’s own verification of effectiveness. Confirm no finding has recurred.',
            null],
        ['changes', 'Changes since the previous audit',
            SHARED.PLAN_CHANGES,
            'Establish what has changed since the previous audit — scope, sites, services, technology platforms, key personnel, suppliers, legal and regulatory requirements, and the risk profile. Verify each change was planned and assessed for its effect on the management system(s) before it was made.',
            null],
        ['objectives', 'Objectives, KPIs and achievement over the cycle',
            SHARED.PLAN_OBJECTIVES,
            'Review the objectives set for each management system in scope over the certification cycle: confirm they are measurable, resourced and assigned, review actual achievement against target, and verify that missed targets triggered action.',
            null],
        ['risk-treatment', 'Risk assessment and treatment currency',
            SHARED.PLAN_RISK_ACTIONS,
            'Confirm the risk assessment(s) have been reviewed and updated over the cycle, that treatments are implemented and their effectiveness evaluated, and that changes in the operating environment are reflected.',
            null],
        ['incidents', 'Incidents, disruptions and complaints over the cycle',
            null,
            'Review incidents, disruptions, security events and complaints across the certification cycle. Verify handling against the organisation’s own procedure, trend analysis, and whether the resulting actions reduced recurrence.',
            { iso27001: ['A.5.26', 'A.5.27'], iso22301: ['8.4'], iso20000: ['8.6.1', '8.6.3'] }],
        ['internal-audit', 'Internal audit programme across the cycle',
            SHARED.PERF_INTERNAL_AUDIT,
            'Verify the internal audit programme covered every requirement of every certified standard, every site and every process over the certification cycle, that auditors were competent and impartial, and that findings were closed. Sample two internal audit reports for depth of evidence.',
            null],
        ['mgmt-review', 'Management review across the cycle',
            SHARED.PERF_MGMT_REVIEW,
            'Verify management reviews were held at planned intervals with all required inputs for each certified standard, and that the outputs include decisions on improvement, resources and any change to the system. Trace one decision through to implementation.',
            null],
        ['effectiveness', 'Overall effectiveness of the management system(s)',
            SHARED.PERF_MONITORING,
            'Assess whether the management system(s) as a whole are achieving the intended results and continue to be suitable for the certified scope — drawing on objectives, findings, incidents, customer and service performance, and the trend across the cycle.',
            null],
        ['follow-up', 'Areas requiring follow-up from the previous audit',
            null,
            'Cover every area the previous audit team flagged for attention at the next audit. Record the outcome for each.',
            null]
    ];

    // ── Registry ──────────────────────────────────────────────────────
    function expandClauses(stdId, rows) {
        return rows.map(([ref, title, shared, mandatory]) => ({
            stdId, ref, title, shared: shared || null, mandatory: mandatory !== false, kind: 'clause'
        }));
    }

    function expandControls(stdId, rows) {
        return rows.map(([ref, title, theme, tier]) => ({
            stdId, ref, title, theme, tier: tier || 2, kind: 'control'
        }));
    }

    function expandThemes(stdId, rows) {
        return rows.map(([id, label, refs, prompt]) => ({ stdId, id, label, refs: refs.slice(), prompt }));
    }

    const STANDARDS = [
        {
            id: 'iso27001',
            label: 'ISO/IEC 27001:2022',
            systemLabel: 'ISMS',
            systemNoun: 'information security management system',
            // Deliberately anchored on the number alone. ISO/IEC 27002 is a
            // guidance document, not a certifiable standard, so it is not
            // matched here and cannot pull Annex A in through the back door.
            match: /\b27001\b/,
            family: 'annex-sl',
            clauses: expandClauses('iso27001', ISO27001_CLAUSES),
            controls: expandControls('iso27001', ISO27001_ANNEX_A),
            themes: expandThemes('iso27001', ISO27001_THEMES),
            hasSoA: true,
            // Citations for the organisation-context questions (certified scope,
            // sites, processes, outsourced processes). Only refs this standard
            // genuinely has — a null means this standard has no clause for that
            // question and simply does not appear in its citation.
            orgRefs: { scope: '4.3', site: '4.3', process: '8.1', outsourced: 'A.5.19' }
        },
        {
            id: 'iso22301',
            label: 'ISO 22301:2019',
            systemLabel: 'BCMS',
            systemNoun: 'business continuity management system',
            match: /\b22301\b/,
            family: 'annex-sl',
            clauses: expandClauses('iso22301', ISO22301_CLAUSES),
            controls: [],
            themes: expandThemes('iso22301', ISO22301_THEMES),
            hasSoA: false,
            // ISO 22301 has no supplier-control clause of its own — dependencies
            // on external providers are handled inside 8.2.2/8.3 rather than a
            // dedicated requirement, so `outsourced` is deliberately null.
            orgRefs: { scope: '4.3', site: '4.3', process: '8.1', outsourced: null }
        },
        {
            id: 'iso20000',
            label: 'ISO/IEC 20000-1:2018',
            systemLabel: 'SMS',
            systemNoun: 'service management system',
            match: /\b20000(-1)?\b/,
            family: 'annex-sl',
            clauses: expandClauses('iso20000', ISO20000_CLAUSES),
            controls: [],
            themes: expandThemes('iso20000', ISO20000_THEMES),
            hasSoA: false,
            orgRefs: { scope: '4.3', site: '4.3', process: '8.1', outsourced: '8.3.4' }
        }
    ];

    const BY_ID = {};
    STANDARDS.forEach(s => { BY_ID[s.id] = s; });

    /**
     * Split whatever the client record / audit plan calls the standard into the
     * individual standards actually selected for this engagement.
     *
     * Accepts an array, or the comma-separated string the client record uses
     * ("ISO 27001:2022, ISO 22301:2019, ISO/IEC 20000-1:2018"). A token that
     * does not match a registered standard is returned in `unresolved` and
     * generates nothing — it is never quietly mapped onto another standard.
     *
     * @param {string|string[]} input
     * @returns {{standards: Array, unresolved: string[]}}
     */
    function resolve(input) {
        const tokens = (Array.isArray(input) ? input : String(input || '').split(/[,;]|\s+and\s+/i))
            .map(s => String(s || '').trim())
            .filter(Boolean);
        const standards = [];
        const unresolved = [];
        tokens.forEach(tok => {
            // A registry id ("iso27001") resolves directly — the display-name
            // regexes are word-boundary anchored and would not match it.
            const hit = BY_ID[tok] || STANDARDS.find(s => s.match.test(tok));
            if (hit) {
                if (!standards.some(s => s.id === hit.id)) standards.push(hit);
            } else if (!unresolved.includes(tok)) {
                unresolved.push(tok);
            }
        });
        return { standards, unresolved };
    }

    /** Every registered standard, for a picker. */
    function all() { return STANDARDS.slice(); }

    function byId(id) { return BY_ID[id] || null; }

    function normIds(ids) {
        const list = Array.isArray(ids) ? ids : [ids];
        return list.map(x => (x && x.id) ? x.id : String(x || '')).filter(id => BY_ID[id]);
    }

    /** Flat clause list across the given standard ids, in registry order. */
    function clausesFor(ids) {
        return normIds(ids).reduce((out, id) => out.concat(BY_ID[id].clauses), []);
    }

    /** Annex A controls for a standard that has them; [] otherwise. */
    function controlsFor(id) {
        const s = BY_ID[id];
        return s && s.controls ? s.controls.slice() : [];
    }

    function themesFor(ids) {
        return normIds(ids).reduce((out, id) => out.concat(BY_ID[id].themes), []);
    }

    /**
     * Is `ref` a real clause or Annex A control of `stdId`?
     * The QA pass uses this to reject any citation the generator could not
     * substantiate — including a clause number that exists in a DIFFERENT
     * standard (9001's 8.3 in a 27001-only audit, for instance).
     */
    function isKnownRef(stdId, ref) {
        const s = BY_ID[stdId];
        if (!s || !ref) return false;
        const r = String(ref).trim();
        return s.clauses.some(c => c.ref === r) || (s.controls || []).some(c => c.ref === r);
    }

    /** Every standard in `ids` that genuinely has this ref, with its own title. */
    function lookupRef(ids, ref) {
        const r = String(ref || '').trim();
        const out = [];
        normIds(ids).forEach(id => {
            const s = BY_ID[id];
            const hit = s.clauses.find(c => c.ref === r) || (s.controls || []).find(c => c.ref === r);
            if (hit) out.push({ stdId: id, label: s.label, ref: hit.ref, title: hit.title, kind: hit.kind });
        });
        return out;
    }

    /** Sort key that keeps a checklist reading 4 -> 10, with Annex A last. */
    function rank(c) {
        const isControl = String(c.ref).indexOf('A.') === 0;
        const parts = String(c.ref).replace(/^A\./, '').split('.').map(Number);
        return (isControl ? 1000 : 0) +
            parts.reduce((t, n, i) => t + (isNaN(n) ? 0 : n) / Math.pow(100, i), 0);
    }

    /**
     * Split the selected standards' clauses into what an integrated audit can
     * legitimately test once, and what has to stay separate.
     *
     * `common` groups clauses that share a concept key across TWO OR MORE
     * selected standards — one question, citing each standard's own clause
     * number. A shared clause held by only one selected standard stays in
     * `specific`, because there is nothing to consolidate it with.
     *
     * @param {string[]} ids
     * @returns {{common: Array, specific: Array}}
     */
    function consolidate(ids) {
        const list = normIds(ids);
        const groups = {};
        const specific = [];
        clausesFor(list).forEach(c => {
            if (!c.shared) { specific.push(c); return; }
            if (!groups[c.shared]) {
                groups[c.shared] = { shared: c.shared, label: SHARED_LABEL[c.shared] || c.title, members: [] };
            }
            groups[c.shared].members.push(c);
        });
        const common = [];
        Object.keys(groups).forEach(key => {
            const g = groups[key];
            const distinctStds = new Set(g.members.map(m => m.stdId));
            if (distinctStds.size >= 2) common.push(g);
            else g.members.forEach(m => specific.push(m));
        });
        common.sort((a, b) => rank(a.members[0]) - rank(b.members[0]));
        specific.sort((a, b) => rank(a) - rank(b) || a.stdId.localeCompare(b.stdId));
        return { common, specific };
    }

    /** Display citation, e.g. "ISO/IEC 27001:2022 4.1 / ISO 22301:2019 4.1". */
    function citation(members) {
        return (members || [])
            .map(m => `${BY_ID[m.stdId] ? BY_ID[m.stdId].label : m.stdId} ${m.ref}`)
            .join(' / ');
    }

    /** "the ISMS, BCMS and SMS" — for the consolidated question stems. */
    function systemsPhrase(ids) {
        const labels = normIds(ids).map(id => BY_ID[id].systemLabel);
        if (!labels.length) return 'the management system';
        if (labels.length === 1) return `the ${labels[0]}`;
        return `the ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
    }

    /**
     * What this scope actually needs audited, before any client documents are
     * looked at. This is THE answer to "which questions exist" — the standard
     * requirement comes first, and a document can only ever attach evidence to
     * a question this function already produced.
     *
     * `residual` is the standard-specific clauses that the process-based themes
     * do NOT already walk. A theme is the real audit question for the clauses
     * it names, so re-asking those clauses as bare recitals is exactly the
     * repetition that made the old checklist unusable.
     *
     * @param {string[]} ids
     * @returns {{common, specific, residual, themes, themeCovered:Set}}
     */
    function planScope(ids) {
        const list = normIds(ids);
        const { common, specific } = consolidate(list);
        const themes = themesFor(list);
        const themeCovered = new Set();
        themes.forEach(t => t.refs.forEach(r => themeCovered.add(`${t.stdId}::${r}`)));
        const residual = specific.filter(c => !themeCovered.has(`${c.stdId}::${c.ref}`));
        return { common, specific, residual, themes, themeCovered };
    }

    const API = {
        SHARED,
        SHARED_LABEL,
        SHARED_PROMPT,
        CONTROL_THEME_PROMPT,
        RECERT_PRIORITIES: RECERT_PRIORITIES.map(([id, label, shared, prompt, refsBy]) =>
            ({ id, label, shared, prompt, refsBy: refsBy || null })),
        all,
        byId,
        resolve,
        clausesFor,
        controlsFor,
        themesFor,
        consolidate,
        planScope,
        systemsPhrase,
        isKnownRef,
        lookupRef,
        citation,
        rank
    };

    global.ChecklistStandards = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (global.Logger) global.Logger.debug('Modules', 'checklist-standards.js loaded successfully.');
})(typeof window !== 'undefined' ? window : globalThis);
