const params      = new URLSearchParams(location.search);
const slot_id     = params.get('slot_id');
const serviceName = params.get('service_name') || 'Session';
const startsAt    = params.get('starts_at');
const endsAt      = params.get('ends_at');
const priceCents  = parseInt(params.get('price_cents') || '0', 10);
const coachName   = params.get('coach_name') || 'TBD';

async function init() {
  await requireLogin();

  if (!slot_id) {
    location.href = 'calendar.html';
    return;
  }

  document.getElementById('summaryService').textContent = serviceName;
  document.getElementById('summaryCoach').textContent   = coachName || 'TBD';
  document.getElementById('summaryPrice').textContent   = formatPrice(priceCents);

  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end   = new Date(endsAt);
    document.getElementById('summaryDateTime').textContent =
      start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
      ' – ' + end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

async function handleBook() {
  const btn   = document.getElementById('bookBtn');
  const error = document.getElementById('errorMsg');
  const notes = document.getElementById('notes').value.trim();

  error.classList.remove('show');
  btn.disabled    = true;
  btn.textContent = 'Reserving…';

  try {
    await api.bookings.create(parseInt(slot_id, 10), notes || null);
    document.getElementById('formArea').style.display = 'none';
    document.getElementById('successArea').classList.add('show');
  } catch (err) {
    error.textContent = err.message || 'Failed to create booking. Please try again.';
    error.classList.add('show');
    btn.disabled    = false;
    btn.textContent = 'Confirm Booking';
  }
}

document.getElementById('bookBtn').addEventListener('click', handleBook);

init();
