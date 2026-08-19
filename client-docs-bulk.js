/**
 * client-docs-bulk.js — Bulk intake and auto-mapping of client-supplied documents.
 *
 * Clients send their whole management system in one go: a ZIP or a folder of
 * "Section 8 - Operations.docx" style files plus a FORMS sub-folder of blank
 * formats. This module takes that dump and, for every file, derives the section
 * reference, document number, revision, issue date and category from the file
 * name and — where the text can be read — from the document's own header block.
 * Each document is mapped to the ISO clauses it supports, the auditor reviews and
 * corrects the mapping in one table, and the accepted set is written to
 * client.documents. That mapped set then drives a surveillance checklist whose
 * items cite the client's own documents.
 */
(function () {
    'use strict';

    // ── Reference data ────────────────────────────────────────────────

    // Annex SL high-level structure — client "Section N" files almost always
    // follow this numbering, which is why a bare section number is mappable.
    const ANNEX_SL = {
        '4': 'Context of the Organization',
        '5': 'Leadership',
        '6': 'Planning',
        '7': 'Support',
        '8': 'Operation',
        '9': 'Performance Evaluation',
        '10': 'Improvement'
    };

    const CATEGORIES = [
        'System Manual', 'Quality Procedures', 'Work Instructions', 'Policy Document',
        'Records / Forms Register', 'Org Chart', 'Process Map', 'Risk Register',
        'Compliance Matrix', 'Contract / Agreement', 'Certificate',
        'Corrective Action Plan', 'Other'
    ];

    // Ordered: first match wins, so the most specific patterns come first.
    // Plurals are spelled out rather than left to a trailing \b, which would
    // otherwise refuse to match "Certificates" or "Procedures".
    const CATEGORY_RULES = [
        { re: /\b(org(?:ani[sz]ation(?:al)?)?[\s-]*charts?|organogram|organi[sz]ation structure)\b/i, category: 'Org Chart' },
        { re: /\b(process maps?|process interaction|turtle|sipoc|flow ?charts?)\b/i, category: 'Process Map' },
        { re: /\b(risk (register|assessment|matrix)|fmea|hira|aspects? (and|&) impacts?)\b/i, category: 'Risk Register' },
        { re: /\b(compliance matrix|legal register|obligations? register|correlation matrix|cross[\s-]?reference matrix)\b/i, category: 'Compliance Matrix' },
        { re: /\b(contracts?|agreements?|nda|mou|terms (and|&) conditions)\b/i, category: 'Contract / Agreement' },
        { re: /\b(certificates?|accreditation)\b/i, category: 'Certificate' },
        { re: /\b(corrective action (plan|report)|capa|8d|root cause (analysis|report))\b/i, category: 'Corrective Action Plan' },
        { re: /\b(forms?(?!al|er)|formats?|templates?|checklists?|registers?|logs?|record sheet|f-\d)/i, category: 'Records / Forms Register' },
        { re: /\b(work instructions?|wi|operating instructions?)\b/i, category: 'Work Instructions' },
        { re: /\b(manuals?|handbooks?)\b/i, category: 'System Manual' },
        { re: /\b(procedures?|sop|qsp|qp)\b/i, category: 'Quality Procedures' },
        { re: /\b(polic(y|ies))\b/i, category: 'Policy Document' }
    ];

    // Title keyword → ISO clause(s). Every match contributes, so a "Counterfeit
    // Parts Prevention and Traceability" file lands on both 8.4 and 8.5.
    // These are word stems, so there is no trailing \b — "traceab" has to be
    // allowed to match "traceability".
    const CLAUSE_KEYWORDS = [
        { re: /\b(context|interested part|stakeholder|internal and external issue|company (profile|overview)|organi[sz]ation profile)/i, clauses: ['4.1', '4.2'] },
        { re: /\b(scope of the|scope statement|(qms|ems|osh|isms) scope|boundaries and applicability)/i, clauses: ['4.3'] },
        { re: /\b(process (map|interaction|approach)|turtle|sipoc|(management|quality) system documentation)/i, clauses: ['4.4'] },
        { re: /\b(leadership|customer focus|commitment)/i, clauses: ['5.1'] },
        { re: /\b(polic(y|ies))/i, clauses: ['5.2'] },
        { re: /\b(org(?:ani[sz]ation(?:al)?)?[\s-]*chart|organogram|roles|responsibilit|authorit|job description)/i, clauses: ['5.3'] },
        { re: /\b(risk|opportunit|fmea|swot|hira|aspect)/i, clauses: ['6.1'] },
        { re: /\b(objective|\bkpi\b|target|improvement programme|improvement program)/i, clauses: ['6.2'] },
        { re: /\b(change (management|control)|management of change|\bmoc\b)/i, clauses: ['6.3'] },
        { re: /\b(resource|infrastructure|facilit|maintenance|work environment|housekeeping)/i, clauses: ['7.1'] },
        { re: /\b(calibrat|measuring (and monitoring )?equipment|\bmsa\b|gauge|instrument control)/i, clauses: ['7.1.5'] },
        { re: /\b(competenc|training|skills? matrix|induction|qualification|certification of (operator|personnel))/i, clauses: ['7.2'] },
        { re: /\b(awareness)/i, clauses: ['7.3'] },
        { re: /\b(communicat)/i, clauses: ['7.4'] },
        { re: /\b(document(ed|ation)?[\s-]*(control|information)|documentation|control of (document|record)|record (control|retention)|master list)/i, clauses: ['7.5'] },
        { re: /\b(operation(al)?[\s-]*(planning|control)|production (control|planning)|manufactur|process control|work order|routing|assembly)/i, clauses: ['8.1'] },
        { re: /\b(customer (requirement|communication|order|contract|enquiry)|contract review|tender|quotation|order review)/i, clauses: ['8.2'] },
        { re: /\b(design(?!ation)|development)/i, clauses: ['8.3'] },
        { re: /\b(purchas|procure|supplier|vendor|subcontract|external(ly)?[\s-]*provid|outsourc|counterfeit|incoming (inspection|material))/i, clauses: ['8.4'] },
        { re: /\b(production and service provision|traceab|preservation|packag|handling|storage|customer propert|post[\s-]?delivery|warehous|shipping|\besd\b)/i, clauses: ['8.5'] },
        { re: /\b(release of (product|service)|final inspection|in[\s-]?process inspection|first article|\bfai\b|acceptance criteria|workmanship)/i, clauses: ['8.6'] },
        { re: /\b(nonconforming (output|product|material)|rework|repair|scrap|quarantine|\bmrb\b|concession|deviation)/i, clauses: ['8.7'] },
        { re: /\b(monitoring and measurement|analysis and evaluation|statistic|\bspc\b|performance evaluation|data analysis)/i, clauses: ['9.1'] },
        { re: /\b(customer satisfaction|complaint|feedback survey)/i, clauses: ['9.1.2'] },
        { re: /\b(internal audit)/i, clauses: ['9.2'] },
        { re: /\b(management review|\bmrm\b)/i, clauses: ['9.3'] },
        { re: /\b(improvement|continual|kaizen)/i, clauses: ['10.1', '10.3'] },
        { re: /\b(nonconformity and corrective|corrective action|\bcapa\b|\bcar\b|root cause)/i, clauses: ['10.2'] },
        { re: /\b(emergency|preparedness and response|incident|accident)/i, clauses: ['8.2'] },
        { re: /\b(legal|compliance obligation|export[\s-]?(control|compliance)|trade compliance|dual[\s-]?use|\bitar\b|\bear\b|regulator|statutory|sanction)/i, clauses: ['4.2', '6.1'] }
    ];

    // ISO/IEC 17021-1 §9.6.2.1.2 — the elements every surveillance audit must cover.
    const SURVEILLANCE_MANDATORY = [
        ['a', 'Internal audit & management review', 'Internal audits and management review — confirm both were completed since the last audit, covered the full certified scope, and that outputs were actioned.'],
        ['b', 'Actions on previous nonconformities', 'Review of actions taken on nonconformities identified during the previous audit — verify correction, root cause analysis, corrective action and verification of effectiveness.'],
        ['c', 'Treatment of complaints', 'Treatment of complaints — verify complaints received since the last audit are recorded, investigated, resolved and analysed for trends.'],
        ['d', 'Effectiveness against objectives', 'Effectiveness of the management system with regard to achieving the certified client\'s objectives and the intended results of the management system.'],
        ['e', 'Continual improvement progress', 'Progress of planned activities aimed at continual improvement.'],
        ['f', 'Continuing operational control', 'Continuing operational control — verify the controls over the certified activities remain in place and effective.'],
        ['g', 'Review of changes', 'Review of any changes — organisation, legal status, scope, sites, personnel, processes, products or the management system itself.'],
        ['h', 'Use of marks and certification claims', 'Use of marks and/or any other reference to certification — verify correct use on documents, website, marketing material and product.']
    ];

    const MONTHS = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7,
        aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
    };

    const READABLE_EXT = ['docx', 'doc', 'pdf', 'xlsx', 'xls', 'xlsm', 'csv', 'txt', 'md', 'rtf', 'pptx', 'ppt', 'odt', 'png', 'jpg', 'jpeg'];
    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    const NOTE_LIMIT = 700;
    const MAX_HEADINGS = 30;

    // ── Pure parsing helpers ──────────────────────────────────────────

    function pad2(n) { return String(n).padStart(2, '0'); }

    function toIso(y, m, d) {
        if (!y || !m || !d) return '';
        if (y < 100) y += 2000;
        if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return '';
        return `${y}-${pad2(m)}-${pad2(d)}`;
    }

    function monthNum(word) {
        const w = String(word || '').toLowerCase();
        return MONTHS[w.slice(0, 4)] || MONTHS[w.slice(0, 3)] || 0;
    }

    /**
     * Find the first plausible date in a string and return it as YYYY-MM-DD.
     * Handles 2024-05-12, 12/05/2024, 13-Aug-26 and "August 2026".
     */
    function findDate(str) {
        if (!str) return '';
        let m;

        // 2024-05-12 / 2024_05_12 / 2024.05.12
        m = str.match(/\b(20\d{2})[-_./](0?[1-9]|1[0-2])[-_./](0?[1-9]|[12]\d|3[01])\b/);
        if (m) return toIso(+m[1], +m[2], +m[3]);

        // 13-Aug-26 / 13 August 2026
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])[-_.\s]([A-Za-z]{3,9})[-_.\s'’]*(\d{2,4})\b/);
        if (m && monthNum(m[2])) {
            const iso = toIso(+m[3], monthNum(m[2]), +m[1]);
            if (iso) return iso;
        }

        // 12/05/2024 — day first, the convention this product's clients use.
        // Slash/dash only: dotted forms collide with clause numbers like 7.5.12.
        m = str.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);
        if (m) return toIso(+m[3], +m[2], +m[1]);

        // August 2026 → first of month
        m = str.match(/\b([A-Za-z]{3,9})[-_.\s](20\d{2})\b/);
        if (m && monthNum(m[1])) return toIso(+m[2], monthNum(m[1]), 1);

        return '';
    }

    // "Rev"/"v" must not be followed by another letter — that is what keeps
    // "Review" and "Vendor" from being read as revision markers, while still
    // allowing "v2.1" where the digit follows immediately.
    const REV_KEYWORD = '(?:rev(?:ision)?|iss(?:ue)?|ver(?:sion)?|v)(?![a-z])\\.?\\s*(?:no\\.?|#)?\\s*:?\\s*';
    const REV_NUMERIC = new RegExp('\\b' + REV_KEYWORD + '(\\d{1,2}(?:\\.\\d{1,3})?)\\b', 'i');
    const REV_LETTER = new RegExp('\\b' + REV_KEYWORD + '([A-Za-z])(?![A-Za-z])', 'i');

    /** Pull a revision marker ("Rev 3", "Issue B", "v2.1") out of a string. */
    function findRevision(str) {
        if (!str) return '';
        let m = str.match(REV_NUMERIC);
        if (m) return 'Rev ' + m[1];
        // Letter revisions are conventionally uppercase; a lowercase hit is a word.
        m = str.match(REV_LETTER);
        if (m && /[A-Z]/.test(m[1])) return 'Rev ' + m[1];
        return '';
    }

    /** A leading document code such as "QSP-7.5" or "F-QP-01-01". */
    function findDocNumber(base) {
        const m = base.match(/^\s*([A-Z][A-Z0-9]{0,5}(?:[-/.][A-Z0-9]{1,6}){1,3})(?=[\s_–—-]|$)/);
        if (m && /\d/.test(m[1])) return m[1];
        return '';
    }

    /** Sub-clause references written straight into the text, e.g. "8.4.1". */
    function findClauseRefs(str) {
        if (!str) return [];
        const out = [];
        const re = /\b(4|5|6|7|8|9|10)\.(\d{1,2})(?:\.(\d{1,2}))?\b/g;
        let m;
        while ((m = re.exec(str)) !== null) {
            out.push(m[3] ? `${m[1]}.${m[2]}.${m[3]}` : `${m[1]}.${m[2]}`);
        }
        return out;
    }

    function inferCategory(haystack, isInFormsFolder) {
        if (isInFormsFolder) return 'Records / Forms Register';
        for (const rule of CATEGORY_RULES) {
            if (rule.re.test(haystack)) return rule.category;
        }
        return '';
    }

    /**
     * Derive everything knowable from a file's name and its path inside the drop.
     * @param {string} fileName - e.g. "Section 8a - IPC WHMA-A-620 Class 3 Procedure.docx"
     * @param {string} [relPath] - path within the ZIP/folder, e.g. "FORMS/F-QP-01 Training Record.docx"
     * @returns {Object} parsed metadata
     */
    function parseDocumentName(fileName, relPath) {
        // Accept a bare name or a full path in either separator style.
        const name = String(fileName || '').trim().split(/[\\/]/).pop();
        const path = String(relPath || '').replace(/\\/g, '/');
        const dotIdx = name.lastIndexOf('.');
        const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : '';
        let base = (dotIdx > 0 ? name.slice(0, dotIdx) : name).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

        const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const isInFormsFolder = /(^|\/)(forms?|formats?|records?|templates?)(\/|$)/i.test(folder);

        // Section / part prefix — strip it off the title once captured.
        let sectionRef = '';
        const secMatch = base.match(/^(?:section|sect?\.|part|chapter|chap\.?|clause|annex)\s*([0-9]{1,2}[A-Za-z]?(?:\.[0-9]{1,2})*)\b\s*[-–—:.)]*\s*/i);
        if (secMatch) {
            sectionRef = secMatch[1];
            base = base.slice(secMatch[0].length).trim();
        }

        const docNumber = findDocNumber(base);
        if (docNumber) base = base.slice(base.indexOf(docNumber) + docNumber.length).replace(/^[\s_–—:.-]+/, '');

        const revision = findRevision(name);
        const dateFromName = findDate(name);

        // Strip the revision and date tokens out of the title text.
        let title = base
            .replace(new RegExp('\\b' + REV_KEYWORD + '(?:\\d{1,2}(?:\\.\\d{1,3})?|[A-Z](?![A-Za-z]))', 'gi'), ' ')
            .replace(/\b20\d{2}[-_./]\d{1,2}[-_./]\d{1,2}\b/g, ' ')
            .replace(/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/g, ' ')
            .replace(/\b\d{1,2}[-_.\s][A-Za-z]{3,9}[-_.\s'’]*\d{2,4}\b/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[\s_–—:.,-]+|[\s_–—:.,-]+$/g, '')
            .trim();

        // Windows / re-save copies: "Improvement1", "Report (2)", "Manual - Copy".
        let copyIndex = 0;
        let cm = title.match(/^(.*?)\s*\((\d{1,2})\)$/);
        if (cm) { title = cm[1].trim(); copyIndex = +cm[2]; }
        cm = title.match(/^(.*?)[\s-]*copy(?:\s*\(\d+\))?$/i);
        if (cm && cm[1].trim()) { title = cm[1].trim(); copyIndex = copyIndex || 1; }
        cm = title.match(/^(.*[A-Za-z]{3,})(\d{1,2})$/);
        if (cm) { title = cm[1].trim(); copyIndex = copyIndex || +cm[2]; }

        if (!title) title = (dotIdx > 0 ? name.slice(0, dotIdx) : name).trim();

        const haystack = `${title} ${folder} ${docNumber}`;
        let category = inferCategory(haystack, isInFormsFolder);
        // A bare "Section N" file with no other signal is a manual section.
        if (!category) category = sectionRef ? 'System Manual' : 'Other';

        const isForm = category === 'Records / Forms Register';

        return {
            fileName: name,
            path: path || name,
            folder,
            ext,
            title,
            sectionRef,
            docNumber,
            revision,
            date: dateFromName,
            category,
            isForm,
            copyIndex,
            readable: READABLE_EXT.includes(ext)
        };
    }

    /**
     * Read the document's own header block and heading tree. Anything found here
     * outranks the file name — a title page is more authoritative than a filename.
     * @param {string} text - extracted plain text
     */
    function parseContentMeta(text) {
        const out = { title: '', docNumber: '', revision: '', date: '', headings: [], clauseRefs: [] };
        if (!text) return out;

        const head = text.slice(0, 2500);

        let m = head.match(/\b(?:doc(?:ument)?\s*(?:no|number|id|ref|code)|dcn|ref(?:erence)?\s*no)\b\s*[:.#-]*\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,24})/i);
        if (m) out.docNumber = m[1].replace(/[.\-_]+$/, '');

        out.revision = findRevision(head);

        m = head.match(/\b(?:issue|effective|revision|approval|approved|release|prepared)\s*(?:date)?\s*[:.-]\s*([^\n\r|]{4,30})/i);
        if (m) out.date = findDate(m[1]);
        if (!out.date) out.date = findDate(head);

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines.slice(0, 12)) {
            if (line.length >= 5 && line.length <= 90 && !/[:|]\s*$/.test(line) && /[A-Za-z]{4}/.test(line) &&
                !/^(doc(ument)?|rev|issue|page|date|prepared|approved|company|confidential)\b/i.test(line)) {
                out.title = line.replace(/\s+/g, ' ');
                break;
            }
        }

        // Numbered headings: "8.4 Control of externally provided processes"
        const seen = new Set();
        for (const line of lines) {
            const hm = line.match(/^(\d{1,2}(?:\.\d{1,2}){0,2})[\s.):-]+([A-Za-z][^\n]{3,80})$/);
            if (!hm) continue;
            const key = hm[1] + '|' + hm[2].toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.headings.push({ clause: hm[1], text: hm[2].trim().replace(/\s+/g, ' ') });
            if (out.headings.length >= MAX_HEADINGS) break;
        }
        out.clauseRefs = Array.from(new Set(out.headings.flatMap(h => findClauseRefs(h.clause))));
        return out;
    }

    /** Numeric clause ordering: 8.5 before 8.10, 9 before 10. */
    function compareClause(a, b) {
        const ap = String(a).split('.').map(Number);
        const bp = String(b).split('.').map(Number);
        for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
            if ((ap[i] || 0) !== (bp[i] || 0)) return (ap[i] || 0) - (bp[i] || 0);
        }
        return 0;
    }

    function sortClauses(list) {
        return list.slice().sort(compareClause);
    }

    /**
     * Map a parsed document to the ISO clauses it supports.
     * Explicit clause numbers beat keywords, keywords beat the bare section number.
     * @returns {string[]} sorted, de-duplicated clause references
     */
    function mapClauses(parsed, contentMeta) {
        const found = new Set();
        const title = parsed.title || '';
        const searchText = `${title} ${parsed.folder || ''}`;

        findClauseRefs(title).forEach(c => found.add(c));
        findClauseRefs(parsed.docNumber || '').forEach(c => found.add(c));
        (contentMeta && contentMeta.clauseRefs || []).forEach(c => found.add(c));

        for (const rule of CLAUSE_KEYWORDS) {
            if (rule.re.test(searchText)) rule.clauses.forEach(c => found.add(c));
        }

        // Annex SL section number — only if nothing more specific was found for it.
        const secMain = (parsed.sectionRef || '').match(/^(\d{1,2})/);
        if (secMain && ANNEX_SL[secMain[1]]) {
            const main = secMain[1];
            const hasSub = Array.from(found).some(c => c.split('.')[0] === main);
            if (!hasSub) found.add(main);
        }

        // Drop a bare main clause when a sub-clause of it is already present.
        const all = Array.from(found);
        const filtered = all.filter(c => !(c.indexOf('.') === -1 && all.some(o => o !== c && o.split('.')[0] === c)));
        return sortClauses(filtered);
    }

    /** Stable key for spotting the same document twice. */
    function docKey(parsed) {
        const t = (parsed.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const s = (parsed.sectionRef || '').toLowerCase();
        return s ? `${s}::${t}` : t;
    }

    function clauseTitle(clause) {
        const main = clause.split('.')[0];
        return ANNEX_SL[main] || `Clause ${main}`;
    }

    // Conservative keyword -> clause fallback, engaged only when no numeric
    // clause token was found in the focus text (see deriveCriterionRef below).
    // Only the Annex SL high-level-structure clauses that are common across the
    // 9001-family standards this app audits — kept deliberately short so a false
    // match is unlikely; criterionSource stays 'focus-carryover' either way, so
    // the auditor still confirms via the existing NCR form field before it's
    // treated as authoritative.
    const KEYWORD_CLAUSE_FALLBACK = [
        { re: /internal audit/i, clause: '9.2' },
        { re: /management review/i, clause: '9.3' },
        { re: /documented information|document control/i, clause: '7.5' },
        { re: /competence|training/i, clause: '7.2' },
        { re: /risk(s)?\s*(and|&)?\s*opportunit/i, clause: '6.1' },
        { re: /calibration|monitoring\s*(&|and)?\s*measur(ing|ement)\s*resources/i, clause: '7.1.5' },
        { re: /legal|statutory|regulatory/i, clause: '' }, // too ambiguous — leave empty
        { re: /customer satisfaction/i, clause: '9.1.2' },
        { re: /nonconform|non-conform|corrective action/i, clause: '10.2' }
    ];

    /**
     * True when `standard` is one of the Annex SL / "9001-family" standards
     * that share the clause 4-10 high-level structure (or when no standard is
     * given, in which case there's nothing to contradict). Shared by
     * deriveCriterionRef and by any caller that wants to gate a hardcoded
     * Annex-SL clause fallback (e.g. '4.3') the same way — a standard outside
     * this family should never be handed an invented 4-10 clause number.
     * @param {string} [standard]
     * @returns {boolean}
     */
    function isAnnexSLFamilyStandard(standard) {
        return /\b(9001|14001|45001|22000|27001|13485|20000|37001|50001)\b/.test(String(standard || '')) || !standard;
    }

    /**
     * Recover a real ISO clause reference from Stage 1 focus-point / mandatory
     * surveillance-element text so a FOCUS.n or SURV checklist item — whose own
     * `clause` is an internal pseudo-reference, not a standard clause — can still
     * carry the actual criterion it addresses. Additive/non-breaking: callers get
     * '' when nothing plausible is found and just skip displaying a criterion.
     *
     * @param {string} text
     * @param {string} [standard] - e.g. 'ISO 9001:2015'. Annex SL / "9001-family"
     *   standards share the clause 4-10 main-structure, so for those the first
     *   token has to look like a main clause 4-10 (a bare "12.3" or "2.1" picked
     *   up from a document number or date in the text is rejected). Without a
     *   recognised family the first token found is accepted as-is.
     * @returns {string} the first plausible clause token, or ''.
     */
    function deriveCriterionRef(text, standard) {
        const matches = String(text || '').match(/\b(\d{1,2}(?:\.\d{1,2}){0,2})\b/g) || [];
        const isAnnexSLFamily = isAnnexSLFamilyStandard(standard);
        if (matches.length) {
            for (const token of matches) {
                const main = parseInt(token.split('.')[0], 10);
                if (!isAnnexSLFamily || (main >= 4 && main <= 10)) return token;
            }
        }
        // No numeric clause token found in the text — conservative keyword
        // fallback, Annex-SL family only.
        if (isAnnexSLFamily) {
            const t = String(text || '');
            for (const kw of KEYWORD_CLAUSE_FALLBACK) {
                if (kw.re.test(t)) return kw.clause;
            }
        }
        return '';
    }

    function docRef(doc) {
        const bits = [doc.docNumber, doc.revision].filter(Boolean).join(' ');
        return bits ? `${doc.name} (${bits})` : doc.name;
    }

    /**
     * How many questions a surveillance checklist should hold.
     *
     * A surveillance audit is a sampling exercise, not a re-audit: a half-day
     * visit to a small client is about 25 questions, and a 111-item checklist
     * is unusable on site. Initial and recertification audits return null —
     * they have to cover the standard, so length is not the constraint.
     */
    function checklistBudget(auditType, manDays, profile) {
        if (normalizeAuditType(auditType) !== 'surveillance') return null;
        const md = parseFloat(manDays);
        if (isNaN(md) || md <= 0) {
            const band = (profile && profile.band) || 'unknown';
            return band === 'micro' || band === 'small' ? 25 : 40;
        }
        if (md <= 0.5) return 25;
        if (md <= 1) return 30;
        if (md <= 2) return 45;
        if (md <= 3) return 60;
        return 75;
    }

    // Where the surveillance value is when the checklist has to be cut: the
    // clauses covering what the organisation actually does come before the
    // governance clauses, which the mandatory §9.6.2 block already covers.
    const TRIM_PRIORITY = ['8', '7', '9', '10', '6', '5', '4', 'DOC'];

    /**
     * Cut a checklist down to `budget` questions.
     * FOCUS and SURV are never touched — one is why this audit is happening,
     * the other is required by ISO/IEC 17021-1. ORG keeps a floor so the scope
     * and core processes are always sampled. Everything else gives way,
     * lowest-priority clause first, keeping at least one question per clause
     * so no part of the system disappears from the checklist entirely.
     */
    function trimToBudget(clauses, budget) {
        const count = () => clauses.reduce((t, c) => t + c.subClauses.length, 0);
        if (!budget || count() <= budget) return clauses;

        const protectedSections = ['FOCUS', 'SURV'];
        const ORG_FLOOR = 5;

        const order = clauses
            .map((c, i) => ({ c, i, rank: TRIM_PRIORITY.indexOf(c.mainClause) }))
            .filter(e => !protectedSections.includes(e.c.mainClause))
            .sort((a, b) => (b.rank === -1 ? 99 : b.rank) - (a.rank === -1 ? 99 : a.rank));

        // Pass one: trim each section down to one question, lowest value first.
        for (const entry of order) {
            const floor = entry.c.mainClause === 'ORG' ? ORG_FLOOR : 1;
            while (count() > budget && entry.c.subClauses.length > floor) {
                entry.c.subClauses.pop();
            }
            if (count() <= budget) break;
        }
        // Pass two: if still over, drop the ORG floor too, then whole sections.
        if (count() > budget) {
            for (const entry of order) {
                while (count() > budget && entry.c.subClauses.length > 1) entry.c.subClauses.pop();
                if (count() <= budget) break;
            }
        }
        return clauses.filter(c => c.subClauses.length > 0);
    }

    /** Normalise whatever an audit plan calls its type into our three scopes. */
    function normalizeAuditType(raw) {
        const s = String(raw || '').toLowerCase();
        if (s.includes('surv')) return 'surveillance';
        if (s.includes('recert') || s.includes('renew')) return 'recertification';
        return 'initial';
    }

    /**
     * Items drawn from the organisation itself rather than its documents:
     * the processes it runs, the sites it runs them at, what it sells.
     *
     * @param {Object} client
     * @param {string} auditType
     * @param {string} [standard] - passed through to deriveCriterionRef() so
     *   these ORG items carry a real criterionRef the same way FOCUS/SURV
     *   items do (see buildClientChecklist). Optional/backward-compatible:
     *   callers that omit it just get the un-family-restricted fallback in
     *   deriveCriterionRef, same as passing no standard there directly.
     */
    function orgContextQuestions(client, auditType, standard) {
        const out = [];
        const processes = (client.keyProcesses || []).filter(p => p && (p.name || typeof p === 'string'));
        const sites = (client.sites || []).filter(s => s && s.name);
        const goods = (client.goodsServices || []).filter(g => g && (g.name || typeof g === 'string'));

        // ORG items never had a criterionRef before, which meant every one of
        // them was permanently blocked by the Report Integrity validator (its
        // `clause` is the 'ORG' pseudo-tag, and there was no criterionRef to
        // fall back on). These are unambiguous questions, so most are mapped
        // explicitly below rather than left to the generic keyword guesser;
        // deriveCriterionRef still runs first and only the explicit clause is
        // used as a fallback when it finds nothing better in the text. The
        // hardcoded fallbacks below (4.3 / 8.4 / 8.1) are Annex-SL clause
        // numbers, so — same rule deriveCriterionRef itself already applies —
        // they only apply for standards in that family; a standard outside it
        // gets whatever deriveCriterionRef found in the text, or '' rather
        // than an invented 4-10 clause that may not even exist in it.
        const annexSLFallback = isAnnexSLFamilyStandard(standard);
        if (goods.length) {
            const names = goods.slice(0, 12).map(g => g.name || g).join(', ');
            const text = `Confirm the certified scope still matches what the organisation actually supplies: ${names}. Note any product or service added, withdrawn or changed since the last audit.`;
            const item = question('ORG', 'Certified scope', text);
            // Certified scope confirmation -> 4.3 (scope of the management system).
            item.criterionRef = deriveCriterionRef(text, standard) || (annexSLFallback ? '4.3' : '');
            item.criterionSource = 'org-context';
            out.push(item);
        }

        if (sites.length > 1) {
            sites.slice(0, 10).forEach(s => {
                const text = `Confirm the activities at ${s.name}${s.city ? ', ' + s.city : ''} fall within the certified scope and are covered by the sampling plan for this audit.`;
                const item = question('ORG', s.name, text);
                // Site/activity confirmation -> 4.3. This question asks whether
                // the site's activities fall *within the certified scope*, not
                // how operations at that site are planned and controlled — it's
                // a scope-boundary check, so 4.3 rather than 8.1 (which would fit
                // a question about operational planning/control at the site).
                item.criterionRef = deriveCriterionRef(text, standard) || (annexSLFallback ? '4.3' : '');
                item.criterionSource = 'org-context';
                out.push(item);
            });
        }

        // On surveillance only the core and outsourced processes are sampled;
        // an initial audit has to see the whole set.
        const inScope = auditType === 'surveillance'
            ? processes.filter(p => ['Core', 'Outsourced'].includes(p.category))
            : processes;
        inScope.slice(0, 25).forEach(p => {
            const name = p.name || p;
            const owner = p.owner ? `, owner ${p.owner}` : '';
            const label = p.category ? `${name} (${p.category})` : name;
            if (p.category === 'Outsourced') {
                const text = `${name} is performed by an external provider${owner}. Verify the controls applied to it, the criteria for selecting and monitoring the provider, and that responsibility for conformity is retained.`;
                const item = question('ORG', label, text);
                // Externally provided process/outsourcing -> 8.4.
                item.criterionRef = deriveCriterionRef(text, standard) || (annexSLFallback ? '8.4' : '');
                item.criterionSource = 'org-context';
                out.push(item);
            } else {
                const text = `Sample the ${name} process end to end${owner} — verify it runs as planned, the required records are produced, and its performance is monitored.`;
                const item = question('ORG', label, text);
                // End-to-end process sampling -> 8.1 (operational planning and control).
                item.criterionRef = deriveCriterionRef(text, standard) || (annexSLFallback ? '8.1' : '');
                item.criterionSource = 'org-context';
                out.push(item);
            }
        });

        return out;
    }

    /**
     * Build a client checklist from the documents they supplied and their
     * organisation context, scoped to the audit type.
     *
     * Initial and recertification audits have to cover the whole standard, so
     * every auditable clause gets an item and clauses with no supporting
     * document are called out. A surveillance audit is risk-based: the ISO
     * 17021-1 mandatory elements plus what the documents and core processes
     * actually cover.
     *
     * @param {Object} client
     * @param {Array} docs - entries from client.documents
     * @param {Object} [opts] - { auditType, standard, includeMandatory, standardClauses, includeOrgContext }
     */
    function buildClientChecklist(client, docs, opts) {
        const o = Object.assign({
            auditType: 'surveillance', standard: '', includeMandatory: true,
            standardClauses: null, includeOrgContext: true, focusPoints: [], maxItems: null
        }, opts || {});
        const auditType = normalizeAuditType(o.auditType);
        const list = (docs || []).filter(d => d && d.name);
        const fullCoverage = auditType !== 'surveillance';
        // Length only ever constrains a surveillance audit. An initial or
        // recertification audit has to cover the standard, so a budget passed
        // in by a caller is ignored rather than allowed to cut coverage.
        const budget = fullCoverage ? null : o.maxItems;
        const clauses = [];

        // What the Stage 1 review said this audit has to cover leads the
        // checklist — it is the reason this checklist looks the way it does,
        // and it is what the auditor most needs in front of them.
        const focus = (o.focusPoints || []).filter(p => typeof p === 'string' && p.trim());
        if (focus.length) {
            clauses.push({
                mainClause: 'FOCUS',
                title: 'Audit Focus — carried over from the Stage 1 document review',
                // clause ('FOCUS.n') is an internal pseudo-reference; criterionRef
                // carries the actual standard clause when one can be recovered from
                // the focus-point text (criterionRef:'' when it can't) — see
                // deriveCriterionRef(). criterionSource flags both cases so a
                // consumer (execution-module-v2.js's checklist->NCR sync, and the
                // report engine) knows to display criterionRef, not `clause`.
                subClauses: focus.map((text, i) => {
                    const item = question(`FOCUS.${i + 1}`, 'Stage 1 finding', text);
                    item.criterionRef = deriveCriterionRef(text, o.standard);
                    item.criterionSource = 'focus-carryover';
                    return item;
                })
            });
        }

        if (o.includeMandatory && auditType === 'surveillance') {
            clauses.push({
                mainClause: 'SURV',
                title: 'Mandatory Surveillance Elements (ISO/IEC 17021-1 §9.6.2)',
                subClauses: SURVEILLANCE_MANDATORY.map(([ref, label, text]) => {
                    const item = question(`9.6.2 (${ref})`, label, text);
                    item.criterionRef = deriveCriterionRef(text, o.standard);
                    item.criterionSource = 'focus-carryover';
                    return item;
                })
            });
        }

        if (o.includeOrgContext) {
            const orgQuestions = orgContextQuestions(client, auditType, o.standard);
            if (orgQuestions.length) {
                clauses.push({
                    mainClause: 'ORG',
                    title: 'Scope, Sites and Key Processes',
                    subClauses: orgQuestions
                });
            }
        }

        // Documents indexed by the clause they support.
        const docsByClause = {};
        const unmapped = [];
        list.forEach(doc => {
            const mapped = String(doc.linkedClauses || '').split(',').map(s => s.trim()).filter(Boolean);
            if (!mapped.length) { unmapped.push(doc); return; }
            mapped.forEach(clause => {
                if (!docsByClause[clause]) docsByClause[clause] = [];
                docsByClause[clause].push(doc);
            });
        });

        const byMain = {};
        const addQuestion = (clause, q) => {
            const main = clause.split('.')[0];
            if (!byMain[main]) byMain[main] = { mainClause: main, title: clauseTitle(clause), subs: [] };
            byMain[main].subs.push(q);
        };

        if (fullCoverage && Array.isArray(o.standardClauses) && o.standardClauses.length) {
            // Every auditable clause of the standard gets an item, whether or
            // not the client sent something for it.
            o.standardClauses.forEach(std => {
                const clause = String(std.clause);
                const main = parseInt(clause.split('.')[0], 10);
                if (isNaN(main) || main < 4) return;
                const supporting = list.filter(doc =>
                    String(doc.linkedClauses || '').split(',').map(s => s.trim()).filter(Boolean)
                        .some(dc => clauseSatisfies(clause, dc))
                );
                const title = std.title || clauseTitle(clause);
                if (supporting.length) {
                    supporting.slice(0, 3).forEach(doc => {
                        docItems(doc, clause).forEach(text => addQuestion(clause, question(clause, title, text)));
                    });
                } else {
                    addQuestion(clause, question(clause, title,
                        `${std.requirement ? std.requirement.slice(0, 220) + ' — ' : ''}No documented information was supplied for this clause. Verify implementation on site and determine whether documented information is required.`));
                }
            });
        } else {
            // Surveillance, or no clause list available: drive it off the documents.
            // Under a length budget each document is asked about once, on the
            // first clause it supports, rather than repeated across all of them.
            const concise = !!budget;
            const asked = new Set();
            Object.keys(docsByClause).sort(compareClause).forEach(clause => {
                docsByClause[clause].forEach(doc => {
                    const key = doc.id || doc.name;
                    if (concise && asked.has(key)) return;
                    asked.add(key);
                    docItems(doc, clause, concise).forEach(text => addQuestion(clause, question(clause, doc.name, text)));
                });
            });
        }

        sortClauses(Object.keys(byMain)).forEach(main => {
            const group = byMain[main];
            clauses.push({
                mainClause: group.mainClause,
                title: group.title,
                subClauses: group.subs.slice().sort((a, b) => compareClause(a.clause, b.clause))
            });
        });

        if (unmapped.length) {
            clauses.push({
                mainClause: 'DOC',
                title: 'Other Documented Information Supplied by the Client',
                // DOC items previously carried no criterionRef either, blocking
                // finalization the same way ORG items did. deriveCriterionRef
                // runs first in case the document's own name/content resolves to
                // something more specific; 7.5 (control of documented
                // information) is a defensible default because that's genuinely
                // what "review this document's status, control and relevance"
                // is asking about — but 7.5 is an Annex-SL clause number, so
                // (same rule as the ORG items above) it only fills in for
                // Annex-SL-family standards; otherwise leave it to whatever
                // deriveCriterionRef found in the text, or ''.
                subClauses: unmapped.map(d => {
                    const text = `Review ${docRef(d)} and confirm its status, control and relevance to the certified scope.`;
                    const item = question('DOC', d.name, text);
                    item.criterionRef = deriveCriterionRef(text, o.standard) || (isAnnexSLFamilyStandard(o.standard) ? '7.5' : '');
                    item.criterionSource = 'unmapped-doc';
                    return item;
                })
            });
        }

        const trimmed = trimToBudget(clauses, budget);
        const typeLabel = auditType === 'surveillance' ? 'Surveillance' : auditType === 'recertification' ? 'Recertification' : 'Initial';
        const itemCount = trimmed.reduce((t, c) => t + c.subClauses.reduce((s, sc) => s + sc.items.length, 0), 0);

        return {
            id: Date.now(),
            name: `${client.name} - ${typeLabel} Audit Checklist (Client-Specific)`,
            standard: o.standard || client.standard || '',
            type: 'custom',
            auditType,
            clientName: client.name,
            clientId: client.id,
            clauses: trimmed,
            itemCount,
            targetItems: budget || null,
            documentsUsed: list.length,
            createdBy: (window.state && window.state.currentUser && window.state.currentUser.name) || 'Admin',
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0],
            source: 'client-documents'
        };
    }

    /** Back-compatible name for the surveillance-scoped build. */
    function buildSurveillanceChecklist(client, docs, opts) {
        return buildClientChecklist(client, docs, Object.assign({ includeOrgContext: false }, opts || {}));
    }

    /**
     * One checklist question per sub-clause entry. The execution view renders a
     * single row per sub-clause and reads items[0] at most, so questions must not
     * be stacked inside one entry or the extras never reach the auditor.
     */
    function question(clause, title, requirement) {
        return {
            clause,
            title: title || '',
            requirement,
            items: [{ clause, requirement }]
        };
    }

    /**
     * The verification questions a single document earns on a given clause.
     * On a budgeted surveillance the control check and the implementation check
     * become one question — two per document is what turned a half-day audit
     * into a 111-item checklist.
     */
    function docItems(doc, _clause, concise) {
        const ref = docRef(doc);
        if (doc.category === 'Records / Forms Register') {
            return [`Sample completed ${ref} records covering the surveillance period — verify entries are complete, authorised, legible and retained per the retention schedule.`];
        }
        const isStatic = doc.category === 'Certificate' || doc.category === 'Contract / Agreement';
        if (concise) {
            return [isStatic
                ? `Confirm ${ref} is current and valid for the certified scope.`
                : `Confirm ${ref} is the current approved issue and verify the process it describes is implemented as written — trace objective evidence generated since the previous audit.`];
        }
        const texts = [`Confirm ${ref} is the current approved issue, available where used, and that no uncontrolled copies are in circulation.`];
        if (!isStatic) {
            texts.push(`Verify the process described in ${ref} is implemented as written — trace objective evidence generated since the previous audit.`);
        }
        return texts;
    }

    /** Clauses of the Annex SL core with no supporting document — a real audit risk. */
    function coverageGaps(docs) {
        const covered = new Set();
        (docs || []).forEach(d => String(d.linkedClauses || '').split(',').forEach(c => {
            const t = c.trim();
            if (t) covered.add(t.split('.')[0]);
        }));
        return Object.keys(ANNEX_SL).filter(m => !covered.has(m));
    }

    // ── Org-setup extraction from document text ───────────────────────

    /**
     * How much an organisation of this size can plausibly have. A 30-person
     * shop does not run 22 departments, and returning a list that long makes
     * the auditor delete rows instead of reviewing them. Employee count is the
     * primary signal; extra sites widen it a little.
     */
    function orgSizeProfile(client) {
        const employees = parseInt(String((client && client.employees) || '').replace(/\D/g, ''), 10);
        const sites = Math.max(1, ((client && client.sites) || []).length);
        let band, caps;
        if (!isNaN(employees) && employees > 0 && employees < 10) {
            band = 'micro';
            caps = { departments: 4, designations: 6, processes: 8, goods: 6 };
        } else if (!isNaN(employees) && employees < 50) {
            band = 'small';
            caps = { departments: 6, designations: 10, processes: 12, goods: 8 };
        } else if (!isNaN(employees) && employees < 250) {
            band = 'medium';
            caps = { departments: 10, designations: 16, processes: 18, goods: 12 };
        } else if (!isNaN(employees) && employees >= 250) {
            band = 'large';
            caps = { departments: 16, designations: 24, processes: 25, goods: 18 };
        } else {
            // Unknown headcount — assume small rather than flooding the tables.
            band = 'unknown';
            caps = { departments: 8, designations: 12, processes: 14, goods: 10 };
        }
        if (sites > 1) {
            const extra = Math.min(sites - 1, 4);
            Object.keys(caps).forEach(k => { caps[k] += extra; });
        }
        return { band, employees: isNaN(employees) ? null : employees, sites, caps };
    }

    // Departments a management system document set normally names. A dictionary
    // hit is far less noisy than a bare capitalised-phrase match, so both run.
    const DEPARTMENT_DICTIONARY = [
        ['Production', 'High'], ['Manufacturing', 'High'], ['Assembly', 'High'],
        ['Quality Assurance', 'High'], ['Quality Control', 'High'], ['Quality', 'High'],
        ['Engineering', 'High'], ['Design', 'High'], ['Research and Development', 'Medium'],
        ['Maintenance', 'High'], ['Calibration', 'Medium'], ['Tool Room', 'Medium'],
        ['Purchasing', 'Medium'], ['Procurement', 'Medium'], ['Supply Chain', 'Medium'],
        ['Stores', 'Medium'], ['Warehouse', 'Medium'], ['Logistics', 'Medium'],
        ['Dispatch', 'Medium'], ['Packing', 'Medium'], ['Planning', 'Medium'],
        ['Human Resources', 'Medium'], ['Training', 'Medium'], ['Administration', 'Low'],
        ['Finance', 'Low'], ['Accounts', 'Low'], ['Sales', 'Medium'], ['Marketing', 'Low'],
        ['Customer Service', 'Medium'], ['Information Technology', 'Medium'],
        ['Health and Safety', 'High'], ['Environment', 'Medium'], ['Security', 'Medium'],
        ['Inspection', 'High'], ['Testing', 'High'], ['Laboratory', 'High'], ['Shipping', 'Medium']
    ];

    const TITLE_NOUNS = 'Manager|Director|Officer|Engineer|Supervisor|Inspector|Technician|Coordinator|Executive|Analyst|Operator|Representative|Administrator|Auditor|Controller|Planner|Storekeeper|Foreman|Chemist|Superintendent|Specialist|Head|Lead';

    // Words that start a sentence, not a job title or department name.
    const NOISE_PREFIX = /^(the|this|that|these|those|all|any|each|every|our|their|its|his|her|a|an|and|or|for|with|from|shall|must|may|when|if|is|are|be|been|such|other|same|new|following|above|below|relevant|applicable|appropriate|responsible|authorised|authorized)\b/i;

    function cleanPhrase(s) {
        return String(s || '').replace(/\s+/g, ' ').replace(/^[^A-Za-z]+|[^A-Za-z)]+$/g, '').trim();
    }

    /**
     * Drop leading sentence words rather than discarding the whole candidate —
     * "The Quality Manager" has to survive as "Quality Manager", and the regex
     * only gets one shot at each position.
     */
    function stripNoisePrefix(s) {
        let out = String(s || '').trim();
        while (NOISE_PREFIX.test(out)) {
            const next = out.replace(/^\S+\s+/, '');
            if (next === out) return '';
            out = next;
        }
        return out.trim();
    }

    /** Cut a captured phrase where the sentence resumes: "cable assemblies is covered". */
    function trimTrailingClause(s) {
        return String(s || '')
            .replace(/\s+\b(is|are|was|were|shall|will|which|that|includes?|including|covered|covering|as defined|in accordance|per|under)\b.*$/i, '')
            .trim();
    }

    function plausibleName(s, maxLength) {
        if (!s || s.length < 3 || s.length > (maxLength || 45)) return false;
        if (NOISE_PREFIX.test(s)) return false;
        if (!/[A-Za-z]{3}/.test(s)) return false;
        return true;
    }

    /**
     * Departments the documents actually evidence.
     *
     * A word appearing somewhere in a procedure is not a department — "Testing"
     * turns up in every inspection procedure ever written. A candidate only
     * counts when the text names it as an organisational unit: "X Department",
     * "Head of X", "X Manager", "X team". Candidates are then ranked by how
     * strong that evidence is and cut to what the organisation's size supports.
     */
    function extractDepartments(text, cap) {
        const found = new Map();
        const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const add = (name, risk, score, evidence) => {
            const clean = cleanPhrase(name);
            if (!plausibleName(clean)) return;
            const key = clean.toLowerCase();
            if (!found.has(key)) found.set(key, { name: clean, risk: 'Medium', score: 0, evidence: '' });
            const entry = found.get(key);
            if (risk) entry.risk = risk;
            if (score > entry.score) { entry.score = score; entry.evidence = evidence; }
        };

        // Anything explicitly written as a department is accepted outright.
        const explicit = /\b((?:[A-Z][A-Za-z&/-]*\s+){0,3}[A-Z][A-Za-z&/-]*)\s+(?:Department|Dept\.?|Division)\b/g;
        let m;
        while ((m = explicit.exec(text)) !== null) {
            add(stripNoisePrefix(m[1]), '', 5, 'named as a department');
        }

        // Dictionary terms need an organisational cue next to them.
        DEPARTMENT_DICTIONARY.forEach(([name, risk]) => {
            const n = esc(name);
            const cues = [
                [new RegExp('\\b' + n + '\\s+(?:department|dept\\.?|division)\\b', 'i'), 5, 'named as a department'],
                [new RegExp('\\bhead\\s+of\\s+(?:the\\s+)?' + n + '\\b', 'i'), 4, 'has a named head'],
                [new RegExp('\\b' + n + '\\s+(?:manager|head|director|supervisor|superintendent)\\b', 'i'), 4, 'has a named manager'],
                [new RegExp('\\b' + n + '\\s+(?:team|function|section|personnel|staff|unit)\\b', 'i'), 3, 'referred to as a team or function'],
                [new RegExp('\\b(?:the\\s+)?' + n + '\\s+(?:shall|is responsible|are responsible|maintains|performs|reviews|approves)\\b', 'i'), 3, 'assigned responsibilities']
            ];
            for (const [rx, score, evidence] of cues) {
                if (rx.test(text)) { add(name, risk, score, evidence); break; }
            }
        });

        return Array.from(found.values())
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, cap || 8)
            .map(d => ({ name: d.name, risk: d.risk, head: '', evidence: d.evidence }));
    }

    /** Job titles named in the text, most frequently mentioned first. */
    function extractDesignations(text, cap) {
        const found = new Map();
        const re = new RegExp('\\b((?:[A-Z][a-z]{1,15}\\s+){0,3}(?:' + TITLE_NOUNS + '))\\b', 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            const phrase = cleanPhrase(stripNoisePrefix(m[1]));
            if (!plausibleName(phrase)) continue;
            // A bare noun ("Manager", "Head") is not a designation — it needs a
            // qualifier to be worth putting in front of an auditor.
            if (phrase.split(' ').length < 2) continue;
            const key = phrase.toLowerCase();
            if (!found.has(key)) found.set(key, { title: phrase, count: 0 });
            found.get(key).count++;
        }
        return Array.from(found.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, cap || 12)
            .map(d => ({ title: d.title, department: '', count: d.count }));
    }

    /** Every controlled procedure describes a process — that is the strongest signal. */
    function extractProcesses(entries, cap) {
        const found = new Map();
        (entries || []).forEach(entry => {
            if (!['Quality Procedures', 'Work Instructions', 'Process Map'].includes(entry.category)) return;
            let name = String(entry.title || '')
                .replace(/^\s*(?:section|part|chapter|clause)\s*[0-9]{1,2}[A-Za-z]?(?:\.[0-9]{1,2})*\s*[-–—:.)]*\s*/i, '')
                .replace(/\s*\([^)]*\)\s*$/, '')
                .replace(/\b(procedures?|processes?|work instructions?|sop|policy|manual|guidelines?)\s*$/i, '')
                .trim();
            name = cleanPhrase(name);
            // Process names run longer than department names — "Counterfeit Parts
            // Prevention and Traceability" is 58 characters and entirely valid.
            if (!plausibleName(name, 70)) return;

            const main = String(entry.clauses || '').split(',')[0].trim().split('.')[0];
            let category = 'Management';
            if (main === '8') category = 'Core';
            else if (main === '7') category = 'Support';

            // Only the title or the document's opening scope decides outsourcing.
            // Nearly every procedure mentions external providers somewhere, and
            // matching on the whole body marked in-house processes as outsourced.
            const outsourceEvidence = `${name}\n${String(entry.text || '').slice(0, 400)}`;
            if (/\b(is\s+)?(outsourc|subcontract)\w*|performed by an external|external(ly)?\s+provid\w*\s+(?:performs|carries)/i.test(outsourceEvidence)) {
                category = 'Outsourced';
            }

            const key = name.toLowerCase();
            if (!found.has(key)) found.set(key, { name, category, owner: '', evidence: entry.title });
        });
        return Array.from(found.values()).slice(0, cap || 14);
    }

    // Phrases that are never a product or service in their own right — they are
    // the words a scope sentence is built from, not the thing being sold.
    const GOODS_STOPWORDS = /^(products?|services?|activities|activity|items?|goods|works?|manufactured|manufacturing|production|supply|part numbers?|parts?|components?|materials?|assemblies|processes?|operations?|requirements?|documents?|records?|customers?|suppliers?|equipment|systems?|solutions?|applications?|standards?|specifications?|scope|company|organi[sz]ation|quality|management|business|industry|clients?|projects?)$/i;

    // Standard and specification identifiers: IPC, WHMA-A, ISO 9001, AS9100…
    const SPEC_CODE = /^(iso|iec|ipc|whma|ansi|astm|mil|as|en|bs|din|sae|nadcap|ul|ce)\b|^[A-Z][A-Z0-9-]{1,}$|^[A-Z]{2,}-[A-Z0-9]/;

    // Document titles that leaked out of a scope sentence.
    const DOC_TITLE_WORDS = /\b(qms|ems|isms|section|clause|procedure|manual|policy|form|record|revision|appendix|annex)\b/i;

    /** Products and services, taken from scope and "manufacture of …" statements. */
    function extractGoodsServices(text, cap, client) {
        const found = new Map();
        const clientWords = String((client && client.name) || '')
            .toLowerCase().split(/\W+/).filter(w => w.length > 3);

        const acceptable = phrase => {
            const words = phrase.split(' ');
            if (words.length > 8) return false;
            if (GOODS_STOPWORDS.test(phrase)) return false;
            if (SPEC_CODE.test(phrase)) return false;
            if (DOC_TITLE_WORDS.test(phrase)) return false;
            // "KTD Select QMS ..." — anything echoing the client's own name.
            if (clientWords.some(w => phrase.toLowerCase().includes(w))) return false;
            // A single word has to carry its own weight; "IPC" and "cabling"
            // both survive the checks above, only one of them is a product.
            if (words.length === 1 && (phrase.length < 5 || phrase === phrase.toUpperCase())) return false;
            return true;
        };

        const add = (raw, category, score) => {
            raw.split(/\s*(?:,|;|\band\b|\bor\b|\/)\s*/).forEach(part => {
                // "manufacture of wiring harnesses" and "wiring harnesses" are the
                // same product; keep only the noun phrase.
                const stripped = String(part).replace(
                    /^\s*(?:the\s+)?(?:manufactur\w*|fabricat\w*|assembl\w*|production|supply|suppl\w+|provision|providing|design|delivery)\s+(?:and\s+\w+\s+)?of\s+/i, '');
                const clean = cleanPhrase(trimTrailingClause(stripNoisePrefix(stripped)));
                if (!plausibleName(clean, 60) || !acceptable(clean)) return;
                const key = clean.toLowerCase();
                if (!found.has(key) || found.get(key).score < score) {
                    found.set(key, { name: clean, category, description: '', score });
                }
            });
        };

        // A scope statement is the most authoritative source there is, so it
        // outranks an incidental "manufacture of ..." further down a procedure.
        const scopeRe = /\bscope\s*(?:of\s+(?:the\s+)?(?:qms|quality management system|certification|registration))?\s*[:-]\s*([^.\n]{10,160})/gi;
        const productRe = /\b(?:manufactur\w*|fabricat\w*|assembl\w*|production|supply|suppl\w+)\s+(?:and\s+\w+\s+)?of\s+([^.;\n]{6,120})/gi;
        const serviceRe = /\b(?:provision|providing|provide[sd]?|delivery)\s+of\s+([^.;\n]{6,120})/gi;

        let m;
        while ((m = scopeRe.exec(text)) !== null) add(m[1], 'Product', 3);
        while ((m = productRe.exec(text)) !== null) add(m[1], 'Product', 2);
        while ((m = serviceRe.exec(text)) !== null) add(m[1], 'Service', 1);

        return Array.from(found.values())
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, cap || 10)
            .map(g => ({ name: g.name, category: g.category, description: '' }));
    }

    /**
     * Everything the document set says about how the organisation is structured,
     * bounded by what an organisation of this size can plausibly have.
     * @param {Array} entries - [{title, category, clauses, text}] from the last import
     * @param {Object} [client] - used for the size profile and to reject self-references
     */
    function extractOrgEntities(entries, client) {
        const list = entries || [];
        const text = list.map(e => e.text || '').join('\n').slice(0, 300000);
        const profile = orgSizeProfile(client || {});
        return {
            profile,
            departments: extractDepartments(text, profile.caps.departments),
            designations: extractDesignations(text, profile.caps.designations),
            processes: extractProcesses(list, profile.caps.processes),
            goods: extractGoodsServices(text, profile.caps.goods, client)
        };
    }

    // ── Document gap analysis against a standard ──────────────────────

    /** Does a document mapped to docClause satisfy a requirement at stdClause? */
    function clauseSatisfies(stdClause, docClause) {
        if (!stdClause || !docClause) return false;
        return docClause === stdClause ||
            docClause.indexOf(stdClause + '.') === 0 ||   // doc is more specific (8.4.1 covers 8.4)
            stdClause.indexOf(docClause + '.') === 0;      // doc covers the parent (8.4 covers 8.4.1)
    }

    /**
     * Clause-by-clause coverage of a standard by the documents on file.
     * @param {Array} clauses - [{clause, title, requirement}] from the KB or built-ins
     * @param {Array} docs - client.documents
     * @returns {{rows: Array, total: number, covered: number, gaps: number, percent: number}}
     */
    function analyseDocumentGaps(clauses, docs) {
        const list = (docs || []).filter(d => d && d.name);
        // Clauses 1-3 of an Annex SL standard are scope, references and terms —
        // they carry no auditable requirement, so they are not gaps.
        const auditable = (clauses || []).filter(c => {
            const main = parseInt(String(c.clause).split('.')[0], 10);
            return !isNaN(main) && main >= 4;
        });

        const rows = auditable.map(c => {
            const matches = list.filter(doc =>
                String(doc.linkedClauses || '')
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .some(dc => clauseSatisfies(String(c.clause), dc))
            );
            return {
                clause: String(c.clause),
                title: c.title || '',
                requirement: c.requirement || '',
                docs: matches,
                covered: matches.length > 0
            };
        });

        const covered = rows.filter(r => r.covered).length;
        return {
            rows,
            total: rows.length,
            covered,
            gaps: rows.length - covered,
            percent: rows.length ? Math.round((covered / rows.length) * 100) : 0
        };
    }

    /** Clause list for a standard: analysed KB first, built-in list otherwise. */
    function clausesForStandard(standardName) {
        const kb = (window.state && window.state.knowledgeBase) || {};
        const normalize = window.KB_HELPERS && window.KB_HELPERS.normalizeStdName;
        if (Array.isArray(kb.standards) && normalize) {
            const wanted = normalize(standardName);
            const doc = kb.standards.find(s =>
                s.status === 'ready' && Array.isArray(s.clauses) && s.clauses.length &&
                wanted && normalize(s.name).includes(wanted)
            );
            if (doc) return { clauses: doc.clauses, source: `Knowledge Base — ${doc.name}` };
        }
        if (typeof window.getBuiltInClauses === 'function') {
            return { clauses: window.getBuiltInClauses(standardName || ''), source: 'Built-in clause set' };
        }
        return { clauses: [], source: 'No clause set available' };
    }

    let _gap = null;

    window.openDocumentGapAnalysis = function (clientId, standardName) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;
        const standards = String(client.standard || '').split(',').map(s => s.trim()).filter(Boolean);
        const standard = standardName || standards[0] || '';
        const docs = client.documents || [];

        if (!docs.length) {
            notify('No documents on file for this client — bulk upload them first.', 'error');
            return;
        }

        const { clauses, source } = clausesForStandard(standard);
        const analysis = analyseDocumentGaps(clauses, docs);
        _gap = { clientId, standard, source, analysis, onlyGaps: false };

        // Print is the modal's primary action so it stays in the footer rather
        // than sitting below a scrolling clause table.
        window.DataService.openFormModal(
            `Document Gap Analysis — ${client.name}`,
            '<div id="gap-body"></div>',
            () => window.printDocumentGapAnalysis()
        );
        const saveBtn = document.getElementById('modal-save');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-print" style="margin-right: 0.4rem;"></i>Print / PDF';
        }
        setWideModal(true);
        renderGapAnalysis();
    };

    window.setGapStandard = function (clientId, standardName) {
        window.openDocumentGapAnalysis(clientId, standardName);
    };

    window.toggleGapOnly = function (checked) {
        if (!_gap) return;
        _gap.onlyGaps = checked === true || checked === 'true' || checked === 'on';
        renderGapAnalysis();
    };

    function gapTile(value, label, colour) {
        return `
        <div style="background: #f8fafc; border-radius: 10px; padding: 0.85rem 1rem; border: 1px solid var(--border-color);">
            <div style="font-size: 1.6rem; font-weight: 700; color: ${colour};">${value}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">${label}</div>
        </div>`;
    }

    function renderGapAnalysis() {
        const client = window.DataService.findClient(_gap.clientId);
        const a = _gap.analysis;
        const standards = String((client && client.standard) || '').split(',').map(s => s.trim()).filter(Boolean);
        const shown = _gap.onlyGaps ? a.rows.filter(r => !r.covered) : a.rows;

        const body = document.getElementById('gap-body');
        if (!body) return;
        body.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-bottom: 0.9rem;">
            ${gapTile(a.percent + '%', 'Overall clause coverage', a.percent >= 80 ? '#16a34a' : a.percent >= 50 ? '#d97706' : '#dc2626')}
            ${gapTile(a.total, 'Applicable clauses', '#1e293b')}
            ${gapTile(a.covered, 'Covered by a document', '#16a34a')}
            ${gapTile(a.gaps, 'Gaps — no document on file', a.gaps ? '#dc2626' : '#64748b')}
        </div>
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <select class="form-control" style="width: auto; margin: 0;" data-action-change="setGapStandard" data-arg1="${esc(_gap.clientId)}" data-arg2="this.value">
                ${(standards.length ? standards : [_gap.standard || 'ISO 9001:2015']).map(s => `<option ${s === _gap.standard ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
            <label style="display: flex; gap: 0.4rem; align-items: center; cursor: pointer; font-size: 0.85rem;">
                <input type="checkbox" ${_gap.onlyGaps ? 'checked' : ''} data-action-change="toggleGapOnly" data-arg1="this.checked"> Show only gaps
            </label>
            <span style="font-size: 0.78rem; color: #94a3b8;">Clauses from: ${esc(_gap.source)}</span>
        </div>
        <div class="table-container" style="max-height: 45vh; overflow: auto;">
            <table style="font-size: 0.84rem;">
                <thead style="position: sticky; top: 0; background: var(--surface-color); z-index: 1;">
                    <tr><th style="width: 70px;">Clause</th><th>Requirement</th><th style="width: 90px;">Status</th><th style="width: 34%;">Document / action</th></tr>
                </thead>
                <tbody>
                    ${shown.length ? shown.map(r => `
                    <tr>
                        <td style="font-family: monospace; font-weight: 600; vertical-align: top;">${esc(r.clause)}</td>
                        <td style="vertical-align: top;">${esc(r.title || r.requirement.slice(0, 90))}</td>
                        <td style="vertical-align: top;">${r.covered
                ? '<span style="color:#16a34a;font-weight:600;"><i class="fa-solid fa-circle-check"></i> Covered</span>'
                : '<span style="color:#dc2626;font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Gap</span>'}</td>
                        <td style="vertical-align: top;">${r.covered
                ? r.docs.map(d => `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 7px;border-radius:4px;font-size:0.75rem;display:inline-block;margin:1px 2px 1px 0;">${esc(docRef(d))}</span>`).join('')
                : '<span style="color:#92400e;font-size:0.8rem;">No documented information supplied — request before Stage 2</span>'}</td>
                    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#16a34a;">No gaps — every applicable clause has a supporting document.</td></tr>'}
                </tbody>
            </table>
        </div>`;
    }

    window.printDocumentGapAnalysis = function () {
        if (!_gap) return;
        const client = window.DataService.findClient(_gap.clientId) || {};
        const a = _gap.analysis;
        const today = new Date().toISOString().split('T')[0];

        const win = window.open('', 'DocumentGapAnalysis', 'width=1000,height=800');
        if (!win) { notify('Allow pop-ups to print this report.', 'error'); return; }

        win.document.write(`<!doctype html><html><head><meta charset="utf-8">
        <title>Document Gap Analysis — ${esc(client.name || '')}</title>
        <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: "Segoe UI", Arial, sans-serif; color: #1e293b; font-size: 11px; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            .meta { color: #64748b; font-size: 11px; margin-bottom: 14px; }
            .meta strong { color: #1e293b; }
            .tiles { display: flex; gap: 10px; margin-bottom: 14px; }
            .tile { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
            .tile .n { font-size: 18px; font-weight: 700; }
            .tile .l { font-size: 10px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f1f5f9; text-align: left; padding: 6px; border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
            td { padding: 6px; border: 1px solid #e2e8f0; vertical-align: top; }
            tr { page-break-inside: avoid; }
            .gap { color: #dc2626; font-weight: 600; }
            .ok { color: #16a34a; font-weight: 600; }
            .foot { margin-top: 16px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style></head><body>
        <h1>Document Gap Analysis</h1>
        <div class="meta">
            <strong>${esc(client.name || '')}</strong> · Standard: <strong>${esc(_gap.standard)}</strong> ·
            Documents reviewed: <strong>${(client.documents || []).length}</strong> · Date: <strong>${today}</strong><br>
            Clause set: ${esc(_gap.source)}
        </div>
        <div class="tiles">
            <div class="tile"><div class="n">${a.percent}%</div><div class="l">Clause coverage</div></div>
            <div class="tile"><div class="n">${a.total}</div><div class="l">Applicable clauses</div></div>
            <div class="tile"><div class="n">${a.covered}</div><div class="l">Covered by a document</div></div>
            <div class="tile"><div class="n">${a.gaps}</div><div class="l">Gaps</div></div>
        </div>
        <table>
            <thead><tr><th style="width:60px;">Clause</th><th>Requirement</th><th style="width:70px;">Status</th><th style="width:32%;">Document on file / action required</th></tr></thead>
            <tbody>
                ${a.rows.map(r => `<tr>
                    <td>${esc(r.clause)}</td>
                    <td>${esc(r.title || r.requirement.slice(0, 120))}</td>
                    <td class="${r.covered ? 'ok' : 'gap'}">${r.covered ? 'Covered' : 'Gap'}</td>
                    <td>${r.covered ? esc(r.docs.map(d => docRef(d)).join('; ')) : 'No documented information supplied — request before Stage 2'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div class="foot">
            Prepared for pre-audit document review under ISO/IEC 17021-1. Coverage reflects the documents supplied by the client
            and their clause mapping in ISOXPERT Audit360; it is not by itself a conformity assessment.
        </div>
        </body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    };

    // ── Pre-Audit Review (Stage 1) evidence mapping ───────────────────

    // The 16 Stage 1 items in planning-module.js, each with the clauses it
    // covers and the words a supporting document would use. A document counts
    // as evidence for an item if either matches.
    const STAGE1_MAP = [
        { id: 'scope', label: 'Management System Scope', clauses: ['4.3'], re: /\b(scope|manual|boundaries|applicability)/i },
        { id: 'processes', label: 'Process Identification & Interaction', clauses: ['4.4'], re: /\b(process (map|interaction|approach)|turtle|sipoc|procedure)/i },
        { id: 'legal', label: 'Legal & Statutory Requirements', clauses: ['4.2', '6.1'], re: /\b(legal|complian|export|regulator|statutory|obligation|itar|sanction)/i },
        { id: 'objectives', label: 'Quality Objectives & Planning', clauses: ['6.2'], re: /\b(objective|kpi|target|planning|programme|program)/i },
        { id: 'resources', label: 'Resource Availability (Personnel, Infrastructure)', clauses: ['7.1'], re: /\b(resource|infrastructure|facilit|maintenance|equipment|calibrat)/i },
        { id: 'competence', label: 'Competence & Training Records', clauses: ['7.2'], re: /\b(competenc|training|skill|qualification|induction|awareness)/i },
        { id: 'documented_info', label: 'Documented Information Control', clauses: ['7.5'], re: /\b(document|record (control|retention)|master list)/i },
        { id: 'internal_audit', label: 'Internal Audit Program', clauses: ['9.2'], re: /\b(internal audit|audit (programme|program|schedule|plan))/i },
        { id: 'management_review', label: 'Management Review Evidence', clauses: ['9.3'], re: /\b(management review|mrm)/i },
        { id: 'corrective_action', label: 'Corrective Action Process', clauses: ['10.2'], re: /\b(corrective|capa|nonconform|root cause|improvement)/i },
        { id: 'risks_opportunities', label: 'Risk & Opportunity Management', clauses: ['6.1'], re: /\b(risk|opportunit|fmea|swot|aspect|hira)/i },
        { id: 'monitoring', label: 'Monitoring & Measurement Methods', clauses: ['9.1', '8.6'], re: /\b(monitor|measurement|analysis|inspection|test|spc|satisfaction)/i },
        { id: 'context', label: 'Organizational Context & Interested Parties', clauses: ['4.1', '4.2'], re: /\b(context|interested part|stakeholder|profile|overview)/i },
        { id: 'leadership', label: 'Leadership & Commitment Evidence', clauses: ['5.1', '5.2', '5.3'], re: /\b(leadership|polic|responsibilit|authorit|organi[sz]ation chart|organogram)/i },
        { id: 'communication', label: 'Internal & External Communication', clauses: ['7.4'], re: /\b(communicat|meeting|notice|briefing)/i },
        { id: 'site_readiness', label: 'Site Readiness for Stage 2 Audit', clauses: [], re: /\b(site|layout|facility|readiness|premises|plant)/i }
    ];

    const EVIDENCE_PREFIX = 'Documents on file: ';

    function clauseCovers(itemClause, docClause) {
        if (!itemClause || !docClause) return false;
        return docClause === itemClause ||
            docClause.indexOf(itemClause + '.') === 0 ||
            itemClause.indexOf(docClause + '.') === 0;
    }

    /**
     * Which of the client's documents supports each Stage 1 review item.
     * @param {Array} docs - client.documents
     * @returns {Array} [{id, label, docs: [], line: string}]
     */
    function mapDocumentsToStage1(docs) {
        const list = (docs || []).filter(d => d && d.name);
        return STAGE1_MAP.map(item => {
            const matches = list.filter(doc => {
                const docClauses = String(doc.linkedClauses || '').split(',').map(s => s.trim()).filter(Boolean);
                if (item.clauses.some(ic => docClauses.some(dc => clauseCovers(ic, dc)))) return true;
                const haystack = `${doc.name} ${doc.category || ''} ${(doc.headings || []).map(h => h.text).join(' ')}`;
                return item.re.test(haystack);
            });
            return {
                id: item.id,
                label: item.label,
                docs: matches,
                line: matches.length
                    ? EVIDENCE_PREFIX + matches.map(d => docRef(d)).join('; ')
                    : ''
            };
        });
    }

    /**
     * Replace a previously written evidence line rather than stacking a new one,
     * so the mapping can be re-run after more documents arrive.
     */
    function mergeEvidenceNote(existingNotes, line) {
        const kept = String(existingNotes || '')
            .split(/\r?\n/)
            .filter(l => l.trim() && l.indexOf(EVIDENCE_PREFIX) !== 0);
        if (line) kept.unshift(line);
        return kept.join('\n').trim();
    }

    // ── ZIP reading (no library — central directory + DecompressionStream) ──

    async function inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot expand ZIP archives');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    function dosDateToIso(dosDate) {
        const day = dosDate & 0x1f;
        const month = (dosDate >> 5) & 0x0f;
        const year = ((dosDate >> 9) & 0x7f) + 1980;
        return toIso(year, month, day);
    }

    /**
     * Expand a ZIP into File objects. Reads the central directory rather than
     * scanning for local headers, so entries written with data descriptors
     * (streamed ZIPs, where the local header sizes are zero) still come out whole.
     */
    async function readZipEntries(file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

        let eocd = -1;
        const back = Math.min(buf.length, 66000);
        for (let i = buf.length - 22; i >= buf.length - back && i >= 0; i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('Not a readable ZIP archive');

        const count = dv.getUint16(eocd + 10, true);
        let p = dv.getUint32(eocd + 16, true);
        const entries = [];
        for (let n = 0; n < count && p + 46 <= buf.length; n++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true);
            const dosDate = dv.getUint16(p + 14, true);
            const compSize = dv.getUint32(p + 20, true);
            const nameLen = dv.getUint16(p + 28, true);
            const extraLen = dv.getUint16(p + 30, true);
            const commentLen = dv.getUint16(p + 32, true);
            const localOffset = dv.getUint32(p + 42, true);
            // Windows' own Compress-Archive writes backslash separators even
            // though the ZIP spec mandates '/', and that is exactly what most
            // clients send. Normalise before anything reads the path.
            const name = new TextDecoder('utf-8').decode(buf.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
            p += 46 + nameLen + extraLen + commentLen;

            if (name.endsWith('/') || !compSize) continue;
            if (/^__MACOSX\//.test(name) || /(^|\/)\./.test(name)) continue;
            if (compSize === 0xffffffff || localOffset === 0xffffffff) continue; // ZIP64 — out of scope
            entries.push({ name, method, compSize, localOffset, dosDate });
        }

        const files = [];
        for (const e of entries) {
            const lh = e.localOffset;
            if (lh + 30 > buf.length || dv.getUint32(lh, true) !== 0x04034b50) continue;
            const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
            const raw = buf.subarray(start, start + e.compSize);
            let bytes;
            try {
                bytes = e.method === 0 ? raw : await inflateRaw(raw);
            } catch (err) {
                if (window.Logger) window.Logger.warn('ClientDocsBulk', `Could not expand ${e.name}: ${err.message}`);
                continue;
            }
            const shortName = e.name.split('/').pop();
            files.push({
                file: new File([bytes], shortName, { type: mimeFor(shortName) }),
                path: e.name,
                fileDate: dosDateToIso(e.dosDate)
            });
        }
        return files;
    }

    function mimeFor(name) {
        const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
        const map = {
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            pdf: 'application/pdf',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain', csv: 'text/csv', md: 'text/markdown'
        };
        return map[ext] || 'application/octet-stream';
    }

    // ── Batch state ───────────────────────────────────────────────────

    let _batch = [];
    let _clientId = null;
    let _opts = { upload: true, extract: true };
    const _corpus = {};   // clientId → [{title, category, clauses, text}] from the last import

    function esc(s) {
        return window.UTILS && window.UTILS.escapeHtml ? window.UTILS.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
    }

    function notify(msg, type) {
        if (window.showNotification) window.showNotification(msg, type || 'success');
    }

    // ── UI: step 1, the drop zone ─────────────────────────────────────

    window.openBulkDocumentUpload = function (clientId) {
        if (window.AuthManager && !window.AuthManager.canPerform('create', 'client')) {
            notify('Access Denied: you do not have permission to add client documents.', 'error');
            return;
        }
        const client = window.DataService.findClient(clientId);
        if (!client) return;

        _batch = [];
        _clientId = clientId;
        _opts = { upload: !!(window.SupabaseClient && window.SupabaseClient.isInitialized), extract: true };

        window.DataService.openFormModal(`Bulk Upload Documents — ${client.name}`, `
            <div id="bulk-doc-body">${dropZoneHTML()}</div>
        `);
        setWideModal(true);
        attachDropZone();
    };

    function setWideModal(on) {
        const mc = document.querySelector('.modal-content');
        if (mc) mc.classList.toggle('modal-wide', !!on);
    }

    function dropZoneHTML() {
        const cloudReady = window.SupabaseClient && window.SupabaseClient.isInitialized;
        return `
        <div id="bulk-drop" style="border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2.5rem 1.5rem; text-align: center; background: #f8fafc; transition: all 0.15s;">
            <i class="fa-solid fa-folder-tree" style="font-size: 2.25rem; color: var(--primary-color);"></i>
            <p style="margin: 0.75rem 0 0.25rem; font-weight: 600;">Drop the client's documents here</p>
            <p style="margin: 0 0 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
                A ZIP archive, a whole folder, or any number of individual files. Section numbers, document numbers, revisions and dates are read automatically.
            </p>
            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" data-action="clickElement" data-id="bulk-files"><i class="fa-solid fa-file-arrow-up" style="margin-right: 0.4rem;"></i>Choose Files / ZIP</button>
                <button class="btn btn-secondary btn-sm" data-action="clickElement" data-id="bulk-folder"><i class="fa-solid fa-folder-open" style="margin-right: 0.4rem;"></i>Choose Folder</button>
            </div>
            <input type="file" id="bulk-files" multiple style="display: none;" data-action-change="handleBulkDocsInput">
            <input type="file" id="bulk-folder" webkitdirectory directory multiple style="display: none;" data-action-change="handleBulkDocsInput">
        </div>
        <div style="margin-top: 1rem; font-size: 0.82rem; color: var(--text-secondary); display: flex; gap: 1.25rem; flex-wrap: wrap;">
            <label style="display: flex; gap: 0.4rem; align-items: center; cursor: pointer;">
                <input type="checkbox" id="bulk-opt-extract" checked data-action-change="setBulkDocOption" data-arg1="extract"> Read document text to confirm revision, date and clause coverage
            </label>
            <label style="display: flex; gap: 0.4rem; align-items: center; cursor: ${cloudReady ? 'pointer' : 'not-allowed'}; opacity: ${cloudReady ? 1 : 0.5};">
                <input type="checkbox" id="bulk-opt-upload" ${cloudReady ? 'checked' : 'disabled'} data-action-change="setBulkDocOption" data-arg1="upload"> Store the files in cloud storage
            </label>
        </div>`;
    }

    function attachDropZone() {
        const zone = document.getElementById('bulk-drop');
        if (!zone) return;
        const stop = e => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
            stop(e);
            zone.style.borderColor = 'var(--primary-color)';
            zone.style.background = '#eff6ff';
        }));
        ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
            stop(e);
            zone.style.borderColor = 'var(--border-color)';
            zone.style.background = '#f8fafc';
        }));
        zone.addEventListener('drop', e => {
            const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
            if (files.length) processIncoming(files.map(f => ({ file: f, path: f.webkitRelativePath || f.name })));
        });
    }

    window.setBulkDocOption = function (key, value) {
        _opts[key] = value === true || value === 'true' || value === 'on';
    };

    window.handleBulkDocsInput = function (el) {
        const input = el && el.files ? el : document.getElementById('bulk-files');
        const files = Array.from((input && input.files) || []);
        if (!files.length) return;
        const extractEl = document.getElementById('bulk-opt-extract');
        const uploadEl = document.getElementById('bulk-opt-upload');
        if (extractEl) _opts.extract = extractEl.checked;
        if (uploadEl) _opts.upload = uploadEl.checked && !uploadEl.disabled;
        processIncoming(files.map(f => ({ file: f, path: f.webkitRelativePath || f.name })));
    };

    // ── UI: step 2, parse everything with a progress bar ──────────────

    function progressHTML(done, total, label) {
        const pct = total ? Math.round((done / total) * 100) : 0;
        return `
        <div style="padding: 2rem 1rem; text-align: center;">
            <p style="margin: 0 0 1rem; font-weight: 600;">${esc(label)}</p>
            <div style="height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${pct}%; background: var(--primary-color); transition: width 0.2s;"></div>
            </div>
            <p style="margin: 0.75rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">${done} of ${total} files</p>
        </div>`;
    }

    function setBody(html) {
        const body = document.getElementById('bulk-doc-body');
        if (body) body.innerHTML = html;
    }

    async function processIncoming(items) {
        // Expand any ZIPs first so the file count in the progress bar is honest.
        const expanded = [];
        for (const item of items) {
            if (/\.zip$/i.test(item.file.name)) {
                setBody(progressHTML(0, 1, `Expanding ${item.file.name}…`));
                try {
                    const inner = await readZipEntries(item.file);
                    inner.forEach(e => expanded.push(e));
                } catch (err) {
                    notify(`Could not read ${item.file.name}: ${err.message}`, 'error');
                }
            } else {
                expanded.push(item);
            }
        }

        const usable = expanded.filter(e => {
            const ext = e.file.name.slice(e.file.name.lastIndexOf('.') + 1).toLowerCase();
            return READABLE_EXT.includes(ext);
        });
        const skipped = expanded.length - usable.length;

        if (!usable.length) {
            setBody(`<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                <i class="fa-solid fa-circle-exclamation" style="font-size: 1.75rem; color: #f59e0b;"></i>
                <p style="margin-top: 0.75rem;">No supported documents found in that selection.</p>
                <button class="btn btn-secondary btn-sm" data-action="openBulkDocumentUpload" data-id="${esc(_clientId)}">Try again</button>
            </div>`);
            return;
        }

        const existing = (window.DataService.findClient(_clientId) || {}).documents || [];
        const existingKeys = new Set(existing.map(d => docKey({ title: d.name, sectionRef: d.sectionRef || '' })));
        const batchKeys = new Map();
        _batch = [];

        for (let i = 0; i < usable.length; i++) {
            const entry = usable[i];
            setBody(progressHTML(i, usable.length, `Reading ${entry.file.name}…`));
            // Yield so the progress bar actually paints between files.
            await new Promise(r => setTimeout(r, 0));

            const parsed = parseDocumentName(entry.file.name, entry.path);
            let content = null;
            let text = '';
            if (_opts.extract && ['docx', 'pdf', 'txt', 'md', 'csv'].includes(parsed.ext) && typeof window.extractTextFromFile === 'function') {
                try {
                    text = (await window.extractTextFromFile(entry.file)) || '';
                } catch (_e) {
                    text = '';
                }
                if (text) content = parseContentMeta(text.slice(0, 20000));
            }

            const fileDate = entry.fileDate || (entry.file.lastModified ? new Date(entry.file.lastModified).toISOString().split('T')[0] : '');
            const row = {
                include: true,
                file: entry.file,
                path: entry.path,
                ext: parsed.ext,
                sizeMB: (entry.file.size / 1024 / 1024).toFixed(2),
                title: parsed.title,
                sectionRef: parsed.sectionRef,
                docNumber: parsed.docNumber || (content && content.docNumber) || '',
                revision: parsed.revision || (content && content.revision) || '',
                date: (content && content.date) || parsed.date || fileDate,
                fileDate,
                category: parsed.category,
                clauses: mapClauses(parsed, content).join(', '),
                headings: (content && content.headings) || [],
                notes: buildNotes(parsed, content, text),
                // Kept in memory only (never persisted to the client record) so
                // the org-setup extraction can read the real document body.
                text: text ? text.slice(0, 20000) : '',
                source: content && content.revision && !parsed.revision ? 'content' : 'filename',
                status: 'new'
            };

            const key = docKey({ title: row.title, sectionRef: row.sectionRef });
            if (existingKeys.has(key)) {
                row.status = 'existing';
                row.include = false;
            } else if (batchKeys.has(key)) {
                row.status = 'duplicate';
                row.include = false;
                row.duplicateOf = batchKeys.get(key);
            } else {
                batchKeys.set(key, row.title);
            }
            if (parsed.copyIndex && row.status === 'new') row.status = 'copy';

            _batch.push(row);
        }

        renderReview(skipped);
    }

    function buildNotes(parsed, content, text) {
        const bits = [];
        if (content && content.headings.length) {
            bits.push('Sections in document: ' + content.headings.slice(0, 12).map(h => `${h.clause} ${h.text}`).join('; '));
        } else if (text) {
            bits.push(text.replace(/\s+/g, ' ').trim().slice(0, NOTE_LIMIT));
        }
        if (!bits.length && parsed.sectionRef) bits.push(`Section ${parsed.sectionRef} of the client's management system documentation.`);
        return bits.join('\n').slice(0, NOTE_LIMIT);
    }

    // ── UI: step 3, the review table ──────────────────────────────────

    const STATUS_STYLE = {
        new: ['#dcfce7', '#166534', 'New'],
        existing: ['#fef3c7', '#92400e', 'Already on file'],
        duplicate: ['#fee2e2', '#991b1b', 'Duplicate in batch'],
        copy: ['#e0e7ff', '#3730a3', 'Looks like a copy']
    };

    function renderReview(skipped) {
        const selected = _batch.filter(r => r.include).length;
        const mapped = _batch.filter(r => r.clauses).length;

        const rows = _batch.map((r, i) => {
            const st = STATUS_STYLE[r.status] || STATUS_STYLE.new;
            return `
            <tr style="${r.include ? '' : 'opacity: 0.55;'}">
                <td style="text-align: center;"><input type="checkbox" ${r.include ? 'checked' : ''} data-action-change="toggleBulkDocRow" data-arg1="${i}"></td>
                <td style="max-width: 210px;">
                    <input type="text" class="form-control" style="margin: 0; font-size: 0.85rem; padding: 4px 8px;" value="${esc(r.title)}" data-action-change="updateBulkDocField" data-arg1="${i}" data-arg2="title" data-arg3="this.value">
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;" title="${esc(r.path)}"><i class="fa-solid fa-file" style="margin-right: 3px;"></i>${esc(r.path.length > 42 ? '…' + r.path.slice(-40) : r.path)} · ${esc(r.sizeMB)} MB</div>
                </td>
                <td style="text-align: center; font-family: monospace; font-size: 0.82rem;">${esc(r.sectionRef || '—')}</td>
                <td>
                    <select class="form-control" style="margin: 0; font-size: 0.82rem; padding: 4px 6px;" data-action-change="updateBulkDocField" data-arg1="${i}" data-arg2="category" data-arg3="this.value">
                        ${CATEGORIES.map(c => `<option ${c === r.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                    </select>
                </td>
                <td><input type="text" class="form-control" style="margin: 0; font-size: 0.82rem; padding: 4px 6px; width: 80px;" value="${esc(r.revision)}" data-action-change="updateBulkDocField" data-arg1="${i}" data-arg2="revision" data-arg3="this.value"></td>
                <td><input type="date" class="form-control" style="margin: 0; font-size: 0.8rem; padding: 4px 6px;" value="${esc(r.date)}" data-action-change="updateBulkDocField" data-arg1="${i}" data-arg2="date" data-arg3="this.value"></td>
                <td><input type="text" class="form-control" style="margin: 0; font-size: 0.82rem; padding: 4px 6px; min-width: 110px;" value="${esc(r.clauses)}" placeholder="e.g. 8.4, 8.5" data-action-change="updateBulkDocField" data-arg1="${i}" data-arg2="clauses" data-arg3="this.value"></td>
                <td style="text-align: center;"><span style="background: ${st[0]}; color: ${st[1]}; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; white-space: nowrap;">${st[2]}</span></td>
            </tr>`;
        }).join('');

        setBody(`
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <div style="font-size: 0.88rem; color: var(--text-secondary);">
                <strong style="color: var(--text-primary);">${_batch.length}</strong> documents read ·
                <strong style="color: var(--text-primary);">${mapped}</strong> auto-mapped to clauses ·
                <strong style="color: var(--text-primary);" id="bulk-selected">${selected}</strong> selected
                ${skipped ? ` · <span style="color:#94a3b8;">${skipped} unsupported file(s) skipped</span>` : ''}
            </div>
            <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm" data-action="toggleAllBulkDocs" data-arg1="1">Select all</button>
                <button class="btn btn-secondary btn-sm" data-action="toggleAllBulkDocs" data-arg1="0">Clear</button>
            </div>
        </div>
        <p style="margin: 0 0 0.75rem; font-size: 0.8rem; color: var(--text-secondary);">
            Everything below was derived from the file names and, where readable, the documents' own header and headings. Correct anything that looks wrong before importing — the clause mapping is what the checklist is built from.
        </p>
        <div class="table-container" style="max-height: 46vh; overflow: auto;">
            <table style="font-size: 0.85rem;">
                <thead style="position: sticky; top: 0; background: var(--surface-color); z-index: 1;">
                    <tr>
                        <th style="width: 34px;"></th>
                        <th>Document</th>
                        <th style="width: 60px;">Sec.</th>
                        <th style="width: 165px;">Category</th>
                        <th style="width: 90px;">Revision</th>
                        <th style="width: 140px;">Date</th>
                        <th style="width: 130px;">ISO Clauses</th>
                        <th style="width: 110px;">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" data-action="openBulkDocumentUpload" data-id="${esc(_clientId)}"><i class="fa-solid fa-arrow-left" style="margin-right: 0.4rem;"></i>Start over</button>
            <button class="btn btn-primary" data-action="confirmBulkDocImport" data-id="${esc(_clientId)}"><i class="fa-solid fa-check" style="margin-right: 0.4rem;"></i>Import selected documents</button>
        </div>`);
    }

    window.toggleBulkDocRow = function (idx, checked) {
        const row = _batch[+idx];
        if (!row) return;
        row.include = checked === undefined ? !row.include : (checked === true || checked === 'true' || checked === 'on');
        const counter = document.getElementById('bulk-selected');
        if (counter) counter.textContent = String(_batch.filter(r => r.include).length);
    };

    window.toggleAllBulkDocs = function (on) {
        const val = on === '1' || on === 1 || on === true;
        _batch.forEach(r => { r.include = val; });
        renderReview(0);
    };

    window.updateBulkDocField = function (idx, field, value) {
        const row = _batch[+idx];
        if (!row) return;
        row[field] = value;
    };

    // ── Import ────────────────────────────────────────────────────────

    async function uploadToCloud(clientId, file) {
        if (!window.SupabaseClient || !window.SupabaseClient.isInitialized) return null;
        if (file.size > MAX_UPLOAD_BYTES) return null;
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `clients/${clientId}/${Date.now()}_${safe}`;
        const { error } = await window.SupabaseClient.client.storage
            .from('documents')
            .upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data } = window.SupabaseClient.client.storage.from('documents').getPublicUrl(path);
        return { path, url: data && data.publicUrl };
    }

    window.confirmBulkDocImport = async function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;
        const chosen = _batch.filter(r => r.include);
        if (!chosen.length) { notify('Select at least one document to import.', 'error'); return; }

        if (!client.documents) client.documents = [];
        let uploaded = 0, uploadFailed = 0;

        for (let i = 0; i < chosen.length; i++) {
            const r = chosen[i];
            setBody(progressHTML(i, chosen.length, `Importing ${r.title}…`));
            await new Promise(res => setTimeout(res, 0));

            let stored = null;
            if (_opts.upload) {
                try {
                    stored = await uploadToCloud(clientId, r.file);
                    if (stored) uploaded++;
                } catch (err) {
                    uploadFailed++;
                    if (window.Logger) window.Logger.warn('ClientDocsBulk', `Upload failed for ${r.file.name}: ${err.message}`);
                }
            }

            client.documents.push({
                id: `${Date.now()}_${i}`,
                name: r.title,
                category: r.category,
                revision: r.revision || '',
                linkedClauses: r.clauses || '',
                notes: r.notes || '',
                type: (r.ext || 'file').toUpperCase(),
                date: r.date || new Date().toISOString().split('T')[0],
                size: `${r.sizeMB} MB`,
                sectionRef: r.sectionRef || '',
                docNumber: r.docNumber || '',
                fileName: r.file.name,
                sourcePath: r.path,
                headings: (r.headings || []).slice(0, MAX_HEADINGS),
                storagePath: stored ? stored.path : '',
                url: stored ? stored.url : '',
                uploadedAt: new Date().toISOString(),
                importedBy: (window.state && window.state.currentUser && window.state.currentUser.name) || 'Admin',
                source: 'bulk-import'
            });
        }

        // Hold the document bodies in memory for the org-setup extraction that
        // follows. They are deliberately never written to the client record —
        // full manuals would bloat the row that syncs to Supabase.
        _corpus[String(clientId)] = chosen
            .filter(r => r.text)
            .map(r => ({ title: r.title, category: r.category, clauses: r.clauses, text: r.text }));

        window.saveData();
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.upsertClient(client).catch(err => {
                if (window.Logger) window.Logger.error('ClientDocsBulk', 'Cloud sync failed: ' + err.message);
            });
        }

        const gaps = coverageGaps(client.documents);
        setBody(`
        <div style="padding: 1.5rem 1rem; text-align: center;">
            <i class="fa-solid fa-circle-check" style="font-size: 2.25rem; color: #16a34a;"></i>
            <h3 style="margin: 0.75rem 0 0.25rem;">${chosen.length} document${chosen.length === 1 ? '' : 's'} imported</h3>
            <p style="margin: 0 0 1rem; font-size: 0.88rem; color: var(--text-secondary);">
                ${_opts.upload ? `${uploaded} file(s) stored in the cloud${uploadFailed ? `, ${uploadFailed} could not be stored (metadata kept)` : ''}.` : 'Metadata recorded — files were not uploaded.'}
            </p>
            ${gaps.length ? `
            <div style="background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 0.75rem 1rem; text-align: left; margin-bottom: 1rem; font-size: 0.85rem;">
                <strong>No client document maps to clause${gaps.length === 1 ? '' : 's'} ${gaps.join(', ')}.</strong>
                <div style="color: #78716c; margin-top: 0.25rem;">${gaps.map(g => `${g} ${ANNEX_SL[g]}`).join(' · ')} — request these before the audit or plan to sample them on site.</div>
            </div>` : ''}
            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary" data-action="extractOrgSetupFromDocs" data-id="${esc(clientId)}"><i class="fa-solid fa-diagram-project" style="margin-right: 0.4rem;"></i>Extract departments, roles &amp; processes</button>
                <button class="btn btn-secondary" data-action="buildChecklistFromClientDocs" data-id="${esc(clientId)}"><i class="fa-solid fa-list-check" style="margin-right: 0.4rem;"></i>Build surveillance checklist</button>
                <button class="btn btn-secondary" data-action="closeBulkDocModal" data-id="${esc(clientId)}">Done</button>
            </div>
        </div>`);

        notify(`Imported ${chosen.length} document(s) for ${client.name}`, 'success');
    };

    window.closeBulkDocModal = function (clientId) {
        setWideModal(false);
        window.closeModal();
        _batch = [];
        if (typeof window.renderClientDetail === 'function' && clientId) {
            window.renderClientDetail(clientId);
            setTimeout(() => {
                const tab = document.querySelector('.tab-btn[data-tab="documents"]');
                if (tab) tab.click();
            }, 100);
        }
    };

    // ── Pre-Audit Review evidence mapping (UI) ────────────────────────

    let _stage1 = null;

    window.mapClientDocsToPreAudit = function (planId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan) { notify('Audit plan not found', 'error'); return; }
        const client = (window.state.clients || []).find(c => c.name === plan.client);
        const docs = (client && client.documents) || [];
        if (!docs.length) {
            notify('No client documents on file — bulk upload them from the client\'s Documents tab first.', 'error');
            return;
        }

        _stage1 = { planId, mapping: mapDocumentsToStage1(docs) };
        const covered = _stage1.mapping.filter(m => m.docs.length);
        const gaps = _stage1.mapping.filter(m => !m.docs.length);

        window.DataService.openFormModal(`Stage 1 Evidence — ${plan.client}`, `
        <div style="font-size: 0.88rem;">
            <p style="margin: 0 0 1rem; color: var(--text-secondary);">
                ${docs.length} client document(s) matched against the 16 Stage 1 review items by ISO clause and subject.
                Applying this writes the supporting document references into each item's notes — <strong>the conformity status stays yours to set</strong>.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                <div style="background: #f0fdf4; border-radius: 8px; padding: 0.75rem 1rem;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #166534;">${covered.length}</div>
                    <div style="font-size: 0.8rem; color: #166534;">items with documented evidence</div>
                </div>
                <div style="background: ${gaps.length ? '#fffbeb' : '#f8fafc'}; border-radius: 8px; padding: 0.75rem 1rem;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${gaps.length ? '#92400e' : '#64748b'};">${gaps.length}</div>
                    <div style="font-size: 0.8rem; color: ${gaps.length ? '#92400e' : '#64748b'};">items with nothing on file</div>
                </div>
            </div>
            <div class="table-container" style="max-height: 40vh; overflow: auto;">
                <table style="font-size: 0.83rem;">
                    <thead style="position: sticky; top: 0; background: var(--surface-color); z-index: 1;">
                        <tr><th>Stage 1 Item</th><th>Supporting documents</th></tr>
                    </thead>
                    <tbody>
                        ${_stage1.mapping.map(m => `
                        <tr>
                            <td style="font-weight: 500; white-space: nowrap;">${esc(m.label)}</td>
                            <td>${m.docs.length
                ? m.docs.map(d => `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 7px;border-radius:4px;font-size:0.75rem;display:inline-block;margin:1px 2px 1px 0;">${esc(docRef(d))}</span>`).join('')
                : '<span style="color:#b45309;font-size:0.8rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>Nothing on file — request from the client</span>'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`, () => window.applyStage1Evidence(planId));
        setWideModal(true);
    };

    // ── AI Stage 1 document review ────────────────────────────────────

    let _aiReview = null;

    function stage1Corpus(client) {
        const docs = (client.documents || []).filter(d => d && d.name);
        const lines = docs.slice(0, 60).map(d => {
            const bits = [`- ${d.name}`];
            if (d.docNumber) bits.push(`no ${d.docNumber}`);
            if (d.revision) bits.push(d.revision);
            if (d.date) bits.push(`dated ${d.date}`);
            if (d.category) bits.push(`[${d.category}]`);
            if (d.linkedClauses) bits.push(`clauses ${d.linkedClauses}`);
            let line = bits.join(' · ');
            const detail = (d.headings || []).slice(0, 8).map(h => `${h.clause} ${h.text}`).join('; ') || (d.notes || '').slice(0, 200);
            if (detail) line += `\n    contents: ${detail}`;
            return line;
        });
        return lines.join('\n');
    }

    function buildStage1Prompt(client, plan, corpus) {
        const items = STAGE1_MAP.map(i => `${i.id} | ${i.label}${i.clauses.length ? ' (clauses ' + i.clauses.join(', ') + ')' : ''}`).join('\n');
        return [
            'You are an ISO/IEC 17021-1 lead auditor performing the Stage 1 documentation review before an on-site audit.',
            `Client: ${client.name}${client.industry ? ' — ' + client.industry : ''}. Standard: ${plan.standard || client.standard || 'not stated'}. Audit type: ${plan.auditType || plan.type || 'not stated'}.`,
            `Employees: ${client.employees || 'not recorded'}. Sites: ${(client.sites || []).length || 1}.`,
            '',
            '=== DOCUMENTS THE CLIENT SUPPLIED ===',
            corpus || '(none)',
            '=== END DOCUMENTS ===',
            '',
            'Review these documents against the 16 Stage 1 items below and judge each one:',
            items,
            '',
            'Status rules — you are judging the DOCUMENTATION only, not implementation:',
            '- "ok": documented information covering this item was supplied and looks adequate.',
            '- "minor": something was supplied but it is incomplete, out of date, or only partly covers the item.',
            '- "major": nothing was supplied for a requirement the standard makes mandatory, so the client is not ready for Stage 2.',
            '- "": you genuinely cannot tell from what was supplied.',
            'Base the judgement only on the documents listed. Do not assume a document exists because a company of this type would normally have one.',
            '',
            'Return ONLY a JSON object (no markdown, no commentary):',
            '{"items":[{"id":"<one of the ids above>","status":"ok|minor|major|","comment":"one sentence citing the document, or what is missing"}],',
            ' "summary":{',
            '   "newOrChangedProcesses":["processes the documents show as new or changed since the last issue"],',
            '   "documentsUpdated":["documents whose revision or date shows a recent update, with the revision"],',
            '   "trainingRecords":"what the documents show about competence and training records, or that nothing was supplied",',
            '   "managementReview":"what they show about the last management review, or that nothing was supplied",',
            '   "internalAudit":"what they show about the last internal audit, or that nothing was supplied",',
            '   "keyRisks":["the two or three things most likely to produce a finding on site"]',
            ' },',
            ' "focusPoints":["specific things this audit must cover as a result of this review — phrase each as an audit instruction"]}',
            '',
            'Keep focusPoints to at most 8, each traceable to something in the documents.'
        ].join('\n');
    }

    function parseStage1Response(text) {
        const empty = { items: [], summary: null, focusPoints: [] };
        if (!text) return empty;
        const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) return empty;
        let parsed;
        try {
            parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch (_e) {
            return empty;
        }
        const valid = new Set(STAGE1_MAP.map(i => i.id));
        return {
            items: Array.isArray(parsed.items)
                ? parsed.items.filter(i => i && valid.has(i.id)).map(i => ({
                    id: i.id,
                    status: ['ok', 'minor', 'major'].includes(i.status) ? i.status : '',
                    comment: String(i.comment || '').slice(0, 400)
                }))
                : [],
            summary: parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null,
            focusPoints: Array.isArray(parsed.focusPoints)
                ? parsed.focusPoints.filter(p => typeof p === 'string' && p.trim()).slice(0, 8)
                : []
        };
    }

    window.aiReviewPreAuditDocuments = async function (planId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan) { notify('Audit plan not found', 'error'); return; }
        const clients = window.state.clients || [];
        const client = clients.find(c => String(c.id) === String(plan.clientId)) || clients.find(c => c.name === plan.client);
        if (!client) { notify(`Client "${plan.client}" not found`, 'error'); return; }
        const docs = (client.documents || []).filter(d => d && d.name);
        if (!docs.length) {
            notify('No client documents on file — upload them from the client\'s Documents tab first.', 'error');
            return;
        }
        if (!window.AI_SERVICE || !window.AI_SERVICE.callProxyAPI) {
            notify('The AI service is not available in this deployment.', 'error');
            return;
        }

        window.DataService.openFormModal(`AI Document Review — ${plan.client}`, `
        <div id="ai-stage1-body" style="padding: 2.5rem 1rem; text-align: center;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
            <p style="margin: 1rem 0 0; font-weight: 600;">Reviewing ${docs.length} document(s) against the 16 Stage 1 items…</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.84rem; color: var(--text-secondary);">This usually takes 20–40 seconds.</p>
        </div>`);
        setWideModal(true);

        try {
            const response = await window.AI_SERVICE.callProxyAPI(
                buildStage1Prompt(client, plan, stage1Corpus(client)),
                { maxTokens: 8192 }
            );
            const result = parseStage1Response(response);
            if (!result.items.length) {
                document.getElementById('ai-stage1-body').innerHTML =
                    `<div style="padding:2rem;text-align:center;"><i class="fa-solid fa-triangle-exclamation" style="font-size:1.75rem;color:#f59e0b;"></i>
                    <p style="margin-top:0.75rem;color:var(--text-secondary);">The AI did not return a usable review. Try again.</p></div>`;
                return;
            }
            _aiReview = { planId, result };
            renderStage1Review();
        } catch (err) {
            if (window.Logger) window.Logger.error('ClientDocsBulk', 'Stage 1 AI review failed: ' + err.message);
            document.getElementById('ai-stage1-body').innerHTML =
                `<div style="padding:2rem;text-align:center;"><i class="fa-solid fa-triangle-exclamation" style="font-size:1.75rem;color:#f59e0b;"></i>
                <p style="margin-top:0.75rem;color:var(--text-secondary);">${esc(err.message || 'The AI request failed.')}</p></div>`;
        }
    };

    const STATUS_PILL = {
        ok: ['#dcfce7', '#166534', 'OK'],
        minor: ['#fef3c7', '#92400e', 'Minor'],
        major: ['#fee2e2', '#991b1b', 'Major'],
        '': ['#f1f5f9', '#475569', 'Not Reviewed']
    };

    function summaryBlock(title, icon, value) {
        const list = Array.isArray(value) ? value : (value ? [value] : []);
        if (!list.length) return '';
        return `
        <div style="margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;"><i class="fa-solid ${icon}" style="color:#7c3aed;margin-right:0.4rem;"></i>${esc(title)}</div>
            <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.84rem; color: #475569; line-height: 1.6;">
                ${list.map(v => `<li>${esc(v)}</li>`).join('')}
            </ul>
        </div>`;
    }

    function renderStage1Review() {
        const { result } = _aiReview;
        const s = result.summary || {};
        const byId = {};
        result.items.forEach(i => { byId[i.id] = i; });

        const body = document.getElementById('ai-stage1-body');
        if (!body) return;
        body.style.padding = '0';
        body.style.textAlign = 'left';
        body.innerHTML = `
        <div style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 6px 6px 0;padding:0.9rem 1.1rem;margin-bottom:1rem;">
            <div style="font-weight:700;margin-bottom:0.6rem;">What the auditor should focus on</div>
            ${summaryBlock('New or changed processes', 'fa-diagram-project', s.newOrChangedProcesses)}
            ${summaryBlock('Documents updated', 'fa-file-pen', s.documentsUpdated)}
            ${summaryBlock('Competence & training records', 'fa-graduation-cap', s.trainingRecords)}
            ${summaryBlock('Last management review', 'fa-users-rectangle', s.managementReview)}
            ${summaryBlock('Last internal audit', 'fa-clipboard-check', s.internalAudit)}
            ${summaryBlock('Most likely findings', 'fa-triangle-exclamation', s.keyRisks)}
            ${!Object.keys(s).length ? '<div style="font-size:0.85rem;color:#64748b;">No summary returned.</div>' : ''}
        </div>

        ${result.focusPoints.length ? `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:0.85rem 1.1rem;margin-bottom:1rem;">
            <div style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-solid fa-bullseye" style="color:#7c3aed;margin-right:0.4rem;"></i>Points this audit must cover (${result.focusPoints.length})</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:0.5rem;">These are added to the plan and become an Audit Focus section when the checklist is built.</div>
            <ul style="margin:0;padding-left:1.5rem;font-size:0.85rem;line-height:1.7;">${result.focusPoints.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>` : ''}

        <div class="table-container" style="max-height:38vh;overflow:auto;">
            <table style="font-size:0.84rem;">
                <thead style="position:sticky;top:0;background:var(--surface-color);z-index:1;">
                    <tr><th>Stage 1 item</th><th style="width:110px;">Proposed</th><th>Justification</th></tr>
                </thead>
                <tbody>
                    ${STAGE1_MAP.map(item => {
            const r = byId[item.id] || { status: '', comment: 'Not assessed.' };
            const pill = STATUS_PILL[r.status] || STATUS_PILL[''];
            return `<tr>
                        <td style="font-weight:500;">${esc(item.label)}</td>
                        <td><span style="background:${pill[0]};color:${pill[1]};padding:2px 8px;border-radius:4px;font-size:0.75rem;white-space:nowrap;">${pill[2]}</span></td>
                        <td style="color:#475569;">${esc(r.comment || '')}</td>
                    </tr>`;
        }).join('')}
                </tbody>
            </table>
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin:0.75rem 0 0;">
            These are proposals from a documentation review. Applying them sets each item's status and appends the justification to its notes — you remain responsible for the conformity decision.
        </p>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
            <button class="btn btn-secondary btn-sm" data-action="closeBulkDocModal">Cancel</button>
            <button class="btn btn-primary" data-action="applyAIStage1Review" data-id="${esc(_aiReview.planId)}"><i class="fa-solid fa-check-double" style="margin-right:0.4rem;"></i>Apply review to Stage 1</button>
        </div>`;
    }

    window.applyAIStage1Review = function (planId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan || !_aiReview || String(_aiReview.planId) !== String(planId)) return;

        if (!plan.preAudit) {
            plan.preAudit = {
                status: 'Not Started', completedDate: null, completedBy: null,
                findings: [], documentReview: {}, readinessDecision: null, notes: ''
            };
        }
        if (!plan.preAudit.documentReview) plan.preAudit.documentReview = {};

        const AI_PREFIX = 'AI document review: ';
        _aiReview.result.items.forEach(item => {
            const current = plan.preAudit.documentReview[item.id] || {};
            const kept = String(current.notes || '')
                .split(/\r?\n/)
                .filter(l => l.trim() && l.indexOf(AI_PREFIX) !== 0);
            if (item.comment) kept.push(AI_PREFIX + item.comment);
            plan.preAudit.documentReview[item.id] = Object.assign({}, current, {
                status: item.status,
                notes: kept.join('\n').trim()
            });
        });

        plan.preAudit.aiSummary = Object.assign({}, _aiReview.result.summary, {
            generatedAt: new Date().toISOString()
        });
        plan.preAudit.focusPoints = _aiReview.result.focusPoints;
        if (plan.preAudit.status === 'Not Started') plan.preAudit.status = 'In Progress';

        persistPlan(plan);
        setWideModal(false);
        window.closeModal();
        notify(
            `Stage 1 review applied to ${_aiReview.result.items.length} items` +
            (_aiReview.result.focusPoints.length ? `, ${_aiReview.result.focusPoints.length} focus point(s) saved to the plan` : ''),
            'success'
        );
        if (typeof window.renderPreAuditReview === 'function') window.renderPreAuditReview(planId);
    };

    window.applyStage1Evidence = function (planId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan || !_stage1 || String(_stage1.planId) !== String(planId)) return;

        if (!plan.preAudit) {
            plan.preAudit = {
                status: 'Not Started', completedDate: null, completedBy: null,
                findings: [], documentReview: {}, readinessDecision: null, notes: ''
            };
        }
        if (!plan.preAudit.documentReview) plan.preAudit.documentReview = {};

        let written = 0;
        _stage1.mapping.forEach(m => {
            const current = plan.preAudit.documentReview[m.id] || {};
            const merged = mergeEvidenceNote(current.notes, m.line);
            if (merged !== (current.notes || '')) {
                plan.preAudit.documentReview[m.id] = Object.assign({}, current, { notes: merged });
                if (m.line) written++;
            }
        });

        // Same persistence path savePreAuditReview uses — plans ride along with
        // the app state rather than syncing individually.
        if (plan.preAudit.status === 'Not Started') plan.preAudit.status = 'In Progress';
        persistPlan(plan);

        setWideModal(false);
        window.closeModal();
        notify(`Evidence written into ${written} of 16 Stage 1 items`, 'success');
        if (typeof window.renderPreAuditReview === 'function') window.renderPreAuditReview(planId);
    };

    // ── Checklist generation ──────────────────────────────────────────

    window.buildChecklistFromClientDocs = function (clientId, presetAuditType, presetStandard, planId) {
        const client = window.DataService.findClient(clientId);
        if (!client) return;
        const docs = (client.documents || []).filter(d => d && d.name);
        if (!docs.length) {
            notify('No documents on file for this client yet — bulk upload them first.', 'error');
            return;
        }

        const clientStandards = String(client.standard || '').split(',').map(s => s.trim()).filter(Boolean);
        const standards = presetStandard && !clientStandards.includes(presetStandard)
            ? [presetStandard].concat(clientStandards)
            : clientStandards;
        const audit = normalizeAuditType(presetAuditType || 'surveillance');
        const mappedCount = docs.filter(d => d.linkedClauses).length;
        const context = [
            (client.keyProcesses || []).length ? `${client.keyProcesses.length} key process(es)` : '',
            (client.sites || []).length ? `${client.sites.length} site(s)` : '',
            (client.goodsServices || []).length ? `${client.goodsServices.length} product(s)/service(s)` : ''
        ].filter(Boolean).join(', ');
        const planForFocus = planId ? window.DataService.findAuditPlan(planId) : null;
        const focusCount = ((planForFocus && planForFocus.preAudit && planForFocus.preAudit.focusPoints) || []).length;
        const manDays = planForFocus ? (planForFocus.manDays || planForFocus.man_days || '') : '';
        const suggestedBudget = checklistBudget(audit, manDays, orgSizeProfile(client));

        window.DataService.openFormModal(`Build Checklist — ${client.name}`, `
        <div style="font-size: 0.88rem;">
            <p style="margin: 0 0 1rem; color: var(--text-secondary);">
                Built from <strong>${docs.length} document(s)</strong> on file (${mappedCount} mapped to clauses)${context ? ` and this client's ${context}` : ''}.
            </p>
            ${focusCount ? `<div style="background:#faf5ff;border-left:3px solid #7c3aed;border-radius:0 6px 6px 0;padding:0.6rem 0.9rem;margin-bottom:1rem;font-size:0.84rem;">
                <strong>${focusCount} focus point(s)</strong> from the Stage 1 review will lead the checklist as an Audit Focus section.
            </div>` : ''}
            <div class="form-group">
                <label>Audit Type</label>
                <select class="form-control" id="cldoc-audit-type">
                    <option value="surveillance" ${audit === 'surveillance' ? 'selected' : ''}>Surveillance — ISO 17021-1 mandatory elements + risk-based sampling</option>
                    <option value="initial" ${audit === 'initial' ? 'selected' : ''}>Initial (Stage 2) — full coverage of every clause</option>
                    <option value="recertification" ${audit === 'recertification' ? 'selected' : ''}>Recertification — full coverage of every clause</option>
                </select>
            </div>
            <div class="form-group">
                <label>Standard</label>
                <select class="form-control" id="cldoc-standard">
                    ${standards.length ? standards.map(s => `<option ${s === presetStandard ? 'selected' : ''}>${esc(s)}</option>`).join('') : '<option value="">(not set on client)</option>'}
                </select>
            </div>
            <div class="form-group">
                <label>Checklist length <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.82rem;">— a surveillance audit samples, it does not re-audit</span></label>
                <select class="form-control" id="cldoc-length">
                    <option value="25" ${suggestedBudget === 25 ? 'selected' : ''}>Half day — about 25 questions</option>
                    <option value="30" ${suggestedBudget === 30 ? 'selected' : ''}>One day — about 30 questions</option>
                    <option value="45" ${suggestedBudget === 45 ? 'selected' : ''}>Two days — about 45 questions</option>
                    <option value="60" ${suggestedBudget === 60 ? 'selected' : ''}>Three days — about 60 questions</option>
                    <option value="75" ${suggestedBudget === 75 ? 'selected' : ''}>Longer — about 75 questions</option>
                    <option value="">No limit — every mapped document and clause</option>
                </select>
                <small style="color: var(--text-secondary);">${manDays ? `Plan is ${esc(manDays)} man-day(s).` : 'Man-days not set on the plan.'} Focus points and the ISO 17021-1 mandatory elements are never trimmed. Ignored for initial and recertification audits, which must cover the standard.</small>
            </div>
            <label style="display: flex; gap: 0.5rem; align-items: center; cursor: pointer; margin-bottom: 0.4rem;">
                <input type="checkbox" id="cldoc-org" checked>
                <span>Include scope, sites and key processes from Account Setup</span>
            </label>
            <label style="display: flex; gap: 0.5rem; align-items: center; cursor: pointer;">
                <input type="checkbox" id="cldoc-mandatory" checked>
                <span>Include the mandatory surveillance elements of ISO/IEC 17021-1 §9.6.2 (surveillance only)</span>
            </label>
        </div>`, () => {
            const auditType = document.getElementById('cldoc-audit-type').value;
            const standard = document.getElementById('cldoc-standard').value;
            const includeMandatory = document.getElementById('cldoc-mandatory').checked;
            const includeOrgContext = document.getElementById('cldoc-org').checked;
            const standardClauses = normalizeAuditType(auditType) === 'surveillance'
                ? null
                : clausesForStandard(standard).clauses;
            const plan = planId ? window.DataService.findAuditPlan(planId) : null;
            const focusPoints = (plan && plan.preAudit && plan.preAudit.focusPoints) || [];
            const lengthValue = document.getElementById('cldoc-length').value;
            const maxItems = normalizeAuditType(auditType) === 'surveillance' && lengthValue
                ? parseInt(lengthValue, 10)
                : null;
            createChecklist(client, docs, { auditType, standard, includeMandatory, includeOrgContext, standardClauses, focusPoints, maxItems }, planId);
        });
    };

    /**
     * Entry point from an audit plan's Configure Checklists screen: same builder,
     * pre-set to the plan's standard and audit type, and assigned to the plan.
     */
    window.createClientChecklistForPlan = function (planId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan) { notify('Audit plan not found', 'error'); return; }
        const clients = window.state.clients || [];
        const client = clients.find(c => String(c.id) === String(plan.clientId)) ||
            clients.find(c => c.name === plan.client);
        if (!client) { notify(`Client "${plan.client}" not found`, 'error'); return; }
        if (!(client.documents || []).length) {
            notify(`No documents on file for ${client.name}. Upload them from the client's Documents tab first, then build the checklist.`, 'error');
            return;
        }
        window.buildChecklistFromClientDocs(
            client.id,
            plan.auditType || plan.type || plan.auditPurpose,
            plan.standard,
            planId
        );
    };

    /**
     * Add a freshly created checklist to the plan's selected set.
     *
     * `selectedChecklists` is the field the Configure Checklists screen and the
     * execution view both read, and it holds IDs as strings even though a
     * checklist's own id is a number. Leaving selectedChecklistItems untouched
     * means every item is in scope, which is what a brand-new checklist wants.
     */
    function assignChecklistToPlan(planId, checklistId) {
        const plan = window.DataService.findAuditPlan(planId);
        if (!plan) return false;
        if (!Array.isArray(plan.selectedChecklists)) plan.selectedChecklists = [];
        if (!plan.selectedChecklists.some(id => String(id) === String(checklistId))) {
            plan.selectedChecklists.push(String(checklistId));
        }
        return plan;
    }

    /**
     * Persist a mutated plan locally and to the cloud.
     * pre_audit is written as its own column as well as inside the data blob,
     * because the cloud loader reads `pre_audit || data.preAudit` and then
     * overwrites the local plan — a data-only write would be lost on the next sync.
     */
    async function persistPlan(plan) {
        try {
            if (window.SupabaseClient && window.SupabaseClient.isInitialized && window.SupabaseClient.db) {
                await window.SupabaseClient.db.update('audit_plans', String(plan.id), {
                    data: plan,
                    pre_audit: plan.preAudit || null,
                    updated_at: new Date().toISOString()
                });
            }
        } catch (err) {
            if (window.Logger) window.Logger.error('ClientDocsBulk', 'Plan sync failed: ' + err.message);
        }
        window.saveData();
    }

    async function createChecklist(client, docs, opts, planId) {
        const checklist = buildClientChecklist(client, docs, opts);
        if (!window.state.checklists) window.state.checklists = [];
        window.state.checklists.push(checklist);

        const plan = planId ? assignChecklistToPlan(planId, checklist.id) : null;
        const assigned = !!plan;
        if (plan) {
            await persistPlan(plan);
        } else {
            window.saveData();
        }

        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            try {
                await window.SupabaseClient.client.from('checklists').upsert({
                    id: String(checklist.id),
                    name: checklist.name,
                    standard: checklist.standard,
                    type: checklist.type,
                    clauses: checklist.clauses,
                    created_by: checklist.createdBy,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });
            } catch (err) {
                if (window.Logger) window.Logger.error('ClientDocsBulk', 'Checklist sync failed: ' + err.message);
            }
        }

        setWideModal(false);
        window.closeModal();
        notify(
            `Created "${checklist.name}" — ${checklist.itemCount} items from ${docs.length} client document(s)` +
            (assigned ? ' and assigned to this audit plan' : ''),
            'success'
        );

        // Coming from a plan, stay on its Configure Checklists screen so the new
        // checklist appears in place rather than dumping the user in the library.
        if (assigned && typeof window.renderConfigureChecklist === 'function') {
            window.renderConfigureChecklist(planId);
        } else if (assigned && typeof window.viewAuditPlan === 'function') {
            window.viewAuditPlan(planId);
        } else {
            window.location.hash = 'checklists';
        }
    }

    // ── Exports ───────────────────────────────────────────────────────

    const ClientDocsBulk = {
        parseDocumentName,
        parseContentMeta,
        inferCategory,
        mapClauses,
        findDate,
        findRevision,
        findDocNumber,
        findClauseRefs,
        docKey,
        buildClientChecklist,
        buildSurveillanceChecklist,
        normalizeAuditType,
        checklistBudget,
        trimToBudget,
        orgContextQuestions,
        clausesForStandard,
        coverageGaps,
        readZipEntries,
        extractOrgEntities,
        orgSizeProfile,
        extractDepartments,
        extractDesignations,
        extractProcesses,
        extractGoodsServices,
        mapDocumentsToStage1,
        mergeEvidenceNote,
        parseStage1Response,
        buildStage1Prompt,
        analyseDocumentGaps,
        clauseSatisfies,
        STAGE1_MAP,
        /**
         * Document bodies from the last import for this client, if the tab has
         * not been reloaded since. Falls back to the stored notes and headings,
         * which are shorter but survive a reload.
         */
        getCorpus(clientId, client) {
            const live = _corpus[String(clientId)];
            if (live && live.length) return live;
            return ((client && client.documents) || []).map(d => ({
                title: d.name,
                category: d.category,
                clauses: d.linkedClauses,
                text: [d.name, (d.headings || []).map(h => `${h.clause} ${h.text}`).join('\n'), d.notes || ''].join('\n')
            }));
        },
        CATEGORIES,
        ANNEX_SL,
        // Exposed so the Report Integrity panel can pre-suggest a real clause
        // when an auditor maps a legacy FOCUS/SURV finding to its criterion —
        // one keyword map, not a second copy living in the UI layer.
        deriveCriterionRef,
        isAnnexSLFamilyStandard
    };

    window.ClientDocsBulk = ClientDocsBulk;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ClientDocsBulk;
    }

    if (window.Logger) window.Logger.debug('Modules', 'client-docs-bulk.js loaded successfully.');
})();
