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
                    const compressedDataUrl = compressImage(img, file.type);
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
                        thumb.style.cssText = 'position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;';
                        thumb.innerHTML = `
                            <img src="${displayUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" data-action="viewEvidenceImageByUrl" data-id="${safeDisplay}"/>
                            <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${newIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">\u00d7</button>
                        `;
                        previewDiv.appendChild(thumb);
                    }

                    // 4. Update Hidden Inputs
                    const evidenceData = document.getElementById('evidence-data-' + uniqueId);
                    if (evidenceData) evidenceData.value = 'attached';

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

    // Compress image to reduce storage size
    function compressImage(img, _fileType) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions (max 600px on longest side — keeps ~20-40KB per image)
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with 0.5 quality — good enough for evidence, saves storage
        return canvas.toDataURL('image/jpeg', 0.5);
    }

    // View evidence image in full size (modal/popup)
    // View evidence image in full size (modal/popup)
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


        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'evidence-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(5px);';
        overlay.onclick = function () { overlay.remove(); };

        // Create image container
        overlay.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${imgEl.src}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); object-fit: contain;">
            <button data-action="removeGrandparent" data-stop-prop="true" style="position: absolute; top: -15px; right: -15px; width: 36px; height: 36px; border-radius: 50%; background: white; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; color: #333;" aria-label="Close">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
    `;

        document.body.appendChild(overlay);
    };

    // View evidence image directly from cached data (used in Review tab)
    window.viewEvidenceImageDirect = function (findingId) {
        const cached = window._evidenceCache && window._evidenceCache[findingId];
        if (!cached) {
            window.showNotification('Evidence image not found. Please view from the Checklist tab.', 'warning');
            return;
        }
        // Handle both old (string) and new (array) formats
        const srcs = Array.isArray(cached) ? cached : [cached];
        const overlay = document.createElement('div');
        overlay.id = 'evidence-modal-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(5px);';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 80vh;" data-action="stopProp">
                <img id="ev-gallery-main" src="${srcs[0]}" style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); object-fit: contain;">
                <button data-action="removeGrandparent" data-stop-prop="true" style="position: absolute; top: -15px; right: -15px; width: 36px; height: 36px; border-radius: 50%; background: white; border: none; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; color: #333;" aria-label="Close">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            ${srcs.length > 1 ? `<div style="display: flex; gap: 8px; margin-top: 12px;" data-action="stopProp">
                ${srcs.map((s, i) => `<img src="${s}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid ${i === 0 ? 'white' : 'transparent'}; opacity: ${i === 0 ? '1' : '0.6'};" data-action="setGalleryMainSrc"\\'")}'; this.parentElement.querySelectorAll('img').forEach(t=>{t.style.border='2px solid transparent';t.style.opacity='0.6';}); this.style.border='2px solid white'; this.style.opacity='1';">`).join('')}
            </div>` : ''}
            <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 8px;">${srcs.length} photo${srcs.length > 1 ? 's' : ''} \u2022 Click outside to close</p>
        `;
        document.body.appendChild(overlay);
    };

    // Remove evidence image
    window.removeEvidence = function (uniqueId) {
        const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
        const evidenceData = document.getElementById('evidence-data-' + uniqueId);
        const fileInput = document.getElementById('img-' + uniqueId);

        if (previewDiv) { previewDiv.style.display = 'none'; previewDiv.innerHTML = ''; }
        if (evidenceData) evidenceData.value = '';
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
            if (evidenceData) evidenceData.value = '';
        }
    };

    // View any evidence image by URL in a lightbox overlay
    window.viewEvidenceImageByUrl = function (url) {
        if (!url) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; cursor: pointer;';
        overlay.onclick = () => overlay.remove();
        overlay.innerHTML = `
            <img src="${url}" style="max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <button style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">\u00d7</button>
        `;
        document.body.appendChild(overlay);
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

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

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
                thumb.style.cssText = 'position: relative; width: 56px; height: 56px; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;';
                thumb.innerHTML = `
                    <img src="${displayUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" data-action="viewEvidenceImageByUrl" data-id="${safeDisplay}"/>
                    <button type="button" data-action="removeEvidenceByIdx" data-arg1="${uniqueId}" data-arg2="${newIdx}" style="position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">\u00d7</button>
                `;
                previewDiv.appendChild(thumb);
            }

            // Update hidden input
            const evidenceData = document.getElementById('evidence-data-' + uniqueId);
            if (evidenceData) evidenceData.value = 'attached';

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

    window.captureWebcam = function (uniqueId) {
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

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // Stop stream
            window.activeWebcamStream.getTracks().forEach(track => track.stop());
            window.activeWebcamStream = null;

            // Update UI
            const previewDiv = document.getElementById('evidence-preview-' + uniqueId);
            const imgElem = document.getElementById('evidence-img-' + uniqueId);
            const dataInput = document.getElementById('evidence-data-' + uniqueId);
            const sizeElem = document.getElementById('evidence-size-' + uniqueId);

            if (imgElem) imgElem.src = dataUrl;
            if (previewDiv) previewDiv.style.display = 'block';
            if (dataInput) dataInput.value = 'attached';
            if (sizeElem) sizeElem.textContent = 'Captured from Webcam';

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
    module.exports = { handleEvidenceUpload: window.handleEvidenceUpload, viewEvidenceImage: window.viewEvidenceImage, viewEvidenceImageDirect: window.viewEvidenceImageDirect, removeEvidence: window.removeEvidence, removeEvidenceByIdx: window.removeEvidenceByIdx, viewEvidenceImageByUrl: window.viewEvidenceImageByUrl, captureScreenEvidence: window.captureScreenEvidence, handleCameraButton: window.handleCameraButton, captureWebcam: window.captureWebcam };
}
