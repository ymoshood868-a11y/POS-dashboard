/**
 * api.js — Frontend API layer
 * =============================
 * This app uses JSON Server on localhost:3000 for all data operations.
 * Auth is handled by matching /users records directly, while transactions
 * and profile data are stored in db.json.
 */

import { getCurrentUser } from "./utils.js";

const BASE_URL = "http://localhost:3000";

/* ── Get the stored JWT token ──────────────────────────── */
function getToken() {
  return localStorage.getItem("pos_token");
}

/* ── JSON Server fetch helper ──────────────────────────── */
async function jsonFetch(endpoint, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  };

  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  if (response.status === 204) return null;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error ${response.status}`);
  }

  return data;
}

/* ── Most API calls use JSON Server directly ────────────── */
async function apiFetch(endpoint, options = {}) {
  return jsonFetch(endpoint, options);
}

/* ============================================================
   AUTH
   ============================================================ */

/**
 * Register a new user
 * Returns: { token, user }
 */
export async function registerUser(name, email, password) {
  const username =
    email.split("@")[0] || name.toLowerCase().replace(/\s+/g, "").slice(0, 16);
  const newUser = {
    name,
    username,
    email,
    password,
    phone: "",
    role: "agent", // all self-registered users are agents
    department: "",
    avatar: "",
  };

  const existing = await jsonFetch(`/users?email=${encodeURIComponent(email)}`);
  if (Array.isArray(existing) && existing.length > 0) {
    throw new Error("Email already exists. Please use a different email.");
  }

  const created = await jsonFetch("/users", {
    method: "POST",
    body: newUser,
  });

  return {
    token: btoa(`${created.email}:${created.password}`),
    user: created,
  };
}

/**
 * Login
 * Returns: { token, user }
 */
export async function loginUser(email, password) {
  const users = await jsonFetch(
    `/users?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  );

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("Invalid email or password.");
  }

  return {
    token: btoa(`${users[0].email}:${users[0].password}`),
    user: users[0],
  };
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */

export async function getTransactions(params = {}) {
  const currentUser = getCurrentUser();
  // Admins see all transactions; agents only see their own
  const isAdminUser = currentUser?.role === "admin";
  const queryParams = {
    ...(!isAdminUser && currentUser?.id ? { userId: currentUser.id } : {}),
    ...params,
  };
  const query = new URLSearchParams(queryParams).toString();
  return apiFetch(`/transactions${query ? "?" + query : ""}`);
}

export async function getTransactionById(id) {
  return apiFetch(`/transactions/${id}`);
}

export async function queryTransactions(params = {}) {
  return getTransactions(params);
}

export async function createTransaction(data) {
  const currentUser = getCurrentUser();

  // Generate a sequential reference (TXN-001, TXN-002, …) based on
  // the current total count in the database so references are clean.
  let reference = data.reference;
  if (!reference || reference.startsWith("TXN-1")) {
    try {
      const all = await apiFetch(
        `/transactions?userId=${currentUser?.id || ""}`,
      );
      const count = Array.isArray(all) ? all.length + 1 : 1;
      reference = `TXN-${String(count).padStart(3, "0")}`;
    } catch {
      // Fallback: timestamp-based unique reference
      reference = `TXN-${String(Date.now()).slice(-6)}`;
    }
  }

  return apiFetch("/transactions", {
    method: "POST",
    body: { userId: currentUser?.id, ...data, reference },
  });
}

export async function updateTransaction(id, data) {
  return apiFetch(`/transactions/${id}`, { method: "PUT", body: data });
}

export async function deleteTransaction(id) {
  return apiFetch(`/transactions/${id}`, { method: "DELETE" });
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

export async function getNotifications() {
  return apiFetch("/notifications");
}

export async function markNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "POST" });
}

/**
 * Open a Server-Sent Events stream for real-time notifications.
 *
 * HOW SSE WORKS ON THE FRONTEND:
 * EventSource is a built-in browser API.
 * It opens a persistent HTTP connection to the server.
 * The server can push messages through it at any time.
 *
 * @param {function} onMessage - called with each notification object
 * @returns {EventSource} - call .close() to disconnect
 */
export function subscribeToNotifications(onMessage) {
  const token = getToken();
  if (!token) return null;

  // Token goes in the URL because EventSource can't set headers
  const es = new EventSource(`${BASE_URL}/notifications/stream?token=${token}`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type !== "connected") {
        onMessage(data);
      }
    } catch {
      /* ignore parse errors */
    }
  };

  es.onerror = () => {
    console.warn("[SSE] Connection lost, will retry automatically.");
  };

  return es;
}

/* ============================================================
   LEGACY HELPERS (unchanged — used by dashboard.js etc.)
   ============================================================ */

export function computeSummary(transactions) {
  return transactions.reduce(
    (acc, txn) => {
      const amount = parseFloat(txn.amount) || 0;
      switch (txn.category) {
        case "income":
          acc.income += amount;
          break;
        case "expense":
          acc.expenses += amount;
          break;
        case "deposit":
          acc.deposits += amount;
          break;
        case "withdrawal":
          acc.withdrawals += amount;
          break;
      }
      return acc;
    },
    { income: 0, expenses: 0, deposits: 0, withdrawals: 0 },
  );
}

export function getRecentTransactions(transactions, n = 8) {
  return [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, n);
}

// Kept for backward compat — not used with real backend
export async function getUsers() {
  return [];
}
export async function getSettings() {
  return {};
}
export async function updateSettings(data) {
  return data;
}
export async function getUserById(id) {
  return null;
}
export async function updateUser(id, data) {
  return data;
}
export async function createUser(data) {
  return registerUser(data.name, data.email, data.password);
}
