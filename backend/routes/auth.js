const express  = require('express');
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const router   = express.Router();
const pool     = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const registerSchema = z.object({
  first_name: z.string().min(1, 'First name is required.').max(50).trim(),
  last_name:  z.string().min(1, 'Last name is required.').max(50).trim(),
  email:      z.string().email('Please provide a valid email address.'),
  password:   passwordSchema,
  phone:      z.string().max(20).trim().optional(),
});

const emailSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
});

const resetPasswordSchema = z.object({
  token:    z.string().min(1, 'Token is required.'),
  password: passwordSchema,
});

const SALT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, email, role`,
      [first_name.trim(), last_name.trim(), email.toLowerCase().trim(), password_hash, phone || null]
    );

    const user = result.rows[0];

    // Regenerate session ID to prevent session fixation
    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );

    req.session.userId = user.id;
    req.session.role   = user.role;

    // Send welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type)
       VALUES ($1, $2, $3, 'info')`,
      [user.id, 'Welcome to C.O.R.E. Performance!', 'Your account is set up. Browse our services and book your first session.']
    );

    res.status(201).json({
      message: 'Account created successfully.',
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await pool.query(
      'SELECT id, first_name, last_name, email, password_hash, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      // Generic message — don't reveal whether email exists
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Regenerate session ID to prevent session fixation
    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );

    req.session.userId = user.id;
    req.session.role   = user.role;

    res.json({
      message: 'Logged in successfully.',
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────
// Frontend calls this on load to check if user is logged in
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session invalid.' });
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────
router.post('/forgot-password', validate(emailSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return success — don't reveal if email exists
    if (result.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1', [user.id]);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expires_at]
    );

    // TODO: Send email via Resend
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    // await resend.emails.send({ ... });

    res.json({ message: 'If that email exists, a reset link has been sent.' });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const resetToken = result.rows[0];
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, resetToken.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetToken.id]);

    res.json({ message: 'Password updated successfully. You can now log in.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
