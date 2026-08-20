import { describe, it, expect } from 'vitest';

globalThis.window = globalThis.window || globalThis;
window.Logger = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };

const fs = await import('fs');
const path = await import('path');
// report-stats.js first: the criterion tests assert how the REPORT layer
// classifies what the checklist builder produced, so both halves of that
// contract are exercised together rather than assumed.
eval(fs.readFileSync(path.resolve('./report-stats.js'), 'utf8'));
const src = fs.readFileSync(path.resolve('./client-docs-bulk.js'), 'utf8');
eval(src);

const B = window.ClientDocsBulk;

// Six departments, each with an explicit organisational cue, for cap testing.
const DEPARTMENT_CUE_TEXT = [
    'The Production Department runs the line.',
    'The Quality Department approves releases.',
    'The Engineering Department owns the drawings.',
    'The Maintenance Department services the plant.',
    'The Purchasing Department places orders.',
    'The Planning Department schedules work.'
].join(' ');

describe('ClientDocsBulk', () => {
    describe('parseDocumentName — the QMS-section naming clients actually use', () => {
        it('splits "Section 1 - Organization Profile.docx"', () => {
            const p = B.parseDocumentName('Section 1 - Organization Profile.docx');
            expect(p.sectionRef).toBe('1');
            expect(p.title).toBe('Organization Profile');
            expect(p.ext).toBe('docx');
        });

        it('handles letter-suffixed sections and em-dash separators', () => {
            const p = B.parseDocumentName('Section 8B — Rework & Repair Procedure (Class 3).docx');
            expect(p.sectionRef).toBe('8B');
            expect(p.title).toBe('Rework & Repair Procedure (Class 3)');
            expect(p.category).toBe('Quality Procedures');
        });

        it('does not mistake "Class 3" for a revision', () => {
            const p = B.parseDocumentName('Section 8a - IPC WHMA-A-620 Class 3 Procedure.docx');
            expect(p.sectionRef).toBe('8a');
            expect(p.revision).toBe('');
            expect(p.title).toContain('IPC WHMA-A-620');
        });

        it('flags a re-saved copy: "Improvement1" is "Improvement"', () => {
            const p = B.parseDocumentName('Section 10 - Improvement1.docx');
            expect(p.title).toBe('Improvement');
            expect(p.copyIndex).toBe(1);
        });

        it('flags Windows-style "(1)" copies', () => {
            const p = B.parseDocumentName('Quality Manual (2).docx');
            expect(p.title).toBe('Quality Manual');
            expect(p.copyIndex).toBe(2);
        });

        it('reads document number, revision and date out of one name', () => {
            const p = B.parseDocumentName('QSP-7.5 Control of Documented Information Rev 2 2024-05-12.pdf');
            expect(p.docNumber).toBe('QSP-7.5');
            expect(p.revision).toBe('Rev 2');
            expect(p.date).toBe('2024-05-12');
            expect(p.title).toBe('Control of Documented Information');
            expect(p.category).toBe('Quality Procedures');
        });

        it('treats anything under a FORMS folder as a record/format', () => {
            const p = B.parseDocumentName('Training Attendance.docx', 'FORMS/Training Attendance.docx');
            expect(p.category).toBe('Records / Forms Register');
            expect(p.isForm).toBe(true);
        });

        it('accepts a Windows backslash path from a Compress-Archive ZIP', () => {
            const p = B.parseDocumentName('FORMS\\F-QP-01 Training Record Rev 2.docx', 'FORMS\\F-QP-01 Training Record Rev 2.docx');
            expect(p.title).toBe('Training Record');
            expect(p.docNumber).toBe('F-QP-01');
            expect(p.revision).toBe('Rev 2');
            expect(p.category).toBe('Records / Forms Register');
        });

        it('falls back to System Manual for a bare numbered section', () => {
            expect(B.parseDocumentName('Section 4 - Context of the Organization.docx').category).toBe('System Manual');
        });

        it('does not read "Review" as a revision marker', () => {
            expect(B.parseDocumentName('Management Review Procedure.docx').revision).toBe('');
        });
    });

    describe('findDate', () => {
        it('reads ISO dates', () => expect(B.findDate('report 2024-05-12 final')).toBe('2024-05-12'));
        it('reads 13-Aug-26 style dates', () => expect(B.findDate('issued 13-Aug-26')).toBe('2026-08-13'));
        it('reads day-first slashed dates', () => expect(B.findDate('12/05/2024')).toBe('2024-05-12'));
        it('reads month and year only', () => expect(B.findDate('August 2026')).toBe('2026-08-01'));
        it('does not read a clause number as a date', () => expect(B.findDate('QSP-7.5.12 Control')).toBe(''));
        it('returns empty for no date', () => expect(B.findDate('Quality Manual')).toBe(''));
    });

    describe('findRevision', () => {
        it('reads numeric revisions', () => expect(B.findRevision('Manual Rev 3')).toBe('Rev 3'));
        it('reads dotted versions', () => expect(B.findRevision('Procedure v2.1')).toBe('Rev 2.1'));
        it('reads letter revisions', () => expect(B.findRevision('Drawing Rev B')).toBe('Rev B'));
        it('reads issue numbers', () => expect(B.findRevision('Issue 4 Quality Manual')).toBe('Rev 4'));
        it('ignores the word Review', () => expect(B.findRevision('Contract Review')).toBe(''));
        it('ignores Revision Control as a title', () => expect(B.findRevision('Revision Control')).toBe(''));
    });

    describe('mapClauses', () => {
        const map = (fileName, relPath) => B.mapClauses(B.parseDocumentName(fileName, relPath), null);

        it('maps an Annex SL section number when nothing more specific exists', () => {
            expect(map('Section 5 - Leadership.docx')).toContain('5.1');
        });

        it('maps improvement to 10.x', () => {
            expect(map('Section 10 - Improvement.docx')).toEqual(['10.1', '10.3']);
        });

        it('maps a counterfeit-parts procedure to purchasing and traceability', () => {
            const clauses = map('Section 13 - Counterfeit Parts Prevention and Traceability Procedure.docx');
            expect(clauses).toContain('8.4');
            expect(clauses).toContain('8.5');
        });

        it('maps export control to compliance obligations', () => {
            const clauses = map('Section 11 - Export-Control Compliance Policy.docx');
            expect(clauses).toContain('4.2');
            expect(clauses).toContain('5.2');
        });

        it('prefers an explicit clause number in the title', () => {
            expect(map('QSP-7.5 Control of Documented Information.docx')).toContain('7.5');
        });

        it('leaves an informative section unmapped', () => {
            expect(map('Section 3 - Terms and Abbreviations.docx')).toEqual([]);
        });

        it('drops a bare main clause once a sub-clause of it is present', () => {
            const clauses = map('Section 9 - Internal Audit.docx');
            expect(clauses).toContain('9.2');
            expect(clauses).not.toContain('9');
        });

        it('honours clause references found in the document body', () => {
            const parsed = B.parseDocumentName('Operations.docx');
            const content = { clauseRefs: ['8.4', '8.6'], headings: [] };
            expect(B.mapClauses(parsed, content)).toEqual(expect.arrayContaining(['8.4', '8.6']));
        });
    });

    describe('parseContentMeta', () => {
        const text = [
            'ACME Manufacturing Limited',
            'Control of Documented Information',
            'Document No: QSP-7.5',
            'Revision: 4',
            'Issue Date: 12/05/2024',
            '',
            '1. Purpose',
            '7.5.1 General requirements',
            '7.5.3 Control of documented information'
        ].join('\n');

        it('reads the header block', () => {
            const meta = B.parseContentMeta(text);
            expect(meta.docNumber).toBe('QSP-7.5');
            expect(meta.revision).toBe('Rev 4');
            expect(meta.date).toBe('2024-05-12');
        });

        it('takes the title from the first real line', () => {
            expect(B.parseContentMeta(text).title).toBe('ACME Manufacturing Limited');
        });

        it('collects numbered headings and their clause refs', () => {
            const meta = B.parseContentMeta(text);
            expect(meta.headings.length).toBeGreaterThanOrEqual(3);
            expect(meta.clauseRefs).toContain('7.5.1');
        });

        it('survives empty input', () => {
            expect(B.parseContentMeta('').headings).toEqual([]);
        });
    });

    describe('docKey', () => {
        it('matches the same document written differently', () => {
            expect(B.docKey({ title: 'Quality Manual', sectionRef: '2' }))
                .toBe(B.docKey({ title: 'quality  manual!', sectionRef: '2' }));
        });

        it('separates the same title under different sections', () => {
            expect(B.docKey({ title: 'Improvement', sectionRef: '10' }))
                .not.toBe(B.docKey({ title: 'Improvement', sectionRef: '9' }));
        });
    });

    describe('buildSurveillanceChecklist', () => {
        const client = { id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015' };
        const docs = [
            { name: 'Control of Documented Information', docNumber: 'QSP-7.5', revision: 'Rev 2', category: 'Quality Procedures', linkedClauses: '7.5' },
            { name: 'Training Attendance', category: 'Records / Forms Register', linkedClauses: '7.2' },
            { name: 'Terms and Abbreviations', category: 'System Manual', linkedClauses: '' }
        ];

        it('leads with the ISO 17021-1 mandatory surveillance elements', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, { auditType: 'surveillance' });
            expect(cl.clauses[0].mainClause).toBe('SURV');
            expect(cl.clauses[0].subClauses).toHaveLength(8);
            expect(cl.clauses[0].subClauses[0].clause).toBe('9.6.2 (a)');
        });

        // The execution view renders one row per sub-clause and reads at most
        // items[0], so stacking questions inside a sub-clause would hide them.
        it('gives every question its own sub-clause with a readable requirement', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, {});
            cl.clauses.forEach(main => main.subClauses.forEach(sub => {
                expect(sub.items).toHaveLength(1);
                expect(sub.requirement).toBeTruthy();
                expect(sub.items[0].requirement).toBe(sub.requirement);
            }));
        });

        it('omits the mandatory block when asked to', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, { auditType: 'surveillance', includeMandatory: false });
            expect(cl.clauses.some(c => c.mainClause === 'SURV')).toBe(false);
        });

        it('omits the mandatory block for an initial audit', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, { auditType: 'initial' });
            expect(cl.clauses.some(c => c.mainClause === 'SURV')).toBe(false);
        });

        it('groups document questions under their mapped clause', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, {});
            const clause7 = cl.clauses.find(c => c.mainClause === '7');
            expect(clause7.title).toBe('Support');
            const on75 = clause7.subClauses.filter(s => s.clause === '7.5');
            expect(on75).toHaveLength(2);
            expect(on75[0].requirement).toContain('QSP-7.5 Rev 2');
            expect(on75[0].title).toBe('Control of Documented Information');
        });

        it('gives a form one sampling question rather than two', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, {});
            const on72 = cl.clauses.find(c => c.mainClause === '7').subClauses.filter(s => s.clause === '7.2');
            expect(on72).toHaveLength(1);
            expect(on72[0].requirement).toContain('Sample completed');
        });

        it('orders sub-clauses numerically', () => {
            const many = [
                { name: 'A', category: 'Certificate', linkedClauses: '8.10' },
                { name: 'B', category: 'Certificate', linkedClauses: '8.2' }
            ];
            const cl = B.buildSurveillanceChecklist(client, many, {});
            expect(cl.clauses.find(c => c.mainClause === '8').subClauses.map(s => s.clause)).toEqual(['8.2', '8.10']);
        });

        it('parks unmapped documents in their own section', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, {});
            const other = cl.clauses.find(c => c.mainClause === 'DOC');
            expect(other.subClauses[0].requirement).toContain('Terms and Abbreviations');
        });

        it('counts its own items and carries the client through', () => {
            const cl = B.buildSurveillanceChecklist(client, docs, { standard: 'ISO 9001:2015' });
            const counted = cl.clauses.reduce((t, c) => t + c.subClauses.reduce((s, sc) => s + sc.items.length, 0), 0);
            expect(cl.itemCount).toBe(counted);
            expect(cl.clientName).toBe('KTD Select');
            expect(cl.source).toBe('client-documents');
        });
    });

    describe('orgSizeProfile', () => {
        it('sizes a micro organisation tightly', () => {
            const p = B.orgSizeProfile({ employees: 8 });
            expect(p.band).toBe('micro');
            expect(p.caps.departments).toBe(4);
        });

        it('scales with headcount', () => {
            expect(B.orgSizeProfile({ employees: 30 }).band).toBe('small');
            expect(B.orgSizeProfile({ employees: 120 }).band).toBe('medium');
            expect(B.orgSizeProfile({ employees: 900 }).band).toBe('large');
            expect(B.orgSizeProfile({ employees: 900 }).caps.departments)
                .toBeGreaterThan(B.orgSizeProfile({ employees: 30 }).caps.departments);
        });

        it('assumes small rather than unlimited when headcount is unknown', () => {
            const p = B.orgSizeProfile({});
            expect(p.band).toBe('unknown');
            expect(p.caps.departments).toBeLessThan(B.orgSizeProfile({ employees: 900 }).caps.departments);
        });

        it('gives multi-site organisations a little more headroom', () => {
            const one = B.orgSizeProfile({ employees: 30, sites: [{ name: 'A' }] });
            const three = B.orgSizeProfile({ employees: 30, sites: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
            expect(three.caps.departments).toBe(one.caps.departments + 2);
        });

        it('copes with a headcount written as text', () => {
            expect(B.orgSizeProfile({ employees: '120 staff' }).band).toBe('medium');
        });
    });

    describe('extractOrgEntities', () => {
        const client = { name: 'KTD Select', employees: 120, sites: [{ name: 'Head Office' }] };
        const entries = [
            {
                title: 'Control of Documented Information', category: 'Quality Procedures', clauses: '7.5',
                text: 'The Quality Assurance Department maintains the master list. The Quality Manager approves each revision and the Document Controller issues copies. Production Department holds controlled copies. Records are kept after testing and inspection of each batch.'
            },
            {
                title: 'Rework & Repair Procedure (Class 3)', category: 'Quality Procedures', clauses: '8.7',
                text: 'The Production Supervisor raises the rework request. The Quality Inspector verifies the repair. Scope of the QMS: manufacture of wire harnesses and cable assemblies. Work is performed to IPC WHMA-A-620 Class 3.'
            },
            {
                title: 'Calibration Log', category: 'Records / Forms Register', clauses: '7.1.5',
                text: 'Maintenance Department records.'
            }
        ];

        it('finds departments the documents name as units', () => {
            const names = B.extractOrgEntities(entries, client).departments.map(d => d.name.toLowerCase());
            expect(names).toContain('quality assurance');
            expect(names).toContain('production');
            expect(names).toContain('maintenance');
        });

        // The old extractor turned every mention of an activity into a department,
        // which is how one small client ended up with 22 of them.
        it('does not turn an activity mentioned in a procedure into a department', () => {
            const names = B.extractOrgEntities(entries, client).departments.map(d => d.name.toLowerCase());
            expect(names).not.toContain('testing');
            expect(names).not.toContain('inspection');
            expect(names).not.toContain('calibration');
        });

        it('accepts a dictionary department only with an organisational cue', () => {
            expect(B.extractDepartments('Training is provided annually.', 8)).toHaveLength(0);
            expect(B.extractDepartments('The Training Department maintains the matrix.', 8)).toHaveLength(1);
            expect(B.extractDepartments('The Training Manager maintains the matrix.', 8)).toHaveLength(1);
        });

        it('records why each department was accepted', () => {
            const dept = B.extractDepartments('The Quality Department approves.', 8)[0];
            expect(dept.evidence).toBeTruthy();
        });

        it('caps departments at what the organisation size supports', () => {
            const wordy = DEPARTMENT_CUE_TEXT;
            expect(B.extractDepartments(wordy, 3)).toHaveLength(3);
        });

        it('assigns a risk level to dictionary departments', () => {
            const qa = B.extractOrgEntities(entries, client).departments.find(d => /quality assurance/i.test(d.name));
            expect(qa.risk).toBe('High');
        });

        it('finds job titles and ranks them by how often they appear', () => {
            const titles = B.extractOrgEntities(entries, client).designations.map(d => d.title);
            expect(titles).toContain('Quality Manager');
            expect(titles).toContain('Production Supervisor');
            expect(titles).toContain('Quality Inspector');
        });

        it('does not read "Head Office" as a job title', () => {
            expect(B.extractDesignations('The Head Office is in Karachi.', 12).map(d => d.title)).not.toContain('Head');
        });

        it('does not read a sentence opener as a name', () => {
            const titles = B.extractDesignations('The Manager shall approve. This Engineer must sign.', 12).map(d => d.title);
            expect(titles.some(t => /^(the|this)\b/i.test(t))).toBe(false);
        });

        it('turns controlled procedures into process names', () => {
            const names = B.extractOrgEntities(entries, client).processes.map(p => p.name);
            expect(names).toContain('Rework & Repair');
            expect(names).toContain('Control of Documented Information');
        });

        it('classifies a clause 8 procedure as a core process', () => {
            expect(B.extractOrgEntities(entries, client).processes.find(p => p.name === 'Rework & Repair').category).toBe('Core');
        });

        it('marks a process outsourced only on evidence near the title', () => {
            const outsourced = B.extractProcesses([{ title: 'Calibration Procedure', category: 'Quality Procedures', clauses: '7.1.5', text: 'Calibration is subcontracted to an accredited laboratory.' }], 14);
            expect(outsourced[0].category).toBe('Outsourced');
        });

        // A passing mention of external providers deep in a procedure used to
        // mark in-house processes as outsourced.
        it('does not mark a process outsourced on a passing mention', () => {
            const body = 'Assembly is performed in house. ' + 'Filler text. '.repeat(60) + 'Records from an external provider are retained.';
            const procs = B.extractProcesses([{ title: 'Assembly Procedure', category: 'Quality Procedures', clauses: '8.1', text: body }], 14);
            expect(procs[0].category).toBe('Core');
        });

        it('does not treat a blank form as a process', () => {
            expect(B.extractOrgEntities(entries, client).processes.map(p => p.name)).not.toContain('Calibration Log');
        });

        it('reads products out of a scope statement', () => {
            const names = B.extractOrgEntities(entries, client).goods.map(g => g.name.toLowerCase());
            expect(names).toContain('wire harnesses');
            expect(names).toContain('cable assemblies');
        });

        it('rejects specification codes as products', () => {
            const names = B.extractOrgEntities(entries, client).goods.map(g => g.name.toLowerCase());
            expect(names.some(n => /ipc|whma|iso \d/.test(n))).toBe(false);
        });

        it('rejects generic nouns as products', () => {
            const goods = B.extractGoodsServices('Scope: products and services and activities.', 10, client);
            expect(goods).toHaveLength(0);
        });

        it('rejects document titles and the client\'s own name as products', () => {
            const goods = B.extractGoodsServices('Manufacture of KTD Select QMS Section 8 Operations.', 10, client);
            expect(goods).toHaveLength(0);
        });

        it('rejects a bare part-number label', () => {
            expect(B.extractGoodsServices('Supply of Part Number.', 10, client)).toHaveLength(0);
        });

        it('does not return the verb phrase and the noun phrase as two products', () => {
            const names = B.extractGoodsServices('Scope: manufacture of wiring harnesses and cabling.', 10, client).map(g => g.name);
            expect(names).toContain('wiring harnesses');
            expect(names.some(n => /^manufacture of/i.test(n))).toBe(false);
        });

        it('keeps a process name longer than a department name', () => {
            const procs = B.extractProcesses([{ title: 'Section 13 - Counterfeit Parts Prevention and Traceability Procedure', category: 'Quality Procedures', clauses: '8.4', text: '' }], 14);
            expect(procs.map(p => p.name)).toContain('Counterfeit Parts Prevention and Traceability');
        });

        it('keeps a meaningful single-word product', () => {
            expect(B.extractGoodsServices('Manufacture of cabling.', 10, client).map(g => g.name)).toContain('cabling');
        });

        it('caps products at what the organisation size supports', () => {
            const many = 'Scope: alpha units, beta units, gamma units, delta units, epsilon units, zeta units.';
            expect(B.extractGoodsServices(many, 3, client).length).toBeLessThanOrEqual(3);
        });

        it('survives an empty corpus', () => {
            const out = B.extractOrgEntities([], client);
            expect(out.departments).toEqual([]);
            expect(out.processes).toEqual([]);
            expect(out.profile.band).toBe('medium');
        });
    });

    describe('mapDocumentsToStage1', () => {
        const docs = [
            { name: 'Control of Documented Information', docNumber: 'QSP-7.5', revision: 'Rev 2', linkedClauses: '7.5' },
            { name: 'Internal Audit Procedure', linkedClauses: '9.2' },
            { name: 'Organization Profile', linkedClauses: '4.1, 4.2' }
        ];

        it('covers all sixteen Stage 1 items', () => {
            expect(B.mapDocumentsToStage1(docs)).toHaveLength(16);
            expect(B.STAGE1_MAP).toHaveLength(16);
        });

        it('matches a document to its item by clause', () => {
            const item = B.mapDocumentsToStage1(docs).find(m => m.id === 'documented_info');
            expect(item.docs.map(d => d.name)).toContain('Control of Documented Information');
            expect(item.line).toContain('QSP-7.5 Rev 2');
        });

        it('matches on subject when the clause is absent', () => {
            const item = B.mapDocumentsToStage1([{ name: 'Internal Audit Schedule 2026' }]).find(m => m.id === 'internal_audit');
            expect(item.docs).toHaveLength(1);
        });

        it('treats a sub-clause as covering its parent item', () => {
            const item = B.mapDocumentsToStage1([{ name: 'Calibration', linkedClauses: '7.1.5' }]).find(m => m.id === 'resources');
            expect(item.docs).toHaveLength(1);
        });

        it('leaves the line empty for items with nothing on file', () => {
            const item = B.mapDocumentsToStage1(docs).find(m => m.id === 'site_readiness');
            expect(item.docs).toHaveLength(0);
            expect(item.line).toBe('');
        });

        it('handles a client with no documents', () => {
            expect(B.mapDocumentsToStage1([]).every(m => m.docs.length === 0)).toBe(true);
        });
    });

    describe('analyseDocumentGaps', () => {
        const clauses = [
            { clause: '1', title: 'Scope' },
            { clause: '3', title: 'Terms and definitions' },
            { clause: '4.1', title: 'Understanding the organization and its context' },
            { clause: '7.5', title: 'Documented information' },
            { clause: '7.5.1', title: 'General' },
            { clause: '9.2', title: 'Internal audit' }
        ];
        const docs = [
            { name: 'Organization Profile', linkedClauses: '4.1' },
            { name: 'Control of Documented Information', docNumber: 'QSP-7.5', linkedClauses: '7.5' }
        ];

        it('ignores clauses 1-3, which carry no auditable requirement', () => {
            const a = B.analyseDocumentGaps(clauses, docs);
            expect(a.total).toBe(4);
            expect(a.rows.map(r => r.clause)).not.toContain('1');
        });

        it('counts coverage and gaps', () => {
            const a = B.analyseDocumentGaps(clauses, docs);
            expect(a.covered).toBe(3);
            expect(a.gaps).toBe(1);
            expect(a.percent).toBe(75);
        });

        it('lets a document on the parent clause cover its sub-clause', () => {
            const a = B.analyseDocumentGaps(clauses, docs);
            expect(a.rows.find(r => r.clause === '7.5.1').covered).toBe(true);
        });

        it('lets a document on a sub-clause cover the parent', () => {
            const a = B.analyseDocumentGaps([{ clause: '8.4' }], [{ name: 'Supplier Eval', linkedClauses: '8.4.1' }]);
            expect(a.rows[0].covered).toBe(true);
        });

        it('does not let 7.5 cover 7.50-style near matches', () => {
            expect(B.clauseSatisfies('7.5', '7.51')).toBe(false);
        });

        it('names the documents that cover each clause', () => {
            const row = B.analyseDocumentGaps(clauses, docs).rows.find(r => r.clause === '7.5');
            expect(row.docs[0].name).toBe('Control of Documented Information');
        });

        it('reports every clause as a gap when nothing is on file', () => {
            const a = B.analyseDocumentGaps(clauses, []);
            expect(a.covered).toBe(0);
            expect(a.percent).toBe(0);
        });

        it('does not divide by zero on an empty clause set', () => {
            expect(B.analyseDocumentGaps([], docs).percent).toBe(0);
        });
    });

    describe('AI Stage 1 review', () => {
        const client = { name: 'KTD Select', industry: 'Electronics', employees: 45, sites: [{ name: 'HO' }], documents: [{ name: 'Quality Manual', revision: 'Rev 3', linkedClauses: '4.3' }] };
        const plan = { standard: 'ISO 9001:2015', auditType: 'Surveillance' };

        it('asks about every Stage 1 item', () => {
            const prompt = B.buildStage1Prompt(client, plan, 'corpus');
            B.STAGE1_MAP.forEach(item => expect(prompt).toContain(item.id));
        });

        it('tells the model to judge documentation, not implementation', () => {
            expect(B.buildStage1Prompt(client, plan, 'corpus')).toMatch(/DOCUMENTATION only/i);
        });

        it('asks for the summary the auditor needs', () => {
            const prompt = B.buildStage1Prompt(client, plan, 'corpus');
            ['newOrChangedProcesses', 'documentsUpdated', 'trainingRecords', 'managementReview', 'internalAudit', 'focusPoints']
                .forEach(key => expect(prompt).toContain(key));
        });

        it('parses a fenced review response', () => {
            const out = B.parseStage1Response('```json\n{"items":[{"id":"scope","status":"ok","comment":"Manual Rev 3 states the scope."}],"summary":{"internalAudit":"none supplied"},"focusPoints":["Sample the rework line"]}\n```');
            expect(out.items).toHaveLength(1);
            expect(out.items[0].status).toBe('ok');
            expect(out.summary.internalAudit).toBe('none supplied');
            expect(out.focusPoints).toEqual(['Sample the rework line']);
        });

        it('drops items whose id is not a real Stage 1 item', () => {
            const out = B.parseStage1Response('{"items":[{"id":"made_up","status":"ok"},{"id":"scope","status":"minor"}]}');
            expect(out.items.map(i => i.id)).toEqual(['scope']);
        });

        it('rejects a status outside the allowed set', () => {
            const out = B.parseStage1Response('{"items":[{"id":"scope","status":"excellent"}]}');
            expect(out.items[0].status).toBe('');
        });

        it('caps focus points', () => {
            const many = JSON.stringify({ items: [], focusPoints: Array.from({ length: 20 }, (_, i) => 'point ' + i) });
            expect(B.parseStage1Response(many).focusPoints).toHaveLength(8);
        });

        it('returns empty rather than throwing on malformed JSON', () => {
            expect(B.parseStage1Response('{"items": [').items).toEqual([]);
            expect(B.parseStage1Response('').items).toEqual([]);
        });
    });

    describe('checklist audit-focus section', () => {
        const client = { id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015' };
        const docs = [{ name: 'Quality Manual', category: 'System Manual', linkedClauses: '4.3' }];

        it('leads the checklist with the Stage 1 focus points', () => {
            const cl = B.buildClientChecklist(client, docs, {
                auditType: 'surveillance',
                focusPoints: ['Sample the new rework line', 'Verify the 2026 internal audit was completed']
            });
            expect(cl.clauses[0].mainClause).toBe('FOCUS');
            expect(cl.clauses[0].subClauses).toHaveLength(2);
            expect(cl.clauses[0].subClauses[0].requirement).toContain('rework line');
        });

        it('omits the section when the pre-audit produced no focus points', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', focusPoints: [] });
            expect(cl.clauses.some(c => c.mainClause === 'FOCUS')).toBe(false);
        });

        it('ignores non-string focus points', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', focusPoints: [null, '', 'Real point'] });
            expect(cl.clauses[0].subClauses).toHaveLength(1);
        });
    });

    describe('mergeEvidenceNote', () => {
        it('adds the evidence line above the auditor\'s own notes', () => {
            const out = B.mergeEvidenceNote('Checked on site.', 'Documents on file: QM-01');
            expect(out).toBe('Documents on file: QM-01\nChecked on site.');
        });

        it('replaces a previous evidence line instead of stacking', () => {
            const first = B.mergeEvidenceNote('My note.', 'Documents on file: QM-01');
            const second = B.mergeEvidenceNote(first, 'Documents on file: QM-01; QM-02');
            expect(second).toBe('Documents on file: QM-01; QM-02\nMy note.');
            expect(second.match(/Documents on file:/g)).toHaveLength(1);
        });

        it('never destroys what the auditor wrote', () => {
            expect(B.mergeEvidenceNote('Minor gap in training records.', '')).toBe('Minor gap in training records.');
        });

        it('handles empty notes', () => {
            expect(B.mergeEvidenceNote('', 'Documents on file: QM-01')).toBe('Documents on file: QM-01');
            expect(B.mergeEvidenceNote(undefined, '')).toBe('');
        });
    });

    describe('buildClientChecklist — audit-type scoping', () => {
        const client = {
            id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015',
            sites: [{ name: 'Head Office', city: 'Karachi' }, { name: 'Plant 2', city: 'Lahore' }],
            goodsServices: [{ name: 'Wire Harnesses', category: 'Product' }],
            keyProcesses: [
                { name: 'Assembly', category: 'Core', owner: 'Production Manager' },
                { name: 'Payroll', category: 'Support' },
                { name: 'Calibration', category: 'Outsourced' }
            ]
        };
        const docs = [
            { name: 'Control of Documented Information', docNumber: 'QSP-7.5', revision: 'Rev 2', category: 'Quality Procedures', linkedClauses: '7.5' }
        ];
        const stdClauses = [
            { clause: '4.1', title: 'Context', requirement: 'Determine external and internal issues.' },
            { clause: '7.5', title: 'Documented information', requirement: 'Control documented information.' },
            { clause: '9.2', title: 'Internal audit', requirement: 'Conduct internal audits.' },
            { clause: '3', title: 'Terms' }
        ];

        it('covers every clause of the standard on an initial audit', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            const covered = cl.clauses.flatMap(c => c.subClauses.map(s => s.clause));
            expect(covered).toContain('4.1');
            expect(covered).toContain('7.5');
            expect(covered).toContain('9.2');
        });

        it('calls out clauses the client sent nothing for', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            const audit = cl.clauses.flatMap(c => c.subClauses).find(s => s.clause === '9.2');
            expect(audit.requirement).toContain('No documented information was supplied');
        });

        it('cites the client document where one exists', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            const on75 = cl.clauses.flatMap(c => c.subClauses).filter(s => s.clause === '7.5');
            expect(on75[0].requirement).toContain('QSP-7.5 Rev 2');
        });

        it('skips clauses 1-3 even on a full-coverage audit', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            expect(cl.clauses.flatMap(c => c.subClauses.map(s => s.clause))).not.toContain('3');
        });

        it('does not add the surveillance mandatory block to an initial audit', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            expect(cl.clauses.some(c => c.mainClause === 'SURV')).toBe(false);
        });

        it('stays document-driven on surveillance even when a clause list is passed', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', standardClauses: stdClauses });
            const clauseRefs = cl.clauses.flatMap(c => c.subClauses.map(s => s.clause));
            expect(clauseRefs).toContain('7.5');
            expect(clauseRefs).not.toContain('9.2');
            expect(cl.clauses.some(c => c.mainClause === 'SURV')).toBe(true);
        });

        it('samples only core and outsourced processes on surveillance', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const org = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.map(s => s.title);
            expect(org).toContain('Assembly (Core)');
            expect(org).toContain('Calibration (Outsourced)');
            expect(org).not.toContain('Payroll (Support)');
        });

        it('samples every process on an initial audit', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses });
            const org = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.map(s => s.title);
            expect(org).toContain('Payroll (Support)');
        });

        it('treats an outsourced process as an external-provider control', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const calib = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.find(s => /Calibration/.test(s.title));
            expect(calib.requirement).toContain('external provider');
        });

        it('checks the certified scope against what is actually supplied', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const scope = cl.clauses.find(c => c.mainClause === 'ORG').subClauses[0];
            expect(scope.requirement).toContain('Wire Harnesses');
        });

        it('lists each site when the client is multi-site', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const org = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.map(s => s.title);
            expect(org).toContain('Plant 2');
        });

        it('omits the org section when asked to', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', includeOrgContext: false });
            expect(cl.clauses.some(c => c.mainClause === 'ORG')).toBe(false);
        });

        it('names the checklist after the audit type', () => {
            expect(B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses }).name)
                .toContain('Initial Audit Checklist');
            expect(B.buildClientChecklist(client, docs, { auditType: 'recertification', standardClauses: stdClauses }).name)
                .toContain('Recertification Audit Checklist');
        });

        it('records how many documents fed it', () => {
            expect(B.buildClientChecklist(client, docs, { auditType: 'surveillance' }).documentsUsed).toBe(1);
        });
    });

    // Report Integrity blocks any Major/Minor finding whose clause is a
    // pseudo-tag (FOCUS/SURV/ORG/DOC) with no criterionRef — before this fix,
    // ORG and DOC items never set one, so every ORG/DOC-sourced finding was
    // permanently unfixable. See client-docs-bulk.js's orgContextQuestions()
    // and the DOC unmapped-documents block in buildClientChecklist().
    describe('criterionRef on ORG/DOC items — closing the finalize-blocking hole', () => {
        const client = {
            id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015',
            sites: [{ name: 'Head Office', city: 'Karachi' }, { name: 'Plant 2', city: 'Lahore' }],
            goodsServices: [{ name: 'Wire Harnesses', category: 'Product' }],
            keyProcesses: [
                { name: 'Assembly', category: 'Core', owner: 'Production Manager' },
                // Deliberately NOT named "Calibration" — that name collides with
                // deriveCriterionRef's own keyword fallback (-> 7.1.5) and would
                // mask the explicit 8.4 mapping under test below.
                { name: 'Freight Forwarding', category: 'Outsourced' }
            ]
        };
        const docs = [
            { name: 'Control of Documented Information', docNumber: 'QSP-7.5', revision: 'Rev 2', category: 'Quality Procedures', linkedClauses: '7.5' }
        ];

        it('maps the certified-scope ORG item to 4.3', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const scope = cl.clauses.find(c => c.mainClause === 'ORG').subClauses[0];
            expect(scope.clause).toBe('ORG'); // pseudo-tag section grouping is unchanged
            expect(scope.criterionRef).toBe('4.3');
            expect(scope.criterionSource).toBe('org-context');
        });

        it('maps a per-site ORG item to 4.3', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const site = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.find(s => s.title === 'Plant 2');
            expect(site.criterionRef).toBe('4.3');
            expect(site.criterionSource).toBe('org-context');
        });

        it('maps an outsourced-process ORG item to 8.4', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const outsourced = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.find(s => /Freight Forwarding/.test(s.title));
            expect(outsourced.criterionRef).toBe('8.4');
            expect(outsourced.criterionSource).toBe('org-context');
        });

        it('maps an end-to-end sampled process ORG item to 8.1', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            const core = cl.clauses.find(c => c.mainClause === 'ORG').subClauses.find(s => /Assembly/.test(s.title));
            expect(core.criterionRef).toBe('8.1');
            expect(core.criterionSource).toBe('org-context');
        });

        it('maps an unmapped DOC item to 7.5 by default', () => {
            const unmapped = [{ name: 'Miscellaneous Notice', category: 'Other' }]; // no linkedClauses
            const cl = B.buildClientChecklist(client, unmapped, { auditType: 'surveillance' });
            const docSection = cl.clauses.find(c => c.mainClause === 'DOC');
            expect(docSection).toBeTruthy();
            expect(docSection.subClauses[0].clause).toBe('DOC');
            expect(docSection.subClauses[0].criterionRef).toBe('7.5');
            expect(docSection.subClauses[0].criterionSource).toBe('unmapped-doc');
        });

        // A clause number sitting in the question's own text is a SUGGESTION,
        // not a confirmed criterion (this is the exact defect the client
        // reported: a competence finding got formally recorded against 9.2
        // purely because "9.2" appeared in the source question text). So a
        // text-derived clause no longer overrides the ORG/DOC template
        // default in criterionRef — it's recorded separately, unconfirmed.
        it('records a clause found in the text as an unconfirmed suggestion, not a confirmed criterion', () => {
            const clientWithClause = {
                ...client,
                goodsServices: [{ name: 'Assemblies certified under clause 8.2 of the manual' }]
            };
            const cl = B.buildClientChecklist(clientWithClause, docs, { auditType: 'surveillance' });
            const scope = cl.clauses.find(c => c.mainClause === 'ORG').subClauses[0];
            expect(scope.criterionRef).toBe('');
            expect(scope.criterionSuggestedRef).toBe('8.2');
            expect(scope.criterionConfidence).toBe('medium');
            expect(scope.criterionBasis).toBe('clause-token-in-question');
            expect(scope.criterionConfirmed).toBe(false);
        });

        it('does not invent an Annex-SL clause number for a non-Annex-SL-family standard', () => {
            // opts.standard (not client.standard) is what deriveCriterionRef sees —
            // matches how the real caller (createChecklist) invokes this.
            const unmapped = [{ name: 'Miscellaneous Notice', category: 'Other' }];
            const cl = B.buildClientChecklist(client, unmapped, { auditType: 'surveillance', standard: 'ISO/IEC 17021-1:2015' });
            const scope = cl.clauses.find(c => c.mainClause === 'ORG').subClauses[0];
            const docSection = cl.clauses.find(c => c.mainClause === 'DOC');
            expect(scope.criterionRef).toBe('');
            expect(docSection.subClauses[0].criterionRef).toBe('');
        });
    });

    // deriveCriterionSuggestion() is the honest contract: it never claims
    // more than "here is a candidate, and here is how sure we are". A clause
    // token literally present in the question text is 'medium' at best (it's
    // the question's clause, not necessarily the unfulfilled requirement);
    // the keyword table is 'low'; nothing found is 'none'. 'high' never
    // appears — only an auditor (or an evidence-based suggester) can confirm.
    describe('deriveCriterionSuggestion — confidence-graded, never a confirmed criterion', () => {
        it('grades an explicit clause token in the text as medium confidence', () => {
            const s = B.deriveCriterionSuggestion('Verify the 8.2.1 sales process is followed.', 'ISO 9001:2015');
            expect(s).toEqual({ ref: '8.2.1', confidence: 'medium', basis: 'clause-token-in-question' });
        });

        it('grades a keyword-table match as low confidence', () => {
            const s = B.deriveCriterionSuggestion('Verify the 2026 internal audit was completed.', 'ISO 9001:2015');
            expect(s).toEqual({ ref: '9.2', confidence: 'low', basis: 'keyword-fallback' });
        });

        it('returns none when nothing plausible is found — never invents a clause', () => {
            const s = B.deriveCriterionSuggestion('Confirm the canteen rota is up to date.', 'ISO 9001:2015');
            expect(s).toEqual({ ref: '', confidence: 'none', basis: 'none' });
        });

        it('still resolves the ambiguous legal/statutory keyword entry to none, not a guess', () => {
            const s = B.deriveCriterionSuggestion('Confirm legal and regulatory obligations are tracked.', 'ISO 9001:2015');
            expect(s).toEqual({ ref: '', confidence: 'none', basis: 'none' });
        });

        it('deriveCriterionRef stays a thin string-only wrapper for existing external callers', () => {
            expect(B.deriveCriterionRef('Verify the 8.2.1 sales process is followed.', 'ISO 9001:2015')).toBe('8.2.1');
            expect(B.deriveCriterionRef('Confirm the canteen rota is up to date.', 'ISO 9001:2015')).toBe('');
        });
    });

    // FOCUS (Stage 1 carry-over) and SURV (mandatory §9.6.2) items have no
    // template default at all — every non-empty result comes straight from
    // the question's own text, so per the client's spec none of it may be
    // presented as a confirmed criterion.
    describe('FOCUS/SURV items never get an auto-confirmed criterionRef', () => {
        const client = { id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015' };
        const docs = [{ name: 'Quality Manual', category: 'System Manual', linkedClauses: '4.3' }];

        it('records a FOCUS item\'s text-derived clause as an unconfirmed suggestion', () => {
            const cl = B.buildClientChecklist(client, docs, {
                auditType: 'surveillance',
                focusPoints: ['Verify the 8.2.1 sales process is followed.']
            });
            const focusItem = cl.clauses.find(c => c.mainClause === 'FOCUS').subClauses[0];
            expect(focusItem.criterionRef).toBe('');
            expect(focusItem.criterionSuggestedRef).toBe('8.2.1');
            expect(focusItem.criterionConfidence).toBe('medium');
            expect(focusItem.criterionConfirmed).toBe(false);
            expect(focusItem.criterionSource).toBe('focus-carryover');
        });

        it('leaves a FOCUS item with no plausible clause fully empty, with no invented suggestion', () => {
            const cl = B.buildClientChecklist(client, docs, {
                auditType: 'surveillance',
                focusPoints: ['Confirm the canteen rota is up to date.']
            });
            const focusItem = cl.clauses.find(c => c.mainClause === 'FOCUS').subClauses[0];
            expect(focusItem.criterionRef).toBe('');
            expect(focusItem.criterionSuggestedRef).toBeUndefined();
            expect(focusItem.criterionConfirmed).toBeUndefined();
        });

        // A §9.6.2 element is an ISO/IEC 17021-1 PROGRAMME criterion governing
        // the certification body's own surveillance — it is not a clause of the
        // client's standard, and its criterion is already known. Running the
        // ISO-clause suggester over its text produced actively harmful hints:
        // element (b) ("actions taken on nonconformities … corrective action …")
        // suggested ISO 9001 10.2, which would invite an auditor to stamp a
        // client-standard clause onto a CB-programme criterion.
        it('offers NO ISO-clause suggestion for a SURV mandatory element', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', includeMandatory: true });
            const survClause = cl.clauses.find(c => c.mainClause === 'SURV');
            expect(survClause).toBeTruthy();
            survClause.subClauses.forEach(item => {
                expect(item.criterionRef).toBe('');
                expect(item.criterionSuggestedRef).toBeUndefined();
                expect(item.criterionSource).toBe('surveillance-programme');
            });
        });

        it('specifically never suggests 10.2 for §9.6.2(b), whose text is all about corrective action', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', includeMandatory: true });
            const b = cl.clauses.find(c => c.mainClause === 'SURV')
                .subClauses.find(i => /\(b\)/.test(i.clause));
            expect(b).toBeTruthy();
            expect(b.criterionSuggestedRef).toBeUndefined();
            // And the report layer must label it a programme criterion, never a
            // clause of the audited standard.
            expect(window.ReportStats.classifyCriterion(b).kind).toBe('programme');
        });
    });

    describe('checklist length budget', () => {
        const client = {
            id: 'c1', name: 'KTD Select', standard: 'ISO 9001:2015', employees: 40,
            sites: [{ name: 'HO' }],
            goodsServices: [{ name: 'Harnesses' }],
            keyProcesses: Array.from({ length: 8 }, (_, i) => ({ name: 'Process ' + i, category: 'Core' }))
        };
        const docs = Array.from({ length: 25 }, (_, i) => ({
            id: 'd' + i, name: 'Procedure ' + i, category: 'Quality Procedures',
            linkedClauses: ['4.1', '7.5', '8.1', '8.4', '9.1'][i % 5]
        }));

        it('sizes a half-day surveillance at about 25 questions', () => {
            expect(B.checklistBudget('Surveillance', 0.5, { band: 'small' })).toBe(25);
        });

        it('grows the budget with man-days', () => {
            expect(B.checklistBudget('Surveillance', 1, {})).toBe(30);
            expect(B.checklistBudget('Surveillance', 2, {})).toBe(45);
            expect(B.checklistBudget('Surveillance', 5, {})).toBe(75);
        });

        it('falls back to a small budget when man-days are not set', () => {
            expect(B.checklistBudget('Surveillance', '', { band: 'small' })).toBe(25);
            expect(B.checklistBudget('Surveillance', null, { band: 'large' })).toBe(40);
        });

        it('does not budget initial or recertification audits', () => {
            expect(B.checklistBudget('Stage 2', 3, {})).toBeNull();
            expect(B.checklistBudget('Recertification', 3, {})).toBeNull();
        });

        it('keeps a budgeted surveillance checklist at or under the target', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', maxItems: 25 });
            expect(cl.itemCount).toBeLessThanOrEqual(25);
        });

        it('is far longer without a budget — the behaviour that made it unusable', () => {
            const unbounded = B.buildClientChecklist(client, docs, { auditType: 'surveillance' });
            expect(unbounded.itemCount).toBeGreaterThan(40);
        });

        it('never trims the focus points or the mandatory elements', () => {
            const cl = B.buildClientChecklist(client, docs, {
                auditType: 'surveillance', maxItems: 25,
                focusPoints: ['Focus one', 'Focus two', 'Focus three']
            });
            expect(cl.clauses.find(c => c.mainClause === 'FOCUS').subClauses).toHaveLength(3);
            expect(cl.clauses.find(c => c.mainClause === 'SURV').subClauses).toHaveLength(8);
            expect(cl.itemCount).toBeLessThanOrEqual(25);
        });

        it('asks about each document once when budgeted', () => {
            const multi = [{ id: 'd1', name: 'Wide Procedure', category: 'Quality Procedures', linkedClauses: '7.5, 8.1, 8.4' }];
            const cl = B.buildClientChecklist(client, multi, { auditType: 'surveillance', maxItems: 25, includeOrgContext: false, includeMandatory: false });
            const mentions = cl.clauses.flatMap(c => c.subClauses).filter(s => /Wide Procedure/.test(s.requirement));
            expect(mentions).toHaveLength(1);
        });

        it('still keeps every clause represented after trimming', () => {
            const cl = B.buildClientChecklist(client, docs, { auditType: 'surveillance', maxItems: 25 });
            const mains = cl.clauses.map(c => c.mainClause);
            expect(new Set(mains).size).toBe(mains.length);
            cl.clauses.forEach(c => expect(c.subClauses.length).toBeGreaterThan(0));
        });

        it('leaves an initial audit at full coverage even with a budget passed', () => {
            const stdClauses = Array.from({ length: 40 }, (_, i) => ({ clause: `8.${i + 1}`, title: 'Requirement ' + i }));
            const cl = B.buildClientChecklist(client, docs, { auditType: 'initial', standardClauses: stdClauses, maxItems: 25 });
            expect(cl.itemCount).toBeGreaterThan(25);
        });
    });

    describe('trimToBudget', () => {
        const section = (main, n) => ({
            mainClause: main, title: main,
            subClauses: Array.from({ length: n }, (_, i) => ({ clause: main, requirement: `${main} q${i}`, items: [{}] }))
        });

        it('returns the checklist untouched when it already fits', () => {
            const clauses = [section('8', 3)];
            expect(B.trimToBudget(clauses, 10)[0].subClauses).toHaveLength(3);
        });

        it('does nothing without a budget', () => {
            const clauses = [section('8', 30)];
            expect(B.trimToBudget(clauses, null)[0].subClauses).toHaveLength(30);
        });

        it('cuts the lowest-priority clause first', () => {
            const clauses = [section('8', 10), section('4', 10)];
            const out = B.trimToBudget(clauses, 12);
            expect(out.find(c => c.mainClause === '8').subClauses.length)
                .toBeGreaterThan(out.find(c => c.mainClause === '4').subClauses.length);
        });

        it('drops empty sections rather than leaving them behind', () => {
            const clauses = [section('FOCUS', 2), section('4', 5)];
            const out = B.trimToBudget(clauses, 3);
            expect(out.every(c => c.subClauses.length > 0)).toBe(true);
        });
    });

    describe('normalizeAuditType', () => {
        it('recognises surveillance in any wording', () => {
            ['surveillance', 'Surveillance 1', 'SURV-2', 'annual surveillance audit'].forEach(v =>
                expect(B.normalizeAuditType(v)).toBe('surveillance'));
        });

        it('recognises recertification and renewal', () => {
            expect(B.normalizeAuditType('Recertification')).toBe('recertification');
            expect(B.normalizeAuditType('renewal audit')).toBe('recertification');
        });

        it('falls back to initial for anything else', () => {
            ['Initial', 'Stage 2', '', null, undefined, 'certification'].forEach(v =>
                expect(B.normalizeAuditType(v)).toBe('initial'));
        });
    });

    describe('coverageGaps', () => {
        it('names the Annex SL clauses with no supporting document', () => {
            const gaps = B.coverageGaps([{ linkedClauses: '4.1, 5.2' }, { linkedClauses: '8.4' }]);
            expect(gaps).toEqual(['6', '7', '9', '10']);
        });

        it('reports every clause as a gap when nothing is on file', () => {
            expect(B.coverageGaps([])).toHaveLength(7);
        });
    });
});

// Annex A control references.
//
// A Statement of Applicability is the document that decides which ISO/IEC 27001
// controls apply, and cycle coverage is measured against it. The extractor
// recognised body clauses 4-10 only, so an uploaded SoA yielded no control
// references at all — and, because "A.5.1" contains "5.1", it silently produced
// a BODY clause the document does not cover.
describe('ClientDocsBulk.findClauseRefs — Annex A control references', () => {
    it('reads an Annex A control reference', () => {
        expect(B.findClauseRefs('A.5.1')).toEqual(['A.5.1']);
        expect(B.findClauseRefs('A.8.13')).toEqual(['A.8.13']);
    });

    it('does not emit a body clause from inside a control reference', () => {
        expect(B.findClauseRefs('A.5.1')).not.toContain('5.1');
        expect(B.findClauseRefs('A.8.13')).not.toContain('8.13');
    });

    it('still reads ordinary body clauses, alongside controls', () => {
        expect(B.findClauseRefs('clause 8.5.2')).toEqual(['8.5.2']);
        expect(B.findClauseRefs('8.4 and A.5.9')).toEqual(['8.4', 'A.5.9']);
    });

    it('ignores a revision number that merely looks like a clause', () => {
        expect(B.findClauseRefs('Rev 1.2')).toEqual([]);
    });
});

describe('ClientDocsBulk.parseContentMeta — a Statement of Applicability', () => {
    // 93 controls is the real size of ISO/IEC 27001:2022 Annex A. The heading
    // cap is 30, which is right for title inference and was throwing away two
    // thirds of the applicable set when it also bounded the reference list.
    function soaText(rows) {
        return ['Statement of Applicability', 'Rev 4.0', '']
            .concat(rows).join('\n');
    }

    it('captures every control row, past the heading cap', () => {
        const rows = [];
        for (let i = 1; i <= 37; i++) rows.push(`A.5.${i} Organizational control number ${i}`);
        for (let i = 1; i <= 34; i++) rows.push(`A.8.${i} Technological control number ${i}`);
        const parsed = B.parseContentMeta(soaText(rows));
        expect(parsed.clauseRefs).toContain('A.5.1');
        expect(parsed.clauseRefs).toContain('A.5.35');
        expect(parsed.clauseRefs).toContain('A.8.13');
        expect(parsed.clauseRefs).toContain('A.8.34');
        expect(parsed.clauseRefs.length).toBe(71);
        // Headings stay capped — they only feed title inference.
        expect(parsed.headings.length).toBe(30);
    });

    it('does not map an SoA onto body clauses it never covers', () => {
        const parsed = B.parseContentMeta(soaText([
            'A.5.1 Policies for information security',
            'A.8.13 Information backup'
        ]));
        expect(parsed.clauseRefs).toEqual(['A.5.1', 'A.8.13']);
    });
});
