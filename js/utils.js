/**
 * utils.js — Shared utility/helper functions
 * POS Dashboard | Module 1: Authentication & Dashboard
 *
 * Used by all team modules. Keep functions generic and reusable.
 */

/**
 * Format a number as currency string (USD by default)
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date string into a readable format
 * @param {string} dateStr — ISO date string
 * @param {object} opts    — Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(
  dateStr,
  opts = { year: "numeric", month: "short", day: "numeric" },
) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(dateStr));
}

/**
 * Capitalize first letter of a string
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration — ms before auto-dismiss (0 = persist)
 */
export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    info: "circle-info",
    success: "circle-check",
    error: "circle-xmark",
    warning: "triangle-exclamation",
  };
  toast.innerHTML = `<i class="fa-solid fa-${icons[type] || "circle-info"}" style="margin-right:8px"></i>${message}`;

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(60px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

/**
 * Debounce a function call
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get current user object from localStorage
 * @returns {object|null}
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem("pos_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated; redirect to login if not
 * @param {string} redirectTo — path to redirect if unauthenticated
 */
export function requireAuth(redirectTo = "login.html") {
  const session = localStorage.getItem("pos_session");
  if (!session || session !== "active") {
    window.location.replace(redirectTo);
  }
}

/**
 * Redirect logged-in users away from login page
 * @param {string} redirectTo — dashboard path
 */
export function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  const session = localStorage.getItem("pos_session");
  if (session === "active") {
    window.location.replace(redirectTo);
  }
}

/**
 * Get today's date as a formatted string
 * @returns {string}
 */
export function getTodayString() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

/**
 * Get live time string (HH:MM:SS)
 * @returns {string}
 */
export function getLiveTime() {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
