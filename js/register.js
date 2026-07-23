/**
 * register.js — User registration logic
 * POS Dashboard | Module 1 (extended)
 *
 * Handles:
 *   - Full form validation (name, email, password, confirm, terms)
 *   - Email uniqueness check against existing /users
 *   - Password strength meter
 *   - POST /users to create the new account
 *   - Redirect to login.html on success
 */

import { showToast, redirectIfLoggedIn } from "./utils.js";
import { getUsers, createUser } from "./api.js";

/* ============================================================
   DOM References
   ============================================================ */
const form           = document.getElementById("register-form");
const fldName        = document.getElementById("reg-name");
const fldEmail       = document.getElementById("reg-email");
const fldPassword    = document.getElementById("reg-password");
const fldConfirm     = document.getElementById("reg-confirm");
const fldTerms       = document.getElementById("reg-terms");
const btnSubmit      = document.getElementById("btn-register");
const btnSubmitText  = document.getElementById("btn-register-text");
const btnSpinner     = document.getElementById("btn-register-spinner");
const formAlert      = document.getElementById("form-alert");
const btnTogglePwd   = document.getElementById("btn-toggle-pwd");
const btnToggleCfm   = document.getElementById("btn-toggle-confirm");
const strengthFill   = document.getElementById("pwd-strength-fill");
const strengthLabel  = document.getElementById("pwd-strength-label");

let isSaving = false;

/* ============================================================
   Init
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // Already logged in → go to dashboard
  redirectIfLoggedIn("dashboard.html");

  form.addEventListener("submit", handleSubmit);

  // Password visibility toggles
  btnTogglePwd?.addEventListener("click", () => toggleVisibility(fldPassword, btnTogglePwd));
  btnToggleCfm?.addEventListener("click", () => toggleVisibility(fldConfirm, btnToggleCfm));

  // Password strength on input
  fldPassword.addEventListener("input", () => {
    updateStrength(fldPassword.value);
    if (fldConfirm.value) validateMatchInline();
  });

  fldConfirm.addEventListener("input", validateMatchInline);

  // Clear errors on input
  [fldName, fldEmail, fldPassword, fldConfirm].forEach((el) => {
    el.addEventListener("input", () => clearFieldError(el.closest(".form-group")));
  });
});

/* ============================================================
   Submit Handler
   ============================================================ */
async function handleSubmit(e) {
  e.preventDefault();
  if (isSaving) return;

  hideAlert();
  const valid = validateAll();
  if (!valid) return;

  setLoading(true);

  const name     = fldName.value.trim();
  const email    = fldEmail.value.trim().toLowerCase();
  const password = fldPassword.value;

  try {
    // Check for duplicate email
    let existingUsers = [];
    try {
      existingUsers = await getUsers();
    } catch {
      // Server may be offline — proceed anyway (no duplicate check possible)
    }

    const duplicate = existingUsers.find(
      (u) => u.email.toLowerCase() === email
    );

    if (duplicate) {
      showFieldError(fldEmail, "An account with this email already exists.");
      showAlert("This email is already registered. Try signing in instead.", "error");
      setLoading(false);
      return;
    }

    // Create user via POST /users
    const newUser = {
      name,
      email,
      password,
      role: "user",
      avatar: "",
    };

    await createUser(newUser);

    showToast("Account created! Redirecting to sign in…", "success", 2500);

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);

  } catch (err) {
    console.error("[Register] Error:", err);
    showAlert(
      "Could not create account. Make sure the server is running and try again.",
      "error"
    );
    setLoading(false);
  }
}

/* ============================================================
   Validation
   ============================================================ */
function validateAll() {
  clearAllErrors();
  let valid = true;

  // Name
  const name = fldName.value.trim();
  if (!name || name.length < 2) {
    showFieldError(fldName, "Full name must be at least 2 characters.");
    valid = false;
  }

  // Email
  const email = fldEmail.value.trim();
  if (!validateEmail(email)) {
    showFieldError(fldEmail, "Please enter a valid email address.");
    valid = false;
  }

  // Password
  const pwd = fldPassword.value;
  if (!pwd || pwd.length < 6) {
    showFieldError(fldPassword, "Password must be at least 6 characters.");
    valid = false;
  }

  // Confirm password
  const confirm = fldConfirm.value;
  if (!confirm) {
    showFieldError(fldConfirm, "Please confirm your password.");
    valid = false;
  } else if (pwd && confirm !== pwd) {
    showFieldError(fldConfirm, "Passwords do not match.");
    valid = false;
  }

  // Terms
  if (!fldTerms.checked) {
    const group = document.getElementById("group-terms");
    showGroupError(group, "You must agree to the Terms & Conditions.");
    valid = false;
  }

  return valid;
}

function validateMatchInline() {
  const group = fldConfirm.closest(".form-group");
  if (fldConfirm.value && fldPassword.value !== fldConfirm.value) {
    showGroupError(group, "Passwords do not match.");
  } else {
    clearGroupError(group);
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ============================================================
   Password Strength Meter
   ============================================================ */
function updateStrength(pwd) {
  if (!strengthFill || !strengthLabel) return;

  if (!pwd) {
    strengthFill.className = "pwd-strength-fill";
    strengthFill.style.width = "0%";
    strengthLabel.textContent = "";
    strengthLabel.className = "pwd-strength-label";
    return;
  }

  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;

  let level, label;
  if (score <= 2) {
    level = "weak";   label = "Weak";
  } else if (score <= 3) {
    level = "medium"; label = "Medium";
  } else {
    level = "strong"; label = "Strong";
  }

  strengthFill.className  = `pwd-strength-fill ${level}`;
  strengthLabel.textContent = label;
  strengthLabel.className = `pwd-strength-label ${level}`;
}

/* ============================================================
   Loading State
   ============================================================ */
function setLoading(state) {
  isSaving = state;
  btnSubmit.disabled = state;

  if (state) {
    btnSubmitText.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';
    btnSpinner?.classList.remove("d-none");
  } else {
    btnSubmitText.innerHTML =
      '<i class="fa-solid fa-user-plus"></i> Create Account';
    btnSpinner?.classList.add("d-none");
  }
}

/* ============================================================
   Alert
   ============================================================ */
function showAlert(message, type = "error") {
  if (!formAlert) return;
  const icon = type === "error" ? "circle-xmark" : "circle-check";
  formAlert.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${message}`;
  formAlert.className = `form-alert alert-${type}`;
  formAlert.classList.remove("d-none");
}

function hideAlert() {
  formAlert?.classList.add("d-none");
}

/* ============================================================
   Field Error Helpers
   ============================================================ */
function showFieldError(input, message) {
  const group = input.closest(".form-group");
  showGroupError(group, message);
}

function showGroupError(group, message) {
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

function clearFieldError(group) {
  clearGroupError(group);
}

function clearGroupError(group) {
  if (!group) return;
  group.classList.remove("has-error");
  group.querySelector(".error-message")?.remove();
}

function clearAllErrors() {
  document.querySelectorAll(".form-group.has-error").forEach(clearGroupError);
}

/* ============================================================
   Password Visibility Toggle
   ============================================================ */
function toggleVisibility(input, btn) {
  const hidden = input.type === "password";
  input.type = hidden ? "text" : "password";
  btn.querySelector("i").className = hidden
    ? "fa-solid fa-eye-slash"
    : "fa-solid fa-eye";
}
