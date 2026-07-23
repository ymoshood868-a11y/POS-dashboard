/**
 * api.js — Reusable API layer for JSON Server
 * POS Dashboard | Module 1: Authentication & Dashboard
 *
 * All teammates should use these functions to talk to the server.
 * Base URL: http://localhost:3000
 */

const BASE_URL = "http://localhost:3000";

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint  — e.g. '/transactions'
 * @param {object} options   — fetch options
 * @returns {Promise<any>}
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaults = {
    headers: { "Content-Type": "application/json" },
  };

  const config = { ...defaults, ...options };
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = new Error(
      `API error: ${response.status} ${response.statusText}`,
    );
    error.status = response.status;
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) return null;
  return response.json();
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */

/**
 * Fetch all transactions
 * @returns {Promise<Array>}
 */
export async function getTransactions() {
  return apiFetch("/transactions");
}

/**
 * Fetch a single transaction by ID
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function getTransactionById(id) {
  return apiFetch(`/transactions/${id}`);
}

/**
 * Fetch transactions with optional query params
 * e.g. { category: 'income', _sort: 'date', _order: 'desc', _limit: 10 }
 * @param {object} params
 * @returns {Promise<Array>}
 */
export async function queryTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/transactions${query ? "?" + query : ""}`);
}

/**
 * Create a new transaction
 * NOTE: Used by teammate Module 2 (New Transaction)
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createTransaction(data) {
  return apiFetch("/transactions", { method: "POST", body: data });
}

/**
 * Update an existing transaction
 * NOTE: Used by teammate Module 2 (Edit Transaction)
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateTransaction(id, data) {
  return apiFetch(`/transactions/${id}`, { method: "PUT", body: data });
}

/**
 * Delete a transaction
 * @param {number|string} id
 * @returns {Promise<null>}
 */
export async function deleteTransaction(id) {
  return apiFetch(`/transactions/${id}`, { method: "DELETE" });
}

/* ============================================================
   DASHBOARD STATS
   Compute summary statistics from the transactions array.
   These helpers are used by Module 1 but can be reused
   by teammates in Reports & Analytics.
   ============================================================ */

/**
 * Compute dashboard summary totals from a transactions array
 * @param {Array} transactions
 * @returns {{ income: number, expenses: number, deposits: number, withdrawals: number }}
 */
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

/**
 * Get the N most recent transactions (sorted by date desc)
 * @param {Array}  transactions
 * @param {number} n
 * @returns {Array}
 */
export function getRecentTransactions(transactions, n = 8) {
  return [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, n);
}

/* ============================================================
   USERS (for authentication — used by auth.js)
   ============================================================ */

/**
 * Fetch all users (client-side auth against JSON Server)
 * @returns {Promise<Array>}
 */
export async function getUsers() {
  return apiFetch("/users");
}

/* ============================================================
   SETTINGS (for Team Member 5 — Settings page)
   ============================================================ */

/**
 * Create a new user account
 * NOTE: Used by register.js
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createUser(data) {
  return apiFetch("/users", { method: "POST", body: data });
}


 * @returns {Promise<object>}
 */
export async function getSettings() {
  return apiFetch("/settings");
}

/**
 * Update app settings (full replace)
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateSettings(data) {
  return apiFetch("/settings", { method: "PUT", body: data });
}

/* ============================================================
   PROFILE (for Team Member 5 — Profile page)
   ============================================================ */

/**
 * Fetch a user profile by ID
 * @param {number|string} id
 * @returns {Promise<object>}
 */
export async function getUserById(id) {
  return apiFetch(`/users/${id}`);
}

/**
 * Update a user profile
 * @param {number|string} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateUser(id, data) {
  return apiFetch(`/users/${id}`, { method: "PUT", body: data });
}
