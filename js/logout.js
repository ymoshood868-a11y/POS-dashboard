/**
 * logout.js — Logout functionality
 * POS Dashboard | Module 1: Authentication & Dashboard
 *
 * Import this script on any dashboard page.
 * It wires up all elements with [data-action="logout"].
 */

/**
 * Clear session data and redirect to login page
 */
export function logout() {
  // Remove session keys (keep remembered email if present)
  localStorage.removeItem("pos_session");
  localStorage.removeItem("pos_user");

  // Redirect to login
  window.location.replace("login.html");
}

/**
 * Initialize logout listeners on page load.
 * Call this from dashboard.js (or any page that needs logout).
 */
export function initLogout() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest('[data-action="logout"]');
    if (trigger) {
      e.preventDefault();
      logout();
    }
  });
}
