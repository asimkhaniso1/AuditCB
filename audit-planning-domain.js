(function (global) {
    'use strict';

    const POLICY_VERSION = 'audit-planning-policy-v1';
    const PLAN_STATES = ['Draft', 'Validated', 'Scheduled', 'Completed', 'Approved', 'Closed'];
    const DEFAULT_POLICY = Object.freeze({
        version: POLICY_VERSION,
        developmentPlaceholder: true,
        recertificationWindowLeadDays: 60,
        surveillanceWindowBeforeDays: 30,
        surveillanceWindowAfterDays: 30,
        ncClosureBufferDays: 30,
        expiryWarningDays: 90,
        expiryCriticalDays: 45,
        criticalTimingBehavior: 'override-required',
        expiredCertificateBehavior: 'block',
        workingHoursPerDay: 8,
        overrideRoles: ['Admin', 'Certification Manager', 'Cert Manager']
    });
    const DEFAULT_DURATION_VERSION = 'Audit360 default v1';
    const DEFAULT_IMS_RULE = Object.freeze({
        name: 'Audit360 default integrated-audit rule',
        version: DEFAULT_DURATION_VERSION,
        defaultAdjustmentPercent: 0,
        maximumReductionPercent: 0,
        maximumIncreasePercent: 0,
        justificationRequired: true,
        builtInDefault: true
    });
    const DEFAULT_DURATION_TABLES = Object.freeze({
        'Surveillance 1': Object.freeze([
            { minEmployees: 1, maxEmployees: 25, days: 0.5 }, { minEmployees: 26, maxEmployees: 100, days: 1 },
            { minEmployees: 101, maxEmployees: 250, days: 1.5 }, { minEmployees: 251, maxEmployees: 500, days: 2 },
            { minEmployees: 501, maxEmployees: null, days: 2.5 }
        ]),
        'Surveillance 2': Object.freeze([
            { minEmployees: 1, maxEmployees: 25, days: 0.5 }, { minEmployees: 26, maxEmployees: 100, days: 1 },
            { minEmployees: 101, maxEmployees: 250, days: 1.5 }, { minEmployees: 251, maxEmployees: 500, days: 2 },
            { minEmployees: 501, maxEmployees: null, days: 2.5 }
        ]),
        Recertification: Object.freeze([
            { minEmployees: 1, maxEmployees: 10, days: 0.5 }, { minEmployees: 11, maxEmployees: 25, days: 1 },
            { minEmployees: 26, maxEmployees: 50, days: 1.5 }, { minEmployees: 51, maxEmployees: 100, days: 2 },
            { minEmployees: 101, maxEmployees: 250, days: 2.5 }, { minEmployees: 251, maxEmployees: 500, days: 3 },
            { minEmployees: 501, maxEmployees: null, days: 4 }
        ])
    });

    const EVENT_TYPES = Object.freeze([
        'certification-decision', 'certificate-issue',
        'surveillance-1-planned', 'surveillance-1-completed',
        'surveillance-2-planned', 'surveillance-2-completed',
        'recertification-planned', 'recertification-completed',
        'technical-review', 'certification-renewal',
        'suspension', 'withdrawal', 'expiry', 'authorized-override'
    ]);

    function safeArray(value) { return Array.isArray(value) ? value : []; }
    function date(value) {
        if (!value) return null;
        const parsed = value instanceof Date ? new Date(value) : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    function isoDate(value) {
        const parsed = date(value);
        return parsed ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
    }
    function addDays(value, days) {
        const result = date(value);
        if (!result) return null;
        result.setDate(result.getDate() + Number(days || 0));
        return result;
    }
    function standardFamily(value) {
        const match = String(value || '').toUpperCase().match(/ISO(?:\/IEC)?\s*(\d{4,5}(?:-\d)?)/);
        return match ? match[1] : String(value || '').toUpperCase().replace(/:\d{4}.*/, '').trim();
    }
    function policy(settings) {
        const configured = settings?.auditPlanningPolicy || {};
        const number = (key) => Number.isFinite(Number(configured[key])) ? Number(configured[key]) : DEFAULT_POLICY[key];
        return {
            ...DEFAULT_POLICY,
            ...configured,
            version: configured.version || POLICY_VERSION,
            developmentPlaceholder: configured.developmentPlaceholder !== false,
            recertificationWindowLeadDays: number('recertificationWindowLeadDays'),
            surveillanceWindowBeforeDays: number('surveillanceWindowBeforeDays'),
            surveillanceWindowAfterDays: number('surveillanceWindowAfterDays'),
            ncClosureBufferDays: number('ncClosureBufferDays'),
            expiryWarningDays: number('expiryWarningDays'),
            expiryCriticalDays: number('expiryCriticalDays'),
            workingHoursPerDay: number('workingHoursPerDay'),
            overrideRoles: safeArray(configured.overrideRoles).length ? configured.overrideRoles : DEFAULT_POLICY.overrideRoles
        };
    }

    function lifecycleEvents(client, certificateId) {
        return safeArray(client?.certificationLifecycleEvents)
            .filter((event) => !certificateId || String(event.certificateId) === String(certificateId))
            .slice().sort((a, b) => String(a.occurredAt || a.createdAt || '').localeCompare(String(b.occurredAt || b.createdAt || '')));
    }

    function createLifecycleEvent(input) {
        if (!EVENT_TYPES.includes(input?.type)) throw new Error(`Unsupported certification lifecycle event: ${input?.type || 'missing'}`);
        if (!input.certificateId) throw new Error('Certification lifecycle event requires certificateId.');
        return {
            id: input.id || (global.crypto?.randomUUID?.() || `CLE-${Date.now()}-${Math.random().toString(16).slice(2)}`),
            certificateId: String(input.certificateId),
            planId: input.planId ? String(input.planId) : null,
            type: input.type,
            stage: input.stage || null,
            occurredAt: input.occurredAt || new Date().toISOString(),
            user: input.user || 'System',
            role: input.role || 'System',
            reason: input.reason || '',
            originalValue: input.originalValue ?? null,
            overrideValue: input.overrideValue ?? null,
            approvedBy: input.approvedBy || null,
            metadata: input.metadata || {}
        };
    }

    function latestAuthorizedStageOverride(events) {
        return safeArray(events).filter((event) => event.type === 'authorized-override'
            && event.metadata?.category === 'stage' && event.overrideValue && event.reason && event.user && event.role).at(-1) || null;
    }

    function auditTypeFromCycleState(cycleState, events) {
        const override = latestAuthorizedStageOverride(events);
        if (override) return { auditType: override.overrideValue, stage: override.overrideValue, override };
        // With no finalized lifecycle history ReportStats deliberately exposes a
        // calendar projection. Its `completed` flags remain false because those
        // milestones were not evidenced by reports, so using the flags here
        // would always regress planning to Surveillance 1. In projection mode,
        // the displayed period/due date is the authoritative next milestone.
        if (cycleState?.stageSource === 'calendar') {
            const projectedStage = String(cycleState.stage || '').toLowerCase();
            if (projectedStage.includes('recertification') || projectedStage.includes('certificate expired')) {
                return { auditType: 'Recertification', stage: cycleState.stage, projected: true };
            }
            if (projectedStage.includes('surveillance 2')) {
                return { auditType: 'Recertification', stage: cycleState.stage, projected: true };
            }
            if (projectedStage.includes('surveillance 1')) {
                return { auditType: 'Surveillance 2', stage: cycleState.stage, projected: true };
            }
            return { auditType: 'Surveillance 1', stage: cycleState.stage || 'Initial certification', projected: true };
        }
        const completedTypes = new Set(safeArray(events).map((event) => event.type));
        const completed = cycleState?.completed || {};
        const s1 = completed.s1 || completedTypes.has('surveillance-1-completed');
        const s2 = completed.s2 || completedTypes.has('surveillance-2-completed');
        const recert = completed.recert || completedTypes.has('recertification-completed');
        if (recert) return { auditType: 'Recertification', stage: 'Recertification completed', complete: true };
        if (!s1) return { auditType: 'Surveillance 1', stage: cycleState?.stage || 'Surveillance 1 due' };
        if (!s2) return { auditType: 'Surveillance 2', stage: cycleState?.stage || 'Surveillance 2 due' };
        return { auditType: 'Recertification', stage: cycleState?.stage || 'Recertification due' };
    }

    function planningWindow(auditType, target, expiry, resolvedPolicy) {
        const cfg = resolvedPolicy || DEFAULT_POLICY;
        const closureDeadline = addDays(expiry, -cfg.ncClosureBufferDays);
        if (auditType === 'Recertification') {
            return { start: addDays(closureDeadline, -cfg.recertificationWindowLeadDays), end: closureDeadline };
        }
        const start = addDays(target, -cfg.surveillanceWindowBeforeDays);
        const proposedEnd = addDays(target, cfg.surveillanceWindowAfterDays);
        return { start, end: closureDeadline && proposedEnd > closureDeadline ? closureDeadline : proposedEnd };
    }

    function resolveCycleContext(input) {
        const client = input.client || {};
        const now = date(input.now) || new Date();
        const cfg = policy(input.settings || {});
        const active = safeArray(client.certificates).filter((cert) => cert.standard && !['withdrawn', 'expired'].includes(String(cert.status || '').toLowerCase()));
        const byScheme = new Map();
        active.forEach((cert, index) => {
            const key = standardFamily(cert.standard);
            const previous = byScheme.get(key);
            const currentDate = date(cert.currentIssue || cert.initialDate || cert.issueDate)?.getTime() || 0;
            const previousDate = date(previous?.cert?.currentIssue || previous?.cert?.initialDate || previous?.cert?.issueDate)?.getTime() || -1;
            if (!previous || currentDate >= previousDate) byScheme.set(key, { cert, index });
        });
        const cycles = [...byScheme.values()].map(({ cert, index }) => {
            const certificateId = String(cert.id || cert.certificateId || cert.certificateNo || `${client.id || 'client'}-${index}`);
            const cycleState = input.cycleStateResolver?.({
                client, standard: cert.standard, certificate: cert,
                allReports: input.allReports || [], allPlans: input.allPlans || [], today: now
            }) || null;
            const events = lifecycleEvents(client, certificateId);
            const derived = auditTypeFromCycleState(cycleState, events);
            const anchor = date(cert.initialDate || cert.issueDate || cert.currentIssue);
            const expiry = date(cert.expiryDate) || cycleState?.cycleEnd || (anchor ? new Date(anchor.getFullYear() + 3, anchor.getMonth(), anchor.getDate()) : null);
            const target = derived.auditType === 'Surveillance 1' ? cycleState?.surv1Due
                : derived.auditType === 'Surveillance 2' ? cycleState?.surv2Due
                    : cycleState?.recertDue || expiry;
            const window = planningWindow(derived.auditType, target, expiry, cfg);
            return {
                certificateId, cycleRecordIndex: index, certificateNo: cert.certificateNo || '',
                standard: cert.standard, standardFamily: standardFamily(cert.standard),
                scope: cert.scope || client.scope || '', siteScopes: cert.siteScopes || {},
                issueDate: isoDate(anchor), expiryDate: isoDate(expiry), stage: derived.stage,
                auditType: derived.auditType, targetDate: isoDate(target),
                recommendedWindowStart: isoDate(window.start), recommendedWindowEnd: isoDate(window.end),
                closureBufferDays: cfg.ncClosureBufferDays, stageSource: derived.override ? 'authorized-override' : (cycleState?.stageSource || 'lifecycle'),
                override: derived.override || null, lifecycleEvents: events
            };
        });
        const auditTypes = [...new Set(cycles.map((cycle) => cycle.auditType))];
        const commonStart = cycles.map((cycle) => cycle.recommendedWindowStart).filter(Boolean).sort().at(-1) || '';
        const commonEnd = cycles.map((cycle) => cycle.recommendedWindowEnd).filter(Boolean).sort()[0] || '';
        const incompatible = auditTypes.length > 1 || (commonStart && commonEnd && commonStart > commonEnd);
        return {
            valid: cycles.length > 0 && !incompatible,
            cycles, certificateIds: cycles.map((cycle) => cycle.certificateId),
            standards: cycles.map((cycle) => cycle.standard), auditType: auditTypes.length === 1 ? auditTypes[0] : '',
            stage: [...new Set(cycles.map((cycle) => cycle.stage))].join(' / '),
            recommendedWindowStart: commonStart, recommendedWindowEnd: commonEnd,
            certificateExpiry: cycles.map((cycle) => cycle.expiryDate).filter(Boolean).sort()[0] || '',
            closureBufferDays: cfg.ncClosureBufferDays, policy: cfg,
            conflict: incompatible ? 'Selected certification cycles do not have a compatible stage and planning-window intersection; create separate plans or record an authorized lifecycle override.' : ''
        };
    }

    function resolveDurationMethodology(settings, standards) {
        const registry = settings?.durationMethodologies || {};
        const families = [...new Set(safeArray(standards).map(standardFamily).filter(Boolean))];
        const methods = families.map((family) => {
            const configured = registry[family];
            if (!configured) return {
                name: `ISO ${family} default duration rules`,
                version: DEFAULT_DURATION_VERSION,
                tables: DEFAULT_DURATION_TABLES,
                builtInDefault: true
            };
            return {
                ...configured,
                name: configured.name || `ISO ${family} duration rules`,
                version: configured.version || DEFAULT_DURATION_VERSION,
                fallbackTables: DEFAULT_DURATION_TABLES,
                usesDefaultFallback: true
            };
        });
        const versions = [...new Set(methods.map((method) => method.version || DEFAULT_DURATION_VERSION))];
        return {
            configured: methods.length > 0,
            version: versions.length === 1 ? versions[0] : versions.join(' + '),
            name: methods.map((method) => method.name).join(' + '),
            methods,
            missingFamilies: [],
            usesDefaults: methods.some((method) => method.builtInDefault || method.usesDefaultFallback)
        };
    }

    function resolveProvisionalDurationMethodology(settings, standards) {
        const registry = settings?.durationMethodologyDrafts || {};
        const families = [...new Set(safeArray(standards).map(standardFamily))];
        const missingFamilies = families.filter(family => !registry[family]);
        const methods = families.map(family => registry[family]).filter(Boolean);
        return {
            configured: methods.length > 0 && missingFamilies.length === 0,
            provisional: true,
            version: 'DRAFT',
            name: methods.map(method => method.name || 'Draft duration rules').join(' + '),
            methods,
            missingFamilies
        };
    }

    function calculateConfiguredDuration(methodology, input) {
        if (!methodology?.configured) return { configured: false, error: 'Approved duration methodology configuration is incomplete.' };
        const results = methodology.methods.map((method) => {
            const table = safeArray(method.tables?.[input.auditType] || method.employeeBands);
            let band = table.find((row) => Number(input.employees) >= Number(row.minEmployees || 0)
                && (row.maxEmployees == null || Number(input.employees) <= Number(row.maxEmployees)));
            let defaultUsed = Boolean(method.builtInDefault);
            if (!band || !(Number(band.days) > 0)) {
                band = safeArray(method.fallbackTables?.[input.auditType]).find((row) => Number(input.employees) >= Number(row.minEmployees || 0)
                    && (row.maxEmployees == null || Number(input.employees) <= Number(row.maxEmployees)));
                defaultUsed = Boolean(band && Number(band.days) > 0);
            }
            if (!band || !(Number(band.days) > 0)) return { error: `${method.name || 'Methodology'} has no applicable duration table row.` };
            let days = Number(band.days);
            const siteRule = method.siteAdjustment;
            if (siteRule && Number(input.sites) > 1) days += (Number(input.sites) - 1) * Number(siteRule.daysPerAdditionalSite || 0);
            const riskAdjustment = Number(method.riskAdjustments?.[input.riskLevel] || 0);
            days += riskAdjustment;
            return { name: method.name, version: method.version, days, band, defaultUsed, riskAdjustment, siteAdjustment: days - Number(band.days) - riskAdjustment };
        });
        const failed = results.find((result) => result.error);
        if (failed) return { configured: false, error: failed.error, results };
        return { configured: true, baselineDays: Math.max(...results.map((result) => result.days)), results };
    }

    function validateDuration(calculation, methodology, standardCount) {
        const errors = [];
        const warnings = [];
        if (!methodology.configured) errors.push(`Approved duration methodology configuration is missing for: ${methodology.missingFamilies.join(', ') || 'selected schemes'}.`);
        if (!(Number(calculation?.baselineDays) > 0) || !(Number(calculation?.finalDays) > 0)) errors.push('Baseline and final audit duration must be established.');
        if (standardCount > 1 && !calculation?.imsRuleVersion) errors.push('A versioned IMS calculation rule is required for an integrated audit.');
        if (Number(calculation?.justifiedAdjustment) !== 0 && !String(calculation?.justification || '').trim()) errors.push('A duration adjustment requires justification.');
        if (!calculation?.approvedBy || !calculation?.approvedAt) warnings.push('Duration calculation has not yet been approved.');
        return { errors, warnings };
    }

    function auditorCompetences(auditor) {
        const records = safeArray(auditor?.competenceRecords);
        if (records.length) return records;
        return safeArray(auditor?.standards).map((scheme) => ({ scheme, roles: [auditor.role || 'Auditor'], status: 'Approved' }));
    }
    function validCompetence(record, onDate) {
        if (!record || String(record.status || 'Approved').toLowerCase() !== 'approved') return false;
        const expiry = date(record.validUntil || record.expiryDate);
        return !expiry || !onDate || expiry >= onDate;
    }
    function validateCompetence(input) {
        const auditors = safeArray(input.auditors);
        const standards = safeArray(input.standards);
        const onDate = date(input.auditDate);
        const lead = auditors.find((auditor) => auditor.name === input.leadAuditor || String(auditor.id) === String(input.leadAuditor));
        const errors = [];
        const warnings = [];
        const detail = auditors.map((auditor) => ({
            auditor: auditor.name, records: auditorCompetences(auditor).filter((record) => validCompetence(record, onDate))
        }));
        if (!lead) errors.push('A Lead Auditor must be assigned.');
        else {
            const leadRecords = auditorCompetences(lead).filter((record) => validCompetence(record, onDate));
            standards.forEach((standard) => {
                const family = standardFamily(standard);
                if (!leadRecords.some((record) => standardFamily(record.scheme || record.standard) === family && safeArray(record.roles).some((role) => /lead auditor/i.test(role)))) errors.push(`Lead Auditor lacks current Lead Auditor authorization for ${standard}.`);
            });
        }
        standards.forEach((standard) => {
            const family = standardFamily(standard);
            if (!detail.some((entry) => entry.records.some((record) => standardFamily(record.scheme || record.standard) === family))) errors.push(`The team does not collectively cover ${standard}.`);
        });
        safeArray(input.requiredTechnicalSectors).forEach((sector) => {
            if (!detail.some((entry) => entry.records.some((record) => safeArray(record.technicalSectors || record.sectors).includes(sector)))) errors.push(`The team lacks required technical competence for ${sector}.`);
        });
        auditors.forEach((auditor) => {
            const unavailable = safeArray(auditor.unavailableDates).some((value) => isoDate(value) === isoDate(onDate));
            if (unavailable || String(auditor.availabilityStatus || '').toLowerCase() === 'unavailable') errors.push(`${auditor.name} is not available for the planned audit date.`);
        });
        return { valid: errors.length === 0, errors, warnings, detail };
    }

    function buildCoverageMatrix(input) {
        const common = ['Opening meeting', 'Context and scope', 'Leadership', 'Risk and objectives', 'Support', 'Performance evaluation', 'Improvement', 'Closing meeting'];
        const standardSpecific = safeArray(input.standards).flatMap((standard) => {
            const family = standardFamily(standard);
            if (family === '27001') return [{ standard, area: 'ISMS operational controls and Statement of Applicability sampling' }];
            if (family === '22301') return [{ standard, area: 'Business impact, continuity strategies, exercises and response' }];
            if (family === '20000-1') return [{ standard, area: 'Service management system, service portfolio and operational controls' }];
            return [{ standard, area: `${standard} scheme-specific operational requirements` }];
        });
        return {
            version: 'coverage-matrix-v1', generatedAt: new Date().toISOString(),
            common: common.map((area) => ({ category: 'common-ims', area, mandatory: true })),
            standardSpecific: standardSpecific.map((entry) => ({ category: 'standard-specific', mandatory: true, ...entry })),
            findings: safeArray(input.previousFindings).map((finding) => ({ category: 'previous-finding', mandatory: true, reference: finding.id || finding.ref || null, area: finding.clause || finding.description || 'Previous finding follow-up' })),
            sites: safeArray(input.sites).map((site) => ({ category: 'site', mandatory: true, area: site.name || site })),
            processes: safeArray(input.processes).map((process) => ({ category: 'process', mandatory: true, area: process.name || process })),
            controls: safeArray(input.controls).map((control) => ({ category: 'control-sampling', mandatory: true, area: control.name || control.control || control }))
        };
    }

    function parseTimeRange(value) {
        const matches = String(value || '').match(/(\d{1,2}):(\d{2})\s*(?:-|–|to)\s*(\d{1,2}):(\d{2})/i);
        if (!matches) return null;
        const start = Number(matches[1]) * 60 + Number(matches[2]);
        const end = Number(matches[3]) * 60 + Number(matches[4]);
        return end > start ? (end - start) / 60 : null;
    }
    function reconcileAgenda(input) {
        const hoursPerDay = Number(input.hoursPerDay) || 8;
        const byAuditor = {};
        const days = new Set();
        let scheduledAuditorHours = 0;
        const errors = [];
        safeArray(input.agenda).forEach((item, index) => {
            const hours = Number(item.hours) || parseTimeRange(item.time);
            if (!hours) { errors.push(`Agenda row ${index + 1} needs a valid time range or hours value.`); return; }
            let auditors = safeArray(item.auditors).length ? item.auditors : String(item.auditor || '').split(',').map((x) => x.trim()).filter(Boolean);
            if (auditors.some((auditor) => /^all team$/i.test(auditor))) auditors = safeArray(input.team).length ? input.team : safeArray(input.teamAllocations).map((entry) => entry.auditor);
            if (!auditors.length) { errors.push(`Agenda row ${index + 1} has no assigned auditor.`); return; }
            days.add(String(item.day || 'Day 1'));
            scheduledAuditorHours += hours * auditors.length;
            auditors.forEach((auditor) => { byAuditor[auditor] = (byAuditor[auditor] || 0) + hours; });
        });
        const approvedAuditorHours = Number(input.finalAuditorDays || 0) * hoursPerDay;
        if (Math.abs(scheduledAuditorHours - approvedAuditorHours) > 0.01) errors.push(`Agenda totals ${scheduledAuditorHours.toFixed(1)} auditor-hours; approved duration requires ${approvedAuditorHours.toFixed(1)}.`);
        safeArray(input.teamAllocations).forEach((allocation) => {
            const planned = Number(allocation.days || 0) * hoursPerDay;
            const scheduled = byAuditor[allocation.auditor] || 0;
            if (Math.abs(planned - scheduled) > 0.01) errors.push(`${allocation.auditor} has ${scheduled.toFixed(1)} agenda hours but ${planned.toFixed(1)} allocated hours.`);
        });
        return { valid: errors.length === 0, errors, elapsedDays: days.size, scheduledAuditorHours, approvedAuditorHours, byAuditor, hoursPerDay };
    }

    function canTransition(from, to, validation) {
        const allowed = { Draft: ['Validated'], Validated: ['Draft', 'Scheduled'], Scheduled: ['Draft', 'Completed'], Completed: ['Approved'], Approved: ['Closed'], Closed: [] };
        if (!allowed[from]?.includes(to)) return { allowed: false, reason: `Plan cannot transition from ${from} to ${to}.` };
        if (to !== 'Draft' && safeArray(validation?.errors).length) return { allowed: false, reason: 'Blocking validation issues must be resolved before this transition.' };
        return { allowed: true };
    }

    function createOverride(input) {
        const cfg = policy(input.settings || {});
        if (!cfg.overrideRoles.some((role) => String(role).toLowerCase() === String(input.role || '').toLowerCase())) throw new Error('Current role is not authorized to record this override.');
        if (!String(input.reason || '').trim()) throw new Error('Override reason is required.');
        return {
            id: global.crypto?.randomUUID?.() || `OVR-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            category: input.category, originalValue: input.originalValue ?? null, overrideValue: input.overrideValue ?? null,
            reason: String(input.reason).trim(), user: input.user || 'Unknown user', role: input.role,
            createdAt: input.createdAt || new Date().toISOString(), approvedBy: input.approvedBy || null,
            approvalRequired: input.approvalRequired !== false
        };
    }

    const api = {
        POLICY_VERSION, PLAN_STATES, DEFAULT_POLICY, DEFAULT_DURATION_VERSION, DEFAULT_DURATION_TABLES, DEFAULT_IMS_RULE, EVENT_TYPES, policy, standardFamily,
        lifecycleEvents, createLifecycleEvent, resolveCycleContext, resolveDurationMethodology, resolveProvisionalDurationMethodology,
        calculateConfiguredDuration, validateDuration, validateCompetence, buildCoverageMatrix, reconcileAgenda, canTransition, createOverride
    };
    global.AuditPlanningDomain = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
