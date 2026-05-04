const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, z } = require('../middleware/validate');

const slotsQuerySchema = z.object({
  service_id: z.coerce.number().int().positive().optional(),
  from:       z.string().datetime({ offset: true }).optional(),
  to:         z.string().datetime({ offset: true }).optional(),
});

// ─── GET /api/bookings/slots ──────────────────────────────
// Public: Get available slots for a service (for the booking calendar)
router.get('/slots', validate(slotsQuerySchema, 'query'), async (req, res) => {
  try {
    const { service_id, from, to } = req.query;

    let query = `
      SELECT bs.*, s.name AS service_name, s.duration_mins, s.price_cents
      FROM booking_slots bs
      JOIN services s ON bs.service_id = s.id
      WHERE bs.active = TRUE
        AND bs.starts_at > NOW()
        AND bs.booked < bs.capacity
    `;
    const params = [];

    if (service_id) {
      params.push(service_id);
      query += ` AND bs.service_id = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND bs.starts_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND bs.starts_at <= $${params.length}`;
    }

    query += ' ORDER BY bs.starts_at ASC';

    const result = await pool.query(query, params);
    res.json({ slots: result.rows });

  } catch (err) {
    console.error('Get slots error:', err);
    res.status(500).json({ error: 'Failed to load available slots.' });
  }
});

// ─── POST /api/bookings ───────────────────────────────────
// Create a booking (requires auth) — payment handled via Stripe
router.post('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { slot_id, notes } = req.body;
    if (!slot_id) return res.status(400).json({ error: 'slot_id is required.' });

    await client.query('BEGIN');

    // Lock the slot row to prevent double-booking
    const slotResult = await client.query(
      'SELECT * FROM booking_slots WHERE id = $1 FOR UPDATE',
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found.' });
    }

    const slot = slotResult.rows[0];

    if (!slot.active || slot.booked >= slot.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This slot is no longer available.' });
    }

    // Check user doesn't already have this slot
    const dupCheck = await client.query(
      `SELECT id FROM bookings WHERE user_id = $1 AND slot_id = $2 AND status != 'canceled'`,
      [req.session.userId, slot_id]
    );
    if (dupCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already have this slot booked.' });
    }

    const serviceResult = await client.query('SELECT price_cents FROM services WHERE id = $1', [slot.service_id]);
    const price_cents = serviceResult.rows[0].price_cents;

    // Create booking as 'pending' — confirmed after Stripe payment
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, slot_id, service_id, price_cents, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.session.userId, slot_id, slot.service_id, price_cents, notes || null]
    );

    // Increment booked count on the slot
    await client.query(
      'UPDATE booking_slots SET booked = booked + 1 WHERE id = $1',
      [slot_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Booking created. Complete payment to confirm.',
      booking: bookingResult.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  } finally {
    client.release();
  }
});

// ─── GET /api/bookings/my ─────────────────────────────────
// Member: Get their own bookings (matches Wix "My Bookings")
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, s.name AS service_name, s.duration_mins,
              bs.starts_at, bs.ends_at, bs.coach_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN booking_slots bs ON b.slot_id = bs.id
       WHERE b.user_id = $1
       ORDER BY bs.starts_at DESC`,
      [req.session.userId]
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings.' });
  }
});

// ─── POST /api/bookings/:id/cancel ───────────────────────
// Member: Cancel their own booking
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await pool.query(
      `SELECT b.*, bs.starts_at FROM bookings b
       JOIN booking_slots bs ON b.slot_id = bs.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, req.session.userId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const b = booking.rows[0];

    if (b.status === 'canceled') {
      return res.status(400).json({ error: 'Booking is already canceled.' });
    }

    // Prevent canceling within 24 hours
    const hoursUntil = (new Date(b.starts_at) - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      return res.status(400).json({ error: 'Cancellations must be made at least 24 hours in advance.' });
    }

    await pool.query(
      `UPDATE bookings SET status = 'canceled', canceled_at = NOW() WHERE id = $1`,
      [id]
    );
    await pool.query(
      'UPDATE booking_slots SET booked = GREATEST(booked - 1, 0) WHERE id = $1',
      [b.slot_id]
    );

    // TODO: Issue Stripe refund if payment was made

    res.json({ message: 'Booking canceled successfully.' });

  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
});

module.exports = router;
