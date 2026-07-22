/**
 * dashboard.js — Dashboard page logic ONLY
 * POS Transaction Dashboard
 *
 * Imports Layout for sidebar/navbar/footer wiring,
 * then handles dashboard-specific data and rendering.
 *
 * Other pages should NOT import this file.
 * Each page has its own page-specific script.
 */

import Layout from "./layout.js";
import {
  getTransactions,
  computeSummary,
  getRecentTransactions,
} from "./api.js";
import { formatCurrency, formatDate, showToast } from "./utils.js";

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  // Init shared layout (auth guard + sidebar + navbar + footer + user)
  await Layout.init({ pageTitle: "Dashboard", breadcrumb: "Overview" });

  // Load dashboard-specific data
  loadDashboardData();
});

/* ============================================================
   Data loader
   ============================================================ */
async function loadDashboardData() {
  let transactions = [];

  try {
    transactions = await getTransactions();
  } catch {
    console.warn(
      "JSON Server unreachable — dashboard running with empty data.",
    );
    showToast("JSON Server offline. Run: npm run server", "warning", 6000);
  }

  // Update sidebar transaction count badge
  const badge = document.getElementById("txn-count-badge");
  if (badge) badge.textContent = transactions.length || "0";

  renderSummaryCards(transactions);
  renderWelcomeBanner(transactions);
  renderChart(transactions);
  renderTransactionsTable(getRecentTransactions(transactions, 8));
}

/* ============================================================
   Welcome Banner — today's count + net profit
   ============================================================ */
function renderWelcomeBanner(transactions) {
  const today = new Date().toISOString().split("T")[0];
  const todayTxns = transactions.filter((t) => t.date?.startsWith(today));
  const summary = computeSummary(transactions);
  const net =
    summary.income +
    summary.deposits -
    (summary.expenses + summary.withdrawals);
  const netColor = net >= 0 ? "var(--color-success)" : "var(--color-danger)";

  const el = document.getElementById("welcome-stats");
  if (!el) return;

  el.innerHTML = `
    <div class="welcome-stat-item">
      <i class="fa-solid fa-receipt" style="color:var(--color-gold)"></i>
      <span>You have <strong>${todayTxns.length}</strong>
        transaction${todayTxns.length !== 1 ? "s" : ""} today</span>
    </div>
    <div class="welcome-stat-item">
      <i class="fa-solid fa-scale-balanced" style="color:${netColor}"></i>
      <span>Net Profit: <strong style="color:${netColor}">${formatCurrency(net)}</strong></span>
    </div>`;
}

/* ============================================================
   Summary Cards — dynamic values + trend + subtitle
   ============================================================ */
function renderSummaryCards(transactions) {
  const now = new Date();
  const thisMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const lastMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
    );
  });

  const totals = computeSummary(transactions);
  const thisM = computeSummary(thisMonth);
  const lastM = computeSummary(lastMonth);

  const pct = (curr, prev) =>
    prev === 0
      ? curr > 0
        ? 100
        : 0
      : Math.round(((curr - prev) / prev) * 100);

  [
    {
      valueId: "card-income",
      subId: "card-income-sub",
      trendId: "card-income-trend",
      total: totals.income,
      curr: thisM.income,
      prev: lastM.income,
      sub: "Income from Sales",
      positive: true,
    },
    {
      valueId: "card-expenses",
      subId: "card-expenses-sub",
      trendId: "card-expenses-trend",
      total: totals.expenses,
      curr: thisM.expenses,
      prev: lastM.expenses,
      sub: "Monthly Expenses",
      positive: false,
    },
    {
      valueId: "card-deposits",
      subId: "card-deposits-sub",
      trendId: "card-deposits-trend",
      total: totals.deposits,
      curr: thisM.deposits,
      prev: lastM.deposits,
      sub: "Total Deposits",
      positive: true,
    },
    {
      valueId: "card-withdrawals",
      subId: "card-withdrawals-sub",
      trendId: "card-withdrawals-trend",
      total: totals.withdrawals,
      curr: thisM.withdrawals,
      prev: lastM.withdrawals,
      sub: "Cash Withdrawals",
      positive: false,
    },
  ].forEach(({ valueId, subId, trendId, total, curr, prev, sub, positive }) => {
    const p = pct(curr, prev);
    const isUp = p >= 0;
    const good = positive ? isUp : !isUp;
    const color = good ? "var(--color-success)" : "var(--color-danger)";

    _setText(valueId, formatCurrency(total));
    _setText(subId, sub);
    _setHTML(
      trendId,
      `<i class="fa-solid ${isUp ? "fa-caret-up" : "fa-caret-down"}" style="color:${color}"></i>
      <span style="color:${color};font-weight:500;font-size:0.8rem">${isUp ? "+" : ""}${p}% this month</span>`,
    );
  });
}

/* ============================================================
   Revenue Chart — Weekly bar chart (Mon–Sun), checklist requirement
   ============================================================ */
function renderChart(transactions) {
  const canvas = document.getElementById("revenue-chart");
  const wrapper = document.getElementById("chart-wrapper");
  const emptyEl = document.getElementById("chart-empty");

  const hasData = transactions.some((t) => parseFloat(t.amount) > 0);
  if (!hasData || !canvas || typeof Chart === "undefined") {
    wrapper?.classList.add("d-none");
    emptyEl?.classList.remove("d-none");
    return;
  }

  // Build Mon–Sun of the current week
  const today = new Date();
  const dayOfWk = today.getDay(); // 0=Sun … 6=Sat
  // Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWk + 6) % 7));

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const incomeData = [];
  const expenseData = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toISOString().split("T")[0]; // 'YYYY-MM-DD'

    const slice = transactions.filter(
      (t) => t.date && t.date.startsWith(dayStr),
    );

    incomeData.push(
      slice
        .filter((t) => t.category === "income" || t.category === "deposit")
        .reduce((s, t) => s + parseFloat(t.amount), 0),
    );
    expenseData.push(
      slice
        .filter((t) => t.category === "expense" || t.category === "withdrawal")
        .reduce((s, t) => s + parseFloat(t.amount), 0),
    );
  }

  // Update subtitle in HTML
  const subtitle = document.querySelector(
    '.chart-section [style*="color:var(--color-text-muted)"]',
  );
  if (subtitle) subtitle.textContent = "This week (Mon–Sun)";

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: dayNames,
      datasets: [
        {
          label: "Income / Deposits",
          data: incomeData,
          backgroundColor: "rgba(201,168,76,0.75)",
          borderColor: "#c9a84c",
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Expenses / Withdrawals",
          data: expenseData,
          backgroundColor: "rgba(231,76,60,0.65)",
          borderColor: "#e74c3c",
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          borderColor: "#2a2a2a",
          borderWidth: 1,
          titleColor: "#f0f0f0",
          bodyColor: "#a0a0a0",
          padding: 12,
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#606060", font: { family: "Poppins", size: 11 } },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.04)" },
          beginAtZero: true,
          ticks: {
            color: "#606060",
            font: { family: "Poppins", size: 11 },
            callback: (v) => "$" + v.toLocaleString(),
          },
        },
      },
    },
  });
}

/* ============================================================
   Recent Transactions Table
   ============================================================ */
function renderTransactionsTable(transactions) {
  const skeletonEl = document.getElementById("table-skeleton");
  const realEl = document.getElementById("table-real");
  const emptyEl = document.getElementById("table-empty");
  const tbody = document.getElementById("transactions-tbody");

  skeletonEl?.classList.add("d-none");

  if (!transactions.length) {
    emptyEl?.classList.remove("d-none");
    return;
  }

  realEl?.classList.remove("d-none");

  const pos = (cat) => ["income", "deposit"].includes(cat);

  tbody.innerHTML = transactions
    .map(
      (txn) => `
    <tr>
      <td><span class="txn-reference">${txn.reference || "#" + txn.id}</span></td>
      <td><span class="txn-description" title="${txn.description}">${txn.description}</span></td>
      <td><span class="category-badge ${txn.category}">${_catIcon(txn.category)} ${_cap(txn.category)}</span></td>
      <td><span class="txn-amount ${pos(txn.category) ? "positive" : "negative"}">${pos(txn.category) ? "+" : "-"}${formatCurrency(txn.amount)}</span></td>
      <td>${formatDate(txn.date)}</td>
      <td><span class="status-badge ${txn.status}">${_cap(txn.status)}</span></td>
    </tr>`,
    )
    .join("");
}

/* ============================================================
   Helpers (dashboard-local)
   ============================================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function _setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function _cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
function _catIcon(cat) {
  return (
    {
      income: '<i class="fa-solid fa-arrow-trend-up"></i>',
      expense: '<i class="fa-solid fa-arrow-trend-down"></i>',
      deposit: '<i class="fa-solid fa-piggy-bank"></i>',
      withdrawal: '<i class="fa-solid fa-money-bill-transfer"></i>',
    }[cat] || ""
  );
}
