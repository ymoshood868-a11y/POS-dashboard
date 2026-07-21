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
    this._initNavbarMeta(opts.pageTitle, opts.breadcrumb);
    this._initUserDropdown();
    this._initClock();
    this._initResponsiveToggle();
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
  ---------------------------------------------------------- */
  _initUserProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const initials = _getInitials(user.name);

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
};

/* ============================================================
   Private helpers
   ============================================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
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
