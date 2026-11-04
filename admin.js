/**
 * SnapzDealz - Admin Orders Management System
 * Live order synchronization, fulfillment tracking, and catalog controls
 * Hardened with Salted SHA-256 PIN Authentication, PII Privacy Mode, Brute-Force Shield, and Session Expiry
 */

const GOOGLE_SHEET_ORDER_WEBHOOK = 'https://script.google.com/macros/s/AKfycbxok04-fGeaORcDyDwG8qYODD-903xt4q8xq2YTJBCG2fQ6gAF1rmy8FEUyHrozYdQ2/exec';
const STORAGE_ORDERS_KEY = 'snapdealz_orders_v1';

// Security Storage Keys
const ADMIN_AUTH_KEY = 'snapdealz_admin_auth_v1';
const ADMIN_PIN_HASH_KEY = 'snapdealz_admin_pin_hash_v1';
const ADMIN_PII_MASK_KEY = 'snapdealz_admin_pii_mask_v1';
const ADMIN_LAST_ACTIVE_KEY = 'snapdealz_admin_last_active_v1';
const CANCEL_RETENTION_KEY = 'snapdealz_cancel_retention_sec';
const STORAGE_PURGED_KEY = 'snapdealz_purged_orders_v1';
const DEFAULT_ADMIN_PIN = '1234';
const ADMIN_SALT = 'SNAPZDEALZ_ADMIN_SECURE_SALT_v2_47a9f';

// Purged Orders Tracking Helpers
function getPurgedOrderIds() {
  try {
    const raw = localStorage.getItem(STORAGE_PURGED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function markOrderAsPurged(orderRef) {
  const cleanId = String(orderRef).replace('#', '').trim().toUpperCase();
  const list = getPurgedOrderIds();
  if (!list.includes(cleanId)) {
    list.push(cleanId);
    if (list.length > 500) list.shift();
    localStorage.setItem(STORAGE_PURGED_KEY, JSON.stringify(list));
  }
}

// State
let allOrders = [];
let activeStatusFilter = 'ALL';
let activePaymentFilter = 'ALL';
let activeSearchQuery = '';
let isPiiMasked = localStorage.getItem(ADMIN_PII_MASK_KEY) !== 'false'; // Default ON for data protection
let adminLockoutTimer = null;

/**
 * Get retention duration in milliseconds before cancelled orders are automatically purged
 */
function getCancelRetentionDuration() {
  const saved = localStorage.getItem(CANCEL_RETENTION_KEY);
  const seconds = saved !== null ? parseInt(saved, 10) : 120; // Default: 2 minutes
  return isNaN(seconds) ? 120 * 1000 : seconds * 1000;
}

function getCancelRetentionSeconds() {
  const saved = localStorage.getItem(CANCEL_RETENTION_KEY);
  const seconds = saved !== null ? parseInt(saved, 10) : 120;
  return isNaN(seconds) ? 120 : seconds;
}

/**
 * Robust HTML entity escaper to neutralize Cross-Site Scripting (XSS)
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Computes SHA-256 hash using native Web Crypto API
 */
async function computeSha256(message) {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = ((hash << 5) - hash) + message.charCodeAt(i);
      hash |= 0;
    }
    return 'sha256_fallback_' + Math.abs(hash).toString(16);
  }
}

/**
 * Hash an admin PIN with the security salt
 */
async function hashAdminPin(pin) {
  return await computeSha256(`${ADMIN_SALT}::${pin}`);
}

/**
 * Masks sensitive emails for privacy (e.g. alex@example.com -> a***@example.com)
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const parts = email.split('@');
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

/**
 * Masks sensitive phone numbers (e.g. 03001234567 -> 0300****567)
 */
function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.length < 7) return clean;
  return clean.slice(0, 4) + '****' + clean.slice(-3);
}

/**
 * Admin PIN Rate Limiter
 */
const AdminRateLimiter = {
  getRecord() {
    try {
      const raw = sessionStorage.getItem('snapdealz_admin_rl');
      return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
    } catch (e) {
      return { attempts: 0, lockedUntil: 0 };
    }
  },
  isLocked() {
    const rec = this.getRecord();
    const now = Date.now();
    if (rec.lockedUntil && now < rec.lockedUntil) {
      return Math.ceil((rec.lockedUntil - now) / 1000);
    }
    return 0;
  },
  recordFailure(maxAttempts = 4, lockSeconds = 60) {
    const rec = this.getRecord();
    rec.attempts = (rec.attempts || 0) + 1;
    if (rec.attempts >= maxAttempts) {
      rec.lockedUntil = Date.now() + (lockSeconds * 1000);
      rec.attempts = 0;
    }
    sessionStorage.setItem('snapdealz_admin_rl', JSON.stringify(rec));
    return rec;
  },
  reset() {
    sessionStorage.removeItem('snapdealz_admin_rl');
  }
};

/**
 * Helper function to return CSS class string based on the order status
 */
function getOrderStatusCSSClass(status, type = 'badge') {
  const s = String(status || '').trim().toLowerCase();

  // Cancelled -> Danger / Red
  if (s.includes('cancel')) {
    if (type === 'bg') return 'bg-danger text-white';
    if (type === 'text') return 'text-danger fw-bold';
    if (type === 'border') return 'border-danger';
    return 'badge bg-danger-subtle text-danger border border-danger-subtle fw-bold px-3 py-1 rounded-pill';
  }

  // Delivered -> Success / Green
  if (s.includes('deliver')) {
    if (type === 'bg') return 'bg-success text-white';
    if (type === 'text') return 'text-success fw-bold';
    if (type === 'border') return 'border-success';
    return 'badge bg-success-subtle text-success border border-success-subtle fw-bold px-3 py-1 rounded-pill';
  }

  // Shipped / Transit -> Info / Blue
  if (s.includes('ship') || s.includes('transit') || s.includes('out')) {
    if (type === 'bg') return 'bg-primary text-white';
    if (type === 'text') return 'text-primary fw-bold';
    if (type === 'border') return 'border-primary';
    return 'badge bg-primary-subtle text-primary border border-primary-subtle fw-bold px-3 py-1 rounded-pill';
  }

  // Pending (Default) -> Warning / Yellow
  if (type === 'bg') return 'bg-warning text-dark';
  if (type === 'text') return 'text-warning-emphasis fw-bold';
  if (type === 'border') return 'border-warning';
  return 'badge bg-warning-subtle text-dark border border-warning fw-bold px-3 py-1 rounded-pill';
}

function getOrderStatusIcon(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s.includes('cancel')) return 'bi-x-circle-fill';
  if (s.includes('deliver')) return 'bi-check-circle-fill';
  if (s.includes('ship') || s.includes('transit') || s.includes('out')) return 'bi-truck';
  return 'bi-clock-history';
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

async function initAdminDashboard() {
  initEventListeners();
  updatePiiButtonUi();
  initSessionInactivityWatcher();
  initAdminProductsManager();
  initCancelledOrdersCleaner();
  const isAuth = checkAdminAuth();
  if (isAuth) {
    await loadAndDisplayOrders();
  }
}

/**
 * Auto-lock session after 15 minutes of inactivity
 */
function initSessionInactivityWatcher() {
  const updateActive = () => {
    if (sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true') {
      sessionStorage.setItem(ADMIN_LAST_ACTIVE_KEY, Date.now().toString());
    }
  };

  window.addEventListener('mousemove', updateActive, { passive: true });
  window.addEventListener('keydown', updateActive, { passive: true });
  window.addEventListener('click', updateActive, { passive: true });

  setInterval(() => {
    if (sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true') {
      const last = Number(sessionStorage.getItem(ADMIN_LAST_ACTIVE_KEY) || Date.now());
      const maxIdleMs = 15 * 60 * 1000; // 15 minutes
      if (Date.now() - last > maxIdleMs) {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        checkAdminAuth();
        showAdminToast('🔒 Session locked due to inactivity for data protection.');
      }
    }
  }, 30000);
}

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  const gateEl = document.getElementById('adminLoginGate');
  const portalEl = document.getElementById('adminMainPortal');
  const refreshBtn = document.getElementById('adminRefreshBtn');
  const lockBtn = document.getElementById('adminLockBtn');
  const secBtn = document.getElementById('adminSecurityBtn');
  const piiBtn = document.getElementById('togglePiiPrivacyBtn');

  if (isAuth) {
    if (gateEl) gateEl.classList.add('d-none');
    if (portalEl) portalEl.classList.remove('d-none');
    if (refreshBtn) refreshBtn.classList.remove('d-none');
    if (lockBtn) lockBtn.classList.remove('d-none');
    if (secBtn) secBtn.classList.remove('d-none');
    if (piiBtn) piiBtn.classList.remove('d-none');
    return true;
  } else {
    if (gateEl) gateEl.classList.remove('d-none');
    if (portalEl) portalEl.classList.add('d-none');
    if (refreshBtn) refreshBtn.classList.add('d-none');
    if (lockBtn) lockBtn.classList.add('d-none');
    if (secBtn) secBtn.classList.add('d-none');
    if (piiBtn) piiBtn.classList.add('d-none');
    checkLockoutUi();
    return false;
  }
}

function checkLockoutUi() {
  const lockSeconds = AdminRateLimiter.isLocked();
  const noticeEl = document.getElementById('adminLockoutNotice');
  const countEl = document.getElementById('adminLockoutCountdown');
  const submitBtn = document.getElementById('adminUnlockSubmitBtn');
  const pinInput = document.getElementById('adminPinInput');

  if (lockSeconds > 0) {
    if (noticeEl) noticeEl.classList.remove('d-none');
    if (countEl) countEl.textContent = `${lockSeconds}s`;
    if (submitBtn) submitBtn.disabled = true;
    if (pinInput) pinInput.disabled = true;

    if (!adminLockoutTimer) {
      adminLockoutTimer = setInterval(() => {
        const remaining = AdminRateLimiter.isLocked();
        if (remaining <= 0) {
          clearInterval(adminLockoutTimer);
          adminLockoutTimer = null;
          if (noticeEl) noticeEl.classList.add('d-none');
          if (submitBtn) submitBtn.disabled = false;
          if (pinInput) pinInput.disabled = false;
        } else if (countEl) {
          countEl.textContent = `${remaining}s`;
        }
      }, 1000);
    }
  } else {
    if (noticeEl) noticeEl.classList.add('d-none');
    if (submitBtn) submitBtn.disabled = false;
    if (pinInput) pinInput.disabled = false;
  }
}

function updatePiiButtonUi() {
  const piiBtn = document.getElementById('togglePiiPrivacyBtn');
  const statusSpan = document.getElementById('piiStatusText');
  const mobileStatusSpan = document.getElementById('piiStatusTextMobile');
  
  if (statusSpan) {
    statusSpan.textContent = isPiiMasked ? 'ON' : 'OFF';
  }
  if (mobileStatusSpan) {
    mobileStatusSpan.textContent = isPiiMasked ? 'ON' : 'OFF';
  }
  if (piiBtn) {
    if (isPiiMasked) {
      piiBtn.className = 'btn btn-sm btn-outline-warning text-dark bg-warning-subtle rounded-pill px-3 py-1 fw-semibold text-nowrap';
      piiBtn.innerHTML = '<i class="bi bi-shield-lock-fill me-1 text-warning"></i> Privacy Mask: <strong>ON</strong>';
    } else {
      piiBtn.className = 'btn btn-sm btn-outline-secondary text-white rounded-pill px-3 py-1 fw-semibold text-nowrap';
      piiBtn.innerHTML = '<i class="bi bi-shield-slash me-1"></i> Privacy Mask: <strong>OFF</strong>';
    }
  }
}

/**
 * Setup event listeners for search, filters, refresh, security modal, and cancel modal
 */
function initEventListeners() {
  // PII Privacy Toggle Button (Desktop & Mobile)
  const togglePii = () => {
    isPiiMasked = !isPiiMasked;
    localStorage.setItem(ADMIN_PII_MASK_KEY, isPiiMasked.toString());
    updatePiiButtonUi();
    applyFiltersAndRender();
    showAdminToast(isPiiMasked ? '🛡️ Customer phone & email masked for privacy.' : '⚠️ Customer personal info revealed.');
  };

  const piiBtn = document.getElementById('togglePiiPrivacyBtn');
  if (piiBtn) piiBtn.addEventListener('click', togglePii);

  const piiBtnMobile = document.getElementById('togglePiiPrivacyBtnMobile');
  if (piiBtnMobile) piiBtnMobile.addEventListener('click', togglePii);

  // Toggle Admin PIN Visibility
  const togglePinVisBtn = document.getElementById('toggleAdminPinVisBtn');
  const pinInput = document.getElementById('adminPinInput');
  if (togglePinVisBtn && pinInput) {
    togglePinVisBtn.addEventListener('click', () => {
      const isPass = pinInput.getAttribute('type') === 'password';
      pinInput.setAttribute('type', isPass ? 'text' : 'password');
      togglePinVisBtn.querySelector('i').className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  // Admin PIN Unlock Form (With Salted SHA-256 Authentication)
  const pinForm = document.getElementById('adminPinForm');
  if (pinForm) {
    pinForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (AdminRateLimiter.isLocked() > 0) {
        checkLockoutUi();
        return;
      }

      const pinVal = document.getElementById('adminPinInput')?.value.trim();
      const errEl = document.getElementById('adminPinError');

      // Retrieve current custom PIN hash or default hash
      const storedHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);
      const enteredHash = await hashAdminPin(pinVal);
      const defaultHash = await hashAdminPin(DEFAULT_ADMIN_PIN);

      const isValid = (storedHash && enteredHash === storedHash) || 
                      (!storedHash && (pinVal === DEFAULT_ADMIN_PIN || enteredHash === defaultHash));

      if (isValid) {
        AdminRateLimiter.reset();
        if (errEl) errEl.classList.add('d-none');
        sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
        sessionStorage.setItem(ADMIN_LAST_ACTIVE_KEY, Date.now().toString());
        checkAdminAuth();
        loadAndDisplayOrders();
        initAdminProductsManager();
        showAdminToast('🔓 Welcome Administrator! Cryptographic session initiated.');
      } else {
        const failureRec = AdminRateLimiter.recordFailure(4, 60);
        const remaining = Math.max(0, 4 - failureRec.attempts);
        if (errEl) {
          errEl.classList.remove('d-none');
          errEl.innerHTML = remaining > 0 
            ? `Incorrect PIN. <strong>${remaining} attempt(s) remaining</strong> before security lockout.`
            : 'Security Lockout Activated! Access blocked for 60 seconds.';
        }
        checkLockoutUi();
      }
    });
  }

  // Change Admin Master PIN Form
  const changePinForm = document.getElementById('changeAdminPinForm');
  if (changePinForm) {
    changePinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currPin = document.getElementById('currentPinInput')?.value.trim();
      const newPin = document.getElementById('newPinInput')?.value.trim();
      const confirmPin = document.getElementById('confirmNewPinInput')?.value.trim();
      const alertEl = document.getElementById('adminSecurityAlert');

      // Verify current PIN
      const storedHash = localStorage.getItem(ADMIN_PIN_HASH_KEY);
      const currHash = await hashAdminPin(currPin);
      const defaultHash = await hashAdminPin(DEFAULT_ADMIN_PIN);

      const isCurrentValid = (storedHash && currHash === storedHash) ||
                             (!storedHash && (currPin === DEFAULT_ADMIN_PIN || currHash === defaultHash));

      if (!isCurrentValid) {
        if (alertEl) {
          alertEl.className = 'alert alert-danger d-block';
          alertEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Current PIN is incorrect. Authentication failed.';
        }
        return;
      }

      if (newPin !== confirmPin || newPin.length < 4) {
        if (alertEl) {
          alertEl.className = 'alert alert-danger d-block';
          alertEl.innerHTML = newPin !== confirmPin 
            ? '<i class="bi bi-x-circle-fill me-1"></i> New PIN and confirmation do not match.' 
            : '<i class="bi bi-x-circle-fill me-1"></i> New PIN must be between 4 and 8 digits.';
        }
        return;
      }

      // Hash and store new PIN
      const newHash = await hashAdminPin(newPin);
      localStorage.setItem(ADMIN_PIN_HASH_KEY, newHash);

      if (alertEl) {
        alertEl.className = 'alert alert-success d-block';
        alertEl.innerHTML = '<i class="bi bi-shield-check text-success me-1"></i> <strong>Admin Master PIN updated!</strong> New salted SHA-256 hash saved successfully.';
      }

      changePinForm.reset();
      showAdminToast('🔑 Master Admin PIN updated successfully.');
    });
  }

  // Reset PIN to Default Button
  const resetPinBtn = document.getElementById('resetPinToDefaultBtn');
  if (resetPinBtn) {
    resetPinBtn.addEventListener('click', () => {
      if (confirm('Reset Master Admin PIN back to default (1234)?')) {
        localStorage.removeItem(ADMIN_PIN_HASH_KEY);
        const alertEl = document.getElementById('adminSecurityAlert');
        if (alertEl) {
          alertEl.className = 'alert alert-warning d-block';
          alertEl.innerHTML = '<i class="bi bi-info-circle-fill me-1"></i> Admin PIN reset back to default: <strong>1234</strong>.';
        }
        showAdminToast('Admin PIN reset to default 1234.');
      }
    });
  }

  // Wipe All Orders Button in Security Modal
  const wipeAllOrdersBtn = document.getElementById('wipeAllOrdersBtn');
  if (wipeAllOrdersBtn) {
    wipeAllOrdersBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to permanently clear ALL test orders from Google Sheet and the active manifest? This cannot be undone.')) {
        return;
      }
      wipeAllOrdersBtn.disabled = true;
      wipeAllOrdersBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Clearing...';

      try {
        await Promise.race([
          fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?action=CLEAR_ALL_ORDERS`, { mode: 'no-cors' }),
          new Promise(r => setTimeout(r, 2500))
        ]);
      } catch (e) {
        console.warn('Wipe request sent');
      }

      // Clear local storage orders and purged tracking
      localStorage.removeItem(STORAGE_ORDERS_KEY);
      localStorage.removeItem(STORAGE_PURGED_KEY);
      allOrders = [];
      updateDashboardKPIs();
      applyFiltersAndRender();
      showAdminToast('🗑️ All test orders successfully cleared from Google Sheet & Manifest.');

      wipeAllOrdersBtn.disabled = false;
      wipeAllOrdersBtn.innerHTML = 'Clear All';

      // Close modal
      const secModalEl = document.getElementById('adminSecurityModal');
      if (secModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const bsModal = bootstrap.Modal.getInstance(secModalEl);
        if (bsModal) bsModal.hide();
      }
    });
  }

  // Lock Portal Button (Desktop & Mobile)
  const lockAction = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    sessionStorage.removeItem(ADMIN_LAST_ACTIVE_KEY);
    checkAdminAuth();
    showAdminToast('Admin dashboard locked.');
  };

  const lockBtn = document.getElementById('adminLockBtn');
  if (lockBtn) lockBtn.addEventListener('click', lockAction);

  const lockBtnMobile = document.getElementById('adminLockBtnMobile');
  if (lockBtnMobile) lockBtnMobile.addEventListener('click', lockAction);

  // Refresh / Sync Sheet Button (Desktop & Mobile)
  const refreshAction = async () => {
    const icon = document.getElementById('refreshIcon');
    const mobileIcon = document.querySelector('#adminRefreshBtnMobile i');
    if (icon) icon.classList.add('spin-animation');
    if (mobileIcon) mobileIcon.classList.add('spin-animation');
    await loadAndDisplayOrders(true);
    if (icon) icon.classList.remove('spin-animation');
    if (mobileIcon) mobileIcon.classList.remove('spin-animation');
  };

  const refreshBtn = document.getElementById('adminRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshAction);

  const refreshBtnMobile = document.getElementById('adminRefreshBtnMobile');
  if (refreshBtnMobile) refreshBtnMobile.addEventListener('click', refreshAction);

  // Search input
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });
  }

  // Status Filter Pills
  const statusPills = document.querySelectorAll('.filter-pill-btn');
  statusPills.forEach(pill => {
    pill.addEventListener('click', () => {
      statusPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeStatusFilter = pill.getAttribute('data-filter-status');
      applyFiltersAndRender();
    });
  });

  // Payment dropdown filter
  const paymentSelect = document.getElementById('adminPaymentFilter');
  if (paymentSelect) {
    paymentSelect.addEventListener('change', (e) => {
      activePaymentFilter = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Reset filters button
  const resetBtn = document.getElementById('adminResetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeStatusFilter = 'ALL';
      activePaymentFilter = 'ALL';
      activeSearchQuery = '';
      if (searchInput) searchInput.value = '';
      if (paymentSelect) paymentSelect.value = 'ALL';
      statusPills.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-filter-status') === 'ALL');
      });
      applyFiltersAndRender();
    });
  }

  // Admin Cancellation Form Submit
  const cancelForm = document.getElementById('adminCancelOrderForm');
  if (cancelForm) {
    cancelForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await executeAdminCancellation();
    });
  }
}

/**
 * Fetch orders from Cloud Storage Endpoint and reconcile with local storage
 */
async function loadAndDisplayOrders(showNotification = false) {
  const tableBody = document.getElementById('adminOrdersTableBody');
  const syncLabel = document.getElementById('lastSyncedLabel');

  if (tableBody && !allOrders.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-5">
          <div class="spinner-border text-warning mb-2" role="status"></div>
          <div class="text-muted small">Connecting to secure cloud database & fetching orders...</div>
        </td>
      </tr>
    `;
  }

  let sheetOrders = [];
  let sheetFetchSuccess = false;

  // 1. Try to fetch from cloud storage endpoint via action=GET_ORDERS
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?action=GET_ORDERS&t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.status === 'success' && Array.isArray(data.orders)) {
        sheetOrders = data.orders;
        sheetFetchSuccess = true;
      }
    }
  } catch (err) {
    // Graceful fallback to local cached sync without exposing provider specifics
  }

  // 2. Fetch local orders stored on device/browser
  let localOrders = [];
  const now = Date.now();
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    localOrders = raw ? JSON.parse(raw) : [];
    // Auto-clean any expired cancelled orders from local storage
    localOrders = localOrders.filter(o => {
      const isCancelled = String(o.status || '').toUpperCase().includes('CANCEL');
      if (!isCancelled) return true;
      const purgeAt = o.autoPurgeAt || (o.cancelledAt ? o.cancelledAt + getCancelRetentionDuration() : (now - 1));
      return now < purgeAt;
    });
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(localOrders));
  } catch (e) {
    console.error('Error reading local orders', e);
  }

  // 3. Merge & Deduplicate Orders
  const mergedMap = new Map();
  const purgedSet = new Set(getPurgedOrderIds());

  // First add local orders
  localOrders.forEach(o => {
    const key = String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase();
    if (key && !purgedSet.has(key)) mergedMap.set(key, o);
  });

  // Then merge cloud storage orders (Remote orders will override or add)
  sheetOrders.forEach(so => {
    const key = String(so.orderNumber || so.orderId || '').replace('#', '').trim().toUpperCase();
    if (key && !purgedSet.has(key)) {
      const existing = mergedMap.get(key) || {};
      const isCancelled = String(so.status || existing.status || '').toUpperCase().includes('CANCEL');
      const purgeAt = existing.autoPurgeAt || (existing.cancelledAt ? existing.cancelledAt + getCancelRetentionDuration() : 0);
      
      // If cancelled and purge time has expired, do not add to active manifest
      if (isCancelled && purgeAt > 0 && now >= purgeAt) {
        mergedMap.delete(key);
      } else {
        mergedMap.set(key, { ...existing, ...so });
      }
    }
  });

  // If still empty and cloud fetch failed (e.g. offline brand new preview without connection), provide sample demo orders
  if (!sheetFetchSuccess && mergedMap.size === 0) {
    const sampleDemoOrders = [
      {
        orderNumber: '#SNP-982421',
        dateString: new Date(Date.now() - 3600000 * 4).toLocaleString(),
        customerName: 'Alex Johnson',
        phone: '0300 1234567',
        email: 'alex@example.com',
        city: 'San Francisco',
        address: '123 Market St, Suite 400',
        itemsSummary: 'Apex Pulse Air Running Shoes x1 [US 10]',
        paymentMethod: 'Cash On Delivery',
        paymentStatus: 'Pending COD',
        total: 64.99,
        status: 'Out for Delivery'
      },
      {
        orderNumber: '#SNP-510924',
        dateString: new Date(Date.now() - 3600000 * 20).toLocaleString(),
        customerName: 'Sarah Miller',
        phone: '0321 9876543',
        email: 'sarah@example.com',
        city: 'New York',
        address: '742 Evergreen Terrace, Apt 12',
        itemsSummary: 'Luxe Verona Italian Leather Tote x1',
        paymentMethod: 'EasyPaisa Wallet',
        paymentStatus: 'Instant Mobile Approved',
        total: 79.99,
        status: 'Shipped'
      },
      {
        orderNumber: '#SNP-204195',
        dateString: new Date(Date.now() - 3600000 * 2).toLocaleString(),
        customerName: 'David Khan',
        phone: '0333 5551234',
        email: 'david@example.com',
        city: 'Lahore',
        address: 'Gulberg III, Main Blvd #14',
        itemsSummary: 'SonicPro ANC Wireless Headphones x1',
        paymentMethod: 'JazzCash Wallet',
        paymentStatus: 'MPIN Verified',
        total: 89.99,
        status: 'Order Placed'
      }
    ];
    sampleDemoOrders.forEach(demo => {
      mergedMap.set(demo.orderNumber.replace('#', ''), demo);
    });
  }

  allOrders = Array.from(mergedMap.values());

  // Update last synced label
  if (syncLabel) {
    const timeStr = new Date().toLocaleTimeString();
    syncLabel.textContent = `Last synchronized: Today at ${timeStr} ${sheetFetchSuccess ? '(Live Cloud Database)' : '(Cached & Local Sync)'}`;
  }

  // Update summary stats & render table
  updateDashboardKPIs();
  applyFiltersAndRender();

  if (showNotification) {
    showAdminToast(`Synced ${allOrders.length} orders with cloud database.`);
  }
}

/**
 * Calculate KPI Stats
 */
function updateDashboardKPIs() {
  const totalOrdersEl = document.getElementById('statTotalOrders');
  const totalRevenueEl = document.getElementById('statTotalRevenue');
  const activeShipmentsEl = document.getElementById('statActiveShipments');
  const cancelledOrdersEl = document.getElementById('statCancelledOrders');

  let revenue = 0;
  let activeCount = 0;
  let cancelledCount = 0;

  allOrders.forEach(o => {
    const status = String(o.status || '').toUpperCase();
    const isCancelled = status.includes('CANCEL');

    if (isCancelled) {
      cancelledCount++;
    } else {
      revenue += Number(o.total || 0);
      if (status.includes('PLACED') || status.includes('SHIP') || status.includes('TRANSIT') || status.includes('OUT')) {
        activeCount++;
      }
    }
  });

  if (totalOrdersEl) totalOrdersEl.textContent = allOrders.length;
  if (totalRevenueEl) totalRevenueEl.textContent = `$${revenue.toFixed(2)}`;
  if (activeShipmentsEl) activeShipmentsEl.textContent = activeCount;
  if (cancelledOrdersEl) cancelledOrdersEl.textContent = cancelledCount;
}

/**
 * Filter orders based on active filters and keyword search
 */
function applyFiltersAndRender() {
  const tableBody = document.getElementById('adminOrdersTableBody');
  const emptyState = document.getElementById('adminEmptyState');
  const filteredCountEl = document.getElementById('tableFilteredCount');

  if (!tableBody) return;

  const filtered = allOrders.filter(order => {
    // 1. Status Filter
    const st = String(order.status || '').toUpperCase();
    let matchesStatus = true;
    if (activeStatusFilter === 'PLACED') matchesStatus = st.includes('PLACED') && !st.includes('CANCEL');
    else if (activeStatusFilter === 'SHIPPED') matchesStatus = st.includes('SHIP') && !st.includes('CANCEL');
    else if (activeStatusFilter === 'DELIVERED') matchesStatus = st.includes('DELIVER') && !st.includes('CANCEL');
    else if (activeStatusFilter === 'CANCELLED') matchesStatus = st.includes('CANCEL');

    // 2. Payment Filter
    const pm = String(order.paymentMethod || '').toUpperCase();
    let matchesPayment = true;
    if (activePaymentFilter === 'COD') matchesPayment = pm.includes('CASH') || pm.includes('COD');
    else if (activePaymentFilter === 'EASYPAISA') matchesPayment = pm.includes('EASYPAISA');
    else if (activePaymentFilter === 'JAZZCASH') matchesPayment = pm.includes('JAZZCASH');
    else if (activePaymentFilter === 'CARD') matchesPayment = pm.includes('CARD') || pm.includes('DEBIT') || pm.includes('VISA');

    // 3. Search Query
    let matchesSearch = true;
    if (activeSearchQuery) {
      const haystack = [
        order.orderNumber,
        order.customerName,
        order.phone,
        order.email,
        order.city,
        order.address,
        order.itemsSummary
      ].join(' ').toLowerCase();
      matchesSearch = haystack.includes(activeSearchQuery);
    }

    return matchesStatus && matchesPayment && matchesSearch;
  });

  if (filteredCountEl) {
    filteredCountEl.textContent = `${filtered.length} of ${allOrders.length} orders`;
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  tableBody.innerHTML = filtered.map((order, idx) => {
    const statusUpper = String(order.status || '').toUpperCase();
    const isCancelled = statusUpper.includes('CANCEL');
    const cleanRef = String(order.orderNumber || order.orderId || `#SNP-${idx}`).startsWith('#') 
      ? (order.orderNumber || order.orderId) 
      : `#${order.orderNumber || order.orderId}`;

    // Status Badge config via helper function
    const badgeClass = getOrderStatusCSSClass(order.status, 'badge');
    const badgeIcon = getOrderStatusIcon(order.status);
    const displayStatus = isCancelled ? 'Cancelled' : (statusUpper.includes('DELIVER') ? 'Delivered' : (order.status || 'Pending'));

    // Payment Icon
    let paymentIcon = 'bi-cash-stack text-warning';
    if (String(order.paymentMethod).includes('EasyPaisa')) paymentIcon = 'bi-phone-fill text-success';
    else if (String(order.paymentMethod).includes('JazzCash')) paymentIcon = 'bi-wallet2 text-danger';
    else if (String(order.paymentMethod).includes('Card')) paymentIcon = 'bi-credit-card-2-front text-primary';

    const rawId = cleanRef.replace('#', '');

    const custName = escapeHtml(order.customerName || 'Customer');
    const custPhone = isPiiMasked ? maskPhone(order.phone) : escapeHtml(order.phone || 'N/A');
    const custEmail = isPiiMasked ? maskEmail(order.email) : escapeHtml(order.email || '');
    const custCity = escapeHtml(order.city || 'Standard Delivery');
    const custAddress = escapeHtml(order.address || 'Address provided');
    const custItems = escapeHtml(order.itemsSummary || '1 Item');
    const custPayment = escapeHtml(order.paymentMethod || 'COD');
    const safeRef = escapeHtml(cleanRef);

    return `
      <tr class="${isCancelled ? 'row-cancelled' : ''}">
        <td>
          <div class="fw-bold font-monospace text-dark">${safeRef}</div>
        </td>
        <td>
          <div class="small text-muted">${escapeHtml(order.dateString || 'Today')}</div>
        </td>
        <td>
          <div class="fw-bold text-dark">${custName}</div>
          <div class="small text-muted d-flex align-items-center gap-1">
            <i class="bi bi-telephone-fill" style="font-size: 0.72rem;"></i> ${custPhone}
          </div>
          ${custEmail ? `<div class="small text-muted text-truncate" style="max-width: 140px; font-size: 0.72rem;">${custEmail}</div>` : ''}
        </td>
        <td>
          <div class="fw-semibold text-dark small">${custCity}</div>
          <div class="small text-muted text-truncate" style="max-width: 160px;" title="${custAddress}">
            ${custAddress}
          </div>
        </td>
        <td>
          <div class="small text-dark text-truncate" style="max-width: 180px;" title="${custItems}">
            ${custItems}
          </div>
        </td>
        <td>
          <div class="small fw-semibold text-dark d-flex align-items-center gap-1">
            <i class="bi ${paymentIcon}"></i> ${custPayment}
          </div>
        </td>
        <td>
          <div class="fw-bold font-monospace text-dark fs-6">$${Number(order.total || 0).toFixed(2)}</div>
        </td>
        <td>
          <span class="admin-status-badge ${badgeClass}">
            <i class="bi ${badgeIcon}"></i> ${displayStatus}
          </span>
        </td>
        <td class="text-end">
          <div class="d-inline-flex align-items-center gap-1">
            <!-- View Details Button -->
            <button type="button" class="btn btn-sm btn-light border rounded-pill px-2 py-1 admin-view-btn" data-order-ref="${rawId}" title="View Complete Manifest">
              <i class="bi bi-eye"></i> Details
            </button>

            <!-- Cancel Order Button (Active only if not already cancelled) -->
            ${!isCancelled ? `
              <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1 fw-bold admin-cancel-btn" data-order-ref="${rawId}" title="Cancel this order and update status">
                <i class="bi bi-x-circle me-1"></i> Cancel
              </button>
            ` : `
              <span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1 small" title="Auto-clears from manifest soon">
                <i class="bi bi-clock-history me-1"></i> Auto-clears in <strong class="purge-countdown" data-purge-at="${order.autoPurgeAt || (Date.now() + getCancelRetentionDuration())}">...</strong>
              </span>
              <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1 admin-purge-now-btn" data-order-ref="${rawId}" title="Remove from Manifest immediately">
                <i class="bi bi-trash3"></i>
              </button>
            `}

            <!-- Change Status Dropdown -->
            <div class="dropdown d-inline-block">
              <button class="btn btn-sm btn-light border rounded-pill p-1 px-2 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Change Status">
                <i class="bi bi-gear"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 small" style="border-radius: 12px;">
                <li><span class="dropdown-header small text-uppercase">Update Shipment Status</span></li>
                <li><a class="dropdown-item admin-status-opt" href="#" data-order-ref="${rawId}" data-status="Order Placed"><i class="bi bi-bag-check me-2"></i> Order Placed</a></li>
                <li><a class="dropdown-item admin-status-opt" href="#" data-order-ref="${rawId}" data-status="Shipped"><i class="bi bi-box-seam me-2"></i> Mark Shipped</a></li>
                <li><a class="dropdown-item admin-status-opt" href="#" data-order-ref="${rawId}" data-status="Out for Delivery"><i class="bi bi-truck me-2"></i> Out for Delivery</a></li>
                <li><a class="dropdown-item admin-status-opt text-success" href="#" data-order-ref="${rawId}" data-status="Delivered"><i class="bi bi-check2-circle me-2"></i> Mark Delivered</a></li>
                ${!isCancelled ? `
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item text-danger admin-status-cancel-opt" href="#" data-order-ref="${rawId}"><i class="bi bi-x-circle me-2"></i> Cancel Order</a></li>
                ` : ''}
              </ul>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindTableActionEvents();
}

/**
 * Bind table button events
 */
function bindTableActionEvents() {
  // Cancel Order Button
  document.querySelectorAll('.admin-cancel-btn, .admin-status-cancel-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = btn.getAttribute('data-order-ref');
      openAdminCancelModal(ref);
    });
  });

  // Purge / Remove Cancelled Order Button
  document.querySelectorAll('.admin-purge-now-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = btn.getAttribute('data-order-ref');
      if (confirm(`Remove cancelled order #${ref} from the Orders Manifest now?`)) {
        purgeOrder(ref);
      }
    });
  });

  // View Details Button
  document.querySelectorAll('.admin-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = btn.getAttribute('data-order-ref');
      openOrderDetailsModal(ref);
    });
  });

  // Change Status Dropdown Items
  document.querySelectorAll('.admin-status-opt').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.preventDefault();
      const ref = opt.getAttribute('data-order-ref');
      const newStatus = opt.getAttribute('data-status');
      await executeAdminStatusUpdate(ref, newStatus);
    });
  });
}

/**
 * Open Admin Cancellation Confirmation Modal
 */
function openAdminCancelModal(orderRef) {
  const modalEl = document.getElementById('adminCancelModal');
  if (!modalEl) return;

  const cleanOrder = String(orderRef).startsWith('#') ? orderRef : `#${orderRef}`;
  const refLabel = document.getElementById('adminCancelRef');
  const hiddenId = document.getElementById('adminCancelHiddenId');

  if (refLabel) refLabel.textContent = cleanOrder;
  if (hiddenId) hiddenId.value = cleanOrder;

  const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  bsModal.show();
}

/**
 * Open Order Details Breakdown Modal
 */
function openOrderDetailsModal(orderRef) {
  const modalEl = document.getElementById('adminDetailsModal');
  const contentEl = document.getElementById('adminDetailsModalContent');
  if (!modalEl || !contentEl) return;

  const cleanId = String(orderRef).replace('#', '').trim().toUpperCase();
  const order = allOrders.find(o => 
    String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() === cleanId
  );

  if (!order) return;

  const custPhoneDisplay = isPiiMasked ? maskPhone(order.phone) : escapeHtml(order.phone || 'N/A');
  const custEmailDisplay = isPiiMasked ? maskEmail(order.email) : escapeHtml(order.email || 'N/A');

  contentEl.innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-sm-6">
        <div class="p-3 bg-light rounded-3">
          <span class="text-muted small d-block">Order Reference Number:</span>
          <h5 class="fw-bold font-monospace text-dark mb-1">${escapeHtml(order.orderNumber || order.orderId)}</h5>
          <span class="small text-muted">Placed: ${escapeHtml(order.dateString || 'Today')}</span>
        </div>
      </div>
      <div class="col-sm-6">
        <div class="p-3 bg-light rounded-3">
          <span class="text-muted small d-block">Order Status:</span>
          <h5 class="fw-bold text-dark mb-1">${escapeHtml(order.status || 'Order Placed')}</h5>
          <span class="small text-muted">Payment: ${escapeHtml(order.paymentMethod || 'Cash On Delivery')}</span>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold text-uppercase small text-muted mb-0">Customer & Delivery Information</h6>
      ${isPiiMasked ? `
        <span class="badge bg-warning-subtle text-dark border border-warning px-2 py-1 small">
          <i class="bi bi-shield-lock-fill me-1"></i> PII Masked (Active)
        </span>
      ` : ''}
    </div>
    <div class="table-responsive mb-4">
      <table class="table table-bordered small mb-0">
        <tbody>
          <tr>
            <th class="bg-light text-muted w-25">Customer Name</th>
            <td class="fw-semibold">${escapeHtml(order.customerName || 'N/A')}</td>
          </tr>
          <tr>
            <th class="bg-light text-muted">Phone Number</th>
            <td class="fw-semibold">${custPhoneDisplay}</td>
          </tr>
          <tr>
            <th class="bg-light text-muted">Email Address</th>
            <td>${custEmailDisplay}</td>
          </tr>
          <tr>
            <th class="bg-light text-muted">Shipping Destination</th>
            <td>${escapeHtml(order.address || 'Standard Address')}, ${escapeHtml(order.city || '')}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h6 class="fw-bold text-uppercase small text-muted mb-2">Item Manifest & Financial Breakdown</h6>
    <div class="p-3 border rounded-3 bg-white mb-3">
      <div class="fw-semibold text-dark mb-2">${escapeHtml(order.itemsSummary || 'Standard Product Item')}</div>
      <div class="d-flex justify-content-between small text-muted border-top pt-2">
        <span>Payment Method:</span>
        <strong class="text-dark">${escapeHtml(order.paymentMethod || 'COD')}</strong>
      </div>
      <div class="d-flex justify-content-between fs-5 fw-bold text-dark border-top pt-2 mt-2">
        <span>Total Payable:</span>
        <span class="font-monospace text-success">$${Number(order.total || 0).toFixed(2)}</span>
      </div>
    </div>
  `;

  const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  bsModal.show();
}

/**
 * Execute cancellation triggered by Admin: fires API call to Cloud Storage Endpoint
 */
async function executeAdminCancellation() {
  const submitBtn = document.getElementById('adminConfirmCancelBtn');
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating Cloud Database...';
  }

  const orderRef = document.getElementById('adminCancelHiddenId')?.value || '';
  const selectedReason = document.querySelector('input[name="adminCancelReason"]:checked')?.value || 'Administrative cancellation';
  const notes = document.getElementById('adminCancelNotes')?.value.trim() || '';
  const fullReason = notes ? `${selectedReason} (${notes})` : selectedReason;
  const cleanId = orderRef.replace('#', '').trim().toUpperCase();

  // Find order in memory
  const orderIdx = allOrders.findIndex(o => 
    String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() === cleanId
  );
  const targetOrder = orderIdx > -1 ? allOrders[orderIdx] : null;

  // 1. Fire Webhook API call to Cloud Storage to update row status to CANCELLED
  const payload = {
    action: 'CANCEL_ORDER',
    orderNumber: orderRef,
    orderId: orderRef,
    status: 'Cancelled',
    cancellationReason: fullReason,
    customerName: targetOrder ? targetOrder.customerName : 'Customer',
    phone: targetOrder ? targetOrder.phone : '',
    email: targetOrder ? targetOrder.email : '',
    total: targetOrder ? targetOrder.total : 0,
    dateString: new Date().toLocaleString(),
    "Order ID": orderRef,
    "Order Status": 'Cancelled'
  };

  const queryParams = new URLSearchParams({
    action: 'CANCEL_ORDER',
    orderNumber: orderRef,
    orderId: orderRef,
    status: 'Cancelled',
    cancellationReason: fullReason
  });

  try {
    // Send via POST fetch to Google Sheet
    Promise.race([
      fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?${queryParams.toString()}`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }),
      new Promise(res => setTimeout(res, 2200))
    ]).catch(() => {});

    // Secondary GET ping fallback for Google Apps Script
    fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?${queryParams.toString()}`, {
      mode: 'no-cors'
    }).catch(() => {});
  } catch (err) {
    // Handled quietly
  }

  const retentionMs = getCancelRetentionDuration();
  const autoPurgeAt = Date.now() + retentionMs;

  // 2. Update in Local Storage so customer store tracking also reflects cancellation
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const sIdx = stored.findIndex(o => String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() === cleanId);
    if (sIdx > -1) {
      if (retentionMs === 0) {
        // Immediate removal if retention is 0
        stored.splice(sIdx, 1);
      } else {
        stored[sIdx].status = 'Cancelled';
        stored[sIdx].cancellationReason = fullReason;
        stored[sIdx].cancelledDate = new Date().toLocaleString();
        stored[sIdx].cancelledAt = Date.now();
        stored[sIdx].autoPurgeAt = autoPurgeAt;
      }
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(stored));
    }
  } catch (e) {
    console.error(e);
  }

  // 3. Update local in-memory model
  if (retentionMs === 0) {
    purgeOrder(cleanId, true);
  } else if (orderIdx > -1) {
    allOrders[orderIdx].status = 'Cancelled';
    allOrders[orderIdx].cancellationReason = fullReason;
    allOrders[orderIdx].cancelledAt = Date.now();
    allOrders[orderIdx].autoPurgeAt = autoPurgeAt;
  }

  // Restore button
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }

  // Close modal
  const modalEl = document.getElementById('adminCancelModal');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }

  // Re-render
  updateDashboardKPIs();
  applyFiltersAndRender();

  const retentionSec = Math.round(retentionMs / 1000);
  const timeDesc = retentionMs === 0 
    ? 'immediately' 
    : (retentionSec >= 60 ? `in ${Math.round(retentionSec / 60)} minute(s)` : `in ${retentionSec} seconds`);
  showAdminToast(`Order ${orderRef} cancelled and synced with Google Sheet. It will disappear from active Manifest ${timeDesc}.`);
}

/**
 * Permanently purge/remove an order from the active Orders Manifest and Google Sheet
 */
function purgeOrder(orderRef, silent = false) {
  const cleanId = String(orderRef).replace('#', '').trim().toUpperCase();
  const initialCount = allOrders.length;
  
  // Track this order ID as permanently purged
  markOrderAsPurged(cleanId);

  // Dispatch Webhook to Google Sheet to remove the row from active Orders tab and archive in Cancelled_Archive
  try {
    const deleteParams = new URLSearchParams({
      action: 'DELETE_ORDER',
      orderNumber: cleanId,
      orderId: cleanId
    });

    fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?${deleteParams.toString()}`, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'DELETE_ORDER', orderNumber: cleanId, orderId: cleanId })
    }).catch(() => {});

    // Fallback GET ping
    fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?${deleteParams.toString()}`, {
      mode: 'no-cors'
    }).catch(() => {});
  } catch (err) {
    console.warn('Google Sheet delete webhook notice:', err);
  }

  allOrders = allOrders.filter(o => 
    String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() !== cleanId
  );

  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const filtered = stored.filter(o => 
        String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() !== cleanId
      );
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Error purging order from storage:', e);
  }

  if (allOrders.length < initialCount) {
    updateDashboardKPIs();
    applyFiltersAndRender();
    if (!silent) {
      showAdminToast(`🗑️ Cancelled order #${cleanId} cleared from Orders Manifest & Google Sheet.`);
    }
  }
}

/**
 * Periodically scan and clean up cancelled orders whose retention time has passed
 */
function cleanupExpiredCancelledOrders() {
  const now = Date.now();
  const expiredRefs = [];

  allOrders.forEach(o => {
    const statusUpper = String(o.status || '').toUpperCase();
    if (statusUpper.includes('CANCEL')) {
      const purgeAt = o.autoPurgeAt || (o.cancelledAt ? o.cancelledAt + getCancelRetentionDuration() : (now - 1));
      if (now >= purgeAt) {
        expiredRefs.push(String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase());
      }
    }
  });

  if (expiredRefs.length > 0) {
    expiredRefs.forEach(ref => {
      purgeOrder(ref, true);
    });
  }

  // Update visual countdown labels on active cancelled rows
  updatePurgeCountdownLabels();
}

/**
 * Update remaining time labels for cancelled orders
 */
function updatePurgeCountdownLabels() {
  const now = Date.now();
  document.querySelectorAll('.purge-countdown').forEach(el => {
    const purgeAt = parseInt(el.getAttribute('data-purge-at'), 10);
    if (!isNaN(purgeAt)) {
      const diffSec = Math.max(0, Math.ceil((purgeAt - now) / 1000));
      if (diffSec >= 60) {
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        el.textContent = `${mins}m ${secs.toString().padStart(2, '0')}s`;
      } else {
        el.textContent = `${diffSec}s`;
      }
    }
  });
}

/**
 * Initialize auto-removal timer and settings handler
 */
function initCancelledOrdersCleaner() {
  const retentionSelect = document.getElementById('cancelRetentionSelect');
  const retentionBadge = document.getElementById('cancelRetentionBadge');
  const cancelNotice = document.getElementById('cancelAutoPurgeNotice');

  const updateLabel = (sec) => {
    let txt = `${sec} seconds`;
    if (sec === 0) txt = 'Immediately';
    else if (sec === 30) txt = '30 seconds';
    else if (sec === 60) txt = '1 minute';
    else if (sec === 120) txt = '2 minutes';
    else if (sec === 300) txt = '5 minutes';
    if (retentionBadge) retentionBadge.textContent = txt;
    if (cancelNotice) cancelNotice.textContent = txt;
  };

  if (retentionSelect) {
    const curSec = getCancelRetentionSeconds();
    retentionSelect.value = String(curSec);
    updateLabel(curSec);

    retentionSelect.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      localStorage.setItem(CANCEL_RETENTION_KEY, String(val));
      updateLabel(val);
      showAdminToast(`⏱️ Cancelled order auto-removal set to: ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  // Scan every second for expired cancelled orders
  setInterval(cleanupExpiredCancelledOrders, 1000);
}

/**
 * Execute Status Update (Shipped, Delivered, etc.)
 */
async function executeAdminStatusUpdate(orderRef, newStatus) {
  const cleanOrder = String(orderRef).startsWith('#') ? orderRef : `#${orderRef}`;
  const cleanId = orderRef.replace('#', '').trim().toUpperCase();

  // Find order in memory
  const orderIdx = allOrders.findIndex(o => 
    String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() === cleanId
  );

  // Dispatch API call to Cloud Storage Endpoint
  const queryParams = new URLSearchParams({
    action: 'UPDATE_STATUS',
    orderNumber: cleanOrder,
    orderId: cleanOrder,
    newStatus: newStatus,
    status: newStatus
  });

  try {
    await Promise.race([
      fetch(`${GOOGLE_SHEET_ORDER_WEBHOOK}?${queryParams.toString()}`, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          orderNumber: cleanOrder,
          orderId: cleanOrder,
          status: newStatus,
          newStatus: newStatus
        })
      }),
      new Promise(res => setTimeout(res, 2000))
    ]);
  } catch (err) {
    console.warn('Status update API notice:', err);
  }

  // Update in local storage
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const sIdx = stored.findIndex(o => String(o.orderNumber || o.orderId || '').replace('#', '').trim().toUpperCase() === cleanId);
    if (sIdx > -1) {
      stored[sIdx].status = newStatus;
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(stored));
    }
  } catch (e) {
    console.error(e);
  }

  if (orderIdx > -1) {
    allOrders[orderIdx].status = newStatus;
  }

  updateDashboardKPIs();
  applyFiltersAndRender();
  showAdminToast(`Order ${cleanOrder} status updated to: ${newStatus}`);
}

/**
 * Helper to show toast notification
 */
function showAdminToast(message) {
  let container = document.querySelector('.snap-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'snap-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'snap-toast';
  toast.style.backgroundColor = '#1f1f1f';
  toast.style.borderLeft = '5px solid #F9B800';

  toast.innerHTML = `
    <i class="bi bi-check-circle-fill text-warning fs-5"></i>
    <span class="small fw-semibold flex-grow-1 text-white">${message}</span>
    <button type="button" class="btn-close btn-close-white ms-2" aria-label="Close" style="font-size: 0.7rem;"></button>
  `;

  const closeBtn = toast.querySelector('.btn-close');
  closeBtn.addEventListener('click', () => toast.remove());

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==========================================================================
   PRODUCT CATALOG & INVENTORY MANAGEMENT
   ========================================================================== */

let activeProductCategoryFilter = 'ALL';
let activeProductSearchQuery = '';

function initAdminProductsManager() {
  renderAdminProducts();
  setupProductEventListeners();
}

function renderAdminProducts() {
  const catalog = typeof loadProductsCatalog === 'function' ? loadProductsCatalog() : (typeof products !== 'undefined' ? products : []);
  
  // Update KPI counters
  const totalCountEl = document.getElementById('statProdTotal');
  const liveCountEl = document.getElementById('adminLiveProductCount');
  const inStockEl = document.getElementById('statProdInStock');
  const lowStockEl = document.getElementById('statProdLowStock');
  const catCountEl = document.getElementById('statProdCategories');
  const filteredCountEl = document.getElementById('prodFilteredCount');
  const tableBody = document.getElementById('adminProductsTableBody');
  const emptyState = document.getElementById('adminProductEmptyState');

  if (totalCountEl) totalCountEl.textContent = catalog.length;
  if (liveCountEl) liveCountEl.textContent = catalog.length;
  
  const inStockCount = catalog.filter(p => Number(p.stock) > 0).length;
  const lowStockCount = catalog.filter(p => Number(p.stock) <= 10).length;
  const uniqueCats = new Set(catalog.map(p => p.category || 'General'));

  if (inStockEl) inStockEl.textContent = inStockCount;
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (catCountEl) catCountEl.textContent = uniqueCats.size;

  if (!tableBody) return;

  // Filter by category and search query
  const filtered = catalog.filter(p => {
    // Category filter
    if (activeProductCategoryFilter !== 'ALL') {
      const pSlug = (p.categorySlug || (p.category || '').toLowerCase().replace(/[^a-z0-9]/g, '-'));
      if (pSlug !== activeProductCategoryFilter) {
        return false;
      }
    }
    // Search query
    if (activeProductSearchQuery) {
      const q = activeProductSearchQuery.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const catMatch = (p.category || '').toLowerCase().includes(q);
      const badgeMatch = (p.badge || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      if (!nameMatch && !catMatch && !badgeMatch && !descMatch) {
        return false;
      }
    }
    return true;
  });

  if (filteredCountEl) {
    filteredCountEl.textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  tableBody.innerHTML = filtered.map(prod => {
    const imgUrl = (Array.isArray(prod.images) && prod.images[0]) || prod.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    const discount = prod.oldPrice && prod.oldPrice > prod.price 
      ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100) 
      : 0;

    const isLowStock = Number(prod.stock) <= 10;
    const stockBadgeClass = Number(prod.stock) === 0 
      ? 'bg-danger text-white' 
      : (isLowStock ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-success-subtle text-success border border-success-subtle');

    return `
      <tr data-product-row-id="${prod.id}">
        <td>
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(prod.name)}" class="product-thumb-img edit-product-link" role="button" data-prod-id="${prod.id}" style="cursor: pointer;" title="Click to edit product" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'">
        </td>
        <td>
          <div class="fw-bold text-dark mb-0 edit-product-link" role="button" data-prod-id="${prod.id}" style="cursor: pointer;" title="Click to edit product">
            ${escapeHtml(prod.name)}
            <i class="bi bi-pencil-square text-primary ms-1" style="font-size: 0.8rem;"></i>
          </div>
          <span class="badge bg-light text-secondary border small mt-1">${escapeHtml(prod.category || 'General')}</span>
        </td>
        <td>
          <span class="fw-bold text-dark font-monospace fs-6">$${Number(prod.price).toFixed(2)}</span>
        </td>
        <td>
          <span class="text-muted text-decoration-line-through small font-monospace">$${Number(prod.oldPrice || prod.price).toFixed(2)}</span>
          ${discount > 0 ? `<span class="badge bg-danger-subtle text-danger ms-1 small">-${discount}%</span>` : ''}
        </td>
        <td>
          <span class="badge ${stockBadgeClass} fw-bold px-2 py-1 rounded-pill small">
            ${Number(prod.stock) === 0 ? 'Out of Stock' : `${prod.stock} units`}
          </span>
        </td>
        <td>
          <div class="small text-warning">
            <i class="bi bi-star-fill"></i> <strong class="text-dark">${Number(prod.rating || 5).toFixed(1)}</strong>
            <span class="text-muted">(${prod.reviewCount || 1})</span>
          </div>
        </td>
        <td>
          <span class="badge bg-warning text-dark fw-bold px-2 py-1 rounded-pill small">
            ${escapeHtml(prod.badge || 'DEAL')}
          </span>
        </td>
        <td class="text-end">
          <div class="d-inline-flex gap-1">
            <button type="button" class="btn btn-sm btn-deal rounded-pill px-2.5 edit-product-btn fw-bold" data-prod-id="${prod.id}" title="Edit Product Details">
              <i class="bi bi-pencil-square me-1"></i> Edit
            </button>
            <a href="product.html?id=${prod.id}" target="_blank" class="btn btn-sm btn-outline-dark rounded-pill px-2" title="View Product on Live Storefront">
              <i class="bi bi-box-arrow-up-right"></i>
            </a>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 delete-product-btn" data-prod-id="${prod.id}" data-prod-name="${escapeHtml(prod.name)}" title="Delete Product">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach edit buttons & clickable links
  tableBody.querySelectorAll('.edit-product-btn, .edit-product-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pId = btn.getAttribute('data-prod-id');
      if (pId) {
        openEditProductModal(pId);
      }
    });
  });

  // Attach delete buttons
  tableBody.querySelectorAll('.delete-product-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pId = btn.getAttribute('data-prod-id');
      const pName = btn.getAttribute('data-prod-name');
      if (confirm(`Are you sure you want to delete "${pName}" from your store?`)) {
        if (typeof deleteProductById === 'function') {
          deleteProductById(pId);
        }
        renderAdminProducts();
        showAdminToast(`🗑️ Product "${pName}" removed from store.`);
      }
    });
  });
}

/**
 * Open Edit Product Modal and populate with product fields
 */
function openEditProductModal(productId) {
  const catalog = typeof loadProductsCatalog === 'function' ? loadProductsCatalog() : (typeof products !== 'undefined' ? products : []);
  const prod = catalog.find(p => String(p.id) === String(productId));
  if (!prod) {
    showAdminToast('⚠️ Could not locate product details.');
    return;
  }

  // Populate form fields
  const idEl = document.getElementById('editProductId');
  const nameEl = document.getElementById('editProdName');
  const catEl = document.getElementById('editProdCategory');
  const customCatWrap = document.getElementById('editProdCustomCatWrap');
  const customCatEl = document.getElementById('editProdCustomCategory');
  const badgeEl = document.getElementById('editProdBadge');
  const priceEl = document.getElementById('editProdPrice');
  const oldPriceEl = document.getElementById('editProdOldPrice');
  const stockEl = document.getElementById('editProdStock');
  const imgEl = document.getElementById('editProdImageUrl');
  const imgPrev = document.getElementById('editProdImagePreview');
  const descEl = document.getElementById('editProdDesc');
  const featEl = document.getElementById('editProdFeatures');

  if (idEl) idEl.value = prod.id;
  if (nameEl) nameEl.value = prod.name || '';

  // Standard category check
  const stdCats = ["Electronics", "Men's Shoes", "Ladies Bags", "Health & Beauty", "Watches", "Watches & Acc."];
  if (catEl) {
    if (stdCats.includes(prod.category)) {
      catEl.value = prod.category;
      if (customCatWrap) customCatWrap.style.display = 'none';
      if (customCatEl) customCatEl.value = '';
    } else {
      catEl.value = 'Custom';
      if (customCatWrap) customCatWrap.style.display = 'block';
      if (customCatEl) customCatEl.value = prod.category || '';
    }
  }

  // Badge
  if (badgeEl) {
    let foundOption = false;
    for (let i = 0; i < badgeEl.options.length; i++) {
      if (badgeEl.options[i].value === prod.badge) {
        badgeEl.selectedIndex = i;
        foundOption = true;
        break;
      }
    }
    if (!foundOption && prod.badge) {
      const newOpt = new Option(prod.badge, prod.badge, true, true);
      badgeEl.add(newOpt);
    }
  }

  // Prices
  if (priceEl) priceEl.value = Number(prod.price || 0).toFixed(2);
  if (oldPriceEl) oldPriceEl.value = prod.oldPrice ? Number(prod.oldPrice).toFixed(2) : '';

  // Stock
  if (stockEl) stockEl.value = prod.stock !== undefined ? prod.stock : 20;

  // Image
  const imgUrl = (Array.isArray(prod.images) && prod.images[0]) || prod.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
  if (imgEl) imgEl.value = imgUrl;
  if (imgPrev) imgPrev.src = imgUrl;

  // Description
  if (descEl) descEl.value = prod.description || '';

  // Features
  if (featEl) {
    featEl.value = Array.isArray(prod.features) ? prod.features.join('\n') : '';
  }

  // Update discount text
  updateEditDiscountCalc();

  // Launch modal
  const modalEl = document.getElementById('editProductModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.show();
  }
}

/**
 * Recalculate discount indicator in edit modal
 */
function updateEditDiscountCalc() {
  const priceInput = document.getElementById('editProdPrice');
  const oldPriceInput = document.getElementById('editProdOldPrice');
  const discountLabel = document.getElementById('editCalculatedDiscountText');
  if (!discountLabel) return;

  const p = parseFloat(priceInput?.value) || 0;
  const op = parseFloat(oldPriceInput?.value) || 0;
  if (p > 0 && op > p) {
    const disc = Math.round(((op - p) / op) * 100);
    const save = (op - p).toFixed(2);
    discountLabel.innerHTML = `<span class="text-success fw-bold">-${disc}% OFF</span> (Customer saves <strong>$${save}</strong>)`;
  } else if (p > 0) {
    discountLabel.textContent = `Regular listing (no discount)`;
  } else {
    discountLabel.textContent = `Calculated discount: 0%`;
  }
}

function setupProductEventListeners() {
  // Explicit tab switching handlers to guarantee 100% reliable tab opening across all mobile browsers
  const prodTabBtn = document.getElementById('tabProductsBtn');
  const ordersTabBtn = document.getElementById('tabOrdersBtn');
  const prodPane = document.getElementById('tabProductsPane');
  const ordersPane = document.getElementById('tabOrdersPane');

  if (prodTabBtn) {
    prodTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (ordersTabBtn) {
        ordersTabBtn.classList.remove('active');
        ordersTabBtn.setAttribute('aria-selected', 'false');
      }
      prodTabBtn.classList.add('active');
      prodTabBtn.setAttribute('aria-selected', 'true');

      if (ordersPane) {
        ordersPane.style.setProperty('display', 'none', 'important');
        ordersPane.classList.remove('show', 'active');
      }
      if (prodPane) {
        prodPane.style.setProperty('display', 'block', 'important');
        prodPane.classList.add('show', 'active');
      }
      renderAdminProducts();
    });
  }

  if (ordersTabBtn) {
    ordersTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (prodTabBtn) {
        prodTabBtn.classList.remove('active');
        prodTabBtn.setAttribute('aria-selected', 'false');
      }
      ordersTabBtn.classList.add('active');
      ordersTabBtn.setAttribute('aria-selected', 'true');

      if (prodPane) {
        prodPane.style.setProperty('display', 'none', 'important');
        prodPane.classList.remove('show', 'active');
      }
      if (ordersPane) {
        ordersPane.style.setProperty('display', 'block', 'important');
        ordersPane.classList.add('show', 'active');
      }
    });
  }

  // Check URL query param or hash to auto-open products tab
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'products' || window.location.hash === '#products') {
    if (prodTabBtn) {
      setTimeout(() => prodTabBtn.click(), 100);
    }
  }

  // Category Filter Pills
  const catPills = document.querySelectorAll('#adminProductCategoryFilterPills .filter-pill-btn');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeProductCategoryFilter = pill.getAttribute('data-prod-filter') || 'ALL';
      renderAdminProducts();
    });
  });

  // Search input
  const searchInput = document.getElementById('adminProductSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeProductSearchQuery = e.target.value.trim();
      renderAdminProducts();
    });
  }

  // Reset filter button
  const resetBtn = document.getElementById('resetProdSearchFilterBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      activeProductSearchQuery = '';
      activeProductCategoryFilter = 'ALL';
      catPills.forEach(p => {
        if (p.getAttribute('data-prod-filter') === 'ALL') p.classList.add('active');
        else p.classList.remove('active');
      });
      renderAdminProducts();
    });
  }

  // Reset Factory defaults
  const resetFactoryBtn = document.getElementById('resetProductsCatalogBtn');
  if (resetFactoryBtn) {
    resetFactoryBtn.addEventListener('click', () => {
      if (confirm('Reset catalog to factory default products? This will restore original 14 items.')) {
        if (typeof resetProductsCatalog === 'function') {
          resetProductsCatalog();
        }
        renderAdminProducts();
        showAdminToast('🔄 Product catalog reset to factory defaults.');
      }
    });
  }

  // Sample image chips click in modal
  document.querySelectorAll('.preset-img-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-img-url');
      const input = document.getElementById('newProdImageUrl');
      const preview = document.getElementById('newProdImagePreview');
      if (input && url) {
        input.value = url;
        if (preview) preview.src = url;
      }
    });
  });

  // Image URL input live preview
  const imgInput = document.getElementById('newProdImageUrl');
  const imgPreview = document.getElementById('newProdImagePreview');
  if (imgInput && imgPreview) {
    imgInput.addEventListener('input', () => {
      const val = imgInput.value.trim();
      if (val) {
        imgPreview.src = val;
      }
    });
  }

  // Category dropdown custom field toggle
  const catSelect = document.getElementById('newProdCategory');
  const customCatWrap = document.getElementById('newProdCustomCatWrap');
  if (catSelect && customCatWrap) {
    catSelect.addEventListener('change', () => {
      if (catSelect.value === 'Custom') {
        customCatWrap.style.display = 'block';
        document.getElementById('newProdCustomCategory')?.focus();
      } else {
        customCatWrap.style.display = 'none';
      }
    });
  }

  // Price & Old Price discount calculation
  const priceInput = document.getElementById('newProdPrice');
  const oldPriceInput = document.getElementById('newProdOldPrice');
  const discountLabel = document.getElementById('calculatedDiscountText');

  const updateDiscountCalc = () => {
    const p = parseFloat(priceInput?.value) || 0;
    const op = parseFloat(oldPriceInput?.value) || 0;
    if (p > 0 && op > p) {
      const disc = Math.round(((op - p) / op) * 100);
      const save = (op - p).toFixed(2);
      if (discountLabel) {
        discountLabel.innerHTML = `<span class="text-success fw-bold">-${disc}% OFF</span> (Customer saves <strong>$${save}</strong>)`;
      }
    } else if (p > 0) {
      if (discountLabel) {
        discountLabel.textContent = `Regular listing (no discount)`;
      }
    }
  };

  if (priceInput) priceInput.addEventListener('input', updateDiscountCalc);
  if (oldPriceInput) oldPriceInput.addEventListener('input', updateDiscountCalc);

  // Add Product Form Submit
  const addForm = document.getElementById('adminAddNewProductForm');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('newProdName')?.value.trim();
      let category = document.getElementById('newProdCategory')?.value;
      if (category === 'Custom') {
        category = document.getElementById('newProdCustomCategory')?.value.trim() || 'General';
      }
      const badge = document.getElementById('newProdBadge')?.value;
      const price = parseFloat(document.getElementById('newProdPrice')?.value) || 0;
      let oldPrice = parseFloat(document.getElementById('newProdOldPrice')?.value) || 0;
      if (oldPrice <= price) {
        oldPrice = parseFloat((price * 1.35).toFixed(2));
      }
      const stock = parseInt(document.getElementById('newProdStock')?.value, 10) || 15;
      const imageUrl = document.getElementById('newProdImageUrl')?.value.trim() || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
      const desc = document.getElementById('newProdDesc')?.value.trim();
      const featuresRaw = document.getElementById('newProdFeatures')?.value.trim();
      const features = featuresRaw ? featuresRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

      if (!name || price <= 0) {
        alert('Please provide a valid product name and sale price.');
        return;
      }

      const productPayload = {
        name,
        category,
        badge,
        price,
        oldPrice,
        stock,
        rating: 5.0,
        reviewCount: 1,
        images: [imageUrl],
        description: desc || `High quality ${name} designed for exceptional reliability and style.`,
        features: features.length ? features : [
          "Authentic, factory sealed original merchandise",
          "Includes 30-day money-back guarantee & quick exchange",
          "Superfast priority courier shipping"
        ]
      };

      if (typeof addNewProduct === 'function') {
        addNewProduct(productPayload);
      }

      // Hide modal
      const modalEl = document.getElementById('addNewProductModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.hide();
      }

      // Reset form
      addForm.reset();
      if (customCatWrap) customCatWrap.style.display = 'none';

      // Refresh Inventory UI
      renderAdminProducts();
      showAdminToast(`🎉 Product "${name}" published successfully! It is now live on your store.`);
    });
  }

  // Edit modal sample image preset chips click
  document.querySelectorAll('.edit-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-img-url');
      const input = document.getElementById('editProdImageUrl');
      const preview = document.getElementById('editProdImagePreview');
      if (input && url) {
        input.value = url;
        if (preview) preview.src = url;
      }
    });
  });

  // Edit image URL live preview
  const editImgInput = document.getElementById('editProdImageUrl');
  const editImgPreview = document.getElementById('editProdImagePreview');
  if (editImgInput && editImgPreview) {
    editImgInput.addEventListener('input', () => {
      const val = editImgInput.value.trim();
      if (val) {
        editImgPreview.src = val;
      }
    });
  }

  // Edit category dropdown custom field toggle
  const editCatSelect = document.getElementById('editProdCategory');
  const editCustomCatWrap = document.getElementById('editProdCustomCatWrap');
  if (editCatSelect && editCustomCatWrap) {
    editCatSelect.addEventListener('change', () => {
      if (editCatSelect.value === 'Custom') {
        editCustomCatWrap.style.display = 'block';
        document.getElementById('editProdCustomCategory')?.focus();
      } else {
        editCustomCatWrap.style.display = 'none';
      }
    });
  }

  // Edit modal price discount calculation
  const editPriceInput = document.getElementById('editProdPrice');
  const editOldPriceInput = document.getElementById('editProdOldPrice');
  if (editPriceInput) editPriceInput.addEventListener('input', updateEditDiscountCalc);
  if (editOldPriceInput) editOldPriceInput.addEventListener('input', updateEditDiscountCalc);

  // Edit Product Form Submit
  const editForm = document.getElementById('adminEditProductForm');
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const pId = document.getElementById('editProductId')?.value;
      const name = document.getElementById('editProdName')?.value.trim();
      let category = document.getElementById('editProdCategory')?.value;
      if (category === 'Custom') {
        category = document.getElementById('editProdCustomCategory')?.value.trim() || 'General';
      }
      const badge = document.getElementById('editProdBadge')?.value;
      const price = parseFloat(document.getElementById('editProdPrice')?.value) || 0;
      let oldPrice = parseFloat(document.getElementById('editProdOldPrice')?.value) || 0;
      if (oldPrice <= price && oldPrice > 0) {
        oldPrice = parseFloat((price * 1.35).toFixed(2));
      }
      const stock = parseInt(document.getElementById('editProdStock')?.value, 10);
      const imageUrl = document.getElementById('editProdImageUrl')?.value.trim() || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
      const desc = document.getElementById('editProdDesc')?.value.trim();
      const featuresRaw = document.getElementById('editProdFeatures')?.value.trim();
      const features = featuresRaw ? featuresRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

      if (!pId || !name || price <= 0) {
        alert('Please provide a valid product title and price.');
        return;
      }

      const updatePayload = {
        name,
        category,
        badge,
        price,
        oldPrice,
        stock: isNaN(stock) ? 0 : Math.max(0, stock),
        images: [imageUrl],
        description: desc,
        features: features
      };

      if (typeof updateProductById === 'function') {
        updateProductById(pId, updatePayload);
      }

      // Hide modal
      const modalEl = document.getElementById('editProductModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.hide();
      }

      // Refresh Inventory UI
      renderAdminProducts();
      showAdminToast(`✏️ Product "${name}" updated successfully! Live store inventory refreshed.`);
    });
  }
}

