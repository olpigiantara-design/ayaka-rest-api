// Password toggle
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// Redirect if already logged in
(async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (r.ok) window.location.href = 'dashboard.html';
  } catch {}
})();

// LOGIN FORM
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Logging in...';
    try {
      await API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
          password: document.getElementById('password').value,
        }),
      });
      showToast('Login successful. Redirecting...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 400);
    } catch (err) {
      showToast(err.detail || err.message || 'Login failed', 'error');
      btn.disabled = false; btn.textContent = 'Login →';
    }
  });
}

// Forgot password
const forgotBtn = document.getElementById('forgotBtn');
if (forgotBtn) {
  forgotBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    if (!email) return showToast('Enter your email first', 'error');
    try {
      await API.request('/api/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email }),
      });
      showToast('If the email exists, a reset link has been sent.', 'success');
    } catch (err) {
      showToast(err.detail || 'Request failed', 'error');
    }
  });
}

// REGISTER FORM
const regForm = document.getElementById('registerForm');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    if (pw !== confirm) return showToast('Passwords do not match', 'error');
    if (pw.length < 8) return showToast('Password must be 8+ characters', 'error');
    if (!document.getElementById('terms').checked) return showToast('Accept Terms & Conditions', 'error');

    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      await API.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('full_name').value.trim(),
          username: document.getElementById('username').value.trim(),
          email: document.getElementById('email').value.trim(),
          password: pw,
          accept_terms: true,
        }),
      });
      showToast('Account created. Redirecting...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 400);
    } catch (err) {
      const msg = typeof err.detail === 'string' ? err.detail
        : Array.isArray(err.detail) ? err.detail[0]?.msg : 'Registration failed';
      showToast(msg || 'Registration failed', 'error');
      btn.disabled = false; btn.textContent = 'Create Account →';
    }
  });
}