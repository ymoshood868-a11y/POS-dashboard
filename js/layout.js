/**
 * layout.js — Shared layout controller
 * POS Transaction Dashboard
 *
 * Every protected page imports and calls Layout.init().
 * Handles: component injection, sidebar toggle, active nav,
 *          user profile, dropdown, logout, live clock,
 *          mobile overlay, and responsive toggle.
 *
 * USAGE IN ANY PAGE:
 * ------------------
 *   import Layout from './layout.js';
 *
 *   document.addEventListener('DOMContentLoaded', () => {
 *     Layout.init({
 *       pageTitle:  'Transactions',     // shown in navbar
 *       breadcrumb: 'Transaction List'  // shown under title
 *     });
 *   });
 */

import {
  requireAuth,
  getCurrentUser,
  getTodayString,
  getLiveTime,
  isAdmin,
} from "./utils.js";
import { initLogout } from "./logout.js";

/* ============================================================
   Layout public API
   ============================================================ */
const Layout = {
  /**
   * Bootstrap the full layout for a page.
   * @param {{ pageTitle?: string, breadcrumb?: string }} opts
   */
  async init(opts = {}) {
    requireAuth("login.html");

    // Inject shared components into placeholder elements (if used),
    // then wire everything up.
    await Promise.all([
      this._loadComponent("sidebar", "#sidebar-placeholder"),
      this._loadComponent("navbar", "#navbar-placeholder"),
      this._loadComponent("footer", "#footer-placeholder"),
    ]);

    this._initUserProfile();
    this._initSidebar();
    this._setActiveNavLink();
    this._applyRoleNav();
    this._initNavbarMeta(opts.pageTitle, opts.breadcrumb);
    this._initUserDropdown();
    this._initClock();
    this._initResponsiveToggle();
    this._applyAppearance();
    initLogout();
  },

  /* ----------------------------------------------------------
     Component loader
     Fetches an HTML component and injects it into a selector.
     Falls back silently if the placeholder doesn't exist
     (for pages that inline the components directly).
  ---------------------------------------------------------- */
  async _loadComponent(name, selector) {
    const el = document.querySelector(selector);
    if (!el) return; // component is inlined — skip fetch
    try {
      const res = await fetch(`components/${name}.html`);
      const html = await res.text();
      el.outerHTML = html; // replace placeholder with real HTML
    } catch (e) {
      console.warn(`[Layout] Could not load component: ${name}`, e);
    }
  },

  /* ----------------------------------------------------------
     User profile — populates all avatar/name/email targets
     Also fetches full profile from JSON Server to restore avatar.
  ---------------------------------------------------------- */
  _initUserProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const initials = _getInitials(user.name);

    // Set initials immediately (instant render, no flash)
    _setText("nav-user-avatar", initials);
    _setText("nav-user-name", user.name);
    _setText("sidebar-user-avatar", initials);
    _setText("sidebar-user-name", user.name);
    _setText("sidebar-user-role", _capitalize(user.role || "user"));
    _setText("dropdown-avatar", initials);
    _setText("dropdown-user-name", user.name);
    _setText("dropdown-user-email", user.email || "");
    _setText("welcome-name", user.name.split(" ")[0]);

    // Time-aware greeting
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
    _setText("welcome-greeting-text", greeting);

    // Apply cached avatar from localStorage instantly (no network wait)
    try {
      const cached = localStorage.getItem("userProfile");
      if (cached) {
        const profile = JSON.parse(cached);
        if (profile.avatar) _applyAvatarToDOM(profile.avatar, initials);
      }
    } catch {
      /* ignore */
    }

    // Then fetch fresh profile from JSON Server and update if avatar changed
    fetch(`http://localhost:3000/users/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const avatar = data.avatar || "";
        // Cache the fresh profile
        const profile = {
          id: data.id,
          fullName: data.name || user.name,
          username: data.username || "",
          email: data.email || user.email,
          phone: data.phone || "",
          role: data.role
            ? data.role.charAt(0).toUpperCase() + data.role.slice(1)
            : "User",
          department: data.department || "",
          avatar,
        };
        localStorage.setItem("userProfile", JSON.stringify(profile));
        if (avatar) _applyAvatarToDOM(avatar, initials);
      })
      .catch(() => {
        /* server offline — cached data already applied */
      });
  },

  /* ----------------------------------------------------------
     Sidebar — collapse/expand + mobile overlay
  ---------------------------------------------------------- */
  _initSidebar() {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("btn-sidebar-toggle");
    const mobileBtn = document.getElementById("btn-mobile-toggle");
    const overlay = document.getElementById("sidebar-overlay");
    if (!sidebar) return;

    // Restore persisted state
    if (localStorage.getItem("pos_sidebar_collapsed") === "true") {
      sidebar.classList.add("collapsed");
    }

    // Desktop toggle
    toggleBtn?.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      localStorage.setItem(
        "pos_sidebar_collapsed",
        sidebar.classList.contains("collapsed"),
      );
    });

    // Mobile open
    mobileBtn?.addEventListener("click", () => {
      sidebar.classList.add("mobile-open");
      overlay?.classList.add("active");
    });

    // Close via overlay
    overlay?.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      overlay.classList.remove("active");
    });
  },

  /* ----------------------------------------------------------
     Active nav link — highlights the current page
  ---------------------------------------------------------- */
  _setActiveNavLink() {
    const page = window.location.pathname.split("/").pop() || "dashboard.html";
    document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === page);
    });
    // Fallback: match by href for links without data-page
    document.querySelectorAll(".nav-link:not([data-page])").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href && href !== "#" && page.includes(href.split("/").pop())) {
        link.classList.add("active");
      }
    });
  },

  /* ----------------------------------------------------------
     Navbar meta — page title & breadcrumb
  ---------------------------------------------------------- */
  _initNavbarMeta(title = "Dashboard", breadcrumb = "Overview") {
    _setText("navbar-page-title", title);
    _setText("navbar-breadcrumb-label", breadcrumb);
    document.title = `${title} — POSDash`;
  },

  /* ----------------------------------------------------------
     User dropdown — open/close with animation
  ---------------------------------------------------------- */
  _initUserDropdown() {
    const btn = document.getElementById("navbar-user-btn");
    const dropdown = document.getElementById("user-dropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen);
      const chevron = btn.querySelector(".user-chevron");
      if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "";
    });

    document.addEventListener("click", () => {
      dropdown.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      const chevron = btn.querySelector(".user-chevron");
      if (chevron) chevron.style.transform = "";
    });
  },

  /* ----------------------------------------------------------
     Live clock — date & time in welcome banner
  ---------------------------------------------------------- */
  _initClock() {
    _setText("current-date", getTodayString());
    const timeEl = document.getElementById("current-time");
    if (timeEl) {
      timeEl.textContent = getLiveTime();
      setInterval(() => {
        timeEl.textContent = getLiveTime();
      }, 1000);
    }
  },

  /* ----------------------------------------------------------
     Role-based navigation — shows/hides links based on role
  ---------------------------------------------------------- */
  _applyRoleNav() {
    const user = getCurrentUser();
    const role = user?.role || "agent";

    // Hide elements marked with data-role that don't match
    document.querySelectorAll("[data-role]").forEach((el) => {
      if (el.dataset.role !== role) el.style.display = "none";
    });

    // For agents: also hide admin-only pages without data-role
    if (role !== "admin") {
      const adminOnlyPages = ["reports.html", "settings.html"];
      adminOnlyPages.forEach((page) => {
        document
          .querySelectorAll(
            `.nav-link[data-page="${page}"], .nav-link[href="${page}"]`,
          )
          .forEach((el) => {
            const li = el.closest("li");
            if (li) li.style.display = "none";
          });
      });
    }
  },

  /* ----------------------------------------------------------
     Responsive toggle — swap desktop/mobile toggle buttons
  ---------------------------------------------------------- */
  _initResponsiveToggle() {
    const mobileBtn = document.getElementById("btn-mobile-toggle");
    const desktopBtn = document.getElementById("btn-sidebar-toggle");
    const check = () => {
      const mobile = window.innerWidth <= 991;
      if (mobileBtn) mobileBtn.style.display = mobile ? "flex" : "none";
      if (desktopBtn) desktopBtn.style.display = mobile ? "none" : "flex";
    };
    check();
    window.addEventListener("resize", check);
  },

  /* ----------------------------------------------------------
     Appearance — apply stored accent colour and density flags
     so every page reflects the user's saved preferences.
  ---------------------------------------------------------- */
  _applyAppearance() {
    const ACCENT_MAP = {
      gold: { gold: "#c9a84c", light: "#e2c06b", dark: "#a8872e" },
      blue: { gold: "#3b82f6", light: "#60a5fa", dark: "#1d4ed8" },
      green: { gold: "#22c55e", light: "#4ade80", dark: "#15803d" },
      purple: { gold: "#a855f7", light: "#c084fc", dark: "#7e22ce" },
      red: { gold: "#ef4444", light: "#f87171", dark: "#b91c1c" },
    };
    try {
      const raw = localStorage.getItem("pos_appearance");
      if (!raw) return;
      const prefs = JSON.parse(raw);
      // Accent
      const colors = ACCENT_MAP[prefs.accent] || ACCENT_MAP.gold;
      document.documentElement.style.setProperty("--color-gold", colors.gold);
      document.documentElement.style.setProperty(
        "--color-gold-light",
        colors.light,
      );
      document.documentElement.style.setProperty(
        "--color-gold-dark",
        colors.dark,
      );
      // Density
      document.documentElement.classList.toggle(
        "compact-mode",
        !!prefs.compact,
      );
      document.documentElement.classList.toggle(
        "large-text",
        !!prefs.largeText,
      );
      document.documentElement.classList.toggle(
        "reduce-motion",
        !!prefs.reduceMotion,
      );
    } catch {
      // localStorage unavailable or corrupt — silently skip
    }
  },
};

/* ============================================================
   Private helpers
   ============================================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Apply an avatar (URL, base64, or emoji:X) to every avatar slot in the DOM.
 * Falls back to initials if avatar is empty.
 */
function _applyAvatarToDOM(avatar, initials) {
  if (!avatar) return;

  const isEmoji = avatar.startsWith("emoji:");
  const display = isEmoji ? avatar.replace("emoji:", "") : null;

  // Text slots (sidebar, navbar, dropdown use textContent)
  const textSlots = [
    "nav-user-avatar",
    "sidebar-user-avatar",
    "dropdown-avatar",
  ];

  if (isEmoji) {
    textSlots.forEach((id) => _setText(id, display));
  } else {
    // For image avatars keep initials in text slots — the <img> tags
    // in settings/profile pages are handled separately by profile.js.
    // But update font-size so a single emoji looks right.
    textSlots.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      // If there's already an <img> child, update its src
      const img = el.querySelector("img");
      if (img) {
        img.src = avatar;
      } else {
        // Replace text content with a small inline avatar image
        el.innerHTML = `<img src="${avatar}" alt="avatar"
          style="width:100%;height:100%;border-radius:50%;object-fit:cover;"
          onerror="this.parentElement.textContent='${initials}'">`;
      }
    });
  }

  // Also update any [data-settings-avatar] images on the current page
  document.querySelectorAll("[data-settings-avatar]").forEach((img) => {
    if (!isEmoji) {
      img.src = avatar;
      img.onerror = () => {
        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=a8872e&color=fff&size=128&bold=true`;
      };
    }
  });
}

function _getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function _capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

export default Layout;
