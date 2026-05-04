const SERVICE_ICONS = {
  hitting:  'fa-baseball-bat-ball',
  pitching: 'fa-baseball',
  speed:    'fa-bolt',
  fielding: 'fa-hand',
  general:  'fa-warehouse',
};

let services        = [];
let selectedService = null;
let selectedSlot    = null;
let selectedDate    = null;
let monthSlots      = [];
let viewYear        = new Date().getFullYear();
let viewMonth       = new Date().getMonth();

async function init() {
  const user = await requireLogin();
  if (!user) return;
  document.getElementById('userName').textContent     = `${user.first_name} ${user.last_name}`;
  document.getElementById('userInitials').textContent = user.first_name[0] + user.last_name[0];

  try {
    const { services: list } = await api.services.list();
    services = list;
    renderServices();
  } catch {
    document.getElementById('serviceGrid').innerHTML =
      `<div class="state-box"><p>Failed to load services. Please refresh.</p></div>`;
  }
}

function renderServices() {
  document.getElementById('serviceGrid').innerHTML = services.map(s => `
    <div class="service-card" data-service-id="${s.id}" id="svc-${s.id}">
      <div class="service-icon"><i class="fa-solid ${SERVICE_ICONS[s.category] || 'fa-calendar'}"></i></div>
      <div class="service-name">${esc(s.name)}</div>
      <div class="service-price">${formatPrice(s.price_cents)}</div>
      <div class="service-duration">${s.duration_mins} min session</div>
    </div>
  `).join('');
}

async function selectService(id) {
  selectedService = services.find(s => s.id === id);
  selectedSlot    = null;
  selectedDate    = null;
  hideContinueBar();

  document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`svc-${id}`).classList.add('selected');

  document.getElementById('step1').classList.add('done');
  document.getElementById('step2').classList.add('active');
  document.getElementById('bookingPanel').style.display = 'block';

  document.getElementById('slotsPanel').innerHTML = `
    <div class="state-box">
      <div class="icon"><i class="fa-regular fa-calendar"></i></div>
      <strong>Pick a date</strong>
      <p>Select a highlighted day on the calendar to see available session times.</p>
    </div>`;

  await loadMonthSlots();
  document.getElementById('bookingPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadMonthSlots() {
  const from = new Date(viewYear, viewMonth, 1);
  const to   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);

  renderCalendar(null);

  try {
    const { slots } = await api.bookings.slots({
      service_id: selectedService.id,
      from: from.toISOString(),
      to:   to.toISOString()
    });
    monthSlots = slots;
  } catch {
    monthSlots = [];
  }

  renderCalendar(buildAvailableDates());
}

function buildAvailableDates() {
  const set = new Set();
  monthSlots.forEach(s => {
    const d = new Date(s.starts_at);
    set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });
  return set;
}

function renderCalendar(availableDates) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMo  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  document.getElementById('calMonthLabel').textContent = monthName;

  const now = new Date();
  document.getElementById('prevMonthBtn').disabled =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const grid = document.getElementById('calGrid');

  if (!availableDates) {
    grid.innerHTML = `<div class="cal-spinner-wrap"><div class="spinner"></div></div>`;
    return;
  }

  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let day = 1; day <= daysInMo; day++) {
    const d        = new Date(viewYear, viewMonth, day);
    const key      = `${viewYear}-${viewMonth}-${day}`;
    const isPast   = d < today;
    const isToday  = d.getTime() === today.getTime();
    const hasSlots = availableDates.has(key);
    const isSelected = selectedDate &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day;

    const classes = [
      'cal-day',
      isPast    ? 'past'     : '',
      isToday   ? 'today'    : '',
      hasSlots  ? 'has-slots': '',
      isSelected? 'selected' : '',
    ].filter(Boolean).join(' ');

    const dataAttrs = !isPast
      ? `data-year="${viewYear}" data-month="${viewMonth}" data-day="${day}"`
      : '';

    html += `
      <div class="${classes}" ${dataAttrs} title="${hasSlots ? 'Sessions available' : 'No sessions this day'}">
        <span class="cal-day-num">${day}</span>
        ${hasSlots ? '<span class="dot"></span>' : ''}
      </div>`;
  }

  grid.innerHTML = html;
}

async function shiftMonth(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  selectedDate = null;
  selectedSlot = null;
  hideContinueBar();
  document.getElementById('slotsPanel').innerHTML = `
    <div class="state-box">
      <div class="icon"><i class="fa-regular fa-calendar"></i></div>
      <strong>Pick a date</strong>
      <p>Select a highlighted day on the calendar to see available session times.</p>
    </div>`;
  await loadMonthSlots();
}

async function selectDate(year, month, day) {
  selectedDate = new Date(year, month, day);
  selectedSlot = null;
  hideContinueBar();

  document.getElementById('step2').classList.add('done');
  document.getElementById('step3').classList.add('active');

  renderCalendar(buildAvailableDates());

  const daySlots = monthSlots.filter(s => {
    const d = new Date(s.starts_at);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });

  renderSlots(selectedDate, daySlots);
}

function renderSlots(date, slots) {
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const panel = document.getElementById('slotsPanel');

  if (slots.length === 0) {
    panel.innerHTML = `
      <div class="slots-header">
        <div class="slots-date">${dateLabel}</div>
      </div>
      <div class="state-box">
        <div class="icon"><i class="fa-regular fa-calendar-xmark"></i></div>
        <strong>No sessions available</strong>
        <p>There are no open slots on this day. Try another date or contact us to request a time.</p>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="slots-header">
      <div class="slots-date">${dateLabel}</div>
      <div class="slots-count">${slots.length} time slot${slots.length !== 1 ? 's' : ''} available</div>
    </div>
    <div class="slots-list">
      ${slots.map(s => {
        const spotsLeft = s.capacity - s.booked;
        const spotsClass = spotsLeft <= 2 ? 'low' : 'ok';
        const spotsText  = spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`;
        return `
          <div class="slot-card" data-slot='${JSON.stringify(s)}' id="slot-${s.id}">
            <div class="slot-time-block">
              <div class="slot-time">${formatTime(s.starts_at)}</div>
              <div class="slot-end-time">until ${formatTime(s.ends_at)}</div>
            </div>
            <div class="slot-details">
              <div class="slot-coach"><i class="fa-solid fa-user"></i>${s.coach_name || 'Coach TBD'}</div>
            </div>
            <div class="slot-right">
              <div class="slot-price">${formatPrice(s.price_cents)}</div>
              <div class="slot-spots ${spotsClass}">${spotsText}</div>
            </div>
            <div class="slot-check"><i class="fa-solid fa-check"></i></div>
          </div>`;
      }).join('')}
    </div>`;
}

function selectSlot(el) {
  selectedSlot = JSON.parse(el.dataset.slot);
  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  document.getElementById('continueName').textContent  = selectedService.name;
  document.getElementById('continueMeta').textContent  = `${dateStr} · ${formatTime(selectedSlot.starts_at)} – ${formatTime(selectedSlot.ends_at)}`;
  document.getElementById('continuePrice').textContent = formatPrice(selectedSlot.price_cents);
  document.getElementById('continueBar').classList.add('show');
}

function hideContinueBar() {
  selectedSlot = null;
  document.getElementById('continueBar').classList.remove('show');
}

function goToForm() {
  if (!selectedSlot) return;
  const p = new URLSearchParams({
    slot_id:      selectedSlot.id,
    service_name: selectedService.name,
    starts_at:    selectedSlot.starts_at,
    ends_at:      selectedSlot.ends_at,
    price_cents:  selectedSlot.price_cents,
    coach_name:   selectedSlot.coach_name || '',
  });
  location.href = `form.html?${p.toString()}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

async function handleLogout() {
  await api.auth.logout();
  location.href = '../auth/login.html';
}

// ─── Event delegation ─────────────────────────────────────────
document.getElementById('serviceGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.service-card[data-service-id]');
  if (card) selectService(parseInt(card.dataset.serviceId, 10));
});

document.getElementById('calGrid').addEventListener('click', (e) => {
  const day = e.target.closest('.cal-day[data-year]');
  if (day) selectDate(parseInt(day.dataset.year, 10), parseInt(day.dataset.month, 10), parseInt(day.dataset.day, 10));
});

document.getElementById('slotsPanel').addEventListener('click', (e) => {
  const card = e.target.closest('.slot-card');
  if (card) selectSlot(card);
});

document.getElementById('prevMonthBtn').addEventListener('click', () => shiftMonth(-1));
document.getElementById('nextMonthBtn').addEventListener('click', () => shiftMonth(1));
document.querySelector('.continue-btn').addEventListener('click', goToForm);
document.querySelector('.logout-btn').addEventListener('click', handleLogout);

init();
