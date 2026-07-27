/**
 * routes/transactions.js — Transaction CRUD
 * ============================================
 * All routes require a valid JWT (verifyToken middleware).
 * Every transaction is tied to req.user.id so users only see their own.
 *
 * GET    /api/transactions          → list current user's transactions
 * GET    /api/transactions/:id      → single transaction
 * POST   /api/transactions          → create new transaction
 * PUT    /api/transactions/:id      → update transaction
 * DELETE /api/transactions/:id      → delete transaction
 *
 * HOW NOTIFICATIONS WORK:
 * When a transaction is created, we also write a notification entry.
 * The SSE route in notifications.js streams those to all connected clients.
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const DB_PATH = path.join(__dirname, "../data/db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Apply verifyToken to ALL routes in this file
// This means every request must include Authorization: Bearer <token>
router.use(verifyToken);

/* ── GET /api/transactions ─────────────────────────────── */
router.get("/", (req, res) => {
  const db = readDB();

  // Only return THIS user's transactions
  let txns = db.transactions.filter((t) => t.userId === req.user.id);

  // Support query filters: ?category=income&status=completed
  const { category, status, dateFrom, dateTo } = req.query;

  if (category) txns = txns.filter((t) => t.category === category);
  if (status) txns = txns.filter((t) => t.status === status);
  if (dateFrom) txns = txns.filter((t) => t.date >= dateFrom);
  if (dateTo) txns = txns.filter((t) => t.date <= dateTo);

  // Sort newest first
  txns.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(txns);
});

/* ── GET /api/transactions/:id ─────────────────────────── */
router.get("/:id", (req, res) => {
  const db = readDB();
  const txn = db.transactions.find(
    (t) => t.id === req.params.id && t.userId === req.user.id,
  );

  if (!txn) return res.status(404).json({ message: "Transaction not found." });
  res.json(txn);
});

/* ── POST /api/transactions ────────────────────────────── */
router.post("/", (req, res) => {
  const { description, category, amount, date, status } = req.body;

  if (!description || !category || !amount || !date) {
    return res
      .status(400)
      .json({
        message: "description, category, amount and date are required.",
      });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res
      .status(400)
      .json({ message: "Amount must be a positive number." });
  }

  const db = readDB();

  // Generate reference number like TXN-0012
  const count = db.transactions.length + 1;
  const reference = `TXN-${String(count).padStart(3, "0")}`;

  const newTxn = {
    id: uuidv4(),
    userId: req.user.id, // always tied to the logged-in user
    reference,
    description,
    category,
    amount: parseFloat(amount),
    date,
    status: status || "pending",
    createdAt: new Date().toISOString(),
  };

  db.transactions.push(newTxn);

  // ── Create a notification so OTHER users can be notified ──
  // This is how real notification systems work:
  // when something happens, you write a notification record.
  // The SSE stream then pushes it to connected clients.
  const notification = {
    id: uuidv4(),
    type: "new_transaction",
    message: `${req.user.name} added a ${category} of $${parseFloat(amount).toFixed(2)}`,
    fromUser: req.user.id,
    fromName: req.user.name,
    data: { transactionId: newTxn.id, category, amount: newTxn.amount },
    createdAt: new Date().toISOString(),
    readBy: [], // tracks which users have read it
  };

  db.notifications.push(notification);
  writeDB(db);

  // Broadcast to all SSE clients (explained in notifications.js)
  const { broadcast } = require("./notifications");
  broadcast(notification);

  res.status(201).json(newTxn);
});

/* ── PUT /api/transactions/:id ─────────────────────────── */
router.put("/:id", (req, res) => {
  const db = readDB();
  const idx = db.transactions.findIndex(
    (t) => t.id === req.params.id && t.userId === req.user.id,
  );

  if (idx === -1)
    return res.status(404).json({ message: "Transaction not found." });

  // Merge existing with updates — user can't change userId or id
  db.transactions[idx] = {
    ...db.transactions[idx],
    ...req.body,
    id: db.transactions[idx].id, // prevent ID change
    userId: db.transactions[idx].userId, // prevent ownership change
  };

  writeDB(db);
  res.json(db.transactions[idx]);
});

/* ── DELETE /api/transactions/:id ──────────────────────── */
router.delete("/:id", (req, res) => {
  const db = readDB();
  const idx = db.transactions.findIndex(
    (t) => t.id === req.params.id && t.userId === req.user.id,
  );

  if (idx === -1)
    return res.status(404).json({ message: "Transaction not found." });

  db.transactions.splice(idx, 1);
  writeDB(db);

  res.status(204).send(); // 204 = success, no content to return
});

module.exports = router;
