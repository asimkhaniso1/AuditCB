// ============================================
// SYSTEM DEFAULTS - MISSING FUNCTION FIX
// ============================================

function getDefaultsHTML() {
    const s = window.state.cbSettings || {};
    return `
        <div class="fade-in">
            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fa-solid fa-sliders"></i> System Defaults
            </h3>
            <div style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <form id="defaults-form" style="max-width: 600px;">
                    <div class="form-group">
                        <label>Date Format</label>
                        <select id="cb-date-format" class="form-control">
                            <option value="YYYY-MM-DD" ${s.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD (2024-01-15)</option>
                            <option value="DD/MM/YYYY" ${s.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY (15/01/2024)</option>
                            <option value="MM/DD/YYYY" ${s.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY (01/15/2024)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Currency</label>
                        <select id="cb-currency" class="form-control">
                            <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD - US Dollar ($)</option>
                            <option value="EUR" ${s.currency === 'EUR' ? 'selected' : ''}>EUR - Euro (€)</option>
                            <option value="GBP" ${s.currency === 'GBP' ? 'selected' : ''}>GBP - British Pound (£)</option>
                            <option value="INR" ${s.currency === 'INR' ? 'selected' : ''}>INR - Indian Rupee (₹)</option>
                            <option value="PKR" ${s.currency === 'PKR' ? 'selected' : ''}>PKR - Pakistani Rupee (₨)</option>
                            <option value="AUD" ${s.currency === 'AUD' ? 'selected' : ''}>AUD - Australian Dollar (A$)</option>
                            <option value="CAD" ${s.currency === 'CAD' ? 'selected' : ''}>CAD - Canadian Dollar (C$)</option>
                            <option value="CNY" ${s.currency === 'CNY' ? 'selected' : ''}>CNY - Chinese Yuan (¥)</option>
                            <option value="JPY" ${s.currency === 'JPY' ? 'selected' : ''}>JPY - Japanese Yen (¥)</option>
                            <option value="CHF" ${s.currency === 'CHF' ? 'selected' : ''}>CHF - Swiss Franc (Fr)</option>
                            <option value="SGD" ${s.currency === 'SGD' ? 'selected' : ''}>SGD - Singapore Dollar (S$)</option>
                            <option value="AED" ${s.currency === 'AED' ? 'selected' : ''}>AED - UAE Dirham (د.إ)</option>
                            <option value="SAR" ${s.currency === 'SAR' ? 'selected' : ''}>SAR - Saudi Riyal (﷼)</option>
                            <option value="ZAR" ${s.currency === 'ZAR' ? 'selected' : ''}>ZAR - South African Rand (R)</option>
                            <option value="BRL" ${s.currency === 'BRL' ? 'selected' : ''}>BRL - Brazilian Real (R$)</option>
                            <option value="MXN" ${s.currency === 'MXN' ? 'selected' : ''}>MXN - Mexican Peso ($)</option>
                            <option value="NZD" ${s.currency === 'NZD' ? 'selected' : ''}>NZD - New Zealand Dollar (NZ$)</option>
                            <option value="KRW" ${s.currency === 'KRW' ? 'selected' : ''}>KRW - South Korean Won (₩)</option>
                            <option value="SEK" ${s.currency === 'SEK' ? 'selected' : ''}>SEK - Swedish Krona (kr)</option>
                            <option value="NOK" ${s.currency === 'NOK' ? 'selected' : ''}>NOK - Norwegian Krone (kr)</option>
                            <option value="DKK" ${s.currency === 'DKK' ? 'selected' : ''}>DKK - Danish Krone (kr)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Certificate Number Format</label>
                        <input type="text" id="cb-cert-format" class="form-control" 
                               value="${s.certificateNumberFormat || 'CB-{YEAR}-{SEQ}'}" 
                               placeholder="CB-{YEAR}-{SEQ}">
                        <small class="form-text">Use {YEAR} for year, {SEQ} for sequence number</small>
                    </div>

                    <div class="form-group">
                        <label>Default Stage 1 Duration (days)</label>
                        <input type="number" id="cb-stage1-duration" class="form-control" 
                               value="${s.defaultStage1Duration || 1}" min="1">
                    </div>

                    <div class="form-group">
                        <label>Default Stage 2 Duration (days)</label>
                        <input type="number" id="cb-stage2-duration" class="form-control" 
                               value="${s.defaultStage2Duration || 2}" min="1">
                    </div>

                    <div class="form-group">
                        <label>Man-Day Calculation Mode</label>
                        <select id="cb-manday-mode" class="form-control">
                            <option value="ISO 17021" ${s.manDayCalculationMode === 'ISO 17021' ? 'selected' : ''}>ISO 17021</option>
                            <option value="Custom" ${s.manDayCalculationMode === 'Custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Notification Lead Time (days)</label>
                        <input type="number" id="cb-notification-leadtime" class="form-control" 
                               value="${s.notificationLeadTime || 14}" min="1">
                    </div>

                    <div class="form-group">
                        <label>Session Timeout (minutes)</label>
                        <input type="number" id="cb-session-timeout" class="form-control" 
                               value="${s.sessionTimeout || 30}" min="5">
                    </div>

                    <button type="button" class="btn btn-primary" data-action="saveDefaultSettings">
                        <i class="fa-solid fa-save"></i> Save Settings
                    </button>
                </form>
            </div>
        </div>
    `;
}

async function saveDefaultSettings() {
    try {
        // Get values from form
        window.state.cbSettings.dateFormat = document.getElementById('cb-date-format').value;
        window.state.cbSettings.currency = document.getElementById('cb-currency').value;
        window.state.cbSettings.certificateNumberFormat = document.getElementById('cb-cert-format').value;
        window.state.cbSettings.defaultStage1Duration = parseInt(document.getElementById('cb-stage1-duration').value, 10);
        window.state.cbSettings.defaultStage2Duration = parseInt(document.getElementById('cb-stage2-duration').value, 10);
        window.state.cbSettings.manDayCalculationMode = document.getElementById('cb-manday-mode').value;
        window.state.cbSettings.notificationLeadTime = parseInt(document.getElementById('cb-notification-leadtime').value, 10);
        window.state.cbSettings.sessionTimeout = parseInt(document.getElementById('cb-session-timeout').value, 10);

        // Save to localStorage
        window.saveData();

        // Sync to Supabase
        if (window.SupabaseClient && window.SupabaseClient.isInitialized) {
            await window.SupabaseClient.syncSettingsToSupabase(window.state.settings);
        }

        window.showNotification('System defaults saved successfully', 'success');
    } catch (error) {
        console.error('Failed to save defaults:', error);
        window.showNotification('Failed to save settings', 'error');
    }
}

window.saveDefaultSettings = saveDefaultSettings;
