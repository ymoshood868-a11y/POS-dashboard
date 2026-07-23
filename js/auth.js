/**
 * auth.js — Login / authentication logic
 * POS Dashboard
 *
 * Validates credentials against JSON Server (/users).
 * Falls back gracefully if server is offline.
 * Stores session in localStorage on success.
 */

import { showToast, redirectIfLoggedIn } from "./utils.js";

const BASE_URL = "http://localhost:3000";

/* ── DOM refs ────────────────────────────────────────────── */
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberCheck = document.getElementById("remember-me");
const btnLogin = document.getElementById("btn-login");
const btnLoginText = document.getElementById("btn-login-text");
const btnLoginSpinner = document.getElementById("btn-login-spinner");
const formAlert = document.getElementById("form-alert");
const btnTogglePwd = document.getElementById("btn-toggle-password");

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // If already logged in, go straight to dashboard
  redirectIfLoggedIn("dashboard.html");

  restoreRememberedEmail();

  btnTogglePwd?.addEventListener("click", togglePasswordVisibility);

  loginForm?.addEventListener("submit", handleLoginSubmit);

  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener("input", () => clearFieldError(input));
  });
});

/* ── Form submission ─────────────────────────────────────── */
async function handleLoginSubmit(e) {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validate fields
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
    // ── Try JSON Server first ──────────────────────────────
    let matchedUser = null;

    try {
      const res = await fetch(`${BASE_URL}/users`);
      const users = await res.json();

      matchedUser = users.find(
        (u) =>
          u.email.toLowerCase() === email.toLowerCase() &&
          u.password === password,
      );

      if (!matchedUser) {
        showAlert("Invalid email or password. Please try again.", "error");
        setLoading(false);
        return;
      }
    } catch {
      // JSON Server offline — accept any valid email + password (dev mode)
      console.warn("JSON Server offline — using dev fallback login.");
      const displayName = email
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      matchedUser = {
        id: 1,
        name: displayName,
        email,
        role: "admin",
        password,
      };
    }

    // ── Successful login ───────────────────────────────────
    const sessionUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    };

    localStorage.setItem("pos_session", "active");
    localStorage.setItem("pos_user", JSON.stringify(sessionUser));

    if (rememberCheck?.checked) {
      localStorage.setItem("pos_remembered_email", email);
    } else {
      localStorage.removeItem("pos_remembered_email");
    }

    showToast(`Welcome back, ${matchedUser.name}!`, "success", 1500);

    setTimeout(() => window.location.replace("dashboard.html"), 800);
  } catch (err) {
    console.error("Login error:", err);
    showAlert("An unexpected error occurred. Please try again.", "error");
    setLoading(false);
  }
}

/* ── Helpers ─────────────────────────────────────────────── */
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

function togglePasswordVisibility() {
  const hidden = passwordInput.type === "password";
  passwordInput.type = hidden ? "text" : "password";
  btnTogglePwd.querySelector("i").className = hidden
    ? "fa-solid fa-eye-slash"
    : "fa-solid fa-eye";
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
