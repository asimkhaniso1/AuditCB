/**
 * USER INVITE SYSTEM - Supabase Edge Function
 * 
 * This Edge Function creates new auth users and profile entries.
 * Deploy this to Supabase Edge Functions.
 * 
 * File: supabase/functions/invite-user/index.ts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
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
            return new Response(
                JSON.stringify({ error: 'Missing required fields: email, full_name, role' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Create auth user with invite
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: full_name,
                    role: role
                },
                redirectTo: `${req.headers.get('origin')}/auth/callback`
            }
        )

        if (authError) {
            console.error('Auth creation error:', authError)
            return new Response(
                JSON.stringify({ error: authError.message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Create profile entry
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert([{
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

            return new Response(
                JSON.stringify({ error: 'Failed to create user profile: ' + profileError.message }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: authData.user.id,
                    email: email,
                    full_name: full_name,
                    role: role,
                    invite_sent: send_invite_email
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
