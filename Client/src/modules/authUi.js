import { state, saveProxies } from './state.js';
import { renderProxyTable } from './proxyTable.js';
import { checkEngineStatus } from './engineStatus.js';
import { showPromptBanner, appendLog } from './notifications.js';
import { renderIcons } from './icons.js';
import { now } from './utils.js';

let proxyPollingInterval = null;

export function startProxyPolling(intervalMs = 12000) {
  stopProxyPolling();
  proxyPollingInterval = setInterval(async () => {
    if (state.currentUserSession && state.currentUserSession.token && !state.isRunning) {
      await syncAssignedBackendData(false);
    }
  }, intervalMs);
}

export function stopProxyPolling() {
  if (proxyPollingInterval) {
    clearInterval(proxyPollingInterval);
    proxyPollingInterval = null;
  }
}

export async function syncAssignedBackendData(showBanner = true) {
  if (!state.currentUserSession || !state.currentUserSession.token) {
    if (showBanner) showPromptBanner('Please sign in first to fetch assigned proxies.', 'warning');
    return;
  }

    const endpoint = state.currentUserSession.endpoint || '';

    // 1. Fetch Assigned AdsPower Configuration
    const cfgRes = await window.api.fetchAssignedConfig(state.currentUserSession.token, endpoint);
    if (cfgRes && cfgRes.success) {
      const apiUrlInput = document.getElementById('apiUrlInput');
      const apiKeyInput = document.getElementById('apiKeyInput');
      if (cfgRes.adspower_url) {
        const normalizedUrl = cfgRes.adspower_url.replace(':50425', ':50325');
        if (apiUrlInput) apiUrlInput.value = normalizedUrl;
        localStorage.setItem('hostrif_api_url', normalizedUrl);
      }
      if (cfgRes.adspower_api_key && apiKeyInput) {
        apiKeyInput.value = cfgRes.adspower_api_key;
        localStorage.setItem('hostrif_api_key', cfgRes.adspower_api_key);
      }
    }

    // 2. Fetch Assigned Proxies (all statuses)
    const pxRes = await window.api.fetchAssignedProxies(state.currentUserSession.token, 'all', endpoint);
    if (pxRes && pxRes.success && Array.isArray(pxRes.proxies)) {
      const backendProxies = pxRes.proxies.map((p) => ({
        backendId: p.id,
        key: `${p.host}:${p.port}:${p.user || ''}_${p.id}`,
        proxy_host: p.host,
        proxy_port: String(p.port),
        proxy_user: p.user || '',
        proxy_password: p.pass || '',
        proxy_type: p.protocol || 'socks5',
        os: p.os || 'windows',
        state: p.status || 'fresh'
      }));

      // Preserve any manual entries that do not come from backend
      const localOnly = state.configuredProxies.filter((p) => !p.backendId);
      const merged = [...backendProxies, ...localOnly];

      const currentJson = JSON.stringify(state.configuredProxies);
      const newJson = JSON.stringify(merged);
      if (currentJson !== newJson) {
        state.configuredProxies = merged;
        saveProxies();
        renderProxyTable();
      }

      if (showBanner) {
        showPromptBanner(`Synced ${pxRes.proxies.length} assigned proxies from PostgreSQL.`, 'success');
        appendLog({
          timestamp: now(),
          level: 'success',
          message: `Synced ${pxRes.proxies.length} assigned proxies via gRPC.`
        });
      }
    }
  } catch (err) {
    console.error('Sync backend data error:', err);
    if (showBanner) showPromptBanner(`Sync failed: ${err.message}`, 'danger');
  }
}

export async function initAuthAndSession() {
  const userBadgeWrap = document.getElementById('userBadgeWrap');
  const userEmailText = document.getElementById('userEmailText');
  const loginOverlay = document.getElementById('loginOverlay');

  try {
    const session = await window.api.getSession();
    if (session && session.token) {
      state.currentUserSession = session;
      if (userEmailText) userEmailText.textContent = session.email || 'User';
      if (userBadgeWrap) userBadgeWrap.style.display = 'inline-flex';
      if (loginOverlay) loginOverlay.classList.add('hidden');
      renderIcons();
      await syncAssignedBackendData(false);
      startProxyPolling();
    } else {
      if (loginOverlay) loginOverlay.classList.remove('hidden');
      renderIcons();
    }
  } catch (err) {
    console.error('Session init error:', err);
    if (loginOverlay) loginOverlay.classList.remove('hidden');
  }
}

export function initAuthListeners() {
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const togglePasswordIcon = document.getElementById('togglePasswordIcon');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginSubmitText = document.getElementById('loginSubmitText');
  const userBadgeWrap = document.getElementById('userBadgeWrap');
  const userEmailText = document.getElementById('userEmailText');
  const loginOverlay = document.getElementById('loginOverlay');
  const logoutBtn = document.getElementById('logoutBtn');
  const fetchAssignedProxiesBtn = document.getElementById('fetchAssignedProxiesBtn');

  // Password visibility toggle
  if (togglePasswordBtn && loginPassword) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = loginPassword.type === 'password';
      loginPassword.type = isPassword ? 'text' : 'password';
      if (togglePasswordIcon) {
        togglePasswordIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        renderIcons();
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!loginEmail || !loginPassword) return;

      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      // Default gRPC endpoint from settings or environment
      const endpoint = localStorage.getItem('hostrif_backend_endpoint') || '';

      if (loginError) loginError.classList.add('hidden');
      if (loginSubmitBtn) loginSubmitBtn.disabled = true;
      if (loginSubmitText) loginSubmitText.textContent = 'Connecting...';

      try {
        const res = await window.api.login(email, password, endpoint);
        if (res && res.success) {
          state.currentUserSession = {
            token: res.token,
            userId: res.user_id,
            email: res.email,
            endpoint
          };
          if (userEmailText) userEmailText.textContent = res.email;
          if (userBadgeWrap) userBadgeWrap.style.display = 'inline-flex';
          if (loginOverlay) loginOverlay.classList.add('hidden');
          renderIcons();

          showPromptBanner(`Welcome back, ${res.email}!`, 'success');
          appendLog({
            timestamp: now(),
            level: 'success',
            message: `Authenticated as ${res.email} successfully.`
          });

          await syncAssignedBackendData(false);
          startProxyPolling();
        } else {
          if (loginError) {
            if (loginErrorText) loginErrorText.textContent = res.message || 'Invalid email or password.';
            loginError.classList.remove('hidden');
          }
        }
      } catch (err) {
        if (loginError) {
          if (loginErrorText) loginErrorText.textContent = `Connection error: ${err.message}`;
          loginError.classList.remove('hidden');
        }
      } finally {
        if (loginSubmitBtn) loginSubmitBtn.disabled = false;
        if (loginSubmitText) loginSubmitText.textContent = 'Sign In';
        renderIcons();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      stopProxyPolling();
      await window.api.logout();
      state.currentUserSession = null;
      if (userBadgeWrap) userBadgeWrap.style.display = 'none';
      if (loginOverlay) loginOverlay.classList.remove('hidden');
      showPromptBanner('You have been signed out.', 'warning');
      appendLog({
        timestamp: now(),
        level: 'info',
        message: 'Signed out of backend session.'
      });
      renderIcons();
    });
  }

  if (fetchAssignedProxiesBtn) {
    fetchAssignedProxiesBtn.addEventListener('click', () => syncAssignedBackendData(true));
  }
}
