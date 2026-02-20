// ============================================
// EXECUTION TAB HELPER - Checklist Item Renderer
// ============================================
// Extracted from renderExecutionTab for better maintainability

/**
 * Render a single checklist item row
 * @param {Object} item - The checklist item
 * @param {string} checklistId - The checklist ID
 * @param {number|string} idx - Item index
 * @param {boolean} isCustom - Whether this is a custom item
 * @param {Object} progressMap - Progress tracking data
 * @param {Array} departments - List of departments
 * @returns {string} HTML string for the item
 */
window.renderChecklistItemRow = function (item, checklistId, idx, isCustom, progressMap, departments) {
    const uniqueId = isCustom ? `custom-${idx}` : `${checklistId}-${idx}`;
    const saved = progressMap[uniqueId] || {};
    const s = saved.status || ''; // 'conform', 'nc', 'na' or ''

    return `
        <div class="card checklist-item" id="row-${uniqueId}" style="margin-bottom: 0.5rem; padding: 1rem; border-left: 4px solid #e2e8f0;">
             <div style="display: grid; grid-template-columns: 30px 80px 1fr 180px; gap: 1rem; align-items: start;">
                <div style="display: flex; align-items: center;">
                    <input type="checkbox" class="item-checkbox" data-unique-id="${uniqueId}" style="width: 18px; height: 18px; cursor: pointer;" title="Select this item for bulk action">
                </div>
                <div style="font-weight: bold; color: var(--primary-color);">${item.clause || 'N/A'}</div>
                <div>
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">${window.UTILS.escapeHtml(item.requirement)}</div>
                    <div style="position: relative;">
                        <input type="text" id="comment-${uniqueId}" placeholder="Auditor remarks..." class="form-control form-control-sm" value="${window.UTILS.escapeHtml(saved.comment || '')}" style="margin-bottom: 0; padding-right: 35px;">
                        <button type="button" id="mic-btn-${uniqueId}" data-action="startDictation" data-id="${uniqueId}" style="position: absolute; right: 0; top: 0; height: 100%; width: 35px; background: none; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center;" title="Dictate to Remarks">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button type="button" class="btn-icon btn-na status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NA}" title="Not Applicable">N/A</button>
                    <button type="button" class="btn-icon btn-ok status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.CONFORM}" title="Conformity"><i class="fa fa-check"></i></button>
                    <button type="button" class="btn-icon btn-nc status-btn" data-unique-id="${uniqueId}" data-status="${window.CONSTANTS.STATUS.NC}" title="Non-Conformity"><i class="fa fa-times"></i></button>
                </div>
             </div>
             
             <!-- Hidden status input -->
             <input type="hidden" class="status-input" data-checklist="${checklistId}" data-item="${idx}" data-custom="${isCustom}" data-clause="${window.UTILS.escapeHtml(item.clause || '')}" data-requirement="${window.UTILS.escapeHtml(item.requirement || '')}" id="status-${uniqueId}" value="${s}">
             
             <!-- NCR Panel (Conditional) -->
             <div id="ncr-panel-${uniqueId}" class="ncr-panel" style="display: ${s === 'nc' ? 'block' : 'none'}; background: #fff1f2; border: 1px solid #fecaca; padding: 1rem; margin-top: 1rem; border-radius: 6px;">
                 <h5 style="color: var(--danger-color); margin-bottom: 0.5rem; display: flex; align-items: center;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 0.5rem;"></i> Non-Conformity Details</h5>
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
                             <button type="button" class="btn btn-sm btn-info" onclick="const el = document.getElementById('criteria-${uniqueId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'" title="View Classification Matrix (ISO 17021-1)">
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
                            <div style="text-align: right; margin-top: 5px;"><small style="color: blue; cursor: pointer;" onclick="this.parentElement.parentElement.style.display='none'">Close</small></div>
                         </div>
                     </div>
                     <div style="display: flex; flex-direction: column;">
                         <label style="font-size: 0.8rem;">Evidence Image <span style="font-weight: normal; color: var(--text-secondary);">(max 5MB)</span></label>
                        <div style="display: flex; gap: 5px;">
                             <button type="button" class="btn btn-sm btn-outline-secondary" style="border-style: dashed; flex: 1;" data-action="clickElement" data-id="img-${uniqueId}">
                                 <i class="fa-solid fa-file-image"></i> Upload
                             </button>
                             <button type="button" class="btn btn-sm btn-outline-secondary" style="flex: 1;" data-action="handleCameraButton" data-id="${uniqueId}" title="Capture photo from mobile camera or webcam">
                                 <i class="fa-solid fa-camera"></i> Camera
                             </button>
                             <button type="button" class="btn btn-sm btn-outline-primary" style="flex: 1;" data-action="captureScreenEvidence" data-id="${uniqueId}" title="Capture from Zoom/Teams Screen Share">
                                 <i class="fa-solid fa-desktop"></i> Screen
                             </button>
                         </div>
                         <input type="file" id="img-${uniqueId}" accept="image/*" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                         <input type="file" id="cam-${uniqueId}" accept="image/*" capture="environment" style="display: none;" data-action-change="handleEvidenceUpload" data-arg1="${uniqueId}" data-arg2="this">
                     </div>
                 </div>
                 
                 <!-- Cross-Reference: Designation & Department -->
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                     <div>
                         <label style="font-size: 0.8rem;">Interviewee Designation</label>
                         <input type="text" id="ncr-designation-${uniqueId}" class="form-control form-control-sm" placeholder="e.g., Quality Manager" value="${saved.designation || ''}">
                     </div>
                     <div>
                         <label style="font-size: 0.8rem;">Department</label>
                         <select id="ncr-department-${uniqueId}" class="form-control form-control-sm">
                            <option value="">-- Select --</option>
                            ${departments.map(d => `<option value="${d}" ${saved.department === d ? 'selected' : ''}>${d}</option>`).join('')}
                            ${saved.department && !departments.includes(saved.department) ? `<option value="${saved.department}" selected>${saved.department}</option>` : ''}
                         </select>
                     </div>
                 </div>
                 
                 <!-- Evidence Image Preview -->
                 <div id="evidence-preview-${uniqueId}" style="display: ${saved.evidenceImage ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                     <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm);">
                         <img id="evidence-img-${uniqueId}" src="${saved.evidenceImage || ''}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;" data-action="viewEvidenceImage" data-id="${uniqueId}" title="Click to enlarge">
                         <div style="flex: 1;">
                             <p style="margin: 0; font-size: 0.8rem; color: var(--success-color); font-weight: 500;"><i class="fa-solid fa-check-circle"></i> Image attached</p>
                             <p id="evidence-size-${uniqueId}" style="margin: 0; font-size: 0.7rem; color: var(--text-secondary);">${saved.evidenceSize || ''}</p>
                         </div>
                         <button type="button" class="btn btn-sm" data-action="removeEvidence" data-id="${uniqueId}" style="color: var(--danger-color);" title="Remove"><i class="fa-solid fa-trash"></i></button>
                     </div>
                 </div>
                 <input type="hidden" id="evidence-data-${uniqueId}" value="${saved.evidenceImage ? 'attached' : ''}">
             </div>
        </div>
    `;
};

console.log('✅ Checklist item renderer loaded');
