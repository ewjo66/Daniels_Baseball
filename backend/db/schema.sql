-- ═══════════════════════════════════════════════════════════
--  C.O.R.E. Performance – PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════

-- ─── Users / Auth ─────────────────────────────────────────
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  phone           VARCHAR(20),
  role            VARCHAR(20) NOT NULL DEFAULT 'member', -- 'member' | 'admin'
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Password Reset Tokens ────────────────────────────────
CREATE TABLE password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Services ─────────────────────────────────────────────
-- Matches Wix service pages: Speed Training, Hitting Lessons, Pitching, etc.
CREATE TABLE services (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(100) UNIQUE NOT NULL,  -- e.g. 'speed-training'
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  duration_mins INT NOT NULL DEFAULT 60,
  price_cents   INT NOT NULL,                  -- price in cents (e.g. 7500 = $75)
  category      VARCHAR(100),                  -- 'hitting' | 'pitching' | 'speed' | 'fielding'
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Plans / Memberships ──────────────────────────────────
-- Matches Wix "Plans & Pricing" and "Plan Customization"
CREATE TABLE plans (
  id                    SERIAL PRIMARY KEY,
  slug                  VARCHAR(100) UNIQUE NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  price_cents           INT NOT NULL,
  billing_interval      VARCHAR(20) NOT NULL DEFAULT 'month', -- 'month' | 'year'
  sessions_per_month    INT,                  -- null = unlimited
  stripe_price_id       TEXT,                 -- Stripe Price ID for subscriptions
  features              JSONB DEFAULT '[]',   -- list of feature strings
  active                BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Subscriptions ────────────────────────────────────────
-- Matches Wix "My Subscriptions"
CREATE TABLE subscriptions (
  id                      SERIAL PRIMARY KEY,
  user_id                 INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 INT NOT NULL REFERENCES plans(id),
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  status                  VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Booking Slots ────────────────────────────────────────
-- Admin creates available slots; members book them
-- Matches Wix "Booking Calendar"
CREATE TABLE booking_slots (
  id          SERIAL PRIMARY KEY,
  service_id  INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  coach_name  VARCHAR(200),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  capacity    INT NOT NULL DEFAULT 1,         -- 1 for private, N for group
  booked      INT NOT NULL DEFAULT 0,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Bookings ─────────────────────────────────────────────
-- Matches Wix "My Bookings" and "Booking Form"
CREATE TABLE bookings (
  id                  SERIAL PRIMARY KEY,
  user_id             INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id             INT NOT NULL REFERENCES booking_slots(id),
  service_id          INT NOT NULL REFERENCES services(id),
  status              VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'canceled' | 'completed'
  price_cents         INT NOT NULL,
  stripe_payment_intent_id TEXT,
  notes               TEXT,
  canceled_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Orders ───────────────────────────────────────────────
-- Matches Wix "My Orders" — tracks all purchases
CREATE TABLE orders (
  id                        SERIAL PRIMARY KEY,
  user_id                   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                      VARCHAR(50) NOT NULL, -- 'booking' | 'plan' | 'program'
  reference_id              INT,                  -- booking_id, subscription_id, or enrollment_id
  total_cents               INT NOT NULL,
  status                    VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'refunded'
  stripe_payment_intent_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Programs ─────────────────────────────────────────────
-- Matches Wix "Program List", "Visitor Page", "Participant Page"
CREATE TABLE programs (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  price_cents   INT NOT NULL DEFAULT 0,      -- 0 = free for members
  members_only  BOOLEAN DEFAULT FALSE,       -- Matches Wix "Paywall"
  duration_days INT,
  content       JSONB DEFAULT '[]',          -- array of {week, title, tasks[]}
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Program Enrollments ──────────────────────────────────
-- Matches Wix "My Programs" and "Participant Page"
CREATE TABLE program_enrollments (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id  INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status      VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'canceled'
  progress    JSONB DEFAULT '{}',            -- tracks completed tasks by week
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- ─── Notifications ────────────────────────────────────────
-- Matches Wix "Notifications"
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  type        VARCHAR(50) DEFAULT 'info',    -- 'info' | 'booking' | 'payment' | 'program'
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sessions (express-session storage) ──────────────────
CREATE TABLE "session" (
  "sid"     VARCHAR NOT NULL COLLATE "default",
  "sess"    JSON NOT NULL,
  "expire"  TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ─── Seed: Default Services ───────────────────────────────
INSERT INTO services (slug, name, description, duration_mins, price_cents, category) VALUES
  ('speed-training',    'Speed Training',      'Explosive speed and agility development using Rapsodo and data-driven methods.',    60, 7500,  'speed'),
  ('hitting-lessons',   'Hitting Lessons',     'One-on-one hitting instruction with HitTrax technology for real-time feedback.',   60, 8000,  'hitting'),
  ('pitching-development', 'Pitching Development', 'Arm care, mechanics, and velocity development tracked with Rapsodo.',          60, 8000,  'pitching'),
  ('fielding-defense',  'Fielding & Defense',  'Defensive skills, footwork, and reaction training.',                               60, 7500,  'fielding'),
  ('group-clinic',      'Group Clinic',        'Small-group sessions covering multiple skill areas. Great for teams.',             90, 4500,  'general'),
  ('cage-rental',       'Open Cage Rental',    'Self-guided batting cage rental by the hour.',                                     60, 3500,  'general');

-- ─── Seed: Default Plans ──────────────────────────────────
INSERT INTO plans (slug, name, description, price_cents, billing_interval, sessions_per_month, features) VALUES
  ('starter',  'Starter',  'Perfect for athletes just getting started.',  9900,  'month', 2,  '["2 sessions/month", "HitTrax access", "Progress tracking", "Member portal access"]'),
  ('athlete',  'Athlete',  'For dedicated athletes training consistently.', 17900, 'month', 5,  '["5 sessions/month", "HitTrax + Rapsodo access", "Video analysis", "Program access", "Priority booking"]'),
  ('elite',    'Elite',    'Unlimited training for serious competitors.',  29900, 'month', NULL,'["Unlimited sessions", "Full tech suite", "1-on-1 coach time", "College prep support", "All programs included"]');
