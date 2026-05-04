// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mobile-link, .mobile-menu .btn').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Scroll-triggered fade-in
const fadeEls = document.querySelectorAll('.fade-up');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
fadeEls.forEach(el => observer.observe(el));

// Web3Forms Submit Handler
document.getElementById('contactForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn        = document.getElementById('submitBtn');
  const successMsg = document.getElementById('formSuccess');
  const errorMsg   = document.getElementById('formError');

  successMsg.classList.remove('show');
  errorMsg.classList.remove('show');

  document.getElementById('replyToField').value = document.getElementById('email').value;

  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
  btn.disabled = true;

  try {
    const formData = new FormData(this);
    const json     = JSON.stringify(Object.fromEntries(formData));

    const response = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    json
    });

    const result = await response.json();

    if (response.ok && result.success) {
      successMsg.classList.add('show');
      this.reset();
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      throw new Error(result.message || 'Submission failed');
    }

  } catch (error) {
    console.error('Web3Forms error:', error);
    errorMsg.classList.add('show');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled  = false;
  }
});

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 120) current = section.id;
  });
  navLinks.forEach(link => {
    link.style.color = link.getAttribute('href') === `#${current}` ? 'var(--white)' : '';
  });
});
