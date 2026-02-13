-- Check ALL settings rows (not just limit 1)
SELECT id, cb_settings::TEXT as cb_settings_preview, updated_at
FROM settings
ORDER BY updated_at DESC;
