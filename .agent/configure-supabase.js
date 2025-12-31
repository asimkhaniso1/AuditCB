// ============================================
// SUPABASE QUICK CONFIGURATION
// ============================================
// Run this in browser console to configure Supabase

// Replace these with your actual Supabase credentials:
const SUPABASE_URL = 'https://dfzisgfpstrsyncfsxyb.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE'; // Get from Supabase Dashboard → Settings → API

// Save to localStorage
localStorage.setItem('supabase_url', SUPABASE_URL);
localStorage.setItem('supabase_anon_key', SUPABASE_ANON_KEY);

console.log('✅ Supabase credentials saved!');
console.log('Refresh the page to activate Supabase.');

// Or use the built-in UI:
// SupabaseConfig.showConfigUI()
