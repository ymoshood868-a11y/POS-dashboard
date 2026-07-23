/**
 * reports.js — Reports & Analytics page logic
 * POS Dashboard | Module 4: Reports & Analytics
 *
 * Fetches all transactions via getTransactions() from api.js,
 * then renders:
 *  - Category filter bar
 *  - Net Profit + KPI stats (transaction count, avg transaction)
 *  - Breakdown cards (Income / Expenses / Deposits / Withdrawals)
 *  - Revenue Overview bar chart (reuses Chart.js pattern from dashboard.js)
 *  - Filtered transactions table
 *  - Category donut chart
 *  - Top transactions by amount
 */

import Layout from "./layout.js";
import { getTransactions, computeSummary } from "./api.js";
import { formatCurrency, formatDate, showToast } from "./utils.js";

/* ============================================================
   State
   ============================================================ */
let allTransactions = [];
let activeFilter = "all";
let revenueChart = null;
let donutChart = null;

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await Layout.init({ pageTitle: "Reports", breadcrumb: "Reports & Analytics" });
  await loadReports();
});

/* ============================================================
   Main data loader
   ============================================================ */
async function loadReports() {
  showLoading(true);

  try {
    allTransactions = await getTransactions();
  } catch {
    showToast("JSON Server offline. Run: npm run server", "warning", 6000);
    allTransactions = [];
  }

  showLoading(false);

  // Render everything with full data first
  renderFilterCounts(allTransactions);
  renderStats(allTransactions);
  renderBreakdownCards(allTransactions);
  renderRevenueChart(allTransactions);
  renderTable(allTransactions);
  renderDonutChart(allTransactions);
  renderTopTransactions(allTransactions);

  // Wire up filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      // Update active state
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter();
    });
  });
}

/* ============================================================
   Apply category filter
   ============================================================ */
function applyFilter() {
  const filtered =
    activeFilter === "all"
      ? allTransactions
      : allTransactions.filter((t) => t.category === activeFilter);

  renderStats(filtered);
  renderBreakdownCards(filtered);
  renderRevenueChart(filtered);
  renderTable(filtered);
  renderDonutChart(filtered);
  renderTopTransactions(filtered);
}

/* ============================================================
   Filter badge counts
   ============================================================ */
function renderFilterCounts(transactions) {
  const counts = { all: transactions.length, income: 0, expense: 0, deposit: 0, withdrawal: 0 };
  transactions.forEach((t) => {
    if (counts[t.category] !== undefined) counts[t.category]++;
  });

  Object.entries(counts).forEach(([key, val]) => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = val;
  });
}

/* ============================================================
   Stats: Net Profit, Tx Count, Avg Transaction, Avg Income
   ============================================================ */
function renderStats(transactions) {
  const summary = computeSummary(transactions);
  const net = summary.income + summary.deposits - (summary.expenses + summary.withdrawals);
  const count = transactions.length;
  const total = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const avg = count > 0 ? total / count : 0;

  // Net Profit hero
  const netEl = document.getElementById("net-profit-value");
  if (netEl) {
    netEl.textContent = formatCurrency(net);
    netEl.className = `net-profit-value ${net >= 0 ? "positive" : "negative"}`;
  }
  _setText("net-profit-sub", net >= 0 ? "Positive cash flow" : "Negative cash flow");

  // KPI cards
  _setText("kpi-txn-count", count.toLocaleString());
  _setText("kpi-avg-txn", formatCurrency(avg));

  const inflow = summary.income + summary.deposits;
  const outflow = summary.expenses + summary.withdrawals;
  _setText("kpi-inflow", formatCurrency(inflow));
  _setText("kpi-outflow", formatCurrency(outflow));
}

/* ============================================================
   Breakdown Cards
   ============================================================ */
function renderBreakdownCards(transactions) {
  const summary = computeSummary(transactions);
  const total = Object.values(summary).reduce((s, v) => s + v, 0);

  const cards = [
    { key: "income",     label: "Total Income",      value: summary.income,      icon: "fa-arrow-trend-up",        count: transactions.filter(t => t.category === "income").length },
    { key: "expense",    label: "Total Expenses",     value: summary.expenses,    icon: "fa-arrow-trend-down",      count: transactions.filter(t => t.category === "expense").length },
    { key: "deposit",    label: "Total Deposits",     value: summary.deposits,    icon: "fa-piggy-bank",            count: transactions.filter(t => t.category === "deposit").length },
    { key: "withdrawal", label: "Total Withdrawals",  value: summary.withdrawals, icon: "fa-money-bill-transfer",   count: transactions.filter(t => t.category === "withdrawal").length },
  ];

  cards.forEach(({ key, value, count }) => {
    _setText(`bc-value-${key}`, formatCurrency(value));
    _setText(`bc-count-${key}`, `${count} transaction${count !== 1 ? "s" : ""}`);

    const pct = total > 0 ? (value / total) * 100 : 0;
    const fill = document.getElementById(`bc-fill-${key}`);
    if (fill) fill.style.width = `${Math.min(pct, 100).toFixed(1)}%`;
  });
}

/* ============================================================
   Revenue Overview Chart (bar — Income+Deposits vs Expenses+Withdrawals)
   Supports Weekly / Monthly view via range toggle buttons
   ============================================================ */
function renderRevenueChart(transactions, range = "weekly") {
  const canvas = document.getElementById("report-revenue-chart");
  if (!canvas || typeof Chart === "undefined") return;

  // Destroy previous chart instance
  if (revenueChart) {
    revenueChart.destroy();
    revenueChart = null;
  }

  let labels = [];
  let incomeData = [];
  let expenseData = [];

  if (range === "weekly") {
    // Current week Mon–Sun
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    labels = dayNames;

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStr = day.toISOString().split("T")[0];
      const slice = transactions.filter((t) => t.date && t.date.startsWith(dayStr));

      incomeData.push(
        slice.filter((t) => t.category === "income" || t.category === "deposit")
             .reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      );
      expenseData.push(
        slice.filter((t) => t.category === "expense" || t.category === "withdrawal")
             .reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      );
    }

    _setText("chart-range-label", "This week (Mon–Sun)");

  } else {
    // Monthly — last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const monthLabel = d.toLocaleString("en-US", { month: "short" });
      labels.push(monthLabel);

      const slice = transactions.filter((t) => {
        if (!t.date) return false;
        const td = new Date(t.date);
        return td.getFullYear() === yr && td.getMonth() === mo;
      });

      incomeData.push(
        slice.filter((t) => t.category === "income" || t.category === "deposit")
             .reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      );
      expenseData.push(
        slice.filter((t) => t.category === "expense" || t.category === "withdrawal")
             .reduce((s, t) => s + parseFloat(t.amount || 0), 0)
      );
    }

    _setText("chart-range-label", "Last 6 months");
  }

  revenueChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
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
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
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

  // Wire up range toggle buttons (only once)
  if (!canvas.dataset.wired) {
    canvas.dataset.wired = "true";
    document.querySelectorAll(".chart-range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".chart-range-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const filtered =
          activeFilter === "all"
            ? allTransactions
            : allTransactions.filter((t) => t.category === activeFilter);
        renderRevenueChart(filtered, btn.dataset.range);
      });
    });
  }
}

/* ============================================================
   Filtered Transactions Table
   ============================================================ */
function renderTable(transactions) {
  const tbody = document.getElementById("report-tbody");
  const countEl = document.getElementById("report-txn-count");
  const emptyEl = document.getElementById("report-table-empty");
  const tableEl = document.getElementById("report-table-real");

  if (countEl) countEl.textContent = `${transactions.length} record${transactions.length !== 1 ? "s" : ""}`;

  if (!transactions.length) {
    tableEl?.classList.add("d-none");
    emptyEl?.classList.remove("d-none");
    return;
  }

  tableEl?.classList.remove("d-none");
  emptyEl?.classList.add("d-none");

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const pos = (cat) => ["income", "deposit"].includes(cat);

  tbody.innerHTML = sorted
    .map(
      (txn) => `
    <tr>
      <td><span class="txn-reference">${txn.reference || "#" + txn.id}</span></td>
      <td><span class="txn-description" title="${txn.description}">${txn.description}</span></td>
      <td><span class="category-badge ${txn.category}">${_catIcon(txn.category)} ${_cap(txn.category)}</span></td>
      <td><span class="txn-amount ${pos(txn.category) ? "positive" : "negative"}">${pos(txn.category) ? "+" : "-"}${formatCurrency(txn.amount)}</span></td>
      <td>${formatDate(txn.date)}</td>
      <td><span class="status-badge ${txn.status}">${_cap(txn.status)}</span></td>
    </tr>`
    )
    .join("");
}

/* ============================================================
   Category Donut Chart
   ============================================================ */
function renderDonutChart(transactions) {
  const canvas = document.getElementById("report-donut-chart");
  if (!canvas || typeof Chart === "undefined") return;

  if (donutChart) {
    donutChart.destroy();
    donutChart = null;
  }

  const summary = computeSummary(transactions);
  const data = [summary.income, summary.expenses, summary.deposits, summary.withdrawals];
  const total = data.reduce((s, v) => s + v, 0);

  // Update legend values
  _setText("donut-val-income",     formatCurrency(summary.income));
  _setText("donut-val-expense",    formatCurrency(summary.expenses));
  _setText("donut-val-deposit",    formatCurrency(summary.deposits));
  _setText("donut-val-withdrawal", formatCurrency(summary.withdrawals));

  donutChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expenses", "Deposits", "Withdrawals"],
      datasets: [
        {
          data,
          backgroundColor: [
            "rgba(39,174,96,0.85)",
            "rgba(231,76,60,0.85)",
            "rgba(201,168,76,0.85)",
            "rgba(155,89,182,0.85)",
          ],
          borderColor: "#1a1a1a",
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
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
            label: (ctx) => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/* ============================================================
   Top 5 Transactions by Amount
   ============================================================ */
function renderTopTransactions(transactions) {
  const container = document.getElementById("top-txn-list");
  if (!container) return;

  const top5 = [...transactions]
    .sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0))
    .slice(0, 5);

  if (!top5.length) {
    container.innerHTML = `<p style="color:var(--color-text-muted);font-size:0.85rem;text-align:center;padding:var(--space-lg) 0;">No transactions to display.</p>`;
    return;
  }

  const pos = (cat) => ["income", "deposit"].includes(cat);

  container.innerHTML = top5
    .map(
      (txn, i) => `
    <div class="top-txn-item">
      <span class="top-txn-rank rank-${i + 1}">${i + 1}</span>
      <div class="top-txn-info">
        <div class="top-txn-desc" title="${txn.description}">${txn.description}</div>
        <div class="top-txn-date">${formatDate(txn.date)} &middot; <span class="category-badge ${txn.category}" style="padding:1px 7px;font-size:0.68rem">${_cap(txn.category)}</span></div>
      </div>
      <span class="top-txn-amount ${pos(txn.category) ? "positive" : "negative"}">
        ${pos(txn.category) ? "+" : "-"}${formatCurrency(txn.amount)}
      </span>
    </div>`
    )
    .join("");
}

/* ============================================================
   Loading state toggle
   ============================================================ */
function showLoading(show) {
  const el = document.getElementById("reports-loading");
  const content = document.getElementById("reports-content");
  if (el) el.classList.toggle("d-none", !show);
  if (content) content.classList.toggle("d-none", show);
}

/* ============================================================
   Helpers
   ============================================================ */
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function _catIcon(cat) {
  return (
    {
      income:     '<i class="fa-solid fa-arrow-trend-up"></i>',
      expense:    '<i class="fa-solid fa-arrow-trend-down"></i>',
      deposit:    '<i class="fa-solid fa-piggy-bank"></i>',
      withdrawal: '<i class="fa-solid fa-money-bill-transfer"></i>',
    }[cat] || ""
  );
}
