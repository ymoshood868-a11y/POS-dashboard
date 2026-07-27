/**
 * routes/notifications.js — Real-time notifications via SSE
 * ===========================================================
 * HOW SERVER-SENT EVENTS (SSE) WORK:
 *
 * Normal HTTP:  Browser asks → Server answers → Connection closes.
 *
 * SSE:          Browser asks → Server keeps connection OPEN forever.
 *               Server can push data whenever it wants.
 *               Browser receives it automatically.
 *
 * The browser uses:  const es = new EventSource('/api/notifications/stream?token=...')
 * es.onmessage = (e) => console.log(JSON.parse(e.data))
 *
 * ROUTES:
 * GET /api/notifications/stream   → SSE connection (keep-alive)
 * GET /api/notifications          → list unread notifications for user
 * POST /api/notifications/:id/read → mark as read
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, verifyToken } = require("../middleware/auth");

const router = express.Router();
const DB_PATH = path.join(__dirname, "../data/db.json");

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Store all active SSE connections
// Map of userId → response object
// When we want to notify someone, we look them up here and write to their connection
const clients = new Map();

/* ── SSE stream endpoint ───────────────────────────────── */
// This route does NOT use verifyToken middleware because
// EventSource can't send custom headers.
// Instead we accept the token as a query parameter.
router.get("/stream", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({ message: "Token required." });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid token." });
  }

  // Set SSE headers — this tells the browser to keep the connection open
  // and expect a stream of text/event-stream data
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders(); // Send headers immediately

  // Register this client
  clients.set(user.id, res);
  console.log(
    `[SSE] User ${user.name} connected. Active clients: ${clients.size}`,
  );

  // Send a welcome event so the client knows the connection is live
  res.write(
    `data: ${JSON.stringify({ type: "connected", message: "Notification stream active" })}\n\n`,
  );

  // Send any unread notifications they missed while offline
  const db = readDB();
  const unread = db.notifications.filter(
    (n) =>
      n.fromUser !== user.id && // not their own actions
      !n.readBy.includes(user.id), // not already read
  );

  unread.forEach((n) => {
    res.write(`data: ${JSON.stringify(n)}\n\n`);
  });

  // Keep connection alive with a heartbeat every 25 seconds
  // (browsers close idle SSE connections after ~30s)
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  // Cleanup when client disconnects
  req.on("close", () => {
    clients.delete(user.id);
    clearInterval(heartbeat);
    console.log(
      `[SSE] User ${user.name} disconnected. Active clients: ${clients.size}`,
    );
  });
});

/* ── Broadcast: push a notification to all connected users ── */
// This function is called from transactions.js when a new transaction is created.
// It loops through all connected clients and sends them the event.
function broadcast(notification) {
  console.log(
    `[SSE] Broadcasting to ${clients.size} clients:`,
    notification.message,
  );

  clients.forEach((clientRes, userId) => {
    // Don't notify the user who created the transaction
    if (userId !== notification.fromUser) {
      clientRes.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  });
}

/* ── GET /api/notifications ─────────────────────────────── */
router.get("/", verifyToken, (req, res) => {
  const db = readDB();

  // Return notifications NOT created by this user, newest first
  const notifs = db.notifications
    .filter((n) => n.fromUser !== req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20); // last 20

  // Add isRead flag for this specific user
  const withReadFlag = notifs.map((n) => ({
    ...n,
    isRead: n.readBy.includes(req.user.id),
  }));

  res.json(withReadFlag);
});

/* ── POST /api/notifications/:id/read ──────────────────── */
router.post("/:id/read", verifyToken, (req, res) => {
  const db = readDB();
  const idx = db.notifications.findIndex((n) => n.id === req.params.id);

  if (idx === -1)
    return res.status(404).json({ message: "Notification not found." });

  // Add this user to the readBy array if not already there
  if (!db.notifications[idx].readBy.includes(req.user.id)) {
    db.notifications[idx].readBy.push(req.user.id);
    writeDB(db);
  }

  res.json({ message: "Marked as read." });
});

/* ── POST /api/notifications/read-all ──────────────────── */
router.post("/read-all", verifyToken, (req, res) => {
  const db = readDB();

  db.notifications.forEach((n) => {
    if (!n.readBy.includes(req.user.id)) {
      n.readBy.push(req.user.id);
    }
  });

  writeDB(db);
  res.json({ message: "All notifications marked as read." });
});

module.exports = router;
module.exports.broadcast = broadcast;
