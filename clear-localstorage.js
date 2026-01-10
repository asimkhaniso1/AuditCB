// QUICK FIX: Clear localStorage to remove demo data
// Run this in browser console (F12)

// Method 1: Clear just the app state
localStorage.removeItem('auditCB360State');
console.log('✅ Cleared app state from localStorage');

// Method 2: Clear ALL localStorage (more thorough)
localStorage.clear();
console.log('✅ Cleared ALL localStorage');

// Then refresh the page
location.reload();
