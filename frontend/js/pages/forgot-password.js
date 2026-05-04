redirectIfLoggedIn();

async function handleReset() {
  const btn   = document.getElementById('resetBtn');
  const error = document.getElementById('errorMsg');
  const email = document.getElementById('email').value.trim();

  error.classList.remove('show');

  if (!email) {
    error.textContent = 'Please enter your email address.';
    return error.classList.add('show');
  }

  btn.disabled    = true;
  btn.textContent = 'Sending…';

  try {
    await api.auth.forgotPassword(email);
    document.getElementById('formArea').style.display = 'none';
    document.getElementById('successArea').classList.add('show');
  } catch (err) {
    // Show success regardless to avoid email enumeration
    document.getElementById('formArea').style.display = 'none';
    document.getElementById('successArea').classList.add('show');
  }
}

document.getElementById('resetBtn').addEventListener('click', handleReset);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleReset();
});
