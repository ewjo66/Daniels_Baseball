# C.O.R.E. Performance — Self-Hosted Stack

Full replacement for Wix. Plain HTML/CSS/JS frontend + Node.js/Express backend + PostgreSQL on Render.

## Project Structure

```
core-performance/
├── backend/
│   ├── db/
│   │   ├── schema.sql          ← Run this once to set up your database
│   │   └── pool.js             ← PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js             ← requireAuth / requireAdmin guards
│   ├── routes/
│   │   ├── auth.js             ← Register, Login, Logout, Password Reset
│   │   ├── api.js              ← Services, Plans, Programs, Member routes
│   │   ├── bookings.js         ← Booking calendar + My Bookings
│   │   └── payments.js         ← Stripe PaymentIntents + Subscriptions + Webhook
│   ├── server.js               ← Express entry point
│   ├── package.json
│   └── .env.example            ← Copy to .env and fill in
│
└── frontend/
    ├── js/
    │   └── api.js              ← Shared API client used by all HTML pages
    ├── pages/
    │   ├── auth/
    │   │   ├── login.html
    │   │   ├── register.html   ← (build next)
    │   │   └── forgot-password.html
    │   ├── member/
    │   │   ├── dashboard.html  ← My Bookings, My Programs, My Orders, Notifications
    │   │   └── profile.html    ← Account Settings
    │   ├── booking/
    │   │   ├── calendar.html   ← Booking Calendar
    │   │   └── form.html       ← Booking Form + Stripe payment
    │   └── programs/
    │       ├── list.html       ← Program List
    │       └── detail.html     ← Visitor/Participant Page + Paywall
    └── public/
        └── index.html          ← Your existing homepage (drop it here)
```

## Pages Built vs Wix

| Wix Page              | This Stack              | Status   |
|-----------------------|-------------------------|----------|
| Home                  | public/index.html       | ✅ Ready (your HTML file) |
| Login / Register      | pages/auth/             | ✅ Login built |
| Member Dashboard      | pages/member/dashboard  | ✅ Built |
| My Bookings           | dashboard (tab)         | ✅ Built |
| My Programs           | dashboard (tab)         | ✅ Built |
| My Subscriptions      | dashboard (tab)         | ✅ Built |
| My Orders             | dashboard (tab)         | ✅ Built |
| Notifications         | dashboard (tab)         | ✅ Built |
| Booking Calendar      | pages/booking/          | 🔲 Next |
| Plans & Pricing       | (add to homepage)       | 🔲 Next |
| Program detail/paywall| pages/programs/         | 🔲 Next |
| Profile/Settings      | pages/member/profile    | 🔲 Next |
| Thank You pages       | pages/thankyou/         | 🔲 Next |

## Setup

### 1. Render — Create these 3 services

1. **PostgreSQL** — Free tier → copy the Internal Database URL
2. **Web Service** — Connect your GitHub repo, set root to `backend/`, start command: `npm start`  → Starter plan ($7/mo)
3. **Static Site** — Root: `frontend/`, publish: `public/` → Free

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, STRIPE_SECRET_KEY, etc.
npm install
```

### 3. Database Setup

In Render's PostgreSQL dashboard → PSQL Command, run:
```sql
\i schema.sql
```
Or paste the contents of `db/schema.sql` into the query tool.

### 4. Frontend — Update API Base URL

In `frontend/js/api.js`, update line 7:
```js
const API_BASE = 'https://YOUR-BACKEND.onrender.com';
```

### 5. Stripe Setup

1. Create products + prices in Stripe dashboard
2. Copy price IDs into the `plans` table (`stripe_price_id` column)
3. Set up webhook → `https://your-backend.onrender.com/api/payments/webhook`
4. Add these events: `payment_intent.succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

## Monthly Cost

| Service        | Cost     |
|----------------|----------|
| Render Static  | $0       |
| Render Backend | $7/mo    |
| Render Postgres| $0       |
| Domain name    | ~$1.25/mo|
| Stripe fees    | 2.9%+30¢ per transaction (only when you earn) |
| **Total fixed**| **~$8.25/mo** |

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Public
- `GET /api/services`
- `GET /api/services/:slug`
- `GET /api/plans`
- `GET /api/programs`
- `GET /api/programs/:slug`  ← enforces paywall

### Bookings (auth required)
- `GET  /api/bookings/slots`
- `POST /api/bookings`
- `GET  /api/bookings/my`
- `POST /api/bookings/:id/cancel`

### Member (auth required)
- `GET   /api/member/profile`
- `PATCH /api/member/profile`
- `GET   /api/member/subscriptions`
- `GET   /api/member/orders`
- `GET   /api/member/programs`
- `GET   /api/member/notifications`
- `POST  /api/member/notifications/read-all`

### Payments (auth required)
- `POST /api/payments/create-intent`        ← one-time booking payment
- `POST /api/payments/create-subscription`  ← plan/membership
- `POST /api/payments/webhook`              ← Stripe webhook (no auth)
