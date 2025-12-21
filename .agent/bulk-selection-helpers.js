// Toggle selection of all items in a section
window.toggleSectionSelection = function (sectionId) {
    const checkbox = document.querySelector(`.section-checkbox[data-section-id="${sectionId}"]`);
    const sectionContent = document.getElementById(sectionId);

    if (!sectionContent) return;

    const items = sectionContent.querySelectorAll('.checklist-item');
    items.forEach(item => {
        if (checkbox.checked) {
            item.classList.add('selected-item');
            item.style.background = '#eff6ff';
            item.style.borderLeft = '4px solid var(--primary-color)';
        } else {
            item.classList.remove('selected-item');
            item.style.background = '';
            item.style.borderLeft = '';
        }
    });
};

// Enhanced bulk update - works with selected items OR filtered items
window.bulkUpdateStatusEnhanced = function (reportId, status) {
    // Check if any items are selected via checkboxes
    let targetItems = document.querySelectorAll('.checklist-item.selected-item');
    let useSelection = targetItems.length > 0;

    // If no items selected, fall back to filtered items
    if (!useSelection) {
        targetItems = document.querySelectorAll('.checklist-item:not(.filtered-out)');
    }

    if (targetItems.length === 0) {
        window.showNotification('No items to update', 'warning');
        return;
    }

    const confirmMsg = useSelection
        ? `Mark ${targetItems.length} selected item(s) as "${status.toUpperCase()}"?`
        : `Mark ${targetItems.length} filtered item(s) as "${status.toUpperCase()}"?`;

    if (!confirm(confirmMsg)) return;

    let updatedCount = 0;
    targetItems.forEach(item => {
        const uniqueId = item.id.replace('row-', '');
        window.setChecklistStatus(uniqueId, status);
        updatedCount++;
    });

    // Clear selections if items were selected
    if (useSelection) {
        document.querySelectorAll('.section-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.checklist-item.selected-item').forEach(item => {
            item.classList.remove('selected-item');
            item.style.background = '';
            item.style.borderLeft = '';
        });
    }

    window.showNotification(`Updated ${updatedCount} item(s) to ${status.toUpperCase()}`, 'success');
    window.saveChecklist(reportId);
};
