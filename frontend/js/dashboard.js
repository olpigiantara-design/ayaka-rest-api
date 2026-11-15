// =========================================
// STATE MANAGEMENT
// =========================================
let currentUser = null;
let chartInstance = null;

// =========================================
// AUTH GUARD & USER DATA
// =========================================
async function loadUser() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await r.json();
    currentUser = data.user;
    
    const welcomeEl = document.getElementById('welcomeName');
    const avatarEl = document.getElementById('avatarBtn');
    
    if (welcomeEl) welcomeEl.textContent = currentUser.username;
    if (avatarEl) avatarEl.textContent = (currentUser.full_name || 'U')[0].toUpperCase();
  } catch (error) {
    console.error("Auth error:", error);
    window.location.href = '/login.html';
  }
}

// =========================================
// LOAD DATA FUNCTIONS
// =========================================
async function loadStats() {
  try {
    const { stats } = await API.request('/api/analytics/overview');
    if(document.getElementById('statKeys')) document.getElementById('statKeys').textContent = stats.total_keys;
    if(document.getElementById('statRequests')) document.getElementById('statRequests').textContent = stats.total_requests;
    if(document.getElementById('statSuccess')) document.getElementById('statSuccess').textContent = stats.successful_requests;
    if(document.getElementById('statFailed')) document.getElementById('statFailed').textContent = stats.failed_requests;
  } catch (e) { 
    console.error("Failed to load stats:", e); 
  }
}

async function loadChart() {
  try {
    const { series } = await API.request('/api/analytics/requests?range=7d');
    const labels = series.map(s => s.date);
    const data = series.map(s => s.count);
    
    const canvasEl = document.getElementById('requestsChart');
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Requests',
          data,
          borderColor: '#3568FF',
          backgroundColor: 'rgba(53,104,255,0.15)',
          borderWidth: 3, 
          tension: 0.35, 
          fill: true,
          pointBackgroundColor: '#FFD84D',
          pointBorderColor: '#171717',
          pointBorderWidth: 2, 
          pointRadius: 5,
        }],
      },
      options: {
        responsive: false, // <--- PENTING: Agar grafik tidak memanjang & bikin HP crash
        maintainAspectRatio: false, 
        animation: false, 
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  } catch (e) { 
    console.error("Failed to load chart:", e); 
  }
}

async function loadActivity() {
  try {
    const { logs } = await API.request('/api/analytics/activity');
    const el = document.getElementById('activityList');
    if (!el) return;
    
    if (!logs || logs.length === 0) { 
      el.innerHTML = '<div class="empty"><p>No activity yet.</p></div>'; 
      return; 
    }
    
    el.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Method</th><th>Endpoint</th><th>Status</th><th>Time</th><th>When</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td><span class="method">${l.method}</span></td>
              <td><code>${l.endpoint}</code></td>
              <td>${l.status_code}</td>
              <td>${l.response_time}ms</td>
              <td>${new Date(l.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (e) { console.error(e); }
}

async function loadNotifications() {
  try {
    const { notifications } = await API.request('/api/user/notifications');
    const bellDot = document.getElementById('bellDot');
    const list = document.getElementById('notifList');
    
    if (!list) return;
    const unread = notifications.some(n => !n.is_read);
    if (bellDot) bellDot.style.display = unread ? 'block' : 'none';
    
    list.innerHTML = (notifications.length === 0) 
      ? '<div class="empty" style="padding:20px;"><p>No notifications</p></div>'
      : notifications.map(n => `
        <div style="padding:12px;border-bottom:1px solid #eee;">
          <div style="font-weight:700;font-size:14px;">${n.title}</div>
          <div style="font-size:13px;color:var(--muted);">${n.message}</div>
          <div style="font-size:11px;color:#999;margin-top:4px;">${new Date(n.created_at).toLocaleString()}</div>
        </div>
      `).join('');
  } catch (e) { console.error(e); }
}

// =========================================
// UI EVENT LISTENERS
// =========================================
function setupEventListeners() {
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

  const profileMenu = document.getElementById('profileMenu');
  if (profileMenu) {
    profileMenu.addEventListener('click', (e) => {
      if (e.target.tagName !== 'A') profileMenu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!profileMenu.contains(e.target)) profileMenu.classList.remove('open');
    });
  }

  const handleLogout = async (e) => {
    e.preventDefault();
    try { await API.request('/api/auth/logout', { method: 'POST' }); } 
    catch (err) { console.error(err); } 
    finally { window.location.href = '/login.html'; }
  };

  document.getElementById('logoutLink')?.addEventListener('click', handleLogout);
  document.getElementById('logoutDropdown')?.addEventListener('click', handleLogout);

  document.getElementById('bell')?.addEventListener('click', () => {
    document.getElementById('notifModal').classList.add('open');
  });
  
  document.getElementById('markRead')?.addEventListener('click', async () => {
    try {
      await API.request('/api/user/notifications/read-all', { method: 'POST' });
      loadNotifications();
    } catch (e) {}
  });

  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.data-table tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// =========================================
// INITIALIZATION
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadUser();
  
  if (currentUser) {
    await loadStats(); 
    await loadNotifications();
    await loadActivity();
    
    // Jeda sedikit untuk chart agar render DOM selesai
    setTimeout(() => { loadChart(); }, 500);
    
    if (typeof loadKeys === 'function') {
      await loadKeys();
    }
  }
});