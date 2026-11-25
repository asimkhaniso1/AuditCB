// ============================================
// EXECUTION MODULE - Evidence & Media Handling
// ============================================
// Extracted from execution-module-v2.js for maintainability.
// Contains: EvidenceDB (IndexedDB), image upload/compression,
//   evidence viewing/removal, screen capture, webcam capture.

(function () {
    'use strict';

    // ============================================
    // EVIDENCE IMAGE HANDLING (Compression & Upload)
    // ============================================
    // IndexedDB Image Store — avoids localStorage 5MB limit
    // ============================================
    const EvidenceDB = {
        DB_NAME: 'AuditCB_Evidence',
        STORE_NAME: 'images',
        DB_VERSION: 1,
        _db: null,
        async open() {
            if (this._db) return this._db;
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                req.onupgradeneeded = (e) => {
                    e.target.result.createObjectStore(this.STORE_NAME);
                };
                req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
                req.onerror = (e) => reject(e.target.error);
            });
        },
        async put(key, dataUrl) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).put(dataUrl, key);
                tx.oncomplete = () => resolve(key);
                tx.onerror = (e) => reject(e.target.error);
            });
        },
        async get(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readonly');
                const req = tx.objectStore(this.STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = (e) => reject(e.target.error);
            });
        },
        async remove(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                tx.objectStore(this.STORE_NAME).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        }
    };
    window._EvidenceDB = EvidenceDB;

    // ============================================
    // EVIDENCE UTILS — shared compression/thumb helpers + evidence ID registry
    // ============================================
    // Evidence synced to the cloud lives in the public `audit-images` Supabase
    // Storage bucket, so these are cross-origin https:// URLs. Loading one
    // WITHOUT crossOrigin taints the canvas, and _canvasDownscale's
    // toDataURL() then throws SecurityError — which every caller swallowed as
    // "compression unavailable" and silently embedded the ORIGINAL image. That
    // is why exported PDFs carried full-resolution (1920px) evidence and ran to
    // 5MB. Supabase Storage answers with `Access-Control-Allow-Origin: *`, so
    // requesting with CORS keeps the canvas clean and downscaling works.
    // Falls back to a plain (tainting) load if the host sends no CORS headers,
    // so display still works even though compression will fail there.
    function _loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const isRemote = typeof dataUrl === 'string' && /^https?:\/\//i.test(dataUrl);
            const attempt = (useCors) => {
                const img = new Image();
                if (useCors) img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = (e) => {
                    if (useCors) { attempt(false); return; }
                    reject(e);
                };
                img.src = dataUrl;
            };
            attempt(isRemote);
        });
    }

    function _canvasDownscale(img, maxPx, quality) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Never upscale — only cap the longest side at maxPx
        if (width > maxPx || height > maxPx) {
            if (width > height) {
                height = Math.round((height * maxPx) / width);
                width = maxPx;
            } else {
                width = Math.round((width * maxPx) / height);
                height = maxPx;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // White background handles PNG transparency; canvas round-trip strips EXIF automatically
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        return canvas.toDataURL('image/jpeg', quality);
    }

    async function evidenceCompress(dataUrl, opts) {
        const { maxPx = 1600, quality = 0.75 } = opts || {};
        const img = await _loadImage(dataUrl);
        return _canvasDownscale(img, maxPx, quality);
    }

    async function evidenceThumb(dataUrl, opts) {
        const { maxPx = 320, quality = 0.7 } = opts || {};
        const img = await _loadImage(dataUrl);
        return _canvasDownscale(img, maxPx, quality);
    }

    // Persistent Evidence IDs: stable EV-<n> per report session, keyed by uniqueId + idbKey/url.
    // Sequence and per-item id lists live on window._evidenceMeta (non-colliding __seq key).
    function registerEvidence(uniqueId, idbKey) {
        window._evidenceMeta = window._evidenceMeta || {};
        if (typeof window._evidenceMeta.__seq !== 'number') window._evidenceMeta.__seq = 0;

        const meta = window._evidenceMeta[uniqueId] || (window._evidenceMeta[uniqueId] = {
            capturedAt: null, capturedAtList: [], location: null, locationRaw: null
        });
        if (!Array.isArray(meta.evidenceIds)) meta.evidenceIds = [];
        if (!Array.isArray(meta.evidenceKeys)) meta.evidenceKeys = [];

        window._evidenceMeta.__seq += 1;
        const evId = 'EV-' + String(window._evidenceMeta.__seq).padStart(2, '0');

        meta.evidenceIds.push(evId);
        meta.evidenceKeys.push(idbKey);

        return evId;
    }

    function getEvidenceIndex() {
        const out = [];
        const store = window._evidenceMeta || {};
        Object.keys(store).forEach((uniqueId) => {
            if (uniqueId === '__seq') return;
            const meta = store[uniqueId];
            if (!meta || !Array.isArray(meta.evidenceIds)) return;
            meta.evidenceIds.forEach((evId, idx) => {
                out.push({
                    evId,
                    uniqueId,
                    idbKey: (meta.evidenceKeys && meta.evidenceKeys[idx]) || null,
                    capturedAt: (meta.capturedAtList && meta.capturedAtList[idx]) || meta.capturedAt || null,
                    location: meta.location || null
                });
            });
        });
        return out;
    }

    window.EvidenceUtils = {
        compress: evidenceCompress,
        thumb: evidenceThumb,
        registerEvidence: registerEvidence,
        getEvidenceIndex: getEvidenceIndex
    };

    // ============================================
    // EVIDENCE CAPTURE METADATA (timestamp + opt-in geolocation)
    // ============================================
    // In-memory store keyed by uniqueId (the checklist item's DOM id suffix).
    // Populated at the moment evidence is actually captured (never on re-render).
    // Shape: { capturedAt: ISOString|null, capturedAtList: ISOString[], location: string|null, locationRaw: {lat,lng,accuracy}|null }
    // Other files (e.g. the save/persist path in execution-module-v2.js) can read this via
    // window.getEvidenceCaptureMeta(uniqueId) when building the checklist item to persist.
    window._evidenceMeta = window._evidenceMeta || {};

    window.getEvidenceCaptureMeta = function (uniqueId) {
        return window._evidenceMeta[uniqueId] || null;
    };

    // Record a capture event's timestamp. Only sets evidenceCapturedAt on the FIRST capture
    // for a given item (never overwrites an earlier timestamp); every capture is appended
    // to capturedAtList so it stays aligned with evidenceImages[].
    function recordCaptureMeta(uniqueId) {
        const meta = window._evidenceMeta[uniqueId] || (window._evidenceMeta[uniqueId] = {
            capturedAt: null, capturedAtList: [], location: null, locationRaw: null
        });
        const iso = new Date().toISOString();
        if (!meta.capturedAt) meta.capturedAt = iso; // first capture wins, never overwritten later
        meta.capturedAtList.push(iso);
        return iso;
    }

    // Attempt to attach geolocation to the most recent capture for this item.
    // OPT-IN AND OFF BY DEFAULT: only runs when window.state.settings.captureEvidenceLocation === true
    // (a settings toggle elsewhere can flip this flag; no UI for it lives in this file).
    // Never blocks or delays capture — fire-and-forget with a short timeout; on denial/error/timeout
    // we simply proceed without location. The coordinates are only ever stored locally with the
    // audit record (evidenceLocation / evidenceLocationRaw) and are never transmitted anywhere else;
    // they are rendered only in the report's Evidence Gallery.
    function maybeCaptureLocation(uniqueId) {
        try {
            // Prefer window.state.cbSettings (CB settings module) — fall back to window.state.settings
            // in case the flag was set through a different path. Off unless explicitly true.
            const cbFlag = window.state && window.state.cbSettings && window.state.cbSettings.captureEvidenceLocation;
            const fallbackFlag = window.state && window.state.settings && window.state.settings.captureEvidenceLocation;
            const optedIn = !!(cbFlag ?? fallbackFlag);
            if (!optedIn) return;
            if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') return;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    try {
                        const meta = window._evidenceMeta[uniqueId];
                        if (!meta) return; // item no longer tracked (unlikely)
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        const accuracy = pos.coords.accuracy;
                        const locStr = `${lat.toFixed(4)}, ${lng.toFixed(4)}` + (Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)}m)` : '');
                        // Keep the first location captured for this item; don't clobber on later images.
                        if (!meta.location) {
                            meta.location = locStr;
                            meta.locationRaw = { lat, lng, accuracy };
                        }
                    } catch (_e) { /* non-fatal, ignore */ }
                },
                () => { /* denied / unavailable / timeout: proceed silently, no location attached */ },
                { timeout: 4000, maximumAge: 60000, enableHighAccuracy: false }
            );
        } catch (_e) { /* geolocation API not available in this environment; ignore */ }
    }

    // Resolve idb:// references to displayable blob URLs
    window.resolveEvidenceUrl = async function (url) {
        if (!url || !url.startsWith('idb://')) return url;
        try {
            const dataUrl = await EvidenceDB.get(url);
            return dataUrl || url;
        } catch (e) {
            console.warn('Failed to resolve evidence URL:', url, e);
            return url;
        }
    };

    // Post-render: resolve all idb:// thumbnails in the DOM
    window.resolveAllIdbThumbs = async function () {
        const idbImgs = document.querySelectorAll('img[data-idb-key]');
        for (const img of idbImgs) {
            const key = img.dataset.idbKey;
            if (!key) continue;
            try {
                const dataUrl = await EvidenceDB.get(key);
                if (dataUrl) {
                    img.src = dataUrl;
                    img.style.background = '';
                    img.dataset.idbKey = ''; // mark as resolved
                }
            } catch (e) { if (window.Logger) window.Logger.debug('Evidence', 'IDB thumb resolve failed:', e.message); }
        }
    };
    // Auto-resolve when DOM updates (debounced)
    let _idbResolveTimer;
    const _idbObserver = new MutationObserver(() => {
        clearTimeout(_idbResolveTimer);
        _idbResolveTimer = setTimeout(() => window.resolveAllIdbThumbs(), 300);
    });
    _idbObserver.observe(document.body, { childList: true, subtree: true });

    // Handle evidence image upload with compression and 5MB limit
    window.handleEvidenceUpload = function (uniqueId, input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            window.showNotification('Please select an image file', 'error');
            input.value = '';
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            window.showNotification('Image exceeds 5MB limit', 'error');
            input.value = '';
            return;
        }

        // Show loading indicator
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        if (previewDiv) {
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = `
            <div style="padding: 1rem; background: #f8fafc; border-radius: var(--radius-sm); text-align: center;">
                <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary-color);"></i>
                <span style="margin-left: 0.5rem; font-size: 0.85rem;">Compressing & Uploading...</span>
            </div>
        `;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = async function () {
                try {
                    // 1. Compress
                    const compressedDataUrl = await compressImage(img, file.type);
                    const _compressedSize = Math.round((compressedDataUrl.length * 3 / 4) / 1024);

                    let finalUrl = compressedDataUrl;
                    let isCloud = false;
                    let displayUrl = compressedDataUrl; // always use this for thumbnail display

                    // 2. Upload to Supabase (if online)
                    if (window.navigator.onLine && window.SupabaseClient) {
                        try {
                            if (!window.SupabaseClient.isInitialized) {
                                console.warn('[Evidence Upload] Supabase not initialized - trying to wait...');
                                await new Promise(r => setTimeout(r, 1000));
                            }
                            if (window.SupabaseClient.isInitialized) {
                                // Convert DataURL to Blob (CSP-safe, no fetch on data: URLs)
                                const b64 = compressedDataUrl.split(',')[1];
                                const byteStr = atob(b64);
                                const mimeMatch = compressedDataUrl.match(/data:([^;]+)/);
                                const mime = mimeMatch ? mimeMatch[1] : file.type;
                                const ab = new ArrayBuffer(byteStr.length);
                                const ia = new Uint8Array(ab);
                                for (let bi = 0; bi < byteStr.length; bi++) ia[bi] = byteStr.charCodeAt(bi);
                                const blob = new Blob([ab], { type: mime });
                                const uploadFile = new File([blob], file.name, { type: mime });

                                const result = await window.SupabaseClient.storage.uploadAuditImage(uploadFile, 'ncr-evidence', uniqueId + '-' + Date.now());
                                if (result && result.url) {
                                    finalUrl = result.url;
                                    displayUrl = result.url;
                                    isCloud = true;
                                } else {
                                    console.warn('[Evidence Upload] No URL returned - result was:', JSON.stringify(result));
                                }
                            } else {
                                console.warn('[Evidence Upload] Supabase still not initialized after wait');
                            }
                        } catch (uploadErr) {
                            console.error('[Evidence Upload] Failed:', uploadErr.message || uploadErr);
                            console.warn('[Evidence Upload] Falling back to IndexedDB');
                        }
                    }

                    // 2b. If cloud failed, store in IndexedDB (avoids localStorage overflow)
                    if (!isCloud) {
                        try {
                            const idbKey = 'idb://evidence-' + uniqueId + '-' + Date.now();
                            await EvidenceDB.put(idbKey, compressedDataUrl);
                            finalUrl = idbKey; // small string for state/localStorage
                        } catch (idbErr) {
                            console.error('[Evidence Upload] IndexedDB store failed:', idbErr);
                            // Last resort: keep base64 in state (may hit quota)
                            finalUrl = compressedDataUrl;
                        }
                    }

                    // 2c. Record capture timestamp (and, if opted in, attempt geolocation)
                    const capturedAtIso = recordCaptureMeta(uniqueId);
                    maybeCaptureLocation(uniqueId);

                    // 2d. Assign a stable Evidence ID for cross-referencing in the report
                    const evId = window.EvidenceUtils.registerEvidence(uniqueId, finalUrl);

                    // 3. Append to multi-image preview strip
                    if (previewDiv) {
                        previewDiv.style.display = 'flex';
                        const existingThumbs = previewDiv.querySelectorAll('.ev-thumb');
                        const newIdx = existingThumbs.length;
                        const safeDisplay = displayUrl.replace(/'/g, "\\'");
                        const thumb = document.createElement('div');
                        thumb.className = 'ev-thumb';
                        thumb.dataset.idx = newIdx;
                        thumb.dataset.saveUrl = finalUrl; // store URL/idb-key for saving
                        thumb.dataset.capturedAt = capturedAtIso; // ISO 8601 capture time, for future consumers
                        thumb.dataset.evId = evId; // stable Evidence ID (EV-NN) for report cross-reference
                        thumb.style.cssText = 'position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;';
                        thumb.innerHTML = `
                            <img src="${displayUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" data-action="viewEvidenceImageByUrl" data-id="${safeDisplay}"/>
                            <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${newIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">\u00d7</button>
                        `;
                        previewDiv.appendChild(thumb);
                    }

                    // 4. Update Hidden Inputs
                    const evidenceData = document.getElementById('evidence-data-' + uniqueId);
                    if (evidenceData) evidenceData.value = 'attached'; if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();

                    window.showNotification(isCloud ? 'Image uploaded to cloud' : 'Image saved locally', 'success');

                } catch (err) {
                    console.error('Image processing error:', err);
                    window.showNotification('Error processing image', 'error');
                    if (previewDiv) previewDiv.style.display = 'none';
                    input.value = '';
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Compress image to reduce storage size.
    // Delegates to window.EvidenceUtils.compress (maxPx 1600, quality 0.75) — raised from the old
    // 600px/0.5 cap, which was too aggressive and hurt evidence readability.
    async function compressImage(img, _fileType) {
        return window.EvidenceUtils.compress(img.src, { maxPx: 1600, quality: 0.75 });
    }

    // ============================================
    // EVIDENCE VIEWER
    // ============================================
    // One viewer for every evidence image: checklist thumbnails, the Review &
    // Submit "View Evidence" link and the older single-image opener. It used to
    // be three lightboxes, the one behind checklist thumbnails showing a single
    // image with only a close button: no way to step to the item's next
    // screenshot, no count, and no zoom, so a screenshot of a document (PC
    // Connection's 2026 internal audit report, 19 Nov 2026) could not be read.
    //
    // Built with DOM calls, not innerHTML, so an image URL can never break the
    // markup (the Review & Submit thumbnail strip had a broken attribute), and
    // with listeners rather than inline handlers, for the CSP.
    window.EvidenceViewer = (function () {
        // 0 = fit to the window; zooming in from Fit goes straight to 100%, the
        // size at which a screenshot of a document can be read.
        const ZOOMS = [0, 1, 1.5, 2, 3];
        let current = null;

        function el(tag, style, attrs) {
            const n = document.createElement(tag);
            if (style) n.style.cssText = style;
            Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
            return n;
        }
        function button(label, title, onClick) {
            const b = el('button', 'background: rgba(255,255,255,0.14); color: #fff; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; padding: 6px 12px; font-size: 0.9rem; cursor: pointer; min-width: 36px;', { type: 'button', title: title, 'aria-label': title });
            b.textContent = label;
            b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
            return b;
        }

        function close() {
            if (!current) return;
            document.removeEventListener('keydown', current.onKey, true);
            if (current.overlay.parentNode) current.overlay.parentNode.removeChild(current.overlay);
            current = null;
        }

        /**
         * Open the viewer.
         * @param {string[]} srcs  image URLs, in order
         * @param {number} [start] index to show first
         * @param {{title?: string}} [opts]
         */
        function open(srcs, start, opts) {
            const list = (Array.isArray(srcs) ? srcs : [srcs]).map(function (s) { return String(s || ''); }).filter(Boolean);
            if (!list.length) {
                if (window.showNotification) window.showNotification('No evidence image to show.', 'warning');
                return null;
            }
            close();
            const o = opts || {};
            const state = { idx: Math.min(Math.max(0, Number(start) || 0), list.length - 1), zoom: 0 };

            const overlay = el('div', 'position: fixed; inset: 0; background: rgba(15,23,42,0.94); z-index: 10000; display: flex; flex-direction: column;', { id: 'evidence-viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Evidence viewer' });
            const bar = el('div', 'display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: rgba(0,0,0,0.45); color: #fff; flex: 0 0 auto; flex-wrap: wrap;');
            const label = el('div', 'flex: 1 1 auto; font-weight: 600; font-size: 0.95rem;', { class: 'ev-viewer-label', 'aria-live': 'polite' });
            const zoomLabel = el('span', 'font-size: 0.85rem; opacity: 0.85; min-width: 44px; text-align: center;');
            const stage = el('div', 'flex: 1 1 auto; overflow: auto; display: flex; align-items: center; justify-content: center; position: relative; padding: 12px;');
            const img = el('img', 'max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); background: #fff; cursor: zoom-in;', { alt: 'Evidence image' });
            const strip = el('div', 'display: flex; gap: 8px; justify-content: center; padding: 10px; background: rgba(0,0,0,0.45); flex: 0 0 auto; overflow-x: auto;');

            function render() {
                img.src = list[state.idx];
                label.textContent = (o.title ? o.title + ' — ' : '') + 'Evidence ' + (state.idx + 1) + ' of ' + list.length;
                const z = ZOOMS[state.zoom];
                if (!z) {
                    img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.width = ''; img.style.cursor = 'zoom-in';
                    stage.style.alignItems = 'center'; stage.style.justifyContent = 'center';
                    zoomLabel.textContent = 'Fit';
                } else {
                    const w = (img.naturalWidth || 1200) * z;
                    img.style.maxWidth = 'none'; img.style.maxHeight = 'none'; img.style.width = w + 'px'; img.style.cursor = 'zoom-out';
                    // Start-aligned when larger than the window, so the whole image scrolls into reach.
                    stage.style.alignItems = 'flex-start'; stage.style.justifyContent = 'flex-start';
                    zoomLabel.textContent = Math.round(z * 100) + '%';
                }
                Array.prototype.forEach.call(strip.children, function (t, i) {
                    t.style.outline = i === state.idx ? '2px solid #fff' : 'none';
                    t.style.opacity = i === state.idx ? '1' : '0.55';
                });
            }
            function go(delta) { state.idx = (state.idx + delta + list.length) % list.length; state.zoom = 0; render(); }
            function zoom(delta) { state.zoom = Math.min(ZOOMS.length - 1, Math.max(0, state.zoom + delta)); render(); }

            const many = list.length > 1;
            bar.appendChild(label);
            if (many) bar.appendChild(button('‹ Previous', 'Previous image (←)', function () { go(-1); }));
            if (many) bar.appendChild(button('Next ›', 'Next image (→)', function () { go(1); }));
            bar.appendChild(button('−', 'Zoom out (−)', function () { zoom(-1); }));
            bar.appendChild(zoomLabel);
            bar.appendChild(button('+', 'Zoom in (+)', function () { zoom(1); }));
            bar.appendChild(button('Fit', 'Fit to window (0)', function () { state.zoom = 0; render(); }));
            bar.appendChild(button('✕ Close', 'Close (Esc)', close));

            stage.appendChild(img);
            if (many) {
                const side = 'position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 64px; font-size: 2rem; background: rgba(0,0,0,0.45); color: #fff; border: none; cursor: pointer; border-radius: 8px;';
                const prev = el('button', side + ' left: 8px;', { type: 'button', 'aria-label': 'Previous image' }); prev.textContent = '‹';
                const next = el('button', side + ' right: 8px;', { type: 'button', 'aria-label': 'Next image' }); next.textContent = '›';
                prev.addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
                next.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
                stage.appendChild(prev); stage.appendChild(next);
                list.forEach(function (src, i) {
                    const t = el('img', 'width: 64px; height: 48px; object-fit: cover; border-radius: 4px; cursor: pointer; flex: 0 0 auto;', { alt: 'Evidence ' + (i + 1) });
                    t.src = src;
                    t.addEventListener('click', function (e) { e.stopPropagation(); state.idx = i; state.zoom = 0; render(); });
                    strip.appendChild(t);
                });
            }
            // Click the image to toggle between fit and 100%.
            img.addEventListener('click', function (e) { e.stopPropagation(); state.zoom = ZOOMS[state.zoom] ? 0 : ZOOMS.indexOf(1); render(); });
            img.addEventListener('load', function () { if (ZOOMS[state.zoom]) render(); });
            // A click on the empty backdrop around the image closes it.
            stage.addEventListener('click', function (e) { if (e.target === stage) close(); });

            overlay.appendChild(bar);
            overlay.appendChild(stage);
            if (many) overlay.appendChild(strip);

            const onKey = function (e) {
                if (e.key === 'Escape') { e.preventDefault(); close(); }
                else if (e.key === 'ArrowRight' && many) { e.preventDefault(); go(1); }
                else if (e.key === 'ArrowLeft' && many) { e.preventDefault(); go(-1); }
                else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1); }
                else if (e.key === '-') { e.preventDefault(); zoom(-1); }
                else if (e.key === '0') { e.preventDefault(); state.zoom = 0; render(); }
            };
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(overlay);
            current = { overlay: overlay, onKey: onKey, state: state, list: list };
            render();
            return current;
        }

        // The image a thumbnail shows, and the other images of the same
        // checklist item (its evidence strip), so the viewer can step through them.
        function srcOf(imgEl) {
            return (imgEl && (imgEl.getAttribute('src') || (imgEl.dataset && (imgEl.dataset.src || imgEl.dataset.id)))) || '';
        }
        function openFromElement(imgEl) {
            const strip = imgEl && imgEl.closest ? imgEl.closest('[id^="evidence-preview-"]') : null;
            if (!strip) return open([srcOf(imgEl)], 0);
            const imgs = Array.prototype.slice.call(strip.querySelectorAll('.ev-thumb img'));
            const srcs = imgs.map(srcOf);
            const start = Math.max(0, imgs.indexOf(imgEl));
            // Thumbnails still loading from the device store have no src yet; skip them.
            const shown = []; let startShown = 0;
            srcs.forEach(function (s, i) { if (!s) return; if (i === start) startShown = shown.length; shown.push(s); });
            return open(shown, startShown);
        }
        function openFromUrl(url) {
            const u = String(url || '');
            const thumbs = document.querySelectorAll('[id^="evidence-preview-"] .ev-thumb img');
            const match = Array.prototype.find.call(thumbs, function (t) { return srcOf(t) === u; });
            return match ? openFromElement(match) : open([u], 0);
        }

        return { open: open, close: close, openFromElement: openFromElement, openFromUrl: openFromUrl, isOpen: function () { return !!current; } };
    })();

    // View evidence image in full size (modal/popup)
    window.viewEvidenceImage = function (uniqueId) {

        // Strategy 1: Standard ID
        let imgEl = document.getElementById('evidence-img-' + uniqueId);

        // Strategy 2: If uniqueId looks like "0" (index-only), try to find it via the row container
        if (!imgEl) {
            console.warn(`[viewEvidenceImage] Element 'evidence-img-${uniqueId}' not found. Searching by context...`);

            // Try to find the file input which usually has the same ID suffix
            const fileInput = document.getElementById('img-' + uniqueId);
            if (fileInput) {
                // Look for sibling/cousin image in the same container
                const container = fileInput.closest('.ncr-panel') || fileInput.parentElement.parentElement;
                if (container) {
                    const nearbyImg = container.querySelector('img[id^="evidence-img-"]');
                    if (nearbyImg) {
                        imgEl = nearbyImg;
                    }
                }
            }
        }

        if (!imgEl) {
            // Strategy 3: Try to find ANY evidence image if we are desperate and uniqueId is just '0'
            if (uniqueId === 0 || uniqueId === '0') {
                const firstImg = document.querySelector('img[id^="evidence-img-"]');
                if (firstImg) {
                    imgEl = firstImg;
                }
            }
        }

        if (!imgEl) {
            console.error('[viewEvidenceImage] Image element DEFINITELY not found for:', uniqueId);
            window.showNotification('Error: Image element not found. Please refresh and try again.', 'error');
            return;
        }

        if (!imgEl.src || imgEl.src === '' || imgEl.src.includes('placeholder')) {
            console.warn('[viewEvidenceImage] Image source is empty or invalid');
            window.showNotification('No image source found', 'warning');
            return;
        }


        window.EvidenceViewer.openFromElement(imgEl);
    };

    // View evidence image directly from cached data (used in Review tab)
    window.viewEvidenceImageDirect = function (findingId) {
        const cached = window._evidenceCache && window._evidenceCache[findingId];
        if (!cached) {
            window.showNotification('Evidence image not found. Please view from the Checklist tab.', 'warning');
            return;
        }
        // Handle both old (string) and new (array) formats
        window.EvidenceViewer.open(Array.isArray(cached) ? cached : [cached], 0);
    };

    // Remove evidence image
    window.removeEvidence = function (uniqueId) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        const evidenceData = document.getElementById('evidence-data-' + uniqueId);
        const fileInput = document.getElementById('img-' + uniqueId);

        if (previewDiv) { previewDiv.style.display = 'none'; previewDiv.innerHTML = ''; }
        if (evidenceData) evidenceData.value = ''; if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();
        if (fileInput) fileInput.value = '';

        window.showNotification('Evidence image removed', 'info');
    };

    // Remove a specific image by index from the multi-image strip
    window.removeEvidenceByIdx = function (uniqueId, idx) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        if (!previewDiv) return;
        const thumbs = previewDiv.querySelectorAll('.ev-thumb');
        if (thumbs[idx]) thumbs[idx].remove();
        // If no thumbs left, hide preview and clear data
        if (previewDiv.querySelectorAll('.ev-thumb').length === 0) {
            previewDiv.style.display = 'none';
            const evidenceData = document.getElementById('evidence-data-' + uniqueId);
            if (evidenceData) evidenceData.value = ''; if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();
        }
    };

    // View any evidence image by URL in a lightbox overlay
    window.viewEvidenceImageByUrl = function (url) {
        if (!url) return;
        // Opens with the rest of the item's images when the URL is one of its thumbnails.
        window.EvidenceViewer.openFromUrl(url);
    };
    window.activeAuditScreenStream = null;

    window.captureScreenEvidence = async function (uniqueId) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            window.showNotification('Screen capture is not supported in this environment (needs HTTPS).', 'error');
            return;
        }

        try {
            let stream = window.activeAuditScreenStream;
            let isNew = false;

            // Check active stream
            if (!stream || !stream.active) {
                window.showNotification('Select the Remote Audit Window (Zoom/Teams) once. It will stay active for easy capture.', 'info');
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" },
                    audio: false
                });
                window.activeAuditScreenStream = stream;
                isNew = true;

                // Handle stop sharing
                stream.getVideoTracks()[0].onended = () => {
                    window.activeAuditScreenStream = null;
                    window.showNotification('Screen sharing session ended.', 'info');
                };
            }

            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.play();

            // Wait for buffer
            await new Promise(r => setTimeout(r, isNew ? 500 : 200));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            const rawDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Downscale/compress screen captures (previously stored at native resolution uncapped)
            const dataUrl = await window.EvidenceUtils.compress(rawDataUrl, { maxPx: 1600, quality: 0.75 });

            // Cleanup video element (keep stream alive for reuse)
            video.pause();
            video.srcObject = null;
            video.remove();

            // Store the image (Supabase or IndexedDB)
            let finalUrl = dataUrl;
            let displayUrl = dataUrl;
            let isCloud = false;

            if (window.navigator.onLine && window.SupabaseClient) {
                try {
                    if (!window.SupabaseClient.isInitialized) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    if (window.SupabaseClient.isInitialized) {
                        // Convert DataURL to Blob (CSP-safe, no fetch on data: URLs)
                        const b64 = dataUrl.split(',')[1];
                        const byteStr = atob(b64);
                        const ab = new ArrayBuffer(byteStr.length);
                        const ia = new Uint8Array(ab);
                        for (let bi = 0; bi < byteStr.length; bi++) ia[bi] = byteStr.charCodeAt(bi);
                        const blob = new Blob([ab], { type: 'image/jpeg' });
                        const uploadFile = new File([blob], 'screen-capture-' + Date.now() + '.jpg', { type: 'image/jpeg' });
                        const result = await window.SupabaseClient.storage.uploadAuditImage(uploadFile, 'ncr-evidence', uniqueId + '-sc-' + Date.now());
                        if (result && result.url) {
                            finalUrl = result.url;
                            displayUrl = result.url;
                            isCloud = true;
                        }
                    }
                } catch (uploadErr) {
                    console.error('[Screen Capture] Cloud upload failed:', uploadErr.message);
                }
            }

            // Fallback to IndexedDB
            if (!isCloud) {
                try {
                    const idbKey = 'idb://evidence-' + uniqueId + '-sc-' + Date.now();
                    await EvidenceDB.put(idbKey, dataUrl);
                    finalUrl = idbKey;
                } catch (idbErr) {
                    console.error('[Screen Capture] IndexedDB store failed:', idbErr);
                    finalUrl = dataUrl;
                }
            }

            // Record capture timestamp (and, if opted in, attempt geolocation)
            const capturedAtIso = recordCaptureMeta(uniqueId);
            maybeCaptureLocation(uniqueId);

            // Assign a stable Evidence ID for cross-referencing in the report
            const evId = window.EvidenceUtils.registerEvidence(uniqueId, finalUrl);

            // Append thumbnail to multi-image preview strip
            const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
            if (previewDiv) {
                previewDiv.style.display = 'flex';
                // Remove any loading spinner if present
                const spinner = previewDiv.querySelector('.fa-spinner');
                if (spinner) spinner.closest('div')?.remove();

                const existingThumbs = previewDiv.querySelectorAll('.ev-thumb');
                const newIdx = existingThumbs.length;
                const safeDisplay = displayUrl.replace(/'/g, "\\'");
                const thumb = document.createElement('div');
                thumb.className = 'ev-thumb';
                thumb.dataset.idx = newIdx;
                thumb.dataset.saveUrl = finalUrl;
                thumb.dataset.capturedAt = capturedAtIso;
                thumb.dataset.evId = evId; // stable Evidence ID (EV-NN) for report cross-reference
                thumb.style.cssText = 'position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;';
                thumb.innerHTML = `
                    <img src="${displayUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" data-action="viewEvidenceImageByUrl" data-id="${safeDisplay}"/>
                    <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${newIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">\u00d7</button>
                `;
                previewDiv.appendChild(thumb);
            }

            // Update hidden input
            const evidenceData = document.getElementById('evidence-data-' + uniqueId);
            if (evidenceData) evidenceData.value = 'attached'; if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();

            window.showNotification(isCloud ? 'Screen captured & uploaded to cloud' : 'Screen captured & saved locally', 'success');

        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                console.error(err);
                window.showNotification('Capture failed: ' + err.message, 'error');
            }
        }
    };
    window.renderExecutionDetail = renderExecutionDetail;

    // Toggle selection of all items in a section
    // toggleSectionSelection defined earlier at line ~1586 (removed duplicate with broken selectors)

    // ============================================
    // Webcam Handling for Desktop 'Camera' Button
    // ============================================
    window.activeWebcamStream = null;

    window.handleCameraButton = function (uniqueId) {
        // Check if mobile device (simple check)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // Use the native input for mobile (file picker / camera app)
            const inp = document.getElementById('cam-' + uniqueId);
            if (inp) inp.click();
        } else {
            // Use Webcam Modal for desktop
            window.openWebcamModal(uniqueId);
        }
    };

    window.openWebcamModal = async function (uniqueId) {
        // Cleanup any existing stream first
        if (window.activeWebcamStream) {
            window.activeWebcamStream.getTracks().forEach(track => track.stop());
            window.activeWebcamStream = null;
        }

        window.DataService.openFormModal('Capture from Webcam', `
            < div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;" >
                <div style="position: relative; width: 100%; max-width: 640px; aspect-ratio: 16/9; background: #000; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <video id="webcam-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                    <div id="webcam-loading" style="position: absolute; color: white;">Accessing Camera...</div>
                </div>
                <div id="webcam-error" style="color: var(--danger-color); display: none; text-align: center;"></div>
                <p style="color: var(--text-secondary); font-size: 0.85rem;">Ensure your browser has camera permissions enabled.</p>
            </div >
            `, () => window.captureWebcam(uniqueId));

        // Configure "Capture" button label
        const modalSave = document.getElementById('modal-save');
        if (modalSave) modalSave.innerHTML = '<i class="fa-solid fa-camera"></i> Capture';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            window.activeWebcamStream = stream;

            const video = document.getElementById('webcam-video');
            const loading = document.getElementById('webcam-loading');

            if (video) {
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    if (loading) loading.style.display = 'none';
                };
            }
        } catch (err) {
            const errDiv = document.getElementById('webcam-error');
            const loading = document.getElementById('webcam-loading');
            if (loading) loading.style.display = 'none';

            if (errDiv) {
                errDiv.style.display = 'block';
                errDiv.textContent = 'Could not access webcam: ' + (err.message || err.name);
            }
            console.error("Webcam error:", err);
        }
    };

    window.captureWebcam = async function (uniqueId) {
        const video = document.getElementById('webcam-video');
        if (!video || !window.activeWebcamStream) return;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            // Mirror the capture if the video was mirrored
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);

            const rawDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Downscale/compress webcam captures (previously stored at native resolution uncapped)
            const dataUrl = await window.EvidenceUtils.compress(rawDataUrl, { maxPx: 1600, quality: 0.75 });

            // Stop stream
            window.activeWebcamStream.getTracks().forEach(track => track.stop());
            window.activeWebcamStream = null;

            // Record capture timestamp (and, if opted in, attempt geolocation)
            const capturedAtIso = recordCaptureMeta(uniqueId);
            maybeCaptureLocation(uniqueId);

            // Store in IndexedDB so it has a stable key like the other capture paths
            let finalUrl = dataUrl;
            try {
                const idbKey = 'idb://evidence-' + uniqueId + '-cam-' + Date.now();
                await EvidenceDB.put(idbKey, dataUrl);
                finalUrl = idbKey;
            } catch (idbErr) {
                console.error('[Webcam Capture] IndexedDB store failed:', idbErr);
            }

            // Assign a stable Evidence ID for cross-referencing in the report
            const evId = window.EvidenceUtils.registerEvidence(uniqueId, finalUrl);

            // Update UI
            const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
            const imgElem = document.getElementById('evidence-img-' + uniqueId);
            const dataInput = document.getElementById('evidence-data-' + uniqueId);
            const sizeElem = document.getElementById('evidence-size-' + uniqueId);

            if (imgElem) imgElem.src = dataUrl;
            if (previewDiv) previewDiv.style.display = 'block';
            if (dataInput) { dataInput.value = 'attached'; dataInput.dataset.capturedAt = capturedAtIso; dataInput.dataset.evId = evId; dataInput.dataset.saveUrl = finalUrl; }
            if (sizeElem) sizeElem.textContent = 'Captured from Webcam';
            if (window.ChecklistAutoSave) window.ChecklistAutoSave.schedule();

            // Close modal
            if (window.closeModal) window.closeModal();
        } catch (e) {
            console.error("Capture failed:", e);
            window.showNotification("Failed to capture image", "error");
        }
    };

})();

// Support CommonJS/test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EvidenceViewer: window.EvidenceViewer, handleEvidenceUpload: window.handleEvidenceUpload, viewEvidenceImage: window.viewEvidenceImage, viewEvidenceImageDirect: window.viewEvidenceImageDirect, removeEvidence: window.removeEvidence, removeEvidenceByIdx: window.removeEvidenceByIdx, viewEvidenceImageByUrl: window.viewEvidenceImageByUrl, captureScreenEvidence: window.captureScreenEvidence, handleCameraButton: window.handleCameraButton, captureWebcam: window.captureWebcam, getEvidenceCaptureMeta: window.getEvidenceCaptureMeta, EvidenceUtils: window.EvidenceUtils };
}
