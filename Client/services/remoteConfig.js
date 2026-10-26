'use strict';

const https = require('https');

const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/IsmailofficialGithub/Custom_browser_Client/main/config.json';
let cachedConfig = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

function getFallbackConfig() {
  return {
    Backend_URL: process.env.BACKEND_URL || 'api-hostrif-client.ismailabbasi.qzz.io'
  };
}

async function fetchRemoteConfig() {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  return new Promise((resolve) => {
    try {
      const req = https.get(`${REMOTE_CONFIG_URL}?_t=${now}`, { timeout: 4000 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(cachedConfig || getFallbackConfig());
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.Backend_URL) {
              cachedConfig = parsed;
              lastFetchTime = Date.now();
              return resolve(parsed);
            }
          } catch (e) {}
          resolve(cachedConfig || getFallbackConfig());
        });
      });
      req.on('error', () => resolve(cachedConfig || getFallbackConfig()));
      req.on('timeout', () => {
        req.destroy();
        resolve(cachedConfig || getFallbackConfig());
      });
    } catch {
      resolve(cachedConfig || getFallbackConfig());
    }
  });
}

async function getBackendEndpoints() {
  const conf = await fetchRemoteConfig();
  let rawUrl = (conf && conf.Backend_URL) ? conf.Backend_URL.trim() : 'api-hostrif-client.ismailabbasi.qzz.io';

  // Strip protocol and trailing slashes
  let cleanHost = rawUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let port = null;

  if (cleanHost.includes(':')) {
    const parts = cleanHost.split(':');
    cleanHost = parts[0];
    port = parts[1];
  }

  const isLocal = cleanHost === 'localhost' || cleanHost === '127.0.0.1';
  const protocol = isLocal ? 'http' : 'https';

  const grpcEndpoint = port ? `${cleanHost}:${port}` : `${cleanHost}:50051`;
  const restUrl = isLocal ? `${protocol}://${cleanHost}:50052` : `${protocol}://${cleanHost}`;

  return {
    grpcEndpoint,
    restUrl,
    host: cleanHost
  };
}

module.exports = {
  fetchRemoteConfig,
  getBackendEndpoints
};
