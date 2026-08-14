/**
 * client-ai-suggest.js — AI-suggested account setup entries for a client.
 *
 * Account Setup asks the auditor to type in the client's departments,
 * designations, goods & services and key processes before an audit can be
 * planned. Most of that is already knowable: from the client record, from the
 * documents they sent (see client-docs-bulk.js), and above all from their own
 * website, which is where products and services are actually described.
 *
 * This module gathers that evidence — optionally fetching the website through
 * /api/site-scan — asks Gemini for grounded suggestions, and puts them in front
 * of the auditor as an editable, checkable list. Nothing is written to the
 * client record until the auditor accepts it.
 */
(function () {
    'use strict';

    const KINDS = {
        departments: {
            label: 'Departments',
            singular: 'department',
            field: 'departments',
            icon: 'fa-sitemap',
            colour: '#f59e0b',
            keyOf: item => item.name,
            columns: [
                { key: 'name', label: 'Department', type: 'text' },
                { key: 'risk', label: 'Risk Level', type: 'select', options: ['High', 'Medium', 'Low'] },
                { key: 'head', label: 'Typical Head', type: 'text' }
            ],
            schema: '{"name":"department name","risk":"High|Medium|Low","head":"job title that usually heads it","rationale":"one short line — why this client has it"}',
            guidance: 'Suggest the functional departments an organisation of this size, sector and activity actually operates. Risk level should reflect the department\'s impact on conformity of the certified product or service.'
        },
        designations: {
            label: 'Designations',
            singular: 'designation',
            field: 'designations',
            icon: 'fa-id-badge',
            colour: '#ec4899',
            keyOf: item => item.title || item.name,
            columns: [
                { key: 'title', label: 'Job Title', type: 'text' },
                { key: 'department', label: 'Department', type: 'text' }
            ],
            schema: '{"title":"job title","department":"department it sits in","rationale":"one short line — why this role exists here"}',
            guidance: 'Suggest job titles that would be interviewed or sampled during an audit — process owners, management representatives, operators of controlled processes. Use the department names already recorded where they fit.'
        },
        goods: {
            label: 'Goods & Services',
            singular: 'product or service',
            field: 'goodsServices',
            icon: 'fa-boxes-stacked',
            colour: '#10b981',
            keyOf: item => item.name,
            columns: [
                { key: 'name', label: 'Name', type: 'text' },
                { key: 'category', label: 'Category', type: 'select', options: ['Product', 'Service', 'Process', 'Other'] },
                { key: 'description', label: 'Description', type: 'text' }
            ],
            schema: '{"name":"product or service name","category":"Product|Service","description":"short description in the client\'s own terms","rationale":"where in the evidence this came from"}',
            guidance: 'This is the most website-dependent list — take the actual product and service names the organisation publishes, not generic sector categories. Keep their wording and capitalisation.'
        },
        processes: {
            label: 'Key Processes',
            singular: 'process',
            field: 'keyProcesses',
            icon: 'fa-gears',
            colour: '#6366f1',
            keyOf: item => item.name,
            columns: [
                { key: 'name', label: 'Process Name', type: 'text' },
                { key: 'category', label: 'Type', type: 'select', options: ['Core', 'Support', 'Management', 'Outsourced'] },
                { key: 'owner', label: 'Typical Owner', type: 'text' }
            ],
            schema: '{"name":"process name","category":"Core|Support|Management|Outsourced","owner":"job title of the likely process owner","rationale":"one short line — evidence this process runs here"}',
            guidance: 'Cover the value chain end to end (enquiry through delivery) plus the support and management processes ISO requires. Mark anything the organisation buys in rather than performs itself as Outsourced — those attract clause 8.4 controls.'
        }
    };

    let _suggestions = [];
    let _clientId = null;
    let _kind = null;
    let _siteInfo = null;

    function esc(s) {
        return window.UTILS && window.UTILS.escapeHtml ? window.UTILS.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
    }

    function notify(msg, type) {
        if (window.showNotification) window.showNotification(msg, type || 'success');
    }

    function normKey(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // ── Context and prompt ────────────────────────────────────────────

    function listOf(arr, fn, cap) {
        const out = (arr || []).slice(0, cap || 40).map(fn).filter(Boolean);
        return out.length ? out.join('; ') : '';
    }

    /**
     * Everything known about the client, as plain text for the prompt.
     * @param {Object} client
     * @param {string} [siteText] - text returned by /api/site-scan
     */
    function buildContext(client, siteText) {
        const lines = [];
        lines.push(`Company: ${client.name}`);
        if (client.industry) lines.push(`Industry: ${client.industry}`);
        if (client.standard) lines.push(`Management system standard(s): ${client.standard}`);
        if (client.employees) lines.push(`Employees: ${client.employees}`);
        if (client.website) lines.push(`Website: ${client.website}`);

        const sites = listOf(client.sites, s => `${s.name}${s.city ? ', ' + s.city : ''}${s.country ? ', ' + s.country : ''}${s.employees ? ' (' + s.employees + ' staff)' : ''}`);
        if (sites) lines.push(`Sites: ${sites}`);

        const depts = listOf(client.departments, d => d.name);
        if (depts) lines.push(`Departments already recorded: ${depts}`);

        const desigs = listOf(client.designations, d => d.title || d.name || d);
        if (desigs) lines.push(`Designations already recorded: ${desigs}`);

        const goods = listOf(client.goodsServices, g => `${g.name || g}${g.category ? ' (' + g.category + ')' : ''}`);
        if (goods) lines.push(`Goods & services already recorded: ${goods}`);

        const procs = listOf(client.keyProcesses, p => `${p.name || p}${p.category ? ' [' + p.category + ']' : ''}`);
        if (procs) lines.push(`Key processes already recorded: ${procs}`);

        const docs = listOf(client.documents, d => `${d.name}${d.linkedClauses ? ' [clauses ' + d.linkedClauses + ']' : ''}`, 40);
        if (docs) lines.push(`Documents supplied by the client: ${docs}`);

        if (client.profile) {
            lines.push(`\nOrganization context on file:\n${String(client.profile).slice(0, 1200)}`);
        }
        if (siteText) {
            lines.push(`\nText read from the client's website just now:\n${String(siteText).slice(0, 9000)}`);
        }
        return lines.join('\n');
    }

    function buildPrompt(client, kind, context, count, extra) {
        const cfg = KINDS[kind];
        return [
            'You are an ISO/IEC 17021-1 certification body auditor preparing the audit file for a client.',
            `Suggest up to ${count} ${cfg.label} for the organisation described below.`,
            '',
            '=== EVIDENCE ===',
            context,
            '=== END EVIDENCE ===',
            '',
            'Rules:',
            '1. Ground every suggestion in the evidence above. Where the website or the client\'s documents name something, use their exact wording.',
            '2. Do not repeat anything listed as already recorded.',
            '3. If the evidence is thin, fall back to what is normal for the stated industry and size, and say so in the rationale.',
            '4. Never invent specific product names, certifications or customers that do not appear in the evidence.',
            `5. ${cfg.guidance}`,
            '',
            extra ? `Additional instruction from the auditor: ${extra}\n` : '',
            `Return ONLY a JSON array (no markdown, no commentary) of objects shaped exactly like: ${cfg.schema}`
        ].filter(Boolean).join('\n');
    }

    /** Pull the JSON array out of a model response that may be fenced or chatty. */
    function parseSuggestions(text) {
        if (!text) return [];
        const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start === -1 || end === -1 || end < start) return [];
        let parsed;
        try {
            parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch (_e) {
            return [];
        }
        return Array.isArray(parsed) ? parsed.filter(o => o && typeof o === 'object') : [];
    }

    /**
     * Flag suggestions that duplicate what the client already has, and drop
     * duplicates within the batch itself.
     */
    function dedupeAgainstExisting(suggestions, existing, keyOf) {
        const have = new Set((existing || []).map(e => normKey(keyOf(e))));
        const seen = new Set();
        const out = [];
        suggestions.forEach(s => {
            const key = normKey(keyOf(s));
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(Object.assign({}, s, { _existing: have.has(key) }));
        });
        return out;
    }

    // ── UI ────────────────────────────────────────────────────────────

    window.openAISuggestModal = function (clientId, kind) {
        if (window.AuthManager && !window.AuthManager.canPerform('create', 'client')) {
            notify('Access Denied: you do not have permission to edit this client.', 'error');
            return;
        }
        const client = window.DataService.findClient(clientId);
        const cfg = KINDS[kind];
        if (!client || !cfg) return;

        _clientId = clientId;
        _kind = kind;
        _suggestions = [];
        _siteInfo = null;

        const existingCount = (client[cfg.field] || []).length;
        const docCount = (client.documents || []).length;

        window.DataService.openFormModal(`AI Suggestions — ${cfg.label}`, `
        <div id="ai-suggest-body">
            <div style="background: #f8fafc; border-radius: var(--radius-md); padding: 1rem 1.25rem; margin-bottom: 1rem; font-size: 0.86rem;">
                <div style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid ${cfg.icon}" style="color: ${cfg.colour}; margin-right: 0.4rem;"></i>What the suggestion will be based on</div>
                <div style="color: var(--text-secondary); line-height: 1.7;">
                    ${esc(client.name)}${client.industry ? ' · ' + esc(client.industry) : ''}${client.standard ? ' · ' + esc(client.standard) : ''}${client.employees ? ' · ' + esc(client.employees) + ' employees' : ''}<br>
                    ${(client.sites || []).length} site(s) · ${(client.departments || []).length} department(s) · ${docCount} client document(s) on file · ${existingCount} ${esc(cfg.label.toLowerCase())} already recorded
                </div>
            </div>

            <div class="form-group">
                <label>Client website <span style="font-weight: 400; color: var(--text-secondary); font-size: 0.82rem;">— read for products, services and activities</span></label>
                <input type="url" class="form-control" id="ai-suggest-url" value="${esc(client.website || '')}" placeholder="https://client-website.com">
                <label style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; cursor: pointer; font-size: 0.85rem;">
                    <input type="checkbox" id="ai-suggest-scan" ${client.website ? 'checked' : ''}>
                    <span>Read the website before suggesting (homepage plus any about / products / services pages)</span>
                </label>
            </div>

            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>How many</label>
                    <select class="form-control" id="ai-suggest-count">
                        <option>8</option>
                        <option selected>12</option>
                        <option>20</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Anything specific to steer it <span style="font-weight: 400; color: #94a3b8; font-size: 0.8rem;">(optional)</span></label>
                    <input type="text" class="form-control" id="ai-suggest-extra" placeholder="e.g. focus on the wire harness assembly line">
                </div>
            </div>

            <button class="btn btn-primary" style="width: 100%;" data-action="runAISuggest" data-arg1="${esc(clientId)}" data-arg2="${esc(kind)}">
                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i>Generate suggestions
            </button>
        </div>`);
    };

    function setBody(html) {
        const body = document.getElementById('ai-suggest-body');
        if (body) body.innerHTML = html;
    }

    function busy(message) {
        setBody(`
        <div style="padding: 2.5rem 1rem; text-align: center;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
            <p style="margin: 1rem 0 0; font-weight: 600;">${esc(message)}</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.84rem; color: var(--text-secondary);">This usually takes 10–20 seconds.</p>
        </div>`);
    }

    async function scanWebsite(url) {
        const response = await fetch('/api/site-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Site scan failed (${response.status})`);
        return data;
    }

    window.runAISuggest = async function (clientId, kind) {
        const client = window.DataService.findClient(clientId);
        const cfg = KINDS[kind];
        if (!client || !cfg) return;

        const url = (document.getElementById('ai-suggest-url') || {}).value || '';
        const scan = !!(document.getElementById('ai-suggest-scan') || {}).checked;
        const count = (document.getElementById('ai-suggest-count') || {}).value || '12';
        const extra = ((document.getElementById('ai-suggest-extra') || {}).value || '').trim();

        if (!window.AI_SERVICE || !window.AI_SERVICE.callProxyAPI) {
            setBody(errorHTML('The AI service is not available in this deployment.', clientId, kind));
            return;
        }

        let siteText = '';
        _siteInfo = null;
        if (scan && url) {
            busy('Reading the client website…');
            try {
                const scanned = await scanWebsite(url);
                siteText = scanned.text || '';
                _siteInfo = scanned;
                if (client.website !== url) {
                    client.website = url;
                    window.saveData();
                }
            } catch (err) {
                notify(`Website could not be read (${err.message}) — continuing from the client record only.`, 'warning');
            }
        }

        busy(siteText ? 'Analysing the website and client record…' : 'Analysing the client record…');

        try {
            const context = buildContext(client, siteText);
            const prompt = buildPrompt(client, kind, context, count, extra);
            const response = await window.AI_SERVICE.callProxyAPI(prompt, { maxTokens: 8192 });
            const parsed = parseSuggestions(response);

            if (!parsed.length) {
                setBody(errorHTML('The AI did not return anything usable. Try again, or add more detail to the client record first.', clientId, kind));
                return;
            }

            _suggestions = dedupeAgainstExisting(parsed, client[cfg.field] || [], cfg.keyOf).map(s => {
                s._include = !s._existing;
                return s;
            });
            renderReview();
        } catch (err) {
            if (window.Logger) window.Logger.error('ClientAISuggest', 'Suggestion failed: ' + err.message);
            setBody(errorHTML(err.message || 'The AI request failed.', clientId, kind));
        }
    };

    function errorHTML(message, clientId, kind) {
        return `
        <div style="padding: 2rem 1rem; text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f59e0b;"></i>
            <p style="margin: 1rem 0 1.25rem; color: var(--text-secondary);">${esc(message)}</p>
            <button class="btn btn-secondary btn-sm" data-action="openAISuggestModal" data-arg1="${esc(clientId)}" data-arg2="${esc(kind)}">Back</button>
        </div>`;
    }

    function renderReview() {
        const cfg = KINDS[_kind];
        const selected = _suggestions.filter(s => s._include).length;

        const rows = _suggestions.map((s, i) => `
            <tr style="${s._include ? '' : 'opacity: 0.6;'}">
                <td style="text-align: center; vertical-align: top; padding-top: 12px;">
                    <input type="checkbox" ${s._include ? 'checked' : ''} data-action-change="toggleSuggestRow" data-arg1="${i}">
                </td>
                ${cfg.columns.map(col => `
                <td style="vertical-align: top;">
                    ${col.type === 'select' ? `
                    <select class="form-control" style="margin: 0; font-size: 0.82rem; padding: 4px 6px;" data-action-change="updateSuggestField" data-arg1="${i}" data-arg2="${col.key}" data-arg3="this.value">
                        ${col.options.map(o => `<option ${normKey(o) === normKey(s[col.key]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}
                    </select>` : `
                    <input type="text" class="form-control" style="margin: 0; font-size: 0.84rem; padding: 4px 8px;" value="${esc(s[col.key] || '')}" data-action-change="updateSuggestField" data-arg1="${i}" data-arg2="${col.key}" data-arg3="this.value">`}
                </td>`).join('')}
                <td style="vertical-align: top; text-align: center;">
                    ${s._existing
                ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:0.72rem;white-space:nowrap;">Already recorded</span>'
                : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:0.72rem;">New</span>'}
                </td>
            </tr>
            ${s.rationale ? `<tr><td></td><td colspan="${cfg.columns.length + 1}" style="padding: 0 8px 10px; font-size: 0.78rem; color: #64748b; border-bottom: 1px solid #f1f5f9;"><i class="fa-solid fa-lightbulb" style="color:#f59e0b;margin-right:5px;"></i>${esc(s.rationale)}</td></tr>` : ''}
        `).join('');

        setBody(`
        ${_siteInfo ? `
        <div style="background: #eff6ff; border-left: 3px solid var(--primary-color); border-radius: 0 6px 6px 0; padding: 0.6rem 0.9rem; margin-bottom: 0.85rem; font-size: 0.82rem;">
            <strong>Read from the website:</strong> ${esc((_siteInfo.pages || []).map(p => p.title || p.url).join(' · ')) || esc(_siteInfo.site && _siteInfo.site.url)}
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <div style="font-size: 0.86rem; color: var(--text-secondary);">
                <strong style="color: var(--text-primary);">${_suggestions.length}</strong> suggested ·
                <strong style="color: var(--text-primary);" id="ai-suggest-count-label">${selected}</strong> selected.
                Edit anything before adding — these are proposals, not findings.
            </div>
            <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm" data-action="toggleAllSuggestions" data-arg1="1">Select all</button>
                <button class="btn btn-secondary btn-sm" data-action="toggleAllSuggestions" data-arg1="0">Clear</button>
            </div>
        </div>
        <div class="table-container" style="max-height: 45vh; overflow: auto;">
            <table style="font-size: 0.85rem;">
                <thead style="position: sticky; top: 0; background: var(--surface-color); z-index: 1;">
                    <tr>
                        <th style="width: 34px;"></th>
                        ${cfg.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}
                        <th style="width: 120px;">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" data-action="openAISuggestModal" data-arg1="${esc(_clientId)}" data-arg2="${esc(_kind)}"><i class="fa-solid fa-arrow-left" style="margin-right: 0.4rem;"></i>Start over</button>
            <button class="btn btn-primary" data-action="applyAISuggestions" data-arg1="${esc(_clientId)}" data-arg2="${esc(_kind)}"><i class="fa-solid fa-plus" style="margin-right: 0.4rem;"></i>Add selected to ${esc(cfg.label)}</button>
        </div>`);

        const modal = document.querySelector('.modal-content');
        if (modal) modal.classList.add('modal-wide');
    }

    window.toggleSuggestRow = function (idx, checked) {
        const row = _suggestions[+idx];
        if (!row) return;
        row._include = checked === undefined ? !row._include : (checked === true || checked === 'true' || checked === 'on');
        const label = document.getElementById('ai-suggest-count-label');
        if (label) label.textContent = String(_suggestions.filter(s => s._include).length);
    };

    window.toggleAllSuggestions = function (on) {
        const val = on === '1' || on === 1 || on === true;
        _suggestions.forEach(s => { s._include = val; });
        renderReview();
    };

    window.updateSuggestField = function (idx, field, value) {
        const row = _suggestions[+idx];
        if (row) row[field] = value;
    };

    window.applyAISuggestions = function (clientId, kind) {
        const client = window.DataService.findClient(clientId);
        const cfg = KINDS[kind];
        if (!client || !cfg) return;

        const chosen = _suggestions.filter(s => s._include && cfg.keyOf(s));
        if (!chosen.length) { notify('Nothing selected.', 'error'); return; }

        if (!client[cfg.field]) client[cfg.field] = [];
        const have = new Set(client[cfg.field].map(e => normKey(cfg.keyOf(e))));

        let added = 0;
        chosen.forEach(s => {
            const key = normKey(cfg.keyOf(s));
            if (!key || have.has(key)) return;
            have.add(key);
            const record = {};
            cfg.columns.forEach(col => { record[col.key] = (s[col.key] || '').toString().trim(); });
            record.source = 'ai-suggested';
            client[cfg.field].push(record);
            added++;
        });

        window.saveData();
        if (window.DataService.syncClient) {
            window.DataService.syncClient(client, { saveLocal: false });
        } else if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.upsertClient(client).catch(() => { });
        }

        const modal = document.querySelector('.modal-content');
        if (modal) modal.classList.remove('modal-wide');
        window.closeModal();
        notify(`Added ${added} ${cfg.label.toLowerCase()} to ${client.name}`, 'success');

        if (typeof window.renderClientTab === 'function') {
            window.renderClientTab(client, 'client_org');
        } else if (typeof window.renderClientDetail === 'function') {
            window.renderClientDetail(clientId);
        }
    };

    // ── Extraction from the client's own documents ────────────────────

    const EXTRACT_ORDER = ['departments', 'designations', 'processes', 'goods'];
    let _extracted = null;

    /**
     * Merge AI-proposed entries into the evidence-backed ones. Entries found in
     * the documents win on identity; the AI only adds new names or fills the
     * fields the text scan could not determine (owner, department, risk).
     */
    function mergeExtracted(base, fromAI, cfg) {
        const out = [];
        const index = new Map();
        (base || []).forEach(item => {
            const key = normKey(cfg.keyOf(item));
            if (!key || index.has(key)) return;
            const row = Object.assign({ _source: 'documents' }, item);
            index.set(key, row);
            out.push(row);
        });
        (fromAI || []).forEach(item => {
            const key = normKey(cfg.keyOf(item));
            if (!key) return;
            const existing = index.get(key);
            if (existing) {
                cfg.columns.forEach(col => {
                    if (!existing[col.key] && item[col.key]) existing[col.key] = item[col.key];
                });
                if (!existing.rationale && item.rationale) existing.rationale = item.rationale;
                return;
            }
            const row = Object.assign({ _source: 'ai' }, item);
            index.set(key, row);
            out.push(row);
        });
        return out;
    }

    function buildDocCorpusText(entries) {
        let budget = 12000;
        const parts = [];
        for (const entry of entries) {
            const head = `--- ${entry.title}${entry.category ? ' [' + entry.category + ']' : ''}${entry.clauses ? ' (clauses ' + entry.clauses + ')' : ''} ---`;
            const body = String(entry.text || '').replace(/\s+/g, ' ').slice(0, 900);
            const chunk = `${head}\n${body}`;
            if (chunk.length > budget) break;
            budget -= chunk.length;
            parts.push(chunk);
        }
        return parts.join('\n\n');
    }

    function buildExtractPrompt(client, corpusText) {
        return [
            'You are an ISO/IEC 17021-1 auditor reading the management system documents a client submitted before an audit.',
            'From these documents, identify how the organisation is actually structured.',
            '',
            `Client: ${client.name}${client.industry ? ' — ' + client.industry : ''}${client.standard ? ' — ' + client.standard : ''}`,
            '',
            '=== CLIENT DOCUMENTS ===',
            corpusText,
            '=== END DOCUMENTS ===',
            '',
            'Rules:',
            '1. Only report what these documents actually evidence. Do not pad the lists with what a typical company of this type would have.',
            '2. Use the organisation\'s own wording for names.',
            '3. A controlled procedure normally corresponds to a process — name the process, not the document.',
            '4. Leave a field as an empty string when the documents do not state it. Never guess a person\'s name.',
            '',
            'Return ONLY a JSON object (no markdown, no commentary) shaped exactly like:',
            '{"departments":[{"name":"","risk":"High|Medium|Low","head":"","rationale":""}],',
            ' "designations":[{"title":"","department":"","rationale":""}],',
            ' "processes":[{"name":"","category":"Core|Support|Management|Outsourced","owner":"","rationale":""}],',
            ' "goods":[{"name":"","category":"Product|Service","description":"","rationale":""}]}'
        ].join('\n');
    }

    /** Pull the JSON object out of a model response that may be fenced or chatty. */
    function parseExtractResponse(text) {
        const empty = { departments: [], designations: [], processes: [], goods: [] };
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
        if (!parsed || typeof parsed !== 'object') return empty;
        const pick = key => Array.isArray(parsed[key]) ? parsed[key].filter(o => o && typeof o === 'object') : [];
        return {
            departments: pick('departments'),
            designations: pick('designations'),
            processes: pick('processes'),
            goods: pick('goods')
        };
    }

    window.extractOrgSetupFromDocs = async function (clientId) {
        if (window.AuthManager && !window.AuthManager.canPerform('create', 'client')) {
            notify('Access Denied: you do not have permission to edit this client.', 'error');
            return;
        }
        const client = window.DataService.findClient(clientId);
        if (!client || !window.ClientDocsBulk) return;

        const entries = window.ClientDocsBulk.getCorpus(clientId, client).filter(e => e.text && e.text.trim());
        if (!entries.length) {
            notify('No document text to analyse — bulk upload the client\'s documents first.', 'error');
            return;
        }

        _clientId = clientId;
        if (!document.getElementById('ai-suggest-body')) {
            window.DataService.openFormModal(`Extract Account Setup — ${client.name}`, '<div id="ai-suggest-body"></div>');
        }
        setBody(`
        <div style="padding: 2.5rem 1rem; text-align: center;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>
            <p style="margin: 1rem 0 0; font-weight: 600;">Reading ${entries.length} document(s)…</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.84rem; color: var(--text-secondary);">Finding departments, roles, processes and products.</p>
        </div>`);
        await new Promise(r => setTimeout(r, 0));

        const scanned = window.ClientDocsBulk.extractOrgEntities(entries);
        let fromAI = { departments: [], designations: [], processes: [], goods: [] };
        let aiUsed = false;

        if (window.AI_SERVICE && window.AI_SERVICE.callProxyAPI) {
            try {
                const response = await window.AI_SERVICE.callProxyAPI(
                    buildExtractPrompt(client, buildDocCorpusText(entries)),
                    { maxTokens: 8192 }
                );
                fromAI = parseExtractResponse(response);
                aiUsed = EXTRACT_ORDER.some(k => fromAI[k].length > 0);
            } catch (err) {
                if (window.Logger) window.Logger.warn('ClientAISuggest', 'AI extraction failed: ' + err.message);
                notify('AI pass unavailable — showing what the text scan found.', 'warning');
            }
        }

        _extracted = {};
        EXTRACT_ORDER.forEach(kind => {
            const cfg = KINDS[kind];
            const merged = mergeExtracted(scanned[kind], fromAI[kind], cfg);
            _extracted[kind] = dedupeAgainstExisting(merged, client[cfg.field] || [], cfg.keyOf)
                .map(row => Object.assign(row, { _include: !row._existing }));
        });

        renderExtractReview(entries.length, aiUsed);
    };

    function renderExtractReview(docCount, aiUsed) {
        const total = EXTRACT_ORDER.reduce((t, k) => t + _extracted[k].filter(r => r._include).length, 0);

        const section = kind => {
            const cfg = KINDS[kind];
            const rows = _extracted[kind];
            if (!rows.length) {
                return `<div style="padding: 0.75rem 1rem; font-size: 0.84rem; color: #94a3b8; border-bottom: 1px solid #f1f5f9;">
                    <i class="fa-solid ${cfg.icon}" style="margin-right: 0.4rem;"></i>${esc(cfg.label)} — nothing found in these documents.
                </div>`;
            }
            return `
            <div style="margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.6rem 0.9rem; background: #f8fafc; flex-wrap: wrap;">
                    <div style="font-weight: 600; font-size: 0.9rem;">
                        <i class="fa-solid ${cfg.icon}" style="color: ${cfg.colour}; margin-right: 0.4rem;"></i>${esc(cfg.label)}
                        <span style="font-weight: 400; color: var(--text-secondary);">— ${rows.length} found</span>
                    </div>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-secondary btn-sm" data-action="toggleAllExtract" data-arg1="${kind}" data-arg2="1">All</button>
                        <button class="btn btn-secondary btn-sm" data-action="toggleAllExtract" data-arg1="${kind}" data-arg2="0">None</button>
                    </div>
                </div>
                <table style="font-size: 0.84rem; width: 100%;">
                    <thead><tr>
                        <th style="width: 34px;"></th>
                        ${cfg.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}
                        <th style="width: 105px;">Found in</th>
                        <th style="width: 110px;">Status</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map((r, i) => `
                        <tr style="${r._include ? '' : 'opacity: 0.55;'}">
                            <td style="text-align: center;"><input type="checkbox" ${r._include ? 'checked' : ''} data-action-change="toggleExtractRow" data-arg1="${kind}" data-arg2="${i}"></td>
                            ${cfg.columns.map(col => `
                            <td>${col.type === 'select' ? `
                                <select class="form-control" style="margin: 0; font-size: 0.8rem; padding: 3px 6px;" data-action-change="updateExtractField" data-arg1="${kind}" data-arg2="${i}" data-arg3="${col.key}" data-arg4="this.value">
                                    ${col.options.map(o => `<option ${normKey(o) === normKey(r[col.key]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}
                                </select>` : `
                                <input type="text" class="form-control" style="margin: 0; font-size: 0.83rem; padding: 3px 8px;" value="${esc(r[col.key] || '')}" data-action-change="updateExtractField" data-arg1="${kind}" data-arg2="${i}" data-arg3="${col.key}" data-arg4="this.value">`}
                            </td>`).join('')}
                            <td style="text-align: center;">
                                <span style="background: ${r._source === 'documents' ? '#e0f2fe' : '#f3e8ff'}; color: ${r._source === 'documents' ? '#0369a1' : '#6b21a8'}; padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; white-space: nowrap;" title="${esc(r.rationale || r.evidence || '')}">${r._source === 'documents' ? 'Document text' : 'AI reading'}</span>
                            </td>
                            <td style="text-align: center;">
                                ${r._existing
                    ? '<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-size:0.7rem;white-space:nowrap;">Already there</span>'
                    : '<span style="background:#dcfce7;color:#166534;padding:2px 7px;border-radius:4px;font-size:0.7rem;">New</span>'}
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        };

        setBody(`
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.85rem; flex-wrap: wrap;">
            <div style="font-size: 0.86rem; color: var(--text-secondary);">
                Read ${docCount} document(s)${aiUsed ? ' with an AI pass over the text' : ' (text scan only)'} ·
                <strong style="color: var(--text-primary);" id="extract-count">${total}</strong> entries selected.
                Anything already in Account Setup is unticked so nothing is added twice.
            </div>
        </div>
        <div style="max-height: 52vh; overflow: auto; padding-right: 4px;">
            ${EXTRACT_ORDER.map(section).join('')}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
            <button class="btn btn-secondary btn-sm" data-action="closeExtractModal">Cancel</button>
            <button class="btn btn-primary" data-action="applyExtractedOrgSetup" data-id="${esc(_clientId)}"><i class="fa-solid fa-plus" style="margin-right: 0.4rem;"></i>Add selected to Account Setup</button>
        </div>`);

        const modal = document.querySelector('.modal-content');
        if (modal) modal.classList.add('modal-wide');
    }

    function refreshExtractCount() {
        const el = document.getElementById('extract-count');
        if (el) el.textContent = String(EXTRACT_ORDER.reduce((t, k) => t + _extracted[k].filter(r => r._include).length, 0));
    }

    window.toggleExtractRow = function (kind, idx, checked) {
        const row = _extracted && _extracted[kind] && _extracted[kind][+idx];
        if (!row) return;
        row._include = checked === undefined ? !row._include : (checked === true || checked === 'true' || checked === 'on');
        refreshExtractCount();
    };

    window.toggleAllExtract = function (kind, on) {
        if (!_extracted || !_extracted[kind]) return;
        const val = on === '1' || on === 1 || on === true;
        _extracted[kind].forEach(r => { r._include = val; });
        renderExtractReview(0, false);
    };

    window.updateExtractField = function (kind, idx, field, value) {
        const row = _extracted && _extracted[kind] && _extracted[kind][+idx];
        if (row) row[field] = value;
    };

    window.closeExtractModal = function () {
        const modal = document.querySelector('.modal-content');
        if (modal) modal.classList.remove('modal-wide');
        window.closeModal();
    };

    window.applyExtractedOrgSetup = function (clientId) {
        const client = window.DataService.findClient(clientId);
        if (!client || !_extracted) return;

        const added = {};
        EXTRACT_ORDER.forEach(kind => {
            const cfg = KINDS[kind];
            if (!client[cfg.field]) client[cfg.field] = [];
            const have = new Set(client[cfg.field].map(e => normKey(cfg.keyOf(e))));
            added[kind] = 0;
            _extracted[kind].filter(r => r._include).forEach(r => {
                const key = normKey(cfg.keyOf(r));
                if (!key || have.has(key)) return;
                have.add(key);
                const record = {};
                cfg.columns.forEach(col => { record[col.key] = String(r[col.key] || '').trim(); });
                record.source = r._source === 'ai' ? 'ai-from-documents' : 'client-documents';
                client[cfg.field].push(record);
                added[kind]++;
            });
        });

        window.saveData();
        if (window.DataService.syncClient) {
            window.DataService.syncClient(client, { saveLocal: false });
        } else if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            window.SupabaseClient.upsertClient(client).catch(() => { });
        }

        window.closeExtractModal();
        const summary = EXTRACT_ORDER
            .filter(k => added[k])
            .map(k => `${added[k]} ${KINDS[k].label.toLowerCase()}`)
            .join(', ');
        notify(summary ? `Added ${summary} to ${client.name}` : 'Nothing new to add — everything was already recorded.', summary ? 'success' : 'info');

        if (typeof window.renderClientTab === 'function') {
            window.renderClientTab(client, 'client_org');
        } else if (typeof window.renderClientDetail === 'function') {
            window.renderClientDetail(clientId);
        }
    };

    // ── Exports ───────────────────────────────────────────────────────

    const ClientAISuggest = {
        KINDS,
        buildContext,
        buildPrompt,
        parseSuggestions,
        dedupeAgainstExisting,
        mergeExtracted,
        buildExtractPrompt,
        buildDocCorpusText,
        parseExtractResponse
    };

    window.ClientAISuggest = ClientAISuggest;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ClientAISuggest;
    }

    if (window.Logger) window.Logger.debug('Modules', 'client-ai-suggest.js loaded successfully.');
})();
