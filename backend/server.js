require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const pool         = require('./db/pool');

const authRoutes     = require('./routes/auth');
const apiRoutes      = require('./routes/api');
const bookingRoutes  = require('./routes/bookings');
const paymentRoutes  = require('./routes/payments');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // adjust if you need inline scripts
}));

// ─── CORS ─────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true, // required for cookies/sessions
}));

// ─── Rate Limiting ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many attempts. Please try again in 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      100
});

app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

// ─── Stripe Webhook (must come BEFORE express.json()) ─────
// Stripe needs the raw body to verify signatures
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ─── Body Parsing ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Sessions ─────────────────────────────────────────────
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false // table is in schema.sql
  }),
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                          // JS cannot read this cookie
    secure:   process.env.NODE_ENV === 'production',         // HTTPS only in prod
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000                       // 7 days
  }
}));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api',          apiRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);

// ─── Health Check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   C.O.R.E. Performance API           ║
  ║   Running on port ${PORT}               ║
  ║   ENV: ${process.env.NODE_ENV || 'development'}              ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
