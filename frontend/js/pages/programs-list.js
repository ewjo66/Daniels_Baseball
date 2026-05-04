async function load() {
  try {
    const { programs } = await api.programs.list();
    const grid = document.getElementById('programsGrid');

    if (programs.length === 0) {
      grid.innerHTML = `<div class="empty"><i class="fa-solid fa-dumbbell"></i>No programs available yet. Check back soon.</div>`;
      return;
    }

    grid.innerHTML = programs.map(p => {
      const isFree     = p.price_cents === 0;
      const priceBadge = isFree
        ? `<span class="badge badge-free">Free</span>`
        : `<span class="badge badge-paid">${formatPrice(p.price_cents)}</span>`;
      const memberBadge = p.members_only
        ? `<span class="badge badge-members"><i class="fa-solid fa-lock lock-icon"></i>Members Only</span>`
        : '';
      const duration = p.duration_days
        ? `${p.duration_days}-day program`
        : 'Ongoing program';

      return `
        <div class="program-card">
          <div class="card-top">
            <div class="card-icon"><i class="fa-solid fa-chart-line"></i></div>
            <div class="badges">${priceBadge}${memberBadge}</div>
          </div>
          <div class="program-name">${esc(p.name)}</div>
          <div class="program-desc">${esc(p.description) || 'A structured training program to help you reach your next level.'}</div>
          <div class="card-footer">
            <span class="card-duration"><i class="fa-regular fa-clock clock-icon"></i>${duration}</span>
            <a class="card-link" href="detail.html?slug=${encodeURIComponent(p.slug)}">View Program <i class="fa-solid fa-arrow-right"></i></a>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    document.getElementById('programsGrid').innerHTML =
      `<div class="empty"><i class="fa-solid fa-circle-exclamation"></i>Failed to load programs. Please try again.</div>`;
  }
}

load();
