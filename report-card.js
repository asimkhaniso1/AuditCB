/**
 * report-card.js — Public Report Card renderer.
 *
 * When the audit-report QR is scanned, the URL lands here with a
 *   #verify=<base64-json-payload>
 * hash. This module decodes the non-confidential status payload and paints
 * a self-contained card overlay on top of the app, branded for the issuing
 * certification body.
 */

(function () {
    'use strict';

    function readHashPayload() {
        var h = window.location.hash || '';
        var idx = h.indexOf('verify=');
        if (idx < 0) return null;
        var raw = h.slice(idx + 'verify='.length);
        try {
            var json = decodeURIComponent(escape(window.atob(raw)));
            var data = JSON.parse(json);
            if (!data || typeof data !== 'object') return null;
            return data;
        } catch (_e) {
            return null;
        }
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function isSafeUrl(u) {
        return typeof u === 'string' && /^https?:\/\//i.test(u);
    }

    function render(d) {
        var statusColor = /^#[0-9a-f]{3,8}$/i.test(d.statusColor || '') ? d.statusColor : '#2563eb';
        var outcomeColor = /^#[0-9a-f]{3,8}$/i.test(d.outcomeColor || '') ? d.outcomeColor : '#16a34a';
        var brandColor = '#1e3a8a';
        var overlay = document.createElement('div');
        overlay.id = 'report-card-overlay';
        overlay.setAttribute('role', 'main');
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:2147483647',
            'background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%)',
            'overflow:auto', 'padding:24px 16px',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
            'color:#0f172a', '-webkit-font-smoothing:antialiased'
        ].join(';');

        var stat = function (n, label, color) {
            return '<div style="background:white;border-radius:12px;padding:14px 10px;text-align:center;box-shadow:0 1px 2px rgba(15,23,42,0.04);border:1px solid #e2e8f0;">'
                + '<div style="font-size:1.75rem;font-weight:800;line-height:1;color:' + color + ';">' + esc(n) + '</div>'
                + '<div style="font-size:0.7rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">' + esc(label) + '</div>'
                + '</div>';
        };

        var row = function (k, v) {
            if (!v) return '';
            return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:0.9rem;">'
                + '<span style="color:#64748b;font-weight:500;">' + esc(k) + '</span>'
                + '<span style="color:#0f172a;font-weight:600;text-align:right;">' + esc(v) + '</span>'
                + '</div>';
        };

        // CB branding header — logo + name + accreditation badge
        var brandedHeader = ''
            + '<div style="background:linear-gradient(135deg,' + brandColor + ' 0%,#3730a3 100%);border-radius:16px 16px 0 0;padding:22px 20px;color:white;text-align:center;">'
            +   (isSafeUrl(d.logo)
                    ? '<div style="background:white;display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:10px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);"><img src="' + esc(d.logo) + '" alt="' + esc(d.cb || 'CB Logo') + '" style="max-height:48px;max-width:200px;object-fit:contain;display:block;"></div>'
                    : '<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;"><span style="font-size:1.5rem;">&#x2713;</span></div>'
                )
            +   (d.cb ? '<div style="font-size:1.05rem;font-weight:800;letter-spacing:0.3px;">' + esc(d.cb) + '</div>' : '')
            +   (d.accBody || d.accNum
                    ? '<div style="margin-top:8px;display:inline-block;padding:4px 12px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:999px;font-size:0.72rem;font-weight:600;letter-spacing:0.4px;">'
                        + esc([d.accBody, d.accNum].filter(Boolean).join(' · '))
                        + '</div>'
                    : '')
            + '</div>';

        overlay.innerHTML = ''
            + '<div style="max-width:520px;margin:0 auto;">'
            +   '<div style="text-align:center;margin-bottom:14px;">'
            +     '<div style="display:inline-flex;align-items:center;gap:8px;padding:5px 12px;background:white;border-radius:999px;box-shadow:0 1px 3px rgba(15,23,42,0.06);font-size:0.7rem;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:1px;">'
            +       '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';"></span>'
            +       'Audit Status Report'
            +     '</div>'
            +   '</div>'
            +   '<div style="background:white;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.08);overflow:hidden;border:1px solid #e2e8f0;">'
            +     brandedHeader
            +     '<div style="padding:20px;border-bottom:1px solid #f1f5f9;">'
            +       '<div style="font-size:0.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Audited Organization</div>'
            +       '<div style="font-size:1.25rem;font-weight:800;color:#0f172a;margin-top:4px;">' + esc(d.client || '—') + '</div>'
            +       (d.standard ? '<div style="margin-top:6px;font-size:0.82rem;color:#475569;">' + esc(d.standard) + '</div>' : '')
            +     '</div>'
            +     '<div style="padding:18px 20px;background:' + statusColor + '0d;">'
            +       '<div style="font-size:0.7rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overall Status</div>'
            +       '<div style="font-size:1.15rem;font-weight:800;color:' + statusColor + ';margin-top:4px;">' + esc(d.status || '—') + '</div>'
            +     '</div>'
            +     '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:18px 20px;">'
            +       stat(d.major || 0, 'Major NC', '#dc2626')
            +       stat(d.minor || 0, 'Minor NC', '#d97706')
            +       stat(d.obs || 0, 'OBS', '#7c3aed')
            +       stat(d.ofi || 0, 'OFI', '#0891b2')
            +     '</div>'
            +     '<div style="padding:0 20px 18px;">'
            +       row('Audit Type', d.type)
            +       row('Dates', d.dates)
            +       row('Reference', d.ref)
            +     '</div>'
            +     (d.outcome ? '<div style="padding:18px 20px;background:' + outcomeColor + '0d;border-top:1px solid #f1f5f9;">'
            +       '<div style="font-size:0.7rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Certification Outcome</div>'
            +       '<div style="font-size:1.05rem;font-weight:800;color:' + outcomeColor + ';margin-top:4px;">' + esc(d.outcome) + '</div>'
            +     '</div>' : '')
            +     (d.email ? '<div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-size:0.8rem;color:#475569;">'
            +       'For the full report, contact <a href="mailto:' + esc(d.email) + '" style="color:' + brandColor + ';font-weight:600;text-decoration:none;">' + esc(d.email) + '</a>'
            +     '</div>' : '')
            +   '</div>'
            +   '<div style="margin-top:14px;text-align:center;font-size:0.7rem;color:#94a3b8;line-height:1.6;">'
            +     'Non-confidential audit summary &middot; ' + (d.cb ? esc(d.cb) : 'Certification Body') + '<br>'
            +     'This card is intended for verification only. Full report is confidential.'
            +   '</div>'
            + '</div>';

        var paint = function () {
            if (!document.body) { setTimeout(paint, 30); return; }
            document.body.appendChild(overlay);
            try { document.title = 'Audit Status — ' + (d.client || d.ref || 'Report Card'); } catch (_e) {}
        };
        paint();
    }

    var payload = readHashPayload();
    if (payload) {
        window._isReportCardMode = true;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { render(payload); }, { once: true });
        } else {
            render(payload);
        }
    }
})();
