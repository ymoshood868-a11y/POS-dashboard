/**
 * logout.js — Logout functionality
 * POS Dashboard
 *
 * Wires up all [data-action="logout"] elements on the page.
 * Uses direct element binding (not document bubbling) so it
 * works even when stopPropagation() is called in dropdowns.
 */

/**
 * Clear session data and redirect to login page
 */
export function logout() {
  localStorage.removeItem("pos_session");
  localStorage.removeItem("pos_user");
  localStorage.removeItem("userProfile");
  window.location.replace("login.html");
}

/**
 * Wire every [data-action="logout"] element directly.
 * Call this after the DOM is ready on every protected page.
 */
export function initLogout() {
  // Bind directly to each element — works even inside dropdowns
  // that call stopPropagation
  function bindAll() {
    document.querySelectorAll('[data-action="logout"]').forEach((el) => {
      // Remove any existing listener first to avoid duplicates
      el.removeEventListener("click", handleLogoutClick);
      el.addEventListener("click", handleLogoutClick);
    });
  }

  // Bind immediately (for elements already in DOM)
  bindAll();

  // Also re-bind after any dynamic content is injected
  // (e.g. component injection via layout.js)
  const observer = new MutationObserver(() => bindAll());
  observer.observe(document.body, { childList: true, subtree: true });
}

function handleLogoutClick(e) {
  e.preventDefault();
  e.stopPropagation();
  logout();
}
