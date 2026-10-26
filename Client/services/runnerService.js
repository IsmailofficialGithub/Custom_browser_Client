const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const AdsPowerClient = require('../adspower-client');

async function resolveProxyExitIp(proxy) {
  const proto = (proxy.proxy_type || proxy.protocol || 'socks5').toLowerCase();
  const host = proxy.proxy_host || proxy.host;
  const port = proxy.proxy_port || proxy.port;
  const user = encodeURIComponent(proxy.proxy_user || proxy.user || '');
  const pass = encodeURIComponent(proxy.proxy_password || proxy.pass || '');
  const auth = user ? `${user}:${pass}@` : '';
  const proxyUrl = `${proto}://${auth}${host}:${port}`;

  const testEndpoints = [
    'http://api.ipify.org',
    'http://icanhazip.com',
    'http://checkip.amazonaws.com'
  ];

  for (const url of testEndpoints) {
    try {
      const agent = new SocksProxyAgent(proxyUrl);
      const res = await axios.get(url, {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 12000,
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 400
      });
      const exitIp = String(res.data || '').trim().replace(/\s+/g, '');
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(exitIp) || /^[0-9a-fA-F:]+$/.test(exitIp)) {
        return { ok: true, exitIp };
      }
    } catch (_) { }
  }
  return { ok: false, exitIp: null };
}

class RunnerService {
  constructor() {
    this.adsClient = new AdsPowerClient('http://127.0.0.1:50325');
    this.state = {
      running: false,
      stopRequested: false,
      skipRequested: false,
      current: 0,
      total: 0,
      activeProfileId: null,
      activeProfileName: null,
      status: 'idle'
    };
    this.listeners = {
      onLog: null,
      onStatus: null,
      onProgress: null
    };
    this.sessionHooks = {
      onProfileLaunched: null,
      onProfileClosed: null
    };
  }

  setListeners({ onLog, onStatus, onProgress }) {
    this.listeners.onLog = onLog;
    this.listeners.onStatus = onStatus;
    this.listeners.onProgress = onProgress;
  }

  setSessionHooks({ onProfileLaunched, onProfileClosed }) {
    this.sessionHooks = { onProfileLaunched, onProfileClosed };
  }

  log(level, message) {
    const item = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    console.log(`[${item.timestamp}] [${level.toUpperCase()}] ${message}`);
    if (this.listeners.onLog) this.listeners.onLog(item);
  }

  setStatus(status) {
    this.state.status = status;
    if (this.listeners.onStatus) this.listeners.onStatus({ status });
  }

  sendProgress(current, total, proxy = null, profileName = '') {
    this.state.current = current;
    this.state.total = total;
    if (this.listeners.onProgress) {
      this.listeners.onProgress({
        current,
        total,
        proxy: proxy ? `${proxy.proxy_host}:${proxy.proxy_port}` : '',
        profileName,
        status: this.state.status
      });
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async testEngine(baseUrl, apiKey) {
    this.adsClient.updateConfig(baseUrl, apiKey);
    return await this.adsClient.checkStatus();
  }

  stop() {
    if (!this.state.running) return { ok: true };
    this.state.stopRequested = true;
    this.log('warn', 'Stop requested. Finishing current step...');
    return { ok: true };
  }

  skip() {
    if (!this.state.running) return { ok: false, error: 'No run in progress' };
    this.state.skipRequested = true;
    this.log('warn', 'Skip requested for current profile session.');
    return { ok: true };
  }

  async start(proxies, { baseUrl, apiKey }) {
    if (this.state.running) {
      return { ok: false, error: 'A run is already in progress.' };
    }

    this.adsClient.updateConfig(baseUrl, apiKey);
    const statusRes = await this.adsClient.checkStatus();
    if (!statusRes.ok) {
      return {
        ok: false,
        error: `Browser engine is offline (${statusRes.error}). Please ensure the local engine is active.`
      };
    }

    if (!Array.isArray(proxies) || proxies.length === 0) {
      return { ok: false, error: 'No valid proxies provided.' };
    }

    this.state.running = true;
    this.state.stopRequested = false;
    this.state.skipRequested = false;
    this.setStatus('running');

    const total = proxies.length;
    this.log('info', `Starting sequential run for ${total} profile(s)...`);

    // Run sequentially in background
    (async () => {
      for (let i = 0; i < total; i++) {
        if (this.state.stopRequested) {
          this.log('warn', 'Run stopped by user request.');
          break;
        }

        this.state.skipRequested = false;
        const proxy = proxies[i];
        const profileName = `HOSTRIF_${i + 1}_${Date.now().toString().slice(-6)}`;
        this.state.activeProfileName = profileName;

        const effectiveOs = proxy.os || 'windows';
        this.sendProgress(i + 1, total, proxy, profileName);
        this.log('info', `[${i + 1}/${total}] Preparing ${effectiveOs.toUpperCase()} profile: host=${proxy.proxy_host}:${proxy.proxy_port}, user=${proxy.proxy_user || '(empty)'}, pass=${proxy.proxy_password ? (proxy.proxy_password.slice(0, 8) + '...') : '(empty)'}`);

        // 1. Create profile
        this.setStatus('creating');
        const createRes = await this.adsClient.createProfile({
          name: profileName,
          proxy,
          os: effectiveOs
        });

        if (!createRes.ok || !createRes.id) {
          this.log('error', `Failed to create profile: ${createRes.error}`);
          await this.sleep(1500);
          continue;
        }

        const profileId = createRes.id;
        this.state.activeProfileId = profileId;
        this.log('success', `Created profile "${profileName}" (ID: ${profileId})`);

        if (this.state.stopRequested) {
          await this.adsClient.deleteProfile(profileId);
          break;
        }

        await this.sleep(800);

        // 2. Launch browser
        this.setStatus('launching');
        this.log('info', `Launching browser for profile ${profileId}...`);
        const launchRes = await this.adsClient.startBrowser(profileId);

        if (!launchRes.ok) {
          this.log('error', `Failed to launch browser: ${launchRes.error}`);
          await this.adsClient.deleteProfile(profileId);
          this.state.activeProfileId = null;
          await this.sleep(1500);
          continue;
        }

        this.log('info', 'Browser launched! Waiting for browser window to close...');
        this.setStatus('waiting_close');

        // Automatically trigger screen recorder on launch
        if (this.sessionHooks.onProfileLaunched) {
          try {
            await this.sessionHooks.onProfileLaunched({ profileName, profileId, proxy });
          } catch (launchHookErr) {
            console.warn('onProfileLaunched hook error:', launchHookErr.message);
          }
        }

        // 3. Poll until closed or stopped/skipped
        let isClosed = false;
        await this.sleep(2500);

        while (!isClosed) {
          if (this.state.stopRequested) {
            this.log('warn', 'Stopping current profile session...');
            await this.adsClient.stopBrowser(profileId);
            break;
          }

          if (this.state.skipRequested) {
            this.log('warn', 'Skipping current profile session...');
            await this.adsClient.stopBrowser(profileId);
            break;
          }

          const activeRes = await this.adsClient.isBrowserActive(profileId);
          if (activeRes.ok && !activeRes.active) {
            this.log('info', 'Browser closed by user.');
            isClosed = true;
            break;
          }

          await this.sleep(1500);
        }

        // Prompt confirmation: Was this lead successful or should it be discarded?
        if (this.sessionHooks.onProfileClosed) {
          try {
            const result = await this.sessionHooks.onProfileClosed({ profileName, profileId, proxy });
            if (result && result.submitted) {
              this.log('success', `Lead proof for "${profileName}" submitted for audit.`);
            } else {
              this.log('info', `Session for "${profileName}" discarded (no lead submitted).`);
            }
          } catch (closeHookErr) {
            console.warn('onProfileClosed hook error:', closeHookErr.message);
          }
        }

        // 4. Clean up disposable profile
        this.setStatus('cleaning');
        this.log('info', `Deleting disposable profile ${profileId}...`);
        const deleteRes = await this.adsClient.deleteProfile(profileId);
        if (deleteRes.ok) {
          this.log('success', `Deleted profile "${profileName}".`);
        } else {
          this.log('warn', `Could not delete profile: ${deleteRes.error}`);
        }

        this.state.activeProfileId = null;
        this.state.activeProfileName = null;

        if (this.state.stopRequested) break;

        if (i < total - 1) {
          this.log('info', 'Waiting 1.5s before opening next profile...');
          await this.sleep(1500);
        }
      }

      this.state.running = false;
      this.state.activeProfileId = null;
      const finalStatus = this.state.stopRequested ? 'stopped' : 'done';
      this.setStatus(finalStatus);
      this.sendProgress(this.state.current, total, null, '');
      this.log(finalStatus === 'done' ? 'success' : 'warn', `Sequential run finished (${finalStatus}).`);
    })();

    return { ok: true };
  }
}

module.exports = new RunnerService();
