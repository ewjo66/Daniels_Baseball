const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.warn('Stripe not configured — payment routes will not work until STRIPE_SECRET_KEY is set.');
}

// ─── POST /api/payments/create-intent ────────────────────
// Create a Stripe PaymentIntent for a one-time booking payment
router.post('/create-intent', requireAuth, async (req, res) => {
  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id is required.' });

    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [booking_id, req.session.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

    const booking = result.rows[0];

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'This booking is not pending payment.' });
    }

    const intent = await stripe.paymentIntents.create({
      amount:   booking.price_cents,
      currency: 'usd',
      metadata: { booking_id: String(booking_id), user_id: String(req.session.userId) }
    });

    // Save the intent id so webhook can confirm it
    await pool.query(
      'UPDATE bookings SET stripe_payment_intent_id = $1 WHERE id = $2',
      [intent.id, booking_id]
    );

    res.json({ client_secret: intent.client_secret });

  } catch (err) {
    console.error('Create intent error:', err);
    res.status(500).json({ error: 'Failed to create payment.' });
  }
});

// ─── POST /api/payments/create-subscription ──────────────
// Create a Stripe subscription for a plan (matches Wix "Checkout")
router.post('/create-subscription', requireAuth, async (req, res) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: 'plan_id is required.' });

    const planResult = await pool.query(
      'SELECT * FROM plans WHERE id = $1 AND active = TRUE',
      [plan_id]
    );
    if (planResult.rows.length === 0) return res.status(404).json({ error: 'Plan not found.' });

    const plan = planResult.rows[0];
    if (!plan.stripe_price_id) {
      return res.status(400).json({ error: 'This plan is not configured for payments yet.' });
    }

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    const user = userResult.rows[0];

    // Create or retrieve Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({ email: user.email });
    }

    const subscription = await stripe.subscriptions.create({
      customer:          customer.id,
      items:             [{ price: plan.stripe_price_id }],
      payment_behavior:  'default_incomplete',
      expand:            ['latest_invoice.payment_intent'],
      metadata:          { user_id: String(req.session.userId), plan_id: String(plan_id) }
    });

    res.json({
      subscription_id: subscription.id,
      client_secret:   subscription.latest_invoice.payment_intent.client_secret
    });

  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Failed to create subscription.' });
  }
});

// ─── POST /api/payments/webhook ──────────────────────────
// Stripe webhook — confirms payments and activates subscriptions
// Use express.raw() middleware for this route (see server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const intent  = event.data.object;
        const bookingId = intent.metadata.booking_id;
        if (bookingId) {
          await pool.query(
            `UPDATE bookings SET status = 'confirmed' WHERE id = $1`,
            [bookingId]
          );
          // Create order record
          const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
          if (booking.rows.length > 0) {
            const b = booking.rows[0];
            await pool.query(
              `INSERT INTO orders (user_id, type, reference_id, total_cents, status, stripe_payment_intent_id)
               VALUES ($1, 'booking', $2, $3, 'paid', $4)`,
              [b.user_id, b.id, b.price_cents, intent.id]
            );
            await pool.query(
              `INSERT INTO notifications (user_id, title, body, type) VALUES ($1, $2, $3, 'booking')`,
              [b.user_id, 'Booking Confirmed!', 'Your session has been confirmed. Check My Bookings for details.']
            );
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata.user_id;
        const planId = sub.metadata.plan_id;
        if (userId && planId) {
          await pool.query(
            `INSERT INTO subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7))
             ON CONFLICT (stripe_subscription_id)
             DO UPDATE SET status = $5, current_period_start = to_timestamp($6), current_period_end = to_timestamp($7)`,
            [userId, planId, sub.id, sub.customer, sub.status,
             sub.current_period_start, sub.current_period_end]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await pool.query(
          `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

    }

    res.json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

module.exports = router;
