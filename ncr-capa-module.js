// ============================================
// NCR-CAPA MODULE - DUAL LEVEL (Client & CB)
// ISO 17021-1 Clause 9.9 & 8.7
// ============================================

// Initialize NCR-CAPA state (ESM-ready)
if (!window.state.ncrs) {
    window.state.ncrs = [];
}

// Initialize CAPA analytics
if (!window.state.capaAnalytics) {
    window.state.capaAnalytics = {
        totalNCRs: 0,
        openNCRs: 0,
        overdueNCRs: 0,
        effectivenessRate: 0,
        avgClosureTime: 0
    };
}

// --------------------------------------------
// CAR STATUS VOCABULARY (Governance V3)
// Extended lifecycle for corrective action records.
// Legacy 4-state vocabulary (Open, In Progress, Verification, Closed)
// continues to drive `ncr.status`; `carStatus` is a richer, parallel
// lifecycle field consumed by report-risk-capa / report-findings-ops.
// --------------------------------------------
const CAR_STATUSES = [
    'Draft',
    'Correction Pending',
    'RCA Pending',
    'Plan Pending',
    'Approved',
    'In Progress',
    'Evidence Submitted',
    'Verification Pending',
    'Effective',
    'Ineffective',
    'Closed',
    'Reopened',
    'Withdrawn'
];

// Map legacy 4-state `status` values onto the extended CAR vocabulary.
// Anything not in the legacy set passes through unchanged.
function normalizeCarStatus(s) {
    if (s === 'Open') return 'Correction Pending';
    if (s === 'Verification') return 'Verification Pending';
    return s;
}

// Reverse mapping: extended carStatus -> legacy 4-state `status` (+ Withdrawn).
// Keeps every existing open/overdue/filter/analytics code path (which reads
// ncr.status) working unchanged while carStatus carries the richer lifecycle.
function legacyStatusFromCar(carStatus) {
    switch (carStatus) {
        case 'Withdrawn': return 'Withdrawn';
        case 'Effective':
        case 'Closed': return 'Closed';
        case 'Verification Pending': return 'Verification';
        case 'Draft':
        case 'Correction Pending': return 'Open';
        // RCA Pending, Plan Pending, Approved, In Progress, Evidence Submitted,
        // Ineffective, Reopened all read as "In Progress" in the legacy pipeline.
        default: return 'In Progress';
    }
}

// Auto-transition rule (task item 2): the furthest CAPA field actually
// recorded on the NCR determines the CAR status. Order matters — later
// checks represent a more advanced stage and win.
function computeAutoCarStatus(ncr) {
    if (ncr.capaImplementedDate) return 'Verification Pending';
    if (ncr.correctiveAction) return 'In Progress';
    if (ncr.rootCause) return 'Plan Pending';
    if (ncr.correction) return 'RCA Pending';
    return 'Correction Pending';
}

// Linear "happy path" stages used to decide whether a manually-selected
// carStatus should be auto-advanced by newly recorded CAPA fields. Non-linear
// states (Withdrawn, Effective, Ineffective, Closed, Reopened) are always
// respected as manual/explicit choices and never auto-bumped.
const CAR_PROGRESSION = ['Draft', 'Correction Pending', 'RCA Pending', 'Plan Pending', 'Approved', 'In Progress', 'Evidence Submitted', 'Verification Pending'];
function bumpCarStatus(selected, autoStatus) {
    const si = CAR_PROGRESSION.indexOf(selected);
    const ai = CAR_PROGRESSION.indexOf(autoStatus);
    if (si === -1 || ai === -1) return selected;
    return ai > si ? autoStatus : selected;
}

// Render <option> elements for the extended CAR status vocabulary, grouped
// into sensible stages.
function carStatusOptionsHTML(selected) {
    const groups = [
        { label: 'Intake', values: ['Draft', 'Correction Pending'] },
        { label: 'Root Cause & Planning', values: ['RCA Pending', 'Plan Pending', 'Approved'] },
        { label: 'Implementation', values: ['In Progress', 'Evidence Submitted'] },
        { label: 'Verification', values: ['Verification Pending', 'Effective', 'Ineffective'] },
        { label: 'Closure', values: ['Closed', 'Reopened', 'Withdrawn'] }
    ];
    return groups.map(g => `<optgroup label="${g.label}">${g.values.map(s =>
        `<option value="${s}" ${selected === s ? 'selected' : ''}>${s}</option>`
    ).join('')}</optgroup>`).join('');
}

window.NCRModule = window.NCRModule || {};
window.NCRModule.CAR_STATUSES = CAR_STATUSES;
window.NCRModule.normalizeCarStatus = normalizeCarStatus;
window.NCRModule.legacyStatusFromCar = legacyStatusFromCar;
window.NCRModule.computeAutoCarStatus = computeAutoCarStatus;
window.normalizeCarStatus = normalizeCarStatus;

// Helper: is this NCR excluded from active counts/views (withdrawn by checklist auto-sync)?
function isWithdrawnNCR(n) {
    return n && n.status === 'Withdrawn';
}
window.isWithdrawnNCR = isWithdrawnNCR;

// --------------------------------------------
// CLAUSE / CRITERION DISPLAY (register tables)
// Internal pseudo-clauses (FOCUS.n/SURV.n/ORG/DOC — Stage 1 carryover
// references, never real ISO clauses) must never be printed to the register
// as if they were a real clause. Routes through window.ReportStats.
// formatCriterion — the single source of truth the report engine itself
// uses — when it's loaded, with a local regex fallback for pages where it
// isn't. showInternal:true keeps the internal tag visible alongside a
// resolved real clause (e.g. '9.2 (FOCUS.2)'), which is useful in this
// internal/CAPA-facing register even though report-facing views hide it.
// --------------------------------------------
const NCR_FOCUS_REF_RE = /^(FOCUS|SURV|ORG|DOC)([.\s]|$)/i;
function resolveClauseDisplay(rec) {
    const r = rec || {};
    if (window.ReportStats && typeof window.ReportStats.formatCriterion === 'function') {
        const info = window.ReportStats.formatCriterion(r, { showInternal: true });
        if (info.isInternal) {
            return { text: (r.clause || info.label || '') + ' — criterion pending', pending: true };
        }
        return { text: info.label, pending: false };
    }
    // Local fallback when ReportStats isn't loaded on this page.
    const clause = String(r.clause || '').trim();
    const criterionRef = String(r.criterionRef || '').trim();
    if (criterionRef) {
        const isCarryover = clause && NCR_FOCUS_REF_RE.test(clause) && clause.toLowerCase() !== criterionRef.toLowerCase();
        return { text: isCarryover ? `${criterionRef} (${clause})` : criterionRef, pending: false };
    }
    if (clause && NCR_FOCUS_REF_RE.test(clause)) {
        return { text: clause + ' — criterion pending', pending: true };
    }
    return { text: clause || '-', pending: false };
}
// <td> markup for the register's Clause column.
function renderClauseCell(rec) {
    const d = resolveClauseDisplay(rec);
    if (d.pending) {
        return `<span class="badge bg-gray" style="opacity: 0.75; font-style: italic;" title="No resolved ISO clause on file for this internal reference">${window.UTILS.escapeHtml(d.text)}</span>`;
    }
    return `<span class="badge bg-gray">${window.UTILS.escapeHtml(d.text)}</span>`;
}
window.NCRModule.resolveClauseDisplay = resolveClauseDisplay;

// --------------------------------------------
// SHARED CONTRACT: capaDisplayStatus / isOverdue
// The single source for "is this record overdue" and for mapping the
// internal 13-state carStatus/status lifecycle onto the auditor-facing
// display vocabulary. Other modules (dashboard-module.js, the report
// engine) must call these rather than reimplementing the date/status math,
// so overdue detection and CAPA status wording agree everywhere.
// --------------------------------------------

/**
 * Whether a register record is past its due date without being closed.
 * Never true before dueDate has passed, never true once closed/withdrawn.
 */
function isOverdueNCR(rec) {
    if (!rec || isWithdrawnNCR(rec)) return false;
    if (rec.status === 'Closed' || rec.carStatus === 'Closed' || rec.carStatus === 'Effective') return false;
    if (!rec.dueDate) return false;
    const due = new Date(rec.dueDate);
    if (isNaN(due)) return false;
    return due < new Date();
}
window.NCRModule.isOverdue = isOverdueNCR;

/**
 * Map a register record's underlying lifecycle fields (status / carStatus /
 * response fields / dueDate) onto the auditor-facing CAPA display vocabulary:
 *
 *   'Awaiting Auditee Response'      — no correction/rootCause/correctiveAction
 *                                       yet, and dueDate hasn't passed
 *   'Response Received'              — some response field filled, not yet
 *                                       reviewed (carStatus not yet advanced)
 *   'Under Auditor Review'           — carStatus Verification Pending or
 *                                       Evidence Submitted (and not already
 *                                       covered by the more specific
 *                                       Effectiveness Review Pending case)
 *   'Additional Evidence Required'   — carStatus Ineffective (rejected/needs
 *                                       more evidence)
 *   'Accepted — Implementation Pending' — carStatus Approved or In Progress
 *   'Effectiveness Review Pending'   — capaImplementedDate set, no
 *                                       effectiveness verdict recorded yet
 *   'Closed'                         — status/carStatus Closed, or carStatus
 *                                       Effective
 *   'Overdue'                        — past dueDate, unclosed, and would
 *                                       otherwise be one of the two
 *                                       "awaiting" states above (it never
 *                                       overrides the more specific
 *                                       in-review/implementation states, and
 *                                       never shows before dueDate passes)
 *
 * Presentation logic only — never writes back to ncr.status/carStatus.
 *
 * @param {Object} rec
 * @returns {string}
 */
function capaDisplayStatus(rec) {
    if (!rec) return '';

    const isClosed = rec.status === 'Closed' || rec.carStatus === 'Closed' || rec.carStatus === 'Effective';
    if (isClosed) return 'Closed';

    if (rec.carStatus === 'Ineffective') return 'Additional Evidence Required';

    // "Implemented, awaiting effectiveness" is the more informative read of a
    // record that also usually carries carStatus 'Verification Pending' (see
    // computeAutoCarStatus) — check it before the generic under-review case.
    const effectivenessRecorded = rec.effectiveness === 'Effective' || rec.effectiveness === 'Not Effective';
    if (rec.capaImplementedDate && !effectivenessRecorded) return 'Effectiveness Review Pending';

    if (rec.carStatus === 'Verification Pending' || rec.carStatus === 'Evidence Submitted') return 'Under Auditor Review';

    if (rec.carStatus === 'Approved' || rec.carStatus === 'In Progress') return 'Accepted — Implementation Pending';

    const responseStarted = !!(rec.correction || rec.rootCause || rec.correctiveAction);
    const base = responseStarted ? 'Response Received' : 'Awaiting Auditee Response';

    if (isOverdueNCR(rec)) return 'Overdue';

    return base;
}
window.NCRModule.capaDisplayStatus = capaDisplayStatus;
window.capaDisplayStatus = capaDisplayStatus;

/**
 * Reconcile duplicate NCR/CAPA records without destroying any of them.
 *
 * Rebuilding a checklist used to mint a fresh NCR for a finding that already
 * had one, because the dedupe key embedded checklistId and itemIdx. That left
 * the register — and the report's CAPA table — with two Open records for the
 * same finding.
 *
 * Records are never deleted. Within each group (same CLIENT + clause + finding
 * text) the record that carries the most auditor work is kept, and the rest are
 * marked Withdrawn with a pointer to the survivor, so the full history stays
 * auditable and traceable while only one live action remains.
 *
 * The key is scoped by client, not by audit: the checklist-sync path
 * (execution-module-v2.js) already adopts/merges same-audit duplicates at
 * mint time via its own auditId+clause+text match, so by the time a record
 * reaches this pass, two rows for the same finding necessarily come from
 * *different* audit engagements (e.g. a Major NC re-entered on a later
 * surveillance visit). Keying on auditId — as this function used to — could
 * therefore never find a group; it's excluded here on purpose. Client is the
 * real tenant boundary: two NCRs on the same clause with the same wording for
 * the same client are the same duplicate regardless of which audit raised
 * them.
 *
 * @param {Object} [opts] - { dryRun: true } to report what would change.
 * @returns {{groups:number, superseded:number, kept:number, details:Array}}
 */
window.reconcileDuplicateNCRs = function (opts) {
    const dryRun = !!(opts && opts.dryRun);
    const all = (window.state && window.state.ncrs) || [];
    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();

    // Resolve the tenant boundary for a record. clientId is populated directly
    // on NCR records at creation time — both the manual-entry path
    // (saveNewNCR, above) and the checklist auto-mint path
    // (execution-module-v2.js's exec-sync block) set it, and it round-trips
    // through Supabase as audit_ncrs.client_id (see fetchNCRs/persistNCR
    // above) — so that's the primary, authoritative source. Some legacy rows
    // synced before that column existed may carry only auditId; for those,
    // fall back to the linked audit plan's clientId. A record whose client
    // truly can't be resolved either way is left out of grouping entirely —
    // two unresolved records are not evidence they share a tenant.
    const plans = (window.state && window.state.auditPlans) || [];
    const resolveClientId = (n) => {
        if (n.clientId != null && String(n.clientId) !== '') return String(n.clientId);
        if (n.auditId != null) {
            const plan = plans.find((p) => p && String(p.id) === String(n.auditId));
            if (plan && plan.clientId != null && String(plan.clientId) !== '') return String(plan.clientId);
        }
        return null;
    };

    // How much real work a record carries — the survivor should be the one an
    // auditor has already progressed, not simply the oldest.
    const weight = (n) => (n.correctiveAction ? 4 : 0) + (n.rootCause ? 3 : 0)
        + (n.correction ? 2 : 0) + (n.verifiedDate ? 5 : 0)
        + (norm(n.status) === 'closed' ? 6 : 0) + ((n.evidence || []).length ? 1 : 0);

    const groups = new Map();
    all.forEach((n) => {
        if (!n || isWithdrawnNCR(n) || n._supersededBy) return;
        if (!norm(n.description)) return;          // nothing to match on — leave alone
        const clientKey = resolveClientId(n);
        if (!clientKey) return;                     // unresolvable client — never guess at a tenant match
        // Description is normalized (case-folded, whitespace-collapsed, trimmed)
        // and capped to the same 180-char window the checklist-sync matcher uses
        // (execution-module-v2.js's sameFinding), so trivial text differences
        // don't defeat grouping without loosening the match into fuzzy/stemmed
        // territory that could collapse genuinely distinct findings.
        const key = [clientKey, norm(n.clause), norm(n.description).slice(0, 180)].join('||');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(n);
    });

    const details = [];
    let superseded = 0, kept = 0, dupGroups = 0;

    groups.forEach((recs) => {
        if (recs.length < 2) return;
        dupGroups++;
        recs.sort((a, b) => weight(b) - weight(a)
            || String(a.raisedDate || '').localeCompare(String(b.raisedDate || '')));
        const survivor = recs[0];
        kept++;
        recs.slice(1).forEach((dupe) => {
            details.push({ supersededRef: dupe.ncrNumber || dupe.id, byRef: survivor.ncrNumber || survivor.id, clause: dupe.clause });
            if (dryRun) return;
            dupe.status = 'Withdrawn';
            dupe.carStatus = 'Withdrawn';
            dupe._supersededBy = survivor.ncrNumber || survivor.id || null;
            dupe.withdrawnReason = 'Duplicate of ' + (survivor.ncrNumber || survivor.id || 'the retained record')
                + ' — same finding recorded twice when the checklist was rebuilt. Retained for the audit trail.';
            dupe.withdrawnDate = new Date().toISOString().split('T')[0];
            superseded++;
            if (typeof persistNCR === 'function') persistNCR(dupe).catch(() => { });
        });
    });

    if (!dryRun && superseded > 0) {
        if (window.saveData) window.saveData();
        if (window.showNotification) {
            window.showNotification(superseded + ' duplicate CAPA record(s) superseded — originals retained in the register', 'success');
        }
    }
    return { groups: dupGroups, superseded: dryRun ? details.length : superseded, kept: kept, details: details };
};

/**
 * Find suspected duplicate NCR/CAPA records WITHOUT modifying anything —
 * read-only surfacing for a future cleanup UI. Records are never withdrawn or
 * altered here; use window.reconcileDuplicateNCRs() to actually supersede them,
 * or withdraw individual records by hand (Withdrawn status is the existing
 * supersede convention: set status/carStatus to 'Withdrawn' and optionally
 * point _supersededBy at the record being kept).
 *
 * Grouped by clientId + auditId + clause + severity — a narrower key than
 * reconcileDuplicateNCRs' client+clause+description (which is scoped to
 * assume same-audit dupes are already merged at mint time). This finder
 * intentionally keys ON auditId too and ignores description wording, so it
 * also catches near-identical records within the SAME audit engagement whose
 * descriptions drifted (e.g. reworded by AI-polish before the checklist-sync
 * stable-identity fix) and would otherwise dodge a text-exact match.
 *
 * @returns {Array<{clientId:*, auditId:*, clause:string, severity:string, records:Array}>}
 */
function findDuplicateNCRs() {
    const all = (window.state && window.state.ncrs) || [];
    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim();

    const groups = new Map();
    all.forEach((n) => {
        if (!n || isWithdrawnNCR(n) || n._supersededBy) return;
        if (n.clientId == null || n.auditId == null || !n.clause) return; // nothing reliable to group on
        const key = [String(n.clientId), String(n.auditId), norm(n.clause), norm(n.severity)].join('||');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(n);
    });

    const result = [];
    groups.forEach((records, key) => {
        if (records.length < 2) return;
        const [clientId, auditId, clause, severity] = key.split('||');
        result.push({ clientId, auditId, clause, severity, records });
    });
    return result;
}
window.NCRModule.findDuplicateNCRs = findDuplicateNCRs;
window.findDuplicateNCRs = findDuplicateNCRs;

// --------------------------------------------
// DATA SYNCHRONIZATION (Supabase)
// --------------------------------------------

// Fetch NCRs from Supabase
window.fetchNCRs = async function () {
    if (!window.SupabaseClient) return;

    try {
        const { data, error } = await window.SupabaseClient
            .from('audit_ncrs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // criterionRef/criterionSource/riskLikelihood/riskImpact columns exist since
        // migrations/ADD_NCR_CRITERION_AND_RISK_FIELDS.sql. Records written before
        // that mapping have NULLs in the DB but may hold real values locally, so the
        // local value still wins whenever the row comes back empty.
        const prevById = new Map((window.state.ncrs || []).map(n => [String(n.id), n]));

        // Map DB snake_case to app camelCase
        window.state.ncrs = (data || []).map(row => {
            const mapped = {
                id: row.id,
                clientId: row.client_id,
                auditId: row.audit_id,
                // audit_id is the FK to audit_plans – no separate audit_plan_id column
                level: row.level,
                clientName: row.client_name,
                source: row.source,
                standard: row.standard,
                clause: row.clause,
                severity: row.severity,
                description: row.description,
                raisedBy: row.raised_by,
                raisedDate: row.raised_date,
                dueDate: row.due_date,
                status: row.status,
                correction: row.correction,
                correctionDate: row.correction_date,
                rootCause: row.root_cause,
                correctiveAction: row.corrective_action,
                capaResponsible: row.capa_responsible,
                capaImplementedDate: row.capa_implemented_date,
                verificationMethod: row.verification_method,
                verifiedBy: row.verified_by,
                verifiedDate: row.verified_date,
                effectiveness: row.effectiveness,
                carStatus: row.car_status,
                criterionRef: row.criterion_ref,
                criterionSource: row.criterion_source,
                riskLikelihood: row.risk_likelihood,
                riskImpact: row.risk_impact,
                // sourceChecklistId/sourceItemIdx (execution-module-v2.js's checklist
                // sync dedupe identity) have no DB column yet — same "awaiting
                // migration" situation criterionRef/criterionSource were in before
                // ADD_NCR_CRITERION_AND_RISK_FIELDS.sql landed. row.source_checklist_id
                // is simply undefined until that migration exists, so the merge below
                // always falls back to the local value within the session.
                sourceChecklistId: row.source_checklist_id != null ? row.source_checklist_id : null,
                sourceItemIdx: row.source_item_idx != null ? row.source_item_idx : null,
                evidence: row.evidence || []
            };
            const prev = prevById.get(String(row.id));
            if (prev) {
                if (mapped.criterionRef == null && prev.criterionRef !== undefined) mapped.criterionRef = prev.criterionRef;
                if (mapped.criterionSource == null && prev.criterionSource !== undefined) mapped.criterionSource = prev.criterionSource;
                if (mapped.riskLikelihood == null && prev.riskLikelihood !== undefined) mapped.riskLikelihood = prev.riskLikelihood;
                if (mapped.riskImpact == null && prev.riskImpact !== undefined) mapped.riskImpact = prev.riskImpact;
                if (mapped.sourceChecklistId == null && prev.sourceChecklistId != null) mapped.sourceChecklistId = prev.sourceChecklistId;
                if (mapped.sourceItemIdx == null && prev.sourceItemIdx != null) mapped.sourceItemIdx = prev.sourceItemIdx;
                // _sourceKey (execution-module-v2.js's checklist-sync dedupe key) has
                // NO db column at all and was previously dropped on every single
                // refetch — persistNCR() calls fetchNCRs() after every create/update,
                // which used to rebuild window.state.ncrs purely from `mapped` here,
                // silently erasing _sourceKey from EVERY record on the very first
                // save. The next checklist sync would then find no _sourceKey match
                // for ANY record and fall through to the fragile exact-text
                // description match — which breaks as soon as a finding's wording
                // changes even slightly (AI-polish or a manual edit) — minting a
                // fresh duplicate NCR. Preserving it locally the same way as the
                // fields above closes that hole.
                if (prev._sourceKey) mapped._sourceKey = prev._sourceKey;
            }
            return mapped;
        });

        updateNCRAnalytics();

        // Refresh view if active
        if (document.getElementById('ncr-content') || window.contentArea.innerHTML.includes('Loading NCRs')) {
            renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        }

    } catch (err) {
        console.error('Error fetching NCRs:', err);
        // Fallback to empty or local cache if we had one
    }
};

// Persist Insert or Update to Supabase
async function persistNCR(ncr) {
    if (!window.SupabaseClient) return;

    // Helper: coerce empty/falsy to null for DATE and FK columns
    const toNullable = (v) => (v === '' || v === undefined || v === null) ? null : v;

    const dbPayload = {
        client_id: toNullable(ncr.clientId),
        audit_id: toNullable(ncr.auditId),           // FK → audit_plans(id)
        level: ncr.level,
        client_name: ncr.clientName,
        source: ncr.source,
        standard: ncr.standard,
        clause: ncr.clause,
        severity: ncr.severity,
        description: ncr.description,
        raised_by: ncr.raisedBy,
        raised_date: toNullable(ncr.raisedDate),      // DATE column
        due_date: toNullable(ncr.dueDate),             // DATE column
        status: ncr.status,
        correction: ncr.correction,
        correction_date: toNullable(ncr.correctionDate), // DATE column
        root_cause: ncr.rootCause,
        corrective_action: ncr.correctiveAction,
        capa_responsible: ncr.capaResponsible,
        capa_implemented_date: toNullable(ncr.capaImplementedDate), // DATE column
        verification_method: ncr.verificationMethod,
        verified_by: ncr.verifiedBy,
        verified_date: toNullable(ncr.verifiedDate),   // DATE column
        effectiveness: ncr.effectiveness,
        car_status: ncr.carStatus || null,
        criterion_ref: ncr.criterionRef || null,
        criterion_source: ncr.criterionSource || null,
        risk_likelihood: ncr.riskLikelihood != null ? ncr.riskLikelihood : null,
        risk_impact: ncr.riskImpact != null ? ncr.riskImpact : null,
        evidence: ncr.evidence || []
    };

    try {
        if (ncr.id) {
            // Update
            const { error } = await window.SupabaseClient
                .from('audit_ncrs')
                .update(dbPayload)
                .eq('id', ncr.id);
            if (error) throw error;
        } else {
            // Insert
            const { data, error } = await window.SupabaseClient
                .from('audit_ncrs')
                .insert(dbPayload)
                .select();
            if (error) throw error;
            if (data && data[0]) ncr.id = data[0].id; // Assign the new DB ID
        }

        // Refresh local state and UI
        await window.fetchNCRs();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);

    } catch (error) {
        console.error('Failed to sync NCR:', error);
        window.showNotification('Failed to sync NCR changes to database: ' + error.message, 'error');
    }
}

// --------------------------------------------
// AUDIT PLAN HELPERS FOR NCR LINKING
// --------------------------------------------

// Get audit plan options for a specific client
window.getNCRAuditPlanOptions = function (clientId) {
    if (!clientId) return '';

    const client = window.DataService.findClient(clientId);
    const clientName = client ? client.name : '';

    const plans = (window.state.auditPlans || []).filter(p =>
        String(p.clientId) === String(clientId) || p.client === clientName
    );

    if (plans.length === 0) {
        return '<option value="" disabled>No audit plans found for this client</option>';
    }

    return plans.map(p =>
        `<option value="${p.id}">${window.UTILS.escapeHtml(p.auditType || p.type || 'Audit')} - ${window.UTILS.escapeHtml(p.date || 'No date')} (${window.UTILS.escapeHtml(p.status || 'Draft')})</option>`
    ).join('');
};

// Update audit plan dropdown when client changes
window.updateNCRAuditPlanOptions = function () {
    const clientId = document.getElementById('ncr-client')?.value;
    const planSelect = document.getElementById('ncr-audit-plan');

    if (!planSelect) return;

    planSelect.innerHTML = '<option value="">Select Audit Plan...</option>' + window.getNCRAuditPlanOptions(clientId);
};

// --------------------------------------------
// MAIN RENDER FUNCTION
// --------------------------------------------

function renderNCRCAPAModule(clientId) {
    // Determine context
    window.state.ncrContextClientId = clientId || null;

    // Auto-fetch if empty and Supabase is available
    if (window.state.ncrs.length === 0 && window.SupabaseClient) {
        // Show loading state
        window.contentArea.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading NCRs...</div>';
        // Fetch and re-render
        window.fetchNCRs().then(() => {
            // Guard against a stale/late-resolving fetch clobbering whatever the
            // user is now actually looking at. Two renders can race: e.g. the
            // global "NCR & CAPA" view (clientId undefined) kicks off a fetch,
            // then the user quickly navigates into a client workspace (which sets
            // ncrContextClientId and starts its OWN fetch) before the first fetch
            // resolves — the global fetch's callback would otherwise fire last,
            // reset ncrContextClientId back to null, and silently replace the
            // client-scoped table with the unfiltered, all-clients register. It
            // can also fire after the user has since moved to an unrelated tab
            // (e.g. Plans & Audits) within the SAME client, blowing away that
            // page's content with the NCR table — so check both the client
            // context AND that the ncr-capa route is still the active view.
            const sameClientContext = String(window.state.ncrContextClientId || '') === String(clientId || '');
            const expectedHash = clientId ? `client/${clientId}/ncr-capa` : 'ncr-capa';
            const stillOnNCRRoute = (window.location.hash || '').replace(/^#/, '').split('?')[0] === expectedHash;
            if (!sameClientContext || !stillOnNCRRoute) return;
            // After fetch completes, render the module
            renderNCRCAPAModuleContent(clientId);
        });
        return;
    }

    // Render normally if we have data or no Supabase
    renderNCRCAPAModuleContent(clientId);
}

function renderNCRCAPAModuleContent(clientId) {
    window.state.ncrContextClientId = clientId || null;

    const html = `
        <div class="fade-in">
            <div class="card" style="margin-bottom: 2rem;">
                <!-- Internal Navigation Tabs -->
                <div class="tab-container" style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                    <button class="tab-btn active" data-action="switchNCRTab" data-arg1="register" data-arg2="this">NCR Register</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="ofi-obs" data-arg2="this">OFI / OBS</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="capa" data-arg2="this">CAPA Tracker</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="verification" data-arg2="this">Verification</button>
                    <button class="tab-btn" data-action="switchNCRTab" data-arg1="analytics" data-arg2="this">Analytics</button>
                </div>

                <div id="ncr-content">
                    ${getNCRRegisterHTML()}
                </div>
            </div>
        </div>
    `;
    window.contentArea.innerHTML = html;
    updateNCRAnalytics();
}

function switchNCRTab(tabName, btnElement) {
    document.querySelectorAll('#ncr-content ~ .tab-btn, .tab-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const container = document.getElementById('ncr-content');
    if (!container) return;

    switch (tabName) {
        case 'register': container.innerHTML = getNCRRegisterHTML(); break;
        case 'ofi-obs': container.innerHTML = getOFIOBSHTML(); break;
        case 'capa': container.innerHTML = getCAPATrackerHTML(); break;
        case 'verification': container.innerHTML = getVerificationHTML(); break;
        case 'analytics':
            container.innerHTML = getAnalyticsHTML();
            requestAnimationFrame(() => { if (typeof initNCRAnalyticsCharts === 'function') initNCRAnalyticsCharts(); });
            break;
    }
}

// --------------------------------------------
// TAB 1: NCR REGISTER
// --------------------------------------------

function getNCRRegisterHTML() {
    let ncrs = window.state.ncrs || [];

    // Filter by Context (if viewing a specific client)
    if (window.state.ncrContextClientId) {
        // ID comparison: Robust string comparison
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    // Default register view excludes Withdrawn records (still inspectable via the
    // Status filter dropdown, which offers an explicit "Withdrawn" option).
    ncrs = ncrs.filter(n => !isWithdrawnNCR(n));

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-clipboard-list" style="margin-right: 0.5rem;"></i>
                    NCR Register
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" data-action="printNCRRegister" aria-label="Print">
                        <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i>
                        Print Register
                    </button>
                    <button class="btn btn-primary" data-action="openNewNCRModal" aria-label="Add">
                        <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i>
                        New NCR
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="card" style="background: #f8fafc; padding: 1rem; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Level</label>
                        <select class="form-control" id="filter-level" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
                            <option value="client">Client</option>
                            <option value="cb-internal">Internal</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Severity</label>
                        <select class="form-control" id="filter-severity" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Observation">Observation</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Status</label>
                        <select class="form-control" id="filter-status" data-action-change="filterNCRs" style="font-size: 0.9rem;">
                            <option value="all">All</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Verification">Verification</option>
                            <option value="Closed">Closed</option>
                            <option value="Withdrawn">Withdrawn</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.85rem; margin-bottom: 0.3rem;">Search</label>
                        <input type="text" class="form-control" id="filter-search" placeholder="Search..." onkeyup="filterNCRs()" style="font-size: 0.9rem;">
                    </div>
                </div>
            </div>

            <!-- NCR Table -->
            <div class="table-container" id="ncr-table-container">
                ${renderNCRTable(ncrs)}
            </div>
        </div>
    `;
}

function renderNCRTable(ncrs) {
    if (ncrs.length === 0) {
        return `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No NCRs found.</p>`;
    }

    const today = new Date();

    return `
        <table>
            <thead>
                <tr>
                    <th>NCR#</th>
                    <th>Level</th>
                    <th>Client</th>
                    <th>Clause</th>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${ncrs.map(ncr => {
        const hasDueDate = !!ncr.dueDate;
        const dueDate = hasDueDate ? new Date(ncr.dueDate) : null;
        // Missing due date is never "overdue" — it's flagged separately below.
        const isOverdue = hasDueDate && ncr.status !== 'Closed' && !isWithdrawnNCR(ncr) && dueDate < today;
        const daysDiff = hasDueDate ? Math.floor((dueDate - today) / (1000 * 60 * 60 * 24)) : null;

        return `
                        <tr style="${isOverdue ? 'background: #fef2f2;' : ''}">
                            <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                            <td>
                                <span class="badge" style="background: ${ncr.level === 'client' ? '#0284c7' : '#7c3aed'}; color: white; font-size: 0.75rem;">
                                    ${ncr.level === 'client' ? 'Client' : 'Internal'}
                                </span>
                            </td>
                            <td>${window.UTILS.escapeHtml(ncr.clientName || 'N/A')}</td>
                            <td>${renderClauseCell(ncr)}</td>
                            <td>
                                <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : ncr.severity === 'Minor' ? '#f59e0b' : '#3b82f6'}; color: white;">
                                    ${ncr.severity}
                                </span>
                            </td>
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${window.UTILS.escapeHtml(ncr.description || '')}
                            </td>
                            <td>
                                ${hasDueDate ? window.UTILS.formatDate(ncr.dueDate) : '-'}
                                ${!hasDueDate ? '<br><span style="color: #6b7280; font-size: 0.75rem; font-weight: bold;">No due date</span>' :
                isOverdue ? '<br><span style="color: #dc2626; font-size: 0.75rem; font-weight: bold;">⚠️ OVERDUE</span>' :
                    daysDiff <= 7 && ncr.status !== 'Closed' ? '<br><span style="color: #f59e0b; font-size: 0.75rem;">⏰ Due Soon</span>' : ''}
                            </td>
                            <td>
                                <span class="badge" style="background: ${ncr.status === 'Closed' ? '#059669' :
                ncr.status === 'Verification' ? '#0284c7' :
                    ncr.status === 'In Progress' ? '#f59e0b' : '#6b7280'
            }; color: white;">
                                    ${ncr.status}
                                </span>
                            </td>
                            <td style="white-space: nowrap;">
                                <button class="btn btn-sm btn-icon" data-action="viewNCRDetails" data-id="${ncr.id}" title="View Details" aria-label="View">
                                    <i class="fa-solid fa-eye" style="color: var(--primary-color);"></i>
                                </button>
                                <button class="btn btn-sm btn-icon" data-action="editNCR" data-id="${ncr.id}" title="Edit" aria-label="Edit">
                                    <i class="fa-solid fa-edit" style="color: var(--primary-color);"></i>
                                </button>
                                <button class="btn btn-sm btn-icon" data-action="deleteNCR" data-id="${ncr.id}" title="Delete" aria-label="Delete">
                                    <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
                                </button>
                                ${ncr.status === 'Open' || ncr.carStatus === 'Ineffective' || ncr.carStatus === 'Reopened' ? `
                                <button class="btn btn-sm" style="background: #10b981; color: white; margin-left: 0.25rem;" data-action="openAddCAPAModal" data-id="${ncr.id}" title="Add CAPA" aria-label="Add">
                                    <i class="fa-solid fa-plus" style="margin-right: 0.25rem;"></i>CAPA
                                </button>` : ''}
                                ${(ncr.status === 'In Progress' || ncr.status === 'Verification') && ncr.capaImplementedDate ? `
                                <button class="btn btn-sm" style="background: #3b82f6; color: white; margin-left: 0.25rem;" data-action="verifyCAPA" data-id="${ncr.id}" title="Verify CAPA" aria-label="Confirm">
                                    <i class="fa-solid fa-check"></i> Verify
                                </button>` : ''}
                            </td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// eslint-disable-next-line no-unused-vars
function filterNCRs() {
    const level = document.getElementById('filter-level').value;
    const severity = document.getElementById('filter-severity').value;
    const status = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();

    let ncrs = window.state.ncrs || [];

    // Always apply context filter first
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    let filtered = ncrs.filter(ncr => {
        // Withdrawn records are hidden from the default ("all") view — they're
        // still inspectable by explicitly selecting the "Withdrawn" status filter.
        if (status === 'all' && isWithdrawnNCR(ncr)) return false;
        if (level !== 'all' && ncr.level !== level) return false;
        if (severity !== 'all' && ncr.severity !== severity) return false;
        if (status !== 'all' && ncr.status !== status) return false;
        if (search) {
            const match = (ncr.description || '').toLowerCase().includes(search) ||
                (ncr.clause || '').toLowerCase().includes(search) ||
                (ncr.clientName || '').toLowerCase().includes(search);
            if (!match) return false;
        }
        return true;
    });

    document.getElementById('ncr-table-container').innerHTML = renderNCRTable(filtered);
}

// --------------------------------------------
// TAB 2: OFI / OBS (Read-Only Tracking)
// Surfaces Observations & Opportunities for
// Improvement from audit execution checklists.
// These are NOT NCRs — no CAPA required.
// --------------------------------------------

function getOFIOBSHTML() {
    const reports = window.state.auditReports || [];
    const clientId = window.state.ncrContextClientId;

    // Collect all OFI/OBS from checklist progress across reports
    const findings = [];

    reports.forEach(report => {
        // Context filter: only show findings for the active client
        if (clientId) {
            const reportClientId = report.clientId || report.client_id;
            const client = (window.state.clients || []).find(c => c.name === report.client);
            const matchesId = String(reportClientId) === String(clientId);
            const matchesName = client && String(client.id) === String(clientId);
            if (!matchesId && !matchesName) return;
        }

        const progress = report.checklistProgress || [];
        progress.forEach(item => {
            if (item.status !== 'nc') return;
            const t = (item.ncrType || '').toLowerCase();
            if (t !== 'observation' && t !== 'ofi') return;

            // Resolve clause text from checklist
            let clauseText = item.clause || '';
            let reqText = item.requirement || '';
            if (!clauseText && item.checklistId) {
                const checklists = window.state.checklists || [];
                const cl = checklists.find(c => String(c.id) === String(item.checklistId));
                if (cl && cl.items && cl.items[item.itemIdx]) {
                    clauseText = cl.items[item.itemIdx].clause || '';
                    reqText = reqText || cl.items[item.itemIdx].requirement || '';
                }
            }

            findings.push({
                type: t === 'ofi' ? 'OFI' : 'OBS',
                clause: clauseText,
                criterionRef: item.criterionRef || null,
                description: item.ncrDescription || item.comment || reqText || '',
                client: report.client || '',
                auditDate: report.date || '',
                standard: report.standard || '',
                reportId: report.id
            });
        });

        // Also collect from report.findings[] (manually added findings)
        const manualFindings = report.findings || [];
        manualFindings.forEach(f => {
            const t = (f.type || '').toLowerCase();
            if (t !== 'observation' && t !== 'ofi') return;

            findings.push({
                type: t === 'ofi' ? 'OFI' : 'OBS',
                clause: f.clause || '',
                criterionRef: f.criterionRef || null,
                description: f.description || '',
                client: report.client || '',
                auditDate: report.date || '',
                standard: report.standard || '',
                reportId: report.id
            });
        });
    });

    const obsCount = findings.filter(f => f.type === 'OBS').length;
    const ofiCount = findings.filter(f => f.type === 'OFI').length;

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-lightbulb" style="margin-right: 0.5rem;"></i>
                    Observations & Opportunities for Improvement
                </h3>
            </div>

            <!-- KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 1.25rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold;">${findings.length}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Total Findings</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #8b5cf6 0%, #c4b5fd 100%); color: white; padding: 1.25rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold;">${obsCount}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Observations (OBS)</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #0891b2 0%, #67e8f9 100%); color: white; padding: 1.25rem; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold;">${ofiCount}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Opportunities (OFI)</div>
                </div>
            </div>

            <div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1.5rem; font-size: 0.85rem; color: #166534;">
                <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                OFI/OBS findings are informational — they highlight good practices or areas for improvement but do not require corrective action.
            </div>

            ${findings.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No OFI/OBS findings recorded across audits.</p>' : `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Clause</th>
                            <th>Description</th>
                            <th>Client</th>
                            <th>Audit Date</th>
                            <th>Standard</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${findings.map(f => `
                            <tr>
                                <td>
                                    <span class="badge" style="background: ${f.type === 'OFI' ? '#0891b2' : '#7c3aed'}; color: white; font-size: 0.75rem;">
                                        ${f.type}
                                    </span>
                                </td>
                                <td>${renderClauseCell(f)}</td>
                                <td style="max-width: 350px;">${window.UTILS.escapeHtml(f.description || '-')}</td>
                                <td>${window.UTILS.escapeHtml(f.client)}</td>
                                <td>${window.UTILS.formatDate(f.auditDate)}</td>
                                <td>${window.UTILS.escapeHtml(f.standard || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    `;
}

// --------------------------------------------
// TAB 3: CAPA TRACKER
// --------------------------------------------


function getCAPATrackerHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    // CAPA Tracker is a default list view — Withdrawn NCRs no longer require action.
    ncrs = ncrs.filter(n => !isWithdrawnNCR(n));

    const showClosed = window.state.showClosedCAPAs || false;
    if (!showClosed) {
        ncrs = ncrs.filter(n => n.status !== 'Closed');
    }

    if (ncrs.length === 0) return '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No active CAPAs found.</p>';

    return `
        <div class="fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--primary-color); margin: 0;">
                    <i class="fa-solid fa-tasks" style="margin-right: 0.5rem;"></i>
                    CAPA Tracker
                </h3>
                <label style="font-size: 0.9rem; user-select: none; cursor: pointer;">
                    <input type="checkbox" data-action-change="toggleClosedCAPAs" ${showClosed ? 'checked' : ''}>
                    Show Closed Items
                </label>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>NCR#</th>
                            <th>Client</th>
                            <th>Severity</th>
                            <th>Root Cause</th>
                            <th>Corrective Action</th>
                            <th>Responsible</th>
                            <th>Target Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ncrs.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName || '')}</td>
                                <td>
                                    <span class="badge" style="background: ${ncr.severity === 'Major' ? '#dc2626' : '#f59e0b'}; color: white;">
                                        ${ncr.severity}
                                    </span>
                                </td>
                                <td style="max-width: 200px;">${window.UTILS.escapeHtml(ncr.rootCause || 'Pending analysis')}</td>
                                <td style="max-width: 250px;">${window.UTILS.escapeHtml(ncr.correctiveAction || 'Not yet defined')}</td>
                                <td>${window.UTILS.escapeHtml(ncr.capaResponsible || 'Not assigned')}</td>
                                <td>${ncr.dueDate ? window.UTILS.formatDate(ncr.dueDate) : '-'}</td>
                                <td>
                                    <button class="btn btn-sm" data-action="updateCAPAProgress" data-id="${ncr.id}" aria-label="Edit">
                                        <i class="fa-solid fa-edit"></i> Update
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// --------------------------------------------
// TAB 3: VERIFICATION
// --------------------------------------------

function getVerificationHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }

    // Filter for items ready for verification (Withdrawn records never need verification)
    const pendingReview = ncrs.filter(n => !isWithdrawnNCR(n) &&
        (n.status === 'Verification' || (n.capaImplementedDate && !n.verifiedDate && n.status === 'In Progress')));

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i>
                CAPA Verification Pending
            </h3>

            ${pendingReview.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No CAPAs pending verification</p>' : `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>NCR#</th>
                            <th>Client</th>
                            <th>Corrective Action</th>
                            <th>Implemented Date</th>
                            <th>Verification Method</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingReview.map(ncr => `
                            <tr>
                                <td><strong>NCR-${String(ncr.id).padStart(3, '0')}</strong></td>
                                <td>${window.UTILS.escapeHtml(ncr.clientName || '')}</td>
                                <td style="max-width: 300px;">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</td>
                                <td>${ncr.capaImplementedDate ? window.UTILS.formatDate(ncr.capaImplementedDate) : 'Not yet implemented'}</td>
                                <td>${window.UTILS.escapeHtml(ncr.verificationMethod || '')}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" data-action="verifyCAPA" data-id="${ncr.id}" aria-label="Confirm">
                                        <i class="fa-solid fa-check"></i> Verify
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    `;
}

// --------------------------------------------
// TAB 4: ANALYTICS
// --------------------------------------------

function getAnalyticsHTML() {
    let ncrs = window.state.ncrs || [];
    if (window.state.ncrContextClientId) {
        ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
    }
    // Analytics exclude Withdrawn NCRs entirely
    ncrs = ncrs.filter(n => !isWithdrawnNCR(n));

    const total = ncrs.length;
    const open = ncrs.filter(n => n.status === 'Open').length;
    const inProgress = ncrs.filter(n => n.status === 'In Progress').length;
    const verification = ncrs.filter(n => n.status === 'Verification').length;
    const closed = ncrs.filter(n => n.status === 'Closed').length;
    const today = new Date();
    // Overdue uses dueDate strictly — missing due dates never count as overdue
    const overdue = ncrs.filter(n => n.status !== 'Closed' && n.dueDate && new Date(n.dueDate) < today).length;
    const effective = ncrs.filter(n => n.effectiveness === 'Effective').length;
    const effectivenessRate = closed > 0 ? Math.round((effective / closed) * 100) : 0;

    // Severity Breakdown
    const _major = ncrs.filter(n => (n.severity || '').toLowerCase() === 'major').length;
    const _minor = ncrs.filter(n => (n.severity || '').toLowerCase() === 'minor').length;
    const _obs = ncrs.filter(n => {
        const s = (n.severity || '').toLowerCase();
        return s === 'observation' || s === 'ofi' || s === 'observation/ofi';
    }).length;

    // Top clauses
    const clauseMap = {};
    ncrs.forEach(n => {
        const c = n.clause || 'Unspecified';
        clauseMap[c] = (clauseMap[c] || 0) + 1;
    });
    const topClauses = Object.entries(clauseMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Avg resolution time
    const resolvedNCRs = ncrs.filter(n => n.status === 'Closed' && n.raisedDate && n.verifiedDate);
    let avgDays = 0;
    if (resolvedNCRs.length > 0) {
        const totalDays = resolvedNCRs.reduce((sum, n) => {
            return sum + Math.max(0, Math.ceil((new Date(n.verifiedDate) - new Date(n.raisedDate)) / (1000 * 60 * 60 * 24)));
        }, 0);
        avgDays = Math.round(totalDays / resolvedNCRs.length);
    }

    return `
        <div class="fade-in">
            <h3 style="margin-bottom: 1.5rem; color: var(--primary-color);">
                <i class="fa-solid fa-chart-line" style="margin-right: 0.5rem;"></i>
                NCR & CAPA Analytics
            </h3>

            <!-- KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${total}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Total NCRs</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${open}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Open</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${overdue}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Overdue</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 1.25rem; text-align:center;">
                    <div style="font-size: 2rem; font-weight: bold;">${closed}</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">Closed</div>
                </div>
                <div class="card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 1.25rem; text-align:center;">
                    ${closed > 0 ? `
                    <div style="font-size: 2rem; font-weight: bold;">${effectivenessRate}%</div>
                    <div style="opacity: 0.9; font-size: 0.85rem;">CAPA Effective</div>
                    ` : `
                    <div style="font-size: 1rem; font-weight: 700; line-height: 1.3;">Not yet available</div>
                    <div style="opacity: 0.9; font-size: 0.75rem; margin-top: 0.25rem;">no closed CAPAs</div>
                    `}
                </div>
            </div>

            <!-- Charts Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Severity Distribution Doughnut -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-pie" style="color: #dc2626; margin-right: 0.5rem;"></i>Severity Distribution</h4>
                    <div style="position: relative; height: 250px;">
                        <canvas id="ncr-severity-chart"></canvas>
                    </div>
                </div>
                <!-- Status Pipeline Bar -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-filter" style="color: #2563eb; margin-right: 0.5rem;"></i>Status Pipeline</h4>
                    <div style="position: relative; height: 250px;">
                        <canvas id="ncr-status-chart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Bottom Row: Top Clauses + Resolution Stats -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <!-- Top Non-Conforming Clauses -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-ranking-star" style="color: #7c3aed; margin-right: 0.5rem;"></i>Top Non-Conforming Clauses</h4>
                    ${topClauses.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${topClauses.map(([clause, count], i) => `
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="min-width: 28px; height: 28px; background: linear-gradient(135deg, #7c3aed, #a78bfa); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.8rem;">${i + 1}</div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 0.9rem;">${window.UTILS.escapeHtml(clause)}</div>
                                        <div style="background: #f1f5f9; border-radius: 4px; height: 8px; margin-top: 4px;">
                                            <div style="background: linear-gradient(90deg, #7c3aed, #a78bfa); height: 100%; border-radius: 4px; width: ${total > 0 ? Math.round((count / total) * 100) : 0}%;"></div>
                                        </div>
                                    </div>
                                    <div style="font-weight: 700; color: #7c3aed; font-size: 0.9rem;">${count}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="text-align: center; color: var(--text-secondary);">No data available</p>'}
                </div>
                <!-- Resolution Stats -->
                <div class="card" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;"><i class="fa-solid fa-clock" style="color: #059669; margin-right: 0.5rem;"></i>Resolution Statistics</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div style="text-align: center; padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${avgDays}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Avg Days to Close</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #eff6ff; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #2563eb;">${inProgress}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">In Progress</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #faf5ff; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #7c3aed;">${verification}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">Pending Verification</div>
                        </div>
                        <div style="text-align: center; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                            ${closed > 0 ? `
                            <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${effectivenessRate}%</div>
                            <div style="font-size: 0.8rem; color: #64748b;">CAPA Effective Rate</div>
                            ` : `
                            <div style="font-size: 0.85rem; font-weight: 700; color: #d97706;">Not yet available</div>
                            <div style="font-size: 0.75rem; color: #64748b;">no closed CAPAs</div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Initialize NCR Analytics Charts after DOM render
function initNCRAnalyticsCharts() {
    // Severity Distribution Doughnut
    const sevCtx = document.getElementById('ncr-severity-chart');
    if (sevCtx) {
        const existing = Chart.getChart(sevCtx);
        if (existing) existing.destroy();

        let ncrs = window.state.ncrs || [];
        if (window.state.ncrContextClientId) {
            ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
        }
        ncrs = ncrs.filter(n => !isWithdrawnNCR(n));
        const major = ncrs.filter(n => (n.severity || '').toLowerCase() === 'major').length;
        const minor = ncrs.filter(n => (n.severity || '').toLowerCase() === 'minor').length;
        const obs = ncrs.filter(n => {
            const s = (n.severity || '').toLowerCase();
            return s === 'observation' || s === 'ofi' || s === 'observation/ofi';
        }).length;

        new Chart(sevCtx, {
            type: 'doughnut',
            data: {
                labels: ['Major', 'Minor', 'Observation/OFI'],
                datasets: [{
                    data: [major || 0, minor || 0, obs || 0],
                    backgroundColor: ['#dc2626', '#f59e0b', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Status Pipeline Bar
    const statusCtx = document.getElementById('ncr-status-chart');
    if (statusCtx) {
        const existing = Chart.getChart(statusCtx);
        if (existing) existing.destroy();

        let ncrs = window.state.ncrs || [];
        if (window.state.ncrContextClientId) {
            ncrs = ncrs.filter(n => String(n.clientId) === String(window.state.ncrContextClientId));
        }
        ncrs = ncrs.filter(n => !isWithdrawnNCR(n));
        const open = ncrs.filter(n => n.status === 'Open').length;
        const inProg = ncrs.filter(n => n.status === 'In Progress').length;
        const verif = ncrs.filter(n => n.status === 'Verification').length;
        const closed = ncrs.filter(n => n.status === 'Closed').length;

        new Chart(statusCtx, {
            type: 'bar',
            data: {
                labels: ['Open', 'In Progress', 'Verification', 'Closed'],
                datasets: [{
                    label: 'NCRs',
                    data: [open, inProg, verif, closed],
                    backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                }
            }
        });
    }
}
window.initNCRAnalyticsCharts = initNCRAnalyticsCharts;

// --------------------------------------------
// MODAL & FORM FUNCTIONS
// --------------------------------------------

function updateNCRAnalytics() {
    // KPI/analytics counts exclude Withdrawn NCRs entirely
    const ncrs = (window.state.ncrs || []).filter(n => !isWithdrawnNCR(n));
    const today = new Date();

    window.state.capaAnalytics = {
        totalNCRs: ncrs.length,
        openNCRs: ncrs.filter(n => n.status !== 'Closed').length,
        // Overdue uses dueDate strictly — missing due dates never count as overdue
        overdueNCRs: ncrs.filter(n => n.status !== 'Closed' && n.dueDate && new Date(n.dueDate) < today).length,
        effectivenessRate: ncrs.length > 0 ? Math.round((ncrs.filter(n => n.effectiveness === 'Effective').length / ncrs.length) * 100) : 0,
    };
}

// CREATE NEW NEW MODAL
window.openNewNCRModal = function () {
    const contextClientId = window.state.ncrContextClientId || window.state.activeClientId;

    document.getElementById('modal-title').textContent = 'Create New NCR';
    document.getElementById('modal-body').innerHTML = `
        <form id="ncr-form">
            <div class="form-group">
                <label>Client <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-client" required ${contextClientId ? 'disabled' : ''} data-action-change="updateNCRAuditPlanOptions">
                    <option value="">Select Client...</option>
                    ${window.state.clients.map(c => `<option value="${c.id}" ${String(c.id) === String(contextClientId) ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                </select>
                <small style="color: var(--text-secondary);">For CB internal NCRs, select your internal audit client</small>
            </div>
            <div class="form-group" id="audit-plan-select-group">
                <label>Audit Plan <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-audit-plan" required>
                    <option value="">Select Audit Plan...</option>
                    ${window.getNCRAuditPlanOptions(contextClientId)}
                </select>
                <small style="color: var(--text-secondary);">Link this NCR to a specific audit</small>
            </div>
            <div class="form-group">
                <label>Source <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-source" required>
                    <option value="Stage 1 Audit">Stage 1 Audit</option>
                    <option value="Stage 2 Audit">Stage 2 Audit</option>
                    <option value="Surveillance Audit">Surveillance Audit</option>
                    <option value="Recertification Audit">Recertification Audit</option>
                    <option value="Internal Audit">Internal Audit</option>
                    <option value="Management Review">Management Review</option>
                    <option value="AB Surveillance">AB Surveillance</option>
                </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Standard <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="ncr-standard" placeholder="e.g., ISO 9001:2015" required>
                </div>
                <div class="form-group">
                    <label>Clause <span style="color: var(--danger-color);">*</span></label>
                    <input type="text" class="form-control" id="ncr-clause" placeholder="e.g., 8.5.2" required>
                </div>
            </div>
            <div class="form-group">
                <label>Severity <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-severity" required>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                    <option value="Observation">Observation/OFI</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="ncr-description" rows="3" required></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Raised By</label>
                    <input type="text" class="form-control" id="ncr-raised-by" value="${window.state.currentUser?.name || 'Auditor'}">
                </div>
                <div class="form-group">
                    <label>Due Date <span style="color: var(--danger-color);">*</span></label>
                    <input type="date" class="form-control" id="ncr-due-date" required>
                </div>
            </div>
        </form>
    `;

    // Logic for Due Date
    document.getElementById('ncr-severity').addEventListener('change', function () {
        const severity = this.value;
        const today = new Date();
        const dueDate = new Date(today);
        if (severity === 'Major') dueDate.setDate(today.getDate() + 90); // 90 days default
        else if (severity === 'Minor') dueDate.setDate(today.getDate() + 30); // 30 days default
        // Observation might not have due date, but we'll set 30 for now

        document.getElementById('ncr-due-date').value = dueDate.toISOString().split('T')[0];
    });
    // Trigger
    document.getElementById('ncr-severity').dispatchEvent(new Event('change'));

    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = saveNewNCR;
    window.openModal();
};

async function saveNewNCR() {
    const clientId = document.getElementById('ncr-client').value;
    const client = window.DataService.findClient(clientId);
    const clientName = client ? client.name : 'Unknown';

    const ncrData = {
        level: 'client', // All NCRs are now client-based (including CB internal via internal client)
        clientId: clientId,
        clientName: clientName,
        auditId: document.getElementById('ncr-audit-plan')?.value || null, // FK → audit_plans(id)
        source: document.getElementById('ncr-source').value,
        standard: document.getElementById('ncr-standard').value,
        clause: document.getElementById('ncr-clause').value,
        severity: document.getElementById('ncr-severity').value,
        description: document.getElementById('ncr-description').value,
        raisedBy: document.getElementById('ncr-raised-by').value,
        raisedDate: new Date().toISOString().split('T')[0],
        dueDate: document.getElementById('ncr-due-date').value,
        status: 'Open',
        evidence: []
    };

    await persistNCR(ncrData);
    window.closeModal();
    window.showNotification('NCR Created Successfully', 'success');
}

// ... VIEW DETAILS, EDIT, CAPA (Assuming similar logic structure but mapped key names) ...
// Since the file is huge, I am keeping the other helper functions (viewNCRDetails, updateCAPAProgress, verifyCAPA)
// conceptually same but won't re-write entire file if they are just reading from window.state.ncrs.
// HOWEVER, updateCAPAProgress and verifyCAPA call persistNCR, which I fixed above.
// EDIT NCR needs to be checked.

window.viewNCRDetails = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = `NCR Details`;
    document.getElementById('modal-body').innerHTML = `
        <div style="padding: 1rem;">
            <h4>${window.UTILS.escapeHtml(ncr.description)}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div><strong>Standard:</strong> ${window.UTILS.escapeHtml(ncr.standard)}</div>
                <div><strong>Clause:</strong> ${window.UTILS.escapeHtml(ncr.clause)}</div>
                <div><strong>Severity:</strong> ${window.UTILS.escapeHtml(ncr.severity)}</div>
                <div><strong>Status:</strong> ${window.UTILS.escapeHtml(ncr.status)}</div>
                <div><strong>Client:</strong> ${window.UTILS.escapeHtml(ncr.clientName)}</div>
            </div>
            <hr>
            <h5>CAPA Status</h5>
            <div><strong>Root Cause:</strong> ${window.UTILS.escapeHtml(ncr.rootCause || 'N/A')}</div>
            <div><strong>Corrective Action:</strong> ${window.UTILS.escapeHtml(ncr.correctiveAction || 'N/A')}</div>
            <div><strong>Verification:</strong> ${window.UTILS.escapeHtml(ncr.verificationMethod || 'N/A')}</div>
        </div>
    `;
    document.getElementById('modal-save').style.display = 'none';
    window.openModal();
}

window.editNCR = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Edit NCR';
    document.getElementById('modal-body').innerHTML = `
        <form id="edit-ncr-form">
            <div class="form-group"><label>Description <span style="color: var(--danger-color);">*</span></label>
                <textarea id="edit-desc" class="form-control" rows="3">${window.UTILS.escapeHtml(ncr.description || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Standard</label>
                    <input type="text" class="form-control" id="edit-standard" value="${window.UTILS.escapeHtml(ncr.standard || '')}">
                </div>
                <div class="form-group"><label>Clause</label>
                    <input type="text" class="form-control" id="edit-clause" value="${window.UTILS.escapeHtml(ncr.clause || '')}">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Severity</label>
                    <select id="edit-severity" class="form-control">
                        <option value="Major" ${ncr.severity === 'Major' ? 'selected' : ''}>Major</option>
                        <option value="Minor" ${ncr.severity === 'Minor' ? 'selected' : ''}>Minor</option>
                        <option value="Observation" ${(ncr.severity || '').includes('Observation') ? 'selected' : ''}>Observation/OFI</option>
                    </select>
                </div>
                <div class="form-group"><label>Status</label>
                    <select id="edit-status" class="form-control">
                        ${carStatusOptionsHTML(ncr.carStatus === 'Ineffective' ? 'Reopened' : (ncr.carStatus || normalizeCarStatus(ncr.status)))}
                    </select>
                    ${ncr.carStatus === 'Ineffective' ? '<small style="color: var(--danger-color);"><i class="fa-solid fa-triangle-exclamation"></i> Prior verification was Not Effective — this NCR reopens with a new action plan required.</small>' : ''}
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Due Date</label>
                    <input type="date" class="form-control" id="edit-due-date" value="${ncr.dueDate || ''}">
                </div>
                <div class="form-group"><label>Source</label>
                    <input type="text" class="form-control" id="edit-source" value="${window.UTILS.escapeHtml(ncr.source || '')}">
                </div>
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.description = document.getElementById('edit-desc').value;
        ncr.standard = document.getElementById('edit-standard').value;
        ncr.clause = document.getElementById('edit-clause').value;
        ncr.severity = document.getElementById('edit-severity').value;
        ncr.carStatus = document.getElementById('edit-status').value;
        ncr.status = legacyStatusFromCar(ncr.carStatus);
        ncr.dueDate = document.getElementById('edit-due-date').value;
        ncr.source = document.getElementById('edit-source').value;
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
};

// 1-5 risk-scale <option> lists shared by the Likelihood/Impact selects below.
// riskLikelihood/riskImpact are optional, auditor-entered integers — leaving
// either blank means "not formally assessed", not zero risk.
const RISK_LIKELIHOOD_LABELS = ['1 - Rare', '2 - Unlikely', '3 - Possible', '4 - Likely', '5 - Almost Certain'];
const RISK_IMPACT_LABELS = ['1 - Negligible', '2 - Minor', '3 - Moderate', '4 - Major', '5 - Severe'];
function riskScaleOptionsHTML(labels, selected) {
    const opts = ['<option value="">Not assessed</option>'];
    labels.forEach((label, i) => {
        const v = i + 1;
        opts.push(`<option value="${v}" ${Number(selected) === v ? 'selected' : ''}>${label}</option>`);
    });
    return opts.join('');
}

window.openAddCAPAModal = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Add CAPA';
    document.getElementById('modal-body').innerHTML = `
        <form id="capa-form">
            <div style="padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; border-left: 3px solid var(--primary-color);">
                <strong>NCR:</strong> ${window.UTILS.escapeHtml(ncr.description || '')}
                <br><small style="color: var(--text-secondary);">Clause: ${window.UTILS.escapeHtml(ncr.clause || 'N/A')} | Severity: ${ncr.severity || 'N/A'}</small>
            </div>
            <div class="form-group"><label>Correction (Immediate Action)</label>
                <textarea id="capa-corr" class="form-control" rows="2" placeholder="What immediate correction was taken?">${window.UTILS.escapeHtml(ncr.correction || '')}</textarea>
            </div>
            <div class="form-group"><label>Root Cause Analysis (auditee-provided) <span style="color: var(--danger-color);">*</span></label>
                <textarea id="capa-rc" class="form-control" rows="3" placeholder="Describe the root cause...">${window.UTILS.escapeHtml(ncr.rootCause || '')}</textarea>
                <small style="color: var(--text-secondary);">Root cause is determined by the auditee. AI/auto-drafted text must be confirmed before use.</small>
            </div>
            <div class="form-group"><label>Corrective Action <span style="color: var(--danger-color);">*</span></label>
                <textarea id="capa-ca" class="form-control" rows="3" placeholder="Describe corrective action planned...">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Responsible Person</label>
                    <input type="text" class="form-control" id="capa-responsible" value="${window.UTILS.escapeHtml(ncr.capaResponsible || '')}" placeholder="Name of responsible person">
                </div>
                <div class="form-group"><label>Target Completion Date</label>
                    <input type="date" class="form-control" id="capa-target-date" value="${ncr.dueDate || ''}">
                </div>
            </div>
            <div class="form-group" style="border-top: 1px dashed var(--border-color); padding-top: 0.75rem; margin-top: 0.5rem;">
                <label>Formal risk assessment <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.8rem;">(optional — leave blank if not performed)</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.4rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">Likelihood (1-5)</label>
                        <select id="capa-risk-likelihood" class="form-control">
                            ${riskScaleOptionsHTML(RISK_LIKELIHOOD_LABELS, ncr.riskLikelihood)}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.85rem;">Impact (1-5)</label>
                        <select id="capa-risk-impact" class="form-control">
                            ${riskScaleOptionsHTML(RISK_IMPACT_LABELS, ncr.riskImpact)}
                        </select>
                    </div>
                </div>
            </div>
        </form>
    `;

    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        // If this CAPA follows a "Not Effective" verification, this submission
        // is the required new action plan — clear the Ineffective flag first.
        if (ncr.carStatus === 'Ineffective') ncr.carStatus = 'Reopened';
        ncr.correction = document.getElementById('capa-corr').value;
        ncr.rootCause = document.getElementById('capa-rc').value;
        ncr.correctiveAction = document.getElementById('capa-ca').value;
        ncr.capaResponsible = document.getElementById('capa-responsible').value;
        ncr.dueDate = document.getElementById('capa-target-date').value;
        const likelihoodVal = document.getElementById('capa-risk-likelihood').value;
        const impactVal = document.getElementById('capa-risk-impact').value;
        ncr.riskLikelihood = likelihoodVal ? parseInt(likelihoodVal, 10) : null;
        ncr.riskImpact = impactVal ? parseInt(impactVal, 10) : null;
        // Auto-transition CAR status from whichever CAPA fields were actually recorded
        ncr.carStatus = computeAutoCarStatus(ncr);
        ncr.status = legacyStatusFromCar(ncr.carStatus);
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
};

// --- DELETE NCR ---
window.deleteNCR = async function (id) {
    if (!confirm('Are you sure you want to delete this NCR record?')) return;
    try {
        if (window.SupabaseClient && !String(id).startsWith('demo-')) {
            const { error } = await window.SupabaseClient.from('audit_ncrs').delete().eq('id', id);
            if (error) throw error;
        }
        window.state.ncrs = window.state.ncrs.filter(n => String(n.id) !== String(id));
        window.saveData();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        window.showNotification('NCR deleted', 'success');
    } catch (e) {
        window.showNotification('Delete failed: ' + e.message, 'error');
    }
};

// --- PRINT NCR REGISTER ---
window.printNCRRegister = function () {
    const ncrs = window.state.ncrs || [];
    const printWindow = window.open('', '', 'width=1000,height=700');

    printWindow.document.write(`
        <html>
        <head>
            <title>NCR Register</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                th { background-color: #f2f2f2; }
                .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; }
            </style>
        </head>
        <body>
            <h1>NCR Register</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>NCR#</th>
                        <th>Client</th>
                        <th>Standard</th>
                        <th>Clause</th>
                        <th>Severity</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Due Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${ncrs.map(n => `
                        <tr>
                            <td>NCR-${String(n.id).padStart(3, '0')}</td>
                            <td>${n.clientName || '-'}</td>
                            <td>${n.standard || '-'}</td>
                            <td>${resolveClauseDisplay(n).text}</td>
                            <td>${n.severity}</td>
                            <td>${n.description}</td>
                            <td>${n.status}</td>
                            <td>${n.dueDate || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                ISO 17021-1 Governance Record - Confidential
            </div>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
};


window.verifyCAPA = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Verify CAPA';
    document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Verification Method</label><textarea id="ver-method" class="form-control">${window.UTILS.escapeHtml(ncr.verificationMethod || '')}</textarea></div>
        <div class="form-group"><label>Effectiveness</label>
            <select id="ver-eff" class="form-control">
                <option value="Effective">Effective</option>
                <option value="Not Effective">Not Effective</option>
            </select>
        </div>
`;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        ncr.verificationMethod = document.getElementById('ver-method').value;
        ncr.effectiveness = document.getElementById('ver-eff').value;
        ncr.verifiedBy = window.state.currentUser?.name || 'Auditor';
        ncr.verifiedDate = new Date().toISOString().split('T')[0];

        if (ncr.effectiveness === 'Effective') {
            ncr.status = 'Closed';
            ncr.carStatus = 'Closed';
        } else {
            // Not Effective: the NCR stays open-equivalent (status is left as-is,
            // NOT bumped to Closed) — this is no longer a silent dead-end. The
            // carStatus flags Ineffective; editNCR/openAddCAPAModal auto-set
            // "Reopened" the next time this record is touched, once a new
            // action plan is recorded.
            ncr.carStatus = 'Ineffective';
            window.showNotification('CAPA verified as Not Effective — a new corrective action plan is required for NCR-' + String(ncr.id).padStart(3, '0') + '.', 'warning');
        }

        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
    };
    window.openModal();
}
// --- UPDATE CAPA PROGRESS ---
window.updateCAPAProgress = function (ncrId) {
    const ncr = window.state.ncrs.find(n => String(n.id) === String(ncrId));
    if (!ncr) return;

    document.getElementById('modal-title').textContent = 'Update CAPA Progress';
    document.getElementById('modal-body').innerHTML = `
        <form id="capa-progress-form">
            <div style="padding: 0.75rem; background: #f8fafc; border-radius: 8px; margin-bottom: 1rem; border-left: 3px solid var(--primary-color);">
                <strong>NCR-${String(ncr.id).padStart(3, '0')}:</strong> ${window.UTILS.escapeHtml(ncr.description || '')}
                <br><small style="color: var(--text-secondary);">Severity: ${ncr.severity || 'N/A'} | Status: ${ncr.status || 'Open'}</small>
            </div>
            <div class="form-group"><label>Root Cause Analysis (auditee-provided)</label>
                <textarea id="prog-rc" class="form-control" rows="2">${window.UTILS.escapeHtml(ncr.rootCause || '')}</textarea>
                <small style="color: var(--text-secondary);">Root cause is determined by the auditee. AI/auto-drafted text must be confirmed before use.</small>
            </div>
            <div class="form-group"><label>Corrective Action</label>
                <textarea id="prog-ca" class="form-control" rows="2">${window.UTILS.escapeHtml(ncr.correctiveAction || '')}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group"><label>Responsible Person</label>
                    <input type="text" class="form-control" id="prog-resp" value="${window.UTILS.escapeHtml(ncr.capaResponsible || '')}">
                </div>
                <div class="form-group"><label>Implementation Date</label>
                    <input type="date" class="form-control" id="prog-impl-date" value="${ncr.capaImplementedDate || ''}">
                </div>
            </div>
            <div class="form-group"><label>Status</label>
                <select id="prog-status" class="form-control">
                    ${carStatusOptionsHTML(ncr.carStatus === 'Ineffective' ? 'Reopened' : (ncr.carStatus || normalizeCarStatus(ncr.status)))}
                </select>
                ${ncr.carStatus === 'Ineffective' ? '<small style="color: var(--danger-color);"><i class="fa-solid fa-triangle-exclamation"></i> Prior verification was Not Effective — a new action plan is required.</small>' : ''}
            </div>
        </form>
    `;
    document.getElementById('modal-save').style.display = 'block';
    document.getElementById('modal-save').onclick = async () => {
        // If this update follows a "Not Effective" verification, treat it as
        // the required new action plan and clear the Ineffective flag.
        if (ncr.carStatus === 'Ineffective') ncr.carStatus = 'Reopened';
        ncr.rootCause = document.getElementById('prog-rc').value;
        ncr.correctiveAction = document.getElementById('prog-ca').value;
        ncr.capaResponsible = document.getElementById('prog-resp').value;
        ncr.capaImplementedDate = document.getElementById('prog-impl-date').value;
        const selectedCar = document.getElementById('prog-status').value;
        // Auto-transition (replaces old capaImplementedDate->Verification bump):
        // the furthest CAPA field actually recorded auto-advances the CAR
        // status, but never regresses a further-along manual selection.
        const autoCar = computeAutoCarStatus(ncr);
        ncr.carStatus = bumpCarStatus(selectedCar, autoCar);
        ncr.status = legacyStatusFromCar(ncr.carStatus);
        await persistNCR(ncr);
        window.closeModal();
        renderNCRCAPAModuleContent(window.state.ncrContextClientId);
        window.showNotification('CAPA progress updated', 'success');
    };
    window.openModal();
};

// Export
window.renderNCRCAPAModule = renderNCRCAPAModule;
window.switchNCRTab = switchNCRTab;

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getNCRAuditPlanOptions, updateNCRAuditPlanOptions, initNCRAnalyticsCharts, openNewNCRModal, viewNCRDetails, editNCR, openAddCAPAModal, printNCRRegister, verifyCAPA, updateCAPAProgress, renderNCRCAPAModule, switchNCRTab, capaDisplayStatus, isOverdueNCR };
}
