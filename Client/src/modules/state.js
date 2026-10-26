export const state = {
  configuredProxies: [],
  executingProxies: [],
  currentUserSession: null,
  isRunning: false,
  currentTab: 'runner',
  activeProxyIndex: -1
};

export function loadSavedProxies() {
  try {
    const raw = localStorage.getItem('hostrif_configured_proxies');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.configuredProxies = parsed.map((p) => ({
          key: p.key || `${p.proxy_host}:${p.proxy_port}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          proxy_host: p.proxy_host || '',
          proxy_port: String(p.proxy_port || ''),
          proxy_user: p.proxy_user || '',
          proxy_password: p.proxy_password || '',
          proxy_type: p.proxy_type || 'socks5',
          os: p.os || 'windows',
          state: p.state || 'fresh',
          backendId: p.backendId || null
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load saved proxies from localStorage:', err);
  }
}

export function saveProxies() {
  try {
    localStorage.setItem('hostrif_configured_proxies', JSON.stringify(state.configuredProxies));
  } catch (err) {
    console.error('Failed to save proxies to localStorage:', err);
  }
}
