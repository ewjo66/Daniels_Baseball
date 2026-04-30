const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// ─── Stats ────────────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [members, bookings, revenue, pending] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'member'`),
      pool.query(`SELECT COUNT(*) FROM bookings`),
      pool.query(`SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders WHERE status = 'paid'`),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE status = 'pending'`),
    ]);
    res.json({
      total_members:       parseInt(members.rows[0].count),
      total_bookings:      parseInt(bookings.rows[0].count),
      total_revenue_cents: parseInt(revenue.rows[0].total),
      pending_bookings:    parseInt(pending.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats.' });
  }
});

// ─── Bookings ─────────────────────────────────────────────────
// GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.status, b.price_cents, b.notes, b.created_at,
             u.first_name, u.last_name, u.email,
             s.name  AS service_name,
             bs.starts_at, bs.ends_at, bs.coach_name
      FROM bookings b
      JOIN users         u  ON b.user_id    = u.id
      JOIN services      s  ON b.service_id = s.id
      JOIN booking_slots bs ON b.slot_id    = bs.id
      ORDER BY bs.starts_at DESC
    `);
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bookings.' });
  }
});

// PATCH /api/admin/bookings/:id
router.patch('/bookings/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'canceled', 'completed', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const result = await pool.query(
      `UPDATE bookings SET status = $1,
        canceled_at = CASE WHEN $1 = 'canceled' THEN NOW() ELSE canceled_at END
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

// ─── Users ────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.created_at,
             COUNT(b.id) AS total_bookings
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// ─── Orders ───────────────────────────────────────────────────
// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.type, o.total_cents, o.status, o.created_at,
             u.first_name, u.last_name, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

// ─── Booking Slots ────────────────────────────────────────────
// GET /api/admin/slots
router.get('/slots', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bs.*, s.name AS service_name,
             (bs.capacity - bs.booked) AS spots_remaining
      FROM booking_slots bs
      JOIN services s ON bs.service_id = s.id
      WHERE bs.active = TRUE
      ORDER BY bs.starts_at ASC
    `);
    res.json({ slots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load slots.' });
  }
});

// POST /api/admin/slots
router.post('/slots', async (req, res) => {
  try {
    const { service_id, coach_name, starts_at, ends_at, capacity } = req.body;
    if (!service_id || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'service_id, starts_at, and ends_at are required.' });
    }
    const result = await pool.query(
      `INSERT INTO booking_slots (service_id, coach_name, starts_at, ends_at, capacity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [service_id, coach_name || null, starts_at, ends_at, capacity || 1]
    );
    res.status(201).json({ slot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create slot.' });
  }
});

// DELETE /api/admin/slots/:id
router.delete('/slots/:id', async (req, res) => {
  try {
    await pool.query('UPDATE booking_slots SET active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Slot removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove slot.' });
  }
});

module.exports = router;
