'use strict';

const axios = require('axios');

class AdsPowerClient {
  constructor(baseUrl = 'http://127.0.0.1:50325', apiKey = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    });
  }

  updateConfig(baseUrl, apiKey) {
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (apiKey !== undefined) this.apiKey = apiKey;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
    });
  }

  /**
   * Check if AdsPower Local API is alive and reachable
   */
  async checkStatus() {
    // 1. Try lightweight official /status endpoint first (zero overhead, no rate limiting)
    try {
      const statusRes = await this.http.get('/status');
      if (statusRes.data && statusRes.data.code === 0) {
        return { ok: true, data: statusRes.data };
      }
    } catch (_) {}

    // 2. Fallback to /api/v1/user/list
    try {
      const res = await this.http.get('/api/v1/user/list', {
        params: { page_size: 1 }
      });
      if (res.data && res.data.code === 0) {
        return { ok: true, data: res.data.data };
      }
      const msg = res.data?.msg || res.data?.message || '';
      if (typeof msg === 'string' && msg.includes('Too many request')) {
        return { ok: true, data: {} };
      }
      if (res.data && res.data.code === -1) {
        return { ok: false, error: res.data.msg || 'API key required or invalid' };
      }
      return { ok: false, error: res.data?.msg || 'Unexpected response' };
    } catch (err) {
      return { ok: false, error: err.message || 'Cannot connect to Local API' };
    }
  }

  /**
   * Create a disposable AdsPower profile configured with a proxy
   */
  async createProfile({ name, proxy, os = 'windows' }, retryCount = 2) {
    const effectiveOs = (proxy?.os || os || 'windows').toLowerCase();
    const OS_PLATFORM_NUM = { windows: 0, mac: 1, ios: 2, android: 3, linux: 4 };
    const platform = OS_PLATFORM_NUM[effectiveOs] ?? 0;

    const payload = {
      name: name || `HOSTRIF_${Date.now()}`,
      group_id: '0',
      user_proxy_config: {
        proxy_soft: proxy?.proxy_soft || 'other',
        proxy_type: (proxy?.proxy_type || 'http').toLowerCase(),
        proxy_host: proxy?.proxy_host || '',
        proxy_port: String(proxy?.proxy_port || ''),
        proxy_user: proxy?.proxy_user || '',
        proxy_password: proxy?.proxy_password || ''
      },
      fingerprint_config: {
        platform,
        automatic_timezone: '1',
        language: ['en-US', 'en'],
        flash: 'block',
        webrtc: 'proxy'
      }
    };

    try {
      const res = await this.http.post('/api/v1/user/create', payload);
      if (res.data && res.data.code === 0 && res.data.data?.id) {
        return { ok: true, id: res.data.data.id, data: res.data.data };
      }
      const msg = res.data?.msg || res.data?.message || JSON.stringify(res.data);
      if (retryCount > 0 && typeof msg === 'string' && msg.includes('Too many request')) {
        await new Promise((r) => setTimeout(r, 1200));
        return this.createProfile({ name, proxy, os }, retryCount - 1);
      }
      return { ok: false, error: `Failed to create profile: ${msg}` };
    } catch (err) {
      return { ok: false, error: `AdsPower create request failed: ${err.message}` };
    }
  }

  /**
   * Start the browser for a given profile ID
   */
  async startBrowser(profileId, launchArgs = [], retryCount = 2) {
    try {
      const params = {
        user_id: profileId,
        open_tabs: '1'
      };
      if (launchArgs && launchArgs.length > 0) {
        params.launch_args = JSON.stringify(launchArgs);
      }
      const res = await this.http.get('/api/v1/browser/start', { params });
      if (res.data && res.data.code === 0) {
        return { ok: true, data: res.data.data };
      }
      const msg = res.data?.msg || res.data?.message || JSON.stringify(res.data);
      if (retryCount > 0 && typeof msg === 'string' && msg.includes('Too many request')) {
        await new Promise((r) => setTimeout(r, 1200));
        return this.startBrowser(profileId, launchArgs, retryCount - 1);
      }
      return { ok: false, error: `Failed to start browser: ${msg}` };
    } catch (err) {
      return { ok: false, error: `AdsPower start browser failed: ${err.message}` };
    }
  }

  /**
   * Check if the browser for a profile is still active
   */
  async isBrowserActive(profileId) {
    try {
      const res = await this.http.get('/api/v1/browser/active', {
        params: { user_id: profileId }
      });
      if (res.data && res.data.code === 0) {
        const status = res.data.data?.status;
        const isActive = status === 'Active' || status === 'active';
        return { ok: true, active: isActive, status };
      }
      return { ok: false, active: false, error: res.data?.msg || 'Non-zero response' };
    } catch (err) {
      return { ok: false, active: false, error: err.message };
    }
  }

  /**
   * Stop the browser for a profile
   */
  async stopBrowser(profileId) {
    try {
      const res = await this.http.get('/api/v1/browser/stop', {
        params: { user_id: profileId }
      });
      return { ok: true, data: res.data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Delete profile(s) from AdsPower to keep it clean
   */
  async deleteProfile(profileIdOrIds) {
    const ids = Array.isArray(profileIdOrIds) ? profileIdOrIds : [profileIdOrIds];
    if (ids.length === 0) return { ok: true };

    try {
      const res = await this.http.post('/api/v1/user/delete', { user_ids: ids });
      if (res.data && res.data.code === 0) {
        return { ok: true, data: res.data.data };
      }
      return { ok: false, error: res.data?.msg || 'Delete failed' };
    } catch (err) {
      return { ok: false, error: `AdsPower delete failed: ${err.message}` };
    }
  }
}

module.exports = AdsPowerClient;
