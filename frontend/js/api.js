// ═══════════════════════════════════════════════════════════
//  C.O.R.E. Performance — Frontend API Client
//  All pages import this to talk to the Express backend
// ═══════════════════════════════════════════════════════════

const API_BASE = '';

const api = {

  // ─── Internal fetch wrapper ─────────────────────────────
  async _fetch(method, path, body = null) {
    const options = {
      method,
      credentials: 'include',           // sends session cookie automatically
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res  = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();

    if (!res.ok) throw { status: res.status, message: data.error || 'Request failed', data };
    return data;
  },

  get:    (path)        => api._fetch('GET',    path),
  post:   (path, body)  => api._fetch('POST',   path, body),
  patch:  (path, body)  => api._fetch('PATCH',  path, body),
  delete: (path)        => api._fetch('DELETE', path),

  // ─── Auth ───────────────────────────────────────────────
  auth: {
    me()                       { return api.get('/api/auth/me'); },
    register(data)             { return api.post('/api/auth/register', data); },
    login(email, password)     { return api.post('/api/auth/login', { email, password }); },
    logout()                   { return api.post('/api/auth/logout'); },
    forgotPassword(email)      { return api.post('/api/auth/forgot-password', { email }); },
    resetPassword(token, pwd)  { return api.post('/api/auth/reset-password', { token, password: pwd }); },
  },

  // ─── Services ───────────────────────────────────────────
  services: {
    list()         { return api.get('/api/services'); },
    get(slug)      { return api.get(`/api/services/${slug}`); },
  },

  // ─── Plans & Pricing ────────────────────────────────────
  plans: {
    list()         { return api.get('/api/plans'); },
  },

  // ─── Bookings ───────────────────────────────────────────
  bookings: {
    slots(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return api.get(`/api/bookings/slots${qs ? '?' + qs : ''}`);
    },
    create(slot_id, notes) { return api.post('/api/bookings', { slot_id, notes }); },
    myBookings()           { return api.get('/api/bookings/my'); },
    cancel(id)             { return api.post(`/api/bookings/${id}/cancel`); },
  },

  // ─── Programs ───────────────────────────────────────────
  programs: {
    list()         { return api.get('/api/programs'); },
    get(slug)      { return api.get(`/api/programs/${slug}`); },
    mine()         { return api.get('/api/member/programs'); },
  },

  // ─── Member Account ─────────────────────────────────────
  member: {
    profile()                { return api.get('/api/member/profile'); },
    updateProfile(data)      { return api.patch('/api/member/profile', data); },
    subscriptions()          { return api.get('/api/member/subscriptions'); },
    orders()                 { return api.get('/api/member/orders'); },
    notifications()          { return api.get('/api/member/notifications'); },
    markAllRead()            { return api.post('/api/member/notifications/read-all'); },
  },

  // ─── Payments ───────────────────────────────────────────
  payments: {
    createIntent(booking_id)    { return api.post('/api/payments/create-intent', { booking_id }); },
    createSubscription(plan_id) { return api.post('/api/payments/create-subscription', { plan_id }); },
  },

  // ─── Admin ──────────────────────────────────────────────
  admin: {
    stats()                   { return api.get('/api/admin/stats'); },
    bookings()                { return api.get('/api/admin/bookings'); },
    updateBooking(id, status) { return api.patch(`/api/admin/bookings/${id}`, { status }); },
    users()                   { return api.get('/api/admin/users'); },
    orders()                  { return api.get('/api/admin/orders'); },
    slots()                   { return api.get('/api/admin/slots'); },
    createSlot(data)          { return api.post('/api/admin/slots', data); },
    deleteSlot(id)            { return api.delete(`/api/admin/slots/${id}`); },
  },
};

// ─── Auth Guard ─────────────────────────────────────────────
// Call on any page that requires login.
// Redirects to /pages/auth/login.html if not logged in.
async function requireLogin(redirectBack = true) {
  try {
    const { user } = await api.auth.me();
    return user;
  } catch (err) {
    const returnTo = redirectBack ? `?return=${encodeURIComponent(location.pathname)}` : '';
    location.href = `/pages/auth/login.html${returnTo}`;
    return null;
  }
}

// ─── Admin Guard ────────────────────────────────────────────
// Call on admin pages — redirects to login if not an admin
async function requireAdminLogin() {
  try {
    const { user } = await api.auth.me();
    if (user.role !== 'admin') {
      location.href = '/pages/auth/login.html';
      return null;
    }
    return user;
  } catch {
    location.href = '/pages/auth/login.html';
    return null;
  }
}

// ─── Auth Redirect ──────────────────────────────────────────
// Call on login/register pages — redirects away if already logged in
async function redirectIfLoggedIn() {
  try {
    const { user } = await api.auth.me();
    location.href = user.role === 'admin'
      ? '/pages/admin/dashboard.html'
      : '/pages/member/dashboard.html';
  } catch {
    // Not logged in — stay on the page
  }
}

// ─── Show Toast Notification ────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `core-toast core-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('core-toast--show'));

  // Remove after 4s
  setTimeout(() => {
    toast.classList.remove('core-toast--show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ─── Format price from cents ────────────────────────────────
function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// ─── Format date ────────────────────────────────────────────
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

// ─── HTML escape ─────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
