/**
 * USER INVITE SYSTEM - Supabase Edge Function
 *
 * This Edge Function creates new auth users and profile entries.
 * Deploy this to Supabase Edge Functions.
 *
 * Only a signed-in Admin (public.is_admin(), which reads profiles.role) may
 * call it. The JWT is verified here rather than relying on the platform's
 * verify_jwt setting, because the deploy scripts use --no-verify-jwt.
 *
 * File: supabase/functions/invite-user/index.ts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_ORIGINS = [
    'https://audit360.isoxpert.com',
    'https://audit-cb.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
]

// Extra origins can be added with: supabase secrets set ALLOWED_ORIGINS=https://a,https://b
const ALLOWED_ORIGINS = new Set([
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
])

const ALLOWED_ROLES = new Set(['Admin', 'Certification Manager', 'Lead Auditor', 'Auditor', 'Technical Expert'])

function corsHeadersFor(req: Request): Record<string, string> {
    const origin = req.headers.get('origin') ?? ''
    const headers: Record<string, string> = {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin'
    }
    if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
    return headers
}

function json(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
    })
}

/** True only when the bearer token belongs to a user whose profile role is Admin. */
async function callerIsAdmin(req: Request): Promise<boolean> {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!/^Bearer\s+\S+/i.test(authHeader)) return false

    const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false }
        }
    )

    const { data: userData, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !userData?.user) return false

    const { data: isAdmin, error: rpcError } = await supabaseUser.rpc('is_admin')
    if (rpcError) {
        console.error('is_admin() check failed:', rpcError.message)
        return false
    }
    return isAdmin === true
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeadersFor(req) })
    }

    if (req.method !== 'POST') {
        return json(req, { error: 'Method Not Allowed' }, 405)
    }

    try {
        if (!(await callerIsAdmin(req))) {
            return json(req, { error: 'Only an administrator can invite users' }, 403)
        }

        // Create Supabase client with service role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Get request body
        const { email, full_name, role, send_invite_email = true } = await req.json()

        if (!email || !full_name || !role) {
            return json(req, { error: 'Missing required fields: email, full_name, role' }, 400)
        }

        if (!ALLOWED_ROLES.has(role)) {
            return json(req, { error: 'Unknown role' }, 400)
        }

        // Only redirect back to one of our own origins.
        const origin = req.headers.get('origin') ?? ''
        const redirectBase = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGINS[0]

        // Create auth user with invite. The role here is display-only
        // user_metadata; authorization reads profiles.role (set below).
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: full_name,
                    role: role
                },
                redirectTo: `${redirectBase}/auth/callback`
            }
        )

        if (authError) {
            console.error('Auth creation error:', authError)
            return json(req, { error: 'Could not create the invitation' }, 400)
        }

        // Create profile entry (upsert: a signup trigger may already have
        // created a default row for this user id)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert([{
                id: authData.user.id,
                email: email,
                full_name: full_name,
                role: role,
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(full_name)}&background=random`
            }])
            .select()
            .single()

        if (profileError) {
            console.error('Profile creation error:', profileError)
            // Try to clean up auth user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

            return json(req, { error: 'Failed to create user profile' }, 500)
        }

        return json(req, {
            success: true,
            user: {
                id: authData.user.id,
                email: email,
                full_name: full_name,
                role: role,
                invite_sent: send_invite_email
            }
        })

    } catch (error) {
        console.error('Unexpected error:', error)
        return json(req, { error: 'Internal Server Error' }, 500)
    }
})
