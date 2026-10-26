import { state, saveProxies, loadSavedProxies } from './state.js';
import { escapeHtml, now } from './utils.js';
import { renderIcons } from './icons.js';
import { showPromptBanner, appendLog } from './notifications.js';

export function updateProxyStats() {
  const byOs = { windows: 0, mac: 0, android: 0, ios: 0, linux: 0, other: 0 };
  let fresh = 0, used = 0, failed = 0;

  for (const p of state.configuredProxies) {
    const rawOs = (p.os || 'windows').toLowerCase();
    if (['windows', 'win'].includes(rawOs)) byOs.windows++;
    else if (['mac', 'macos', 'darwin'].includes(rawOs)) byOs.mac++;
    else if (['android', 'droid'].includes(rawOs)) byOs.android++;
    else if (['ios', 'iphone', 'ipad'].includes(rawOs)) byOs.ios++;
    else if (['linux', 'ubuntu'].includes(rawOs)) byOs.linux++;
    else byOs.other++;

    const st = p.state || 'fresh';
    if (st === 'fresh') fresh++;
    else if (st === 'used') used++;
    else if (st === 'failed') failed++;
  }

  const total = state.configuredProxies.length;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('proxyCount', total);
  setEl('px-win-count', byOs.windows);
  setEl('px-mac-count', byOs.mac);
  setEl('px-and-count', byOs.android);
  setEl('px-ios-count', byOs.ios);
  setEl('px-other-count', byOs.linux + byOs.other);

  setEl('px-fresh-badge', `${fresh} fresh`);
  setEl('px-used-badge', `${used} used`);
  setEl('px-failed-badge', `${failed} failed`);

  setEl('px-table-count', `(${total})`);
  setEl('navProxyCount', total);
  setEl('statProxyCount', total);
}

export function renderProxyTable() {
  const proxyTableBody = document.getElementById('proxyTableBody');
  if (!proxyTableBody) return;

  if (state.configuredProxies.length === 0) {
    proxyTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <i data-lucide="server-off"></i>
            <p>No proxies loaded</p>
            <span>Add proxies above using bulk paste, manual form, or sync from database</span>
          </div>
        </td>
      </tr>
    `;
    updateProxyStats();
    renderIcons();
    return;
  }

  let html = '';
  state.configuredProxies.forEach((p, idx) => {
    const os = p.os || 'windows';
    const proto = (p.proxy_type || 'socks5').toLowerCase();
    const st = p.state || 'fresh';
    const host = escapeHtml(p.proxy_host || '—');
    const port = escapeHtml(p.proxy_port || '—');
    const user = escapeHtml(p.proxy_user || '—');
    const key = p.key || `proxy_${idx}`;

    const statusBadge = st === 'failed'
      ? '<span class="badge badge-failed">failed</span>'
      : st === 'used'
        ? '<span class="badge badge-used">used</span>'
        : '<span class="badge badge-fresh">fresh</span>';

    html += `
      <tr>
        <td style="text-align: center">
          <input type="checkbox" class="proxy-check" data-index="${idx}" data-key="${escapeHtml(key)}" />
        </td>
        <td style="font-weight: 600; color: #fff; font-family: var(--font-mono)">${host}</td>
        <td style="font-family: var(--font-mono)">${port}</td>
        <td style="color: var(--muted); font-family: var(--font-mono); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${user}</td>
        <td>
          <span class="badge ${proto === 'socks5' ? 'badge-socks5' : 'badge-http'}">${proto}</span>
        </td>
        <td>
          <span class="badge badge-${os}">${os}</span>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: center">
          <button class="action-btn-danger" data-delete-index="${idx}" title="Delete proxy">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `;
  });

  proxyTableBody.innerHTML = html;
  updateProxyStats();
  renderIcons();
}

export function toggleSelectAll(checked) {
  const checks = document.querySelectorAll('.proxy-check');
  checks.forEach((c) => (c.checked = checked));
  const selectAll = document.getElementById('selectAll');
  const tableHeadCheck = document.getElementById('tableHeadCheck');
  if (selectAll) selectAll.checked = checked;
  if (tableHeadCheck) tableHeadCheck.checked = checked;
}

export function initProxyTableListeners() {
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.addEventListener('change', () => toggleSelectAll(selectAll.checked));
  }

  const tableHeadCheck = document.getElementById('tableHeadCheck');
  if (tableHeadCheck) {
    tableHeadCheck.addEventListener('change', () => toggleSelectAll(tableHeadCheck.checked));
  }

  const refreshTableBtn = document.getElementById('refreshTableBtn');
  if (refreshTableBtn) {
    refreshTableBtn.addEventListener('click', () => {
      loadSavedProxies();
      renderProxyTable();
      showPromptBanner('Proxy list refreshed from local store.', 'success');
    });
  }

  const proxyTableBody = document.getElementById('proxyTableBody');
  if (proxyTableBody) {
    proxyTableBody.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-delete-index]');
      if (!deleteBtn) return;
      const idx = parseInt(deleteBtn.getAttribute('data-delete-index'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.configuredProxies.length) {
        state.configuredProxies.splice(idx, 1);
        saveProxies();
        renderProxyTable();
        showPromptBanner('Proxy deleted.', 'warning');
      }
    });
  }

  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      const checkedBoxes = [...document.querySelectorAll('.proxy-check:checked')];
      if (!checkedBoxes.length) {
        showPromptBanner('Please select proxies to delete using checkboxes.', 'warning');
        return;
      }

      const indices = checkedBoxes.map((c) => parseInt(c.dataset.index, 10)).sort((a, b) => b - a);
      indices.forEach((idx) => state.configuredProxies.splice(idx, 1));

      toggleSelectAll(false);
      saveProxies();
      renderProxyTable();

      showPromptBanner(`Deleted ${indices.length} selected proxy/proxies.`, 'success');
      appendLog({
        timestamp: now(),
        level: 'info',
        message: `Deleted ${indices.length} selected proxies. Total remaining: ${state.configuredProxies.length}.`
      });
    });
  }

  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', () => {
      if (state.configuredProxies.length === 0) {
        showPromptBanner('No proxies in list to delete.', 'warning');
        return;
      }
      const prev = state.configuredProxies.length;
      state.configuredProxies = [];
      toggleSelectAll(false);
      saveProxies();
      renderProxyTable();
      showPromptBanner(`Deleted all ${prev} proxies from list.`, 'warning');
      appendLog({
        timestamp: now(),
        level: 'warn',
        message: `Deleted all ${prev} proxies from list.`
      });
    });
  }

  const deleteByOsBtn = document.getElementById('deleteByOsBtn');
  const pxDeleteByOs = document.getElementById('px-delete-by-os');
  if (deleteByOsBtn && pxDeleteByOs) {
    deleteByOsBtn.addEventListener('click', () => {
      const filter = pxDeleteByOs.value;
      if (!filter) {
        showPromptBanner('Choose a device type first.', 'warning');
        return;
      }

      const initial = state.configuredProxies.length;
      state.configuredProxies = state.configuredProxies.filter((p) => {
        const o = (p.os || 'windows').toLowerCase();
        if (filter === 'linux_and_other') {
          return o !== 'linux' && ['windows', 'mac', 'android', 'ios'].includes(o);
        }
        if (filter === 'other') {
          return ['windows', 'mac', 'android', 'ios', 'linux'].includes(o);
        }
        return o !== filter;
      });

      const removed = initial - state.configuredProxies.length;
      pxDeleteByOs.value = '';
      toggleSelectAll(false);
      saveProxies();
      renderProxyTable();

      showPromptBanner(`Deleted ${removed} proxies for device type: ${filter}.`, 'success');
      appendLog({
        timestamp: now(),
        level: 'info',
        message: `Deleted ${removed} proxies for device type: ${filter}. Total remaining: ${state.configuredProxies.length}.`
      });
    });
  }
}
