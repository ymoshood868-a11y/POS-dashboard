/**
 * transaction-details.js — Single transaction view
 * POS Dashboard | Module 3
 *
 * Reads ?id= from URL, fetches GET /transactions/:id,
 * renders all fields. Supports Delete and Edit (link to edit page).
 */

import Layout from "./layout.js";
import { getTransactionById, deleteTransaction } from "./api.js";
import { formatCurrency, formatDate, showToast } from "./utils.js";

/* ── DOM refs ─────────────────────────────────────────────── */
const detailRef = document.getElementById("detail-ref");
const detailAmount = document.getElementById("detail-amount");
const detailAmtLbl = document.getElementById("detail-amount-label");
const detailCat = document.getElementById("detail-category");
const detailDate = document.getElementById("detail-date");
const detailStatus = document.getElementById("detail-status");
const detailStatusB = document.getElementById("detail-status-badge");
const detailId = document.getElementById("detail-id");
const detailDesc = document.getElementById("detail-description");
const btnEdit = document.getElementById("btn-edit-txn");
const btnDelete = document.getElementById("btn-delete-txn");
const deleteModal = document.getElementById("delete-modal");
const deleteModalRef = document.getElementById("delete-modal-ref");
const btnCancelDel = document.getElementById("btn-cancel-delete");
const btnConfirmDel = document.getElementById("btn-confirm-delete");

/* ── Boot ─────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  await Layout.init({
    pageTitle: "Transaction Details",
    breadcrumb: "Details",
  });

  const id = getIdFromURL();
  if (!id) {
    showError("No transaction ID provided.");
    return;
  }

  await loadTransaction(id);
  initDeleteModal(id);
});

/* ── Get ID from URL query string ─────────────────────────── */
function getIdFromURL() {
  return new URLSearchParams(window.location.search).get("id");
}

/* ── Fetch and render ─────────────────────────────────────── */
async function loadTransaction(id) {
  try {
    const t = await getTransactionById(id);
    renderTransaction(t);
  } catch {
    showError("Transaction not found or server is offline.");
  }
}

function renderTransaction(t) {
  const isPos = ["income", "deposit"].includes(t.category);

  // Reference
  if (detailRef) detailRef.textContent = t.reference || `#${t.id}`;

  // Amount
  if (detailAmount) {
    detailAmount.className = `detail-amount ${isPos ? "positive" : "negative"}`;
    detailAmount.textContent = `${isPos ? "+" : "-"}${formatCurrency(t.amount)}`;
  }
  if (detailAmtLbl) detailAmtLbl.textContent = cap(t.category) + " transaction";

  // Category
  if (detailCat) {
    const icons = {
      income: "fa-arrow-trend-up",
      expense: "fa-arrow-trend-down",
      deposit: "fa-piggy-bank",
      withdrawal: "fa-money-bill-transfer",
    };
    detailCat.innerHTML = `<span class="category-badge ${t.category}">
      <i class="fa-solid ${icons[t.category] || "fa-circle"}"></i> ${cap(t.category)}
    </span>`;
  }

  // Date
  if (detailDate) detailDate.textContent = formatDate(t.date);

  // Status
  if (detailStatus)
    detailStatus.innerHTML = `<span class="status-badge ${t.status}">${cap(t.status)}</span>`;
  if (detailStatusB) {
    detailStatusB.textContent = cap(t.status);
    detailStatusB.className = `status-badge ${t.status}`;
  }

  // ID
  if (detailId) detailId.textContent = `#${t.id}`;

  // Description
  if (detailDesc) detailDesc.textContent = t.description || "—";

  // Edit link — points to new-transaction page with ?id= for edit mode
  if (btnEdit) btnEdit.href = `new-transaction.html?id=${t.id}`;

  // Page title
  document.title = `${t.reference || "#" + t.id} — POSDash`;
}

/* ── Delete modal ─────────────────────────────────────────── */
function initDeleteModal(id) {
  const ref = document.getElementById("detail-ref")?.textContent || `#${id}`;
  if (deleteModalRef) deleteModalRef.textContent = ref;

  btnDelete?.addEventListener("click", () => {
    deleteModal?.classList.remove("d-none");
  });

  btnCancelDel?.addEventListener("click", closeModal);
  deleteModal?.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeModal();
  });

  btnConfirmDel?.addEventListener("click", async () => {
    closeModal();
    btnDelete && (btnDelete.disabled = true);

    try {
      await deleteTransaction(id);
      showToast("Transaction deleted. Redirecting…", "success", 1500);
      setTimeout(
        () => window.location.replace("transaction-history.html"),
        1500,
      );
    } catch {
      showToast("Failed to delete. Is JSON Server running?", "error");
      if (btnDelete) btnDelete.disabled = false;
    }
  });
}

function closeModal() {
  deleteModal?.classList.add("d-none");
}

/* ── Helpers ──────────────────────────────────────────────── */
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function showError(msg) {
  const card = document.getElementById("detail-card");
  if (card) {
    card.innerHTML = `
      <div class="table-empty-state" style="margin:0;border:none">
        <div class="empty-icon"><i class="fa-solid fa-circle-xmark"></i></div>
        <p class="empty-title">${msg}</p>
        <p class="empty-sub">
          <a href="transaction-history.html" class="empty-link">
            <i class="fa-solid fa-arrow-left"></i> Back to Transactions
          </a>
        </p>
      </div>`;
  }
}
