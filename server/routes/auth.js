/**
 * routes/auth.js — Register & Login
 * =====================================
 * POST /api/auth/register  → create account, return JWT
 * POST /api/auth/login     → verify credentials, return JWT
 *
 * HOW PASSWORDS WORK HERE:
 *  - bcrypt.hash(password, 10) → turns "abc123" into a long hash string
 *    The "10" is the salt rounds — higher = more secure but slower
 *  - bcrypt.compare(plain, hash) → returns true/false
 *    You can NEVER reverse a bcrypt hash back to the original password
 *
 * HOW JWT WORKS HERE:
 *  - jwt.sign(payload, secret, options) → creates a signed token
 *  - The payload is the data you want to store IN the token (user id, email)
 *  - The secret is a private key only the server knows
 *  - expiresIn: '7d' means the token is valid for 7 days
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();
const DB_PATH = path.join(__dirname, "../data/db.json");

/* ── Helper: read & write the JSON database ────────────── */
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/* ══════════════════════════════════════════════════════════
   POST /api/auth/register
   Body: { name, email, password }
══════════════════════════════════════════════════════════ */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    const db = readDB();

    // Check if email already taken
    const exists = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (exists) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    // Hash the password — NEVER store plain text
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user object
    const newUser = {
      id: uuidv4(), // generates a unique ID like "f47ac10b-..."
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    // Save to database
    db.users.push(newUser);
    writeDB(db);

    // Create a JWT token for the new user
    // We store id, name, email in the token — NOT the password
    const token = jwt.sign(
      {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Respond — don't send the password back
    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/auth/login
   Body: { email, password }
══════════════════════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const db = readDB();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      // Don't reveal whether email exists — just say "invalid credentials"
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Compare the plain password with the stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

module.exports = router;
