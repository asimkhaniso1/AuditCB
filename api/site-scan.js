/**
 * api/site-scan.js — Fetch a client's public website and return readable text.
 *
 * The browser cannot read a third-party site directly (CORS, and the app's CSP
 * pins connect-src to 'self' plus known hosts), so the fetch happens here. The
 * caller passes a URL, this returns the homepage plus a few product/service/about
 * pages as plain text, which the AI suggestion flow feeds to Gemini.
 *
 * Because this endpoint fetches a caller-supplied URL, it is an SSRF surface:
 * the scheme is restricted to http/https, the hostname is resolved and rejected
 * if it lands on a private, loopback or link-local address, and redirects are
 * followed manually so each hop is re-checked.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

const PAGE_TIMEOUT_MS = 8000;
const MAX_PAGES = 5;
const MAX_HTML_BYTES = 600 * 1024;
const MAX_TEXT_CHARS = 14000;

const INTERESTING_PATH = /(about|company|profile|product|service|solution|capabilit|industr|manufactur|quality|certification|what-we-do|our-work|expertise)/i;

function isPrivateAddress(ip) {
    if (net.isIPv4(ip)) {
        const p = ip.split('.').map(Number);
        if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
        if (p[0] === 169 && p[1] === 254) return true;
        if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
        if (p[0] === 192 && p[1] === 168) return true;
        if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
        if (p[0] >= 224) return true;
        return false;
    }
    const low = String(ip).toLowerCase().replace(/^\[|\]$/g, '');
    if (low === '::1' || low === '::' || low === '0:0:0:0:0:0:0:1') return true;
    if (/^f[cd]/.test(low)) return true;          // unique local
    if (low.startsWith('fe80')) return true;      // link local
    if (low.startsWith('::ffff:')) return isPrivateAddress(low.slice(7));
    return false;
}

async function assertPublicUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('That does not look like a valid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http and https URLs can be scanned');
    }
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
        throw new Error('That host cannot be scanned');
    }
    if (net.isIP(host)) {
        if (isPrivateAddress(host)) throw new Error('That host cannot be scanned');
        return url;
    }
    let resolved;
    try {
        resolved = await dns.lookup(host, { all: true });
    } catch {
        throw new Error(`Could not resolve ${host}`);
    }
    if (!resolved.length || resolved.some(r => isPrivateAddress(r.address))) {
        throw new Error('That host cannot be scanned');
    }
    return url;
}

/** Fetch one page, following redirects by hand so every hop is re-validated. */
async function fetchPage(rawUrl, hops = 0) {
    if (hops > 3) throw new Error('Too many redirects');
    const url = await assertPublicUrl(rawUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(url.href, {
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Audit360-SiteScan/1.0 (+certification body pre-audit research)',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });
    } finally {
        clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`HTTP ${response.status} with no redirect target`);
        return fetchPage(new URL(location, url.href).href, hops + 1);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
        throw new Error('Not an HTML page');
    }

    const buffer = await response.arrayBuffer();
    const html = Buffer.from(buffer.slice(0, MAX_HTML_BYTES)).toString('utf8');
    return { finalUrl: response.url || url.href, html };
}

function decodeEntities(str) {
    return str
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(+d));
}

function htmlToText(html) {
    return decodeEntities(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/[ \t ]+/g, ' ')
        .replace(/\n\s*\n\s*/g, '\n')
        .trim();
}

function extractTitle(html) {
    const m = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
    return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

function extractDescription(html) {
    const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,400})["']/i)
        || html.match(/<meta[^>]+content=["']([^"']{0,400})["'][^>]+name=["']description["']/i);
    return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

/** Same-origin links whose path hints at products, services or company info. */
function findInterestingLinks(html, baseUrl) {
    const base = new URL(baseUrl);
    const seen = new Set();
    const out = [];
    const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < 12) {
        let candidate;
        try {
            candidate = new URL(m[1], base.href);
        } catch {
            continue;
        }
        if (candidate.hostname !== base.hostname) continue;
        if (!/^https?:$/.test(candidate.protocol)) continue;
        if (/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|mp4|webm)$/i.test(candidate.pathname)) continue;
        const path = candidate.pathname.replace(/\/+$/, '');
        if (!path || !INTERESTING_PATH.test(path)) continue;
        candidate.hash = '';
        candidate.search = '';
        if (seen.has(candidate.href)) continue;
        seen.add(candidate.href);
        out.push(candidate.href);
    }
    return out;
}

export default async function handler(req, res) {
    const allowedOrigins = [
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.CORS_ORIGIN || null,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000'
    ].filter(Boolean);
    const origin = req.headers.origin || '';
    const isAllowed = allowedOrigins.some(o => origin === o) || origin.endsWith('.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0] || '');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { url, maxPages } = req.body || {};
    if (!url) return res.status(400).json({ error: 'A url is required' });

    try {
        const first = await fetchPage(url);
        const pages = [{
            url: first.finalUrl,
            title: extractTitle(first.html),
            text: htmlToText(first.html)
        }];
        const description = extractDescription(first.html);

        const limit = Math.min(Number(maxPages) || MAX_PAGES, MAX_PAGES);
        const links = findInterestingLinks(first.html, first.finalUrl).slice(0, limit - 1);

        const extra = await Promise.allSettled(links.map(link => fetchPage(link)));
        extra.forEach((result, i) => {
            if (result.status !== 'fulfilled') return;
            pages.push({
                url: links[i],
                title: extractTitle(result.value.html),
                text: htmlToText(result.value.html)
            });
        });

        // Budget the combined text across pages so one long page cannot crowd out the rest.
        const perPage = Math.floor(MAX_TEXT_CHARS / pages.length);
        const text = pages
            .map(p => `--- ${p.title || p.url} (${p.url}) ---\n${p.text.slice(0, perPage)}`)
            .join('\n\n')
            .slice(0, MAX_TEXT_CHARS);

        return res.status(200).json({
            site: { url: first.finalUrl, title: pages[0].title, description },
            pages: pages.map(p => ({ url: p.url, title: p.title, chars: p.text.length })),
            text
        });
    } catch (error) {
        console.error('Site scan error:', error.message);
        const message = error.name === 'AbortError' ? 'The site took too long to respond' : error.message;
        return res.status(400).json({ error: message || 'Could not read that website' });
    }
}
