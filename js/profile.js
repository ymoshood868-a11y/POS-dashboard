/**
 * profile.js — User Profile Store
 * =================================
 * Reads and writes profile data to JSON Server (/users).
 * Falls back to localStorage if server is offline.
 *
 * The logged-in user is stored in localStorage as:
 *   pos_user = { id, name, email, role }
 *
 * Full profile (phone, department, avatar) is stored in:
 *   /users/:id  on JSON Server   (primary)
 *   userProfile in localStorage  (offline fallback)
 */

import { getCurrentUser } from "./utils.js";

const BASE_URL = "http://localhost:3000";
const LOCAL_KEY = "userProfile";

/* ── Build a default profile from the session user ──────── */
function buildDefault() {
  const u = getCurrentUser();
  return {
    id: u?.id || 1,
    fullName: u?.name || "Admin User",
    username: u?.name ? _toUsername(u.name) : "adminuser",
    email: u?.email || "admin@posdash.com",
    phone: "",
    role: u?.role ? _capitalize(u.role) : "Admin",
    department: "",
    avatar: "",
  };
}

/* ── Read profile ──────────────────────────────────────── */

/**
 * getProfile() — synchronous, from localStorage
 * Used for immediate UI rendering.
 */
export function getProfile() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw
      ? { ...buildDefault(), ...JSON.parse(raw) }
      : { ...buildDefault() };
  } catch {
    return { ...buildDefault() };
  }
}

/**
 * fetchProfile() — async, from JSON Server
 * Call this on page load to get the latest data.
 */
export async function fetchProfile() {
  const u = getCurrentUser();
  if (!u) return getProfile();

  try {
    const res = await fetch(`${BASE_URL}/users/${u.id}`);
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    // Merge server data into a profile shape and cache locally
    const profile = {
      id: data.id,
      fullName: data.name || buildDefault().fullName,
      username: data.username || _toUsername(data.name || ""),
      email: data.email || buildDefault().email,
      phone: data.phone || "",
      role: data.role ? _capitalize(data.role) : "Admin",
      department: data.department || "",
      avatar: data.avatar || "",
    };

    // Cache in localStorage for offline use
    localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    // Server offline — fall back to localStorage
    return getProfile();
  }
}

/* ── Save profile ──────────────────────────────────────── */

/**
 * saveProfile(updates) — writes to JSON Server + localStorage
 * Uses PATCH so only changed fields are sent (avoids large PUT payloads
 * that can fail when the avatar is a base64 image).
 */
export async function saveProfile(updates) {
  const current = getProfile();
  const next = { ...current, ...updates };

  // Always update localStorage immediately (optimistic)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("profileUpdated", { detail: next }));

  // Sync to JSON Server via PATCH (only send what changed)
  try {
    const u = getCurrentUser();
    if (!u) return next;

    // Map profile shape back to the /users schema
    // Only include fields that are in updates to keep the payload small
    const fieldMap = {
      fullName: "name",
      username: "username",
      email: "email",
      phone: "phone",
      role: (v) => ({ role: v?.toLowerCase() || "user" }),
      department: "department",
      avatar: "avatar",
    };

    const patch = {};
    for (const [profileKey, serverKey] of Object.entries(fieldMap)) {
      if (profileKey in updates) {
        if (typeof serverKey === "function") {
          Object.assign(patch, serverKey(next[profileKey]));
        } else {
          patch[serverKey] = next[profileKey];
        }
      }
    }

    // If the avatar is a base64 data URL, resize it before saving
    // so JSON Server doesn't choke on a multi-MB payload
    if (patch.avatar && patch.avatar.startsWith("data:image")) {
      patch.avatar = await _resizeAvatar(patch.avatar, 256);
    }

    await fetch(`${BASE_URL}/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    // Update the cached profile with the (possibly resized) avatar
    if (patch.avatar && patch.avatar !== next.avatar) {
      next.avatar = patch.avatar;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    }
  } catch (err) {
    console.warn("Profile saved locally — JSON Server offline.", err);
  }

  return next;
}

/**
 * Resize a base64 data URL to maxSize × maxSize using a canvas.
 * Returns a new base64 JPEG string at ~80% quality.
 */
async function _resizeAvatar(dataUrl, maxSize = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve(dataUrl); // fallback: keep original
    img.src = dataUrl;
  });
}

/**
 * resetProfile() — clears local cache, re-seeds from server/defaults
 */
export async function resetProfile() {
  localStorage.removeItem(LOCAL_KEY);
  const fresh = await fetchProfile();
  window.dispatchEvent(new CustomEvent("profileUpdated", { detail: fresh }));
  return fresh;
}

/**
 * initProfile() — seeds localStorage from server on page load
 */
export async function initProfile() {
  const profile = await fetchProfile();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
  return profile;
}

/* ── DOM helpers ─────────────────────────────────────────── */

export function applyProfileToNavbar(profile) {
  const initials = _getInitials(profile.fullName);
  const avatarDisplay = profile.avatar?.startsWith("emoji:")
    ? profile.avatar.replace("emoji:", "")
    : initials;

  _setText("nav-user-name", profile.fullName);
  _setText("sidebar-user-name", profile.fullName);
  _setText("sidebar-user-role", profile.role);
  _setText("dropdown-user-name", profile.fullName);
  _setText("dropdown-user-email", profile.email);
  _setText("welcome-name", profile.fullName.split(" ")[0]);
  _setText("nav-user-avatar", avatarDisplay);
  _setText("sidebar-user-avatar", avatarDisplay);
  _setText("dropdown-avatar", avatarDisplay);
}

export function getAvatarFallback(name) {
  const encoded = encodeURIComponent(
    (name || "U")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
  );
  return `https://ui-avatars.com/api/?name=${encoded}&background=a8872e&color=fff&size=128&bold=true`;
}

/* ── Private helpers ─────────────────────────────────────── */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}

function _getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function _capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function _toUsername(name) {
  return name.toLowerCase().replace(/\s+/g, "").slice(0, 16);
}
