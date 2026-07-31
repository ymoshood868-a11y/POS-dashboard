/**
 * auth.js — Login page logic
 * ===========================
 * Calls loginUser() against JSON Server user records.
 * On success: stores a local auth token and user session in localStorage.
 */

import { showToast, redirectIfLoggedIn } from "./utils.js";
import { loginUser } from "./api.js";

/* ── DOM refs ─────────────────────────────────────────────── */
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberCheck = document.getElementById("remember-me");
const btnLogin = document.getElementById("btn-login");
const btnLoginText = document.getElementById("btn-login-text");
const btnLoginSpinner = document.getElementById("btn-login-spinner");
const formAlert = document.getElementById("form-alert");
const btnTogglePwd = document.getElementById("btn-toggle-password");

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  redirectIfLoggedIn("dashboard.html");
  restoreRememberedEmail();

  btnTogglePwd?.addEventListener("click", () => {
    if (!passwordInput) return;
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    const icon = btnTogglePwd.querySelector("i");
    if (icon)
      icon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  loginForm?.addEventListener("submit", handleLogin);
  [emailInput, passwordInput].forEach((inp) =>
    inp?.addEventListener("input", () => clearFieldError(inp)),
  );
});

/* ── Login handler ────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

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
    // Call real Express backend → returns { token, user }
    const result = await loginUser(email, password);

    // Store JWT token — sent with every future API request
    localStorage.setItem("pos_token", result.token);
    localStorage.setItem("pos_session", "active");
    localStorage.setItem("pos_user", JSON.stringify(result.user));
    // Do NOT wipe userProfile here — fetchProfile() on next page load
    // will overwrite it with fresh server data anyway. Wiping it causes
    // the avatar to flash as the default on the first render.

    if (rememberCheck?.checked) {
      localStorage.setItem("pos_remembered_email", email);
    } else {
      localStorage.removeItem("pos_remembered_email");
    }

    showToast(`Welcome back, ${result.user.name}!`, "success", 1500);

    // Route to the correct dashboard based on role
    const role = result.user.role || "agent";
    const dest = role === "admin" ? "dashboard.html" : "agent-dashboard.html";
    setTimeout(() => window.location.replace(dest), 800);
  } catch (err) {
    showAlert(err.message || "Invalid email or password.", "error");
    setLoading(false);
  }
}

/* ── Helpers ──────────────────────────────────────────────── */
function setLoading(on) {
  if (!btnLogin) return;
  btnLogin.disabled = on;
  if (btnLoginText) btnLoginText.textContent = on ? "Signing in…" : "Sign In";
  if (btnLoginSpinner) btnLoginSpinner.classList.toggle("d-none", !on);
}

function showAlert(msg, type = "error") {
  if (!formAlert) return;
  formAlert.textContent = msg;
  formAlert.className = `form-alert alert-${type}`;
  formAlert.classList.remove("d-none");
}

function hideAlert() {
  formAlert?.classList.add("d-none");
}

function showFieldError(input, msg) {
  const group = input.closest(".form-group");
  if (!group) return;
  group.classList.add("has-error");
  let err = group.querySelector(".error-message");
  if (!err) {
    err = document.createElement("span");
    err.className = "error-message";
    group.appendChild(err);
  }
  err.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
}

function clearFieldError(input) {
  const group = input.closest(".form-group");
  if (!group) return;
  group.classList.remove("has-error");
  group.querySelector(".error-message")?.remove();
  hideAlert();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function restoreRememberedEmail() {
  const saved = localStorage.getItem("pos_remembered_email");
  if (saved && emailInput) {
    emailInput.value = saved;
    if (rememberCheck) rememberCheck.checked = true;
  }
}
