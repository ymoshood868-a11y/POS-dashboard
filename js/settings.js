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
  fetchProfile,
  saveProfile,
  resetProfile,
  initProfile,
  applyProfileToNavbar,
  getAvatarFallback,
} from "./profile.js";
import { setTheme } from "./theme.js";

/* ── Preferences key ─────────────────────────────────────── */
const PREFS_KEY = "pos_preferences";
const NOTIF_KEY = "pos_notifications";
const ACTIVITY_LOG_KEY = "pos_activity_log";
const APPEARANCE_KEY = "pos_appearance";

const DEFAULT_PREFS = {
  emailNotifications: true,
  smsNotifications: false,
  transactionAlerts: true,
  loginAlerts: true,
  reportDigest: false,
  compactView: false,
};

const DEFAULT_NOTIFS = {
  email: true,
  sms: false,
  browser: false,
  transactions: true,
  login: true,
  failed: true,
  digest: false,
  promo: false,
  quietEnabled: false,
  quietFrom: "22:00",
  quietTo: "08:00",
};

/* ── Bootstrap ───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  // Guard: redirect to login if not authenticated
  requireAuth("login.html");

  // Load profile from JSON Server first, then render
  await initProfile();

  // Wire everything up
  renderProfileDisplay();
  prefillEditForm();
  initEditForm();
  initPasswordSection();
  initAvatarModal();
  initPreferences();
  initAppearance();
  initNotifications();
  initActivityLog();
  initDataExport();
  initDangerZone();

  // Log settings page visit
  logActivity("Settings page opened", "system");

  // Re-sync display if profile is updated
  window.addEventListener("profileUpdated", () => {
    renderProfileDisplay();
    prefillEditForm();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "userProfile") {
      renderProfileDisplay();
      prefillEditForm();
    }
  });
});

/* ══════════════════════════════════════════════════════════
   PROFILE DISPLAY (view-only panel)
══════════════════════════════════════════════════════════ */
function renderProfileDisplay() {
  const p = getProfile();

  /* Avatar images (settings page uses <img> elements) */
  document.querySelectorAll("[data-settings-avatar]").forEach((img) => {
    if (p.avatar?.startsWith("emoji:")) {
      // Replace img with an emoji display span
      const em = p.avatar.replace("emoji:", "");
      img.style.display = "none";
      let span = img.parentNode?.querySelector(".avatar-emoji-display");
      if (!span) {
        span = document.createElement("span");
        span.className = "avatar-emoji-display";
        img.parentNode?.insertBefore(span, img);
      }
      span.textContent = em;
    } else {
      // Remove any emoji display
      img.parentNode?.querySelector(".avatar-emoji-display")?.remove();
      img.style.display = "";
      if (p.avatar) {
        img.src = p.avatar;
      } else {
        img.src = getAvatarFallback(p.fullName);
      }
      img.onerror = () => {
        img.src = getAvatarFallback(p.fullName);
      };
    }
  });

  /* Named display fields */
  const display = {
    "settings-full-name": p.fullName,
    "settings-full-name-detail": p.fullName,
    "settings-username": "@" + p.username,
    "settings-username-detail": p.username,
    "settings-email": p.email,
    "settings-phone": p.phone,
    "settings-role": p.role,
    "settings-role-detail": p.role,
    "settings-department": p.department,
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
  _setVal("edit-full-name", p.fullName);
  _setVal("edit-username", p.username);
  _setVal("edit-email", p.email);
  _setVal("edit-phone", p.phone);
  _setVal("edit-department", p.department);
}

function initEditForm() {
  const form = document.getElementById("edit-profile-form");
  const cancelBtn = document.getElementById("cancel-edit-btn");
  if (!form) return;

  cancelBtn?.addEventListener("click", () => {
    prefillEditForm();
    showToast("Changes discarded.", "info");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = _getVal("edit-full-name");
    const username = _getVal("edit-username");
    const email = _getVal("edit-email");
    const phone = _getVal("edit-phone");
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

    await saveProfile({ fullName, username, email, phone, department });
    renderProfileDisplay();
    logActivity("Profile updated", "profile");
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
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn
        .closest(".password-wrap")
        ?.querySelector(".form-control");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.querySelector("i").className =
        `fa-solid ${show ? "fa-eye-slash" : "fa-eye"}`;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = _getVal("current-password");
    const next = _getVal("new-password");
    const confirm = _getVal("confirm-password");

    if (!current) {
      showToast("Please enter your current password.", "error");
      return;
    }
    if (!next || next.length < 8) {
      showToast("New password must be at least 8 characters.", "error");
      return;
    }
    if (next !== confirm) {
      showToast("New passwords do not match.", "error");
      return;
    }

    // Disable the submit button while the request is in flight
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Updating…';
    }

    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch("http://localhost:5000/api/auth/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Password update failed.", "error");
        return;
      }

      form.reset();
      logActivity("Password changed", "security");
      showToast(
        "Password updated successfully! Please log in again.",
        "success",
      );

      // Force re-login so the session token stays fresh
      setTimeout(() => {
        import("./logout.js").then(({ logout }) => logout());
      }, 2000);
    } catch {
      showToast(
        "Could not reach the server. Make sure it is running (cd server && npm start).",
        "error",
        5000,
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fa-solid fa-shield-halved"></i> Update Password';
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════
   AVATAR MODAL
══════════════════════════════════════════════════════════ */

const EMOJI_AVATARS = [
  "😀",
  "😎",
  "🤩",
  "🥸",
  "🧑‍💻",
  "👩‍💼",
  "👨‍💼",
  "🧑‍🎨",
  "👩‍🔬",
  "👨‍🔬",
  "🦸",
  "🦹",
  "🧙",
  "🧝",
  "🧜",
  "🧚",
  "👮",
  "🕵️",
  "💂",
  "🥷",
  "🐯",
  "🦁",
  "🐻",
  "🐼",
  "🐨",
  "🦊",
  "🐺",
  "🦝",
  "🐸",
  "🐙",
  "🌟",
  "⚡",
  "🔥",
  "💎",
  "🚀",
  "🎯",
  "🏆",
  "💡",
  "🎨",
  "🎭",
];

function initAvatarModal() {
  const modal = document.getElementById("avatar-modal");
  const openBtns = document.querySelectorAll("[data-open-avatar-modal]");
  const closeBtn = document.getElementById("avatar-modal-close");
  const cancelBtn = document.getElementById("avatar-modal-cancel");
  const saveBtn = document.getElementById("avatar-modal-save");
  const urlInput = document.getElementById("avatar-url-input");
  const fileInput = document.getElementById("avatar-file-input");
  const fileBtn = document.getElementById("avatar-file-btn");
  const previewImg = document.getElementById("avatar-preview");
  const emojiGrid = document.getElementById("emoji-picker-grid");
  if (!modal) return;

  let _pendingSrc = null; // holds the value to save when Save is clicked
  let _activeEmoji = null; // currently selected emoji button

  /* ── Populate emoji grid ─────────────────────────────── */
  if (emojiGrid) {
    EMOJI_AVATARS.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-avatar-btn";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", `Use ${emoji} as avatar`);
      btn.addEventListener("click", () => {
        // Deselect previous
        _activeEmoji?.classList.remove("active");
        btn.classList.add("active");
        _activeEmoji = btn;
        _pendingSrc = `emoji:${emoji}`;
        // Show emoji preview
        if (previewImg) {
          previewImg.style.display = "none";
        }
        const existing = document.getElementById("emoji-preview-display");
        if (existing) {
          existing.textContent = emoji;
        } else {
          const disp = document.createElement("div");
          disp.id = "emoji-preview-display";
          disp.className = "emoji-preview-display";
          disp.textContent = emoji;
          previewImg?.parentNode?.insertBefore(disp, previewImg);
        }
      });
      emojiGrid.appendChild(btn);
    });
  }

  /* ── Tab switching ───────────────────────────────────── */
  document.querySelectorAll(".avatar-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".avatar-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.avatarTab;
      document.getElementById("avatar-panel-url").style.display =
        target === "url" ? "block" : "none";
      document.getElementById("avatar-panel-emoji").style.display =
        target === "emoji" ? "block" : "none";
    });
  });

  /* ── Open / close ────────────────────────────────────── */
  function openModal() {
    const p = getProfile();
    _pendingSrc = null;
    _activeEmoji = null;

    // Restore emoji tab state if current avatar is an emoji
    if (p.avatar?.startsWith("emoji:")) {
      const em = p.avatar.replace("emoji:", "");
      const existing = document.getElementById("emoji-preview-display");
      if (existing) existing.textContent = em;
      if (previewImg) previewImg.style.display = "none";
      _pendingSrc = p.avatar;
    } else {
      // Remove any emoji display
      document.getElementById("emoji-preview-display")?.remove();
      if (previewImg) previewImg.style.display = "";
      if (urlInput) urlInput.value = p.avatar || "";
      if (previewImg) {
        previewImg.src = p.avatar || getAvatarFallback(p.fullName);
        previewImg.onerror = () => {
          previewImg.src = getAvatarFallback(p.fullName);
        };
      }
    }
    modal.classList.add("active");
  }

  function closeModal() {
    modal.classList.remove("active");
  }

  openBtns.forEach((btn) => btn.addEventListener("click", openModal));
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  /* ── Live URL preview ────────────────────────────────── */
  urlInput?.addEventListener("input", () => {
    const url = urlInput.value.trim();
    _pendingSrc = url || null;
    if (url && previewImg) {
      previewImg.src = url;
      previewImg.onerror = () => {
        previewImg.src = getAvatarFallback(getProfile().fullName);
      };
    }
  });

  /* ── File → data URL ─────────────────────────────────── */
  fileBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      _pendingSrc = ev.target.result;
      if (previewImg) previewImg.src = ev.target.result;
      if (urlInput) urlInput.value = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ── Save ────────────────────────────────────────────── */
  saveBtn?.addEventListener("click", async () => {
    const src = _pendingSrc || urlInput?.value.trim();
    if (!src) {
      showToast(
        "Please enter a URL, upload an image, or pick an emoji.",
        "error",
      );
      return;
    }
    await saveProfile({ avatar: src });
    renderProfileDisplay();
    closeModal();
    showToast("Avatar updated!", "success");
    logActivity("Profile avatar changed", "profile");
  });
}

/* ══════════════════════════════════════════════════════════
   PREFERENCE TOGGLES
══════════════════════════════════════════════════════════ */
function getPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw
      ? { ...DEFAULT_PREFS, ...JSON.parse(raw) }
      : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function initPreferences() {
  const prefs = getPrefs();
  const map = {
    "pref-email-notifications": "emailNotifications",
    "pref-sms-notifications": "smsNotifications",
    "pref-transaction-alerts": "transactionAlerts",
    "pref-login-alerts": "loginAlerts",
    "pref-report-digest": "reportDigest",
    "pref-compact-view": "compactView",
  };

  for (const [elId, key] of Object.entries(map)) {
    const toggle = document.getElementById(elId);
    if (!toggle) continue;
    toggle.checked = prefs[key] ?? DEFAULT_PREFS[key];
    toggle.addEventListener("change", () => {
      const current = getPrefs();
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ ...current, [key]: toggle.checked }),
      );
      showToast(
        toggle.checked ? "Preference enabled." : "Preference disabled.",
        "info",
      );
    });
  }
}

/* ══════════════════════════════════════════════════════════
   DANGER ZONE
══════════════════════════════════════════════════════════ */
function initDangerZone() {
  document
    .getElementById("reset-profile-btn")
    ?.addEventListener("click", async () => {
      if (
        !confirm(
          "Reset your profile to defaults? Your transactions will not be affected.",
        )
      )
        return;
      await resetProfile();
      prefillEditForm();
      renderProfileDisplay();
      showToast("Profile reset to defaults.", "success");
    });

  document.getElementById("clear-data-btn")?.addEventListener("click", () => {
    if (
      !confirm(
        "This will clear ALL saved data (profile, preferences). This cannot be undone. Continue?",
      )
    )
      return;
    const session = localStorage.getItem("pos_session");
    const user = localStorage.getItem("pos_user");
    const remembered = localStorage.getItem("pos_remembered_email");
    localStorage.clear();
    if (session) localStorage.setItem("pos_session", session);
    if (user) localStorage.setItem("pos_user", user);
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

/* ══════════════════════════════════════════════════════════
   APPEARANCE PANEL  (dark / light / system + accent)
══════════════════════════════════════════════════════════ */

/* Accent colour map — overrides --color-gold variables */
const ACCENT_MAP = {
  gold: { gold: "#c9a84c", light: "#e2c06b", dark: "#a8872e" },
  blue: { gold: "#3b82f6", light: "#60a5fa", dark: "#1d4ed8" },
  green: { gold: "#22c55e", light: "#4ade80", dark: "#15803d" },
  purple: { gold: "#a855f7", light: "#c084fc", dark: "#7e22ce" },
  red: { gold: "#ef4444", light: "#f87171", dark: "#b91c1c" },
};

function getAppearancePrefs() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          theme: "dark",
          accent: "gold",
          compact: false,
          largeText: false,
          reduceMotion: false,
        };
  } catch {
    return {
      theme: "dark",
      accent: "gold",
      compact: false,
      largeText: false,
      reduceMotion: false,
    };
  }
}

function saveAppearancePrefs(updates) {
  const current = getAppearancePrefs();
  const next = { ...current, ...updates };
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  return next;
}

function applyAccent(accentKey) {
  const colors = ACCENT_MAP[accentKey] || ACCENT_MAP.gold;
  document.documentElement.style.setProperty("--color-gold", colors.gold);
  document.documentElement.style.setProperty(
    "--color-gold-light",
    colors.light,
  );
  document.documentElement.style.setProperty("--color-gold-dark", colors.dark);
}

function applyDensity(compact, largeText, reduceMotion) {
  const html = document.documentElement;
  html.classList.toggle("compact-mode", !!compact);
  html.classList.toggle("large-text", !!largeText);
  html.classList.toggle("reduce-motion", !!reduceMotion);
}

function initAppearance() {
  const prefs = getAppearancePrefs();

  /* ── Theme picker ─────────────────────────────────────── */
  const picker = document.getElementById("theme-picker");
  if (picker) {
    // Set initial active state
    _setActiveThemeOption(prefs.theme);

    picker.querySelectorAll(".theme-option").forEach((opt) => {
      const activate = () => {
        const val = opt.dataset.themeValue;
        setTheme(val);
        saveAppearancePrefs({ theme: val });
        _setActiveThemeOption(val);
        logActivity(`Theme changed to ${val}`, "profile");
      };
      opt.addEventListener("click", activate);
      opt.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  /* ── Accent swatches ──────────────────────────────────── */
  applyAccent(prefs.accent);
  _setActiveAccent(prefs.accent);

  document.querySelectorAll(".accent-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.accent;
      applyAccent(key);
      saveAppearancePrefs({ accent: key });
      _setActiveAccent(key);
      logActivity(`Accent colour changed to ${key}`, "profile");
    });
  });

  /* ── Density toggles ──────────────────────────────────── */
  const compactEl = document.getElementById("appearance-compact");
  const largeTextEl = document.getElementById("appearance-large-text");
  const reduceMotionEl = document.getElementById("appearance-reduce-motion");

  if (compactEl) compactEl.checked = prefs.compact ?? false;
  if (largeTextEl) largeTextEl.checked = prefs.largeText ?? false;
  if (reduceMotionEl) reduceMotionEl.checked = prefs.reduceMotion ?? false;

  // Apply persisted density on load
  applyDensity(prefs.compact, prefs.largeText, prefs.reduceMotion);

  /* ── Save button ──────────────────────────────────────── */
  document
    .getElementById("save-appearance-btn")
    ?.addEventListener("click", () => {
      const compact = compactEl?.checked ?? false;
      const largeText = largeTextEl?.checked ?? false;
      const reduceMotion = reduceMotionEl?.checked ?? false;
      saveAppearancePrefs({ compact, largeText, reduceMotion });
      applyDensity(compact, largeText, reduceMotion);
      logActivity("Appearance settings saved", "profile");
      showToast("Appearance saved!", "success");
    });

  /* ── React to OS change when "system" is active ───────── */
  window.addEventListener("themeChanged", (e) => {
    _setActiveThemeOption(e.detail.pref);
  });
}

function _setActiveThemeOption(pref) {
  document.querySelectorAll(".theme-option").forEach((opt) => {
    const isActive = opt.dataset.themeValue === pref;
    opt.classList.toggle("active", isActive);
    opt.setAttribute("aria-checked", String(isActive));
  });
}

function _setActiveAccent(key) {
  document.querySelectorAll(".accent-swatch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.accent === key);
  });
}

/* ══════════════════════════════════════════════════════════
   NOTIFICATIONS PANEL
══════════════════════════════════════════════════════════ */
function getNotifPrefs() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw
      ? { ...DEFAULT_NOTIFS, ...JSON.parse(raw) }
      : { ...DEFAULT_NOTIFS };
  } catch {
    return { ...DEFAULT_NOTIFS };
  }
}

function saveNotifPrefs(updates) {
  const current = getNotifPrefs();
  localStorage.setItem(NOTIF_KEY, JSON.stringify({ ...current, ...updates }));
}

function initNotifications() {
  const prefs = getNotifPrefs();

  // Channel toggles
  const channelMap = {
    "notif-email": "email",
    "notif-sms": "sms",
    "notif-browser": "browser",
  };
  // Event toggles
  const eventMap = {
    "notif-transactions": "transactions",
    "notif-login": "login",
    "notif-failed": "failed",
    "notif-digest": "digest",
    "notif-promo": "promo",
  };

  const allMap = { ...channelMap, ...eventMap };

  for (const [elId, key] of Object.entries(allMap)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    el.checked = prefs[key] ?? DEFAULT_NOTIFS[key];
  }

  // Quiet hours
  const quietEnabled = document.getElementById("notif-quiet-enabled");
  const quietFrom = document.getElementById("quiet-from");
  const quietTo = document.getElementById("quiet-to");
  const quietBody = document.getElementById("quiet-hours-body");

  if (quietEnabled) {
    quietEnabled.checked = prefs.quietEnabled;
    _updateQuietHoursState(prefs.quietEnabled, quietBody);
    quietEnabled.addEventListener("change", () => {
      _updateQuietHoursState(quietEnabled.checked, quietBody);
    });
  }
  if (quietFrom) quietFrom.value = prefs.quietFrom || "22:00";
  if (quietTo) quietTo.value = prefs.quietTo || "08:00";

  // Save button
  document
    .getElementById("save-notifications-btn")
    ?.addEventListener("click", () => {
      const updates = {};
      for (const [elId, key] of Object.entries(allMap)) {
        const el = document.getElementById(elId);
        if (el) updates[key] = el.checked;
      }
      updates.quietEnabled = quietEnabled?.checked ?? false;
      updates.quietFrom = quietFrom?.value || "22:00";
      updates.quietTo = quietTo?.value || "08:00";
      saveNotifPrefs(updates);
      logActivity("Notification settings updated", "profile");
      showToast("Notification settings saved!", "success");
    });
}

function _updateQuietHoursState(enabled, container) {
  if (!container) return;
  container.classList.toggle("disabled", !enabled);
}

/* ══════════════════════════════════════════════════════════
   ACTIVITY LOG PANEL
══════════════════════════════════════════════════════════ */

/** Log a new activity entry (called from other init functions) */
export function logActivity(title, type = "system") {
  const log = _getActivityLog();
  const entry = {
    id: Date.now(),
    title,
    type,
    time: new Date().toISOString(),
  };
  log.unshift(entry); // newest first
  // Cap at 100 entries
  if (log.length > 100) log.length = 100;
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(log));
}

function _getActivityLog() {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_KEY);
    return raw ? JSON.parse(raw) : _buildDefaultLog();
  } catch {
    return _buildDefaultLog();
  }
}

function _buildDefaultLog() {
  // Seed some initial entries so the panel isn't empty on first visit
  const now = Date.now();
  return [
    {
      id: now - 1000,
      title: "Logged in successfully",
      type: "login",
      time: new Date(now - 5 * 60000).toISOString(),
    },
    {
      id: now - 2000,
      title: "Dashboard viewed",
      type: "system",
      time: new Date(now - 10 * 60000).toISOString(),
    },
    {
      id: now - 3000,
      title: "Settings page opened",
      type: "system",
      time: new Date(now - 11 * 60000).toISOString(),
    },
  ];
}

let _activeFilter = "all";

function initActivityLog() {
  // Seed default if log is empty
  if (!localStorage.getItem(ACTIVITY_LOG_KEY)) {
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(_buildDefaultLog()));
  }

  renderActivityLog(_activeFilter);

  // Filter buttons
  document.querySelectorAll(".activity-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".activity-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _activeFilter = btn.dataset.filter || "all";
      renderActivityLog(_activeFilter);
    });
  });

  // Clear log button
  document
    .getElementById("clear-activity-btn")
    ?.addEventListener("click", () => {
      if (!confirm("Clear the entire activity log? This cannot be undone."))
        return;
      localStorage.removeItem(ACTIVITY_LOG_KEY);
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([]));
      renderActivityLog(_activeFilter);
      showToast("Activity log cleared.", "info");
    });
}

function renderActivityLog(filter = "all") {
  const list = document.getElementById("activity-list");
  const empty = document.getElementById("activity-empty");
  if (!list) return;

  const log = _getActivityLog();
  const filtered =
    filter === "all" ? log : log.filter((e) => e.type === filter);

  // Remove old items (keep the empty placeholder)
  list.querySelectorAll(".activity-item").forEach((el) => el.remove());

  if (filtered.length === 0) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  filtered.forEach((entry) => {
    const timeAgo = _timeAgo(new Date(entry.time));
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `
      <span class="activity-dot dot-${entry.type}"></span>
      <div class="activity-body">
        <div class="activity-title">${_escHtml(entry.title)}</div>
        <div class="activity-meta">
          <span class="activity-type-badge ${entry.type}">${entry.type}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

function _timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ══════════════════════════════════════════════════════════
   DATA EXPORT PANEL
══════════════════════════════════════════════════════════ */
const TXN_API_URL = "http://localhost:3000";

let _exportFmt = "csv";

function initDataExport() {
  // Set default dates: last 30 days → today
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const toEl = document.getElementById("export-date-to");
  const fromEl = document.getElementById("export-date-from");
  if (toEl) toEl.value = _toDateInput(toDate);
  if (fromEl) fromEl.value = _toDateInput(fromDate);

  // Format selector buttons
  document.querySelectorAll(".export-fmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".export-fmt-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _exportFmt = btn.dataset.fmt || "csv";
    });
  });

  // Preview button
  document
    .getElementById("export-preview-btn")
    ?.addEventListener("click", async () => {
      const rows = await _getFilteredTransactions();
      _renderExportPreview(rows);
    });

  // Download button
  document
    .getElementById("export-download-btn")
    ?.addEventListener("click", async () => {
      const rows = await _getFilteredTransactions();
      if (rows.length === 0) {
        showToast("No transactions match your filters.", "warning");
        return;
      }
      if (_exportFmt === "csv") {
        _downloadCSV(rows);
      } else {
        _downloadJSON(rows);
      }
      logActivity(
        `Exported ${rows.length} transactions as ${_exportFmt.toUpperCase()}`,
        "system",
      );
      showToast(
        `${rows.length} transaction(s) exported as ${_exportFmt.toUpperCase()}.`,
        "success",
      );
    });

  // Close preview
  document
    .getElementById("export-preview-close")
    ?.addEventListener("click", () => {
      const wrap = document.getElementById("export-preview-wrap");
      if (wrap) wrap.style.display = "none";
    });

  // Profile export
  document
    .getElementById("export-profile-btn")
    ?.addEventListener("click", () => {
      const profile = getProfile();
      // Strip avatar data-URLs to keep file small
      const safe = { ...profile };
      if (safe.avatar && safe.avatar.startsWith("data:"))
        safe.avatar = "[base64-omitted]";
      _downloadBlob(
        JSON.stringify(safe, null, 2),
        "profile.json",
        "application/json",
      );
      showToast("Profile data exported.", "success");
    });

  // Preferences export
  document.getElementById("export-prefs-btn")?.addEventListener("click", () => {
    const prefs = {
      preferences: getPrefs(),
      notifications: getNotifPrefs(),
    };
    _downloadBlob(
      JSON.stringify(prefs, null, 2),
      "preferences.json",
      "application/json",
    );
    showToast("Preferences exported.", "success");
  });
}

async function _getFilteredTransactions() {
  const fromVal = document.getElementById("export-date-from")?.value || "";
  const toVal = document.getElementById("export-date-to")?.value || "";
  const category = document.getElementById("export-category")?.value || "all";
  const statusVal = document.getElementById("export-status")?.value || "all";

  let txns = [];
  try {
    const res = await fetch(`${TXN_API_URL}/transactions`);
    if (res.ok) txns = await res.json();
  } catch {
    showToast("Server offline — no transactions to export.", "warning");
    return [];
  }

  return txns.filter((t) => {
    if (fromVal && t.date < fromVal) return false;
    if (toVal && t.date > toVal) return false;
    if (category !== "all" && t.category !== category) return false;
    if (statusVal !== "all" && t.status !== statusVal) return false;
    return true;
  });
}

function _renderExportPreview(rows) {
  const wrap = document.getElementById("export-preview-wrap");
  const count = document.getElementById("export-preview-count");
  const table = document.getElementById("export-preview-table");
  if (!wrap || !table) return;

  if (rows.length === 0) {
    showToast("No transactions match your filters.", "warning");
    wrap.style.display = "none";
    return;
  }

  const cols = [
    "reference",
    "date",
    "description",
    "category",
    "amount",
    "status",
  ];

  // Build header
  table.querySelector("thead").innerHTML =
    `<tr>${cols.map((c) => `<th>${_escHtml(c)}</th>`).join("")}</tr>`;

  // Build rows (max 10 preview)
  const preview = rows.slice(0, 10);
  table.querySelector("tbody").innerHTML = preview
    .map(
      (r) =>
        `<tr>${cols.map((c) => `<td>${_escHtml(r[c] ?? "—")}</td>`).join("")}</tr>`,
    )
    .join("");

  if (count) {
    count.textContent =
      rows.length > 10
        ? `${rows.length} records (showing first 10)`
        : `${rows.length} record${rows.length !== 1 ? "s" : ""}`;
  }

  wrap.style.display = "block";
}

function _downloadCSV(rows) {
  const cols = [
    "id",
    "reference",
    "date",
    "description",
    "category",
    "amount",
    "status",
  ];
  const header = cols.join(",");
  const body = rows.map((r) =>
    cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","),
  );
  const csv = [header, ...body].join("\n");
  _downloadBlob(csv, "transactions.csv", "text/csv");
}

function _downloadJSON(rows) {
  _downloadBlob(
    JSON.stringify(rows, null, 2),
    "transactions.json",
    "application/json",
  );
}

function _downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _toDateInput(date) {
  return date.toISOString().split("T")[0];
}
