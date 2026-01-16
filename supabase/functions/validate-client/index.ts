// Supabase Edge Function: Validate Client Data
// Deploy: supabase functions deploy validate-client

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { name, email, phone, industry, website } = await req.json()

        const errors = []

        // Validate name
        if (!name || name.trim().length < 2) {
            errors.push({ field: 'name', message: 'Name must be at least 2 characters long' })
        }
        if (name && name.length > 200) {
            errors.push({ field: 'name', message: 'Name cannot exceed 200 characters' })
        }

        // Validate email
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
        if (!email || !emailRegex.test(email)) {
            errors.push({ field: 'email', message: 'Valid email address is required' })
        }

        // Validate phone (optional but must be valid if provided)
        if (phone) {
            const phoneRegex = /^\+?[0-9\s\-\(\)]{7,20}$/
            if (!phoneRegex.test(phone)) {
                errors.push({ field: 'phone', message: 'Phone number format is invalid' })
            }
        }

        // Validate website (optional but must be valid URL if provided)
        if (website) {
            try {
                new URL(website)
            } catch {
                errors.push({ field: 'website', message: 'Website must be a valid URL' })
            }
        }

        // Check for duplicate client name
        if (name) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                {
                    global: {
                        headers: { Authorization: req.headers.get('Authorization')! },
                    },
                }
            )

            const { data: existing } = await supabase
                .from('clients')
                .select('id, name')
                .ilike('name', name.trim())
                .limit(1)

            if (existing && existing.length > 0) {
                errors.push({ field: 'name', message: `Client "${name}" already exists` })
            }
        }

        if (errors.length > 0) {
            return new Response(
                JSON.stringify({
                    valid: false,
                    errors
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        return new Response(
            JSON.stringify({ valid: true }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({
                valid: false,
                errors: [{ field: 'general', message: error.message }]
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
