// ============================================
// AUDIT EXECUTION MODULE - Enhanced with Tabs (ESM-ready)
// ============================================
// List view, report CRUD, and detail view => Extracted to execution-list.js

// ---------- KB Helpers loaded from ai-service.js (window.KB_HELPERS) ----------
// normalizeStdName, extractClauseNum, lookupKBRequirement, resolveChecklistClause,
// resolveStandardName are all available via window.KB_HELPERS.*


// eslint-disable-next-line no-unused-vars
function renderExecutionTab(report, tabName, contextData = {}) {
    const tabContent = document.getElementById('tab-content');

    switch (tabName) {
        case 'checklist': {
            const { assignedChecklists = [], progressMap = {}, customItems = [], departments: _departments = [], designations: _designations = [], auditTeam: _auditTeam = [], clientPersonnel = [], clientData = null, plan: _plan = null, selectionMap = {}, overridesMap = {} } = contextData;

            // Auto-fill designation and department when personnel name is selected
            window._autoFillPersonnel = function (suffix) {
                const sel = document.getElementById('ncr-personnel-' + suffix);
                const desEl = document.getElementById('ncr-designation-' + suffix);
                const deptEl = document.getElementById('ncr-department-' + suffix);
                if (!sel) return;
                const name = sel.value;
                let designation = '';
                let department = '';
                if (name) {
                    // Find contact to get designation
                    const contacts = (clientData && clientData.contacts) || [];
                    const contact = contacts.find(c => c.name === name);
                    if (contact && contact.designation) {
                        designation = contact.designation;
                        // Find department from designations mapping
                        const desigs = (clientData && clientData.designations) || [];
                        const desMatch = desigs.find(d => (d.title || d) === designation);
                        if (desMatch && desMatch.department) {
                            department = desMatch.department;
                        }
                    }
                }
                if (desEl) desEl.value = designation;
                if (deptEl) deptEl.value = department;
            };

            // AI Auto Map: Use AI to assign personnel/designation/department based on question context
            window.autoMapPersonnel = async function (_reportId) {
                const allContacts = (clientData && clientData.contacts) || [];
                const desigs = (clientData && clientData.designations) || [];
                if (!allContacts.length) {
                    window.showNotification('No client contacts found. Please add contacts in the client profile first.', 'warning');
                    return;
                }

                // Filter to only opening meeting attendees
                const attendees = report.openingMeeting?.attendees;
                let contacts = allContacts;
                if (attendees && Array.isArray(attendees) && attendees.length > 0) {
                    const attendeeNames = new Set(
                        attendees.map(a => (typeof a === 'object' ? (a.name || '') : String(a)).trim().toLowerCase()).filter(Boolean)
                    );
                    contacts = allContacts.filter(c => c.name && attendeeNames.has(c.name.trim().toLowerCase()));
                    if (!contacts.length) {
                        // Fallback if name matching failed
                        window.showNotification('Could not match opening meeting attendees to contacts. Using full roster.', 'warning');
                        contacts = allContacts;
                    } else {
                        window.showNotification(`Using ${contacts.length} personnel from Opening Meeting attendees.`, 'info');
                    }
                } else {
                    window.showNotification('No opening meeting attendees recorded. Using full client roster.', 'warning');
                }

                // Build contacts list with departments for AI context
                const contactList = contacts.map(c => {
                    let dept = '';
                    if (c.designation) {
                        const dm = desigs.find(d => (d.title || d) === c.designation);
                        if (dm && dm.department) dept = dm.department;
                    }
                    return { name: c.name, designation: c.designation || '', department: dept };
                });

                // Ask user: unfilled only or all items?
                const choice = await new Promise(resolve => {
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
                    overlay.innerHTML = `
                        <div style="background:white;border-radius:12px;padding:2rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                            <div style="text-align:center;margin-bottom:1.5rem;">
                                <i class="fa-solid fa-wand-magic-sparkles" style="font-size:2rem;background:linear-gradient(135deg,#8b5cf6,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;"></i>
                                <h3 style="margin:0.5rem 0 0.25rem;">AI Auto Map Personnel</h3>
                                <p style="color:#64748b;font-size:0.85rem;margin:0;">Choose which items to auto-assign</p>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:0.75rem;">
                                <button id="am-unfilled" class="btn" style="padding:0.75rem;border:2px solid #8b5cf6;background:#f5f3ff;border-radius:8px;cursor:pointer;font-weight:600;color:#6d28d9;" aria-label="Filter">
                                    <i class="fa-solid fa-filter" style="margin-right:0.5rem;"></i> Unfilled Items Only
                                </button>
                                <button id="am-all" class="btn" style="padding:0.75rem;border:2px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;font-weight:500;color:#334155;" aria-label="Refresh">
                                    <i class="fa-solid fa-arrows-rotate" style="margin-right:0.5rem;"></i> Re-map All Items
                                </button>
                                <button id="am-cancel" style="padding:0.5rem;border:none;background:none;cursor:pointer;color:#94a3b8;font-size:0.85rem;">Cancel</button>
                            </div>
                        </div>`;
                    document.body.appendChild(overlay);
                    overlay.querySelector('#am-unfilled').onclick = () => { document.body.removeChild(overlay); resolve('unfilled'); };
                    overlay.querySelector('#am-all').onclick = () => { document.body.removeChild(overlay); resolve('all'); };
                    overlay.querySelector('#am-cancel').onclick = () => { document.body.removeChild(overlay); resolve(null); };
                    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } };
                });

                if (!choice) return;

                // Collect NC items from the DOM
                const rows = document.querySelectorAll('.checklist-item');
                const itemsToMap = [];
                rows.forEach(row => {
                    const uniqueId = row.id?.replace('row-', '');
                    if (!uniqueId) return;
                    const personnelEl = document.getElementById('ncr-personnel-' + uniqueId);
                    if (!personnelEl) return; // No personnel field = not expanded NC form
                    const _desEl = document.getElementById('ncr-designation-' + uniqueId);
                    const _deptEl = document.getElementById('ncr-department-' + uniqueId);

                    // Check if already filled
                    const currentPersonnel = personnelEl.value || '';
                    if (choice === 'unfilled' && currentPersonnel) return;

                    // Get the question/clause context from the row
                    const clauseEl = row.querySelector('[style*="font-weight: bold"]');
                    const reqEl = row.querySelector('.requirement-text') || row.querySelector('[style*="line-height"]');
                    const clause = clauseEl?.textContent?.trim() || '';
                    const question = reqEl?.textContent?.trim() || '';

                    if (clause || question) {
                        itemsToMap.push({ uniqueId, clause, question: question.substring(0, 200) });
                    }
                });

                if (!itemsToMap.length) {
                    window.showNotification(choice === 'unfilled' ? 'All items already have personnel assigned!' : 'No items found to map.', 'info');
                    return;
                }

                // Show loading
                window.showNotification(`AI mapping ${itemsToMap.length} item(s)... Please wait.`, 'info');

                try {
                    const contactsDesc = contactList.map((c, i) =>
                        `${i + 1}. ${c.name} — ${c.designation || 'No designation'}${c.department ? ' (' + c.department + ')' : ''}`
                    ).join('\n');

                    const questionsDesc = itemsToMap.map(it =>
                        `{ "id": "${it.uniqueId}", "clause": "${it.clause}", "question": "${it.question.replace(/"/g, '\\"')}" }`
                    ).join(',\n');

                    const prompt = `You are an ISO audit expert. Given these client personnel:\n${contactsDesc}\n\nFor each audit question below, determine the most appropriate person(s) who would be responsible or interviewed for that area. You MUST distribute assignments across ALL available personnel based on their designation/role — do NOT assign the same person to every item.\n\nQuestions:\n[${questionsDesc}]\n\nRespond ONLY with a JSON array, no markdown, no explanation:\n[{"id":"...","personnel":"exact name","designation":"their designation","department":"their department"}]\n\nRules:\n- Use EXACT names from the personnel list\n- DISTRIBUTE across all personnel — each person should be assigned to the clauses matching their role\n- Match based on clause topic (e.g., quality clauses → quality roles, production → operations, HR → HR roles, management review → top management, IT/security → IT roles, documentation → document control)\n- Multiple questions in the same clause area should go to the same relevant person\n- Every person in the list should appear at least once if there are enough questions\n- Only use the most senior person as a fallback when no specific role matches`;

                    const response = await AI_SERVICE.callProxyAPI(prompt);

                    // Parse JSON from response
                    let mappings;
                    try {
                        const jsonStr = response.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
                        mappings = JSON.parse(jsonStr);
                    } catch (_e) {
                        // Try to extract JSON array
                        const match = response.match(/\[[\s\S]*\]/);
                        if (match) {
                            mappings = JSON.parse(match[0]);
                        } else {
                            throw new Error('Could not parse AI response');
                        }
                    }

                    // Apply mappings to DOM
                    let mapped = 0;
                    mappings.forEach(m => {
                        const pEl = document.getElementById('ncr-personnel-' + m.id);
                        const dEl = document.getElementById('ncr-designation-' + m.id);
                        const dpEl = document.getElementById('ncr-department-' + m.id);
                        if (pEl && m.personnel) {
                            // Set personnel dropdown — find matching option or add it
                            const opts = Array.from(pEl.options);
                            const match = opts.find(o => o.value === m.personnel);
                            if (match) {
                                pEl.value = m.personnel;
                            } else {
                                // Add the option if not found (shouldn't happen but safe)
                                const opt = document.createElement('option');
                                opt.value = m.personnel;
                                opt.textContent = m.personnel;
                                pEl.appendChild(opt);
                                pEl.value = m.personnel;
                            }
                            if (dEl) dEl.value = m.designation || '';
                            if (dpEl) dpEl.value = m.department || '';
                            mapped++;
                        }
                    });

                    window.showNotification(`AI Auto Map complete: ${mapped} of ${itemsToMap.length} items mapped successfully!`, 'success');

                } catch (error) {
                    console.error('AI Auto Map error:', error);
                    window.showNotification('AI Auto Map failed: ' + (error.message || 'Unknown error'), 'error');
                }
            };

            // Helper to render row
            const renderRow = (item, checklistId, idx, isCustom = false) => {
                const uniqueId = isCustom ? `custom-${idx}` : `${checklistId}-${idx}`;
                const saved = progressMap[uniqueId] || {};
                const s = saved.status || ''; // 'conform', 'nc', 'na' or ''

                // APPLY LOCAL OVERRIDES
                const getNestedReq = (obj) => { if (!obj || !obj.items || !obj.items[0]) return null; return obj.items[0].requirement; };
                let requirementText = item.requirement || item.text || item.title || item.requirement_text || getNestedReq(item) || 'No requirement text provided';
                if (overridesMap && overridesMap[checklistId] && overridesMap[checklistId][idx]) {
                    requirementText = overridesMap[checklistId][idx];
                }

                return `
                    <div class="card checklist-item" id="row-${uniqueId}" style="margin-bottom: 0.5rem; padding: 1rem; border-left: 4px solid #e2e8f0;">
                         <div style="display: grid; grid-template-columns: 30px 80px 1fr 180px; gap: 1rem; align-items: start;">
                            <div style="display: flex; align-items: center;">
                                <input type="checkbox" class="item-checkbox" data-unique-id="${uniqueId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select this item for bulk action">
                            </div>
                            <div style="font-weight: bold; color: var(--primary-color);">${item.clause || 'N/A'}</div>
                            <div>
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(requirementText)}</div>
                                <div style="position: relative;">
                                    <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.comment || '')}" style="margin-bottom: 0; padding-right: 35px;">
                                    <button type="button" id="mic-btn-${uniqueId}" data-action="startDictation" data-id="${uniqueId}" style="position: absolute; right: 0; top: 0; height: 100%; width: 35px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;" title="Dictate to Remarks">
                                        <i class="fa-solid fa-microphone"></i>
                                    </button>
                                </div>
                                ${saved._originalComment ? `
                                <div style="margin-top: 4px;">
                                    <button type="button" data-action="toggleOrigNotes" data-id="${uniqueId}" style="font-size:0.7rem;color:#8b5cf6;background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;">
                                        <i class="fa-solid fa-clock-rotate-left" style="font-size:0.65rem;"></i> <span>View Original Notes</span>
                                    </button>
                                    <div id="orig-note-${uniqueId}" style="display:none;margin-top:4px;padding:6px 10px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;font-size:0.78rem;color:#92400e;line-height:1.4;">
                                        <div style="font-weight:600;font-size:0.7rem;color:#b45309;margin-bottom:2px;"><i class="fa-solid fa-pen-nib" style="margin-right:4px;"></i>Original Auditor Notes:</div>
                                        ${window.UTILS.escapeHtml(saved._originalComment)}
                                    </div>
                                </div>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button type="button" class="btn-icon btn-na status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NA}" title="Not Applicable">N/A</button>
                                <button type="button" class="btn-icon btn-ok status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.CONFORM}" title="Conformity" aria-label="Confirm"><i class="fa fa-check"></i></button>
                                <button type="button" class="btn-icon btn-nc status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NC}" title="Non-Conformity" aria-label="Flag"><i class="fa fa-flag"></i></button>
                            </div>
                         </div>
                         
                         <!-- Evidence Photos (available for ALL statuses) -->
                         <div style="margin-top: 0.75rem; padding: 0.5rem 0.6rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                             <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                                 <label style="font-size: 0.78rem; font-weight: 600; color: #475569; margin: 0;"><i class="fa-solid fa-images" style="margin-right: 0.25rem; color: #6366f1;"></i>Evidence Photos</label>
                                 <div style="display: flex; gap: 4px;">
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #6366f1; color: white; border: none; border-radius: 4px;" data-action="clickElement" data-id="img-${uniqueId}" title="Upload image">
                                         <i class="fa-solid fa-file-image"></i> Upload
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #0ea5e9; color: white; border: none; border-radius: 4px;" data-action="handleCameraButton" data-id="${uniqueId}" title="Camera">
                                         <i class="fa-solid fa-camera"></i>
                                     </button>
                                     <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 0.72rem; background: #8b5cf6; color: white; border: none; border-radius: 4px;" data-action="captureScreenEvidence" data-id="${uniqueId}" title="Screen capture">
                                         <i class="fa-solid fa-desktop"></i>
                                     </button>
                                 </div>
                             </div>
                             <!-- Multi-image preview strip -->
                             <div id="evidence-preview-${uniqueId}" style="display: ${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'flex' : 'none'}; flex-wrap: wrap; gap: 6px; align-items: center;">
                                 ${(function () {
                        const imgs = saved.evidenceImages || (saved.evidenceImage ? [saved.evidenceImage] : []);
                        return imgs.map((src, imgIdx) => {
                            const isIdb = src.startsWith('idb://');
                            const displaySrc = isIdb ? '' : src;
                            const safeSrc = displaySrc.replace(/'/g, "\\'");
                            return `
                                         <div class="ev-thumb" data-idx="${imgIdx}" data-save-url="${window.UTILS.escapeHtml(src)}" style="position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;">
                                             <img src="${displaySrc}" data-idb-key="${isIdb ? window.UTILS.escapeHtml(src) : ''}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;${isIdb ? ' background: #e2e8f0;' : ''}" data-action="viewEvidenceImageByUrlSelf" data-id="${safeSrc}"/>
                                             <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${imgIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">×</button>
                                         </div>
                                     `;
                        }).join('');
                    })()}
                             </div>
                             <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                             <input type="file" id="cam-${uniqueId}" accept="image/*" capture="environment" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                             <input type="hidden" id="evidence-data-${uniqueId}" value="${(saved.evidenceImage || (saved.evidenceImages && saved.evidenceImages.length)) ? 'attached' : ''}">
                         </div>
                         
                         <!-- Hidden status input -->
                         <input type="hidden" class="status-input" data-checklist="${checklistId}" data-item="${idx}" data-custom="${isCustom}" data-clause="${window.UTILS.escapeHtml(item.clause || '')}" data-requirement="${window.UTILS.escapeHtml(requirementText || '')}" id="status-${uniqueId}" value="${s}">
                         
                         <!-- NCR Panel (Conditional) -->
                         <div id="ncr-panel-${uniqueId}" class="ncr-panel" style="display: ${s === 'nc' ? 'block' : 'none'}; background: #fff1f2; border: 1px solid #fecaca; padding: 1rem; margin-top: 1rem; border-radius: 6px;">
                             <h5 style="color: var(--danger-color); margin-bottom: 0.5rem; display: flex; align-items: center;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i> Finding Details</h5>
                             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Severity</label>
                                     <div style="display: flex; gap: 5px;">
                                         <select id="ncr-type-${uniqueId}" class="form-control form-control-sm">
                                             <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${!saved.ncrType || saved.ncrType === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation (OBS)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.OFI}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.OFI ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor NC</option>
                                             <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${saved.ncrType === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major NC</option>

                                         </select>
                                         <button type="button" class="btn btn-sm btn-info" data-action="toggleDisplay" data-id="criteria-${uniqueId}" title="View Classification Matrix (ISO 17021-1)">
                                            <i class="fa-solid fa-scale-balanced"></i>
                                         </button>
                                     </div>
                                     <div id="criteria-${uniqueId}" style="display: none; position: absolute; background: white; border: 1px solid #ccc; padding: 10px; z-index: 100; width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 4px; font-size: 0.8rem; margin-top: 5px;">
                                        <strong>ISO 17021-1 Criteria</strong>
                                        <div style="margin-top:5px; border-left: 3px solid var(--danger-color); padding-left: 5px; background: #fff5f5;">
                                            <strong>Major:</strong> ${window.CONSTANTS.NCR_CRITERIA.MAJOR.description}
                                        </div>
                                        <div style="margin-top:5px; border-left: 3px solid var(--warning-color); padding-left: 5px; background: #fffaf0;">
                                            <strong>Minor:</strong> ${window.CONSTANTS.NCR_CRITERIA.MINOR.description}
                                        </div>
                                        <div style="text-align: right; margin-top: 5px;"><small style="color: blue; cursor: pointer;" data-action="hideGrandparent">Close</small></div>
                                     </div>
                                 </div>
                                 </div>
                             </div>
                             
                             <!-- Cross-Reference: Personnel, Designation & Department -->
                             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.5rem;">
                                 <div>
                                     <label style="font-size: 0.8rem;">Personnel Name</label>
                                     <select id="ncr-personnel-${uniqueId}" class="form-control form-control-sm" data-action-change="_autoFillPersonnel" data-id="${uniqueId}">
                                        <option value="">-- Select --</option>
                                        ${clientPersonnel.map(p => `<option value="${window.UTILS.escapeHtml(p.name)}" ${saved.personnel === p.name ? 'selected' : ''}>${window.UTILS.escapeHtml(p.name)}</option>`).join('')}
                                        ${saved.personnel && !clientPersonnel.some(p => p.name === saved.personnel) ? `<option value="${window.UTILS.escapeHtml(saved.personnel)}" selected>${window.UTILS.escapeHtml(saved.personnel)}</option>` : ''}
                                     </select>
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Designation</label>
                                     <input type="text" id="ncr-designation-${uniqueId}" class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.designation || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                                 </div>
                                 <div>
                                     <label style="font-size: 0.8rem;">Department</label>
                                     <input type="text" id="ncr-department-${uniqueId}" class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.department || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                                 </div>
                             </div>
                             


                         </div>
                    </div>
                `;
            };

            let checklistHTML;

            if (assignedChecklists.length > 0) {
                checklistHTML = assignedChecklists.map(checklist => {
                    // Support both old (items) and new (clauses) format
                    const useClauses = checklist.clauses && checklist.clauses.length > 0;

                    if (useClauses) {
                        // New hierarchical format with accordion
                        let itemIdx = 0;

                        // Apply saved clause order if available
                        let orderedClauses = [...checklist.clauses];
                        const savedOrder = report.clauseOrder;
                        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
                            orderedClauses.sort((a, b) => {
                                const idA = `${checklist.id}-${a.mainClause}`;
                                const idB = `${checklist.id}-${b.mainClause}`;
                                const posA = savedOrder.indexOf(idA);
                                const posB = savedOrder.indexOf(idB);
                                // Items not in savedOrder go to the end, in original order
                                return (posA === -1 ? 9999 : posA) - (posB === -1 ? 9999 : posB);
                            });
                        }

                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; margin-bottom: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    <i class="fa-solid fa-clipboard-list" style="color: var(--primary-color); -webkit-text-fill-color: #667eea;"></i> ${checklist.name}
                                </h4>
                                ${orderedClauses.map((clause, clauseIdx) => {
                            const allowedIds = selectionMap[checklist.id];
                            const isSelective = Array.isArray(allowedIds) && allowedIds.length > 0;

                            // Filter valid items first
                            const itemsToRender = clause.subClauses
                                .map((item, subIdx) => ({ item, itemId: `${clause.mainClause}-${subIdx}` }))
                                .filter(obj => !isSelective || allowedIds.includes(obj.itemId));

                            if (itemsToRender.length === 0) return ''; // Skip empty clauses

                            const sectionId = `clause-${checklist.id}-${clause.mainClause}`;
                            const renderedItems = itemsToRender.map(obj => {
                                const _globalIdx = itemIdx++;
                                return renderRow(obj.item, checklist.id, obj.itemId, false);
                            }).join('');

                            // Calculate progress for this section
                            const sectionProgress = itemsToRender.map(obj => {
                                const key = `${checklist.id}-${obj.itemId}`;
                                return progressMap[key]?.status || '';
                            });
                            const completed = sectionProgress.filter(s => s === 'conform' || s === 'nc' || s === 'na').length;
                            const total = itemsToRender.length;
                            const _progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                            return `
                                        <div class="accordion-section" data-clause-id="${checklist.id}-${clause.mainClause}" style="margin-bottom: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                            <div class="accordion-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: linear-gradient(to right, #f8fafc, #f1f5f9); user-select: none;">
                                                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                                                    <span class="clause-drag-handle" style="cursor: grab; color: #94a3b8; padding: 0 4px; font-size: 1rem;" title="Drag to reorder section"><i class="fa-solid fa-grip-vertical"></i></span>
                                                    <input type="checkbox" class="section-checkbox" data-section-id="${sectionId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select all items in this section">
                                                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; cursor: pointer;" data-action="toggleAccordion" data-id="${sectionId}">${clause.mainClause}</span>
                                                    <span style="font-weight: 600; color: #1e293b; cursor: pointer; flex: 1;" data-action="toggleAccordion" data-id="${sectionId}">${clause.title}</span>
                                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">(${total} items)</span>
                                                </div>
                                                <div style="display: flex; align-items: center; gap: 1rem;">
                                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${completed}/${total}</span>
                                                    <i class="fa-solid fa-chevron-down accordion-icon" id="icon-${sectionId}" style="transition: transform 0.3s; cursor: pointer;" data-action="toggleAccordion" data-id="${sectionId}"></i>
                                                </div>
                                            </div>
                                            <div class="accordion-content" id="${sectionId}" style="display: ${clauseIdx === 0 ? 'block' : 'none'}; padding: 1rem; background: white;">
                                                ${renderedItems}
                                            </div>
                                        </div>
                                    `;
                        }).join('')}
                            </div>
                        `;
                    } else {
                        // Fallback for old flat format
                        return `
                            <div style="margin-bottom: 2rem;">
                                <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: var(--primary-color);">
                                    ${checklist.name}
                                </h4>
                                ${(checklist.items || []).map((item, idx) => renderRow(item, checklist.id, idx, false)).join('')}
                            </div>
                        `;
                    }
                }).join('');
            } else {
                checklistHTML = `<div class="alert alert-warning" style="display:flex;align-items:flex-start;gap:1rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;color:#d97706;margin-top:2px;"></i>
                    <div>
                        <strong>No configured checklists found.</strong>
                        <p style="margin:0.5rem 0 0;color:#6b7280;font-size:0.9rem;">To add checklists:<br>
                        1. Go to <strong>Plans & Audits</strong> → select this audit plan<br>
                        2. Under <strong>Checklist Selection</strong>, choose the applicable standard checklist(s)<br>
                        3. Return here and refresh the page</p>
                    </div>
                </div>`;
            }

            // Custom Items Section
            if (customItems.length > 0) {
                checklistHTML += `
                    <div style="margin-bottom: 2rem; margin-top: 2rem;">
                         <h4 style="border-bottom: 2px solid var(--warning-color); padding-bottom: 0.5rem; margin-bottom: 1rem; color: #d97706;">
                            <i class="fa-solid fa-pen-to-square"></i> Custom Audit Questions
                        </h4>
                        ${customItems.map((item, idx) => renderRow(item, 'custom', idx, true)).join('')}
                    </div>
                `;
            }



            tabContent.innerHTML = `
                <style>
                    .btn-icon { border: 1px solid #d1d5db; background: white; width: 32px; height: 32px; border-radius: 4px; color: #6b7280; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s; cursor: pointer; }
                    .btn-icon:hover { background: #f3f4f6; }
                    .btn-icon.active { transform: scale(1.1); font-weight: bold; border-color: transparent; }
                    .btn-icon.btn-ok.active { background: var(--success-color); color: white; }
                    .btn-icon.btn-nc.active { background: var(--danger-color); color: white; }
                    .btn-icon.btn-na.active { background: #9ca3af; color: white; }
                    .checklist-item:focus-within { border-color: var(--primary-color) !important; background: #f0f9ff !important; }
                    .checklist-item.filtered-out { display: none !important; }
                    .progress-ring { transform: rotate(-90deg); }
                    .progress-ring-circle { transition: stroke-dashoffset 0.5s; }
                    .filter-btn { padding: 0.5rem 1rem; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
                    .filter-btn:hover { background: #f8fafc; }
                    .filter-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                    .save-indicator { position: fixed; bottom: 20px; right: 20px; background: #10b981; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 1000; animation: slideIn 0.3s; }
                    @keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    .keyboard-hint { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; z-index: 999; }
                </style>
                <div>


                    <!-- Filters & Actions Bar -->
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100;">

                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline-secondary" id="toggle-all-accordions" data-action="toggleAllAccordions" title="Collapse/Expand all sections">
                                <i class="fa-solid fa-compress-alt" style="margin-right: 0.5rem;"></i> <span>Collapse All</span>
                            </button>
                            <button class="btn btn-secondary" data-action="addCustomQuestion" data-id="${report.id}" aria-label="Add">
                                <i class="fa-solid fa-plus-circle" style="margin-right: 0.5rem;"></i> Add Question
                            </button>
                            <div style="position: relative;">
                                <button class="btn btn-outline-secondary" data-action="toggleHidden" data-id="bulk-menu-${report.id}" aria-label="Checklist">
                                    <i class="fa-solid fa-list-check" style="margin-right: 0.5rem;"></i> Bulk Actions
                                </button>
                                <div id="bulk-menu-${report.id}" class="hidden" style="position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px; z-index: 1000;">
                                    <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Mark Items As:</div>
                                    </div>
                                    <button class="bulk-action-btn" data-action="conform" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" aria-label="Confirm">
                                        <i class="fa-solid fa-check" style="color: var(--success-color); width: 18px;"></i>
                                        <span>Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="nc" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;" aria-label="Flag">
                                        <i class="fa-solid fa-flag" style="color: var(--danger-color); width: 18px;"></i>
                                        <span>Non-Conform</span>
                                    </button>
                                    <button class="bulk-action-btn" data-action="na" data-report-id="${report.id}" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                                        <i class="fa-solid fa-ban" style="color: #9ca3af; width: 18px;"></i>
                                        <span>Not Applicable</span>
                                    </button>
                                    <div style="border-top: 1px solid #e2e8f0; padding: 0.75rem 1rem;">
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-info-circle"></i> Select items to limit scope
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-outline-secondary" data-action="autoMapPersonnel" data-id="${report.id}" title="AI auto-assign personnel, designation & department to items" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none;" aria-label="Auto-generate">
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto Map
                            </button>
                            <button class="btn btn-primary" data-action="saveChecklist" data-id="${report.id}" id="save-progress-btn" aria-label="Save">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Progress
                            </button>
                            ${(report.checklistRevisions && report.checklistRevisions.length > 0) ? `
                            <span id="revision-badge" title="${report.checklistRevisions.map(r => 'v' + r.rev + ' — ' + new Date(r.timestamp).toLocaleString()).join('\n')}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:0.75rem;font-weight:600;color:#166534;cursor:help;">
                                <i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${report.checklistRevisions.length}
                            </span>` : ''}
                        </div>
                    </div>

                    ${checklistHTML}
                    
                    <div style="text-align: center; margin-top: 2rem; padding: 2rem; background: #f8fafc; border-radius: 8px;">
                        <button class="btn btn-primary btn-lg" data-action="saveChecklist" data-id="${report.id}">
                            <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Save All Progress
                        </button>
                    </div>
                </div>

                <!-- Save Indicator -->
                <div class="save-indicator" id="save-indicator">
                    <i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Progress Saved
                </div>

            `;

            // Setup event delegation for section checkboxes & bulk actions
            setTimeout(() => {
                document.querySelectorAll('.section-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function (e) {
                        e.stopPropagation();
                        const sectionId = this.getAttribute('data-section-id');
                        window.Logger.debug('Execution', 'Checkbox clicked for section:', sectionId);
                        window.toggleSectionSelection(sectionId, this);

                        // Sync individual item checkboxes
                        const section = document.getElementById(sectionId);
                        if (section) {
                            section.querySelectorAll('.item-checkbox').forEach(cb => {
                                cb.checked = this.checked;
                            });
                        }
                    });
                });

                // Item checkbox listener
                document.querySelectorAll('.item-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', function () {
                        const uniqueId = this.getAttribute('data-unique-id');
                        const item = document.getElementById('row-' + uniqueId);
                        if (this.checked) {
                            item.classList.add('selected-item');
                            item.style.background = '#eff6ff';
                            item.style.borderLeft = '4px solid var(--primary-color)';
                        } else {
                            item.classList.remove('selected-item');
                            item.style.background = '';
                            item.style.borderLeft = '4px solid #e2e8f0';
                        }
                    });
                });

                // Init clause section drag-to-reorder
                if (window.initClauseDragReorder) window.initClauseDragReorder();

                // Setup bulk action button listeners
                document.querySelectorAll('.bulk-action-btn').forEach(btn => {
                    btn.addEventListener('click', function () {
                        const action = this.getAttribute('data-action');
                        const reportId = parseInt(this.getAttribute('data-report-id'), 10);
                        window.Logger.debug('Execution', 'Bulk action clicked:', { action, reportId });
                        window.bulkUpdateStatus(reportId, action);
                    });
                });

                // CRITICAL: Restore saved status to buttons after render
                document.querySelectorAll('.status-input').forEach(input => {
                    const uniqueId = input.id.replace('status-', '');
                    const savedStatus = input.value; // 'conform', 'nc', 'na', or ''

                    if (savedStatus) {
                        // Apply active state to the corresponding button
                        window.setChecklistStatus(uniqueId, savedStatus);
                    }
                });
            }, 100);

            break;
        }

        case 'ncr': {
            // Combine Manual NCRs and Checklist-marked NCs for real-time display
            const manualNCRs = report.ncrs || [];

            // Get checklist-marked NCs from checklistProgress
            const checklistNCRs = (report.checklistProgress || [])
                .filter(item => item.status === 'nc')
                .map((item, _idx) => {
                    // Resolve clause from checklist definition
                    let clauseText = 'Checklist Item';
                    let reqText = '';
                    const { assignedChecklists = [] } = contextData;

                    if (item.checklistId && assignedChecklists.length > 0) {
                        const cl = assignedChecklists.find(c => String(c.id) === String(item.checklistId));
                        if (cl) {
                            if (cl.clauses && (String(item.itemIdx).includes('-'))) {
                                const [mainClauseVal, subIdxVal] = String(item.itemIdx).split('-');
                                const mainObj = cl.clauses.find(m => m.mainClause === mainClauseVal);
                                if (mainObj && mainObj.subClauses && mainObj.subClauses[subIdxVal]) {
                                    clauseText = mainObj.subClauses[subIdxVal].clause || `Clause ${mainClauseVal}`;
                                    reqText = mainObj.subClauses[subIdxVal].requirement || '';
                                }
                            } else if (cl.items && cl.items[item.itemIdx]) {
                                clauseText = cl.items[item.itemIdx].clause || 'Checklist Item';
                                reqText = cl.items[item.itemIdx].requirement || '';
                            }
                        }
                    } else if (item.isCustom) {
                        const customItem = (report.customItems || [])[item.itemIdx];
                        if (customItem) {
                            clauseText = customItem.clause || 'Custom Question';
                            reqText = customItem.requirement || '';
                        }
                    }

                    return {
                        type: item.ncrType || window.CONSTANTS.NCR_TYPES.OBSERVATION,
                        clause: clauseText,
                        description: item.ncrDescription || item.comment || reqText || 'Non-conformity identified in checklist',
                        status: 'Open',
                        source: 'checklist',
                        department: item.department || '',
                        designation: item.designation || '',
                        evidenceImage: item.evidenceImage
                    };
                });

            // Combine all NCRs
            const allNCRs = [
                ...manualNCRs.map(ncr => ({ ...ncr, source: 'manual' })),
                ...checklistNCRs
            ];

            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <div>
                            <h3>Non-Conformity Reports (NCRs)</h3>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">
                                Showing ${allNCRs.length} finding(s) - ${manualNCRs.length} manual, ${checklistNCRs.length} from checklist
                            </p>
                        </div>
                        <button class="btn btn-primary" data-action="createNCR" data-id="${report.id}" aria-label="Add">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create NCR
                        </button>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>NCR #</th>
                                    <th>Source</th>
                                    <th>Type</th>
                                    <th>Clause</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allNCRs.length > 0 ? allNCRs.map((ncr, idx) => `
                                    <tr>
                                        <td>NCR-${String(idx + 1).padStart(3, '0')}</td>
                                        <td><span style="background: ${ncr.source === 'manual' ? '#3b82f6' : '#8b5cf6'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${ncr.source === 'manual' ? 'Manual' : 'Checklist'}</span></td>
                                        <td><span style="background: ${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'var(--danger-color)' : ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'var(--warning-color)' : '#9ca3af'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'Major' : ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'Minor' : 'Obs'}</span></td>
                                        <td>${window.UTILS.escapeHtml(ncr.clause || '-')}</td>
                                        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UTILS.escapeHtml(ncr.description || '-')}">${window.UTILS.escapeHtml(ncr.description || '-')}</td>
                                        <td><span style="background: ${ncr.status === window.CONSTANTS.STATUS.CLOSED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${ncr.status || 'Open'}</span></td>
                                        <td>${ncr.source === 'manual'
                    ? `<button class="btn btn-sm" style="color: var(--primary-color);" data-action="editNCR" data-arg1="${report.id}" data-arg2="${idx - checklistNCRs.length < 0 ? idx : idx}" aria-label="Edit"><i class="fa-solid fa-edit"></i></button>`
                    : `<button class="btn btn-sm" style="color: #8b5cf6;" title="Edit in Checklist tab" data-action="showNotification" data-arg1="Edit this NCR in the Checklist tab where it was raised" data-arg2="info"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
                }</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                            <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
                                            No NCRs raised yet. Mark items as NC in the Checklist tab or click "Create NCR" to add manually.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;
        }

        case 'capa': {
            const capas = report.capas || [];
            tabContent.innerHTML = `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Corrective & Preventive Actions (CAPA)</h3>
                        <button class="btn btn-primary" data-action="createCAPA" data-id="${report.id}" aria-label="Add">
                            <i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create CAPA
                        </button>
                    </div>
                    
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>CAPA #</th>
                                    <th>Linked NCR</th>
                                    <th>Root Cause</th>
                                    <th>Action Plan</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${capas.length > 0 ? capas.map((capa, idx) => `
                                    <tr>
                                        <td>CAPA-${String(idx + 1).padStart(3, '0')}</td>
                                        <td>${capa.linkedNCR || '-'}</td>
                                        <td>${capa.rootCause || '-'}</td>
                                        <td>${capa.actionPlan || '-'}</td>
                                        <td>${capa.dueDate || '-'}</td>
                                        <td><span style="background: ${capa.status === window.CONSTANTS.STATUS.COMPLETED ? 'var(--success-color)' : 'var(--warning-color)'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${capa.status || window.CONSTANTS.STATUS.IN_PROGRESS}</span></td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No CAPAs created yet</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;
        }

        case 'observations':
            // Redirect to Unified Review Tab
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab for unified reporting.</div>`;
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'review': {
            // UNIFIED DASHBOARD: MERGES REVIEW & SUMMARY
            // Auditor's Findings Review & Final Submission Screen
            const allFindings = [];
            // Cache evidence images for viewing from Review tab
            if (!window._evidenceCache) window._evidenceCache = {};

            // Destructure for lookup
            const { assignedChecklists = [] } = contextData;

            // Known bad values from old DOM scraping — filter these out
            const BAD_VALUES = ['severity', 'non-conformity details', 'personnel name', 'department', 'evidence image', 'upload', 'camera', 'screen'];
            const isBadValue = (v) => !v || BAD_VALUES.includes(v.toLowerCase().trim());

            // Collect checklist NCs — use original index into checklistProgress
            (report.checklistProgress || []).forEach((item, originalIdx) => {
                if (item.status !== 'nc') return;
                // Use shared helper for clause/requirement resolution
                let { clauseText, reqText } = window.KB_HELPERS.resolveChecklistClause(item, assignedChecklists);

                // Fallback: use clause/requirement saved directly on the progress item
                // BUT only if the saved values are not corrupted (from old DOM scraping)
                if (!clauseText && item.clause && !isBadValue(item.clause)) clauseText = item.clause;
                if (!reqText && item.requirement && !isBadValue(item.requirement)) reqText = item.requirement;

                // KB Lookup: Get actual ISO Standard requirement text from Knowledge Base
                const kbMatch = window.KB_HELPERS.lookupKBRequirement(clauseText, report.standard);

                allFindings.push({
                    id: `checklist-${originalIdx}`,
                    source: 'Checklist',
                    type: item.ncrType || 'observation',
                    // Don't repeat reqText here — it's already shown in the requirement box above
                    description: item.ncrDescription || item.comment || item.transcript || '',
                    remarks: item.comment || item.transcript || '',
                    designation: item.designation || '',
                    department: item.department || '',
                    hasEvidence: !!(item.evidenceImage || (item.evidenceImages && item.evidenceImages.length)),
                    evidenceImage: item.evidenceImage,
                    evidenceImages: item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []),
                    clause: clauseText,
                    requirement: reqText && !isBadValue(reqText) ? reqText : '',
                    kbMatch: kbMatch
                });
                const evImgs = item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : []);
                if (evImgs.length) window._evidenceCache[`checklist-${originalIdx}`] = evImgs;
            });

            // Collect manual NCRs
            (report.ncrs || []).forEach((ncr, idx) => {
                allFindings.push({
                    id: `ncr-${idx}`,
                    source: 'Manual',
                    type: ncr.type || 'observation',
                    description: ncr.description || '',
                    remarks: ncr.remarks || '',
                    designation: ncr.designation || '',
                    department: ncr.department || '',
                    hasEvidence: !!ncr.evidenceImage,
                    evidenceImage: ncr.evidenceImage
                });
                if (ncr.evidenceImage) window._evidenceCache[`ncr-${idx}`] = ncr.evidenceImage;
            });

            const isReadyToSubmit = allFindings.length === 0 || allFindings.every(f => f.type !== 'pending');
            const currentUserRole = window.state.currentUser?.role || 'Auditor';
            const canOneClickFinalize = ['Lead Auditor', 'Admin', 'Certification Manager', 'Manager'].includes(currentUserRole);

            let primaryActionBtn;

            if (report.status === window.CONSTANTS.STATUS.FINALIZED || report.status === window.CONSTANTS.STATUS.PUBLISHED) {
                primaryActionBtn = `
                    <button class="btn btn-secondary" data-action="generateAuditReport" data-id="${report.id}" aria-label="Export PDF">
                        <i class="fa-solid fa-file-pdf" style="margin-right: 0.5rem;"></i> Download PDF
                    </button>
                `;
            } else if (canOneClickFinalize) {
                primaryActionBtn = `
                    <button class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.4);" data-action="finalizeAndPublish" data-id="${report.id}" ${!isReadyToSubmit ? 'disabled' : ''}>
                        <i class="fa-solid fa-check-double" style="margin-right: 0.5rem;"></i> Finalize & Publish
                    </button>
                `;
            } else {
                primaryActionBtn = `
                   <button class="btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none;" data-action="submitToLeadAuditor" data-id="${report.id}" ${!isReadyToSubmit ? 'disabled' : ''} aria-label="Send">
                        <i class="fa-solid fa-paper-plane" style="margin-right: 0.5rem;"></i> Submit for Review
                    </button>
                `;
            }


            tabContent.innerHTML = `
                <div class="card" style="border-top: 4px solid var(--primary-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.5rem; background: linear-gradient(90deg, #1e293b, #475569); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                <i class="fa-solid fa-flag-checkered" style="color: var(--primary-color); -webkit-text-fill-color: initial; margin-right: 0.5rem;"></i> Audit Finalization
                            </h3>
                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.95rem;">Review findings, generate AI summaries, and finalize the report.</p>
                        </div>
                        <div style="display: flex; gap: 0.75rem;">
                             <button class="btn btn-outline-secondary" data-action="saveChecklist" data-id="${report.id}" aria-label="Save">
                                <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i> Save Draft
                            </button>
                            ${primaryActionBtn}
                        </div>
                    </div>

                    <!-- 1. High Level Stats -->
                     <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #3b82f6; line-height: 1;">${allFindings.length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Total Findings</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fee2e2; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #dc2626; line-height: 1;">${allFindings.filter(f => f.type === 'major').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Major NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #fef3c7; box-shadow: 0 1px 3px rgba(217, 119, 6, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #d97706; line-height: 1;">${allFindings.filter(f => f.type === 'minor').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Minor NC</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #f3e8ff; box-shadow: 0 1px 3px rgba(139, 92, 246, 0.05);">
                            <div style="font-size: 2rem; font-weight: 800; color: #8b5cf6; line-height: 1;">${allFindings.filter(f => f.type === 'observation').length}</div>
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 0.5rem;">Observations</div>
                        </div>
                    </div>
                    
                    <!-- 2. Findings Review -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Findings & Classification</h4>
                            <button id="btn-ai-classify" class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); border: none;" data-action="runFollowUpAIAnalysis" data-id="${report.id}" aria-label="Auto-generate">
                                <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem;"></i> AI Auto-Classify & Polish
                            </button>
                        </div>

                         ${allFindings.length > 0 ? `
                        <div style="max-height: 600px; overflow-y: auto; padding-right: 5px;">
                            ${allFindings.map((f, idx) => `
                                <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; border-left: 5px solid ${f.type === 'major' ? '#dc2626' : f.type === 'minor' ? '#d97706' : '#8b5cf6'}; transition: transform 0.2s;">
                                    <div style="display: grid; grid-template-columns: 1fr 180px 250px; gap: 1.5rem; align-items: start;">
                                        <!-- Finding Details Column -->
                                        <div>
                                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                                <span style="background: #f1f5f9; color: #475569; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${f.source}</span>
                                                <span style="font-weight: 700; color: #1e293b;">#${idx + 1}</span>
                                                ${f.hasEvidence ? `<span data-action="viewEvidenceImageDirect" data-id="${f.id}" style="cursor: pointer; color: var(--primary-color); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-image"></i> View Evidence</span>` : ''}
                                            </div>
                                            ${f.clause || f.requirement ? `
                                                <div style="font-size: 0.85rem; padding: 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 0.75rem;">
                                                    <strong style="color: var(--primary-color);">${f.clause ? `${f.clause}` : 'Requirement'}:</strong> 
                                                    <span style="color: #334155;">${f.requirement || ''}</span>
                                                </div>
                                            ` : ''}
                                            ${f.kbMatch ? `
                                                <div style="font-size: 0.8rem; padding: 0.5rem 0.75rem; background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 6px; border-left: 3px solid #3b82f6; margin-bottom: 0.75rem; color: #1e40af;">
                                                    <strong><i class="fa-solid fa-book" style="margin-right: 4px;"></i>${f.kbMatch.standardName || 'ISO Standard'} — Clause ${f.kbMatch.clause}${f.kbMatch.title ? ': ' + f.kbMatch.title : ''}</strong>
                                                    <div style="margin-top: 4px; color: #334155; font-style: italic; line-height: 1.5;">${f.kbMatch.requirement}</div>
                                                </div>
                                            ` : ''}
                                            <div style="font-weight: 500; color: #334155; line-height: 1.5; margin-bottom: 0.5rem;">${f.description}</div>
                                            ${f.designation || f.department ? `
                                                <div style="font-size: 0.8rem; color: #64748b; display: flex; gap: 1rem;">
                                                    <span><i class="fa-solid fa-user" style="width: 14px;"></i> ${f.designation || '-'}</span> 
                                                    <span><i class="fa-solid fa-building" style="width: 14px;"></i> ${f.department || '-'}</span>
                                                </div>
                                            ` : ''}
                                        </div>
                                        <!--Severity Column-->
                                        <div>
                                            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Severity Classification</label>
                                            <select class="form-control form-control-sm review-severity" data-finding-id="${f.id}" style="font-size: 0.9rem; padding: 0.4rem;">
                                                <option value="observation" ${f.type === 'observation' ? 'selected' : ''}>Observation (OBS)</option>
                                                <option value="ofi" ${f.type === 'ofi' ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                                                <option value="minor" ${f.type === 'minor' ? 'selected' : ''}>Minor NC</option>
                                                <option value="major" ${f.type === 'major' ? 'selected' : ''}>Major NC</option>
                                            </select>
                                        </div>
                                        <!--Remarks Column-->
            <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.4rem; font-weight: 600;">Auditor Remarks / Notes</label>
                <textarea class="form-control form-control-sm review-remarks" data-finding-id="${f.id}" placeholder="Justification or internal notes..." rows="3" style="font-size: 0.85rem;">${f.remarks || ''}</textarea>
            </div>

                                    </div >
                                </div >
                `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 4rem 2rem; background: #f8fafc; border-radius: 12px; border: 2px dashed #e2e8f0;">
                            <div style="width: 64px; height: 64px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; font-size: 2rem;">
                                <i class="fa-solid fa-check"></i>
                            </div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.2rem;">Detailed Audit Complete!</h4>
                            <p style="color: #64748b; margin: 0; max-width: 400px; margin: 0 auto;">No non-conformities were raised during this audit. You can proceed to generate the summary confirming full compliance.</p>
                        </div>
                    `}
                    </div>

                    <!-- 3. Executive Summary Generation -->
                    <div style="background: linear-gradient(to right, #f8fafc, #f1f5f9); padding: 2rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">
                                <i class="fa-solid fa-pen-nib" style="margin-right: 0.5rem; color: var(--primary-color);"></i> Executive Summary & Reporting
                            </h4>
                             <button class="btn btn-sm btn-info" style="color: white; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border: none;" data-action="runAutoSummary" data-id="${report.id}" aria-label="AI assist">
                                <i class="fa-solid fa-robot" style="margin-right: 0.5rem;"></i> AI Draft Summary
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                             <!-- Executive Summary -->
                             <div>
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Executive Summary</label>
                                <textarea id="exec-summary-${report.id}" class="form-control" rows="5" placeholder="Overall conclusion on the effectiveness of the management system...">${report.executiveSummary || ''}</textarea>
                             </div>
                        </div>

                         <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Positive Observations</h4>
                                <textarea id="positive-observations" class="form-control" rows="4" placeholder="Document good practices and positive findings...">${report.positiveObservations || ''}</textarea>
                            </div>
                            <div>
                                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Opportunities for Improvement</h4>
                                <textarea id="ofi" class="form-control" rows="4" placeholder="Suggestions for improvement (not non-conformities)...">${report.ofi || ''}</textarea>
                            </div>
                        </div>
                        

                        <!-- Meeting Records Summary (from Meetings Tab) -->
                        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <h4 style="font-size: 0.95rem; margin: 0; color: var(--text-secondary); text-transform: uppercase;">Meeting Records</h4>
                                <button class="btn btn-sm btn-outline-primary" data-action="clickTab" data-id="meetings" aria-label="Edit">
                                    <i class="fa-solid fa-pen" style="margin-right: 0.25rem;"></i>Edit in Meetings Tab
                                </button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #2563eb;"><i class="fa-solid fa-door-open" style="margin-right: 0.25rem;"></i>Opening Meeting</label>
                                    ${report.openingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${report.openingMeeting.date} ${report.openingMeeting.time || ''}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.openingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a.name}${a.role ? ' - ' + a.role : ''}${a.organization ? ' (' + a.organization + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${att}</div>`; })()}
                                </div>
                                <div style="background: #fff7ed; padding: 1rem; border-radius: 8px; border: 1px dashed #fdba74;">
                                    <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; color: #ea580c;"><i class="fa-solid fa-door-closed" style="margin-right: 0.25rem;"></i>Closing Meeting</label>
                                    ${report.closingMeeting?.date ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;"><strong>Date:</strong> ${report.closingMeeting.date} ${report.closingMeeting.time || ''}</div>` : '<div style="font-size: 0.85rem; color: #94a3b8;">Not recorded yet</div>'}
                                    ${(() => { const att = report.closingMeeting?.attendees; if (!att) return ''; if (Array.isArray(att)) return '<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong></div>' + att.map(a => typeof a === 'object' ? `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a.name}${a.role ? ' - ' + a.role : ''}${a.organization ? ' (' + a.organization + ')' : ''}</div>` : `<div style="font-size: 0.8rem; padding: 0.15rem 0;">• ${a}</div>`).join(''); return `<div style="font-size: 0.8rem; margin-top: 0.5rem;"><strong>Attendees:</strong> ${att}</div>`; })()}
                                </div>
                            </div>
                        </div>

                        <!-- Audit Conclusion / Recommendation -->
                             <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #cbd5e1;">
                                <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; display: block;">Audit Conclusion & Recommendation</label>
                                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Recommended" ${report.recommendation === 'Recommended' ? 'checked' : ''} data-action-change="setReportRecommendation" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Recommended for Certification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Pending" ${report.recommendation === 'Pending' ? 'checked' : ''} data-action-change="setReportRecommendation" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Recommended Pending Plan Verification</span>
                                    </label>
                                    <label style="display: flex; align-items: center; cursor: pointer;">
                                        <input type="radio" name="recommendation-${report.id}" value="Not Recommended" ${report.recommendation === 'Not Recommended' ? 'checked' : ''} data-action-change="setReportRecommendation" data-id="${report.id}">
                                        <span style="margin-left: 0.5rem;">Not Recommended (Major NCs)</span>
                                    </label>
                                </div>
                             </div>
                    </div>

                </div>
            `;

            // Auto-save severity changes and update stats in real-time
            setTimeout(() => {
                document.querySelectorAll('.review-severity').forEach(select => {
                    select.addEventListener('change', function () {
                        const findingId = this.dataset.findingId;
                        const newType = this.value;

                        // Update data model immediately
                        if (findingId.startsWith('checklist-')) {
                            const idx = parseInt(findingId.replace('checklist-', ''), 10);
                            if (report.checklistProgress && report.checklistProgress[idx]) {
                                report.checklistProgress[idx].ncrType = newType;
                            }
                        } else if (findingId.startsWith('ncr-')) {
                            const idx = parseInt(findingId.replace('ncr-', ''), 10);
                            if (report.ncrs && report.ncrs[idx]) {
                                report.ncrs[idx].type = newType;
                            }
                        }

                        // Update card border color
                        const card = this.closest('.card');
                        if (card) {
                            const colors = window.CONSTANTS.NCR_COLORS;
                            card.style.borderLeftColor = colors[newType] || '#8b5cf6';
                        }

                        // Update stat counters
                        const allSelects = document.querySelectorAll('.review-severity');
                        let majors = 0, minors = 0, obs = 0, ofis = 0;
                        allSelects.forEach(s => {
                            if (s.value === 'major') majors++;
                            else if (s.value === 'minor') minors++;
                            else if (s.value === 'observation') obs++;
                            else if (s.value === 'ofi') ofis++;
                        });
                        const statDivs = tabContent.querySelectorAll('[style*="text-align: center"]');
                        if (statDivs.length >= 4) {
                            statDivs[0].querySelector('div').textContent = allSelects.length;
                            statDivs[1].querySelector('div').textContent = majors;
                            statDivs[2].querySelector('div').textContent = minors;
                            statDivs[3].querySelector('div').textContent = obs + ofis;
                        }

                        // Auto-save
                        window.saveData();
                        window.showNotification('Severity updated', 'success');
                    });
                });

                // Auto-save remarks on blur
                document.querySelectorAll('.review-remarks').forEach(textarea => {
                    textarea.addEventListener('blur', function () {
                        const findingId = this.dataset.findingId;
                        const remarks = this.value;

                        if (findingId.startsWith('checklist-')) {
                            const idx = parseInt(findingId.replace('checklist-', ''), 10);
                            if (report.checklistProgress && report.checklistProgress[idx]) {
                                report.checklistProgress[idx].comment = remarks;
                            }
                        } else if (findingId.startsWith('ncr-')) {
                            const idx = parseInt(findingId.replace('ncr-', ''), 10);
                            if (report.ncrs && report.ncrs[idx]) {
                                report.ncrs[idx].description = remarks;
                            }
                        }
                        window.saveData();
                    });
                });
            }, 100);
        }
            break;

        case 'summary':
            // LEGACY: Redirect to Finalization or Show Simplified View
            tabContent.innerHTML = `<div class="alert alert-info">Moved to <strong>Finalization</strong> tab.</div>`;
            // Auto switch
            setTimeout(() => {
                document.querySelector('.tab-btn[data-tab="review"]').click();
            }, 500);
            break;

        case 'meetings': {
            // ISO 17021-1 Opening/Closing Meeting Records
            const openingMeeting = report.openingMeeting || {};
            const closingMeeting = report.closingMeeting || {};
            // Build attendee picker data
            const { auditTeam: mAuditTeam = [], clientPersonnel: mClientPersonnel = [], clientData: mClientData = null } = contextData;
            const cbName = window.state.settings?.orgName || window.state.settings?.cbName || 'CB';
            const clientOrgName = mClientData?.name || report.client || 'Client';
            // Parse existing attendees to check who's already selected
            const parseExisting = (att) => {
                if (!att) return [];
                if (Array.isArray(att)) return att.map(a => typeof a === 'object' ? a.name : a);
                return att.split('\n').map(l => l.split('-')[0].trim()).filter(Boolean);
            };
            const existingOpeningNames = parseExisting(openingMeeting.attendees);
            const existingClosingNames = parseExisting(closingMeeting.attendees);

            const buildAttendeeSection = (prefix, existingNames) => {
                let html = '<div style="margin-bottom: 0.75rem;">';
                // Audit Team section
                if (mAuditTeam.length > 0) {
                    html += '<div style="margin-bottom: 0.5rem;"><div style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.35rem;"><i class="fa-solid fa-user-shield" style="margin-right: 0.25rem;"></i>Audit Team</div>';
                    mAuditTeam.forEach(a => {
                        const checked = existingNames.includes(a.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; cursor: pointer; font-size: 0.82rem;">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-name="${(a.name || '').replace(/"/g, '&quot;')}" data-role="${(a.role || '').replace(/"/g, '&quot;')}" data-org="${cbName.replace(/"/g, '&quot;')}" ${checked} style="width: 15px; height: 15px; flex-shrink: 0;">`;
                        html += `<span style="font-weight: 500;">${a.name}</span><span style="color: #64748b; font-size: 0.78rem; white-space: nowrap;">– ${a.role}</span>`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Client Personnel section
                if (mClientPersonnel.length > 0) {
                    html += '<div style="margin-bottom: 0.5rem;"><div style="font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.35rem;"><i class="fa-solid fa-building" style="margin-right: 0.25rem;"></i>Client Personnel</div>';
                    mClientPersonnel.forEach(p => {
                        const checked = existingNames.includes(p.name) ? 'checked' : '';
                        html += `<label style="display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; cursor: pointer; font-size: 0.82rem;">`;
                        html += `<input type="checkbox" class="${prefix}-attendee-cb" data-name="${(p.name || '').replace(/"/g, '&quot;')}" data-role="${(p.role || '').replace(/"/g, '&quot;')}" data-org="${clientOrgName.replace(/"/g, '&quot;')}" ${checked} style="width: 15px; height: 15px; flex-shrink: 0;">`;
                        html += `<span style="font-weight: 500;">${p.name}</span>${p.role ? `<span style="color: #64748b; font-size: 0.78rem; white-space: nowrap;">– ${p.role}</span>` : ''}`;
                        html += '</label>';
                    });
                    html += '</div>';
                }
                // Custom add
                html += `<div style="margin-top: 0.4rem; display: flex; gap: 0.35rem;">`;
                html += `<input type="text" id="${prefix}-custom-name" class="form-control form-control-sm" placeholder="Name" style="flex: 2; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<input type="text" id="${prefix}-custom-role" class="form-control form-control-sm" placeholder="Role" style="flex: 1.5; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<input type="text" id="${prefix}-custom-org" class="form-control form-control-sm" placeholder="Organization" style="flex: 1.5; font-size: 0.8rem; padding: 0.3rem 0.5rem;">`;
                html += `<button class="btn btn-sm btn-outline-primary" data-action="addCustomMeetingAttendee" data-id="${prefix}" style="padding: 0.25rem 0.5rem;" aria-label="Add"><i class="fa-solid fa-plus"></i></button>`;
                html += '</div>';
                // Custom attendees list
                html += `<div id="${prefix}-custom-list" style="margin-top: 0.35rem;"></div>`;
                html += '</div>';
                return html;
            };

            tabContent.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;">
                    <!-- Opening Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #16a34a; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #16a34a;">
                            <i class="fa-solid fa-door-open" style="margin-right: 0.5rem;"></i>Opening Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="opening-date" class="form-control" value="${openingMeeting.date || report.date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="opening-time" class="form-control" value="${openingMeeting.time || '09:00'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('opening', existingOpeningNames)}
                        </div>
                        <div class="form-group">
                            <label>Meeting Notes</label>
                            <textarea id="opening-notes" class="form-control" rows="3" placeholder="Key points discussed, scope confirmed, agenda presented...">${openingMeeting.notes || ''}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" data-action="toggleNextHidden">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #166534; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Opening Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #166534; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
                                ${[
                    { id: 'op-scope', label: 'Introduction of audit team & confirmation of audit scope' },
                    { id: 'op-methodology', label: 'Audit plan, methodology & sampling approach' },
                    { id: 'op-ncr-grading', label: 'Nonconformity grading criteria (Major / Minor / OFI)' },
                    { id: 'op-remote-evidence', label: 'Evidence collection method (photos, screen-shares for remote audits)' },
                    { id: 'op-process-flow', label: 'Process flow & department visit sequence' },
                    { id: 'op-confidentiality', label: 'Confidentiality & impartiality declaration' },
                    { id: 'op-communication', label: 'Communication arrangements & guide/escort' },
                    { id: 'op-schedule', label: 'Daily schedule, breaks & logistics' },
                    { id: 'op-prev-findings', label: 'Status of previous audit findings & CAPAs' }
                ].map(p => '<label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.75rem; background: white; border-radius: 6px; border: 1px solid #dcfce7; text-align: left;"><input type="checkbox" class="opening-pointer" data-key="' + p.id + '" ' + ((openingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="accent-color: #16a34a; flex-shrink: 0; width: 16px; height: 16px;"><span style="flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Closing Meeting -->
                    <div class="card" style="margin: 0; border-left: 4px solid #dc2626; overflow: hidden;">
                        <h3 style="margin: 0 0 1rem 0; color: #dc2626;">
                            <i class="fa-solid fa-door-closed" style="margin-right: 0.5rem;"></i>Closing Meeting
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="closing-date" class="form-control" value="${closingMeeting.date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Time</label>
                                <input type="time" id="closing-time" class="form-control" value="${closingMeeting.time || '17:00'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-users" style="margin-right: 0.25rem;"></i>Attendees</label>
                            ${buildAttendeeSection('closing', existingClosingNames)}
                        </div>
                        <div class="form-group">
                            <label>Findings Summary Presented</label>
                            <textarea id="closing-summary" class="form-control" rows="2" placeholder="Summary of findings as presented to client...">${closingMeeting.summary || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Client Response/Agreement</label>
                            <textarea id="closing-response" class="form-control" rows="2" placeholder="Client's response to findings...">${closingMeeting.response || ''}</textarea>
                        </div>
                        <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; overflow: hidden;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 0.5rem;" data-action="toggleNextHidden">
                                <label style="font-weight: 600; font-size: 0.85rem; color: #991b1b; margin: 0; cursor: pointer;"><i class="fa-solid fa-clipboard-check" style="margin-right: 0.25rem;"></i>Closing Meeting Agenda Points</label>
                                <i class="fa-solid fa-chevron-down" style="color: #991b1b; font-size: 0.7rem;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
                                ${[
                    { id: 'cl-findings', label: 'Presentation of audit findings (Majors, Minors, OFIs)' },
                    { id: 'cl-ncr-severity', label: 'Nonconformity severity & implications for certification' },
                    { id: 'cl-capa-timelines', label: 'Corrective action timelines (Major: 90 days, Minor: 6 months)' },
                    { id: 'cl-positive', label: 'Positive observations & good practices noted' },
                    { id: 'cl-recommendation', label: 'Audit recommendation (grant / maintain / suspend / withdraw)' },
                    { id: 'cl-appeals', label: 'Appeals & complaints process' },
                    { id: 'cl-followup', label: 'Follow-up / surveillance audit schedule' },
                    { id: 'cl-remote-evidence', label: 'Remote evidence sufficiency confirmation (if applicable)' },
                    { id: 'cl-cert-scope', label: 'Certification scope, mark usage & public information' }
                ].map(p => '<label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; cursor: pointer; margin: 0; padding: 0.5rem 0.75rem; background: white; border-radius: 6px; border: 1px solid #fecaca; text-align: left;"><input type="checkbox" class="closing-pointer" data-key="' + p.id + '" ' + ((closingMeeting.keyPointers || {})[p.id] ? 'checked' : '') + ' style="accent-color: #dc2626; flex-shrink: 0; width: 16px; height: 16px;"><span style="flex: 1;">' + p.label + '</span></label>').join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button class="btn btn-primary" data-action="saveMeetingRecords" data-id="${report.id}" aria-label="Save">
                        <i class="fa-solid fa-save" style="margin-right: 0.5rem;"></i>Save Meeting Records
                    </button>
                </div>
                
                <div style="margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <p style="margin: 0; font-size: 0.85rem; color: #1d4ed8;">
                        <i class="fa-solid fa-info-circle" style="margin-right: 0.5rem;"></i>
                        <strong>ISO 17021-1 Requirement:</strong> Maintain records of opening and closing meetings including attendees and key discussions (Clause 9.4.7).
                    </p>
                </div>
            `;
            break;
        }
    }

    // Helper functions for execution module

    // Accordion toggle for clause sections
    window.toggleAccordion = function (sectionId) {
        const content = document.getElementById(sectionId);
        const icon = document.getElementById('icon-' + sectionId);
        if (content) {
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            if (icon) {
                icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    };

    // Collapse/Expand ALL accordion sections at once
    window.toggleAllAccordions = function () {
        const allContent = document.querySelectorAll('.accordion-content');
        const btn = document.getElementById('toggle-all-accordions');

        // Determine action from the button label — avoids desync when individual sections are toggled
        const label = btn?.querySelector('span');
        const shouldExpand = label ? label.textContent.trim().toLowerCase().includes('expand') : true;

        allContent.forEach(content => {
            content.style.display = shouldExpand ? 'block' : 'none';
            // Update the corresponding chevron icon
            const icon = document.getElementById('icon-' + content.id);
            if (icon) {
                icon.style.transform = shouldExpand ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });

        // Also collapse/expand NCR panels, evidence details, and sub-sections when collapsing all
        if (!shouldExpand) {
            document.querySelectorAll('.ncr-panel').forEach(p => { p.style.display = 'none'; });
            document.querySelectorAll('.evidence-photos-container, .evidence-section, details[open]').forEach(el => {
                if (el.tagName === 'DETAILS') el.removeAttribute('open');
                else el.style.display = 'none';
            });
        }

        // Update button label
        if (btn) {
            const icon = btn.querySelector('i');
            if (shouldExpand) {
                if (icon) icon.className = 'fa-solid fa-compress-alt';
                if (label) label.textContent = 'Collapse All';
            } else {
                if (icon) icon.className = 'fa-solid fa-expand-alt';
                if (label) label.textContent = 'Expand All';
            }
        }
    };

    // Drag-to-reorder clause sections (data-safe: only changes DOM order, not progress keys)
    window.initClauseDragReorder = function () {
        let draggedSection = null;
        document.querySelectorAll('.accordion-section[data-clause-id]').forEach(section => {
            const handle = section.querySelector('.clause-drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', () => { section.draggable = true; });
            section.addEventListener('mouseup', () => { section.draggable = false; });

            section.addEventListener('dragstart', (e) => {
                if (!section.draggable) { e.preventDefault(); return; }
                draggedSection = section;
                section.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            section.addEventListener('dragend', () => {
                section.draggable = false;
                draggedSection = null;
                section.style.opacity = '1';
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!draggedSection || section === draggedSection) return;
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });
                const rect = section.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    section.style.borderTop = '3px solid #2563eb';
                } else {
                    section.style.borderBottom = '3px solid #2563eb';
                }
            });

            section.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedSection || section === draggedSection) return;
                const parent = section.parentNode;
                const rect = section.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    parent.insertBefore(draggedSection, section);
                } else {
                    parent.insertBefore(draggedSection, section.nextElementSibling);
                }
                document.querySelectorAll('.accordion-section[data-clause-id]').forEach(s => {
                    s.style.borderTop = '';
                    s.style.borderBottom = '';
                });

                // Persist the new clause order
                const newOrder = Array.from(document.querySelectorAll('.accordion-section[data-clause-id]'))
                    .map(s => s.getAttribute('data-clause-id'));
                // Find report from current execution context
                const reportId = document.querySelector('[data-report-id]')?.getAttribute('data-report-id')
                    || document.querySelector('.bulk-action-btn[data-report-id]')?.getAttribute('data-report-id');
                if (reportId) {
                    const report = window.state.auditReports?.find(r => String(r.id) === String(reportId));
                    if (report) {
                        report.clauseOrder = newOrder;
                        window.saveData();
                    }
                }
            });
        });
    };

    window.toggleSectionSelection = function (sectionId, checkbox) {
        window.Logger.debug('Execution', 'toggleSectionSelection called for:', sectionId);
        const section = document.getElementById(sectionId);
        if (!section) {
            window.Logger.error('Execution', 'Section not found: ' + sectionId);
            return;
        }

        // Use passed checkbox or find it
        const box = checkbox || document.querySelector(`.section-checkbox[data-section-id="${sectionId}"]`);
        const isChecked = box ? box.checked : false;

        window.Logger.debug('Execution', 'Checkbox is checked:', isChecked);

        // Toggle items in this section
        let _count = 0;
        const items = section.querySelectorAll('.checklist-item');
        window.Logger.debug('Execution', 'Found items:', items.length);
        items.forEach(item => {
            if (isChecked) {
                item.classList.add('selected-item');
                item.style.background = '#eff6ff'; // Light blue highlight
                item.style.borderLeft = '4px solid var(--primary-color)';
                _count++;
            } else {
                item.classList.remove('selected-item');
                item.style.background = ''; // Reset
                item.style.borderLeft = '4px solid #e2e8f0'; // Reset
            }
        });

        // Optional: Update UI or show brief feedback
        // window.showNotification(isChecked ? `Selected ${count} items` : 'Selection cleared', 'info');
    };

    window.setChecklistStatus = function (uniqueId, status) {
        window.Logger.debug('Execution', 'setChecklistStatus called:', { uniqueId, status });

        const row = document.getElementById('row-' + uniqueId);
        if (!row) {
            window.Logger.error('Execution', 'Row not found: row-' + uniqueId);
            return;
        }

        // Update buttons
        row.querySelectorAll('.btn-icon').forEach(btn => btn.classList.remove('active'));

        let activeBtnClass = '';
        if (status === window.CONSTANTS.STATUS.CONFORM) activeBtnClass = '.btn-ok';
        else if (status === window.CONSTANTS.STATUS.NC) activeBtnClass = '.btn-nc';
        else if (status === window.CONSTANTS.STATUS.NA) activeBtnClass = '.btn-na';

        if (activeBtnClass) row.querySelector(activeBtnClass)?.classList.add('active');

        // Show/Hide NCR Panel
        const panelId = 'ncr-panel-' + uniqueId;
        const panel = document.getElementById(panelId);
        window.Logger.debug('Execution', 'Looking for panel:', { panelId, found: !!panel });

        if (panel) {
            if (status === window.CONSTANTS.STATUS.NC) {
                panel.style.display = 'block';
                window.Logger.debug('Execution', 'NCR Panel shown for:', uniqueId);
            } else {
                panel.style.display = 'none';
            }
        } else {
            window.Logger.error('Execution', 'NCR Panel not found: ' + panelId);
        }

        // Update hidden input
        const statusInput = document.getElementById('status-' + uniqueId);
        if (statusInput) {
            statusInput.value = status;
        }

        // Update accordion counter dynamically
        window.updateAccordionCounter(uniqueId);
    };

    // Update accordion counter based on current statuses
    window.updateAccordionCounter = function (changedId) {
        // Find the section containing this item
        const row = document.getElementById('row-' + changedId);
        if (!row) return;

        const accordionContent = row.closest('.accordion-content');
        if (!accordionContent) return;

        const _sectionId = accordionContent.id;
        const items = accordionContent.querySelectorAll('.checklist-item');
        let completed = 0;

        items.forEach(item => {
            const itemId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + itemId);
            const status = statusInput?.value || '';
            if (status === 'conform' || status === 'nc' || status === 'na') {
                completed++;
            }
        });

        // Update the counter text in the accordion header
        const accordionSection = accordionContent.closest('.accordion-section');
        if (accordionSection) {
            const counterSpan = accordionSection.querySelector('.accordion-header span[style*="text-secondary"]');
            if (counterSpan && counterSpan.textContent.includes('/')) {
                counterSpan.textContent = `${completed}/${items.length}`;
            }
        }
    };

    window.addCustomQuestion = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Add Custom Question';
        modalBody.innerHTML = `
        <form id="custom-question-form">
            <div class="form-group">
                <label>Clause Number/Title <span style="color: var(--danger-color);">*</span></label>
                <input type="text" class="form-control" id="custom-clause" placeholder="e.g. New 1.1 or Additional" required>
            </div>
            <div class="form-group">
                <label>Requirement / Question <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="custom-req" rows="3" placeholder="Enter the audit question or requirement..." required></textarea>
            </div>
        </form>
    `;

        window.openModal();

        modalSave.onclick = () => {
            const clause = document.getElementById('custom-clause').value;
            const req = document.getElementById('custom-req').value;

            if (clause && req) {
                if (!report.customItems) report.customItems = [];
                report.customItems.push({ clause, requirement: req });

                window.saveData();
                window.closeModal();
                window.renderExecutionDetail(reportId);
                window.showNotification('Custom question added successfully');
            } else {
                window.showNotification('Please fill in both fields', 'error');
            }
        };
    };

    window.saveChecklist = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Show indicator immediately
        const indicator = document.getElementById('save-indicator');
        if (indicator) {
            indicator.textContent = 'Saving Changes...';
            indicator.style.display = 'block';
            indicator.style.background = '#3b82f6'; // Blue for loading
        }

        const statusInputs = document.querySelectorAll('.status-input');
        const checklistData = [];

        // Only update checklistProgress if we are on a screen that has checklist inputs
        if (statusInputs.length > 0) {
            statusInputs.forEach(input => {
                const uniqueId = input.id.replace('status-', '');

                const status = input.value;
                const comment = Sanitizer.sanitizeText(document.getElementById('comment-' + uniqueId)?.value || '');
                const ncrDesc = Sanitizer.sanitizeText(document.getElementById('ncr-desc-' + uniqueId)?.value || '');
                const transcript = Sanitizer.sanitizeText(document.getElementById('ncr-transcript-' + uniqueId)?.value || '');
                const ncrType = document.getElementById('ncr-type-' + uniqueId)?.value || '';

                // Get all evidence images from thumbnail strip
                const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
                const evidenceImages = [];
                if (previewDiv) {
                    previewDiv.querySelectorAll('.ev-thumb').forEach(thumb => {
                        // Prefer data-save-url (cloud URL or idb:// key) over img.src (may be base64)
                        const saveUrl = thumb.dataset.saveUrl;
                        const imgEl = thumb.querySelector('img');
                        const url = saveUrl || (imgEl && imgEl.src) || '';
                        if (url && !url.includes('data:,') && url !== window.location.href) {
                            evidenceImages.push(url);
                        }
                    });
                }
                // Backward compat: also store first image as evidenceImage
                const evidenceImage = evidenceImages.length > 0 ? evidenceImages[0] : '';
                const evidenceSize = '';

                // Get personnel, designation and department
                const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-' + uniqueId)?.value || '');
                const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-' + uniqueId)?.value || '');
                const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-' + uniqueId)?.value || '');

                // Get clause and requirement from data attributes (reliable) instead of DOM scraping
                const clauseText = input.dataset.clause || '';
                const requirementText = input.dataset.requirement || '';

                // Save ALL items (not just ones with status/comment)
                // This ensures Conform/NC/NA selections persist even without comments
                checklistData.push({
                    checklistId: input.dataset.checklist,
                    itemIdx: input.dataset.item,
                    isCustom: input.dataset.custom === 'true',
                    status: status,
                    comment: comment,
                    ncrDescription: ncrDesc,
                    transcript: transcript,
                    ncrType: ncrType,
                    evidenceImage: evidenceImage,
                    evidenceImages: evidenceImages,
                    evidenceSize: evidenceSize,
                    personnel: personnel,
                    designation: designation,
                    department: department,
                    // Include clause and requirement for report display
                    clause: clauseText || input.dataset.clause || '',
                    requirement: requirementText || input.dataset.requirement || ''
                });
            });
            // Preserve _originalComment from previous saves (set by AI refinement)
            checklistData.forEach(item => {
                const key = item.isCustom ? `custom-${item.itemIdx}` : `${item.checklistId}-${item.itemIdx}`;
                const prev = (report.checklistProgress || []).find(p => {
                    const pk = p.isCustom ? `custom-${p.itemIdx}` : `${p.checklistId}-${p.itemIdx}`;
                    return pk === key;
                });
                if (prev && prev._originalComment && !item._originalComment) {
                    item._originalComment = prev._originalComment;
                }
                if (prev && prev._aiGenerated && !item._aiGenerated) {
                    item._aiGenerated = prev._aiGenerated;
                }
            });

            report.checklistProgress = checklistData;

            // Revision tracking
            if (!report.checklistRevisions) report.checklistRevisions = [];
            report.checklistRevisions.push({
                rev: report.checklistRevisions.length + 1,
                timestamp: new Date().toISOString(),
                itemCount: checklistData.length,
                ncCount: checklistData.filter(d => d.status === 'nc').length,
                conformCount: checklistData.filter(d => d.status === 'conform').length,
                naCount: checklistData.filter(d => d.status === 'na').length
            });

            // Update revision badge in UI
            const badge = document.getElementById('revision-badge');
            const rev = report.checklistRevisions.length;
            if (badge) {
                badge.innerHTML = `<i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${rev}`;
                badge.title = report.checklistRevisions.map(r => 'v' + r.rev + ' — ' + new Date(r.timestamp).toLocaleString()).join('\n');
            } else {
                // Insert badge after save button
                const saveBtn = document.getElementById('save-progress-btn');
                if (saveBtn) {
                    const span = document.createElement('span');
                    span.id = 'revision-badge';
                    span.title = 'v' + rev + ' — ' + new Date().toLocaleString();
                    span.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:0.75rem;font-weight:600;color:#166534;cursor:help;';
                    span.innerHTML = `<i class="fa-solid fa-code-branch" style="font-size:0.7rem;"></i> v${rev}`;
                    saveBtn.parentElement.appendChild(span);
                }
            }
        }

        // Handle Review & Submit Tab classifications if present
        const reviewSeverities = document.querySelectorAll('.review-severity');
        if (reviewSeverities.length > 0) {
            reviewSeverities.forEach(select => {
                const findingId = select.dataset.findingId;
                const newType = select.value;
                const remarks = document.querySelector(`.review-remarks[data-finding-id="${findingId}"]`)?.value || '';

                if (findingId.startsWith('checklist-')) {
                    const idx = parseInt(findingId.replace('checklist-', ''), 10);
                    // idx is the ORIGINAL index into checklistProgress (not a filtered sequential index)
                    if (report.checklistProgress && report.checklistProgress[idx]) {
                        report.checklistProgress[idx].ncrType = newType;
                        if (remarks) report.checklistProgress[idx].comment = remarks;
                    }
                } else if (findingId.startsWith('ncr-')) {
                    const idx = parseInt(findingId.replace('ncr-', ''), 10);
                    if (report.ncrs && report.ncrs[idx]) {
                        report.ncrs[idx].type = newType;
                        report.ncrs[idx].description = remarks;
                    }
                }
            });
        }

        // Save Executive Summary & Observations (Unified View)
        const execSumInput = document.getElementById(`exec-summary-${reportId}`);
        if (execSumInput) report.executiveSummary = Sanitizer.sanitizeText(execSumInput.value);

        const posObsInput = document.getElementById('positive-observations');
        if (posObsInput) report.positiveObservations = Sanitizer.sanitizeText(posObsInput.value);

        const ofiInput = document.getElementById('ofi');
        if (ofiInput) report.ofi = Sanitizer.sanitizeText(ofiInput.value);

        // Persist to Database (Async)
        (async () => {
            try {
                // Use correct DB column names (client_name, not client)
                await window.SupabaseClient.db.upsert('audit_reports', {
                    id: String(reportId),  // DB uses TEXT for id
                    plan_id: report.planId ? String(report.planId) : null,
                    client_name: report.client,  // DB column is client_name, not client
                    client_id: report.clientId || null,
                    date: report.date,
                    status: report.status,
                    findings: report.findings || 0,
                    checklist_progress: report.checklistProgress || [],  // Standardized column name
                    data: report || {},
                    custom_items: report.customItems || [],
                    opening_meeting: report.openingMeeting || {},
                    closing_meeting: report.closingMeeting || {},
                    ncrs: report.ncrs || []
                });

                // Success UI
                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-check-circle" style="margin-right: 0.5rem;"></i> Changes Saved Successfully';
                    indicator.style.background = '#10b981'; // Green
                    setTimeout(() => {
                        indicator.style.display = 'none';
                    }, 2000);
                }
                window.showNotification('Audit progress saved to cloud', 'success');

            } catch (dbError) {
                console.error('Database Sync Error:', JSON.stringify(dbError, null, 2));

                // Attempt Fallback: Save BASIC info only
                try {
                    console.warn('Attempting fallback save (basic info only)...');
                    await window.SupabaseClient.db.upsert('audit_reports', {
                        id: String(reportId),
                        client_name: report.client,
                        date: report.date,
                        status: report.status,
                        findings: report.findings || 0
                    });
                    window.showNotification('Partial save: Basic info saved. Full data saved locally.', 'warning');
                } catch (fallbackError) {
                    console.error('Fallback save also failed:', fallbackError);
                    window.showNotification(`Sync Failed: ${dbError.message || dbError.error_description || 'Unknown error'}`, 'error');
                }

                if (indicator) {
                    indicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sync Error';
                    indicator.style.background = '#ef4444'; // Red
                }
            }
        })();

        // ── Sync checklist NC items → NCR & CAPA Register ──
        // ISO 17021-1 requires NCRs to flow into the formal CAPA lifecycle
        try {
            const ncItems = (report.checklistProgress || []).filter(p => p.status === 'nc');
            if (!window.state.ncrs) window.state.ncrs = [];
            const assignedChecklists = [];
            // Resolve client by name first, then by ID as fallback
            const client = window.state.clients?.find(c => c.name === report.client)
                || window.state.clients?.find(c => String(c.id) === String(report.clientId));
            const resolvedClientId = client?.id || report.clientId || '';
            if (client && client.data?.assignedChecklists) {
                assignedChecklists.push(...client.data.assignedChecklists);
            }

            // Track which sourceKeys are still active NC
            const activeSourceKeys = new Set();

            ncItems.forEach(item => {
                // Build stable key to prevent duplicates
                const sourceKey = `exec-${reportId}-${item.checklistId || 'custom'}-${item.itemIdx}`;
                activeSourceKeys.add(sourceKey);

                // Check if already synced
                const existing = window.state.ncrs.find(n => n._sourceKey === sourceKey);
                if (existing) {
                    // Update severity/description if changed
                    existing.severity = item.ncrType || 'Observation';
                    existing.description = item.ncrDescription || item.comment || existing.description;
                    return;
                }

                // Resolve clause text
                let clauseText = item.clause || 'Checklist Item';
                if (item.checklistId && assignedChecklists.length > 0) {
                    const cl = assignedChecklists.find(c => String(c.id) === String(item.checklistId));
                    if (cl && cl.clauses && String(item.itemIdx).includes('-')) {
                        const [mc, si] = String(item.itemIdx).split('-');
                        const mainObj = cl.clauses.find(m => m.mainClause === mc);
                        if (mainObj && mainObj.subClauses && mainObj.subClauses[si]) {
                            clauseText = mainObj.subClauses[si].clause || clauseText;
                        }
                    }
                }

                // Create new NCR record
                const ncrRecord = {
                    _sourceKey: sourceKey,
                    clientId: resolvedClientId,
                    clientName: report.client || '',
                    auditId: report.planId || null,          // FK → audit_plans(id)
                    level: 'client',
                    source: 'checklist',
                    standard: report.standard || '',
                    clause: clauseText,
                    severity: item.ncrType || 'Observation',
                    description: item.ncrDescription || item.comment || 'Non-conformity identified during audit',
                    raisedBy: report.auditor || 'Auditor',
                    raisedDate: new Date().toISOString().split('T')[0],
                    dueDate: null,                           // null for DATE column
                    status: 'Open',
                    correction: '',
                    rootCause: '',
                    correctiveAction: '',
                    evidence: item.evidenceImages || (item.evidenceImage ? [item.evidenceImage] : [])
                };

                window.state.ncrs.push(ncrRecord);

                // Persist to Supabase async (fire-and-forget)
                if (typeof persistNCR === 'function') {
                    persistNCR(ncrRecord).catch(e => console.warn('NCR sync persist error:', e));
                } else if (window.persistNCR) {
                    window.persistNCR(ncrRecord).catch(e => console.warn('NCR sync persist error:', e));
                }
            });

            // Remove register entries for items no longer marked NC
            window.state.ncrs = window.state.ncrs.filter(n => {
                if (!n._sourceKey || !n._sourceKey.startsWith(`exec-${reportId}-`)) return true;
                return activeSourceKeys.has(n._sourceKey);
            });

            if (typeof updateNCRAnalytics === 'function') updateNCRAnalytics();
            else if (window.updateNCRAnalytics) window.updateNCRAnalytics();
        } catch (syncErr) {
            console.warn('NCR register sync error (non-fatal):', syncErr);
        }

        window.saveData();
    };

    // Filter checklist items by status
    window.filterChecklistItems = function (filterType) {
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filterType) {
                btn.classList.add('active');
            }
        });

        // Filter items
        document.querySelectorAll('.checklist-item').forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            const statusInput = document.getElementById('status-' + uniqueId);
            const status = statusInput?.value || '';

            let shouldShow;

            if (filterType === 'all') {
                shouldShow = true;
            } else if (filterType === 'pending') {
                shouldShow = !status || status === '';
            } else {
                shouldShow = status === filterType;
            }

            if (shouldShow) {
                item.classList.remove('filtered-out');
            } else {
                item.classList.add('filtered-out');
            }
        });
    };

    // Bulk update status - prioritizes selected items, falls back to filtered items
    window.bulkUpdateStatus = function (reportId, status) {
        window.Logger.debug('Execution', 'bulkUpdateStatus called:', { reportId, status });

        // Check if any items are selected via checkboxes
        let targetItems = document.querySelectorAll('.checklist-item.selected-item');
        let useSelection = targetItems.length > 0;

        window.Logger.debug('Execution', 'Selected items:', targetItems.length);

        // If no items selected, fall back to filtered items
        if (!useSelection) {
            targetItems = document.querySelectorAll('.checklist-item:not(.filtered-out)');
            window.Logger.debug('Execution', 'Using filtered items:', targetItems.length);
        }

        if (targetItems.length === 0) {
            window.showNotification('No items to update', 'warning');
            return;
        }

        window.Logger.debug('Execution', `Bulk updating ${targetItems.length} items to status: ${status}`);
        let updatedCount = 0;
        targetItems.forEach(item => {
            const uniqueId = item.id.replace('row-', '');
            window.Logger.debug('Execution', 'Updating item:', { uniqueId, status });
            window.setChecklistStatus(uniqueId, status);
            updatedCount++;
        });
        window.Logger.debug('Execution', 'Updated items count:', updatedCount);

        // Clear selections if items were selected
        if (useSelection) {
            document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.checklist-item.selected-item').forEach(item => {
                item.classList.remove('selected-item');
                item.style.background = '';
                item.style.borderLeft = '';
            });
        }

        // Close dropdown
        const menu = document.getElementById(`bulk-menu-${reportId}`);
        if (menu) {
            menu.classList.add('hidden');
            window.Logger.debug('Execution', 'Menu closed');
        } else {
            window.Logger.error('Execution', 'Menu not found: bulk-menu-' + reportId);
        }

        window.showNotification(`Updated ${updatedCount} item(s) to ${status.toUpperCase()}`, 'success');
        window.saveChecklist(reportId);
    };


    // Submit findings to Lead Auditor for review
    window.submitToLeadAuditor = function (reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        // Use saveChecklist to gather all UI changes first
        window.saveChecklist(reportId);

        // Update report status to In Review (as per CONSTANTS)
        report.status = window.CONSTANTS.STATUS.IN_REVIEW;
        report.submittedAt = new Date().toISOString();
        report.submittedBy = window.state.currentUser?.name || 'Auditor';

        // Persist to Database
        (async () => {
            try {
                await window.SupabaseClient.db.update('audit_reports', String(reportId), {
                    status: report.status,
                    data: report
                });
                window.showNotification('Findings submitted to Lead Auditor for review!', 'success');
            } catch (err) {
                console.error('Submission failed:', err);
                window.showNotification('Submitted locally. Cloud sync pending.', 'warning');
            }
        })();

        window.saveData();

        // Navigate back to execution list
        setTimeout(() => {
            renderAuditExecutionEnhanced();
        }, 1500);
    };

    window.startDictation = function (uniqueId) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        const micBtn = document.getElementById('mic-btn-' + uniqueId);
        const textarea = document.getElementById('comment-' + uniqueId);

        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        // Visual feedback — show stop button so user can end early
        const originalIcon = '<i class="fa-solid fa-microphone"></i>';
        micBtn.innerHTML = '<i class="fa-solid fa-stop fa-fade" style="color: red;"></i>';
        micBtn.title = 'Click to stop recording';
        micBtn.removeAttribute('disabled');

        // Allow user to stop early by clicking the mic button again
        const stopHandler = () => {
            recognition.stop();
            micBtn.removeEventListener('click', stopHandler);
        };
        micBtn.addEventListener('click', stopHandler);

        recognition.start();

        let finalTranscript = '';

        // Auto-stop after 30 seconds
        const timeout = setTimeout(() => {
            recognition.stop();
            window.showNotification('Recording limit (30s) reached.', 'info');
        }, 30000);

        recognition.onresult = function (event) {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Show live preview in the textarea
            const currentVal = textarea.getAttribute('data-pre-dictation') || textarea.value;
            if (!textarea.getAttribute('data-pre-dictation')) {
                textarea.setAttribute('data-pre-dictation', textarea.value);
            }
            textarea.value = currentVal ? currentVal + ' ' + finalTranscript + interimTranscript : finalTranscript + interimTranscript;
        };

        recognition.onend = function () {
            clearTimeout(timeout);
            micBtn.removeEventListener('click', stopHandler);
            // Set final value
            const preVal = textarea.getAttribute('data-pre-dictation') || '';
            textarea.removeAttribute('data-pre-dictation');
            textarea.value = preVal ? preVal + ' ' + finalTranscript : finalTranscript;

            micBtn.innerHTML = originalIcon;
            micBtn.title = 'Voice dictation';
        };

        recognition.onerror = function (event) {
            window.Logger.error('Execution', 'Speech recognition error', event.error);
            if (event.error !== 'no-speech') {
                window.showNotification('Error recording audio: ' + event.error, 'error');
            }
            micBtn.innerHTML = originalIcon;
            micBtn.title = 'Voice dictation';
            micBtn.removeEventListener('click', stopHandler);
            clearTimeout(timeout);
        };
    };

    function createNCR(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Create Non-Conformity Report';
        modalBody.innerHTML = `
        <form id="ncr-form">
            <div class="form-group">
                <label>Type <span style="color: var(--danger-color);">*</span></label>
                <select class="form-control" id="ncr-type" required>
                    <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}">Observation (OBS)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.OFI}">Opportunity for Improvement (OFI)</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MINOR}">Minor NC</option>
                    <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}">Major NC</option>

                </select>
            </div>
            <div class="form-group">
                <label>Clause/Requirement</label>
                <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3">
            </div>
            <div class="form-group">
                <label>Description <span style="color: var(--danger-color);">*</span></label>
                <div style="position: relative;">
                    <textarea class="form-control" id="ncr-description" rows="3" placeholder="Describe the non-conformity..." required></textarea>
                    <button type="button" id="mic-btn-modal" style="position: absolute; bottom: 10px; right: 10px; background: none; border: none; color: var(--primary-color); cursor: pointer;" title="Dictate Description">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Evidence / Objective Evidence</label>
                <textarea class="form-control" id="ncr-evidence" rows="2" placeholder="What evidence supports this finding?"></textarea>
            </div>
            
            <!-- Cross-Reference Fields -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Personnel Name</label>
                    <select class="form-control" id="ncr-personnel-modal" data-action-change="_autoFillPersonnel" data-id="modal">
                        <option value="">-- Select --</option>
                        ${((state.clients || []).find(c => c.name === report.client)?.contacts || []).map(c => `<option value="${window.UTILS.escapeHtml(c.name)}">${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Designation</label>
                    <input type="text" class="form-control" id="ncr-designation-modal" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Department</label>
                    <input type="text" class="form-control" id="ncr-department-modal" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
                </div>
            </div>
            
            <div class="form-group" style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: 600;">Multimedia Evidence</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" id="btn-capture-img" class="btn btn-secondary btn-sm">
                        <i class="fa-solid fa-camera"></i> Capture Image
                    </button>
                    <span id="img-status" style="font-size: 0.8rem; color: #666;"></span>
                </div>
                <input type="hidden" id="ncr-evidence-image-url">
                <div id="image-preview" style="margin-top: 10px;"></div>
            </div>
        </form>
    `;

        window.openModal();

        // Voice Dictation Logic for Modal
        const micBtn = document.getElementById('mic-btn-modal');
        if (micBtn) {
            micBtn.onclick = () => {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;

                    micBtn.innerHTML = '<i class="fa-solid fa-circle-dot fa-fade" style="color: red;"></i>';
                    recognition.start();

                    recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        const desc = document.getElementById('ncr-description');
                        desc.value = desc.value ? desc.value + ' ' + transcript : transcript;
                    };

                    recognition.onend = () => {
                        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                    };
                } else {
                    alert('Speech recognition not supported in this browser.');
                }
            };
        }

        // Camera Capture Logic - triggers file input for real image upload
        const captureBtn = document.getElementById('btn-capture-img');
        if (captureBtn) {
            captureBtn.onclick = function () {
                // Create file input for image selection
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment'; // Use back camera on mobile

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    captureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

                    try {
                        // Upload to Supabase if available
                        if (window.SupabaseClient?.isInitialized) {
                            const result = await window.SupabaseClient.storage.uploadAuditImage(file, 'ncr-evidence', Date.now().toString());
                            if (result?.url) {
                                document.getElementById('ncr-evidence-image-url').value = result.url;
                                document.getElementById('image-preview').innerHTML = `<img src="${window.UTILS.escapeHtml(result.url)}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image uploaded successfully";
                            }
                        } else {
                            // Fallback: Use base64 data URL for local storage
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                document.getElementById('ncr-evidence-image-url').value = ev.target.result;
                                document.getElementById('image-preview').innerHTML = `<img src="${ev.target.result}" style="max-height: 150px; border-radius: 4px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;
                                document.getElementById('img-status').textContent = "Image captured (stored locally)";
                            };
                            reader.readAsDataURL(file);
                        }

                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retake';
                        captureBtn.classList.remove('btn-secondary');
                        captureBtn.classList.add('btn-success');
                    } catch (error) {
                        console.error('Image upload failed:', error);
                        document.getElementById('img-status').textContent = "Upload failed: " + error.message;
                        captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Retry';
                    }
                };

                fileInput.click();
            };
        }

        modalSave.onclick = () => {
            // 1. Define Fields
            const fieldIds = {
                description: 'ncr-description',
                type: 'ncr-type'
            };

            // 2. Define Rules
            const rules = {
                description: [
                    { rule: 'required', fieldName: 'Description' },
                    { rule: 'noHtmlTags' }
                ],
                type: [{ rule: 'required', fieldName: 'Type' }]
            };

            // 3. Validate
            const result = Validator.validateFormElements(fieldIds, rules);
            if (!result.valid) {
                Validator.displayErrors(result.errors, fieldIds);
                window.showNotification('Please fix the form errors', 'error');
                return;
            }
            Validator.clearErrors(fieldIds);

            // 4. Sanitize Input
            const type = document.getElementById('ncr-type').value;
            const clause = Sanitizer.sanitizeText(document.getElementById('ncr-clause').value);
            const description = Sanitizer.sanitizeText(document.getElementById('ncr-description').value);
            const evidence = Sanitizer.sanitizeText(document.getElementById('ncr-evidence').value);
            const evidenceImage = Sanitizer.sanitizeURL(document.getElementById('ncr-evidence-image-url').value);
            const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-modal')?.value || '');
            const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-modal')?.value || '');
            const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-modal')?.value || '');

            // 5. Save
            if (!report.ncrs) report.ncrs = [];
            report.ncrs.push({
                type,
                clause,
                description,
                evidence,
                evidenceImage,
                transcript: description,
                personnel,
                designation,
                department,
                status: 'Open',
                createdAt: new Date().toISOString()
            });
            report.findings = report.ncrs.length;

            window.saveData();

            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR created successfully with evidence', 'success');
        };
    }

    // Edit existing NCR
    function editNCR(reportId, ncrIdx) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report || !report.ncrs || !report.ncrs[ncrIdx]) return;

        const ncr = report.ncrs[ncrIdx];
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Edit NCR-' + String(ncrIdx + 1).padStart(3, '0');
        modalBody.innerHTML = `
    <form id="ncr-form">
        <div class="form-group">
            <label>Type <span style="color: var(--danger-color);">*</span></label>
            <select class="form-control" id="ncr-type" required>
                <option value="${window.CONSTANTS.NCR_TYPES.OBSERVATION}" ${ncr.type === window.CONSTANTS.NCR_TYPES.OBSERVATION ? 'selected' : ''}>Observation (OBS)</option>
                <option value="${window.CONSTANTS.NCR_TYPES.OFI}" ${ncr.type === window.CONSTANTS.NCR_TYPES.OFI ? 'selected' : ''}>Opportunity for Improvement (OFI)</option>
                <option value="${window.CONSTANTS.NCR_TYPES.MINOR}" ${ncr.type === window.CONSTANTS.NCR_TYPES.MINOR ? 'selected' : ''}>Minor NC</option>
                <option value="${window.CONSTANTS.NCR_TYPES.MAJOR}" ${ncr.type === window.CONSTANTS.NCR_TYPES.MAJOR ? 'selected' : ''}>Major NC</option>
            </select>
        </div>
        <div class="form-group">
            <label>Clause/Requirement</label>
            <input type="text" class="form-control" id="ncr-clause" placeholder="e.g. 7.2, 8.3" value="${window.UTILS.escapeHtml(ncr.clause || '')}">
        </div>
        <div class="form-group">
            <label>Description <span style="color: var(--danger-color);">*</span></label>
            <textarea class="form-control" id="ncr-description" rows="3" required>${window.UTILS.escapeHtml(ncr.description || '')}</textarea>
        </div>
        <div class="form-group">
            <label>Evidence / Objective Evidence</label>
            <textarea class="form-control" id="ncr-evidence" rows="2">${window.UTILS.escapeHtml(ncr.evidence || '')}</textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Personnel Name</label>
                <select class="form-control" id="ncr-personnel-modal" data-action-change="_autoFillPersonnel" data-id="modal">
                    <option value="">-- Select --</option>
                    ${((state.clients || []).find(c => c.name === report.client)?.contacts || []).map(c => `<option value="${window.UTILS.escapeHtml(c.name)}" ${ncr.personnel === c.name ? 'selected' : ''}>${window.UTILS.escapeHtml(c.name)}</option>`).join('')}
                    ${ncr.personnel && !((state.clients || []).find(c => c.name === report.client)?.contacts || []).some(c => c.name === ncr.personnel) ? `<option value="${window.UTILS.escapeHtml(ncr.personnel)}" selected>${window.UTILS.escapeHtml(ncr.personnel)}</option>` : ''}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Designation</label>
                <input type="text" class="form-control" id="ncr-designation-modal" value="${window.UTILS.escapeHtml(ncr.designation || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Department</label>
                <input type="text" class="form-control" id="ncr-department-modal" value="${window.UTILS.escapeHtml(ncr.department || '')}" readonly style="background:#f1f5f9;" placeholder="Auto-filled">
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Status</label>
                <select class="form-control" id="ncr-status">
                    <option value="Open" ${ncr.status === 'Open' || !ncr.status ? 'selected' : ''}>Open</option>
                    <option value="In Progress" ${ncr.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Closed" ${ncr.status === 'Closed' || ncr.status === window.CONSTANTS.STATUS.CLOSED ? 'selected' : ''}>Closed</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Created</label>
                <input type="text" class="form-control" value="${ncr.createdAt ? new Date(ncr.createdAt).toLocaleDateString() : 'N/A'}" readonly style="background: #f1f5f9;">
            </div>
        </div>
        <input type="hidden" id="ncr-evidence-image-url" value="${window.UTILS.escapeHtml(ncr.evidenceImage || '')}">
        ${ncr.evidenceImage ? '<div style="margin-top: 0.5rem;"><img src="' + ncr.evidenceImage + '" style="max-height: 100px; border-radius: 6px; border: 1px solid #e2e8f0;"></div>' : ''}
    </form>
`;

        window.openModal();

        modalSave.onclick = () => {
            const type = document.getElementById('ncr-type').value;
            const clause = Sanitizer.sanitizeText(document.getElementById('ncr-clause').value);
            const description = Sanitizer.sanitizeText(document.getElementById('ncr-description').value);
            const evidence = Sanitizer.sanitizeText(document.getElementById('ncr-evidence').value);
            const personnel = Sanitizer.sanitizeText(document.getElementById('ncr-personnel-modal')?.value || '');
            const designation = Sanitizer.sanitizeText(document.getElementById('ncr-designation-modal')?.value || '');
            const department = Sanitizer.sanitizeText(document.getElementById('ncr-department-modal')?.value || '');
            const status = document.getElementById('ncr-status').value;
            const evidenceImage = document.getElementById('ncr-evidence-image-url').value;

            if (!description.trim()) {
                window.showNotification('Description is required', 'error');
                return;
            }

            // Update existing NCR
            report.ncrs[ncrIdx] = {
                ...report.ncrs[ncrIdx],
                type,
                clause,
                description,
                evidence,
                evidenceImage,
                personnel,
                designation,
                department,
                status,
                updatedAt: new Date().toISOString()
            };

            window.saveData();
            window.closeModal();
            renderExecutionDetail(reportId);
            window.showNotification('NCR updated successfully', 'success');
        };
    }

    function createCAPA(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        const ncrs = report.ncrs || [];

        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalSave = document.getElementById('modal-save');

        modalTitle.textContent = 'Create CAPA';
        modalBody.innerHTML = `
        <form id="capa-form">
            <div class="form-group">
                <label>Linked NCR</label>
                <select class="form-control" id="capa-ncr">
                    <option value="">-- None --</option>
                    ${ncrs.map((ncr, idx) => `<option value="NCR-${String(idx + 1).padStart(3, '0')}">NCR-${String(idx + 1).padStart(3, '0')} - ${ncr.description?.substring(0, 30)}...</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Root Cause <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-root-cause" rows="2" placeholder="What caused this issue?" required></textarea>
            </div>
            <div class="form-group">
                <label>Action Plan <span style="color: var(--danger-color);">*</span></label>
                <textarea class="form-control" id="capa-action" rows="2" placeholder="What corrective/preventive actions will be taken?" required></textarea>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" class="form-control" id="capa-due">
            </div>
        </form>
    `;

        window.openModal();

        modalSave.onclick = () => {
            const linkedNCR = document.getElementById('capa-ncr').value;
            const rootCause = document.getElementById('capa-root-cause').value;
            const actionPlan = document.getElementById('capa-action').value;
            const dueDate = document.getElementById('capa-due').value;

            if (rootCause && actionPlan) {
                if (!report.capas) report.capas = [];
                report.capas.push({
                    linkedNCR,
                    rootCause,
                    actionPlan,
                    dueDate,
                    status: 'In Progress',
                    createdAt: new Date().toISOString()
                });

                window.saveData();
                window.closeModal();
                renderExecutionDetail(reportId);
                window.showNotification('CAPA created successfully');
            } else {
                window.showNotification('Please fill in all required fields', 'error');
            }
        };
    }

    // eslint-disable-next-line no-unused-vars
    function saveObservations(reportId) {
        const report = state.auditReports.find(r => String(r.id) === String(reportId));
        if (!report) return;

        report.positiveObservations = document.getElementById('positive-observations')?.value || '';
        report.ofi = document.getElementById('ofi')?.value || '';

        window.saveData();
        window.showNotification('Observations saved successfully');
    }

    // Save Opening/Closing Meeting Records (ISO 17021-1 Clause 9.4.7)
    // Collect attendees from checkboxes + custom list
    window._collectMeetingAttendees = function (prefix) {
        const attendees = [];
        document.querySelectorAll(`.${prefix}-attendee-cb:checked`).forEach(cb => {
            attendees.push({ name: cb.dataset.name, role: cb.dataset.role || '', organization: cb.dataset.org || '' });
        });
        // Custom attendees
        document.querySelectorAll(`#${prefix}-custom-list .custom-attendee-item`).forEach(el => {
            attendees.push({ name: el.dataset.name, role: el.dataset.role || '', organization: el.dataset.org || '' });
        });
        return attendees;
    };

    window.addCustomMeetingAttendee = function (prefix) {
        const nameEl = document.getElementById(`${prefix}-custom-name`);
        const roleEl = document.getElementById(`${prefix}-custom-role`);
        const orgEl = document.getElementById(`${prefix}-custom-org`);
        if (!nameEl || !nameEl.value.trim()) { window.showNotification('Please enter a name', 'error'); return; }
        const name = nameEl.value.trim();
        const role = roleEl?.value?.trim() || '';
        const org = orgEl?.value?.trim() || '';
        const list = document.getElementById(`${prefix}-custom-list`);
        if (list) {
            const div = document.createElement('div');
            div.className = 'custom-attendee-item';
            div.dataset.name = name;
            div.dataset.role = role;
            div.dataset.org = org;
            div.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: #eff6ff; border-radius: 6px; font-size: 0.85rem; margin-bottom: 0.25rem;';
            div.innerHTML = `<i class="fa-solid fa-user-plus" style="color: #3b82f6;"></i><strong>${window.UTILS.escapeHtml(name)}</strong>${role ? ' – ' + window.UTILS.escapeHtml(role) : ''}${org ? ' (' + window.UTILS.escapeHtml(org) + ')' : ''}<button class="btn btn-sm" style="margin-left: auto; padding: 0 0.25rem; color: #dc2626;" data-action="removeSelf" aria-label="Close"><i class="fa-solid fa-times"></i></button>`;
            list.appendChild(div);
        }
        nameEl.value = ''; if (roleEl) roleEl.value = ''; if (orgEl) orgEl.value = '';
    };

    window.saveMeetingRecords = function (reportId) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) return;

        report.openingMeeting = {
            date: document.getElementById('opening-date')?.value || '',
            time: document.getElementById('opening-time')?.value || '',
            attendees: window._collectMeetingAttendees('opening'),
            notes: document.getElementById('opening-notes')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.opening-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        report.closingMeeting = {
            date: document.getElementById('closing-date')?.value || '',
            time: document.getElementById('closing-time')?.value || '',
            attendees: window._collectMeetingAttendees('closing'),
            summary: document.getElementById('closing-summary')?.value || '',
            response: document.getElementById('closing-response')?.value || '',
            keyPointers: (() => { const kp = {}; document.querySelectorAll('.closing-pointer').forEach(cb => { kp[cb.dataset.key] = cb.checked; }); return kp; })()
        };

        // Sync meetings to Supabase
        window.DataService.syncAuditReport(reportId, {
            openingMeeting: report.openingMeeting,
            closingMeeting: report.closingMeeting
        });

        window.showNotification('Meeting records saved successfully', 'success');
    };

    // Export functions
    window.renderAuditExecutionEnhanced = renderAuditExecutionEnhanced;
    window.renderAuditExecution = renderAuditExecutionEnhanced;
    window.renderExecutionDetail = renderExecutionDetail;
    window.saveChecklist = saveChecklist;
    window.createNCR = createNCR;
    window.editNCR = editNCR;
    window.createCAPA = createCAPA;
    // Note: submitForReview, publishReport, revertToDraft, saveReportDraft,
    //       generateAIConclusion, generateAuditReport are now in reporting-module.js

    // Evidence handling extracted to execution-evidence.js
    // Generate Printable Report - Enhanced Version
    // Generate Printable Report - Enhanced Version
    // Reporting, AI & PDF export extracted to execution-reporting.js
    // Persistent stream for remote audits
    // Screen capture & webcam extracted to execution-evidence.js

    // Global event delegation for section checkboxes (works with dynamically rendered content)
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('section-checkbox')) {
            e.stopPropagation();
            const sectionId = e.target.getAttribute('data-section-id');
            const isChecked = e.target.checked;

            // Find all items in this section and toggle selection
            const section = document.getElementById(sectionId);
            if (!section) {
                console.error('Section not found:', sectionId);
                return;
            }

            const items = section.querySelectorAll('.checklist-item');

            items.forEach((item, _idx) => {
                // Toggle the individual checkbox too
                const itemCheckbox = item.querySelector('.item-checkbox');
                if (itemCheckbox) {
                    itemCheckbox.checked = isChecked;
                }

                if (isChecked) {
                    item.classList.add('selected-item');
                    item.style.background = '#eff6ff';
                    item.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    item.classList.remove('selected-item');
                    item.style.background = '';
                    item.style.borderLeft = '4px solid #e2e8f0';
                }
            });

        }
    });

    // Global event delegation for individual item checkboxes
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('item-checkbox')) {
            const checkbox = e.target;
            const uniqueId = checkbox.getAttribute('data-unique-id');
            const row = document.getElementById('row-' + uniqueId);

            if (row) {
                if (checkbox.checked) {
                    row.classList.add('selected-item');
                    row.style.background = '#eff6ff';
                    row.style.borderLeft = '4px solid var(--primary-color)';
                } else {
                    row.classList.remove('selected-item');
                    row.style.background = '';
                    row.style.borderLeft = '4px solid #e2e8f0';
                }
            }
        }
    });

    // Global event delegation for bulk action buttons
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.bulk-action-btn');
        if (btn) {
            const action = btn.getAttribute('data-action');
            const reportId = btn.getAttribute('data-report-id');

            if (action && reportId) {
                window.bulkUpdateStatus(parseInt(reportId, 10), action);

                // Close menu
                const menu = document.getElementById('bulk-menu-' + reportId);
                if (menu) menu.classList.add('hidden');
            }
        }
    });

    // Global event delegation for status buttons (OK, NC, N/A) - using capture phase
    document.addEventListener('click', function (e) {
        // Check if clicked element or any parent has status-btn class
        let btn = e.target;

        // Log all clicks for debugging
        if (btn.classList && (btn.classList.contains('btn-nc') || btn.classList.contains('btn-ok') || btn.classList.contains('btn-na'))) {
            console.debug('[Execution] Status button clicked:', btn.className);
        }

        while (btn && btn.classList && !btn.classList.contains('status-btn')) {
            btn = btn.parentElement;
            if (!btn || btn === document.body) {
                btn = null;
                break;
            }
        }

        if (btn && btn.classList && btn.classList.contains('status-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const uniqueId = btn.getAttribute('data-unique-id');
            const status = btn.getAttribute('data-status');

            if (uniqueId && status) {
                window.setChecklistStatus(uniqueId, status);
            }
        }
    }, true); // true = capture phase

    // Helper to update meeting records (Opening/Closing)
    window.updateMeetingData = function (reportId, meetingType, field, value) {
        const report = window.DataService.findAuditReport(reportId);
        if (!report) return;

        if (!report[meetingType + 'Meeting']) {
            report[meetingType + 'Meeting'] = {};
        }

        if (field === 'attendees') {
            // Split by comma and clean up
            report[meetingType + 'Meeting'][field] = value.split(',').map(s => s.trim()).filter(s => s);
        } else {
            report[meetingType + 'Meeting'][field] = value;
        }

        window.saveData();
        window.saveChecklist(reportId);
    };

}

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _autoFillPersonnel, toggleAccordion, toggleAllAccordions, initClauseDragReorder, toggleSectionSelection, setChecklistStatus, updateAccordionCounter, addCustomQuestion, saveChecklist, filterChecklistItems, bulkUpdateStatus, submitToLeadAuditor, startDictation, _collectMeetingAttendees, addCustomMeetingAttendee, saveMeetingRecords, renderAuditExecutionEnhanced, renderAuditExecution, renderExecutionDetail, createNCR, editNCR, createCAPA, openCreateReportModal, openEditReportModal, updateMeetingData };
}
