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
        'suspension', 'withdrawal', 'expiry', 'authorized-override',
        // Cancelling an override is itself a recorded decision. The events are
        // append-only, so the override is never removed: a later revocation
        // simply takes it out of force and the derived stage governs again.
        'authorized-override-revoked'
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

    // The stage override in force, if any. Walked in order so a revocation
    // recorded after an override cancels it, and an override recorded after a
    // revocation takes effect again. Both are kept on the record; only the last
    // decision governs.
    function latestAuthorizedStageOverride(events) {
        let inForce = null;
        safeArray(events).forEach((event) => {
            if (!event || event.metadata?.category !== 'stage') return;
            if (event.type === 'authorized-override-revoked') { inForce = null; return; }
            if (event.type === 'authorized-override' && event.overrideValue && event.reason && event.user && event.role) inForce = event;
        });
        return inForce;
    }

    function auditTypeFromCycleState(cycleState, events, resolvedPolicy, now) {
        const rawOverride = latestAuthorizedStageOverride(events);
        // An override names a stage WITHIN a cycle. A recertification starts a
        // new one, so an override recorded before the current cycle began
        // belongs to a cycle that no longer exists and must not steer this one —
        // it was still pinning a client to "Surveillance 2" from two cycles ago.
        const cycleStart = date(cycleState?.anchor);
        const recordedAt = rawOverride ? date(rawOverride.occurredAt || rawOverride.createdAt) : null;
        const fromEarlierCycle = !!(rawOverride && cycleStart && recordedAt && recordedAt < cycleStart);

        // A surveillance cannot be the next audit on a certificate whose cycle
        // has already ended: there is no certificate left to maintain, only one
        // to re-establish. Whatever stage the cycle stalled at — and whatever
        // stage an override named while the cycle was still running — the next
        // audit is Recertification. Without this, an expired certificate kept
        // recommending the surveillance window it missed, years in the past,
        // beside milestone nodes that all read "missed".
        const expired = !!cycleState?.expired && !cycleState?.recertDone;
        if (expired) {
            const stale = rawOverride && (fromEarlierCycle || !/recert/i.test(String(rawOverride.overrideValue || ''))) ? rawOverride : null;
            return {
                auditType: 'Recertification', stage: cycleState.stage || 'Certificate expired',
                expired: true, override: stale ? null : rawOverride, supersededOverride: stale,
                supersededReason: stale ? (fromEarlierCycle ? 'earlier-cycle' : 'cycle-expired') : null
            };
        }
        if (rawOverride && !fromEarlierCycle) {
            return { auditType: rawOverride.overrideValue, stage: rawOverride.overrideValue, override: rawOverride };
        }
        const supersededOverride = fromEarlierCycle ? rawOverride : null;
        const supersededReason = fromEarlierCycle ? 'earlier-cycle' : null;
        // Every branch below reports the override it did NOT apply, so the
        // card can say why a stage someone authorised is not in force.
        const withSuperseded = (result) => Object.assign({ supersededOverride, supersededReason }, result);
        // With no finalized lifecycle history ReportStats deliberately exposes a
        // calendar projection. Its `completed` flags remain false because those
        // milestones were not evidenced by reports, so using the flags here
        // would always regress planning to Surveillance 1. In projection mode,
        // the displayed period/due date is the authoritative next milestone.
        if (cycleState?.stageSource === 'calendar') {
            const projectedStage = String(cycleState.stage || '').toLowerCase();
            if (projectedStage.includes('recertification') || projectedStage.includes('certificate expired')) {
                return withSuperseded({ auditType: 'Recertification', stage: cycleState.stage, projected: true });
            }
            // Reading the stage as "the last period that started, so do the NEXT
            // one" assumed the passed milestone had been performed — in
            // projection mode nothing has been evidenced, which is why it is a
            // projection. A surveillance whose due date has just passed is the
            // audit that is OWED, not one to step over: that is what showed
            // Surveillance 2 for a client whose first surveillance was due.
            // Only once a milestone's window has fully closed does it stop
            // being schedulable and the cycle move on.
            const cfg = resolvedPolicy || DEFAULT_POLICY;
            const reference = date(now) || new Date();
            const stillSchedulable = (due) => {
                const dueDate = date(due);
                if (!dueDate) return false;
                return addDays(dueDate, cfg.surveillanceWindowAfterDays) >= reference;
            };
            if (stillSchedulable(cycleState.surv1Due)) {
                return withSuperseded({ auditType: 'Surveillance 1', stage: cycleState.stage || 'Initial certification', projected: true });
            }
            if (stillSchedulable(cycleState.surv2Due)) {
                return withSuperseded({ auditType: 'Surveillance 2', stage: cycleState.stage, projected: true });
            }
            return withSuperseded({ auditType: 'Recertification', stage: cycleState.stage, projected: true });
        }
        const completedTypes = new Set(safeArray(events).map((event) => event.type));
        const completed = cycleState?.completed || {};
        const s1 = completed.s1 || completedTypes.has('surveillance-1-completed');
        const s2 = completed.s2 || completedTypes.has('surveillance-2-completed');
        const recert = completed.recert || completedTypes.has('recertification-completed');
        if (recert) return withSuperseded({ auditType: 'Recertification', stage: 'Recertification completed', complete: true });
        if (!s1) return withSuperseded({ auditType: 'Surveillance 1', stage: cycleState?.stage || 'Surveillance 1 due' });
        if (!s2) return withSuperseded({ auditType: 'Surveillance 2', stage: cycleState?.stage || 'Surveillance 2 due' });
        return withSuperseded({ auditType: 'Recertification', stage: cycleState?.stage || 'Recertification due' });
    }

    function planningWindow(auditType, target, expiry, resolvedPolicy) {
        const cfg = resolvedPolicy || DEFAULT_POLICY;
        const closureDeadline = addDays(expiry, -cfg.ncClosureBufferDays);
        if (auditType === 'Recertification') {
            return { start: addDays(closureDeadline, -cfg.recertificationWindowLeadDays), end: closureDeadline };
        }
        const start = addDays(target, -cfg.surveillanceWindowBeforeDays);
        const proposedEnd = addDays(target, cfg.surveillanceWindowAfterDays);
        // Pulling the end back to the closure deadline only helps while it stays
        // on or after the start. A surveillance due beyond that deadline cannot
        // be squeezed before it, and clamping there printed the window
        // backwards — "08/10/2027 – 07/10/2026". Report the real window and say
        // it runs past the deadline instead of inverting it.
        if (closureDeadline && proposedEnd > closureDeadline) {
            if (start <= closureDeadline) return { start, end: closureDeadline };
            return { start, end: proposedEnd, beyondClosureDeadline: true };
        }
        return { start, end: proposedEnd };
    }

    // One certificate in, one cycle record out. The client overview renders a
    // card per certificate and must be able to resolve the window for the exact
    // certificate it is showing: resolving per client and matching back by
    // standard let the window describe a DIFFERENT certificate (a superseded
    // twin of the same scheme family, or one carrying an authorized override),
    // so the recommended window silently contradicted the stage dots beside it.
    // Callers may pass a cycleState they already computed, which keeps the dots
    // and the window on one derivation.
    function resolveCertificateCycle(input) {
        const client = input.client || {};
        const cert = input.certificate || {};
        const now = date(input.now) || new Date();
        const cfg = input.policy || policy(input.settings || {});
        const index = Number.isFinite(input.index) ? input.index : 0;
        const certificateId = String(cert.id || cert.certificateId || cert.certificateNo || `${client.id || 'client'}-${index}`);
        const cycleState = input.cycleState || input.cycleStateResolver?.({
            client, standard: cert.standard, certificate: cert,
            allReports: input.allReports || [], allPlans: input.allPlans || [], today: now
        }) || null;
        const events = input.events || lifecycleEvents(client, certificateId);
        const derived = auditTypeFromCycleState(cycleState, events, cfg, now);
        const anchor = date(cert.initialDate || cert.issueDate || cert.currentIssue);
        const expiry = date(cert.expiryDate) || cycleState?.cycleEnd || (anchor ? new Date(anchor.getFullYear() + 3, anchor.getMonth(), anchor.getDate()) : null);
        // Planning — and the NC closure buffer that protects it — runs to the
        // END OF THE CYCLE, never to the date the certificate on file happens
        // to carry. That date is re-issued on its own schedule: usually short
        // of the cycle (an annual re-issue, which put the deadline before the
        // next surveillance was due) and sometimes years past it (which pushed
        // a recertification window out to 2030 for a cycle ending in 2027).
        const cycleEnd = cycleState?.cycleEnd || null;
        const horizon = cycleEnd || expiry;
        const target = derived.auditType === 'Surveillance 1' ? cycleState?.surv1Due
            : derived.auditType === 'Surveillance 2' ? cycleState?.surv2Due
                : cycleState?.recertDue || horizon;
        const window = planningWindow(derived.auditType, target, horizon, cfg);
        return {
            certificateId, cycleRecordIndex: index, certificateNo: cert.certificateNo || '',
            standard: cert.standard, standardFamily: standardFamily(cert.standard),
            scope: cert.scope || client.scope || '', siteScopes: cert.siteScopes || {},
            issueDate: isoDate(anchor), expiryDate: isoDate(expiry), stage: derived.stage,
            auditType: derived.auditType, targetDate: isoDate(target),
            recommendedWindowStart: isoDate(window.start), recommendedWindowEnd: isoDate(window.end),
            closureBufferDays: cfg.ncClosureBufferDays, stageSource: derived.override ? 'authorized-override' : (cycleState?.stageSource || 'lifecycle'),
            override: derived.override || null,
            // Kept for display and for the record: the event is append-only and
            // is never deleted, it simply stops steering planning.
            supersededOverride: derived.supersededOverride || null,
            supersededReason: derived.supersededReason || null,
            cycleExpired: !!derived.expired, lifecycleEvents: events
        };
    }

    // Where "today" sits relative to a recommended window. A window that closed
    // is planning history, not guidance: saying so is what keeps the card from
    // offering a past date range next to an amber (missed) milestone.
    function describeCycleWindow(record, now) {
        // Window bounds are calendar dates ("2026-06-17"), which Date parses as
        // UTC midnight while "today" is a local instant. Comparing the two
        // directly put the first and last day of the window on the wrong side of
        // the boundary for every user east of UTC, so both are reduced to local
        // whole days first.
        const day = 24 * 60 * 60 * 1000;
        const localDay = (value) => {
            if (typeof value === 'string') {
                const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
            }
            const parsed = date(value);
            return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null;
        };
        const today = localDay(now) || localDay(new Date());
        const start = localDay(record?.recommendedWindowStart);
        const end = localDay(record?.recommendedWindowEnd);
        if (!start || !end) return { state: 'unknown', start: null, end: null, days: 0 };
        if (today > end) return { state: 'closed', start, end, days: Math.round((today - end) / day) };
        if (today >= start) return { state: 'open', start, end, days: Math.round((end - today) / day) };
        return { state: 'upcoming', start, end, days: Math.round((start - today) / day) };
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
        const cycles = [...byScheme.values()].map(({ cert, index }) => resolveCertificateCycle({
            client, certificate: cert, index, now, policy: cfg,
            cycleStateResolver: input.cycleStateResolver,
            allReports: input.allReports || [], allPlans: input.allPlans || []
        }));
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
            // Lunch and breaks are not audit time: counting them let an agenda with
            // a lunch row reconcile against hours nobody audited.
            if (item.kind === 'lunch' || item.kind === 'break' || /^\s*(lunch|break)\b/i.test(String(item.item || ''))) return;
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

    // Cancelling an override needs the same authority and a documented reason
    // as recording one: it changes which audit the client is judged to owe.
    function createOverrideRevocation(input) {
        const cfg = policy(input.settings || {});
        if (!cfg.overrideRoles.some((role) => String(role).toLowerCase() === String(input.role || '').toLowerCase())) throw new Error('Current role is not authorized to cancel this override.');
        if (!String(input.reason || '').trim()) throw new Error('A reason for cancelling the override is required.');
        return {
            id: global.crypto?.randomUUID?.() || `OVR-REV-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            category: input.category || 'stage',
            revokesOverrideId: input.revokesOverrideId || null,
            originalValue: input.originalValue ?? null,
            reason: String(input.reason).trim(), user: input.user || 'Unknown user', role: input.role,
            createdAt: input.createdAt || new Date().toISOString()
        };
    }

    // Milestones a completed audit can be recorded against, and the append-only
    // event each one writes. Used where an audit WAS performed but never
    // captured in the app — the surveillance happened, the record did not.
    const COMPLETION_MILESTONES = Object.freeze({
        'Surveillance 1': 'surveillance-1-completed',
        'Surveillance 2': 'surveillance-2-completed',
        'Recertification': 'recertification-completed'
    });

    function createCompletionRecord(input) {
        const cfg = policy(input.settings || {});
        const milestone = Object.keys(COMPLETION_MILESTONES)
            .find((name) => name.toLowerCase() === String(input.milestone || '').trim().toLowerCase());
        if (!milestone) throw new Error('Record Surveillance 1, Surveillance 2, or Recertification.');
        if (!cfg.overrideRoles.some((role) => String(role).toLowerCase() === String(input.role || '').toLowerCase())) {
            throw new Error('Current role is not authorized to record a completed audit.');
        }
        const performedAt = date(input.performedAt);
        if (!performedAt) throw new Error('Enter the date the audit was performed (YYYY-MM-DD).');
        const now = date(input.now) || new Date();
        if (performedAt > now) throw new Error('An audit cannot be recorded as performed in the future.');
        return {
            id: global.crypto?.randomUUID?.() || `CMP-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            milestone, type: COMPLETION_MILESTONES[milestone],
            performedAt: isoDate(performedAt),
            note: String(input.note || '').trim(),
            user: input.user || 'Unknown user', role: input.role,
            createdAt: input.createdAt || new Date().toISOString()
        };
    }

    // Does a completion dated here count towards the cycle on screen? Events
    // are read within the cycle window, so one dated outside it is filed but
    // never ticks anything — worth saying before it is written, not after.
    function completionFallsInCycle(cycleState, performedAt) {
        const when = date(performedAt);
        const anchor = date(cycleState?.anchor);
        if (!when || !anchor) return false;
        return when >= addDays(anchor, -60);
    }

    const api = {
        POLICY_VERSION, PLAN_STATES, DEFAULT_POLICY, DEFAULT_DURATION_VERSION, DEFAULT_DURATION_TABLES, DEFAULT_IMS_RULE, EVENT_TYPES, policy, standardFamily,
        lifecycleEvents, createLifecycleEvent, resolveCycleContext, resolveCertificateCycle, describeCycleWindow,
        resolveDurationMethodology, resolveProvisionalDurationMethodology,
        calculateConfiguredDuration, validateDuration, validateCompetence, buildCoverageMatrix, reconcileAgenda, canTransition,
        createOverride, createOverrideRevocation, latestAuthorizedStageOverride,
        COMPLETION_MILESTONES, createCompletionRecord, completionFallsInCycle
    };
    global.AuditPlanningDomain = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
