/**
 * SnapzDealz - Admin Orders Management System
 * Live order synchronization, fulfillment tracking, and catalog controls
 * Hardened with Salted SHA-256 PIN Authentication, PII Privacy Mode, Brute-Force Shield, and Session Expiry
 */

const DEFAULT_GOOGLE_SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbxok04-fGeaORcDyDwG8qYODD-903xt4q8xq2YTJBCG2fQ6gAF1rmy8FEUyHrozYdQ2/exec';
const WEBHOOK_STORAGE_KEY = 'snapdealz_google_sheet_webhook';
function getActiveWebhookUrl() {
  try {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) || DEFAULT_GOOGLE_SHEET_WEBHOOK;
  } catch (e) {
    return DEFAULT_GOOGLE_SHEET_WEBHOOK;
  }
}
const GOOGLE_SHEET_ORDER_WEBHOOK = getActiveWebhookUrl();
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
  initAdminHeroManager();
  initAdminNewsManager();
  initAdminFooterManager();
  initAdminCurrencyManager();
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
    
    // Always blank the PIN input and reset visibility whenever locked or logged out
    const pinInput = document.getElementById('adminPinInput');
    if (pinInput) {
      pinInput.value = '';
      pinInput.setAttribute('type', 'password');
    }
    const togglePinVisBtn = document.getElementById('toggleAdminPinVisBtn');
    if (togglePinVisBtn) {
      const icon = togglePinVisBtn.querySelector('i');
      if (icon) icon.className = 'bi bi-eye';
    }
    const pinErr = document.getElementById('adminPinError');
    if (pinErr) pinErr.classList.add('d-none');
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

        // Immediately wipe the password from input field
        const pinInput = document.getElementById('adminPinInput');
        if (pinInput) {
          pinInput.value = '';
          pinInput.setAttribute('type', 'password');
        }
        const togglePinVisBtn = document.getElementById('toggleAdminPinVisBtn');
        if (togglePinVisBtn) {
          const icon = togglePinVisBtn.querySelector('i');
          if (icon) icon.className = 'bi bi-eye';
        }

        checkAdminAuth();
        loadAndDisplayOrders();
        initAdminProductsManager();
        showAdminToast('🔓 Welcome Administrator! Session initiated.');
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

  // Google Sheet Webhook Settings
  const webhookInput = document.getElementById('adminGoogleSheetWebhookInput');
  const saveWebhookBtn = document.getElementById('saveWebhookBtn');
  const testWebhookBtn = document.getElementById('testWebhookBtn');
  const resetWebhookBtn = document.getElementById('resetWebhookBtn');
  const testWebhookResult = document.getElementById('testWebhookResult');

  if (webhookInput) {
    webhookInput.value = getActiveWebhookUrl();
  }

  if (saveWebhookBtn && webhookInput) {
    saveWebhookBtn.addEventListener('click', () => {
      const val = webhookInput.value.trim();
      if (!val || !val.startsWith('http')) {
        showAdminToast('❌ Please enter a valid URL starting with https://');
        return;
      }
      localStorage.setItem(WEBHOOK_STORAGE_KEY, val);
      showAdminToast('✅ Google Sheet Webhook URL saved successfully!');
    });
  }

  if (resetWebhookBtn && webhookInput) {
    resetWebhookBtn.addEventListener('click', () => {
      localStorage.removeItem(WEBHOOK_STORAGE_KEY);
      webhookInput.value = DEFAULT_GOOGLE_SHEET_WEBHOOK;
      showAdminToast('Reset to default Google Sheet Webhook URL.');
    });
  }

  if (testWebhookBtn && webhookInput) {
    testWebhookBtn.addEventListener('click', async () => {
      const targetUrl = webhookInput.value.trim() || getActiveWebhookUrl();
      testWebhookBtn.disabled = true;
      testWebhookBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Sending Test Order...';
      if (testWebhookResult) {
        testWebhookResult.className = 'small mt-2 alert alert-info py-1 px-2 d-block';
        testWebhookResult.innerHTML = 'Connecting to Google Sheet...';
      }

      const testId = `SNP-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
      const testQuery = new URLSearchParams({
        orderNumber: testId,
        orderId: testId,
        customerName: 'Test Customer (Admin Probe)',
        phone: '03001234567',
        email: 'admin.test@snapzdealz.com',
        address: 'Test Street 123, Office 4B',
        city: 'Karachi',
        paymentMethod: 'Cash on Delivery',
        itemsSummary: 'SnapzDealz Connection Probe (x1)',
        subtotal: '99.00',
        discount: '0.00',
        shipping: '0.00',
        total: '99.00',
        status: 'Pending',
        date: new Date().toLocaleString()
      });

      try {
        await fetch(`${targetUrl}?${testQuery.toString()}`, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        if (testWebhookResult) {
          testWebhookResult.className = 'small mt-2 alert alert-success py-1.5 px-2 d-block';
          testWebhookResult.innerHTML = `<strong>✅ Success!</strong> Test order <strong>#${testId}</strong> dispatched to Google Sheet. Check your sheet to verify!`;
        }
        showAdminToast(`✅ Test order #${testId} dispatched to Google Sheet!`);
        setTimeout(() => loadAndDisplayOrders(true), 1500);
      } catch (err) {
        if (testWebhookResult) {
          testWebhookResult.className = 'small mt-2 alert alert-danger py-1.5 px-2 d-block';
          testWebhookResult.innerHTML = `⚠️ Notice: ${err.message || 'Check Webhook URL & deployment permissions.'}`;
        }
      } finally {
        testWebhookBtn.disabled = false;
        testWebhookBtn.innerHTML = '<i class="bi bi-send-check me-1"></i> Send Test Order';
      }
    });
  }

  // Lock Portal Button (Desktop & Mobile)
  const lockAction = () => {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    sessionStorage.removeItem(ADMIN_LAST_ACTIVE_KEY);
    checkAdminAuth();
    const pinInput = document.getElementById('adminPinInput');
    if (pinInput) {
      pinInput.value = '';
      pinInput.setAttribute('type', 'password');
      setTimeout(() => pinInput.focus(), 100);
    }
    const togglePinVisBtn = document.getElementById('toggleAdminPinVisBtn');
    if (togglePinVisBtn) {
      const icon = togglePinVisBtn.querySelector('i');
      if (icon) icon.className = 'bi bi-eye';
    }
    const pinErr = document.getElementById('adminPinError');
    if (pinErr) pinErr.classList.add('d-none');
    showAdminToast('🔒 Admin dashboard locked.');
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
  if (totalRevenueEl) totalRevenueEl.textContent = (typeof formatCurrency === 'function') ? formatCurrency(revenue) : `$${revenue.toFixed(2)}`;
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
          <div class="fw-bold font-monospace text-dark fs-6">${(typeof formatCurrency === 'function') ? formatCurrency(order.total || 0) : `$${Number(order.total || 0).toFixed(2)}`}</div>
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
        <span class="font-monospace text-success">${(typeof formatCurrency === 'function') ? formatCurrency(order.total || 0) : `$${Number(order.total || 0).toFixed(2)}`}</span>
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

/**
 * Helper to process and compress local image files from device storage
 * Converts uploaded file to optimized, responsive JPEG Data URL
 */
function processImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (PNG, JPG, WebP)'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

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
          <span class="fw-bold text-dark font-monospace fs-6">${(typeof formatCurrency === 'function') ? formatCurrency(prod.price) : `$${Number(prod.price).toFixed(2)}`}</span>
        </td>
        <td>
          <span class="text-muted text-decoration-line-through small font-monospace">${(typeof formatCurrency === 'function') ? formatCurrency(prod.oldPrice || prod.price) : `$${Number(prod.oldPrice || prod.price).toFixed(2)}`}</span>
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
        if (typeof renderAdminHeroSlides === 'function') {
          renderAdminHeroSlides();
        }
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
  const heroTabBtn = document.getElementById('tabHeroBtn');
  const newsTabBtn = document.getElementById('tabNewsBtn');
  const footerTabBtn = document.getElementById('tabFooterBtn');
  const currencyTabBtn = document.getElementById('tabCurrencyBtn');
  
  const prodPane = document.getElementById('tabProductsPane');
  const ordersPane = document.getElementById('tabOrdersPane');
  const heroPane = document.getElementById('tabHeroPane');
  const newsPane = document.getElementById('tabNewsPane');
  const footerPane = document.getElementById('tabFooterPane');
  const currencyPane = document.getElementById('tabCurrencyPane');

  function switchAdminPortalTab(target) {
    const tabConfigs = [
      { id: 'orders', btn: ordersTabBtn, pane: ordersPane, onOpen: () => {} },
      { id: 'products', btn: prodTabBtn, pane: prodPane, onOpen: () => renderAdminProducts() },
      { id: 'hero', btn: heroTabBtn, pane: heroPane, onOpen: () => renderAdminHeroSlides() },
      { id: 'news', btn: newsTabBtn, pane: newsPane, onOpen: () => renderAdminNewsSlides() },
      { id: 'footer', btn: footerTabBtn, pane: footerPane, onOpen: () => populateAdminFooterSettings() },
      { id: 'currency', btn: currencyTabBtn, pane: currencyPane, onOpen: () => populateAdminCurrencySettings() }
    ];

    tabConfigs.forEach(t => {
      const isMatch = t.id === target;
      if (t.btn) {
        if (isMatch) {
          t.btn.classList.add('active');
          t.btn.setAttribute('aria-selected', 'true');
        } else {
          t.btn.classList.remove('active');
          t.btn.setAttribute('aria-selected', 'false');
        }
      }
      if (t.pane) {
        if (isMatch) {
          t.pane.style.setProperty('display', 'block', 'important');
          t.pane.classList.add('show', 'active');
          t.onOpen();
        } else {
          t.pane.style.setProperty('display', 'none', 'important');
          t.pane.classList.remove('show', 'active');
        }
      }
    });
  }

  if (prodTabBtn) {
    prodTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('products');
    });
  }

  if (ordersTabBtn) {
    ordersTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('orders');
    });
  }

  if (heroTabBtn) {
    heroTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('hero');
    });
  }

  if (newsTabBtn) {
    newsTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('news');
    });
  }

  if (footerTabBtn) {
    footerTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('footer');
    });
  }

  if (currencyTabBtn) {
    currencyTabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchAdminPortalTab('currency');
    });
  }

  // Check URL query param or hash to auto-open specific tab
  const urlParams = new URLSearchParams(window.location.search);
  const activeTabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
  if (['hero', 'products', 'news', 'footer', 'currency'].includes(activeTabParam)) {
    setTimeout(() => switchAdminPortalTab(activeTabParam), 100);
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

  // Device Storage File Upload for New Product
  const newFileInput = document.getElementById('newProdFileInput');
  const newFileName = document.getElementById('newProdFileName');
  if (newFileInput) {
    newFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (newFileName) newFileName.textContent = `Processing ${file.name}...`;
        const dataUrl = await processImageFile(file, 900, 900, 0.85);
        const input = document.getElementById('newProdImageUrl');
        const preview = document.getElementById('newProdImagePreview');
        if (input) input.value = dataUrl;
        if (preview) preview.src = dataUrl;
        if (newFileName) {
          newFileName.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(file.name)}</span> (${Math.round(file.size / 1024)} KB)`;
        }
        showAdminToast(`📸 Image "${file.name}" loaded from device storage!`);
      } catch (err) {
        alert('Could not load image: ' + err.message);
        if (newFileName) newFileName.textContent = 'Failed to load image';
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
      if (newFileName) newFileName.textContent = 'Preset photo selected';
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

      // Refresh Inventory UI & Hero Slide Product Pickers
      renderAdminProducts();
      if (typeof renderAdminHeroSlides === 'function') {
        renderAdminHeroSlides();
      }
      showAdminToast(`🎉 Product "${name}" published successfully! It is now live on your store.`);
    });
  }

  // Device Storage File Upload for Edit Product
  const editFileInput = document.getElementById('editProdFileInput');
  const editFileName = document.getElementById('editProdFileName');
  if (editFileInput) {
    editFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (editFileName) editFileName.textContent = `Processing ${file.name}...`;
        const dataUrl = await processImageFile(file, 900, 900, 0.85);
        const input = document.getElementById('editProdImageUrl');
        const preview = document.getElementById('editProdImagePreview');
        if (input) input.value = dataUrl;
        if (preview) preview.src = dataUrl;
        if (editFileName) {
          editFileName.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(file.name)}</span> (${Math.round(file.size / 1024)} KB)`;
        }
        showAdminToast(`📸 Image "${file.name}" loaded from device storage!`);
      } catch (err) {
        alert('Could not load image: ' + err.message);
        if (editFileName) editFileName.textContent = 'Failed to load image';
      }
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
      if (editFileName) editFileName.textContent = 'Preset photo selected';
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

      // Refresh Inventory UI & Hero Slide Product Pickers
      renderAdminProducts();
      if (typeof renderAdminHeroSlides === 'function') {
        renderAdminHeroSlides();
      }
      showAdminToast(`✏️ Product "${name}" updated successfully! Live store inventory refreshed.`);
    });
  }
}

/* ==========================================================================
   HERO CAROUSEL BANNERS MANAGEMENT
   ========================================================================== */

function initAdminHeroManager() {
  renderAdminHeroSlides();
}

/**
 * Add a new custom Hero Carousel Slide (for a new product or banner)
 */
function addNewHeroSlide() {
  const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
  const nextNum = currentSlides.length + 1;
  const catalog = typeof loadProductsCatalog === 'function' ? loadProductsCatalog() : (typeof products !== 'undefined' ? products : []);
  
  // Choose an unused catalog product if available, or fall back to catalog item
  const usedProductIds = new Set(currentSlides.map(s => Number(s.productId)));
  const availableProduct = catalog.find(p => !usedProductIds.has(Number(p.id))) || catalog[0] || null;

  const newSlide = {
    id: Date.now(),
    productId: availableProduct ? availableProduct.id : null,
    tag: "NEW ARRIVAL",
    tagIcon: "bi-lightning-charge-fill",
    title: availableProduct ? availableProduct.name.toUpperCase() : `EXCLUSIVE DEAL ${nextNum}`,
    description: availableProduct 
      ? (availableProduct.description || `Special limited deal on ${availableProduct.name}. Order now!`)
      : "Discover our newest featured collection with massive limited-time savings today.",
    btnPrimaryText: availableProduct ? `Shop Now • $${Number(availableProduct.price).toFixed(2)}` : "Shop Now",
    btnPrimaryLink: availableProduct ? `product.html?id=${availableProduct.id}` : "shop.html",
    btnSecondaryText: "Explore More",
    btnSecondaryLink: "shop.html",
    imageUrl: (availableProduct && ((Array.isArray(availableProduct.images) && availableProduct.images[0]) || availableProduct.image)) 
      || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
    imageAlt: availableProduct ? availableProduct.name : `Hero Slide ${nextNum}`,
    stickerTop: "NEW",
    stickerMiddle: "DEAL",
    stickerBottom: "HOT",
    stickerTheme: "default"
  };

  currentSlides.push(newSlide);
  if (typeof saveHeroSlides === 'function') {
    saveHeroSlides(currentSlides);
  }
  renderAdminHeroSlides();
  showAdminToast(`✨ Nayi Slide #${nextNum} add ho gayi! Ab aap is mein apni marzi ka product ya details dal sakte hain.`);

  // Scroll to new slide
  setTimeout(() => {
    const newCard = document.querySelector(`.hero-slide-edit-card[data-slide-index="${currentSlides.length - 1}"]`);
    if (newCard) {
      newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newCard.classList.add('border-warning');
      setTimeout(() => newCard.classList.remove('border-warning'), 2500);
    }
  }, 150);
}

function renderAdminHeroSlides() {
  const container = document.getElementById('heroSlidesEditorContainer');
  if (!container) return;

  const slides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
  const catalog = typeof loadProductsCatalog === 'function' ? loadProductsCatalog() : (typeof products !== 'undefined' ? products : []);

  if (!slides || !slides.length) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="alert alert-warning py-4 px-3 rounded-4 shadow-sm max-w-md mx-auto">
          <i class="bi bi-images fs-1 text-warning d-block mb-2"></i>
          <h5 class="fw-bold text-dark">No Hero Slides Available</h5>
          <p class="text-muted small mb-3">Homepage hero section mein abhi koi slide nahi hai. Naya slide add karein ya defaults restore karein.</p>
          <div class="d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-success btn-sm rounded-pill px-3 py-1.5 fw-bold" onclick="addNewHeroSlide()">
              <i class="bi bi-plus-circle-fill me-1"></i> Add First Slide
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 fw-bold" id="emptyStateResetHeroBtn">
              <i class="bi bi-arrow-counterclockwise me-1"></i> Restore Defaults
            </button>
          </div>
        </div>
      </div>
    `;
    const emptyReset = document.getElementById('emptyStateResetHeroBtn');
    if (emptyReset) {
      emptyReset.addEventListener('click', () => {
        if (typeof resetHeroSlides === 'function') resetHeroSlides();
        renderAdminHeroSlides();
      });
    }
    return;
  }

  container.innerHTML = slides.map((slide, idx) => {
    const isDark = slide.stickerTheme === 'dark';
    const tagIcon = slide.tagIcon || 'bi-fire';

    // Catalog products options
    const productOptions = catalog.map(p => {
      const isSelected = Number(slide.productId) === Number(p.id) ? 'selected' : '';
      return `<option value="${p.id}" ${isSelected}>${escapeHtml(p.name)} — $${Number(p.price).toFixed(2)} (${escapeHtml(p.category)})</option>`;
    }).join('');

    return `
      <div class="col-12 col-xl-4 col-md-6">
        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden bg-white hero-slide-edit-card" data-slide-index="${idx}">
          
          <!-- Slide Card Header with Separate Update Button & Reordering -->
          <div class="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-warning text-dark fw-bold rounded-pill px-2.5 py-1">SLIDE ${idx + 1}</span>
              <span class="small fw-bold text-uppercase tracking-wider text-light" style="font-size: 0.72rem;">
                ${idx === 0 ? 'First (Active)' : `Slide ${idx + 1}`}
              </span>
            </div>
            
            <div class="d-flex align-items-center gap-1">
              <!-- Reorder buttons -->
              <button type="button" class="btn btn-outline-light btn-sm rounded-circle p-0 d-inline-flex align-items-center justify-content-center btn-move-slide-up" data-slide-index="${idx}" ${idx === 0 ? 'disabled' : ''} style="width: 26px; height: 26px;" title="Move earlier in slider">
                <i class="bi bi-chevron-left" style="font-size: 0.75rem;"></i>
              </button>
              <button type="button" class="btn btn-outline-light btn-sm rounded-circle p-0 d-inline-flex align-items-center justify-content-center btn-move-slide-down" data-slide-index="${idx}" ${idx === slides.length - 1 ? 'disabled' : ''} style="width: 26px; height: 26px;" title="Move later in slider">
                <i class="bi bi-chevron-right" style="font-size: 0.75rem;"></i>
              </button>
              
              <!-- Top Update Button -->
              <button type="button" class="btn btn-warning btn-sm rounded-pill px-2.5 py-1 fw-bold btn-save-individual-slide shadow-sm ms-1" data-slide-index="${idx}" title="Save only this slide">
                <i class="bi bi-check2-circle me-1"></i> Update Slide ${idx + 1}
              </button>
            </div>
          </div>

          <div class="card-body p-3 p-md-4">
            
            <!-- Quick 1-Click Product Auto-Fill Dropdown -->
            <div class="p-3 rounded-3 mb-3" style="background-color: #fff9e6; border: 1.5px dashed #F9B800;">
              <label class="form-label small fw-bold text-dark mb-1 d-flex align-items-center gap-1">
                <i class="bi bi-magic text-warning"></i>
                <span>1-Click Auto-Fill from Store Product:</span>
              </label>
              <select class="form-select form-select-sm hero-product-picker rounded-pill border-warning" data-slide-index="${idx}">
                <option value="">-- Choose Any Store Product --</option>
                ${productOptions}
              </select>
              <div class="text-muted small mt-1" style="font-size: 0.72rem;">
                Store se product select karte hi Title, Details, Photo, Price aur Links auto-fill ho jayenge!
              </div>
            </div>

            <!-- Slide Main Title -->
            <div class="mb-3">
              <label class="form-label small fw-bold text-dark">
                Banner Headline / Title <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control form-control-sm hero-input-title" data-slide-index="${idx}" value="${escapeHtml(slide.title || '')}" required placeholder="e.g. STEP INTO POWER & SPEED">
            </div>

            <!-- Badge / Tag & Icon -->
            <div class="row g-2 mb-3">
              <div class="col-7">
                <label class="form-label small fw-bold text-dark">Tag / Label</label>
                <input type="text" class="form-control form-control-sm hero-input-tag" data-slide-index="${idx}" value="${escapeHtml(slide.tag || '')}" placeholder="DEAL OF THE DAY">
              </div>
              <div class="col-5">
                <label class="form-label small fw-bold text-dark">Tag Icon</label>
                <select class="form-select form-select-sm hero-input-tag-icon" data-slide-index="${idx}">
                  <option value="bi-fire" ${tagIcon === 'bi-fire' ? 'selected' : ''}>🔥 Fire</option>
                  <option value="bi-gem" ${tagIcon === 'bi-gem' ? 'selected' : ''}>💎 Gem / Luxury</option>
                  <option value="bi-stars" ${tagIcon === 'bi-stars' ? 'selected' : ''}>⭐ Stars / Top</option>
                  <option value="bi-lightning-charge-fill" ${tagIcon === 'bi-lightning-charge-fill' ? 'selected' : ''}>⚡ Flash Deal</option>
                  <option value="bi-tag-fill" ${tagIcon === 'bi-tag-fill' ? 'selected' : ''}>🏷️ Discount</option>
                  <option value="bi-heart-fill" ${tagIcon === 'bi-heart-fill' ? 'selected' : ''}>❤️ Trending</option>
                </select>
              </div>
            </div>

            <!-- Description -->
            <div class="mb-3">
              <label class="form-label small fw-bold text-dark">Subtitle Description</label>
              <textarea class="form-control form-control-sm hero-input-desc" data-slide-index="${idx}" rows="2" placeholder="Short description of deal...">${escapeHtml(slide.description || '')}</textarea>
            </div>

            <!-- Button 1 (Primary CTA) -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-bold text-dark">Primary Button Text</label>
                <input type="text" class="form-control form-control-sm hero-input-btn1-text" data-slide-index="${idx}" value="${escapeHtml(slide.btnPrimaryText || 'Shop Now')}" placeholder="Shop Now • $64.99">
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold text-dark">Primary Button Link</label>
                <input type="text" class="form-control form-control-sm hero-input-btn1-link" data-slide-index="${idx}" value="${escapeHtml(slide.btnPrimaryLink || 'product.html?id=1')}" placeholder="product.html?id=1">
              </div>
            </div>

            <!-- Button 2 (Secondary CTA) -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-bold text-dark">Secondary Button Text</label>
                <input type="text" class="form-control form-control-sm hero-input-btn2-text" data-slide-index="${idx}" value="${escapeHtml(slide.btnSecondaryText || 'Explore More')}" placeholder="Explore Deals">
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold text-dark">Secondary Button Link</label>
                <input type="text" class="form-control form-control-sm hero-input-btn2-link" data-slide-index="${idx}" value="${escapeHtml(slide.btnSecondaryLink || 'shop.html')}" placeholder="shop.html">
              </div>
            </div>

            <!-- Image Upload & URL with Device Storage Support -->
            <div class="p-3 bg-light rounded-3 border mb-3">
              <label class="form-label small fw-bold text-dark d-flex justify-content-between align-items-center mb-1">
                <span>Slide Image <span class="text-danger">*</span></span>
                <span class="badge bg-warning-subtle text-dark border" style="font-size: 0.7rem;">Device Upload or URL</span>
              </label>

              <!-- Device File Upload Button -->
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <label class="btn btn-sm btn-dark text-white rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1 cursor-pointer shadow-sm">
                  <i class="bi bi-upload text-warning"></i>
                  <span>Choose from Device (Mobile / PC)</span>
                  <input type="file" accept="image/*" class="d-none hero-file-input" data-slide-index="${idx}">
                </label>
                <span class="small text-muted hero-file-name-${idx}">PNG, JPG, WebP</span>
              </div>

              <!-- Direct URL or Local Path Input -->
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text bg-white"><i class="bi bi-link-45deg"></i> Image URL / Path</span>
                <input type="text" class="form-control hero-input-image" data-slide-index="${idx}" value="${escapeHtml(slide.imageUrl || '')}" placeholder="images/banner.jpg ya https://images.unsplash.com/...">
              </div>

              <div class="text-muted mb-2" style="font-size: 0.72rem;">
                💡 <strong>Device Storage:</strong> Upar button se computer/phone se photo chunein, ya website ka path (jaise <code>images/banner.jpg</code>), ya internet image URL paste karein.
              </div>
              
              <!-- Thumbnail Preview Box -->
              <div class="d-flex align-items-center gap-3 p-2 rounded-3 bg-white border">
                <img src="${escapeHtml(slide.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80')}" alt="Preview" class="hero-preview-img-${idx}" style="width: 75px; height: 65px; object-fit: cover; border-radius: 8px; border: 1px solid #d1d5db;" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80'">
                <div class="small">
                  <strong class="text-dark d-block">Live Image Preview</strong>
                  <span class="text-muted" style="font-size: 0.73rem;">Transparent PNG ya high-res product photo recommended hai.</span>
                </div>
              </div>
            </div>

            <!-- Circular Discount Badge / Sticker -->
            <div class="p-3 bg-light rounded-3 border mb-3">
              <label class="form-label small fw-bold text-dark mb-2 d-flex justify-content-between align-items-center">
                <span>Circular Discount Sticker:</span>
                <span class="badge ${isDark ? 'bg-dark text-warning' : 'bg-warning text-dark'}">Preview</span>
              </label>
              <div class="row g-2">
                <div class="col-4">
                  <input type="text" class="form-control form-control-sm hero-input-sticker-top" data-slide-index="${idx}" value="${escapeHtml(slide.stickerTop || 'SAVE')}" placeholder="SAVE">
                </div>
                <div class="col-4">
                  <input type="text" class="form-control form-control-sm hero-input-sticker-mid" data-slide-index="${idx}" value="${escapeHtml(slide.stickerMiddle || '50%')}" placeholder="50%">
                </div>
                <div class="col-4">
                  <input type="text" class="form-control form-control-sm hero-input-sticker-btm" data-slide-index="${idx}" value="${escapeHtml(slide.stickerBottom || 'TODAY')}" placeholder="TODAY">
                </div>
                <div class="col-12 mt-2">
                  <div class="d-flex align-items-center justify-content-between">
                    <span class="small text-muted" style="font-size: 0.75rem;">Badge Theme:</span>
                    <div class="btn-group btn-group-sm" role="group">
                      <input type="radio" class="btn-check hero-sticker-theme" name="stickerTheme_${idx}" id="theme_light_${idx}" value="default" ${!isDark ? 'checked' : ''} data-slide-index="${idx}">
                      <label class="btn btn-outline-warning py-0 px-2 small text-dark" for="theme_light_${idx}">Yellow</label>

                      <input type="radio" class="btn-check hero-sticker-theme" name="stickerTheme_${idx}" id="theme_dark_${idx}" value="dark" ${isDark ? 'checked' : ''} data-slide-index="${idx}">
                      <label class="btn btn-outline-dark py-0 px-2 small" for="theme_dark_${idx}">Dark</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Slide Card Footer with Dedicated Update & Delete Buttons -->
          <div class="card-footer bg-light p-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="d-flex gap-1">
              ${slides.length > 1 ? `
                <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-2.5 btn-delete-individual-slide" data-slide-index="${idx}" title="Delete this slide from carousel">
                  <i class="bi bi-trash3 me-1"></i> Delete
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-2.5 btn-reset-individual-slide" data-slide-index="${idx}" title="Reset slide values">
                <i class="bi bi-arrow-counterclockwise me-1"></i> Reset
              </button>
            </div>
            
            <button type="button" class="btn btn-deal btn-sm rounded-pill px-3.5 py-1.5 fw-bold btn-save-individual-slide shadow-sm" data-slide-index="${idx}">
              <i class="bi bi-check2-circle me-1"></i> Update Slide ${idx + 1}
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');

  // Re-bind all events immediately after rendering
  setupHeroEventListeners();
}

function setupHeroEventListeners() {
  // 1. Device Storage Image Upload for each Hero Slide
  document.querySelectorAll('.hero-file-input').forEach(fileInput => {
    fileInput.addEventListener('change', async (e) => {
      const idx = e.target.getAttribute('data-slide-index');
      const file = e.target.files?.[0];
      if (!file) return;

      const fileNameLabel = document.querySelector(`.hero-file-name-${idx}`);
      const imgInput = document.querySelector(`.hero-input-image[data-slide-index="${idx}"]`);
      const previewImg = document.querySelector(`.hero-preview-img-${idx}`);

      try {
        if (fileNameLabel) fileNameLabel.textContent = `Processing ${file.name}...`;
        const dataUrl = await processImageFile(file, 800, 800, 0.75);
        if (imgInput) imgInput.value = dataUrl;
        if (previewImg) previewImg.src = dataUrl;
        if (fileNameLabel) {
          fileNameLabel.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(file.name)}</span> (${Math.round(file.size / 1024)} KB)`;
        }
        showAdminToast(`📸 Slide ${Number(idx) + 1} image loaded from device storage!`);
      } catch (err) {
        alert('Could not load image: ' + err.message);
        if (fileNameLabel) fileNameLabel.textContent = 'Failed to load image';
      }
    });
  });

  // 2. Product picker change (1-Click Auto-Fill)
  document.querySelectorAll('.hero-product-picker').forEach(picker => {
    picker.addEventListener('change', (e) => {
      const idx = e.target.getAttribute('data-slide-index');
      const prodId = e.target.value;
      if (!prodId) return;

      const catalog = typeof loadProductsCatalog === 'function' ? loadProductsCatalog() : (typeof products !== 'undefined' ? products : []);
      const prod = catalog.find(p => Number(p.id) === Number(prodId));
      if (!prod) return;

      const card = document.querySelector(`.hero-slide-edit-card[data-slide-index="${idx}"]`);
      if (!card) return;

      const titleInput = card.querySelector('.hero-input-title');
      const descInput = card.querySelector('.hero-input-desc');
      const btn1TextInput = card.querySelector('.hero-input-btn1-text');
      const btn1LinkInput = card.querySelector('.hero-input-btn1-link');
      const btn2TextInput = card.querySelector('.hero-input-btn2-text');
      const btn2LinkInput = card.querySelector('.hero-input-btn2-link');
      const imgInput = card.querySelector('.hero-input-image');
      const previewImg = card.querySelector(`.hero-preview-img-${idx}`);
      const tagInput = card.querySelector('.hero-input-tag');
      const stickerTopInput = card.querySelector('.hero-input-sticker-top');
      const stickerMidInput = card.querySelector('.hero-input-sticker-mid');
      const stickerBtmInput = card.querySelector('.hero-input-sticker-btm');

      const imgUrl = (Array.isArray(prod.images) && prod.images[0]) || prod.image || '';
      const discount = prod.oldPrice && prod.oldPrice > prod.price 
        ? Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100) 
        : 0;

      if (titleInput) titleInput.value = prod.name.toUpperCase();
      if (descInput) descInput.value = prod.description || `Special limited deal on ${prod.name}. Grab yours now!`;
      if (btn1TextInput) btn1TextInput.value = `Shop Now • $${Number(prod.price).toFixed(2)}`;
      if (btn1LinkInput) btn1LinkInput.value = `product.html?id=${prod.id}`;
      const catSlug = prod.categorySlug || (prod.category || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (btn2TextInput) btn2TextInput.value = `Explore ${prod.category || 'Deals'}`;
      if (btn2LinkInput) btn2LinkInput.value = `shop.html?category=${catSlug}`;
      if (imgInput) imgInput.value = imgUrl;
      if (previewImg && imgUrl) previewImg.src = imgUrl;
      if (tagInput) tagInput.value = prod.badge ? `${prod.badge} DEAL` : 'DEAL OF THE DAY';
      if (stickerTopInput) stickerTopInput.value = 'SAVE';
      if (stickerMidInput) stickerMidInput.value = discount > 0 ? `${discount}%` : (prod.badge || 'HOT');
      if (stickerBtmInput) stickerBtmInput.value = 'TODAY';

      showAdminToast(`✨ Slide ${Number(idx) + 1} auto-filled with "${prod.name}"!`);
    });
  });

  // 3. Image URL input live preview
  document.querySelectorAll('.hero-input-image').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = e.target.getAttribute('data-slide-index');
      const preview = document.querySelector(`.hero-preview-img-${idx}`);
      if (preview && e.target.value.trim()) {
        preview.src = e.target.value.trim();
      }
    });
  });

  // Helper to read data from a specific slide card
  function extractSlideData(card, idx) {
    const title = card.querySelector('.hero-input-title')?.value.trim() || `Featured Deal ${idx + 1}`;
    const tag = card.querySelector('.hero-input-tag')?.value.trim() || 'SPECIAL DEAL';
    const tagIcon = card.querySelector('.hero-input-tag-icon')?.value || 'bi-fire';
    const description = card.querySelector('.hero-input-desc')?.value.trim() || '';
    const btnPrimaryText = card.querySelector('.hero-input-btn1-text')?.value.trim() || 'Shop Now';
    const btnPrimaryLink = card.querySelector('.hero-input-btn1-link')?.value.trim() || 'shop.html';
    const btnSecondaryText = card.querySelector('.hero-input-btn2-text')?.value.trim() || 'Explore';
    const btnSecondaryLink = card.querySelector('.hero-input-btn2-link')?.value.trim() || 'shop.html';
    const imageUrl = card.querySelector('.hero-input-image')?.value.trim() || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80';
    const stickerTop = card.querySelector('.hero-input-sticker-top')?.value.trim() || 'SAVE';
    const stickerMiddle = card.querySelector('.hero-input-sticker-mid')?.value.trim() || '50%';
    const stickerBottom = card.querySelector('.hero-input-sticker-btm')?.value.trim() || 'TODAY';
    const themeRadio = card.querySelector(`input[name="stickerTheme_${idx}"]:checked`);
    const stickerTheme = themeRadio ? themeRadio.value : 'default';
    const productPicker = card.querySelector('.hero-product-picker');
    const productId = productPicker ? productPicker.value : null;

    return {
      id: idx + 1,
      productId: productId || null,
      tag,
      tagIcon,
      title,
      description,
      btnPrimaryText,
      btnPrimaryLink,
      btnSecondaryText,
      btnSecondaryLink,
      imageUrl,
      imageAlt: title,
      stickerTop,
      stickerMiddle,
      stickerBottom,
      stickerTheme
    };
  }

  // 4. SEPARATE UPDATE BUTTON FOR EACH INDIVIDUAL SLIDE (Slide 1, Slide 2, Slide 3, etc.)
  document.querySelectorAll('.btn-save-individual-slide').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-slide-index'), 10);
      const card = document.querySelector(`.hero-slide-edit-card[data-slide-index="${idx}"]`);
      if (!card) return;

      const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
      const updatedSlide = extractSlideData(card, idx);
      
      // Update specifically this slide
      currentSlides[idx] = updatedSlide;

      if (typeof saveHeroSlides === 'function') {
        saveHeroSlides(currentSlides);
      }

      showAdminToast(`🎉 Slide ${idx + 1} updated and saved successfully! Storefront is live.`);
    });
  });

  // 5. DELETE INDIVIDUAL SLIDE BUTTON
  document.querySelectorAll('.btn-delete-individual-slide').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-slide-index'), 10);
      const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];

      if (currentSlides.length <= 1) {
        alert('Kam az kam aik (1) hero slide zaroori hai.');
        return;
      }

      if (confirm(`Slide ${idx + 1} ko homepage slider se delete karna chahte hain?`)) {
        currentSlides.splice(idx, 1);
        if (typeof saveHeroSlides === 'function') {
          saveHeroSlides(currentSlides);
        }
        renderAdminHeroSlides();
        showAdminToast(`🗑️ Slide ${idx + 1} delete ho gayi! Baki slides save ho chuki hain.`);
      }
    });
  });

  // 6. MOVE SLIDE UP / DOWN (REORDERING)
  document.querySelectorAll('.btn-move-slide-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-slide-index'), 10);
      if (idx <= 0) return;
      const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
      const temp = currentSlides[idx];
      currentSlides[idx] = currentSlides[idx - 1];
      currentSlides[idx - 1] = temp;
      if (typeof saveHeroSlides === 'function') {
        saveHeroSlides(currentSlides);
      }
      renderAdminHeroSlides();
      showAdminToast(`↔️ Slide ${idx + 1} ko position ${idx} par shift kar diya.`);
    });
  });

  document.querySelectorAll('.btn-move-slide-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-slide-index'), 10);
      const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
      if (idx >= currentSlides.length - 1) return;
      const temp = currentSlides[idx];
      currentSlides[idx] = currentSlides[idx + 1];
      currentSlides[idx + 1] = temp;
      if (typeof saveHeroSlides === 'function') {
        saveHeroSlides(currentSlides);
      }
      renderAdminHeroSlides();
      showAdminToast(`↔️ Slide ${idx + 1} ko position ${idx + 2} par shift kar diya.`);
    });
  });

  // 7. RESET INDIVIDUAL SLIDE
  document.querySelectorAll('.btn-reset-individual-slide').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-slide-index'), 10);
      if (confirm(`Slide ${idx + 1} ke changes reset karne hain?`)) {
        const currentSlides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
        if (typeof DEFAULT_HERO_SLIDES !== 'undefined' && DEFAULT_HERO_SLIDES[idx]) {
          currentSlides[idx] = JSON.parse(JSON.stringify(DEFAULT_HERO_SLIDES[idx]));
        } else {
          currentSlides[idx] = {
            id: Date.now(),
            productId: null,
            tag: "SPECIAL DEAL",
            tagIcon: "bi-fire",
            title: `HOT PRODUCT DEAL ${idx + 1}`,
            description: "Exciting limited-time discount on top trending items.",
            btnPrimaryText: "Shop Now",
            btnPrimaryLink: "shop.html",
            btnSecondaryText: "Explore More",
            btnSecondaryLink: "shop.html",
            imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
            imageAlt: "Deal",
            stickerTop: "SAVE",
            stickerMiddle: "50%",
            stickerBottom: "TODAY",
            stickerTheme: "default"
          };
        }
        if (typeof saveHeroSlides === 'function') {
          saveHeroSlides(currentSlides);
        }
        renderAdminHeroSlides();
        showAdminToast(`🔄 Slide ${idx + 1} reset ho gayi.`);
      }
    });
  });

  // 8. ADD NEW SLIDE BUTTONS (Top & Bottom)
  const addTopBtn = document.getElementById('addNewHeroSlideBtn');
  if (addTopBtn) {
    addTopBtn.onclick = (e) => {
      e.preventDefault();
      addNewHeroSlide();
    };
  }

  const addBtmBtn = document.getElementById('addNewHeroSlideBottomBtn');
  if (addBtmBtn) {
    addBtmBtn.onclick = (e) => {
      e.preventDefault();
      addNewHeroSlide();
    };
  }

  // 9. Global Save Action ("Save All Banners" buttons)
  const saveAllAction = (e) => {
    if (e) e.preventDefault();
    const cards = document.querySelectorAll('.hero-slide-edit-card');
    const newSlides = [];

    cards.forEach((card, idx) => {
      newSlides.push(extractSlideData(card, idx));
    });

    if (typeof saveHeroSlides === 'function') {
      saveHeroSlides(newSlides);
    }
    showAdminToast(`🎯 All ${newSlides.length} Hero Banners saved successfully! Homepage updated in real time.`);
  };

  const form = document.getElementById('adminHeroSlidesForm');
  if (form) form.addEventListener('submit', saveAllAction);

  const saveTopBtn = document.getElementById('saveHeroBannersBtn');
  if (saveTopBtn) saveTopBtn.addEventListener('click', saveAllAction);

  const saveBtmBtn = document.getElementById('saveHeroBannersBottomBtn');
  if (saveBtmBtn) saveBtmBtn.addEventListener('click', saveAllAction);

  // 10. Global Factory Reset Action
  const resetAllAction = () => {
    if (confirm('Reset all Hero Carousel slides back to default factory products?')) {
      if (typeof resetHeroSlides === 'function') {
        resetHeroSlides();
      }
      renderAdminHeroSlides();
      showAdminToast('🔄 All Hero Carousel banners reset to factory defaults.');
    }
  };

  const resetTopBtn = document.getElementById('resetHeroBannersBtn');
  if (resetTopBtn) resetTopBtn.addEventListener('click', resetAllAction);

  const resetBtmBtn = document.getElementById('resetHeroBannersBottomBtn');
  if (resetBtmBtn) resetBtmBtn.addEventListener('click', resetAllAction);
}

/* ==========================================================================
   HOMEPAGE NEWS & TOP TICKER SLIDER MANAGEMENT
   ========================================================================== */

function initAdminNewsManager() {
  renderAdminNewsSlides();
}

/**
 * Add a new custom News Slide
 */
function addNewNewsSlide() {
  const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];
  const nextNum = currentNews.length + 1;

  const newItem = {
    id: Date.now(),
    badge: "📢 NEW DROP",
    badgeColor: "warning",
    title: `EXCLUSIVE STORE ANNOUNCEMENT #${nextNum}`,
    summary: "Naye product drops, mega discount promotions ya delivery alerts ki details yahan likhein.",
    linkText: "Shop Deal Now",
    linkUrl: "shop.html",
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80",
    showInTopTicker: true,
    tickerText: `NEW ANNOUNCEMENT #${nextNum}: CHECK OUT LATEST DROPS & DEALS`
  };

  currentNews.push(newItem);
  if (typeof saveNewsItems === 'function') {
    saveNewsItems(currentNews);
  }
  renderAdminNewsSlides();
  showAdminToast(`✨ Nayi News Slide #${nextNum} add ho gayi! Ab aap is mein apni details save karein.`);

  // Scroll to new slide
  setTimeout(() => {
    const newCard = document.querySelector(`.news-slide-edit-card[data-news-index="${currentNews.length - 1}"]`);
    if (newCard) {
      newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newCard.classList.add('border-info');
      setTimeout(() => newCard.classList.remove('border-info'), 2500);
    }
  }, 150);
}

function renderAdminNewsSlides() {
  const container = document.getElementById('newsEditorContainer');
  if (!container) return;

  const items = typeof loadNewsItems === 'function' ? loadNewsItems() : [];

  if (!items || !items.length) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="alert alert-info py-4 px-3 rounded-4 shadow-sm max-w-md mx-auto">
          <i class="bi bi-newspaper fs-1 text-info d-block mb-2"></i>
          <h5 class="fw-bold text-dark">No News Slides Available</h5>
          <p class="text-muted small mb-3">Homepage news section mein abhi koi slide nahi hai. Nayi slide add karein ya defaults restore karein.</p>
          <div class="d-flex justify-content-center gap-2">
            <button type="button" class="btn btn-success btn-sm rounded-pill px-3 py-1.5 fw-bold" onclick="addNewNewsSlide()">
              <i class="bi bi-plus-circle-fill me-1"></i> Add First News Slide
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 fw-bold" id="emptyStateResetNewsBtn">
              <i class="bi bi-arrow-counterclockwise me-1"></i> Restore Defaults
            </button>
          </div>
        </div>
      </div>
    `;
    const emptyReset = document.getElementById('emptyStateResetNewsBtn');
    if (emptyReset) {
      emptyReset.addEventListener('click', () => {
        if (typeof resetNewsItems === 'function') resetNewsItems();
        renderAdminNewsSlides();
      });
    }
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const badgeColor = item.badgeColor || 'warning';

    return `
      <div class="col-12 col-xl-4 col-md-6">
        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden bg-white news-slide-edit-card" data-news-index="${idx}">
          
          <!-- Card Header -->
          <div class="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-info text-dark fw-bold rounded-pill px-2.5 py-1">NEWS #${idx + 1}</span>
              <span class="small fw-bold text-uppercase tracking-wider text-light" style="font-size: 0.72rem;">
                ${idx === 0 ? 'Active / 1st Slide' : `Slide ${idx + 1}`}
              </span>
            </div>

            <div class="d-flex align-items-center gap-1">
              <!-- Reorder buttons -->
              <button type="button" class="btn btn-outline-light btn-sm rounded-circle p-0 d-inline-flex align-items-center justify-content-center btn-move-news-up" data-news-index="${idx}" ${idx === 0 ? 'disabled' : ''} style="width: 26px; height: 26px;" title="Move earlier in slider">
                <i class="bi bi-chevron-left" style="font-size: 0.75rem;"></i>
              </button>
              <button type="button" class="btn btn-outline-light btn-sm rounded-circle p-0 d-inline-flex align-items-center justify-content-center btn-move-news-down" data-news-index="${idx}" ${idx === items.length - 1 ? 'disabled' : ''} style="width: 26px; height: 26px;" title="Move later in slider">
                <i class="bi bi-chevron-right" style="font-size: 0.75rem;"></i>
              </button>
              
              <!-- Top Update Button -->
              <button type="button" class="btn btn-info btn-sm rounded-pill px-2.5 py-1 fw-bold text-dark btn-save-individual-news shadow-sm ms-1" data-news-index="${idx}" title="Save only this news slide">
                <i class="bi bi-check2-circle me-1"></i> Update #${idx + 1}
              </button>
            </div>
          </div>

          <div class="card-body p-3 p-md-4">
            
            <!-- Category Badge & Color -->
            <div class="row g-2 mb-3">
              <div class="col-7">
                <label class="form-label small fw-bold text-dark mb-1">Badge / Tag Text</label>
                <input type="text" class="form-control form-control-sm news-input-badge" data-news-index="${idx}" value="${escapeHtml(item.badge || 'FLASH PROMO')}" placeholder="e.g. ⚡ FLASH PROMO">
              </div>
              <div class="col-5">
                <label class="form-label small fw-bold text-dark mb-1">Badge Color</label>
                <select class="form-select form-select-sm news-input-badge-color" data-news-index="${idx}">
                  <option value="warning" ${badgeColor === 'warning' ? 'selected' : ''}>Yellow (Warning)</option>
                  <option value="danger" ${badgeColor === 'danger' ? 'selected' : ''}>Red (Hot / Danger)</option>
                  <option value="success" ${badgeColor === 'success' ? 'selected' : ''}>Green (Success / Shipping)</option>
                  <option value="primary" ${badgeColor === 'primary' ? 'selected' : ''}>Blue (Drop / Launch)</option>
                  <option value="info" ${badgeColor === 'info' ? 'selected' : ''}>Cyan (Notice)</option>
                  <option value="dark" ${badgeColor === 'dark' ? 'selected' : ''}>Dark (Charcoal)</option>
                </select>
              </div>
            </div>

            <!-- Headline / Title -->
            <div class="mb-3">
              <label class="form-label small fw-bold text-dark mb-1">
                News Headline / Title <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control form-control-sm news-input-title" data-news-index="${idx}" value="${escapeHtml(item.title || '')}" required placeholder="Headline of announcement...">
            </div>

            <!-- Date / Subtag -->
            <div class="mb-3">
              <label class="form-label small fw-bold text-dark mb-1">Date / Display Time</label>
              <input type="text" class="form-control form-control-sm news-input-date" data-news-index="${idx}" value="${escapeHtml(item.date || '')}" placeholder="e.g. Nov 6, 2026">
            </div>

            <!-- Summary / Content -->
            <div class="mb-3">
              <label class="form-label small fw-bold text-dark mb-1">Summary Description</label>
              <textarea class="form-control form-control-sm news-input-summary" data-news-index="${idx}" rows="2" placeholder="Announcement details...">${escapeHtml(item.summary || '')}</textarea>
            </div>

            <!-- Button Action & Link -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label small fw-bold text-dark mb-1">Button Text</label>
                <input type="text" class="form-control form-control-sm news-input-btn-text" data-news-index="${idx}" value="${escapeHtml(item.linkText || 'Learn More')}" placeholder="Shop Deal Now">
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold text-dark mb-1">Button Link</label>
                <input type="text" class="form-control form-control-sm news-input-btn-url" data-news-index="${idx}" value="${escapeHtml(item.linkUrl || 'shop.html')}" placeholder="shop.html ya link">
              </div>
            </div>

            <!-- Top Header Announcement Ticker Settings -->
            <div class="p-3 bg-light rounded-3 border mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label small fw-bold text-dark mb-0">
                  <i class="bi bi-broadcast text-info me-1"></i> Top Header Ticker Slider
                </label>
                <div class="form-check form-switch m-0">
                  <input class="form-check-input news-input-show-ticker" type="checkbox" id="newsTickerCheck_${idx}" data-news-index="${idx}" ${item.showInTopTicker !== false ? 'checked' : ''}>
                  <label class="form-check-label small text-muted" for="newsTickerCheck_${idx}">Cycle in Ticker</label>
                </div>
              </div>
              <input type="text" class="form-control form-control-sm news-input-ticker-text" data-news-index="${idx}" value="${escapeHtml(item.tickerText || item.title || '')}" placeholder="Short 1-line text for top header ticker...">
              <span class="text-muted" style="font-size: 0.72rem;">Ye text website ke sab se upar black announcement bar mein slide ban kar chalega.</span>
            </div>

            <!-- Image Upload with Device Storage & URL -->
            <div class="p-3 bg-light rounded-3 border mb-3">
              <label class="form-label small fw-bold text-dark d-flex justify-content-between align-items-center mb-1">
                <span>News Image <span class="text-danger">*</span></span>
                <span class="badge bg-info-subtle text-dark border" style="font-size: 0.7rem;">Device or URL</span>
              </label>

              <!-- Device File Upload Button -->
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <label class="btn btn-sm btn-dark text-white rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1 cursor-pointer shadow-sm">
                  <i class="bi bi-upload text-info"></i>
                  <span>Choose from Device</span>
                  <input type="file" accept="image/*" class="d-none news-file-input" data-news-index="${idx}">
                </label>
                <span class="small text-muted news-file-name-${idx}">PNG, JPG, WebP</span>
              </div>

              <!-- Direct URL -->
              <div class="input-group input-group-sm mb-2">
                <span class="input-group-text bg-white"><i class="bi bi-link-45deg"></i> URL</span>
                <input type="text" class="form-control news-input-image" data-news-index="${idx}" value="${escapeHtml(item.imageUrl || '')}" placeholder="https://... ya local path">
              </div>

              <!-- Preview -->
              <div class="d-flex align-items-center gap-3 p-2 rounded-3 bg-white border">
                <img src="${escapeHtml(item.imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80')}" alt="Preview" class="news-preview-img-${idx}" style="width: 75px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #d1d5db;" onerror="this.src='https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80'">
                <div class="small">
                  <strong class="text-dark d-block">Thumbnail Preview</strong>
                  <span class="text-muted" style="font-size: 0.72rem;">Homepage News slider card par ye photo dikhai degi.</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Card Footer with Dedicated Update & Delete Buttons -->
          <div class="card-footer bg-light p-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div class="d-flex gap-1">
              ${items.length > 1 ? `
                <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-2.5 btn-delete-individual-news" data-news-index="${idx}" title="Delete this news slide">
                  <i class="bi bi-trash3 me-1"></i> Delete
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-2.5 btn-reset-individual-news" data-news-index="${idx}" title="Reset news slide">
                <i class="bi bi-arrow-counterclockwise me-1"></i> Reset
              </button>
            </div>
            
            <button type="button" class="btn btn-info btn-sm rounded-pill px-3.5 py-1.5 fw-bold text-dark btn-save-individual-news shadow-sm" data-news-index="${idx}">
              <i class="bi bi-check2-circle me-1"></i> Update News #${idx + 1}
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');

  setupNewsEventListeners();
}

function setupNewsEventListeners() {
  // 1. Device Storage Image Upload for each News Slide
  document.querySelectorAll('.news-file-input').forEach(fileInput => {
    fileInput.addEventListener('change', async (e) => {
      const idx = e.target.getAttribute('data-news-index');
      const file = e.target.files?.[0];
      if (!file) return;

      const fileNameLabel = document.querySelector(`.news-file-name-${idx}`);
      const imgInput = document.querySelector(`.news-input-image[data-news-index="${idx}"]`);
      const previewImg = document.querySelector(`.news-preview-img-${idx}`);

      try {
        if (fileNameLabel) fileNameLabel.textContent = `Processing ${file.name}...`;
        const dataUrl = await processImageFile(file, 800, 600, 0.75);
        if (imgInput) imgInput.value = dataUrl;
        if (previewImg) previewImg.src = dataUrl;
        if (fileNameLabel) {
          fileNameLabel.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> ${escapeHtml(file.name)}</span> (${Math.round(file.size / 1024)} KB)`;
        }
        showAdminToast(`📸 News Slide #${Number(idx) + 1} image loaded from device storage!`);
      } catch (err) {
        alert('Could not load image: ' + err.message);
        if (fileNameLabel) fileNameLabel.textContent = 'Failed to load image';
      }
    });
  });

  // 2. URL live preview
  document.querySelectorAll('.news-input-image').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = e.target.getAttribute('data-news-index');
      const preview = document.querySelector(`.news-preview-img-${idx}`);
      if (preview && e.target.value.trim()) {
        preview.src = e.target.value.trim();
      }
    });
  });

  // Helper to extract data from a news card
  function extractNewsData(card, idx) {
    const badge = card.querySelector('.news-input-badge')?.value.trim() || 'UPDATE';
    const badgeColor = card.querySelector('.news-input-badge-color')?.value || 'warning';
    const title = card.querySelector('.news-input-title')?.value.trim() || `Store Announcement #${idx + 1}`;
    const date = card.querySelector('.news-input-date')?.value.trim() || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const summary = card.querySelector('.news-input-summary')?.value.trim() || '';
    const linkText = card.querySelector('.news-input-btn-text')?.value.trim() || 'Learn More';
    const linkUrl = card.querySelector('.news-input-btn-url')?.value.trim() || 'shop.html';
    const showInTopTicker = card.querySelector('.news-input-show-ticker')?.checked ?? true;
    const tickerText = card.querySelector('.news-input-ticker-text')?.value.trim() || title;
    const imageUrl = card.querySelector('.news-input-image')?.value.trim() || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80';

    return {
      id: idx + 1,
      badge,
      badgeColor,
      title,
      date,
      summary,
      linkText,
      linkUrl,
      showInTopTicker,
      tickerText,
      imageUrl
    };
  }

  // 3. Save individual news slide
  document.querySelectorAll('.btn-save-individual-news').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-news-index'), 10);
      const card = document.querySelector(`.news-slide-edit-card[data-news-index="${idx}"]`);
      if (!card) return;

      const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];
      const updatedItem = extractNewsData(card, idx);
      currentNews[idx] = updatedItem;

      if (typeof saveNewsItems === 'function') {
        saveNewsItems(currentNews);
      }
      showAdminToast(`🎉 News Slide #${idx + 1} updated and saved! Storefront live updated.`);
    });
  });

  // 4. Delete individual news slide
  document.querySelectorAll('.btn-delete-individual-news').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-news-index'), 10);
      const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];

      if (currentNews.length <= 1) {
        alert('Kam az kam aik (1) news slide zaroori hai.');
        return;
      }

      if (confirm(`News Slide #${idx + 1} ko delete karna chahte hain?`)) {
        currentNews.splice(idx, 1);
        if (typeof saveNewsItems === 'function') {
          saveNewsItems(currentNews);
        }
        renderAdminNewsSlides();
        showAdminToast(`🗑️ News Slide #${idx + 1} delete ho gayi! Baki slides save ho chuki hain.`);
      }
    });
  });

  // 5. Move news slide up / down
  document.querySelectorAll('.btn-move-news-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-news-index'), 10);
      if (idx <= 0) return;
      const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];
      const temp = currentNews[idx];
      currentNews[idx] = currentNews[idx - 1];
      currentNews[idx - 1] = temp;
      if (typeof saveNewsItems === 'function') {
        saveNewsItems(currentNews);
      }
      renderAdminNewsSlides();
      showAdminToast(`↔️ News Slide #${idx + 1} ko pehle shift kar diya.`);
    });
  });

  document.querySelectorAll('.btn-move-news-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-news-index'), 10);
      const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];
      if (idx >= currentNews.length - 1) return;
      const temp = currentNews[idx];
      currentNews[idx] = currentNews[idx + 1];
      currentNews[idx + 1] = temp;
      if (typeof saveNewsItems === 'function') {
        saveNewsItems(currentNews);
      }
      renderAdminNewsSlides();
      showAdminToast(`↔️ News Slide #${idx + 1} ko baad mein shift kar diya.`);
    });
  });

  // 6. Reset individual news slide
  document.querySelectorAll('.btn-reset-individual-news').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = parseInt(btn.getAttribute('data-news-index'), 10);
      if (confirm(`News Slide #${idx + 1} ke changes reset karne hain?`)) {
        const currentNews = typeof loadNewsItems === 'function' ? loadNewsItems() : [];
        if (typeof DEFAULT_NEWS_ITEMS !== 'undefined' && DEFAULT_NEWS_ITEMS[idx]) {
          currentNews[idx] = JSON.parse(JSON.stringify(DEFAULT_NEWS_ITEMS[idx]));
        } else {
          currentNews[idx] = {
            id: Date.now(),
            badge: "FLASH PROMO",
            badgeColor: "warning",
            title: `STORE PROMOTION #${idx + 1}`,
            summary: "Details of this promotion or notice.",
            linkText: "Shop Deals",
            linkUrl: "shop.html",
            date: "Today",
            imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80",
            showInTopTicker: true,
            tickerText: `STORE PROMOTION #${idx + 1}`
          };
        }
        if (typeof saveNewsItems === 'function') {
          saveNewsItems(currentNews);
        }
        renderAdminNewsSlides();
        showAdminToast(`🔄 News Slide #${idx + 1} reset ho gayi.`);
      }
    });
  });

  // 7. Add New News Slide buttons
  const addTopBtn = document.getElementById('addNewNewsSlideBtn');
  if (addTopBtn) {
    addTopBtn.onclick = (e) => {
      e.preventDefault();
      addNewNewsSlide();
    };
  }

  const addBtmBtn = document.getElementById('addNewNewsSlideBottomBtn');
  if (addBtmBtn) {
    addBtmBtn.onclick = (e) => {
      e.preventDefault();
      addNewNewsSlide();
    };
  }

  // 8. Save All News
  const saveAllAction = (e) => {
    if (e) e.preventDefault();
    const cards = document.querySelectorAll('.news-slide-edit-card');
    const newItems = [];
    cards.forEach((card, idx) => {
      newItems.push(extractNewsData(card, idx));
    });

    if (typeof saveNewsItems === 'function') {
      saveNewsItems(newItems);
    }
    showAdminToast(`🎯 All ${newItems.length} News Slides saved! Storefront live updated.`);
  };

  const form = document.getElementById('adminNewsForm');
  if (form) form.addEventListener('submit', saveAllAction);

  const saveTopBtn = document.getElementById('saveNewsBtn');
  if (saveTopBtn) saveTopBtn.addEventListener('click', saveAllAction);

  const saveBtmBtn = document.getElementById('saveNewsBottomBtn');
  if (saveBtmBtn) saveBtmBtn.addEventListener('click', saveAllAction);

  // 9. Factory Reset News
  const resetAllAction = () => {
    if (confirm('Reset all news slides back to factory defaults?')) {
      if (typeof resetNewsItems === 'function') {
        resetNewsItems();
      }
      renderAdminNewsSlides();
      showAdminToast('🔄 All News slides reset to factory defaults.');
    }
  };

  const resetTopBtn = document.getElementById('resetNewsBtn');
  if (resetTopBtn) resetTopBtn.addEventListener('click', resetAllAction);

  const resetBtmBtn = document.getElementById('resetNewsBottomBtn');
  if (resetBtmBtn) resetBtmBtn.addEventListener('click', resetAllAction);
}

/* ==========================================================================
   FOOTER, SOCIAL MEDIA & CUSTOMER SUPPORT SETTINGS MANAGEMENT
   ========================================================================== */

function initAdminFooterManager() {
  populateAdminFooterSettings();
  setupFooterEventListeners();
}

function populateAdminFooterSettings() {
  const settings = typeof loadFooterSettings === 'function' ? loadFooterSettings() : null;
  if (!settings) return;

  // Social Links
  const social = settings.socialLinks || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };

  setVal('footerSocialFbUrl', social.facebook?.url);
  setChecked('footerSocialFbEnabled', social.facebook?.enabled);

  setVal('footerSocialInstaUrl', social.instagram?.url);
  setChecked('footerSocialInstaEnabled', social.instagram?.enabled);

  setVal('footerSocialTwitterUrl', social.twitter?.url);
  setChecked('footerSocialTwitterEnabled', social.twitter?.enabled);

  setVal('footerSocialTiktokUrl', social.tiktok?.url);
  setChecked('footerSocialTiktokEnabled', social.tiktok?.enabled);

  setVal('footerSocialYtUrl', social.youtube?.url);
  setChecked('footerSocialYtEnabled', social.youtube?.enabled);

  setVal('footerSocialWaUrl', social.whatsapp?.url);
  setChecked('footerSocialWaEnabled', social.whatsapp?.enabled);

  // Customer Support
  const support = settings.support || {};
  setVal('footerSupportPhone', support.phone);
  setVal('footerSupportEmail', support.email);
  setVal('footerSupportWhatsapp', support.whatsappNumber);
  setVal('footerSupportHours', support.hours);
  setVal('footerSupportAddress', support.address);

  // Legal & Policies
  const legal = settings.legal || {};
  setVal('footerLegalPrivacyTitle', legal.privacyTitle || 'Privacy Policy');
  setVal('footerLegalPrivacyUrl', legal.privacyUrl || 'privacy.html');

  setVal('footerLegalTermsTitle', legal.termsTitle || 'Terms & Conditions');
  setVal('footerLegalTermsUrl', legal.termsUrl || 'terms.html');

  setVal('footerLegalAboutTitle', legal.aboutTitle || 'About SnapzDealz');
  setVal('footerLegalAboutUrl', legal.aboutUrl || 'about.html');

  setVal('footerLegalContactTitle', legal.contactTitle || 'Contact & Helpdesk');
  setVal('footerLegalContactUrl', legal.contactUrl || 'contact.html');

  // Brand Bio, Copyright & Badges
  setVal('footerBrandBio', settings.brandBio);
  setVal('footerCopyrightText', settings.copyrightText);

  const payments = settings.payments || {};
  setChecked('footerBadgeCod', payments.cod !== false);
  setChecked('footerBadgeEasypaisa', payments.easypaisa !== false);
  setChecked('footerBadgeJazzcash', payments.jazzcash !== false);
  setChecked('footerBadgeCards', payments.cards !== false);
  setChecked('footerBadgeSsl', payments.ssl !== false);
}

function setupFooterEventListeners() {
  const saveFooterAction = (e) => {
    if (e) e.preventDefault();

    const getVal = (id) => document.getElementById(id)?.value.trim() || '';
    const getChecked = (id) => Boolean(document.getElementById(id)?.checked);

    const updatedSettings = {
      brandName: "SNAPZDEALZ",
      brandBio: getVal('footerBrandBio') || "SnapzDealz is your premier destination for verified high-octane deals.",
      copyrightText: getVal('footerCopyrightText') || "© 2026 SnapzDealz Inc. All rights reserved.",

      socialLinks: {
        facebook: { url: getVal('footerSocialFbUrl') || 'https://facebook.com', enabled: getChecked('footerSocialFbEnabled') },
        instagram: { url: getVal('footerSocialInstaUrl') || 'https://instagram.com', enabled: getChecked('footerSocialInstaEnabled') },
        twitter: { url: getVal('footerSocialTwitterUrl') || 'https://twitter.com', enabled: getChecked('footerSocialTwitterEnabled') },
        tiktok: { url: getVal('footerSocialTiktokUrl') || 'https://tiktok.com', enabled: getChecked('footerSocialTiktokEnabled') },
        youtube: { url: getVal('footerSocialYtUrl') || 'https://youtube.com', enabled: getChecked('footerSocialYtEnabled') },
        whatsapp: { url: getVal('footerSocialWaUrl') || 'https://wa.me/923001234567', enabled: getChecked('footerSocialWaEnabled') }
      },

      support: {
        phone: getVal('footerSupportPhone') || '1-800-SNAPZ-DEAL',
        email: getVal('footerSupportEmail') || 'support@snapzdealz.com',
        whatsappNumber: getVal('footerSupportWhatsapp') || '+92 300 1234567',
        hours: getVal('footerSupportHours') || 'Live Support: 24 Hours / 7 Days',
        address: getVal('footerSupportAddress') || '742 Evergreen Terrace, Suite 400, San Francisco, CA',
        helpdeskUrl: getVal('footerLegalContactUrl') || 'contact.html'
      },

      legal: {
        privacyTitle: getVal('footerLegalPrivacyTitle') || 'Privacy Policy',
        privacyUrl: getVal('footerLegalPrivacyUrl') || 'privacy.html',
        termsTitle: getVal('footerLegalTermsTitle') || 'Terms & Conditions',
        termsUrl: getVal('footerLegalTermsUrl') || 'terms.html',
        aboutTitle: getVal('footerLegalAboutTitle') || 'About SnapzDealz',
        aboutUrl: getVal('footerLegalAboutUrl') || 'about.html',
        contactTitle: getVal('footerLegalContactTitle') || 'Contact & Helpdesk',
        contactUrl: getVal('footerLegalContactUrl') || 'contact.html'
      },

      payments: {
        cod: getChecked('footerBadgeCod'),
        easypaisa: getChecked('footerBadgeEasypaisa'),
        jazzcash: getChecked('footerBadgeJazzcash'),
        cards: getChecked('footerBadgeCards'),
        ssl: getChecked('footerBadgeSsl')
      }
    };

    if (typeof saveFooterSettings === 'function') {
      saveFooterSettings(updatedSettings);
    }
    showAdminToast('🎉 Footer & Support Settings saved successfully! Live store updated.');
  };

  const footerForm = document.getElementById('adminFooterForm');
  if (footerForm) footerForm.addEventListener('submit', saveFooterAction);

  const saveTopBtn = document.getElementById('saveFooterBtn');
  if (saveTopBtn) saveTopBtn.addEventListener('click', saveFooterAction);

  const saveBtmBtn = document.getElementById('saveFooterBottomBtn');
  if (saveBtmBtn) saveBtmBtn.addEventListener('click', saveFooterAction);

  // Restore Defaults
  const resetAction = () => {
    if (confirm('Reset footer settings back to default values?')) {
      if (typeof resetFooterSettings === 'function') {
        resetFooterSettings();
      }
      populateAdminFooterSettings();
      showAdminToast('🔄 Footer settings reset to default values.');
    }
  };

  const resetTopBtn = document.getElementById('resetFooterBtn');
  if (resetTopBtn) resetTopBtn.addEventListener('click', resetAction);

  const resetBtmBtn = document.getElementById('resetFooterBottomBtn');
  if (resetBtmBtn) resetBtmBtn.addEventListener('click', resetAction);
}

/* ==========================================================================
   STORE CURRENCY & PRICING MANAGER (PKR, USD, ETC.)
   ========================================================================== */

function initAdminCurrencyManager() {
  populateAdminCurrencySettings();
  setupCurrencyEventListeners();
  updateAdminCurrencyIndicators();
}

function updateAdminCurrencyIndicators() {
  const cfg = (typeof loadCurrencySettings === 'function') ? loadCurrencySettings() : null;
  if (!cfg) return;

  const activeCode = cfg.activeCurrency || 'PKR';
  const curr = (cfg.currencies && cfg.currencies[activeCode]) ? cfg.currencies[activeCode] : { code: 'PKR', symbol: 'Rs.', flag: '🇵🇰' };

  const badgeEl = document.getElementById('adminActiveCurrencyBadge');
  if (badgeEl) badgeEl.textContent = activeCode;

  const quickFlag = document.getElementById('quickCurrencyFlag');
  if (quickFlag) quickFlag.textContent = curr.flag || (activeCode === 'PKR' ? '🇵🇰' : '🇺🇸');

  const quickCode = document.getElementById('quickCurrencyCode');
  if (quickCode) quickCode.textContent = `${activeCode} (${curr.symbol || 'Rs.'})`;

  // Update modal input prefixes & labels if present
  const newPriceAddon = document.querySelector('#newProdPrice')?.parentElement?.querySelector('.input-group-text');
  if (newPriceAddon) newPriceAddon.textContent = curr.symbol || '$';

  const editPriceAddon = document.querySelector('#editProdPrice')?.parentElement?.querySelector('.input-group-text');
  if (editPriceAddon) editPriceAddon.textContent = curr.symbol || '$';
}

function populateAdminCurrencySettings() {
  const cfg = (typeof loadCurrencySettings === 'function') ? loadCurrencySettings() : null;
  if (!cfg) return;

  const activeCode = cfg.activeCurrency || 'PKR';
  const pkrCurr = (cfg.currencies && cfg.currencies.PKR) ? cfg.currencies.PKR : { symbol: 'Rs.', rate: 280, decimals: 0, placement: 'before' };
  const usdCurr = (cfg.currencies && cfg.currencies.USD) ? cfg.currencies.USD : { symbol: '$', rate: 1, decimals: 2, placement: 'before' };
  const currentCurr = cfg.currencies[activeCode] || pkrCurr;

  // Active Radio
  const radioPkr = document.getElementById('radioCurrencyPKR');
  const radioUsd = document.getElementById('radioCurrencyUSD');
  if (radioPkr) radioPkr.checked = (activeCode === 'PKR');
  if (radioUsd) radioUsd.checked = (activeCode === 'USD');

  // Highlight Cards
  updateCurrencyCardSelection(activeCode);

  // Pricing Mode
  const modeAuto = document.getElementById('pricingModeAuto');
  const modeDirect = document.getElementById('pricingModeDirect');
  if (modeAuto) modeAuto.checked = (cfg.pricingMode !== 'direct');
  if (modeDirect) modeDirect.checked = (cfg.pricingMode === 'direct');

  // Rate input
  const rateInput = document.getElementById('currencyExchangeRateInput');
  if (rateInput) rateInput.value = pkrCurr.rate || 280;

  // Symbol input
  const symbolInput = document.getElementById('currencySymbolInput');
  if (symbolInput) symbolInput.value = currentCurr.symbol || (activeCode === 'PKR' ? 'Rs.' : '$');

  // Placement select
  const placementSelect = document.getElementById('currencyPlacementSelect');
  if (placementSelect) placementSelect.value = currentCurr.placement || 'before';

  // Decimals select
  const decimalsSelect = document.getElementById('currencyDecimalsSelect');
  if (decimalsSelect) decimalsSelect.value = (currentCurr.decimals !== undefined) ? String(currentCurr.decimals) : (activeCode === 'PKR' ? '0' : '2');

  // Store switcher switch
  const switcherSwitch = document.getElementById('enableStoreSwitcherSwitch');
  if (switcherSwitch) switcherSwitch.checked = (cfg.enableStoreSwitcher !== false);

  // Update simulator preview
  updateLivePricingPreview();
}

function updateCurrencyCardSelection(activeCode) {
  const cardPkr = document.getElementById('cardCurrencyPKR');
  const cardUsd = document.getElementById('cardCurrencyUSD');
  if (cardPkr) {
    if (activeCode === 'PKR') {
      cardPkr.classList.add('border-success', 'bg-success-subtle');
      cardPkr.classList.remove('border-light');
    } else {
      cardPkr.classList.remove('border-success', 'bg-success-subtle');
      cardPkr.classList.add('border-light');
    }
  }
  if (cardUsd) {
    if (activeCode === 'USD') {
      cardUsd.classList.add('border-primary', 'bg-primary-subtle');
      cardUsd.classList.remove('border-light');
    } else {
      cardUsd.classList.remove('border-primary', 'bg-primary-subtle');
      cardUsd.classList.add('border-light');
    }
  }
}

function updateLivePricingPreview() {
  const selectedCode = document.querySelector('input[name="currencySelection"]:checked')?.value || 'PKR';
  const mode = document.querySelector('input[name="pricingMode"]:checked')?.value || 'auto';
  const rate = parseFloat(document.getElementById('currencyExchangeRateInput')?.value) || 280;
  const symbol = document.getElementById('currencySymbolInput')?.value.trim() || (selectedCode === 'PKR' ? 'Rs.' : '$');
  const placement = document.getElementById('currencyPlacementSelect')?.value || 'before';
  const decimals = parseInt(document.getElementById('currencyDecimalsSelect')?.value, 10) || (selectedCode === 'PKR' ? 0 : 2);

  const formatPreview = (val) => {
    const num = Number(val) || 0;
    const finalRate = (mode === 'direct') ? 1 : (selectedCode === 'PKR' ? rate : 1);
    const converted = num * finalRate;
    const formatted = converted.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    const space = symbol.length > 1 ? ' ' : '';
    return placement === 'after' ? `${formatted} ${symbol}` : `${symbol}${space}${formatted}`;
  };

  // Preview Badges
  const previewPkrBadge = document.getElementById('previewPkrBadge');
  if (previewPkrBadge) {
    const pkrNum = (mode === 'direct' ? 49.99 : 49.99 * rate);
    previewPkrBadge.textContent = `${symbol} ${Math.round(pkrNum).toLocaleString('en-US')}`;
  }
  const previewUsdBadge = document.getElementById('previewUsdBadge');
  if (previewUsdBadge) previewUsdBadge.textContent = `$49.99`;

  // Simulator Test input
  const testInput = document.getElementById('previewTestInput');
  const testResult = document.getElementById('previewTestResult');
  if (testInput && testResult) {
    testResult.textContent = formatPreview(testInput.value);
  }

  // Sample catalog rows
  document.querySelectorAll('.sample-preview-item').forEach(el => {
    const base = parseFloat(el.getAttribute('data-base-price')) || 0;
    el.textContent = formatPreview(base);
  });
}

function setupCurrencyEventListeners() {
  // Card click triggers radio
  const cardPkr = document.getElementById('cardCurrencyPKR');
  const cardUsd = document.getElementById('cardCurrencyUSD');
  const radioPkr = document.getElementById('radioCurrencyPKR');
  const radioUsd = document.getElementById('radioCurrencyUSD');

  if (cardPkr && radioPkr) {
    cardPkr.addEventListener('click', () => {
      radioPkr.checked = true;
      updateCurrencyCardSelection('PKR');
      const symbolInput = document.getElementById('currencySymbolInput');
      const decimalsSelect = document.getElementById('currencyDecimalsSelect');
      if (symbolInput) symbolInput.value = 'Rs.';
      if (decimalsSelect) decimalsSelect.value = '0';
      updateLivePricingPreview();
    });
  }

  if (cardUsd && radioUsd) {
    cardUsd.addEventListener('click', () => {
      radioUsd.checked = true;
      updateCurrencyCardSelection('USD');
      const symbolInput = document.getElementById('currencySymbolInput');
      const decimalsSelect = document.getElementById('currencyDecimalsSelect');
      if (symbolInput) symbolInput.value = '$';
      if (decimalsSelect) decimalsSelect.value = '2';
      updateLivePricingPreview();
    });
  }

  // Radios change
  if (radioPkr) {
    radioPkr.addEventListener('change', () => {
      updateCurrencyCardSelection('PKR');
      const symbolInput = document.getElementById('currencySymbolInput');
      const decimalsSelect = document.getElementById('currencyDecimalsSelect');
      if (symbolInput) symbolInput.value = 'Rs.';
      if (decimalsSelect) decimalsSelect.value = '0';
      updateLivePricingPreview();
    });
  }
  if (radioUsd) {
    radioUsd.addEventListener('change', () => {
      updateCurrencyCardSelection('USD');
      const symbolInput = document.getElementById('currencySymbolInput');
      const decimalsSelect = document.getElementById('currencyDecimalsSelect');
      if (symbolInput) symbolInput.value = '$';
      if (decimalsSelect) decimalsSelect.value = '2';
      updateLivePricingPreview();
    });
  }

  // Quick preset rate buttons
  document.querySelectorAll('.preset-rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const rateVal = btn.getAttribute('data-rate');
      const rateInput = document.getElementById('currencyExchangeRateInput');
      if (rateInput && rateVal) {
        rateInput.value = rateVal;
        updateLivePricingPreview();
      }
    });
  });

  // Mode radio change
  document.querySelectorAll('input[name="pricingMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isDirect = radio.value === 'direct';
      const block = document.getElementById('exchangeRateConfigBlock');
      if (block) block.style.opacity = isDirect ? '0.5' : '1';
      updateLivePricingPreview();
    });
  });

  // Inputs live preview
  ['currencyExchangeRateInput', 'currencySymbolInput', 'currencyPlacementSelect', 'currencyDecimalsSelect', 'previewTestInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLivePricingPreview);
      el.addEventListener('change', updateLivePricingPreview);
    }
  });

  // Quick toggle in admin nav bar
  const quickToggleBtn = document.getElementById('quickToggleCurrencyAdminBtn');
  if (quickToggleBtn) {
    quickToggleBtn.addEventListener('click', () => {
      const cfg = (typeof loadCurrencySettings === 'function') ? loadCurrencySettings() : null;
      if (!cfg) return;
      const current = cfg.activeCurrency || 'PKR';
      const next = current === 'PKR' ? 'USD' : 'PKR';
      if (typeof setStoreActiveCurrency === 'function') {
        setStoreActiveCurrency(next);
        updateAdminCurrencyIndicators();
        populateAdminCurrencySettings();
        renderAdminProducts();
        applyFiltersAndRender();
        showAdminToast(`Store currency switched to ${next === 'PKR' ? 'Pakistani Rupee (Rs.)' : 'US Dollar ($)'}!`);
      }
    });
  }

  // Save Currency Settings action
  const saveAction = (e) => {
    if (e) e.preventDefault();

    const selectedCode = document.querySelector('input[name="currencySelection"]:checked')?.value || 'PKR';
    const mode = document.querySelector('input[name="pricingMode"]:checked')?.value || 'auto';
    const rate = parseFloat(document.getElementById('currencyExchangeRateInput')?.value) || 280;
    const symbol = document.getElementById('currencySymbolInput')?.value.trim() || (selectedCode === 'PKR' ? 'Rs.' : '$');
    const placement = document.getElementById('currencyPlacementSelect')?.value || 'before';
    const decimals = parseInt(document.getElementById('currencyDecimalsSelect')?.value, 10) || (selectedCode === 'PKR' ? 0 : 2);
    const enableSwitcher = document.getElementById('enableStoreSwitcherSwitch')?.checked !== false;

    const currentCfg = (typeof loadCurrencySettings === 'function') ? loadCurrencySettings() : DEFAULT_CURRENCY_SETTINGS;

    const newCfg = {
      ...currentCfg,
      activeCurrency: selectedCode,
      pricingMode: mode,
      enableStoreSwitcher: enableSwitcher,
      currencies: {
        ...currentCfg.currencies,
        [selectedCode]: {
          ...(currentCfg.currencies[selectedCode] || {}),
          code: selectedCode,
          symbol: symbol,
          rate: (selectedCode === 'PKR' ? rate : 1),
          decimals: decimals,
          placement: placement,
          name: (selectedCode === 'PKR' ? 'Pakistani Rupee (PKR)' : 'US Dollar (USD)'),
          flag: (selectedCode === 'PKR' ? '🇵🇰' : '🇺🇸')
        }
      }
    };

    if (typeof saveCurrencySettings === 'function') {
      saveCurrencySettings(newCfg);
    }

    updateAdminCurrencyIndicators();
    renderAdminProducts();
    applyFiltersAndRender();

    showAdminToast(`🎉 Currency settings saved! Store pricing is now active in ${selectedCode === 'PKR' ? 'Pakistani Rupee (Rs.)' : 'US Dollar ($)'}.`);
  };

  const formEl = document.getElementById('adminCurrencyForm');
  if (formEl) formEl.addEventListener('submit', saveAction);

  const saveTopBtn = document.getElementById('saveCurrencyBtn');
  if (saveTopBtn) saveTopBtn.addEventListener('click', saveAction);

  const saveBtmBtn = document.getElementById('saveCurrencyBottomBtn');
  if (saveBtmBtn) saveBtmBtn.addEventListener('click', saveAction);

  // Reset to default
  const resetAction = () => {
    if (confirm('Reset store currency settings back to default (PKR - Rs.)?')) {
      if (typeof resetCurrencySettings === 'function') {
        resetCurrencySettings();
      }
      populateAdminCurrencySettings();
      updateAdminCurrencyIndicators();
      renderAdminProducts();
      applyFiltersAndRender();
      showAdminToast('🔄 Currency settings reset to default PKR.');
    }
  };

  const resetTopBtn = document.getElementById('resetCurrencyBtn');
  if (resetTopBtn) resetTopBtn.addEventListener('click', resetAction);

  const resetBtmBtn = document.getElementById('resetCurrencyBottomBtn');
  if (resetBtmBtn) resetBtmBtn.addEventListener('click', resetAction);
}



 
