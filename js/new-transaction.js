/**
 * new-transaction.js — New Transaction & Edit Transaction logic
 * POS Dashboard | Module 2: Team Member 2
 *
 * Handles:
 *   - POST /transactions  → createTransaction()  (no ?id param)
 *   - PUT  /transactions/:id → updateTransaction() (with ?id=<n>)
 *   - Amount: numeric-only validation
 *   - Duplicate-submit prevention (button disabled while saving)
 *   - Live preview panel
 *   - Character counter on description
 */

import Layout from './layout.js';
import { createTransaction, updateTransaction, getTransactionById } from './api.js';
import { showToast, formatCurrency, formatDate } from './utils.js';

/* ============================================================
   CONSTANTS
   ============================================================ */
const CATEGORIES = ['income', 'expense', 'deposit', 'withdrawal'];

/* ============================================================
   DOM REFS
   ============================================================ */
const form           = document.getElementById('txn-form');
const fldType        = document.getElementById('txn-type');
const fldCategory    = document.getElementById('txn-category');
const fldAmount      = document.getElementById('txn-amount');
const fldDate        = document.getElementById('txn-date');
const fldDescription = document.getElementById('txn-description');
const fldStatus      = document.getElementById('txn-status');
const btnSubmit      = document.getElementById('btn-submit');
const btnSubmitText  = document.getElementById('btn-submit-text');
const btnSpinner     = document.getElementById('btn-submit-spinner');
const formAlert      = document.getElementById('form-alert');
const charCount      = document.getElementById('char-count');

// Page header / card header
const pageTitle       = document.getElementById('page-title');
const pageSubtitle    = document.getElementById('page-subtitle');
const formIcon        = document.getElementById('form-icon');
const formCardTitle   = document.getElementById('form-card-title');
const formCardSub     = document.getElementById('form-card-subtitle');
const statusGroup     = document.getElementById('group-status');

// Preview elements
const previewRef      = document.getElementById('preview-ref');
const previewType     = document.getElementById('preview-type');
const previewCat      = document.getElementById('preview-category');
const previewAmount   = document.getElementById('preview-amount');
const previewDate     = document.getElementById('preview-date');
const previewDesc     = document.getElementById('preview-desc');

/* ============================================================
   STATE
   ============================================================ */
let editId     = null;   // set when ?id=<n> is present in URL
let isSaving   = false;  // duplicate-submit guard

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    Layout.init({ pageTitle: 'New Transaction', breadcrumb: 'New Transaction' });

    // Default date to today
    fldDate.value = todayISO();

    // Check for edit mode: ?id=<n>
    const params = new URLSearchParams(window.location.search);
    const rawId  = params.get('id');

    if (rawId) {
        editId = rawId;
        await loadForEdit(editId);
    }

    // Wire events
    form.addEventListener('submit', handleSubmit);
    fldDescription.addEventListener('input', updateCharCount);
    fldAmount.addEventListener('input', enforceNumeric);
    fldAmount.addEventListener('keydown', blockInvalidAmountKeys);

    // Live preview listeners
    [fldType, fldCategory, fldAmount, fldDate, fldDescription].forEach(el => {
        el.addEventListener('input', updatePreview);
        el.addEventListener('change', updatePreview);
    });

    // Initialise sidebar custom dropdowns
    initCustomDropdowns();

    // Initial preview render
    updatePreview();
    updateCharCount();
});

/* ============================================================
   CUSTOM DROPDOWN SELECTS (sidebar panel)
   Each custom dropdown mirrors a native <select> in the form
   so validation + submission keep working unchanged.
   ============================================================ */
function initCustomDropdowns() {
    // Map: custom-dropdown-id → native-select-id
    const dropdownMap = [
        { ddId: 'dd-type',     nativeId: 'txn-type' },
        { ddId: 'dd-category', nativeId: 'txn-category' },
        { ddId: 'dd-status',   nativeId: 'txn-status' },
    ];

    dropdownMap.forEach(({ ddId, nativeId }) => {
        const dd     = document.getElementById(ddId);
        const native = document.getElementById(nativeId);
        if (!dd || !native) return;

        const trigger  = dd.querySelector('.txn-select-trigger');
        const valueEl  = dd.querySelector('.txn-select-value');
        const options  = dd.querySelectorAll('.txn-select-option');

        // Open / close on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dd.classList.contains('open');
            closeAllDropdowns();
            if (!isOpen) openDropdown(dd);
        });

        // Keyboard: Enter/Space opens, Escape closes, arrows navigate
        dd.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dd.classList.contains('open') ? closeDropdown(dd) : openDropdown(dd);
            }
            if (e.key === 'Escape') closeDropdown(dd);
        });

        // Option click → sync native select + update display
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.dataset.value;

                // Update native select so form validation & submission work
                native.value = val;
                native.dispatchEvent(new Event('change', { bubbles: true }));

                // Update visual state
                options.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                // Show icon + label in trigger
                const icon = opt.querySelector('.txn-opt-icon');
                valueEl.innerHTML = icon
                    ? `${icon.outerHTML}<span>${opt.textContent.trim()}</span>`
                    : opt.textContent.trim();
                valueEl.style.color = 'var(--color-text-primary)';
                dd.classList.add('selected');

                closeDropdown(dd);
                updatePreview();
            });
        });

        // If native already has a value (edit mode pre-fill), reflect it
        native.addEventListener('change', () => syncDropdownFromNative(dd, native, options, valueEl));

        // Sync once on init (handles edit mode)
        syncDropdownFromNative(dd, native, options, valueEl);
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', () => closeAllDropdowns());
}

function openDropdown(dd) {
    dd.classList.add('open');
    dd.setAttribute('aria-expanded', 'true');
}

function closeDropdown(dd) {
    dd.classList.remove('open');
    dd.setAttribute('aria-expanded', 'false');
}

function closeAllDropdowns() {
    document.querySelectorAll('.txn-custom-select.open').forEach(closeDropdown);
}

/**
 * Sync a custom dropdown's display to match the current native select value.
 * Used after programmatic updates (e.g. edit-mode pre-fill).
 */
function syncDropdownFromNative(dd, native, options, valueEl) {
    const val = native.value;
    if (!val) return;

    const match = [...options].find(o => o.dataset.value === val);
    if (!match) return;

    options.forEach(o => o.classList.remove('active'));
    match.classList.add('active');
    dd.classList.add('selected');

    const icon = match.querySelector('.txn-opt-icon');
    valueEl.innerHTML = icon
        ? `${icon.outerHTML}<span>${match.textContent.trim()}</span>`
        : match.textContent.trim();
    valueEl.style.color = 'var(--color-text-primary)';
}

/* ============================================================
   LOAD FOR EDIT
   ============================================================ */
async function loadForEdit(id) {
    try {
        const txn = await getTransactionById(id);
        if (!txn) throw new Error('Transaction not found.');

        // Update page chrome
        if (pageTitle)    pageTitle.innerHTML   = 'Edit <span>Transaction</span>';
        if (pageSubtitle) pageSubtitle.textContent = `Editing transaction ${txn.reference || '#' + id}.`;
        if (formIcon)     formIcon.className    = 'fa-solid fa-pen-to-square';
        if (formCardTitle) formCardTitle.textContent = 'Edit Transaction Details';
        if (btnSubmitText) btnSubmitText.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Transaction';

        // Insert edit banner above the form
        const banner = document.createElement('div');
        banner.className = 'txn-edit-banner';
        banner.innerHTML = `
            <i class="fa-solid fa-pen-clip"></i>
            <div>
                You are editing <strong>${txn.reference || 'TXN-' + id}</strong>.
                Make your changes and click <strong>Update Transaction</strong> to save.
            </div>`;
        form.insertBefore(banner, form.firstChild);

        // Reveal status field (edit only)
        if (statusGroup) statusGroup.classList.remove('d-none');

        // Populate fields
        if (txn.type)        fldType.value        = txn.type;
        if (txn.category)    fldCategory.value    = txn.category;
        if (txn.amount)      fldAmount.value      = parseFloat(txn.amount).toFixed(2);
        if (txn.date)        fldDate.value         = txn.date;
        if (txn.description) fldDescription.value = txn.description;
        if (txn.status)      fldStatus.value      = txn.status;

        updatePreview();
        updateCharCount();

    } catch (err) {
        console.error('[EditMode] Failed to load transaction:', err);
        showAlert(`Could not load transaction: ${err.message}`, 'error');
    }
}

/* ============================================================
   FORM SUBMISSION
   ============================================================ */
async function handleSubmit(e) {
    e.preventDefault();

    // Guard: prevent double-submit
    if (isSaving) return;

    hideAlert();

    // Validate all fields
    const valid = validateForm();
    if (!valid) return;

    const payload = buildPayload();

    // Lock UI
    setLoading(true);

    try {
        if (editId) {
            // ── EDIT MODE: PUT /transactions/:id ──
            await updateTransaction(editId, payload);
            showToast('Transaction updated successfully!', 'success');
        } else {
            // ── CREATE MODE: POST /transactions ──
            await createTransaction(payload);
            showToast('Transaction saved successfully!', 'success');
            form.reset();
            fldDate.value = todayISO();
            updatePreview();
            updateCharCount();
        }

        // Brief delay then redirect to transactions list
        setTimeout(() => {
            window.location.href = 'transactions.html';
        }, 1200);

    } catch (err) {
        console.error('[TxnForm] Save error:', err);

        const msg = err.status === 404
            ? 'Transaction not found. It may have been deleted.'
            : 'Failed to save transaction. Make sure the JSON Server is running.';

        showAlert(msg, 'error');
        setLoading(false);
    }
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateForm() {
    clearAllErrors();
    let valid = true;

    // Type
    if (!fldType.value) {
        showFieldError('group-type', fldType, 'Please select a transaction type.');
        valid = false;
    }

    // Category
    if (!fldCategory.value || !CATEGORIES.includes(fldCategory.value)) {
        showFieldError('group-category', fldCategory, 'Please select a valid category.');
        valid = false;
    }

    // Amount — numeric, positive, max 2 decimal places
    const rawAmount = fldAmount.value.trim();
    const amount    = parseFloat(rawAmount);
    if (!rawAmount || isNaN(amount) || amount <= 0) {
        showFieldError('group-amount', fldAmount, 'Amount must be a positive number (e.g. 150 or 99.99).');
        valid = false;
    } else if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
        showFieldError('group-amount', fldAmount, 'Amount accepts up to 2 decimal places only.');
        valid = false;
    }

    // Date
    if (!fldDate.value) {
        showFieldError('group-date', fldDate, 'Please select a date.');
        valid = false;
    }

    // Description
    const desc = fldDescription.value.trim();
    if (!desc) {
        showFieldError('group-description', fldDescription, 'Description is required.');
        valid = false;
    } else if (desc.length > 300) {
        showFieldError('group-description', fldDescription, 'Description must be 300 characters or fewer.');
        valid = false;
    }

    return valid;
}

/* ============================================================
   PAYLOAD BUILDER
   Builds the transaction object to send to the API.
   ============================================================ */
function buildPayload() {
    const payload = {
        type:        fldType.value,
        category:    fldCategory.value,
        amount:      parseFloat(fldAmount.value),
        date:        fldDate.value,
        description: fldDescription.value.trim(),
    };

    if (editId) {
        // On update, include status
        payload.status = fldStatus.value || 'pending';
    } else {
        // New transaction defaults
        payload.status    = 'pending';
        payload.reference = generateReference();
    }

    return payload;
}

/* ============================================================
   NUMERIC-ONLY AMOUNT ENFORCEMENT
   ============================================================ */
/**
 * On input: strip any non-numeric characters except a single decimal point.
 */
function enforceNumeric() {
    let val = fldAmount.value;

    // Remove anything that's not a digit or a dot
    val = val.replace(/[^0-9.]/g, '');

    // Allow only one decimal point
    const parts = val.split('.');
    if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    if (parts[1] !== undefined && parts[1].length > 2) {
        val = parts[0] + '.' + parts[1].slice(0, 2);
    }

    fldAmount.value = val;
    updatePreview();
}

/**
 * On keydown: block characters that aren't digits, dot, backspace, delete,
 * arrow keys, tab, home, end.
 */
function blockInvalidAmountKeys(e) {
    const allowed = [
        'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'Enter', '.'
    ];
    const isDigit  = e.key >= '0' && e.key <= '9';
    const isCtrl   = e.ctrlKey || e.metaKey; // allow Ctrl+A, Ctrl+C etc.

    if (!isDigit && !allowed.includes(e.key) && !isCtrl) {
        e.preventDefault();
    }

    // Block a second decimal point
    if (e.key === '.' && fldAmount.value.includes('.')) {
        e.preventDefault();
    }
}

/* ============================================================
   LIVE PREVIEW
   ============================================================ */
function updatePreview() {
    // Reference
    previewRef.textContent = editId
        ? `TXN-${String(editId).padStart(3, '0')}`
        : '(auto-generated)';

    // Type
    previewType.textContent = fldType.value
        ? capitalize(fldType.value)
        : '—';

    // Category
    const cat = fldCategory.value;
    if (cat) {
        previewCat.innerHTML = `<span class="category-badge ${cat}">${capitalize(cat)}</span>`;
    } else {
        previewCat.textContent = '—';
    }

    // Amount
    const amount = parseFloat(fldAmount.value);
    previewAmount.textContent = (!isNaN(amount) && amount > 0)
        ? formatCurrency(amount)
        : '$0.00';

    // Date
    previewDate.textContent = fldDate.value
        ? formatDate(fldDate.value)
        : '—';

    // Description
    const desc = fldDescription.value.trim();
    previewDesc.textContent = desc
        ? (desc.length > 60 ? desc.slice(0, 60) + '…' : desc)
        : '—';
}

/* ============================================================
   CHARACTER COUNTER
   ============================================================ */
function updateCharCount() {
    const len = fldDescription.value.length;
    if (charCount) {
        charCount.textContent = len;
        // Warn when approaching limit
        charCount.style.color = len >= 280
            ? 'var(--color-danger)'
            : len >= 240
                ? 'var(--color-warning)'
                : '';
    }
}

/* ============================================================
   LOADING STATE
   ============================================================ */
function setLoading(state) {
    isSaving = state;
    btnSubmit.disabled = state;

    if (state) {
        btnSubmitText.innerHTML = editId
            ? '<i class="fa-solid fa-spinner fa-spin"></i> Updating…'
            : '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        if (btnSpinner) btnSpinner.classList.remove('d-none');
    } else {
        btnSubmitText.innerHTML = editId
            ? '<i class="fa-solid fa-floppy-disk"></i> Update Transaction'
            : '<i class="fa-solid fa-floppy-disk"></i> Save Transaction';
        if (btnSpinner) btnSpinner.classList.add('d-none');
    }
}

/* ============================================================
   INLINE FIELD ERROR HELPERS
   ============================================================ */
function showFieldError(groupId, inputEl, message) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.classList.add('has-error');

    let errEl = group.querySelector('.error-message');
    if (!errEl) {
        errEl = document.createElement('span');
        errEl.className = 'error-message';
        group.appendChild(errEl);
    }
    errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;

    // Auto-clear on next user input
    inputEl.addEventListener('input', () => clearFieldError(groupId), { once: true });
    inputEl.addEventListener('change', () => clearFieldError(groupId), { once: true });
}

function clearFieldError(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.classList.remove('has-error');
    const errEl = group.querySelector('.error-message');
    if (errEl) errEl.remove();
}

function clearAllErrors() {
    ['group-type', 'group-category', 'group-amount', 'group-date', 'group-description'].forEach(clearFieldError);
}

/* ============================================================
   FORM-LEVEL ALERT
   ============================================================ */
function showAlert(message, type = 'error') {
    if (!formAlert) return;
    const icon = type === 'error' ? 'circle-xmark' : 'circle-check';
    formAlert.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${message}`;
    formAlert.className = `form-alert alert-${type}`;
    formAlert.classList.remove('d-none');
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
    if (!formAlert) return;
    formAlert.classList.add('d-none');
}

/* ============================================================
   UTILITIES
   ============================================================ */
function todayISO() {
    return new Date().toISOString().split('T')[0];
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Generate a reference like TXN-014 based on timestamp */
function generateReference() {
    const num = Date.now() % 10000;
    return `TXN-${String(num).padStart(3, '0')}`;
}
