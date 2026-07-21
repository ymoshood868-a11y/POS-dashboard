/**
 * profile.js — User Profile Store (Team Member 5 — Settings Module)
 * ==================================================================
 * Single source of truth for all profile data across every page.
 *
 * Integration notes:
 *  • The leader's auth system stores the logged-in user in:
 *      localStorage key "pos_user"  →  { id, name, email, role }
 *  • This module stores extended profile data in:
 *      localStorage key "userProfile"
 *    and always seeds it from pos_user on first access so the
 *    name / email the user logged in with is always pre-populated.
 *
 *  • All pages that already use getCurrentUser() from utils.js
 *    keep working unchanged — we never overwrite pos_user.
 *
 * Shape of "userProfile":
 *  {
 *    fullName:   string,
 *    username:   string,
 *    email:      string,
 *    phone:      string,
 *    role:       string,
 *    department: string,
 *    avatar:     string   (URL or data-URL; empty = initials avatar)
 *  }
 */

import { getCurrentUser } from "./utils.js";

/* ── Constants ───────────────────────────────────────────── */
const STORAGE_KEY = "userProfile";

/** Build a sensible default from whatever the leader's auth saved */
function buildDefault() {
    const u = getCurrentUser();          // from utils.js → pos_user key
    return {
        fullName:   u?.name  || "Admin User",
        username:   u?.name  ? _toUsername(u.name) : "adminuser",
        email:      u?.email || "admin@posdash.com",
        phone:      "+2348012345678",
        role:       u?.role  ? _capitalize(u.role) : "Admin",
        department: "Operations",
        avatar:     "assets/images/POS IMG.jpg"
    };
}

/* ── Core API ─────────────────────────────────────────────── */

/**
 * getProfile()
 * Returns the saved userProfile, seeding from pos_user if first visit.
 * @returns {Object}
 */
export function getProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...buildDefault() };
        return { ...buildDefault(), ...JSON.parse(raw) };
    } catch {
        return { ...buildDefault() };
    }
}

/**
 * saveProfile(updates)
 * Merges updates into the existing profile and persists to localStorage.
 * Fires a custom "profileUpdated" event so sidebar/navbar can react.
 * @param {Object} updates
 * @returns {Object} updated profile
 */
export function saveProfile(updates) {
    const next = { ...getProfile(), ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("profileUpdated", { detail: next }));
    return next;
}

/**
 * resetProfile()
 * Removes the userProfile key so defaults are rebuilt from pos_user.
 */
export function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = { ...buildDefault() };
    window.dispatchEvent(new CustomEvent("profileUpdated", { detail: fresh }));
    return fresh;
}

/**
 * initProfile()
 * Ensures a profile row exists; call once on every page load.
 * @returns {Object} the current profile
 */
export function initProfile() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(buildDefault()));
    }
    return getProfile();
}

/* ── DOM Helpers ──────────────────────────────────────────── */

/**
 * applyProfileToNavbar(profile)
 * Updates the leader's existing navbar IDs with profile data.
 * These IDs are set by layout.js._initUserProfile() too, so
 * we only overwrite if we have richer data (e.g. saved phone).
 */
export function applyProfileToNavbar(profile) {
    const initials = _getInitials(profile.fullName);

    _setText("nav-user-name",       profile.fullName);
    _setText("sidebar-user-name",   profile.fullName);
    _setText("sidebar-user-role",   profile.role);
    _setText("dropdown-user-name",  profile.fullName);
    _setText("dropdown-user-email", profile.email);
    _setText("welcome-name",        profile.fullName.split(" ")[0]);

    // Avatars are initials-based in the leader's design
    _setText("nav-user-avatar",      initials);
    _setText("sidebar-user-avatar",  initials);
    _setText("dropdown-avatar",      initials);
}

/**
 * getAvatarFallback(name)
 * Returns a UI-Avatars URL as an <img> src fallback.
 * @param {string} name
 * @returns {string}
 */
export function getAvatarFallback(name) {
    const encoded = encodeURIComponent(
        (name || "U")
            .split(" ")
            .map(w => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    );
    return `https://ui-avatars.com/api/?name=${encoded}&background=a8872e&color=fff&size=128&bold=true`;
}

/* ── Private helpers ──────────────────────────────────────── */
function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "";
}

function _getInitials(name) {
    if (!name) return "U";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function _capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function _toUsername(name) {
    return name.toLowerCase().replace(/\s+/g, "").slice(0, 16);
}
