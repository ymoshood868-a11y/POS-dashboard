/**
 * server.js — Express Application Entry Point
 * =============================================
 * HOW EXPRESS WORKS:
 *
 * app.use(middleware)      → runs on EVERY request
 * app.use('/path', router) → runs only for requests starting with /path
 *
 * Request lifecycle:
 *   Browser request
 *     → CORS middleware (allow cross-origin)
 *     → express.json() (parse request body from JSON string to JS object)
 *     → Route matching
 *       → (if protected) verifyToken middleware
 *       → Route handler
 *     → Response sent back
 *
 * PORT: 5000 (different from JSON Server's 3000 — both can run simultaneously)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5000;

/* ── CORS ──────────────────────────────────────────────────
   CORS = Cross-Origin Resource Sharing
   Browsers block requests from one origin (e.g. file:// or localhost:5500)
   to a different origin (localhost:5000) by default — security policy.
   We explicitly allow it here since our frontend and backend
   are on different ports during development.
──────────────────────────────────────────────────────────── */
app.use(
  cors({
    origin: "*", // In production, restrict this to your domain
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

/* ── Body parsing ──────────────────────────────────────────
   Without this, req.body would be undefined.
   express.json() reads the request body and parses it from
   a JSON string into a JavaScript object.
──────────────────────────────────────────────────────────── */
app.use(express.json());

/* ── Request logger (helpful while learning) ───────────────
   Logs every incoming request so you can see what's happening.
──────────────────────────────────────────────────────────── */
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

/* ── Mount routes ──────────────────────────────────────────
   app.use('/api/auth', authRouter) means:
   POST /api/auth/register → handled by authRouter's /register route
   POST /api/auth/login    → handled by authRouter's /login route
──────────────────────────────────────────────────────────── */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/notifications", require("./routes/notifications"));

/* ── Health check endpoint ─────────────────────────────────
   A simple endpoint to confirm the server is running.
   Open http://localhost:5000/api/health in browser to test.
──────────────────────────────────────────────────────────── */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "POSDash server is running",
    time: new Date().toISOString(),
  });
});

/* ── 404 handler ───────────────────────────────────────────
   If no route matched, send a clear error message.
──────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.url} not found.` });
});

/* ── Global error handler ──────────────────────────────────
   If any route throws an unhandled error, catch it here
   instead of crashing the whole server.
──────────────────────────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ message: "Internal server error." });
});

/* ── Start listening ───────────────────────────────────────
   The server is now ready to accept connections on port 5000.
──────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log("");
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   POSDash Backend Server Running       ║");
  console.log(`║   http://localhost:${PORT}               ║`);
  console.log("╠═══════════════════════════════════════╣");
  console.log("║   Endpoints:                           ║");
  console.log("║   POST /api/auth/register              ║");
  console.log("║   POST /api/auth/login                 ║");
  console.log("║   GET  /api/transactions               ║");
  console.log("║   POST /api/transactions               ║");
  console.log("║   GET  /api/notifications/stream       ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log("");
});
