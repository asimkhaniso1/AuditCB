/**
 * api/_auth.js — shared request guards for the Vercel API functions.
 *
 * Vercel does not turn underscore-prefixed files into endpoints, so this is a
 * plain module imported by gemini.js and site-scan.js.
 *
 * requireUser() verifies the caller's Supabase access token the same way
 * supabase.auth.getUser(jwt) does — GET /auth/v1/user with the token — so the
 * signature, expiry and revocation are checked by Supabase Auth itself rather
 * than trusted from the token body. Done with fetch instead of supabase-js so
 * the functions carry no extra dependency.
 */

const AUTH_TIMEOUT_MS = 5000;

const PRODUCTION_ORIGINS = [
    'https://audit360.isoxpert.com',
    'https://audit-cb.vercel.app'
];

/**
 * CORS: echo the origin back only when it is ours. No wildcard *.vercel.app —
 * any Vercel customer can host a page on that suffix.
 */
export function applyCors(req, res) {
    const allowedOrigins = [
        ...PRODUCTION_ORIGINS,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.CORS_ORIGIN || null,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080'
    ].filter(Boolean);
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function bearerToken(req) {
    const header = req.headers.authorization || req.headers.Authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
    return match ? match[1].trim() : null;
}

/**
 * Resolve the signed-in Supabase user for this request, or send 401/500 and
 * return null. Callers must stop when this returns null.
 */
export async function requireUser(req, res) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
        console.error('SUPABASE_URL / SUPABASE_ANON_KEY are not set — cannot verify callers');
        res.status(500).json({ error: 'Server configuration error' });
        return null;
    }

    const token = bearerToken(req);
    if (!token) {
        res.status(401).json({ error: 'Sign in required' });
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
    try {
        const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
            method: 'GET',
            headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
            signal: controller.signal
        });
        if (!response.ok) {
            res.status(401).json({ error: 'Sign in required' });
            return null;
        }
        const user = await response.json();
        if (!user || !user.id) {
            res.status(401).json({ error: 'Sign in required' });
            return null;
        }
        return user;
    } catch (error) {
        console.error('Auth verification failed:', error && error.message);
        res.status(503).json({ error: 'Could not verify your session — try again' });
        return null;
    } finally {
        clearTimeout(timer);
    }
}
