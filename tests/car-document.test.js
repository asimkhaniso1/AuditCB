// Corrective Action Request per register NC (PC Connection, 2026-11-19). The
// only CAR was an opt-in annex inside the full report, headed "AUDIT360",
// numbered CAR-01 per report and matched to the register by clause. It is now
// its own document per NCR — PDF to send, Word for the client to fill in —
// in the CB's name, with the NCR number the client quotes back.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.window = globalThis.window || globalThis;

const DF = require('../doc-format.js');
const PS = require('../print-shell.js');

const UTILS = {
    escapeHtml: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    formatDate: d => String(d),
    getPlanRef: p => 'AP-' + p.id
};

function seedState(ncrExtra) {
    const ncr = Object.assign({
        id: 85, auditId: 'p1', clientId: 'c1', clientName: 'PC CONNECTION, INC.', clause: '7.5', severity: 'minor',
        status: 'Open', description: 'Document change request section missing in the procedures.',
        raisedBy: 'Cara Auditor', raisedDate: '2026-11-17', dueDate: '2027-02-15',
        sourceChecklistId: 'cl1', sourceItemIdx: '7-0'
    }, ncrExtra);
    window.state = {
        cbSettings: { cbName: 'Company Certification International', cbEmail: 'capa@cci.example', accreditationBody: 'IAS', accreditationNumber: 'MSCB-123', logoUrl: 'data:image/png;base64,AAAA' },
        clients: [{ id: 'c1', name: 'PC CONNECTION, INC.', standard: 'ISO 27001' }],
        auditPlans: [{ id: 'p1', standard: 'ISO 9001:2015, ISO/IEC 27001:2022', auditType: 'Recertification', date: '2026-11-17', endDate: '2026-11-19', lead: 'Cara Auditor' }],
        auditReports: [{ id: 'r1', planId: 'p1', checklistProgress: [
            { checklistId: 'cl1', itemIdx: '7-0', status: 'nc', comment: 'Procedure QP-07 Rev 3 has no change request section; three changes in 2026 had no request record.' }
        ] }],
        checklists: [{ id: 'cl1', clauses: [{ mainClause: '7', subClauses: [{ clause: '7.5', requirement: 'Changes to documented information shall be controlled.' }] }] }],
        ncrs: [ncr]
    };
    return ncr;
}

function load() {
    window.UTILS = UTILS;
    window.Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    window.showNotification = vi.fn();
    window.DocFormat = DF;
    window.PrintShell = PS;
    window.NCRModule = {};
    window.state = window.state || { ncrs: [] };
    loadScript('./ncr-capa-module.js', { params: { module: undefined } });
    loadScript('./car-document.js', { params: { module: undefined } });
    return window.CarDocument;
}

/** Entries of a STORE-only zip: { name: Uint8Array }, checking each CRC. */
function unzip(bytes, CD) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = {};
    let p = 0;
    while (dv.getUint32(p, true) === 0x04034b50) {
        const crc = dv.getUint32(p + 14, true);
        const size = dv.getUint32(p + 18, true);
        const nameLen = dv.getUint16(p + 26, true);
        const name = new TextDecoder().decode(bytes.slice(p + 30, p + 30 + nameLen));
        const data = bytes.slice(p + 30 + nameLen, p + 30 + nameLen + size);
        expect(CD.crc32(data)).toBe(crc);
        out[name] = data;
        p += 30 + nameLen + size;
    }
    return out;
}

describe('CarDocument', () => {
    let CD;
    beforeEach(() => { CD = load(); });

    it('crc32 matches the standard check value', () => {
        expect(CD.crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
    });

    it('resolves the CAR from the register record, its plan, client and checklist answer', () => {
        const c = CD.context(seedState());
        expect(c).toMatchObject({
            ref: 'NCR-085', grade: 'Minor', clientName: 'PC CONNECTION, INC.',
            standard: 'ISO 9001:2015, ISO/IEC 27001:2022', criterion: '7.5',
            requirement: 'Changes to documented information shall be controlled.',
            statement: 'Document change request section missing in the procedures.',
            evidence: 'Procedure QP-07 Rev 3 has no change request section; three changes in 2026 had no request record.',
            auditType: 'Recertification', auditRef: 'AP-p1', responseDue: '2027-02-15'
        });
        expect(c.brand).toMatchObject({ name: 'Company Certification International', email: 'capa@cci.example', accreditation: 'IAS · MSCB-123' });
    });

    it('prints the audit\'s findings response date as Response due, and the CAPA deadline apart from it', () => {
        const ncr = seedState({ dueDate: '2027-02-15' });
        window.state.auditReports[0].findingsResponseDue = '2026-12-11';
        const c = CD.context(ncr);
        expect(c.responseDue).toBe('2026-12-11');
        expect(c.actionDue).toBe('2027-02-15');
        const text = DF.renderedText(CD.buildHtml(c));
        expect(text).toMatch(/Response due\s*11 December 2026/);
        expect(text).toContain('Corrective action due');
        expect(text).toContain('by 11 December 2026, with the correction taken and your corrective action plan');
        expect(text).toContain('implemented by 15 February 2027');
        expect(PS.lint(CD.buildHtml(c))).toEqual([]);
        const files = unzip(CD.buildDocx(c), CD);
        const xml = new TextDecoder().decode(files['word/document.xml']);
        expect(xml).toContain('11 December 2026');
        expect(xml).toContain('Corrective action due');
    });

    it('falls back to the NCR due date, with no second deadline, when the audit has no response date', () => {
        const c = CD.context(seedState({ dueDate: '2027-02-15' }));
        expect(c.responseDue).toBe('2027-02-15');
        expect(c.actionDue).toBe('');
        expect(DF.renderedText(CD.buildHtml(c))).not.toContain('Corrective action due');
    });

    it('never prints an internal FOCUS/SURV reference as the clause', () => {
        const c = CD.context(seedState({ clause: 'FOCUS.3', criterionRef: null }));
        expect(c.criterion).toBe('');
    });

    it('builds a branded, lint-clean PDF document with all three parts', () => {
        const html = CD.buildHtml(CD.context(seedState()));
        expect(PS.lint(html)).toEqual([]);
        const text = DF.renderedText(html);
        expect(text).toContain('Company Certification International');
        expect(text).toContain('Corrective Action Request');
        expect(text).toContain('NCR-085');
        expect(text).toContain('PART A — NONCONFORMITY');
        expect(text).toContain('PART B — ORGANISATION’S RESPONSE');
        expect(text).toContain('PART C — REVIEW');
        expect(text).toContain('return this form to capa@cci.example by 15 February 2027');
        expect(text).not.toMatch(/AUDIT360/i);
        expect(html).toContain('<title>CAR NCR-085 - PC CONNECTION, INC</title>');
    });

    it('escapes stored text exactly once', () => {
        const html = CD.buildHtml(CD.context(seedState({ description: 'Uses <script>alert(1)</script> &amp; more' })));
        expect(html).not.toContain('<script>alert');
        expect(DF.renderedText(html)).toContain('Uses <script>alert(1)</script> & more');
    });

    it('prefills Part B from the record and leaves boxes to write in otherwise', () => {
        const blank = CD.buildHtml(CD.context(seedState()));
        expect((blank.match(/class="fill"/g) || []).length).toBeGreaterThanOrEqual(3);
        const filled = CD.buildHtml(CD.context(seedState({ correction: 'Change request section added to QP-07', rootCause: 'Template lacked the section', correctiveAction: 'All procedures reviewed against the template' })));
        expect(DF.renderedText(filled)).toContain('Change request section added to QP-07');
    });

    it('writes a valid .docx: the parts Word needs, well-formed XML, the CAR content', () => {
        const c = CD.context(seedState({ description: 'A & B <c>' }));
        const files = unzip(CD.buildDocx(c), CD);
        expect(Object.keys(files)).toEqual(expect.arrayContaining([
            '[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/_rels/document.xml.rels'
        ]));
        for (const name of Object.keys(files)) {
            if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
            const doc = new DOMParser().parseFromString(new TextDecoder().decode(files[name]), 'application/xml');
            expect(doc.getElementsByTagName('parsererror').length, name).toBe(0);
        }
        const xml = new TextDecoder().decode(files['word/document.xml']);
        expect(xml).toContain('NCR-085');
        expect(xml).toContain('A &amp; B &lt;c&gt;');
        expect(xml).toContain('Company Certification International');
        expect(xml).not.toContain('rIdLogo');
    });

    it('embeds the logo in the .docx when one is given', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        const files = unzip(CD.buildDocx(CD.context(seedState()), { bytes: png, ext: 'png', width: 400, height: 100 }), CD);
        expect(files['word/media/logo.png']).toEqual(png);
        expect(new TextDecoder().decode(files['word/document.xml'])).toContain('r:embed="rIdLogo"');
        expect(new TextDecoder().decode(files['[Content_Types].xml'])).toContain('Extension="png"');
    });

    it('names the file after the NCR and the client', () => {
        expect(CD.fileName(CD.context(seedState()), 'docx')).toBe('CAR NCR-085 - PC CONNECTION, INC.docx');
    });

    it('printCAR opens the preview window', () => {
        seedState();
        const doc = { write: vi.fn(), close: vi.fn(), open: vi.fn(), images: [], querySelector: () => null };
        window.open = vi.fn(() => ({ document: doc, addEventListener: vi.fn() }));
        window.printCAR('85');
        expect(doc.write.mock.calls[0][0]).toContain('NCR-085');
    });
});

describe('CAR buttons and the auditee response upload', () => {
    beforeEach(() => {
        load();
        document.body.innerHTML = '<h3 id="modal-title"></h3><div id="modal-body"></div><button id="modal-save"></button>';
        window.closeModal = vi.fn();
        window.openModal = vi.fn();
        window.saveData = vi.fn();
    });

    it('offers the CAR for Major/Minor only', () => {
        const NM = window.NCRModule;
        expect(NM.carButtonsHTML({ id: 1, severity: 'Major' }, 'icon')).toContain('data-action="printCAR"');
        expect(NM.carButtonsHTML({ id: 1, severity: 'Minor' }, 'full')).toContain('data-action="downloadCARWord"');
        expect(NM.carButtonsHTML({ id: 1, severity: 'Observation' }, 'icon')).toBe('');
        expect(NM.carButtonsHTML({ severity: 'Major' }, 'icon')).toBe('');
    });

    it('accepts PDF, Word, Excel and images up to 10 MB', () => {
        const NM = window.NCRModule;
        expect(NM.checkResponseFiles([{ name: 'CAR NCR-085.docx', size: 1000 }, { name: 'evidence.JPG', size: 5e6 }])).toBe('');
        expect(NM.checkResponseFiles([{ name: 'run.exe', size: 10 }])).toMatch(/only PDF, Word, Excel/);
        expect(NM.checkResponseFiles([{ name: 'big.pdf', size: 11 * 1024 * 1024 }])).toMatch(/larger than 10 MB/);
    });

    it('uploads the returned CAR to the private bucket under the client and NCR, and lists it on the record', async () => {
        const upload = vi.fn(async (path) => ({ data: { path }, error: null }));
        const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
        window.SupabaseClient = {
            isInitialized: true,
            client: { storage: { from: vi.fn(() => ({ upload })) } },
            from: vi.fn(() => ({ update, select: () => ({ order: async () => ({ data: null, error: null }) }) }))
        };
        const ncr = seedState({ severity: 'Minor' });
        window.state.currentUser = { name: 'Cara Auditor' };
        window.reviewPreviousNCR(85);
        expect(document.getElementById('modal-body').innerHTML).toContain('data-action="printCAR"');

        const file = new File(['%PDF-1.4'], 'CAR NCR-085 filled.pdf', { type: 'application/pdf' });
        Object.defineProperty(document.getElementById('prev-review-files'), 'files', { value: [file] });
        document.getElementById('prev-review-correction').value = 'Section added to QP-07';
        document.getElementById('prev-review-action').value = 'All procedures checked against the template';
        document.querySelector('input[value="open"]').checked = true;
        await document.getElementById('modal-save').onclick();

        expect(window.SupabaseClient.client.storage.from).toHaveBeenCalledWith('documents');
        expect(upload.mock.calls[0][0]).toMatch(/^ncr-responses\/c1\/85\/\d+_CAR_NCR-085_filled\.pdf$/);
        expect(ncr.auditeeResponseFiles).toHaveLength(1);
        expect(ncr.auditeeResponseFiles[0]).toMatchObject({ name: 'CAR NCR-085 filled.pdf', uploadedBy: 'Cara Auditor', type: 'application/pdf' });
        expect(update.mock.calls[0][0].auditee_response_files).toEqual(ncr.auditeeResponseFiles);
        expect(window.closeModal).toHaveBeenCalled();
    });

    it('uploads nothing when the review itself cannot be saved', async () => {
        const upload = vi.fn();
        window.SupabaseClient = { isInitialized: true, client: { storage: { from: () => ({ upload }) } } };
        seedState({ severity: 'Minor' });
        window.reviewPreviousNCR(85);
        Object.defineProperty(document.getElementById('prev-review-files'), 'files', { value: [new File(['x'], 'a.pdf')] });
        document.querySelector('input[value="closed"]').checked = true; // no corrective action, no evidence
        await document.getElementById('modal-save').onclick();
        expect(upload).not.toHaveBeenCalled();
        expect(document.getElementById('prev-review-error').textContent).toMatch(/corrective action/);
    });

    it('does not send the new column for records without response files', async () => {
        const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
        window.SupabaseClient = { from: vi.fn(() => ({ update, select: () => ({ order: async () => ({ data: null, error: null }) }) })) };
        seedState({ severity: 'Minor' });
        window.reviewPreviousNCR(85);
        document.querySelector('input[value="open"]').checked = true;
        await document.getElementById('modal-save').onclick();
        expect(update.mock.calls[0][0]).not.toHaveProperty('auditee_response_files');
    });

    it('lists the files on file in NCR Details with signed-URL links', () => {
        seedState({ auditeeResponseFiles: [{ name: 'CAR NCR-085 filled.pdf', path: 'ncr-responses/c1/85/1_x.pdf', uploadedBy: 'Cara Auditor', uploadedAt: '2026-11-19' }] });
        window.viewNCRDetails(85);
        const link = document.querySelector('#modal-body [data-action="openStoredDocument"]');
        expect(link.getAttribute('data-arg1')).toBe('ncr-responses/c1/85/1_x.pdf');
        expect(link.textContent).toContain('CAR NCR-085 filled.pdf');
    });
});
