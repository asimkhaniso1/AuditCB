import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ReportStats = require('../report-stats.js');
const Domain = require('../audit-planning-domain.js');

function pcConnectionFixture() {
    const standards = ['ISO/IEC 27001:2022', 'ISO 22301:2019', 'ISO/IEC 20000-1:2018'];
    const certificates = standards.map((standard, index) => ({
        id: `PC-CERT-${index + 1}`,
        certificateNo: `PC-2023-${index + 1}`,
        standard,
        status: 'Active',
        initialDate: '2023-12-16',
        currentIssue: '2025-12-16',
        expiryDate: '2026-12-15',
        scope: 'Integrated information security, business continuity and IT service management system',
        siteScopes: { 'Head Office': 'Integrated management system' }
    }));
    return {
        id: 'pc-connection-fixture',
        name: 'PC CONNECTION, INC.',
        certificates,
        sites: [{ name: 'Head Office', employees: 250 }],
        certificationLifecycleEvents: certificates.map((certificate, index) => ({
            id: `PC-S1-${index + 1}`,
            certificateId: certificate.id,
            type: 'surveillance-1-completed',
            occurredAt: '2024-12-10T12:00:00Z',
            user: 'Certification Manager',
            role: 'Certification Manager'
        }))
    };
}

describe('certification-cycle-driven audit planning domain', () => {
    it('derives the PC CONNECTION integrated Surveillance 2 plan from three independent cycle histories', () => {
        const client = pcConnectionFixture();
        const context = Domain.resolveCycleContext({
            client,
            now: new Date('2026-09-18T00:00:00Z'),
            settings: { auditPlanningPolicy: { version: 'CB-PLAN-2026-01', recertificationWindowLeadDays: 75, ncClosureBufferDays: 30 } },
            allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });

        expect(context.valid).toBe(true);
        expect(context.auditType).toBe('Surveillance 2');
        expect(context.standards).toEqual(['ISO/IEC 27001:2022', 'ISO 22301:2019', 'ISO/IEC 20000-1:2018']);
        expect(context.certificateIds).toEqual(['PC-CERT-1', 'PC-CERT-2', 'PC-CERT-3']);
        expect(context.certificateExpiry).toBe('2026-12-15');
        expect(context.policy.version).toBe('CB-PLAN-2026-01');
        expect(context.cycles.every((cycle) => cycle.stageSource === 'history')).toBe(true);
    });

    it('uses the projected next milestone when PC CONNECTION has no finalized audit history', () => {
        const client = pcConnectionFixture();
        client.certificationLifecycleEvents = [];
        const context = Domain.resolveCycleContext({
            client,
            now: new Date('2026-09-18T00:00:00Z'),
            settings: { auditPlanningPolicy: { version: 'CB-PLAN-2026-01', ncClosureBufferDays: 30 } },
            allReports: [], allPlans: [], cycleStateResolver: ReportStats.cycleState
        });

        expect(context.valid).toBe(true);
        expect(context.stage).toBe('Surveillance 2 period');
        expect(context.auditType).toBe('Recertification');
        expect(context.certificateExpiry).toBe('2026-12-15');
        expect(context.cycles.every((cycle) => cycle.stageSource === 'calendar')).toBe(true);
    });

    it('requires separate plans when stages differ or planning windows do not intersect', () => {
        const client = pcConnectionFixture();
        client.certificationLifecycleEvents.push({
            id: 'PC-S2-3', certificateId: 'PC-CERT-3', type: 'surveillance-2-completed',
            occurredAt: '2025-12-10T12:00:00Z', user: 'Certification Manager', role: 'Certification Manager'
        });
        const context = Domain.resolveCycleContext({ client, now: '2026-09-18', settings: {}, cycleStateResolver: ReportStats.cycleState });
        expect(context.valid).toBe(false);
        expect(context.conflict).toContain('separate plans');
    });

    it('provides reviewable default duration rules when scheme tables are absent', () => {
        const standards = pcConnectionFixture().certificates.map((certificate) => certificate.standard);
        const methodology = Domain.resolveDurationMethodology({}, standards);
        const result = Domain.calculateConfiguredDuration(methodology, { employees: 250, sites: 1, auditType: 'Surveillance 2' });
        expect(methodology.configured).toBe(true);
        expect(methodology.usesDefaults).toBe(true);
        expect(methodology.version).toBe('Audit360 default v1');
        expect(result.configured).toBe(true);
        expect(result.baselineDays).toBe(1.5);
        expect(methodology.missingFamilies).toEqual([]);
    });

    it('uses only configured, versioned duration tables and IMS rules', () => {
        const standards = ['ISO/IEC 27001:2022', 'ISO 22301:2019'];
        const durationMethodologies = Object.fromEntries(['27001', '22301'].map((family) => [family, {
            name: `Approved ${family} method`, version: '2026.1',
            tables: { 'Surveillance 2': [{ minEmployees: 1, maxEmployees: 500, days: family === '27001' ? 3 : 2.5 }] }
        }]));
        const methodology = Domain.resolveDurationMethodology({ durationMethodologies }, standards);
        const result = Domain.calculateConfiguredDuration(methodology, { employees: 250, sites: 1, auditType: 'Surveillance 2', riskLevel: 'Medium' });
        expect(methodology.configured).toBe(true);
        expect(result.baselineDays).toBe(3);
    });

    it('falls back to defaults when a legacy configured rule has no applicable stage row', () => {
        const methodology = Domain.resolveDurationMethodology({
            durationMethodologies: {
                27001: { name: 'Legacy ISMS rules', version: 'Rev 1', tables: { Recertification: [] } }
            }
        }, ['ISO/IEC 27001:2022']);
        const result = Domain.calculateConfiguredDuration(methodology, {
            employees: 300, sites: 1, auditType: 'Recertification', riskLevel: 'Medium'
        });

        expect(result.configured).toBe(true);
        expect(result.baselineDays).toBe(3);
        expect(result.results[0].defaultUsed).toBe(true);
    });

    it('resolves complete draft tables for provisional planning without treating them as approved', () => {
        const standards = ['ISO/IEC 27001:2022', 'ISO 22301:2019'];
        const draftMethod = (name) => ({
            name,
            tables: {
                Recertification: [{ minEmployees: 1, maxEmployees: null, days: 2.5 }]
            }
        });
        const methodology = Domain.resolveProvisionalDurationMethodology({
            durationMethodologyDrafts: {
                27001: draftMethod('Draft ISMS duration rules'),
                22301: draftMethod('Draft BCMS duration rules')
            }
        }, standards);
        const result = Domain.calculateConfiguredDuration(methodology, {
            employees: 300,
            sites: 1,
            auditType: 'Recertification',
            riskLevel: 'Medium'
        });

        expect(methodology.configured).toBe(true);
        expect(methodology.provisional).toBe(true);
        expect(methodology.version).toBe('DRAFT');
        expect(result.configured).toBe(true);
        expect(result.baselineDays).toBe(2.5);
    });

    it('validates lead authorization separately from collective scheme and technical coverage', () => {
        const auditors = [
            { name: 'Lead One', competenceRecords: [{ scheme: 'ISO/IEC 27001:2022', roles: ['Lead Auditor'], status: 'Approved', validUntil: '2027-01-01' }] },
            { name: 'Expert Two', competenceRecords: [{ scheme: 'ISO 22301:2019', roles: ['Technical Expert'], technicalSectors: ['ICT'], status: 'Approved' }] }
        ];
        const result = Domain.validateCompetence({ auditors, leadAuditor: 'Lead One', standards: ['ISO/IEC 27001:2022', 'ISO 22301:2019'], requiredTechnicalSectors: ['ICT'], auditDate: '2026-10-01' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Lead Auditor lacks current Lead Auditor authorization for ISO 22301:2019.');
        expect(result.errors.some((error) => error.includes('collectively cover'))).toBe(false);
    });

    it('reconciles simultaneous work as auditor-hours rather than elapsed hours', () => {
        const reconciliation = Domain.reconcileAgenda({
            hoursPerDay: 8,
            finalAuditorDays: 2,
            teamAllocations: [{ auditor: 'A', days: 1 }, { auditor: 'B', days: 1 }],
            agenda: [{ day: 'Day 1', time: '09:00 - 17:00', item: 'Integrated audit', auditors: ['A', 'B'] }]
        });
        expect(reconciliation.valid).toBe(true);
        expect(reconciliation.elapsedDays).toBe(1);
        expect(reconciliation.scheduledAuditorHours).toBe(16);
    });

    it('enforces append-only override authority and plan transitions', () => {
        expect(() => Domain.createOverride({ category: 'stage', role: 'Auditor', reason: 'test', overrideValue: 'Surveillance 2' })).toThrow(/not authorized/);
        const override = Domain.createOverride({ category: 'stage', role: 'Certification Manager', user: 'Manager', reason: 'Approved cycle correction', originalValue: 'Surveillance 1', overrideValue: 'Surveillance 2' });
        expect(override.reason).toBe('Approved cycle correction');
        expect(Domain.canTransition('Draft', 'Validated', { errors: [] }).allowed).toBe(true);
        expect(Domain.canTransition('Validated', 'Approved', { errors: [] }).allowed).toBe(false);
        expect(Domain.canTransition('Completed', 'Approved', { errors: ['open NC'] }).allowed).toBe(false);
    });

    it('builds mandatory common, scheme, site, finding and control coverage before AI sequencing', () => {
        const matrix = Domain.buildCoverageMatrix({
            standards: ['ISO/IEC 27001:2022', 'ISO 22301:2019', 'ISO/IEC 20000-1:2018'],
            sites: [{ name: 'Head Office' }], previousFindings: [{ id: 'NC-1', clause: '8.1' }], controls: ['A.5.1']
        });
        expect(matrix.common.every((row) => row.mandatory)).toBe(true);
        expect(matrix.standardSpecific).toHaveLength(3);
        expect(matrix.sites[0].area).toBe('Head Office');
        expect(matrix.findings[0].reference).toBe('NC-1');
        expect(matrix.controls[0].area).toBe('A.5.1');
    });
});
