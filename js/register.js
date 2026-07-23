/**
 * register.js — New account registration
 * POS Dashboard
 *
 * POSTs new user to JSON Server /users.
 * On success redirects to login.html.
 */

import { showToast } from "./utils.js";

const BASE_URL = "http://localhost:3000";

/* ── DOM refs ────────────────────────────────────────────── */
const form = document.getElementById("register-form");
const nameInput = document.getElementById("reg-name");
const emailInput = document.getElementById("reg-email");
const passwordInput = document.getElementById("reg-password");
const confirmInput = document.getElementById("reg-confirm");
const termsCheck = document.getElementById("reg-terms");
const btnRegister = document.getElementById("btn-register");
const btnText = document.getElementById("btn-register-text");
const btnSpinner = document.getElementById("btn-register-spinner");
const formAlert = document.getElementById("form-alert");
const strengthFill = document.getElementById("pwd-strength-fill");
const strengthLabel = document.getElementById("pwd-strength-label");

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // Password toggle — main field
  document.getElementById("btn-toggle-pwd")?.addEventListener("click", () => {
    toggleField(passwordInput, document.querySelector("#btn-toggle-pwd i"));
  });

  // Password toggle — confirm field
  document
    .getElementById("btn-toggle-confirm")
    ?.addEventListener("click", () => {
      toggleField(
        confirmInput,
        document.querySelector("#btn-toggle-confirm i"),
      );
    });

  // Live password strength
  passwordInput?.addEventListener("input", () => {
    updateStrength(passwordInput.value);
    clearErr("group-password");
  });

  // Clear errors on typing
  emailInput?.addEventListener("input", () => clearErr("group-email"));
  nameInput?.addEventListener("input", () => clearErr("group-name"));
  confirmInput?.addEventListener("input", () => clearErr("group-confirm"));

  // Submit
  form?.addEventListener("submit", handleRegister);
});

/* ── Registration handler ────────────────────────────────── */
async function handleRegister(e) {
  e.preventDefault();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;
  const agreed = termsCheck?.checked;

  // ── Validate ─────────────────────────────────────────────
  let ok = true;

  if (!name) {
    setErr("group-name", "Full name is required.");
    ok = false;
  }
  if (!validateEmail(email)) {
    setErr("group-email", "Please enter a valid email address.");
    ok = false;
  }
  if (password.length < 6) {
    setErr("group-password", "Password must be at least 6 characters.");
    ok = false;
  }
  if (password !== confirm) {
    setErr("group-confirm", "Passwords do not match.");
    ok = false;
  }
  if (!agreed) {
    showAlert("Please accept the Terms & Conditions.", "error");
    ok = false;
  }
  if (!ok) return;

  setLoading(true);
  hideAlert();

  try {
    // ── Check email not already taken ─────────────────────
    const checkRes = await fetch(
      `${BASE_URL}/users?email=${encodeURIComponent(email)}`,
    );
    const existing = await checkRes.json();

    if (existing.length > 0) {
      showAlert(
        "An account with this email already exists. Please sign in.",
        "error",
      );
      setLoading(false);
      return;
    }

    // ── Build new user object ─────────────────────────────
    const newUser = {
      name,
      username: name.toLowerCase().replace(/\s+/g, "").slice(0, 16),
      email,
      password,
      role: "user",
      phone: "",
      department: "",
      avatar: "",
    };

    // ── POST to JSON Server ───────────────────────────────
    const res = await fetch(`${BASE_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });

    if (!res.ok) throw new Error("Registration failed.");

    // ── Success — redirect to login ───────────────────────
    showAlert("Account created! Redirecting to sign in…", "success");
    setTimeout(() => window.location.replace("login.html"), 1500);
  } catch (err) {
    console.error("Register error:", err);
    // Server offline fallback message
    showAlert(
      "Cannot reach server. Make sure JSON Server is running (npm run server).",
      "error",
    );
    setLoading(false);
  }
}

/* ── Password strength meter ─────────────────────────────── */
function updateStrength(pwd) {
  if (!strengthFill || !strengthLabel) return;

  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const levels = [
    { label: "", color: "transparent", width: "0%" },
    { label: "Weak", color: "#e74c3c", width: "25%" },
    { label: "Fair", color: "#f39c12", width: "50%" },
    { label: "Good", color: "#c9a84c", width: "75%" },
    { label: "Strong", color: "#27ae60", width: "90%" },
    { label: "Very Strong", color: "#27ae60", width: "100%" },
  ];

  const level = levels[Math.min(score, 5)];
  strengthFill.style.width = level.width;
  strengthFill.style.background = level.color;
  strengthLabel.textContent = level.label;
  strengthLabel.style.color = level.color;
}

/* ── Helpers ─────────────────────────────────────────────── */
function toggleField(input, icon) {
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (icon) icon.className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

function setLoading(on) {
  if (!btnRegister) return;
  btnRegister.disabled = on;
  if (btnText) btnText.style.display = on ? "none" : "";
  if (btnSpinner) btnSpinner.classList.toggle("d-none", !on);
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

function setErr(groupId, msg) {
  const group = document.getElementById(groupId);
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

function clearErr(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.remove("has-error");
  group.querySelector(".error-message")?.remove();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
