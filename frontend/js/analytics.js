let currentRange = '7d';
let chart = null;

// =========================================
// AUTH & SIDEBAR SETUP
// =========================================
async function init() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return window.location.href = 'login.html';
    const { user } = await r.json();
    
    const avatar = document.getElementById('avatarBtn');
    if (avatar) avatar.textContent = (user.full_name || 'U')[0].toUpperCase();
    
    setupUI();
    await loadAll();
  } catch (e) {
    window.location.href = 'login.html';
  }
}

function setupUI() {
  // 1. Sidebar Mobile Toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (sidebarToggle && sidebar && sidebarOverlay) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      sidebarOverlay.classList.add('open');
    });

    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('open');
    });
  }

  // 2. Profile Dropdown
  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu) {
    profileMenu.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') profileMenu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!profileMenu.contains(e.target)) profileMenu.classList.remove('open');
    });
  }

  // 3. Logout
  const handleLogout = async (e) => {
    e.preventDefault();
    try { await API.request('/api/auth/logout', { method: 'POST' }); } 
    catch (err) { console.error(err); } 
    finally { window.location.href = 'login.html'; }
  };
  document.getElementById('logoutLink')?.addEventListener('click', handleLogout);
  document.getElementById('logoutDropdown')?.addEventListener('click', handleLogout);

  // 4. Filter Buttons
  document.querySelectorAll('[data-range]').forEach(b => {
    b.addEventListener('click', () => {
      currentRange = b.dataset.range;
      document.querySelectorAll('[data-range]').forEach(x => {
        x.classList.remove('btn-primary');
        x.classList.add('btn-ghost');
      });
      b.classList.remove('btn-ghost'); 
      b.classList.add('btn-primary');
      loadAll();
    });
  });
}

// =========================================
// LOAD DATA
// =========================================
async function loadAll() {
  await loadOverview();
  await loadChart();
  await loadEndpoints();
}

async function loadOverview() {
  try {
    const { stats } = await API.request('/api/analytics/overview');
    if(document.getElementById('aTotal')) document.getElementById('aTotal').textContent = stats.total_requests;
    if(document.getElementById('aSuccess')) document.getElementById('aSuccess').textContent = stats.successful_requests;
    if(document.getElementById('aFailed')) document.getElementById('aFailed').textContent = stats.failed_requests;
  } catch (e) { console.error(e); }
}

async function loadChart() {
  try {
    const { series } = await API.request(`/api/analytics/requests?range=${currentRange}`);
    const canvasEl = document.getElementById('analyticsChart');
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
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
        responsive: false, // <--- MENCEGAH HP CRASH/LEMOT
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      }
    });
  } catch (e) { console.error(e); }
}

async function loadEndpoints() {
  try {
    const { endpoints } = await API.request(`/api/analytics/endpoints?range=${currentRange}`);
    const el = document.getElementById('endpointsTable');
    if (!el) return;
    
    if (!endpoints || endpoints.length === 0) {
      el.innerHTML = '<div class="empty"><p>No data for this period.</p></div>';
      return;
    }
    
    const avg = endpoints.reduce((a, e) => a + e.avg_ms, 0) / endpoints.length;
    if(document.getElementById('aAvg')) document.getElementById('aAvg').textContent = Math.round(avg) + 'ms';
    
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Endpoint</th><th>Requests</th><th>Avg Response</th></tr></thead>
      <tbody>${endpoints.map(e => `<tr>
        <td><code>${e.endpoint}</code></td>
        <td>${e.count}</td>
        <td>${e.avg_ms}ms</td>
      </tr>`).join('')}</tbody></table>`;
  } catch (e) { console.error(e); }
}

// Start
init();