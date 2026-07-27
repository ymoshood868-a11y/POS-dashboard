/**
 * auth.js — JWT Authentication Middleware
 * =========================================
 * HOW IT WORKS:
 * 1. Frontend sends every request with a header:
 *      Authorization: Bearer <token>
 * 2. This middleware reads that token
 * 3. Verifies it using the same secret key used to sign it
 * 4. If valid → attaches user info to req.user and calls next()
 * 5. If invalid/missing → sends 401 Unauthorized immediately
 *
 * "next()" means "this middleware is done, go to the actual route handler"
 */

const jwt = require('jsonwebtoken');

// This secret key signs and verifies tokens.
// In production you'd put this in a .env file, never hardcode it.
const JWT_SECRET = 'posdash_secret_key_2025';

function verifyToken(req, res, next) {
  // The Authorization header looks like: "Bearer eyJhbGci..."
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  // Split "Bearer <token>" → take the second part
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token format invalid.' });
  }

  try {
    // jwt.verify throws an error if the token is fake or expired
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach the decoded user data to the request object
    // Now any route handler can access req.user.id, req.user.email etc.
    req.user = decoded;

    next(); // Token is valid — proceed to the route
  } catch (err) {
    return res.status(401).json({ message: 'Token expired or invalid. Please log in again.' });
  }
}

module.exports = { verifyToken, JWT_SECRET };
