/**
 * auth.js — Login / authentication logic
 * POS Dashboard
 *
 * Validates credentials against JSON Server (/users).
 * Falls back to built-in admin account if server is offline.
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
  redirectIfLoggedIn("dashboard.html");
  restoreRememberedEmail();

  // Eye icon — show / hide password
  btnTogglePwd?.addEventListener("click", () => {
    if (!passwordInput) return;
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    const icon = btnTogglePwd.querySelector("i");
    if (icon)
      icon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  loginForm?.addEventListener("submit", handleLoginSubmit);

  [emailInput, passwordInput].forEach((input) =>
    input?.addEventListener("input", () => clearFieldError(input)),
  );
});

/* ── Form submission ─────────────────────────────────────── */
async function handleLoginSubmit(e) {
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
    let matchedUser = null;

    try {
      // Check credentials against JSON Server
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
      // Server offline — fall back to built-in admin account
      console.warn("JSON Server offline — using fallback admin.");
      if (
        email.toLowerCase() === "admin@posdash.com" &&
        password === "admin123"
      ) {
        matchedUser = {
          id: 1,
          name: "Admin User",
          email: "admin@posdash.com",
          role: "admin",
        };
      } else {
        showAlert(
          "Cannot reach server. Use admin@posdash.com / admin123 offline.",
          "error",
        );
        setLoading(false);
        return;
      }
    }

    // Successful — save session
    localStorage.setItem("pos_session", "active");
    localStorage.setItem(
      "pos_user",
      JSON.stringify({
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
      }),
    );

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
