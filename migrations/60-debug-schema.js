
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load config
const CONFIG_PATH = path.join(__dirname, '..', 'supabase-config.js');
let configContent = fs.readFileSync(CONFIG_PATH, 'utf8');

const extractProperty = (name) => {
    const match = configContent.match(new RegExp(`${name}:\\s*['"](.*?)['"]`));
    return match ? match[1] : null;
};

const SUPABASE_URL = extractProperty('_defaultUrl');
const SUPABASE_KEY = extractProperty('_defaultAnonKey'); // Use anon key for inspection if service key is missing

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    console.log('🔍 Checking CLIENTS table schema...');

    // 1. Try to fetch a single row to see columns
    const { data, error } = await supabase.from('clients').select('*').limit(1);

    if (error) {
        console.error('❌ Error fetching clients:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Found columns:', Object.keys(data[0]).sort().join(', '));
    } else {
        console.log('⚠️  Table is empty, cannot infer columns from data.');
        // Try inserting a dummy row with MINIMAL fields to see what passes
        const testId = 'schema-test-' + Date.now();
        const { error: insertError } = await supabase.from('clients').insert({
            id: testId,
            name: 'Schema Test',
            status: 'Active'
        });

        if (insertError) {
            console.error('❌ Minimal insert failed:', insertError.message);
        } else {
            console.log('✅ Minimal insert succeeded. ID:', testId);
            // Cleanup
            await supabase.from('clients').delete().eq('id', testId);
        }
    }

    // 2. Validate strict mapping for `upsertClient`
    // The following fields are being sent by the frontend:
    // id, name, standard, status, type, website, employees, shifts, industry, 
    // contacts, sites, departments, designations, goods_services, key_processes,
    // contact_person, next_audit, last_audit, updated_at

    console.log('\n❓ Cannot check missing columns directly without PostgREST metadata endpoint.');
    console.log('👉 If you see "Column not found" in the browser, comparison is needed.');
}

checkSchema();
