redirectIfLoggedIn();

async function handleRegister() {
  const btn             = document.getElementById('registerBtn');
  const error           = document.getElementById('errorMsg');
  const firstName       = document.getElementById('firstName').value.trim();
  const lastName        = document.getElementById('lastName').value.trim();
  const email           = document.getElementById('email').value.trim();
  const password        = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  error.classList.remove('show');

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    error.textContent = 'Please fill in all fields.';
    return error.classList.add('show');
  }

  if (password.length < 8) {
    error.textContent = 'Password must be at least 8 characters.';
    return error.classList.add('show');
  }

  if (password !== confirmPassword) {
    error.textContent = 'Passwords do not match.';
    return error.classList.add('show');
  }

  btn.disabled    = true;
  btn.textContent = 'Creating account…';

  try {
    await api.auth.register({ first_name: firstName, last_name: lastName, email, password });
    location.href = '/pages/member/dashboard.html';
  } catch (err) {
    error.textContent = err.message || 'Registration failed. Please try again.';
    error.classList.add('show');
    btn.disabled    = false;
    btn.textContent = 'Create Account';
  }
}

document.getElementById('registerBtn').addEventListener('click', handleRegister);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleRegister();
});
