// ============================================
// CLIENTS MODALS MODULE (Split from clients-module.js)
// ============================================
// Foundation for modal functions - enables future refactoring
// Currently exports references to the original functions
// Loaded AFTER clients-module.js

// Modal helper utilities
const ClientModals = {
    // Create modal container with consistent styling
    createModal: function (title, content, footer = '') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'client-modal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" data-action="ClientModals_closeModal">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    },

    // Close modal and remove from DOM
    closeModal: function () {
        const modal = document.getElementById('client-modal');
        if (modal) {
            modal.remove();
        }
    },

    // Show notification using window.showNotification
    notify: function (message, type = 'success') {
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }
};

// Export to window
window.ClientModals = ClientModals;

// Re-export existing modal functions (from clients-module.js)
// These can be migrated here incrementally in future
// window.openAddClientModal - defined in clients-module.js
// window.openEditClientModal - defined in clients-module.js
// window.addContactPerson - defined in clients-module.js
// window.addSite - defined in clients-module.js

Logger.info('Clients Modals module loaded (utilities ready for future migration)');
