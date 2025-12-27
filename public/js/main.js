// Function to toggle Admin/User fields in Register page
function toggleRole(role) {
    const adminGroup = document.getElementById('adminCodeGroup');
    const roleInput = document.getElementById('roleInput');
    const headerText = document.getElementById('headerText');
    const submitBtn = document.getElementById('submitBtn');
    const adminInput = document.getElementById('adminCode');

    if (!adminGroup) return; // Guard clause if not on register page

    if (role === 'admin') {
        adminGroup.style.display = 'block';
        roleInput.value = 'admin';
        headerText.innerText = 'Join as a System Administrator';
        submitBtn.innerText = 'Register as Admin';
        submitBtn.classList.replace('btn-primary', 'btn-danger');
        adminInput.setAttribute('required', 'required');
    } else {
        adminGroup.style.display = 'none';
        roleInput.value = 'user';
        headerText.innerText = 'Join as a standard user';
        submitBtn.innerText = 'Register as User';
        submitBtn.classList.replace('btn-danger', 'btn-primary');
        adminInput.removeAttribute('required');
        adminInput.value = '';
    }
}

// Global CSRF Helper
const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
};

// Override global fetch to verify CSRF
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    config = config || {};

    // Only add headers for non-GET requests
    if (config.method && config.method.toUpperCase() !== 'GET') {
        config.headers = {
            ...config.headers,
            'CSRF-Token': getCsrfToken(),
            'Content-Type': 'application/json' // Ensure JSON type for most calls mainly
        };
    }

    return originalFetch(resource, config);
};

// Enhanced Follow Function
// Enhanced Follow Function
async function followUser(userId) {
    try {
        const response = await fetch(`/user/follow/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Follow error:', error);
    }
}

async function acceptRequest(senderId) {
    try {
        const response = await fetch(`/user/follow-accept/${senderId}`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Accept request error:', error);
    }
}

async function rejectRequest(senderId) {
    try {
        const response = await fetch(`/user/follow-reject/${senderId}`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Reject request error:', error);
    }
}

let userToRemove = null;
let removeModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('removeConfirmModal');
    if (modalEl) {
        removeModalInstance = new bootstrap.Modal(modalEl);

        const confirmBtn = document.getElementById('confirmRemoveBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                if (!userToRemove) return;
                try {
                    const response = await fetch(`/user/remove-follower/${userToRemove}`, { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        removeModalInstance.hide();
                        location.reload();
                    }
                } catch (error) {
                    console.error('Remove follower error:', error);
                }
            });
        }
    }
});

function removeFollower(userId) {
    userToRemove = userId;
    if (removeModalInstance) {
        removeModalInstance.show();
    } else {
        if (confirm('Bu kullanıcıyı takipçilerinden çıkarmak istediğine emin misin?')) {
            // Fallback if modal fails to init
            fetch(`/user/remove-follower/${userId}`, { method: 'POST' })
                .then(r => r.json())
                .then(d => { if (d.success) location.reload(); });
        }
    }
}

// Alias for Unfollow (uses logic from followUser which toggles, but here for semantic clarity if used in templates)
// Alias for Unfollow (uses logic from followUser which toggles, but here for semantic clarity if used in templates)
const unfollowUser = followUser;

async function resetNotificationCount() {
    // Baloncuğu anında gizle
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';

    // Backend'de okundu işaretle
    try {
        await fetch('/notifications/mark-all-read', { method: 'POST' });
    } catch (e) { console.error(e); }
}

let deleteNotifModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('removeConfirmModal');
    if (modalEl) {
        removeModalInstance = new bootstrap.Modal(modalEl);

        const confirmBtn = document.getElementById('confirmRemoveBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                if (!userToRemove) return;
                try {
                    const response = await fetch(`/user/remove-follower/${userToRemove}`, { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        removeModalInstance.hide();
                        location.reload();
                    }
                } catch (error) {
                    console.error('Remove follower error:', error);
                }
            });
        }
    }
});

// Separate event listener for Delete All Notifications to avoid monolithic blocks
document.addEventListener('DOMContentLoaded', () => {
    // Init Delete All Notification Modal
    const deleteModalEl = document.getElementById('deleteNotifModal');
    if (deleteModalEl) {
        deleteNotifModalInstance = new bootstrap.Modal(deleteModalEl);

        const confirmDeleteBtn = document.getElementById('confirmDeleteAllBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/notifications/delete-all', { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                        deleteNotifModalInstance.hide();
                        location.reload();
                    }
                } catch (e) {
                    console.error("Delete All Notifs Error:", e);
                }
            });
        }
    }
});

async function deleteAllNotifications() {
    // 1. Önce sayfadaki tüm eski 'fade' ve 'show' kalıntılarını temizle
    const existingBackdrops = document.querySelectorAll('.modal-backdrop');
    existingBackdrops.forEach(b => b.remove());

    // 2. Modalı öyle başlat
    const modalElem = document.getElementById('deleteNotifModal');
    if (modalElem) {
        const myModal = new bootstrap.Modal(modalElem, {
            backdrop: true // Sadece tek bir karartma katmanı olsun
        });
        // Update instance global if needed, but here we just show it. 
        // Better to sync with the global instance variable if we want consistency, 
        // but user asked for this specific function body.
        deleteNotifModalInstance = myModal;
        myModal.show();
    } else {
        console.error("HATA: deleteNotifModal bulunamadı!");
    }
}
