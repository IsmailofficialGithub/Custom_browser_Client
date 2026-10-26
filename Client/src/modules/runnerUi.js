import { state, saveProxies } from './state.js';
import { renderProxyTable } from './proxyTable.js';
import { showPromptBanner, appendLog } from './notifications.js';
import { syncAssignedBackendData } from './authUi.js';
import { now } from './utils.js';

export function initRunnerUi() {
  const quickStartBtn = document.getElementById('quickStartBtn');
  const quickSkipBtn = document.getElementById('quickSkipBtn');
  const quickStopBtn = document.getElementById('quickStopBtn');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');

  const statProgress = document.getElementById('statProgress');
  const progressBar = document.getElementById('progressBar');
  const progressPctText = document.getElementById('progressPctText');
  const statPctHint = document.getElementById('statPctHint');
  const statActiveProfile = document.getElementById('statActiveProfile');
  const statActiveProxy = document.getElementById('statActiveProxy');
  const headerStatusPill = document.getElementById('headerStatusPill');
  const headerStatusText = document.getElementById('headerStatusText');

  // Start Sequential Execution
  if (quickStartBtn) {
    quickStartBtn.addEventListener('click', async () => {
      quickStartBtn.disabled = true;
      const btnSpan = quickStartBtn.querySelector('span');
      const origText = btnSpan ? btnSpan.textContent : 'Start Run';

      // Always perform a fresh call to server on Run click to pick up recycled or newly added proxies immediately
      if (state.currentUserSession && state.currentUserSession.token) {
        if (btnSpan) btnSpan.textContent = 'Syncing...';
        try {
          await syncAssignedBackendData(false);
        } catch (syncErr) {
          console.warn('Pre-run sync failed:', syncErr);
        } finally {
          if (btnSpan) btnSpan.textContent = origText;
        }
      }

      if (state.configuredProxies.length === 0) {
        quickStartBtn.disabled = false;
        appendLog({ timestamp: now(), level: 'warn', message: 'Please add or sync proxies in the Proxies tab.' });
        const navProxiesBtn = document.getElementById('navProxies');
        if (navProxiesBtn) navProxiesBtn.click();
        showPromptBanner('Please add or sync at least one proxy before starting.', 'warning');
        return;
      }

      // Check for fresh proxies
      const freshProxies = state.configuredProxies.filter((p) => p.state === 'fresh');
      if (freshProxies.length === 0) {
        quickStartBtn.disabled = false;
        appendLog({ timestamp: now(), level: 'warn', message: 'No fresh proxies available in list. All are used or failed.' });
        showPromptBanner('No fresh proxies available to run.', 'warning');
        return;
      }

      state.executingProxies = freshProxies;

      let baseUrl = (apiUrlInput ? apiUrlInput.value.trim() : '') || localStorage.getItem('hostrif_api_url') || 'http://127.0.0.1:50325';
      if (baseUrl.includes(':50425')) {
        baseUrl = baseUrl.replace(':50425', ':50325');
        if (apiUrlInput) apiUrlInput.value = baseUrl;
        localStorage.setItem('hostrif_api_url', baseUrl);
      }
      const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : '') || localStorage.getItem('hostrif_api_key') || '';

      appendLog({ timestamp: now(), level: 'info', message: `Initiating sequential run for ${freshProxies.length} fresh profile(s)...` });

      // Automatically spawn always-on-top draggable floating recorder
      if (window.api.spawnFloatingRecorder) {
        window.api.spawnFloatingRecorder().catch((e) => console.warn('Could not spawn recorder:', e));
      }

      const res = await window.api.startSequential({
        proxies: freshProxies,
        baseUrl,
        apiKey
      });

      if (!res.ok) {
        appendLog({ timestamp: now(), level: 'error', message: res.error });
        quickStartBtn.disabled = false;
      }
    });
  }

  if (quickSkipBtn) {
    quickSkipBtn.addEventListener('click', async () => {
      quickSkipBtn.disabled = true;
      await window.api.skipCurrent();
      setTimeout(() => {
        if (state.isRunning) quickSkipBtn.disabled = false;
      }, 2000);
    });
  }

  if (quickStopBtn) {
    quickStopBtn.addEventListener('click', async () => {
      quickStopBtn.disabled = true;
      await window.api.stopSequential();
    });
  }

  // IPC Event Listeners from Main Process
  window.api.onLog((logData) => {
    appendLog(logData);
    if (logData.level === 'error' && state.isRunning && state.activeProxyIndex >= 0) {
      const list = state.executingProxies.length > 0 ? state.executingProxies : state.configuredProxies;
      const p = list[state.activeProxyIndex];
      if (p) {
        p.state = 'failed';
        saveProxies();
        renderProxyTable();
        if (state.currentUserSession && state.currentUserSession.token && p.backendId) {
          window.api.updateProxyStatus(
            state.currentUserSession.token,
            p.backendId,
            'failed',
            logData.message,
            state.currentUserSession.endpoint
          );
        }
      }
    }
  });

  window.api.onProgress((data) => {
    const { current, total, proxy, profileName } = data;
    if (statProgress) statProgress.textContent = `${current} / ${total}`;

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPctText) progressPctText.textContent = `${pct}%`;
    if (statPctHint) statPctHint.textContent = `${pct}% completed`;

    if (statActiveProfile) statActiveProfile.textContent = profileName || '—';
    if (statActiveProxy) statActiveProxy.textContent = proxy ? `Proxy: ${proxy}` : 'Proxy: —';

    state.activeProxyIndex = current - 1;
    const list = state.executingProxies.length > 0 ? state.executingProxies : state.configuredProxies;
    if (state.activeProxyIndex >= 0 && state.activeProxyIndex < list.length) {
      const p = list[state.activeProxyIndex];
      if (p && p.state !== 'used') {
        p.state = 'used';
        saveProxies();
        renderProxyTable();
        if (state.currentUserSession && state.currentUserSession.token && p.backendId) {
          window.api.updateProxyStatus(
            state.currentUserSession.token,
            p.backendId,
            'used',
            '',
            state.currentUserSession.endpoint
          );
        }
      }
    }
  });

  window.api.onStatus(({ status }) => {
    if (headerStatusPill) headerStatusPill.className = `status-pill ${status}`;
    if (headerStatusText) headerStatusText.textContent = status.toUpperCase().replace('_', ' ');

    if (['running', 'creating', 'launching', 'waiting_close', 'cleaning'].includes(status)) {
      state.isRunning = true;
      if (quickStartBtn) quickStartBtn.disabled = true;
      if (quickSkipBtn) quickSkipBtn.disabled = false;
      if (quickStopBtn) quickStopBtn.disabled = false;
    } else {
      state.isRunning = false;
      if (quickStartBtn) quickStartBtn.disabled = false;
      if (quickSkipBtn) quickSkipBtn.disabled = true;
      if (quickStopBtn) quickStopBtn.disabled = true;
      state.activeProxyIndex = -1;
      state.executingProxies = [];
      if (statActiveProfile) statActiveProfile.textContent = '—';
      if (statActiveProxy) statActiveProxy.textContent = 'Proxy: —';

      // Refresh list after run terminates
      if (state.currentUserSession && state.currentUserSession.token) {
        syncAssignedBackendData(false).catch((e) => console.warn('Post-run sync error:', e));
      }
    }
  });
}
