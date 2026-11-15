let currentRange = '7d';
let chart = null;

async function init() {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  if (!r.ok) return window.location.href = 'login.html';
  const { user } = await r.json();
  document.getElementById('avatarBtn').textContent = (user.full_name || 'U')[0].toUpperCase();
  await loadAll();
}

async function loadAll() {
  await loadOverview();
  await loadChart();
  await loadEndpoints();
}

async function loadOverview() {
  try {
    const { stats } = await API.request('/api/analytics/overview');
    document.getElementById('aTotal').textContent = stats.total_requests;
    document.getElementById('aSuccess').textContent = stats.successful_requests;
    document.getElementById('aFailed').textContent = stats.failed_requests;
  } catch {}
}

async function loadChart() {
  const { series } = await API.request(`/api/analytics/requests?range=${currentRange}`);
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: series.map(s => s.date),
      datasets: [{
        label: 'Requests',
        data: series.map(s => s.count),
        backgroundColor: '#3568FF',
        borderColor: '#171717',
        borderWidth: 2,
        borderRadius: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    }
  });
}

async function loadEndpoints() {
  const { endpoints } = await API.request(`/api/analytics/endpoints?range=${currentRange}`);
  const el = document.getElementById('endpointsTable');
  if (!endpoints.length) {
    el.innerHTML = '<div class="empty"><p>No data for this period.</p></div>';
    return;
  }
  const avg = endpoints.reduce((a, e) => a + e.avg_ms, 0) / endpoints.length;
  document.getElementById('aAvg').textContent = Math.round(avg) + 'ms';
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Endpoint</th><th>Requests</th><th>Avg Response</th></tr></thead>
    <tbody>${endpoints.map(e => `<tr>
      <td><code>${e.endpoint}</code></td>
      <td>${e.count}</td>
      <td>${e.avg_ms}ms</td>
    </tr>`).join('')}</tbody></table>`;
}

document.querySelectorAll('[data-range]').forEach(b => {
  b.addEventListener('click', () => {
    currentRange = b.dataset.range;
    document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('btn-primary'));
    document.querySelectorAll('[data-range]').forEach(x => x.classList.add('btn-ghost'));
    b.classList.remove('btn-ghost'); b.classList.add('btn-primary');
    loadAll();
  });
});

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('profileMenu')?.addEventListener('click', (e) => e.currentTarget.classList.toggle('open'));
document.getElementById('logoutLink')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await API.request('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});
document.getElementById('logoutDropdown')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await API.request('/api/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

init();