const slug = new URLSearchParams(location.search).get('slug');
let currentUser = null;

async function init() {
  if (!slug) {
    location.href = 'list.html';
    return;
  }

  try {
    const { user } = await api.auth.me();
    currentUser = user;
  } catch { /* not logged in */ }

  try {
    const { program } = await api.programs.get(slug);
    renderProgram(program);
  } catch (err) {
    if (err.data?.paywall) {
      renderPaywallGate(err.status === 401 ? 'login' : 'upgrade');
    } else if (err.status === 404) {
      renderError('Program not found.', true);
    } else {
      renderError('Failed to load program. Please try again.');
    }
  }
}

function renderProgram(program) {
  document.title = `${program.name} — C.O.R.E. Performance`;
  const isFree  = program.price_cents === 0;
  const content = Array.isArray(program.content) ? program.content : [];

  document.getElementById('pageContent').innerHTML = `
    <div class="program-hero">
      <div>
        <div class="hero-tag">Training Program</div>
        <h1 class="program-title">${esc(program.name)}</h1>
        <p class="program-desc">${esc(program.description) || ''}</p>
        <div class="meta-row">
          ${program.duration_days ? `<div class="meta-item"><i class="fa-regular fa-clock"></i>${program.duration_days} days</div>` : ''}
          ${program.members_only ? `<div class="meta-item"><i class="fa-solid fa-lock"></i>Members only</div>` : '<div class="meta-item"><i class="fa-solid fa-unlock"></i>Open access</div>'}
          <div class="meta-item"><i class="fa-solid fa-chart-line"></i>Data-driven training</div>
        </div>
      </div>

      <div class="enroll-card">
        <div class="enroll-price ${isFree ? 'free' : 'paid'}">${isFree ? 'Free' : formatPrice(program.price_cents)}</div>
        <div class="enroll-sublabel">${isFree ? 'No cost to enroll' : 'one-time fee'}</div>
        <div id="enrollAction">
          ${renderEnrollAction(program)}
        </div>
      </div>
    </div>

    ${content.length > 0 ? `
      <div class="section-title">Program Curriculum</div>
      ${content.map(week => `
        <div class="week-block">
          <div class="week-label">Week ${week.week}</div>
          <div class="week-title">${esc(week.title)}</div>
          <ul class="week-tasks">
            ${(week.tasks || []).map(t => `<li>${esc(t)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    ` : ''}
  `;

  const signInBtn = document.querySelector('.enroll-btn[data-action="signin"]');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      location.href = `/pages/auth/login.html?return=${encodeURIComponent(location.pathname + location.search)}`;
    });
  }

  const enrollBtn = document.getElementById('enrollBtn');
  if (enrollBtn) {
    enrollBtn.addEventListener('click', () => enroll(program.id));
  }
}

function renderEnrollAction(program) {
  if (!currentUser) {
    return `
      <button class="enroll-btn" data-action="signin">Sign In to Enroll</button>
      <p class="enroll-note">Don't have an account? <a href="/pages/auth/register.html">Create one free</a></p>
    `;
  }
  return `
    <button class="enroll-btn" id="enrollBtn">Enroll Now</button>
    <p class="enroll-note">You'll be redirected to your dashboard after enrolling.</p>
  `;
}

async function enroll(programId) {
  const btn = document.getElementById('enrollBtn');
  btn.disabled    = true;
  btn.textContent = 'Enrolling…';

  setTimeout(() => {
    document.getElementById('enrollAction').innerHTML = `
      <div class="enrolled-box">
        <i class="fa-solid fa-circle-check"></i>
        <p>You're enrolled! <a href="/pages/member/dashboard.html">Go to My Programs →</a></p>
      </div>
    `;
  }, 800);
}

function renderPaywallGate(reason) {
  document.getElementById('pageContent').innerHTML = `
    <div class="paywall-gate">
      <i class="fa-solid fa-lock paywall-gate-icon"></i>
      <h2 class="paywall-gate-title">Members Only</h2>
      <p class="paywall-gate-desc">
        ${reason === 'login'
          ? 'Sign in to access this program.'
          : 'An active membership is required to access this program.'}
      </p>
      ${reason === 'login'
        ? `<a href="/pages/auth/login.html" class="paywall-gate-btn">Sign In</a>`
        : `<a href="/" class="paywall-gate-btn">View Plans</a>`}
    </div>
  `;
}

function renderError(msg, showBack = false) {
  document.getElementById('pageContent').innerHTML = `
    <div class="error-state">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>${msg}</p>
      ${showBack ? '<br><a href="list.html">← Back to Programs</a>' : ''}
    </div>
  `;
}

init();
