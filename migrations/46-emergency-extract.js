// ============================================
// EMERGENCY DATA EXTRACTION (RUN ON OTHER DEVICES)
// Use this on any computer where the data was last seen!
// ============================================

(function emergencyExtract() {
    console.log('%c🚨 EMERGENCY EXTRACTION STARTED', 'color: red; font-weight: bold; font-size: 16px;');

    // 1. Grab everything in localStorage
    const allData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        allData[key] = localStorage.getItem(key);
    }

    // 2. Check for the main state
    const stateStr = localStorage.getItem('auditCB360State');
    if (stateStr) {
        try {
            const state = JSON.parse(stateStr);
            console.log('✅ Found State! Clients:', state.clients?.length || 0);
            if (state.clients?.length > 0) {
                console.table(state.clients.map(c => ({ Name: c.name })));
            }
        } catch (e) {
            console.warn('⚠️ Found state but could not parse it automatically.');
        }
    } else {
        console.warn('❌ No "auditCB360State" found on this device.');
    }

    // 3. Create a Downloadable Backup File
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AuditCB_Emergency_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();

    console.log('%c📥 DOWNLOAD STARTED!', 'color: green; font-weight: bold;');
    console.log('Check your Downloads folder for the backup file.');
    console.log('--------------------------------------------');
    console.log('💡 If this file is empty (0KB), then this device does not have your data either.');
})();
