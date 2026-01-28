/**
 * DIAGNOSTIC SCRIPT: VISIBILITY CHECK
 * This mimics the application attempting to fetch data.
 */

const { createClient } = require('@supabase/supabase-js');

// 1. CONFIGURATION
const SUPABASE_URL = 'https://pvjseczwxksnhyqjcesh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2anNlY3p3eGtzbmh5cWpjZXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1NTQ5MzgsImV4cCI6MjA1NDEzMDkzOH0.1_i_UjJjXQG-N6tR_P3d-VpQ_Q_bTq2_s_d_e_f_g_h';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkVisibility() {
    console.log('🔍 STARTING VISIBILITY DIAGNOSTIC...');

    // 1. Check Clients Count (As Anon/Public first, since we disabled RLS)
    const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name, status, created_at');

    if (clientError) {
        console.error('❌ ERROR Fetching Clients:', clientError.message);
    } else {
        console.log(`📊 Clients Found: ${clients.length}`);
        if (clients.length > 0) {
            console.log('✅ DATA IS VISIBLE! Here they are:');
            clients.forEach(c => console.log(`   - ${c.name} (${c.status})`));
        } else {
            console.log('⚠️ ZERO CLIENTS RETURNED via API.');
        }
    }

    // 2. Check "Info" User Role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'info@companycertification.com')
        .single();

    if (profileError) {
        console.log('⚠️ Could not fetch profile for info@companycertification.com (might need RLS)');
    } else {
        console.log('👤 User Profile Check:');
        console.log(`   - Email: ${profile.email}`);
        console.log(`   - Role: ${profile.role} ${profile.role === 'Admin' ? '✅ (Correct)' : '❌ (Needs Fix)'}`);
    }

    // 3. Check Settings (Admin Flag)
    const { data: settings } = await supabase.from('settings').select('*').single();
    if (settings) {
        console.log(`⚙️ Global Settings: Admin Only Mode = ${settings.is_admin ? 'ON' : 'OFF'}`);
    }
}

checkVisibility();
