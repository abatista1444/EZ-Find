require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const savedItemsRoutes = require('./routes/savedItems');

const app  = express();
const PORT = process.env.PORT || 5000;

function validateOptionalMarketplaceConfig() {
  const hasProviderBase = Boolean(process.env.CRAIGSLIST_PROVIDER_BASE_URL || process.env.CRAIGSLIST_PROXY);
  const hasProviderKey = Boolean(process.env.CRAIGSLIST_PROVIDER_API_KEY);

  if (hasProviderBase && !hasProviderKey) {
    console.warn('Craigslist provider URL configured without CRAIGSLIST_PROVIDER_API_KEY; request may be unauthenticated.');
  }

  if (hasProviderKey && !hasProviderBase) {
    console.warn('CRAIGSLIST_PROVIDER_API_KEY is set but no CRAIGSLIST_PROVIDER_BASE_URL is configured; RSS source will be used.');
  }
}

validateOptionalMarketplaceConfig();

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
app.use('/api/search', searchRoutes);
app.use('/api/saved-items', savedItemsRoutes);

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


// Export app for integration testing; start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 EZFind backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
