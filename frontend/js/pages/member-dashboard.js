let currentUser = null;

async function init() {
  currentUser = await requireLogin();
  if (!currentUser) return;

  document.getElementById('userName').textContent     = `${currentUser.first_name} ${currentUser.last_name}`;
  document.getElementById('userRole').textContent     = currentUser.role === 'admin' ? 'Administrator' : 'Member';
  document.getElementById('userInitials').textContent = currentUser.first_name[0] + currentUser.last_name[0];
  document.getElementById('firstName').textContent    = currentUser.first_name;

  loadDashboard();
}

async function loadDashboard() {
  const [bookingsRes, notifRes, subRes, progRes] = await Promise.allSettled([
    api.bookings.myBookings(),
    api.member.notifications(),
    api.member.subscriptions(),
    api.programs.mine()
  ]);

  const bookings = bookingsRes.value?.bookings || [];
  const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.starts_at) > new Date());
  document.getElementById('statUpcoming').textContent = upcoming.length;
  document.getElementById('statTotal').textContent    = bookings.filter(b => b.status === 'completed').length;
  document.getElementById('statPrograms').textContent = (progRes.value?.enrollments || []).filter(e => e.status === 'active').length;

  const subs = subRes.value?.subscriptions || [];
  const activeSub = subs.find(s => s.status === 'active');
  if (activeSub) {
    document.getElementById('statPlan').textContent    = activeSub.plan_name;
    document.getElementById('statPlanSub').textContent = `${formatPrice(activeSub.price_cents)}/${activeSub.billing_interval}`;
  } else {
    document.getElementById('statPlan').textContent = 'None';
  }

  const upcomingEl = document.getElementById('upcomingBookingsList');
  if (upcoming.length === 0) {
    upcomingEl.innerHTML = `<div class="empty"><i class="fa-regular fa-calendar"></i>No upcoming sessions. <a href="../booking/calendar.html">Book one now →</a></div>`;
  } else {
    upcomingEl.innerHTML = upcoming.slice(0, 5).map(b => `
      <div class="booking-row">
        <div class="booking-icon"><i class="fa-solid fa-baseball"></i></div>
        <div class="booking-info">
          <div class="booking-name">${esc(b.service_name)}</div>
          <div class="booking-meta">${formatDate(b.starts_at)} · ${esc(b.coach_name) || 'Coach TBD'}</div>
        </div>
        <span class="badge badge-confirmed">Confirmed</span>
      </div>
    `).join('');
  }

  const notifs  = (notifRes.value?.notifications || []).slice(0, 4);
  const notifEl = document.getElementById('notificationsList');
  if (notifs.length === 0) {
    notifEl.innerHTML = `<div class="empty"><i class="fa-regular fa-bell-slash"></i>No notifications yet.</div>`;
  } else {
    notifEl.innerHTML = notifs.map(n => `
      <div class="booking-row">
        <div class="booking-icon${n.read ? ' is-read' : ''}"><i class="fa-solid fa-bell"></i></div>
        <div class="booking-info">
          <div class="booking-name">${esc(n.title)}</div>
          <div class="booking-meta">${esc(n.body) || ''}</div>
        </div>
      </div>
    `).join('');
  }
}

function showSection(name) {
  document.querySelectorAll('.section-panel').forEach(el => el.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-section="${name}"]`);
  if (activeLink) activeLink.classList.add('active');
}

async function handleLogout() {
  try { await api.auth.logout(); } catch (_) {}
  location.href = '../auth/login.html';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

document.querySelectorAll('.nav-link[data-section]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(a.dataset.section);
  });
});

document.querySelector('.panel-link[data-section]').addEventListener('click', (e) => {
  e.preventDefault();
  showSection('notifications');
});

document.querySelector('.logout-btn').addEventListener('click', handleLogout);

init();
