/**
 * settings.js — Settings Page Logic (Team Member 5)
 * ===================================================
 * Wires up all interactivity on settings.html.
 * Uses the leader's shared utilities:
 *   - requireAuth / getCurrentUser from utils.js
 *   - showToast from utils.js
 *   - initLogout from logout.js
 *   - Layout.init from layout.js
 *
 * Profile data is read/written via profile.js using the
 * shared "userProfile" localStorage key.
 */

import { requireAuth, showToast } from "./utils.js";
import {
    getProfile,
    saveProfile,
    resetProfile,
    initProfile,
    applyProfileToNavbar,
    getAvatarFallback
} from "./profile.js";

/* ── Preferences key ─────────────────────────────────────── */
const PREFS_KEY = "pos_preferences";

const DEFAULT_PREFS = {
    emailNotifications: true,
    smsNotifications:   false,
    transactionAlerts:  true,
    loginAlerts:        true,
    reportDigest:       false,
    compactView:        false,
};

/* ── Bootstrap ───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    // Guard: redirect to login if not authenticated
    requireAuth("login.html");

    // Ensure profile exists in localStorage
    initProfile();

    // Wire everything up
    initTabs();
    renderProfileDisplay();
    prefillEditForm();
    initEditForm();
    initPasswordSection();
    initAvatarModal();
    initPreferences();
    initDangerZone();

    // Re-sync display if another tab updates the profile
    window.addEventListener("storage", (e) => {
        if (e.key === "userProfile") {
            renderProfileDisplay();
            prefillEditForm();
        }
    });

    // Re-sync if settings.js itself fires the event
    window.addEventListener("profileUpdated", () => {
        renderProfileDisplay();
    });
});

/* ══════════════════════════════════════════════════════════
   TAB NAVIGATION
══════════════════════════════════════════════════════════ */
function initTabs() {
    const tabs   = document.querySelectorAll(".settings-tab[data-tab]");
    const panels = document.querySelectorAll(".settings-panel[data-panel]");

    function activateTab(targetId) {
        tabs.forEach(tab => {
            const active = tab.dataset.tab === targetId;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active);
        });
        panels.forEach(panel => {
            panel.classList.toggle("active", panel.dataset.panel === targetId);
        });
        // Persist across reloads
        localStorage.setItem("pos_settings_tab", targetId);
    }

    tabs.forEach(tab => {
        tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    });

    // [data-tab-goto] buttons (e.g. "Edit Profile" button on profile panel)
    document.querySelectorAll("[data-tab-goto]").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tabGoto;
            document.querySelector(`.settings-tab[data-tab="${target}"]`)?.click();
        });
    });

    // Restore last active tab
    const saved = localStorage.getItem("pos_settings_tab") || "profile";
    activateTab(saved);
}

/* ══════════════════════════════════════════════════════════
   PROFILE DISPLAY (view-only panel)
══════════════════════════════════════════════════════════ */
function renderProfileDisplay() {
    const p = getProfile();

    /* Avatar images (settings page uses <img> elements) */
    document.querySelectorAll("[data-settings-avatar]").forEach(img => {
        if (p.avatar) {
            img.src = p.avatar;
        } else {
            img.src = getAvatarFallback(p.fullName);
        }
        img.onerror = () => { img.src = getAvatarFallback(p.fullName); };
    });

    /* Named display fields */
    const display = {
        "settings-full-name":        p.fullName,
        "settings-full-name-detail": p.fullName,
        "settings-username":         "@" + p.username,
        "settings-username-detail":  p.username,
        "settings-email":            p.email,
        "settings-phone":            p.phone,
        "settings-role":             p.role,
        "settings-role-detail":      p.role,
        "settings-department":       p.department,
    };

    for (const [id, value] of Object.entries(display)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "—";
    }

    /* Keep leader's navbar/sidebar IDs in sync */
    applyProfileToNavbar(p);
}

/* ══════════════════════════════════════════════════════════
   EDIT PROFILE FORM
══════════════════════════════════════════════════════════ */
function prefillEditForm() {
    const p = getProfile();
    _setVal("edit-full-name",   p.fullName);
    _setVal("edit-username",    p.username);
    _setVal("edit-email",       p.email);
    _setVal("edit-phone",       p.phone);
    _setVal("edit-department",  p.department);
}

function initEditForm() {
    const form      = document.getElementById("edit-profile-form");
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (!form) return;

    cancelBtn?.addEventListener("click", () => {
        prefillEditForm();
        showToast("Changes discarded.", "info");
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const fullName   = _getVal("edit-full-name");
        const username   = _getVal("edit-username");
        const email      = _getVal("edit-email");
        const phone      = _getVal("edit-phone");
        const department = _getVal("edit-department");

        // Validation
        if (!fullName) {
            showToast("Full name is required.", "error");
            document.getElementById("edit-full-name")?.focus();
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast("Please enter a valid email address.", "error");
            document.getElementById("edit-email")?.focus();
            return;
        }
        if (phone && !/^[+\d\s\-().]{7,20}$/.test(phone)) {
            showToast("Please enter a valid phone number.", "error");
            document.getElementById("edit-phone")?.focus();
            return;
        }

        saveProfile({ fullName, username, email, phone, department });
        renderProfileDisplay();
        showToast("Profile updated successfully!", "success");
    });
}

/* ══════════════════════════════════════════════════════════
   PASSWORD CHANGE
══════════════════════════════════════════════════════════ */
function initPasswordSection() {
    const form = document.getElementById("change-password-form");
    if (!form) return;

    // Toggle password visibility buttons
    document.querySelectorAll(".password-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.closest(".password-wrap")?.querySelector(".form-control");
            if (!input) return;
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            btn.querySelector("i").className = `fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`;
        });
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const current = _getVal("current-password");
        const next    = _getVal("new-password");
        const confirm = _getVal("confirm-password");

        if (!current) { showToast("Please enter your current password.", "error"); return; }
        if (!next || next.length < 8) { showToast("New password must be at least 8 characters.", "error"); return; }
        if (next !== confirm) { showToast("New passwords do not match.", "error"); return; }

        // Client-side only — acknowledge
        form.reset();
        showToast("Password updated successfully!", "success");
    });
}

/* ══════════════════════════════════════════════════════════
   AVATAR MODAL
══════════════════════════════════════════════════════════ */
function initAvatarModal() {
    const modal      = document.getElementById("avatar-modal");
    const openBtns   = document.querySelectorAll("[data-open-avatar-modal]");
    const closeBtn   = document.getElementById("avatar-modal-close");
    const cancelBtn  = document.getElementById("avatar-modal-cancel");
    const saveBtn    = document.getElementById("avatar-modal-save");
    const urlInput   = document.getElementById("avatar-url-input");
    const fileInput  = document.getElementById("avatar-file-input");
    const fileBtn    = document.getElementById("avatar-file-btn");
    const previewImg = document.getElementById("avatar-preview");
    if (!modal) return;

    function openModal() {
        const p = getProfile();
        if (urlInput) urlInput.value = p.avatar || "";
        if (previewImg) {
            previewImg.src = p.avatar || getAvatarFallback(p.fullName);
            previewImg.onerror = () => { previewImg.src = getAvatarFallback(p.fullName); };
        }
        modal.classList.add("active");
    }

    function closeModal() { modal.classList.remove("active"); }

    openBtns.forEach(btn => btn.addEventListener("click", openModal));
    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // Live URL preview
    urlInput?.addEventListener("input", () => {
        const url = urlInput.value.trim();
        if (url && previewImg) {
            previewImg.src = url;
            previewImg.onerror = () => { previewImg.src = getAvatarFallback(getProfile().fullName); };
        }
    });

    // File → data URL
    fileBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { showToast("Please select an image file.", "error"); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (previewImg) previewImg.src = ev.target.result;
            if (urlInput)   urlInput.value = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Save
    saveBtn?.addEventListener("click", () => {
        const src = urlInput?.value.trim();
        if (!src) { showToast("Please enter a URL or upload an image.", "error"); return; }
        saveProfile({ avatar: src });
        renderProfileDisplay();
        closeModal();
        showToast("Avatar updated!", "success");
    });
}

/* ══════════════════════════════════════════════════════════
   PREFERENCE TOGGLES
══════════════════════════════════════════════════════════ */
function getPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    } catch { return { ...DEFAULT_PREFS }; }
}

function initPreferences() {
    const prefs = getPrefs();
    const map = {
        "pref-email-notifications": "emailNotifications",
        "pref-sms-notifications":   "smsNotifications",
        "pref-transaction-alerts":  "transactionAlerts",
        "pref-login-alerts":        "loginAlerts",
        "pref-report-digest":       "reportDigest",
        "pref-compact-view":        "compactView",
    };

    for (const [elId, key] of Object.entries(map)) {
        const toggle = document.getElementById(elId);
        if (!toggle) continue;
        toggle.checked = prefs[key] ?? DEFAULT_PREFS[key];
        toggle.addEventListener("change", () => {
            const current = getPrefs();
            localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, [key]: toggle.checked }));
            showToast(toggle.checked ? "Preference enabled." : "Preference disabled.", "info");
        });
    }
}

/* ══════════════════════════════════════════════════════════
   DANGER ZONE
══════════════════════════════════════════════════════════ */
function initDangerZone() {
    document.getElementById("reset-profile-btn")?.addEventListener("click", () => {
        if (!confirm("Reset your profile to defaults? Your transactions will not be affected.")) return;
        resetProfile();
        prefillEditForm();
        renderProfileDisplay();
        showToast("Profile reset to defaults.", "success");
    });

    document.getElementById("clear-data-btn")?.addEventListener("click", () => {
        if (!confirm("This will clear ALL saved data (profile, preferences). This cannot be undone. Continue?")) return;
        // Keep the session keys so the user is not logged out immediately
        const session = localStorage.getItem("pos_session");
        const user    = localStorage.getItem("pos_user");
        const remembered = localStorage.getItem("pos_remembered_email");
        localStorage.clear();
        if (session)    localStorage.setItem("pos_session", session);
        if (user)       localStorage.setItem("pos_user", user);
        if (remembered) localStorage.setItem("pos_remembered_email", remembered);
        showToast("All saved data cleared. Reloading…", "success");
        setTimeout(() => window.location.reload(), 1800);
    });
}

/* ── Mini helpers ────────────────────────────────────────── */
function _getVal(id) {
    return (document.getElementById(id)?.value || "").trim();
}

function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
}
