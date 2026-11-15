async function loadKeys() {
  try {
    const { keys } = await API.request('/api/keys');
    keysCache = keys;
    const el = document.getElementById('keysTable');
    if (!keys.length) {
      el.innerHTML = `<div class="empty">
        <h4>No API keys yet</h4>
        <p>Click "Generate New Key" to create your first one.</p>
      </div>`;
    } else {
      el.innerHTML = `<table class="data-table">
        <thead><tr>
          <th>Name</th><th>API Key</th><th>Created</th><th>Last Used</th><th>Status</th><th>Actions</th>
        </tr></thead><tbody>
        ${keys.map(k => `
          <tr>
            <td><strong>${escapeHtml(k.name)}</strong></td>
            <td><code>${k.key_prefix}...••••</code></td>
            <td>${new Date(k.created_at).toLocaleDateString()}</td>
            <td>${k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</td>
            <td><span class="status ${k.status}">${k.status}</span></td>
            <td>
              ${k.status === 'active' ? `<button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" data-rename="${k.id}" data-name="${escapeHtml(k.name)}">Rename</button>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;" data-revoke="${k.id}">Revoke</button>` : ''}
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;color:red;" data-delete="${k.id}">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody></table>`;
      bindKeyActions();
    }
    // Recent keys panel
    const recent = keys.slice(0, 4);
    document.getElementById('recentKeys').innerHTML = recent.length ? recent.map(k => `
      <div style="padding:10px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:14px;">${escapeHtml(k.name)}</div>
          <div style="font-size:11px;color:var(--muted);">${k.key_prefix}...</div>
        </div>
        <span class="status ${k.status}">${k.status}</span>
      </div>`).join('') : '<div class="empty"><p>No keys yet</p></div>';

    // Populate playground
    const pg = document.getElementById('pgKey');
    const activeKeys = keys.filter(k => k.status === 'active');
    pg.innerHTML = activeKeys.length
      ? activeKeys.map(k => `<option value="${k.id}">${escapeHtml(k.name)} (${k.key_prefix}...)</option>`).join('')
      : '<option value="">— no active keys —</option>';
  } catch (e) { console.error(e); }
}

function bindKeyActions() {
  document.querySelectorAll('[data-revoke]').forEach(b => {
    b.addEventListener('click', () => confirmThen(
      'Revoke API Key?',
      'This action cannot be undone. The key will stop working immediately.',
      () => API.request(`/api/keys/${b.dataset.revoke}/revoke`, { method: 'POST' })
        .then(() => { showToast('Key revoked', 'success'); loadKeys(); loadStats(); })
    ));
  });
  document.querySelectorAll('[data-delete]').forEach(b => {
    b.addEventListener('click', () => confirmThen(
      'Delete API Key?',
      'Permanently delete this key?',
      () => API.request(`/api/keys/${b.dataset.delete}`, { method: 'DELETE' })
        .then(() => { showToast('Key deleted', 'success'); loadKeys(); loadStats(); })
    ));
  });
  document.querySelectorAll('[data-rename]').forEach(b => {
    b.addEventListener('click', () => {
      const name = prompt('New name:', b.dataset.name);
      if (!name) return;
      API.request(`/api/keys/${b.dataset.rename}`, {
        method: 'PATCH', body: JSON.stringify({ name }),
      }).then(() => { showToast('Renamed', 'success'); loadKeys(); });
    });
  });
}

// Generate key
document.getElementById('generateKeyBtn')?.addEventListener('click', () => {
  document.getElementById('newKeyName').value = '';
  document.getElementById('createKeyModal').classList.add('open');
});
document.querySelectorAll('[data-action="generate"]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('createKeyModal').classList.add('open');
  });
});

document.getElementById('confirmCreateKey')?.addEventListener('click', async () => {
  const name = document.getElementById('newKeyName').value.trim();
  if (!name) return showToast('Enter a name', 'error');
  try {
    const { key } = await API.request('/api/keys', {
      method: 'POST', body: JSON.stringify({ name }),
    });
    document.getElementById('createKeyModal').classList.remove('open');
    document.getElementById('newKeyValue').textContent = key.key;
    document.getElementById('showKeyModal').classList.add('open');
    loadKeys(); loadStats();
  } catch (err) {
    showToast(err.detail || 'Failed to create key', 'error');
  }
});

document.getElementById('copyNewKey')?.addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('newKeyValue').textContent);
  showToast('Copied!', 'success');
});

// Confirm modal helper
let confirmCb = null;
function confirmThen(title, message, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmModal').classList.add('open');
  confirmCb = cb;
}
document.getElementById('confirmAction')?.addEventListener('click', async () => {
  if (!confirmCb) return;
  try { await confirmCb(); } catch (e) { showToast(e.detail || 'Failed', 'error'); }
  document.getElementById('confirmModal').classList.remove('open');
  confirmCb = null;
});
document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('.modal-overlay').classList.remove('open'));
});

// PLAYGROUND
document.getElementById('pgSend')?.addEventListener('click', async () => {
  const keyId = document.getElementById('pgKey').value;
  if (!keyId) return showToast('Create an API key first', 'error');

  // We need the plaintext key. Since we don't store plaintext, prompt user.
  const rawKey = prompt('Paste your full API key (ayaka_live_...):');
  if (!rawKey) return;
  const endpoint = document.getElementById('pgEndpoint').value;
  const t0 = performance.now();
  try {
    const res = await fetch(endpoint, { headers: { 'X-API-Key': rawKey } });
    const ms = Math.round(performance.now() - t0);
    const data = await res.json();
    document.getElementById('pgStatus').textContent = res.status;
    document.getElementById('pgTime').textContent = ms + 'ms';
    document.getElementById('pgResponse').textContent = JSON.stringify(data, null, 2);
    document.getElementById('pgResponse').dataset.copy = JSON.stringify(data, null, 2);
  } catch (err) {
    document.getElementById('pgResponse').textContent = 'Error: ' + err.message;
  }
});
document.getElementById('pgCopy')?.addEventListener('click', async () => {
  const t = document.getElementById('pgResponse').textContent;
  await navigator.clipboard.writeText(t);
  showToast('Copied', 'success');
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}