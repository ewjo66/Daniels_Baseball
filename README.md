# Daniel's Baseball Academy — Web Stack

Plain HTML/CSS/JS frontend + Node.js/Express backend + PostgreSQL.
The Express server serves both the API and all frontend files — no separate frontend server needed.

## Project Structure

```
Daniels_Baseball/
├── .vscode/
│   └── settings.json
├── backend/
│   ├── db/
│   │   ├── schema.sql          ← Run once to create tables + seed data
│   │   └── pool.js             ← PostgreSQL connection pool
│   ├── middleware/
│   │   └── auth.js             ← requireAuth / requireAdmin guards
│   ├── routes/
│   │   ├── auth.js             ← Register, Login, Logout, Password Reset
│   │   ├── api.js              ← Services, Plans, Programs, Member routes
│   │   ├── bookings.js         ← Booking slots + My Bookings
│   │   ├── payments.js         ← Stripe PaymentIntents + Subscriptions + Webhook
│   │   └── admin.js            ← Admin-only: stats, users, bookings, slots, orders
│   ├── server.js               ← Express entry — serves API + frontend static files
│   ├── package.json
│   ├── .env.example            ← Copy to .env and fill in
│   └── .env                    ← Local only, never commit
│
└── frontend/                   ← Served as web root by Express
    ├── js/
    │   └── api.js              ← Shared API client (imported by all pages)
    ├── pages/
    │   ├── auth/
    │   │   ├── login.html            ← Built
    │   │   ├── register.html         ← Built
    │   │   └── forgot-password.html  ← Built
    │   ├── member/
    │   │   ├── dashboard.html  ← Built (Bookings, Programs, Orders, Notifications tabs)
    │   │   └── profile.html    ← Built
    │   ├── booking/
    │   │   ├── calendar.html   ← Built
    │   │   └── form.html       ← Built (payment stubbed)
    │   └── programs/
    │       ├── list.html       ← Built
    │       └── detail.html     ← Built
    └── public/
        └── index.html          ← Homepage (served at /)
```

## Pages Status

| Page                  | URL                              | Status      | Notes                               |
|-----------------------|----------------------------------|-------------|-------------------------------------|
| Home                  | /                                | ✅ Built    |                                     |
| Login                 | /pages/auth/login.html           | ✅ Built    |                                     |
| Register              | /pages/auth/register.html        | ✅ Built    |                                     |
| Forgot Password       | /pages/auth/forgot-password.html | ✅ Built    | Email requires Resend key           |
| Member Dashboard      | /pages/member/dashboard.html     | ✅ Built    |                                     |
| My Bookings           | dashboard tab                    | ✅ Built    |                                     |
| My Programs           | dashboard tab                    | ✅ Built    |                                     |
| My Subscription       | dashboard tab                    | ✅ Built    |                                     |
| My Orders             | dashboard tab                    | ✅ Built    |                                     |
| Notifications         | dashboard tab                    | ✅ Built    |                                     |
| Profile / Settings    | /pages/member/profile.html       | ✅ Built    |                                     |
| Booking Calendar      | /pages/booking/calendar.html     | ✅ Built    |                                     |
| Booking Form          | /pages/booking/form.html         | ✅ Built    | Payment stubbed — needs Stripe      |
| Program List          | /pages/programs/list.html        | ✅ Built    |                                     |
| Program Detail        | /pages/programs/detail.html      | ✅ Built    | Enroll endpoint not yet on backend  |
| Admin Dashboard       | /pages/admin/dashboard.html      | ✅ Built    | Requires admin role                 |

## Remaining Work

| Task                         | Notes                                                          |
|------------------------------|----------------------------------------------------------------|
| Stripe payment integration   | Wire `POST /api/payments/create-intent` to booking form        |
| Program enroll endpoint      | Add `POST /api/programs/:id/enroll` to `routes/api.js`         |
| Email via Resend             | Forgot-password reset link + booking confirmation emails       |
| Admin slot management        | ✅ Complete — frontend + backend both done                      |

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (installed and running)

### 1. Clone and install

```bash
cd backend
npm install
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE core_performance;"
psql -U postgres -d core_performance -f db/schema.sql
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/core_performance
SESSION_SECRET=<random string, 32+ chars>
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=        # leave blank until testing payments
STRIPE_WEBHOOK_SECRET=    # leave blank until testing payments
RESEND_API_KEY=           # leave blank until testing email
EMAIL_FROM=
```

Generate a session secret (run in PowerShell):
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

### 4. Run

```bash
cd backend
npm run dev
```

Open `http://localhost:3000` — that's it. The backend serves both the API and all frontend pages.

| URL                                      | Page              |
|------------------------------------------|-------------------|
| http://localhost:3000                    | Homepage          |
| http://localhost:3000/pages/auth/login.html     | Login      |
| http://localhost:3000/pages/member/dashboard.html | Dashboard  |

## Production Deployment (Render)

### 1. Create a Render Web Service
- Connect your GitHub repo
- Root directory: `backend/`
- Start command: `npm start`
- Plan: Starter ($7/mo)

### 2. Create a Render PostgreSQL instance
- Free tier
- Copy the Internal Database URL into the web service's `DATABASE_URL` env var

### 3. Set environment variables in Render dashboard
```
DATABASE_URL=<from Render PostgreSQL>
SESSION_SECRET=<same random string>
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-app.onrender.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@danielsbaseballacademy.com
```

### 4. Update api.js for production

In `frontend/js/api.js` line 6, set:
```js
const API_BASE = '';
```
(Keep it empty — frontend and backend are on the same domain in production.)

### 5. Stripe Setup
1. Create products + prices in Stripe dashboard
2. Copy price IDs into the `plans` table (`stripe_price_id` column)
3. Add webhook endpoint: `https://your-app.onrender.com/api/payments/webhook`
4. Subscribe to events: `payment_intent.succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

## Monthly Cost

| Service          | Cost                                      |
|------------------|-------------------------------------------|
| Render Backend   | $7/mo                                     |
| Render Postgres  | $0 (free tier)                            |
| Domain name      | ~$1.25/mo                                 |
| Stripe fees      | 2.9% + 30¢ per transaction                |
| **Total fixed**  | **~$8.25/mo**                             |

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
- `GET /api/programs/:slug`

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
- `POST /api/payments/create-intent`
- `POST /api/payments/create-subscription`
- `POST /api/payments/webhook`

### Admin (admin role required)
- `GET   /api/admin/stats`
- `GET   /api/admin/users`
- `GET   /api/admin/bookings`
- `PATCH /api/admin/bookings/:id`
- `GET   /api/admin/orders`
- `GET   /api/admin/slots`
- `POST  /api/admin/slots`
- `DELETE /api/admin/slots/:id`
