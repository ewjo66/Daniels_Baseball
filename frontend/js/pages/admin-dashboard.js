let allBookingsCache = [];
let services = [];

async function init() {
  const user = await requireAdminLogin();
  if (!user) return;

  document.getElementById('adminName').textContent     = `${user.first_name} ${user.last_name}`;
  document.getElementById('adminInitials').textContent = user.first_name[0] + user.last_name[0];

  loadStats();
  loadOverviewBookings();
  loadServices();
}

function show(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link[data-section]').forEach(l => l.classList.remove('active'));

  document.getElementById(`sec-${section}`).classList.add('active');
  const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
  if (activeLink) activeLink.classList.add('active');

  const loaders = {
    bookings: loadAllBookings,
    slots:    loadSlots,
    members:  loadMembers,
    orders:   loadOrders,
  };
  if (loaders[section]) loaders[section]();
}

async function loadStats() {
  try {
    const data = await api.admin.stats();
    document.getElementById('statMembers').textContent  = data.total_members;
    document.getElementById('statBookings').textContent = data.total_bookings;
    document.getElementById('statRevenue').textContent  = formatPrice(data.total_revenue_cents);
    document.getElementById('statPending').textContent  = data.pending_bookings;
  } catch (e) {
    console.error(e);
  }
}

async function loadOverviewBookings() {
  try {
    const { bookings } = await api.admin.bookings();
    allBookingsCache = bookings;
    const tbody = document.getElementById('overviewBookings');
    if (!bookings.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><i class="fa-regular fa-calendar"></i>No bookings yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = bookings.slice(0, 8).map(b => `
      <tr>
        <td><strong>${esc(b.first_name)} ${esc(b.last_name)}</strong><br><span class="cell-meta">${esc(b.email)}</span></td>
        <td>${esc(b.service_name)}</td>
        <td>${formatDate(b.starts_at)}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>${bookingActions(b)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function loadAllBookings() {
  try {
    const { bookings } = await api.admin.bookings();
    allBookingsCache = bookings;
    const tbody = document.getElementById('allBookings');
    if (!bookings.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><i class="fa-regular fa-calendar"></i>No bookings yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = bookings.map(b => `
      <tr id="booking-row-${b.id}">
        <td><strong>${esc(b.first_name)} ${esc(b.last_name)}</strong><br><span class="cell-meta">${esc(b.email)}</span></td>
        <td>${esc(b.service_name)}</td>
        <td>${formatDate(b.starts_at)}</td>
        <td>${esc(b.coach_name) || '—'}</td>
        <td>${formatPrice(b.price_cents)}</td>
        <td><span class="badge badge-${b.status}" id="badge-${b.id}">${b.status}</span></td>
        <td>${bookingActions(b)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

function bookingActions(b) {
  const actions = [];
  if (b.status === 'pending')   actions.push(`<button class="btn btn-confirm btn-sm" data-bid="${b.id}" data-action="confirmed">Confirm</button>`);
  if (b.status === 'confirmed') actions.push(`<button class="btn btn-confirm btn-sm" data-bid="${b.id}" data-action="completed">Complete</button>`);
  if (b.status !== 'canceled' && b.status !== 'completed')
    actions.push(`<button class="btn btn-cancel btn-sm" data-bid="${b.id}" data-action="canceled">Cancel</button>`);
  return actions.join(' ') || '—';
}

async function updateBooking(id, status) {
  try {
    await api.admin.updateBooking(id, status);
    loadOverviewBookings();
    if (!document.getElementById('sec-bookings').classList.contains('active')) return;
    loadAllBookings();
    loadStats();
  } catch (e) {
    alert('Failed to update booking.');
  }
}

async function loadServices() {
  try {
    const { services: list } = await api.services.list();
    services = list;
    const sel = document.getElementById('slotService');
    list.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadSlots() {
  try {
    const { slots } = await api.admin.slots();
    const tbody = document.getElementById('slotsList');
    if (!slots.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><i class="fa-regular fa-calendar-xmark"></i>No upcoming slots. Create one above.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = slots.map(s => `
      <tr>
        <td>${esc(s.service_name)}</td>
        <td>${esc(s.coach_name) || '—'}</td>
        <td>${formatDate(s.starts_at)}</td>
        <td>${formatDate(s.ends_at)}</td>
        <td>${s.spots_remaining} / ${s.capacity}</td>
        <td><button class="btn btn-danger btn-sm" data-del-slot="${s.id}"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function handleCreateSlot(e) {
  e.preventDefault();
  const successEl = document.getElementById('slotSuccess');
  const errorEl   = document.getElementById('slotError');
  successEl.classList.remove('show');
  errorEl.classList.remove('show');

  try {
    await api.admin.createSlot({
      service_id:  document.getElementById('slotService').value,
      coach_name:  document.getElementById('slotCoach').value,
      starts_at:   document.getElementById('slotStart').value,
      ends_at:     document.getElementById('slotEnd').value,
      capacity:    parseInt(document.getElementById('slotCapacity').value) || 1,
    });
    successEl.classList.add('show');
    e.target.reset();
    loadSlots();
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to create slot.';
    errorEl.classList.add('show');
  }
}

async function deleteSlot(id) {
  if (!confirm('Remove this slot? Members who have already booked it will not be automatically notified.')) return;
  try {
    await api.admin.deleteSlot(id);
    loadSlots();
  } catch (e) {
    alert('Failed to remove slot.');
  }
}

async function loadMembers() {
  try {
    const { users } = await api.admin.users();
    const tbody = document.getElementById('membersList');
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-users"></i>No members yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.first_name)} ${esc(u.last_name)}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.phone) || '—'}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td>${u.total_bookings}</td>
        <td class="td-muted">${formatShortDate(u.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function loadOrders() {
  try {
    const { orders } = await api.admin.orders();
    const tbody = document.getElementById('ordersList');
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-receipt"></i>No orders yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>${esc(o.first_name)} ${esc(o.last_name)}</strong><br><span class="cell-meta">${esc(o.email)}</span></td>
        <td class="td-capitalize">${o.type}</td>
        <td>${formatPrice(o.total_cents)}</td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td class="td-muted">${formatShortDate(o.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function handleLogout() {
  await api.auth.logout();
  location.href = '/pages/auth/login.html';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPrice(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// ─── Event delegation ─────────────────────────────────────────
document.querySelectorAll('.nav-link[data-section]').forEach(btn => {
  btn.addEventListener('click', () => show(btn.dataset.section));
});

document.getElementById('viewAllBookingsBtn').addEventListener('click', () => show('bookings'));

document.getElementById('slotForm').addEventListener('submit', handleCreateSlot);

document.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action][data-bid]');
  if (actionBtn) {
    updateBooking(parseInt(actionBtn.dataset.bid, 10), actionBtn.dataset.action);
    return;
  }
  const deleteBtn = e.target.closest('[data-del-slot]');
  if (deleteBtn) {
    deleteSlot(parseInt(deleteBtn.dataset.delSlot, 10));
  }
});

document.querySelector('.logout-btn').addEventListener('click', handleLogout);

init();
