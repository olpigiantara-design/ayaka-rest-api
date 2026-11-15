// AUTH GUARD + LOAD
let currentUser = null;
let keysCache = [];

async function loadUser() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return window.location.href = 'login.html';
    const data = await r.json();
    currentUser = data.user;
    document.getElementById('welcomeName').textContent = currentUser.username;
    document.getElementById('avatarBtn').textContent = (currentUser.full_name || 'U')[0].toUpperCase();
  } catch { window.location.href = 'login.html'; }
}

async function loadStats() {
  try {
    const { stats } = await API.request('/api/analytics/overview');
    document.getElementById('statKeys').textContent = stats.total_keys;
    document.getElementById('statRequests').textContent = stats.total_requests;
    document.getElementById('statSuccess').textContent = stats.successful_requests;
    document.getElementById('statFailed').textContent = stats.failed_requests;
  } catch (e) { console.error(e); }
}

let chartInstance = null;
async function loadChart() {
  try {
    const { series } = await API.request('/api/analytics/requests?range=7d');
    const labels = series.map(s => s.date);
    const data = series.map(s => s.count);
    const ctx = document.getElementById('requestsChart').getContext('2d');
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
          borderWidth: 3, tension: 0.35, fill: true,
          pointBackgroundColor: '#FFD84D',
          pointBorderColor: '#171717',
          pointBorderWidth: 2, pointRadius: 5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  } catch (e) { console.error(e); }
}

async function loadActivity() {
  try {
    const { logs } = await API.request('/api/analytics/activity');
    const el = document.getElementById('activityList');
    if (!logs.length) { el.innerHTML = '<div class="empty"><p>No activity yet.</p></div>'; return; }
    el.innerHTML = `<table class="data-table"><thead><tr>
      <th>Method</th><th>Endpoint</th><th>Status</th><th>Time</th><th>When</th>
    </tr></thead><tbody>${logs.map(l => `
      <tr>
        <td><span class="method">${l.method}</span></td>
        <td><code>${l.endpoint}</code></td>
        <td>${l.status_code}</td>
        <td>${l.response_time}ms</td>
        <td>${new Date(l.created_at).toLocaleString()}</td>
      </tr>`).join('')}</tbody></table>`;
  } catch {}
}

async function loadNotifications() {
  try {
    const { notifications } = await API.request('/api/user/notifications');
    const unread = notifications.some(n => !n.is_read);
    document.getElementById('bellDot').style.display = unread ? 'block' : 'none';
    const list = document.getElementById('notifList');
    list.innerHTML = notifications.length
      ? notifications.map(n => `
        <div style="padding:12px;border-bottom:1px solid #eee;">
          <div style="font-weight:700;font-size:14px;">${n.title}</div>
          <div style="font-size:13px;color:var(--muted);">${n.message}</div>
          <div style="font-size:11px;color:#999;margin-top:4px;">${new Date(n.created_at).toLocaleString()}</div>
        </div>`).join('')
      : '<div class="empty"><p>No notifications</p></div>';
  } catch {}
}

// SIDEBAR
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// PROFILE MENU
document.getElementById('profileMenu')?.addEventListener('click', (e) => {
  e.currentTarget.classList.toggle('open');
});

// LOGOUT
async function doLogout() {
  try {
    await API.request('/api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  } catch { window.location.href = 'login.html'; }
}
document.getElementById('logoutLink')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
document.getElementById('logoutDropdown')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });

// NOTIFICATIONS
document.getElementById('bell')?.addEventListener('click', () => {
  document.getElementById('notifModal').classList.add('open');
});
document.getElementById('markRead')?.addEventListener('click', async () => {
  await API.request('/api/user/notifications/read-all', { method: 'POST' });
  loadNotifications();
});

// SEARCH FILTER (client-side, filters visible tables/panels)
document.getElementById('globalSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.data-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// INIT
(async () => {
  await loadUser();
  await Promise.all([loadStats(), loadChart(), loadActivity(), loadNotifications(), loadKeys()]);
  // Periodic revalidation
  setInterval(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (!r.ok) window.location.href = 'login.html';
    } catch {}
  }, 60000);
})();