/**
 * theme.js — Shared theme manager
 * ================================
 * Handles dark / light / system mode across all pages.
 * Import and call applyTheme() as early as possible to
 * prevent a flash of wrong theme.
 *
 * Storage key: "pos_theme"  →  "dark" | "light" | "system"
 */

export const THEME_KEY = "pos_theme";
export const THEMES = ["dark", "light", "system"];

/**
 * Read the stored preference (default: "dark")
 */
export function getThemePref() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

/**
 * Resolve "system" to the actual OS preference.
 * Returns "dark" or "light".
 */
export function resolveTheme(pref) {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return pref === "light" ? "light" : "dark";
}

/**
 * Apply the theme to <html data-theme="…">
 * Call this before any paint to avoid FOUC.
 */
export function applyTheme(pref) {
  const resolved = resolveTheme(pref ?? getThemePref());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

/**
 * Save + apply a new theme preference.
 * Dispatches "themeChanged" on window so any open page can react.
 */
export function setTheme(pref) {
  localStorage.setItem(THEME_KEY, pref);
  const resolved = applyTheme(pref);
  window.dispatchEvent(
    new CustomEvent("themeChanged", { detail: { pref, resolved } }),
  );
  return resolved;
}

/**
 * Watch OS preference changes when "system" is selected.
 */
export function watchSystemTheme() {
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
}

/* ── Apply immediately on module load ────────────────────── */
applyTheme(getThemePref());
watchSystemTheme();
