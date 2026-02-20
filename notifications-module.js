// ============================================
// NOTIFICATION SYSTEM MODULE
// ============================================
// In-app notification center for important events

const NotificationManager = {
    notifications: [],
    maxNotifications: 50,

    /**
     * Initialize notification system
     */
    init: function () {
        // Load notifications from localStorage
        const saved = localStorage.getItem('auditcb_notifications');
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);
            } catch (e) {
                this.notifications = [];
            }
        }

        // Update badge on init
        this.updateBadge();

        // Generate system notifications based on current state
        this.generateSystemNotifications();

        Logger.info('NotificationManager initialized');
    },

    /**
     * Add a new notification
     */
    add: function (notification) {
        const newNotif = {
            id: Date.now(),
            title: notification.title || 'Notification',
            message: notification.message || '',
            type: notification.type || 'info', // info, warning, success, error, action
            icon: notification.icon || 'fa-bell',
            timestamp: new Date().toISOString(),
            read: false,
            link: notification.link || null
        };

        // Add to beginning
        this.notifications.unshift(newNotif);

        // Trim to max
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        this.save();
        this.updateBadge();

        return newNotif;
    },

    /**
     * Mark notification as read
     */
    markAsRead: function (id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            this.save();
            this.updateBadge();
        }
    },

    /**
     * Mark all as read
     */
    markAllAsRead: function () {
        this.notifications.forEach(n => n.read = true);
        this.save();
        this.updateBadge();

        // Refresh panel if open
        const panel = document.getElementById('notification-panel');
        if (panel && panel.style.display !== 'none') {
            this.renderPanel();
        }
    },

    /**
     * Clear all notifications
     */
    clearAll: function () {
        this.notifications = [];
        this.save();
        this.updateBadge();

        // Close panel
        const panel = document.getElementById('notification-panel');
        if (panel) panel.style.display = 'none';
    },

    /**
     * Get unread count
     */
    getUnreadCount: function () {
        return this.notifications.filter(n => !n.read).length;
    },

    /**
     * Save to localStorage
     */
    save: function () {
        try {
            localStorage.setItem('auditcb_notifications', JSON.stringify(this.notifications));
        } catch (e) {
            Logger.warn('Failed to save notifications:', e);
        }
    },

    /**
     * Update badge count
     */
    updateBadge: function () {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;

        const count = this.getUnreadCount();
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    },

    /**
     * Generate system notifications based on app state
     */
    generateSystemNotifications: function () {
        const now = new Date();

        // Check for expiring audits (30 days)
        const clients = window.getVisibleClients?.() || window.state?.clients || [];
        const expiringClients = clients.filter(c => {
            if (!c.nextAudit) return false;
            const daysUntil = Math.ceil((new Date(c.nextAudit) - now) / (1000 * 60 * 60 * 24));
            return daysUntil <= 30 && daysUntil > 0;
        });

        if (expiringClients.length > 0) {
            // Check if we already added this today
            const today = now.toDateString();
            const existing = this.notifications.find(n =>
                n.title.includes('expiring') && new Date(n.timestamp).toDateString() === today
            );

            if (!existing) {
                this.add({
                    title: `${expiringClients.length} audit(s) expiring soon`,
                    message: 'Review and schedule upcoming audits.',
                    type: 'warning',
                    icon: 'fa-calendar-exclamation',
                    link: '#audit-planning'
                });
            }
        }

        // Check for pending user approvals (Admin only)
        if (window.state?.currentUser?.role === 'Admin') {
            const pendingUsers = (window.state.users || []).filter(u => u.status === 'Pending');
            if (pendingUsers.length > 0) {
                const existing = this.notifications.find(n =>
                    n.title.includes('pending approval') && !n.read
                );

                if (!existing) {
                    this.add({
                        title: `${pendingUsers.length} user(s) pending approval`,
                        message: 'Review and approve new user accounts.',
                        type: 'action',
                        icon: 'fa-user-clock',
                        link: '#settings'
                    });
                }
            }
        }
    },

    /**
     * Render notification panel
     */
    renderPanel: function () {
        let panel = document.getElementById('notification-panel');

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'notification-panel';
            document.body.appendChild(panel);
        }

        const notifs = this.notifications.slice(0, 10); // Show last 10

        panel.innerHTML = `
            <div style="position: fixed; top: 60px; right: 80px; width: 360px; max-height: 480px; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 9999; overflow: hidden;">
                <div style="padding: 1rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; font-size: 1rem;"><i class="fa-solid fa-bell" style="margin-right: 0.5rem;"></i>Notifications</h4>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="NotificationManager.markAllAsRead()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                            Mark all read
                        </button>
                        <button data-action="toggleNotificationPanel" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.1rem;">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
                <div style="max-height: 380px; overflow-y: auto;">
                    ${notifs.length > 0 ? notifs.map(n => `
                        <div onclick="NotificationManager.handleClick(${n.id}, '${n.link || ''}')" 
                             style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; background: ${n.read ? 'white' : '#f0f9ff'}; transition: background 0.2s;">
                            <div style="display: flex; gap: 0.75rem; align-items: start;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${this.getTypeColor(n.type)}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i class="fa-solid ${n.icon}" style="color: white; font-size: 0.85rem;"></i>
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <p style="margin: 0; font-weight: ${n.read ? '400' : '600'}; font-size: 0.9rem; color: #1e293b;">${window.UTILS.escapeHtml(n.title)}</p>
                                    <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: #64748b;">${window.UTILS.escapeHtml(n.message)}</p>
                                    <p style="margin: 0.25rem 0 0 0; font-size: 0.7rem; color: #94a3b8;">${this.formatTime(n.timestamp)}</p>
                                </div>
                                ${!n.read ? '<div style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; flex-shrink: 0;"></div>' : ''}
                            </div>
                        </div>
                    `).join('') : `
                        <div style="padding: 3rem; text-align: center; color: #94a3b8;">
                            <i class="fa-solid fa-bell-slash" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                            <p style="margin: 0;">No notifications</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        panel.style.display = 'block';
    },

    /**
     * Handle notification click
     */
    handleClick: function (id, link) {
        this.markAsRead(id);

        if (link) {
            window.location.hash = link.replace('#', '');
        }

        toggleNotificationPanel();
    },

    /**
     * Get color for notification type
     */
    getTypeColor: function (type) {
        const colors = {
            info: '#3b82f6',
            warning: '#f59e0b',
            success: '#22c55e',
            error: '#ef4444',
            action: '#8b5cf6'
        };
        return colors[type] || colors.info;
    },

    /**
     * Format timestamp
     */
    formatTime: function (timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
};

// Toggle notification panel
window.toggleNotificationPanel = function () {
    const panel = document.getElementById('notification-panel');

    if (panel && panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        NotificationManager.renderPanel();
    }
};

// Close panel when clicking outside
document.addEventListener('click', function (e) {
    const panel = document.getElementById('notification-panel');
    const bell = document.getElementById('notification-bell');

    if (panel && panel.style.display === 'block') {
        if (!panel.contains(e.target) && !bell?.contains(e.target)) {
            panel.style.display = 'none';
        }
    }
});

// Export
window.NotificationManager = NotificationManager;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
} else {
    NotificationManager.init();
}

Logger.info('Notification module loaded');
