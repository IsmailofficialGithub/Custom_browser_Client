import { state, saveProxies } from './state.js';
import { renderProxyTable } from './proxyTable.js';
import { showPromptBanner, appendLog } from './notifications.js';
import { now } from './utils.js';

export async function handleAddProxies() {
  const proxyBulk = document.getElementById('proxyBulk');
  const pxHost = document.getElementById('px-host');
  const pxPort = document.getElementById('px-port');
  const pxUser = document.getElementById('px-user');
  const pxPass = document.getElementById('px-pass');
  const pxProto = document.getElementById('px-proto');
  const pxOs = document.getElementById('px-os');

  const bulk = proxyBulk ? proxyBulk.value.trim() : '';
  const newEntries = [];

  if (bulk) {
    const proto = pxProto ? pxProto.value : 'socks5';
    const os = pxOs ? pxOs.value : 'windows';

    let parsed = [];
    try {
      parsed = await window.api.parseProxies(bulk, os, proto);
    } catch (err) {
      console.error('Error parsing proxies:', err);
    }

    if (parsed && parsed.length > 0) {
      parsed.forEach((p) => {
        newEntries.push({
          key: `${p.proxy_host}:${p.proxy_port}:${p.proxy_user || ''}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          proxy_host: p.proxy_host,
          proxy_port: String(p.proxy_port),
          proxy_user: p.proxy_user || '',
          proxy_password: p.proxy_password || '',
          proxy_type: p.proxy_type || proto || 'socks5',
          os: p.os || os || 'windows',
          state: 'fresh'
        });
      });
    }
  } else {
    // Manual single entry
    const host = pxHost ? pxHost.value.trim() : '';
    const port = pxPort ? pxPort.value.trim() : '';
    const user = pxUser ? pxUser.value.trim() : '';
    const pass = pxPass ? pxPass.value.trim() : '';
    const proto = pxProto ? pxProto.value : 'socks5';
    const os = pxOs ? pxOs.value : 'windows';

    if (!host || !port) {
      showPromptBanner('Please fill in host and port or paste proxies in the box above.', 'warning');
      return;
    }

    newEntries.push({
      key: `${host}:${port}:${user}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      proxy_host: host,
      proxy_port: String(port),
      proxy_user: user,
      proxy_password: pass,
      proxy_type: proto,
      os: os,
      state: 'fresh'
    });
  }

  if (newEntries.length === 0) {
    showPromptBanner('Could not parse any valid proxies.', 'warning');
    return;
  }

  state.configuredProxies.push(...newEntries);

  if (proxyBulk) proxyBulk.value = '';
  if (pxHost) pxHost.value = '';
  if (pxPort) pxPort.value = '';
  if (pxUser) pxUser.value = '';
  if (pxPass) pxPass.value = '';

  saveProxies();
  renderProxyTable();

  showPromptBanner(`Added ${newEntries.length} proxy/proxies.`, 'success');
  appendLog({
    timestamp: now(),
    level: 'success',
    message: `Added ${newEntries.length} proxy/proxies. Total in list: ${state.configuredProxies.length}.`
  });
}

export function initProxyInputListeners() {
  const addProxiesBtn = document.getElementById('addProxiesBtn');
  if (addProxiesBtn) {
    addProxiesBtn.addEventListener('click', handleAddProxies);
  }

  const proxyBulk = document.getElementById('proxyBulk');
  const pxProto = document.getElementById('px-proto');
  const pxHost = document.getElementById('px-host');
  const pxPort = document.getElementById('px-port');
  const pxUser = document.getElementById('px-user');
  const pxPass = document.getElementById('px-pass');

  // Protocol Auto-Detection in Bulk Input
  if (proxyBulk && pxProto) {
    const detectBulkProtocol = () => {
      const text = proxyBulk.value.trim().toLowerCase();
      if (!text) return;
      if (/^(socks?[45]?|socket[45]?|socs?)/m.test(text) || /\b(socks[45]?|socket[45]?|sock[45]?|socs?)\b/.test(text) || /:(1080|1081|9050|9150|10808)\b/.test(text)) {
        pxProto.value = 'socks5';
      } else if (/^https?/m.test(text) || /\bhttps?\b/.test(text) || /:(80|8080|3128|8888)\b/.test(text)) {
        pxProto.value = 'http';
      }
    };
    proxyBulk.addEventListener('input', detectBulkProtocol);
    proxyBulk.addEventListener('paste', () => setTimeout(detectBulkProtocol, 50));
  }

  // Host Input URL auto-unpacking and protocol detection
  if (pxHost) {
    const detectManualHost = () => {
      const val = pxHost.value.trim();
      if (!val) return;

      if (/^[a-zA-Z0-9]+:\/\//.test(val)) {
        try {
          const u = new URL(val);
          if (u.hostname) pxHost.value = u.hostname;
          if (u.port && pxPort) pxPort.value = u.port;
          if (u.username && pxUser) pxUser.value = decodeURIComponent(u.username);
          if (u.password && pxPass) pxPass.value = decodeURIComponent(u.password);
          if (pxProto) {
            const proto = (u.protocol || '').replace(':', '').toLowerCase();
            if (proto.startsWith('sock') || proto.startsWith('soc')) pxProto.value = 'socks5';
            else if (proto.startsWith('http')) pxProto.value = 'http';
          }
          return;
        } catch {}
      }

      if (/^(socks?[45]?|socket[45]?|socs?)/i.test(val)) {
        if (pxProto) pxProto.value = 'socks5';
        pxHost.value = val.replace(/^(socks[45]?|sock[45]?|socket[45]?|socs?)(:\/\/|:|\s+)/i, '');
      } else if (/^https?/i.test(val)) {
        if (pxProto) pxProto.value = 'http';
        pxHost.value = val.replace(/^https?(:\/\/|:|\s+)/i, '');
      }
    };

    pxHost.addEventListener('input', detectManualHost);
    pxHost.addEventListener('paste', () => setTimeout(detectManualHost, 50));
  }

  if (pxPort && pxProto) {
    pxPort.addEventListener('input', () => {
      const p = parseInt(pxPort.value, 10);
      if ([1080, 1081, 9050, 9150, 10808, 10809].includes(p)) {
        pxProto.value = 'socks5';
      } else if ([80, 8080, 3128, 8888].includes(p)) {
        pxProto.value = 'http';
      }
    });
  }

  // Format & Clean Button
  const formatProxiesBtn = document.getElementById('formatProxiesBtn');
  if (formatProxiesBtn) {
    formatProxiesBtn.addEventListener('click', async () => {
      const rawText = proxyBulk ? proxyBulk.value : '';
      if (!rawText || !rawText.trim()) {
        showPromptBanner('Please paste proxies into the box before formatting.', 'warning');
        return;
      }

      const proto = pxProto ? pxProto.value : 'socks5';
      const os = pxOs ? pxOs.value : 'windows';
      const res = await window.api.formatProxies(rawText, os, proto);
      if (!res || !res.formattedText) {
        showPromptBanner('No valid proxies recognized in the input.', 'warning');
        return;
      }

      proxyBulk.value = res.formattedText;
      if (res.invalidLines && res.invalidLines.length > 0) {
        showPromptBanner(`Formatted ${res.validCount} proxies (${res.invalidLines.length} unparseable lines skipped).`, 'warning');
      } else if (res.cleanedCount > 0) {
        showPromptBanner(`Cleaned and formatted ${res.validCount} proxies.`, 'success');
      } else {
        showPromptBanner(`All ${res.validCount} proxies are properly formatted.`, 'success');
      }
    });
  }

  // Clear Input Button
  const clearTextareaBtn = document.getElementById('clearTextareaBtn');
  if (clearTextareaBtn) {
    clearTextareaBtn.addEventListener('click', () => {
      if (proxyBulk) proxyBulk.value = '';
      showPromptBanner('Input text cleared.', 'warning');
    });
  }

  // Load File Button
  const importFileBtn = document.getElementById('importFileBtn');
  if (importFileBtn) {
    importFileBtn.addEventListener('click', async () => {
      const fileData = await window.api.openProxyFile();
      if (!fileData) return;
      if (fileData.error) {
        showPromptBanner(fileData.error, 'warning');
        appendLog({ timestamp: now(), level: 'error', message: fileData.error });
        return;
      }

      const proto = pxProto ? pxProto.value : 'socks5';
      const os = pxOs ? pxOs.value : 'windows';
      const parsed = await window.api.parseProxies(fileData.content, os, proto);

      if (!parsed || parsed.length === 0) {
        showPromptBanner(`No valid proxies found in "${fileData.fileName}".`, 'warning');
        return;
      }

      const newEntries = parsed.map((p) => ({
        key: `${p.proxy_host}:${p.proxy_port}:${p.proxy_user || ''}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        proxy_host: p.proxy_host,
        proxy_port: String(p.proxy_port),
        proxy_user: p.proxy_user || '',
        proxy_password: p.proxy_password || '',
        proxy_type: p.proxy_type || proto || 'socks5',
        os: p.os || os || 'windows',
        state: 'fresh'
      }));

      state.configuredProxies.push(...newEntries);
      saveProxies();
      renderProxyTable();
      showPromptBanner(`Imported & added ${newEntries.length} proxies from "${fileData.fileName}".`, 'success');
      appendLog({
        timestamp: now(),
        level: 'success',
        message: `Imported ${newEntries.length} proxies from file "${fileData.fileName}". Total: ${state.configuredProxies.length}.`
      });
    });
  }
}
