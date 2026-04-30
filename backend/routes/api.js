const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// ══════════════════════════════════════════════════════════
//  SERVICES  (matches Wix service pages)
// ══════════════════════════════════════════════════════════

// GET /api/services
router.get('/services', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE active = TRUE ORDER BY category, name'
    );
    res.json({ services: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load services.' });
  }
});

// GET /api/services/:slug
router.get('/services/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE slug = $1 AND active = TRUE',
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found.' });
    res.json({ service: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load service.' });
  }
});

// ══════════════════════════════════════════════════════════
//  PLANS  (matches Wix "Plans & Pricing")
// ══════════════════════════════════════════════════════════

// GET /api/plans
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM plans WHERE active = TRUE ORDER BY price_cents ASC'
    );
    res.json({ plans: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load plans.' });
  }
});

// ══════════════════════════════════════════════════════════
//  PROGRAMS  (matches Wix "Program List" / "Visitor Page")
// ══════════════════════════════════════════════════════════

// GET /api/programs
router.get('/programs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, name, description, price_cents, members_only, duration_days FROM programs WHERE active = TRUE ORDER BY name'
    );
    res.json({ programs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load programs.' });
  }
});

// GET /api/programs/:slug
// Enforces paywall — matches Wix "Paywall" behaviour
router.get('/programs/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programs WHERE slug = $1 AND active = TRUE',
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Program not found.' });

    const program = result.rows[0];

    if (program.members_only) {
      if (!req.session?.userId) {
        return res.status(401).json({ error: 'Login required.', paywall: true });
      }
      // Check if they have an active subscription
      const sub = await pool.query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
        [req.session.userId]
      );
      if (sub.rows.length === 0) {
        return res.status(403).json({ error: 'Active membership required.', paywall: true });
      }
    }

    res.json({ program });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load program.' });
  }
});

// ══════════════════════════════════════════════════════════
//  MEMBER ROUTES  (require auth)
// ══════════════════════════════════════════════════════════

// GET /api/member/profile  (matches Wix "Profile")
router.get('/member/profile', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, email, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// PATCH /api/member/profile  (matches Wix "Account Settings")
router.patch('/member/profile', requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;
    const result = await pool.query(
      `UPDATE users SET first_name = COALESCE($1, first_name),
                        last_name  = COALESCE($2, last_name),
                        phone      = COALESCE($3, phone),
                        updated_at = NOW()
       WHERE id = $4
       RETURNING id, first_name, last_name, email, phone`,
      [first_name, last_name, phone, req.session.userId]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// GET /api/member/subscriptions  (matches Wix "My Subscriptions")
router.get('/member/subscriptions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name AS plan_name, p.price_cents, p.billing_interval, p.sessions_per_month, p.features
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.session.userId]
    );
    res.json({ subscriptions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load subscriptions.' });
  }
});

// GET /api/member/orders  (matches Wix "My Orders")
router.get('/member/orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

// GET /api/member/programs  (matches Wix "My Programs")
router.get('/member/programs', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pe.*, p.name, p.description, p.duration_days, p.content
       FROM program_enrollments pe
       JOIN programs p ON pe.program_id = p.id
       WHERE pe.user_id = $1
       ORDER BY pe.enrolled_at DESC`,
      [req.session.userId]
    );
    res.json({ enrollments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load programs.' });
  }
});

// GET /api/member/notifications  (matches Wix "Notifications")
router.get('/member/notifications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.session.userId]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

// POST /api/member/notifications/read-all
router.post('/member/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.session.userId]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications.' });
  }
});

module.exports = router;
