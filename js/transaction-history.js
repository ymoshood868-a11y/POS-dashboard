/**
 * transaction-history.js — Transaction History & Management
 * POS Dashboard | Module 3
 *
 * Features: fetch all, search, filter by category/status/date,
 * paginate, delete with confirmation modal.
 */

import Layout from "./layout.js";
import { getTransactions, deleteTransaction } from "./api.js";
import { formatCurrency, formatDate, showToast, debounce } from "./utils.js";

/* ── Config ───────────────────────────────────────────────── */
const PAGE_SIZE = 10;

/* ── State ────────────────────────────────────────────────── */
let allTransactions = []; // raw from server
let filtered = []; // after search + filters
let currentPage = 1;
let pendingDeleteId = null;

/* ── DOM refs ─────────────────────────────────────────────── */
const tbody = document.getElementById("txn-tbody");
const searchInput = document.getElementById("search-input");
const filterCat = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");
const filterFrom = document.getElementById("filter-date-from");
const filterTo = document.getElementById("filter-date-to");
const btnClear = document.getElementById("btn-clear-filters");
const resultsCount = document.getElementById("results-count");
const paginationBar = document.getElementById("pagination-bar");
const paginationInfo = document.getElementById("pagination-info");
const paginationCtrl = document.getElementById("pagination-controls");
const emptyState = document.getElementById("empty-state");
const deleteModal = document.getElementById("delete-modal");
const deleteModalRef = document.getElementById("delete-modal-ref");
const btnCancelDel = document.getElementById("btn-cancel-delete");
const btnConfirmDel = document.getElementById("btn-confirm-delete");

/* ── Boot ─────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  await Layout.init({
    pageTitle: "Transactions",
    breadcrumb: "Transaction History",
  });
  await loadTransactions();
  initControls();
  initDeleteModal();
});

/* ── Fetch all transactions ───────────────────────────────── */
async function loadTransactions() {
  try {
    allTransactions = await getTransactions();
  } catch {
    showToast(
      "Could not load transactions. Is JSON Server running?",
      "error",
      6000,
    );
    allTransactions = [];
  }
  applyFilters();
}

/* ── Apply search + filters ───────────────────────────────── */
function applyFilters() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const cat = filterCat?.value || "";
  const status = filterStatus?.value || "";
  const from = filterFrom?.value || "";
  const to = filterTo?.value || "";

  filtered = allTransactions.filter((t) => {
    // Search: description or reference
    if (query) {
      const inDesc = (t.description || "").toLowerCase().includes(query);
      const inRef = (t.reference || "").toLowerCase().includes(query);
      if (!inDesc && !inRef) return false;
    }
    // Category
    if (cat && t.category !== cat) return false;
    // Status
    if (status && t.status !== status) return false;
    // Date range
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  currentPage = 1;
  renderTable();
  renderPagination();
  updateCount();
}

/* ── Render table for current page ───────────────────────── */
function renderTable() {
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = "";
    paginationBar?.classList.add("d-none");
    emptyState?.classList.remove("d-none");
    return;
  }

  emptyState?.classList.add("d-none");
  paginationBar?.classList.remove("d-none");

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const isPos = (cat) => ["income", "deposit"].includes(cat);

  tbody.innerHTML = page
    .map(
      (t) => `
    <tr id="row-${t.id}">
      <td><span class="txn-reference">${t.reference || "#" + t.id}</span></td>
      <td><span class="txn-description" title="${t.description}">${t.description}</span></td>
      <td>${categoryBadge(t.category)}</td>
      <td>
        <span class="txn-amount ${isPos(t.category) ? "positive" : "negative"}">
          ${isPos(t.category) ? "+" : "-"}${formatCurrency(t.amount)}
        </span>
      </td>
      <td>${formatDate(t.date)}</td>
      <td><span class="status-badge ${t.status}">${cap(t.status)}</span></td>
      <td>
        <div class="txn-actions-cell">
          <a href="transaction-details.html?id=${t.id}" class="btn-view-detail">
            <i class="fa-solid fa-eye"></i> View
          </a>
          <button class="btn-delete-txn" data-id="${t.id}" data-ref="${t.reference || "#" + t.id}">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </td>
    </tr>`,
    )
    .join("");

  // Wire delete buttons
  tbody.querySelectorAll(".btn-delete-txn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteId = parseInt(btn.dataset.id);
      if (deleteModalRef) deleteModalRef.textContent = btn.dataset.ref;
      deleteModal?.classList.remove("d-none");
    });
  });
}

/* ── Pagination ───────────────────────────────────────────── */
function renderPagination() {
  if (!paginationCtrl || !paginationInfo) return;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length);
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);

  paginationInfo.textContent = filtered.length
    ? `Showing ${start}–${end} of ${filtered.length}`
    : "";

  if (totalPages <= 1) {
    paginationCtrl.innerHTML = "";
    return;
  }

  let html = `
    <button class="btn-page" id="btn-prev" ${currentPage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>`;

  for (let p = 1; p <= totalPages; p++) {
    // Show first, last, current ± 1
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      html += `<button class="btn-page ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
    } else if (Math.abs(p - currentPage) === 2) {
      html += `<span style="color:var(--color-text-muted);padding:0 4px">…</span>`;
    }
  }

  html += `
    <button class="btn-page" id="btn-next" ${currentPage === totalPages ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>`;

  paginationCtrl.innerHTML = html;

  paginationCtrl.querySelector("#btn-prev")?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      renderPagination();
    }
  });
  paginationCtrl.querySelector("#btn-next")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      renderPagination();
    }
  });
  paginationCtrl.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPage = parseInt(btn.dataset.page);
      renderTable();
      renderPagination();
    });
  });
}

/* ── Results count ────────────────────────────────────────── */
function updateCount() {
  if (!resultsCount) return;
  resultsCount.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${allTransactions.length}</strong> transactions`;
}

/* ── Control listeners ────────────────────────────────────── */
function initControls() {
  const debouncedFilter = debounce(applyFilters, 300);
  searchInput?.addEventListener("input", debouncedFilter);
  filterCat?.addEventListener("change", applyFilters);
  filterStatus?.addEventListener("change", applyFilters);
  filterFrom?.addEventListener("change", applyFilters);
  filterTo?.addEventListener("change", applyFilters);

  btnClear?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (filterCat) filterCat.value = "";
    if (filterStatus) filterStatus.value = "";
    if (filterFrom) filterFrom.value = "";
    if (filterTo) filterTo.value = "";
    applyFilters();
  });
}

/* ── Delete modal ─────────────────────────────────────────── */
function initDeleteModal() {
  btnCancelDel?.addEventListener("click", closeModal);
  deleteModal?.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeModal();
  });

  btnConfirmDel?.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    const row = document.getElementById(`row-${pendingDeleteId}`);
    row?.classList.add("txn-row-deleting");
    closeModal();

    try {
      await deleteTransaction(pendingDeleteId);
      allTransactions = allTransactions.filter((t) => t.id !== pendingDeleteId);
      applyFilters();
      showToast("Transaction deleted successfully.", "success");
    } catch {
      row?.classList.remove("txn-row-deleting");
      showToast("Failed to delete. Is JSON Server running?", "error");
    } finally {
      pendingDeleteId = null;
    }
  });
}

function closeModal() {
  deleteModal?.classList.add("d-none");
  pendingDeleteId = null;
}

/* ── Helpers ──────────────────────────────────────────────── */
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function categoryBadge(cat) {
  const icons = {
    income: "fa-arrow-trend-up",
    expense: "fa-arrow-trend-down",
    deposit: "fa-piggy-bank",
    withdrawal: "fa-money-bill-transfer",
  };
  return `<span class="category-badge ${cat}">
    <i class="fa-solid ${icons[cat] || "fa-circle"}"></i> ${cap(cat)}
  </span>`;
}
