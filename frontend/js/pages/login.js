redirectIfLoggedIn();

const params = new URLSearchParams(location.search);
const raw    = params.get('return') || '';
// Only allow same-origin relative paths to prevent open redirect
const returnTo = (raw.startsWith('/') && !raw.startsWith('//')) ? raw : '/pages/member/dashboard.html';

async function handleLogin() {
  const btn   = document.getElementById('loginBtn');
  const error = document.getElementById('errorMsg');
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('password').value;

  error.classList.remove('show');

  if (!email || !pass) {
    error.textContent = 'Please enter your email and password.';
    return error.classList.add('show');
  }

  btn.disabled    = true;
  btn.textContent = 'Signing in…';

  try {
    const { user } = await api.auth.login(email, pass);
    if (user.role === 'admin') {
      location.href = '/pages/admin/dashboard.html';
    } else {
      location.href = returnTo;
    }
  } catch (err) {
    error.textContent = err.message || 'Login failed. Please try again.';
    error.classList.add('show');
    btn.disabled    = false;
    btn.textContent = 'Sign In';
  }
}

document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
