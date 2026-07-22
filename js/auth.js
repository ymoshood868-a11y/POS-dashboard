/**
 * auth.js — Login / authentication logic
 * POS Dashboard | Module 1: Authentication & Dashboard
 *
 * Handles: form validation, credential check against JSON Server,
 * localStorage session management, remember me, and redirect.
 *
 * Login checks registered users in db.json (/users).
 * Falls back to a built-in admin account if the server is offline.
 */

import { showToast, redirectIfLoggedIn } from "./utils.js";
import { getUsers } from "./api.js";

/* ============================================================
   Fallback admin (used when JSON Server is offline)
   ============================================================ */
const FALLBACK_ADMIN = {
  id: 1,
  name: "Admin User",
  email: "admin@posdash.com",
  password: "admin123",
  role: "admin",
};

/* ============================================================
   DOM References
   ============================================================ */
const loginForm    = document.getElementById("login-form");
const emailInput   = document.getElementById("email");
const passwordInput= document.getElementById("password");
const rememberCheck= document.getElementById("remember-me");
const btnLogin     = document.getElementById("btn-login");
const btnLoginText = document.getElementById("btn-login-text");
const btnLoginSpinner = document.getElementById("btn-login-spinner");
const formAlert    = document.getElementById("form-alert");
const btnTogglePwd = document.getElementById("btn-toggle-password");

/* ============================================================
   Init — run when DOM is ready
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Redirect to dashboard if already logged in
  redirectIfLoggedIn("dashboard.html");

  // Pre-fill email if remember-me was used
  restoreRememberedEmail();

  // Password visibility toggle
  if (btnTogglePwd) {
    btnTogglePwd.addEventListener("click", togglePasswordVisibility);
  }

  // Form submit
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  // Clear errors on input
  [emailInput, passwordInput].forEach((input) => {
    if (input) input.addEventListener("input", () => clearFieldError(input));
  });
});

/* ============================================================
   Form Submission
   ============================================================ */
async function handleLoginSubmit(e) {
  e.preventDefault();

  const email    = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  // Client-side validation
  let valid = true;
  if (!validateEmail(email)) {
    showFieldError(emailInput, "Please enter a valid email address.");
    valid = false;
  }
  if (!password) {
    showFieldError(passwordInput, "Password is required.");
    valid = false;
  }
  if (!valid) return;

  setLoading(true);
  hideAlert();

  try {
    // Try to fetch users from JSON Server
    let matchedUser = null;

    try {
      const users = await getUsers();
      matchedUser = users.find(
        (u) =>
          u.email.toLowerCase() === email &&
          u.password === password
      );
    } catch {
      // Server offline — check fallback admin
      if (
        email    === FALLBACK_ADMIN.email.toLowerCase() &&
        password === FALLBACK_ADMIN.password
      ) {
        matchedUser = FALLBACK_ADMIN;
      }
    }

    if (!matchedUser) {
      showAlert("Incorrect email or password. Please try again.", "error");
      setLoading(false);
      return;
    }

    // Build session object (never store the password)
    const sessionUser = {
      id:    matchedUser.id,
      name:  matchedUser.name,
      email: matchedUser.email,
      role:  matchedUser.role || "user",
    };

    localStorage.setItem("pos_session", "active");
    localStorage.setItem("pos_user", JSON.stringify(sessionUser));

    // Handle remember me
    if (rememberCheck && rememberCheck.checked) {
      localStorage.setItem("pos_remembered_email", email);
    } else {
      localStorage.removeItem("pos_remembered_email");
    }

    showToast(`Welcome back, ${matchedUser.name}!`, "success", 1500);

    setTimeout(() => {
      window.location.replace("dashboard.html");
    }, 800);

  } catch (err) {
    console.error("Login error:", err);
    showAlert("An unexpected error occurred. Please try again.", "error");
    setLoading(false);
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function setLoading(isLoading) {
  if (!btnLogin) return;
  btnLogin.disabled = isLoading;
  if (btnLoginText)
    btnLoginText.textContent = isLoading ? "Signing in…" : "Sign In";
  if (btnLoginSpinner) btnLoginSpinner.classList.toggle("d-none", !isLoading);
}

function showAlert(message, type = "error") {
  if (!formAlert) return;
  formAlert.textContent = message;
  formAlert.className = `form-alert alert-${type}`;
  formAlert.classList.remove("d-none");
}

function hideAlert() {
  if (!formAlert) return;
  formAlert.classList.add("d-none");
}

function showFieldError(input, message) {
  const group = input.closest(".form-group");
  if (!group) return;
  group.classList.add("has-error");

  let errEl = group.querySelector(".error-message");
  if (!errEl) {
    errEl = document.createElement("span");
    errEl.className = "error-message";
    group.appendChild(errEl);
  }
  errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
}

function clearFieldError(input) {
  const group = input.closest(".form-group");
  if (!group) return;
  group.classList.remove("has-error");
  const errEl = group.querySelector(".error-message");
  if (errEl) errEl.remove();
  hideAlert();
}

function togglePasswordVisibility() {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  btnTogglePwd.querySelector("i").className = isHidden
    ? "fa-solid fa-eye-slash"
    : "fa-solid fa-eye";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function restoreRememberedEmail() {
  const remembered = localStorage.getItem("pos_remembered_email");
  if (remembered && emailInput) {
    emailInput.value = remembered;
    if (rememberCheck) rememberCheck.checked = true;
  }
}
