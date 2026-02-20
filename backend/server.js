require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');

const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,   // Required to allow cookies across origins
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  name:   'ezfind.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                                    // Prevent JS access
    secure:   process.env.NODE_ENV === 'production',                  // HTTPS only in prod
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge:   parseInt(process.env.SESSION_MAX_AGE || '86400000'),    // 24 hours default
  },
}));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 EZFind backend listening on http://localhost:${PORT}`);
});
