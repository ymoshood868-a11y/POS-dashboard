/**
 * api.js — Frontend API layer
 * =============================
 * HOW THIS WORKS:
 *
 * Before: fetch('http://localhost:3000/transactions')  ← JSON Server
 * Now:    fetch('http://localhost:5000/api/transactions') ← Real Express server
 *
 * The key difference is AUTHENTICATION.
 * Every request now includes:
 *   Authorization: Bearer <JWT token>
 *
 * The JWT token is stored in localStorage after login.
 * The server reads it, verifies it, and knows who you are.
 */

const BASE_URL = "http://localhost:5000/api";

/* ── Get the stored JWT token ──────────────────────────── */
function getToken() {
  return localStorage.getItem("pos_token");
}

/* ── Generic fetch with automatic auth header ──────────── */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const config = {
    headers: {
      "Content-Type": "application/json",
      // Automatically attach JWT to every request
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // If 401, token expired — send user to login
  if (response.status === 401) {
    localStorage.removeItem("pos_session");
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    window.location.replace("login.html");
    return;
  }

  if (response.status === 204) return null;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error ${response.status}`);
  }

  return data;
}

/* ============================================================
   AUTH
   ============================================================ */

/**
 * Register a new user
 * Returns: { token, user }
 */
export async function registerUser(name, email, password) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
}

/**
 * Login
 * Returns: { token, user }
 */
export async function loginUser(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */

export async function getTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/transactions${query ? "?" + query : ""}`);
}

export async function getTransactionById(id) {
  return apiFetch(`/transactions/${id}`);
}

export async function queryTransactions(params = {}) {
  return getTransactions(params);
}

export async function createTransaction(data) {
  return apiFetch("/transactions", { method: "POST", body: data });
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
