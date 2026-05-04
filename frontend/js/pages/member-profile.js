let currentProfile = null;

async function init() {
  const user = await requireLogin();
  if (!user) return;

  document.getElementById('userName').textContent     = `${user.first_name} ${user.last_name}`;
  document.getElementById('userInitials').textContent = user.first_name[0] + user.last_name[0];

  const { profile } = await api.member.profile();
  currentProfile = profile;

  document.getElementById('firstName').value           = profile.first_name;
  document.getElementById('lastName').value            = profile.last_name;
  document.getElementById('email').value               = profile.email;
  document.getElementById('phone').value               = profile.phone || '';
  document.getElementById('avatarLarge').textContent   = profile.first_name[0] + profile.last_name[0];
  document.getElementById('fullName').textContent      = `${profile.first_name} ${profile.last_name}`;

  const since = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('memberSince').textContent       = `Member since ${since}`;
  document.getElementById('memberId').textContent          = `#${profile.id}`;
  document.getElementById('accountRole').textContent       = user.role === 'admin' ? 'Administrator' : 'Member';
  document.getElementById('memberSinceDetail').textContent = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function saveProfile() {
  const btn    = document.getElementById('saveBtn');
  const errEl  = document.getElementById('profileError');
  const succEl = document.getElementById('profileSuccess');
  const first  = document.getElementById('firstName').value.trim();
  const last   = document.getElementById('lastName').value.trim();
  const phone  = document.getElementById('phone').value.trim();

  errEl.classList.remove('show');
  succEl.classList.remove('show');

  if (!first || !last) {
    errEl.textContent = 'First and last name are required.';
    return errEl.classList.add('show');
  }

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const { profile } = await api.member.updateProfile({ first_name: first, last_name: last, phone: phone || null });
    document.getElementById('fullName').textContent     = `${profile.first_name} ${profile.last_name}`;
    document.getElementById('avatarLarge').textContent  = profile.first_name[0] + profile.last_name[0];
    document.getElementById('userName').textContent     = `${profile.first_name} ${profile.last_name}`;
    document.getElementById('userInitials').textContent = profile.first_name[0] + profile.last_name[0];
    succEl.classList.add('show');
  } catch (err) {
    errEl.textContent = err.message || 'Failed to update profile.';
    errEl.classList.add('show');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Changes';
  }
}

async function handleLogout() {
  await api.auth.logout();
  location.href = '../auth/login.html';
}

document.getElementById('saveBtn').addEventListener('click', saveProfile);
document.querySelector('.logout-btn').addEventListener('click', handleLogout);

init();
