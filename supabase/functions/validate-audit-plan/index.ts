// Supabase Edge Function: Validate Audit Plan Data
// Deploy: supabase functions deploy validate-audit-plan

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { client, date, type, standard, manDays, onsiteDays } = await req.json()

        const errors = []

        // Validate client
        if (!client || client.trim().length < 2) {
            errors.push({ field: 'client', message: 'Client name is required' })
        }

        // Validate date
        if (!date) {
            errors.push({ field: 'date', message: 'Audit date is required' })
        } else {
            const auditDate = new Date(date)
            const today = new Date()
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(today.getFullYear() - 1)
            const twoYearsAhead = new Date()
            twoYearsAhead.setFullYear(today.getFullYear() + 2)

            if (auditDate < oneYearAgo) {
                errors.push({ field: 'date', message: 'Audit date cannot be more than 1 year in the past' })
            }
            if (auditDate > twoYearsAhead) {
                errors.push({ field: 'date', message: 'Audit date cannot be more than 2 years in the future' })
            }
        }

        // Validate type
        const validTypes = ['Initial', 'Surveillance', 'Recertification', 'Special', 'Transfer']
        if (!type || !validTypes.includes(type)) {
            errors.push({ field: 'type', message: `Audit type must be one of: ${validTypes.join(', ')}` })
        }

        // Validate standard
        if (!standard || standard.trim().length < 3) {
            errors.push({ field: 'standard', message: 'Standard is required (e.g., ISO 9001:2015)' })
        }

        // Validate man-days
        if (manDays !== undefined && manDays !== null) {
            if (manDays < 0.5) {
                errors.push({ field: 'manDays', message: 'Man-days must be at least 0.5' })
            }
            if (manDays > 100) {
                errors.push({ field: 'manDays', message: 'Man-days cannot exceed 100' })
            }
        }

        // Validate onsite days vs man-days
        if (onsiteDays && manDays && onsiteDays > manDays) {
            errors.push({ field: 'onsiteDays', message: 'On-site days cannot exceed total man-days' })
        }

        if (errors.length > 0) {
            return new Response(
                JSON.stringify({ valid: false, errors }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ valid: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ valid: false, errors: [{ field: 'general', message: error.message }] }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
