const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db       = require('../db');

const router = express.Router();

// ─── Middleware ───────────────────────────────────────────────────────────────

/** Reject requests where a session already exists */
function requireGuest(req, res, next) {
  if (req.session && req.session.userId) {
    return res.status(400).json({ message: 'Already logged in' });
  }
  next();
}

/** Reject requests where no session exists */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the current session user's profile, or 401 if not logged in.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.UserId, u.FirstName, u.LastName, u.Address, u.City, u.State, u.Country,
              l.UserLogin AS Email
       FROM Users u
       JOIN Login  l ON l.userId = u.UserId
       WHERE u.UserId = ?`,
      [req.session.userId]
    );

    if (rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  requireGuest,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
  ],
  async (req, res) => {
    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, address, city, state, country } = req.body;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check for duplicate email
      const [existing] = await conn.query(
        'SELECT UserLogin FROM Login WHERE UserLogin = ?',
        [email]
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Insert into Users
      const [userResult] = await conn.query(
        `INSERT INTO Users (FirstName, LastName, Address, City, State, Country)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [firstName, lastName, address || null, city || null, state || null, country || null]
      );
      const newUserId = userResult.insertId;

      // Hash password and insert into Login
      const passwordHash = await bcrypt.hash(password, 12);
      await conn.query(
        'INSERT INTO Login (UserLogin, userId, PasswordHash) VALUES (?, ?, ?)',
        [email, newUserId, passwordHash]
      );

      await conn.commit();

      // Start session
      req.session.userId = newUserId;
      req.session.email  = email;

      res.status(201).json({
        message: 'Registration successful',
        user: { userId: newUserId, email, firstName, lastName },
      });
    } catch (err) {
      await conn.rollback();
      console.error('Register error:', err);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    } finally {
      conn.release();
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  requireGuest,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const [rows] = await db.query(
        `SELECT l.UserLogin, l.PasswordHash, l.userId,
                u.FirstName, u.LastName
         FROM Login l
         JOIN Users u ON u.UserId = l.userId
         WHERE l.UserLogin = ?`,
        [email]
      );

      // Generic error to prevent user enumeration
      const INVALID_MSG = 'Invalid email or password';

      if (rows.length === 0) {
        return res.status(401).json({ message: INVALID_MSG });
      }

      const loginRecord = rows[0];
      const passwordMatch = await bcrypt.compare(password, loginRecord.PasswordHash);
      if (!passwordMatch) {
        return res.status(401).json({ message: INVALID_MSG });
      }

      // Regenerate session to prevent fixation attacks
      req.session.regenerate(err => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ message: 'Login failed. Please try again.' });
        }

        req.session.userId = loginRecord.userId;
        req.session.email  = loginRecord.UserLogin;

        res.json({
          message: 'Login successful',
          user: {
            userId:    loginRecord.userId,
            email:     loginRecord.UserLogin,
            firstName: loginRecord.FirstName,
            lastName:  loginRecord.LastName,
          },
        });
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('ezfind.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
