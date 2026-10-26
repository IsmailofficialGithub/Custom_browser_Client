import { appendLog } from './notifications.js';
import { now } from './utils.js';

export async function checkEngineStatus(notifyInLog = false) {
  const statusDot = document.getElementById('statusDot');
  const statusTitle = document.getElementById('statusTitle');
  const statusEndpoint = document.getElementById('statusEndpoint');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const testFeedback = document.getElementById('testFeedback');

  if (!statusDot || !statusTitle) return;

  statusDot.className = 'status-dot connecting';
  statusTitle.textContent = 'Connecting...';

  let baseUrl = (apiUrlInput ? apiUrlInput.value.trim() : '') || localStorage.getItem('hostrif_api_url') || 'http://127.0.0.1:50325';
  if (baseUrl.includes(':50425')) {
    baseUrl = baseUrl.replace(':50425', ':50325');
    if (apiUrlInput) apiUrlInput.value = baseUrl;
    localStorage.setItem('hostrif_api_url', baseUrl);
  }
  const apiKey = (apiKeyInput ? apiKeyInput.value.trim() : '') || localStorage.getItem('hostrif_api_key') || '';

  if (statusEndpoint) statusEndpoint.textContent = baseUrl.replace(/^https?:\/\//, '');

  try {
    const res = await window.api.testEngine(baseUrl, apiKey);
    if (res && res.ok) {
      statusDot.className = 'status-dot online';
      statusTitle.textContent = 'Engine Active';

      if (testFeedback) {
        testFeedback.textContent = 'Successfully connected to browser engine.';
        testFeedback.className = 'test-feedback success';
      }

      if (notifyInLog) {
        appendLog({
          timestamp: now(),
          level: 'success',
          message: `Browser engine online at ${baseUrl} (Active profiles: ${res.activeProfiles ?? 0})`
        });
      }
    } else {
      statusDot.className = 'status-dot offline';
      statusTitle.textContent = 'Engine Offline';

      if (testFeedback) {
        testFeedback.textContent = `Offline: ${res ? res.error : 'Connection refused'}`;
        testFeedback.className = 'test-feedback error';
      }

      if (notifyInLog) {
        appendLog({
          timestamp: now(),
          level: 'warn',
          message: `Browser engine offline at ${baseUrl} (${res ? res.error : 'Connection refused'})`
        });
      }
    }
  } catch (err) {
    statusDot.className = 'status-dot offline';
    statusTitle.textContent = 'Engine Offline';

    if (testFeedback) {
      testFeedback.textContent = `Offline: ${err.message}`;
      testFeedback.className = 'test-feedback error';
    }

    if (notifyInLog) {
      appendLog({
        timestamp: now(),
        level: 'error',
        message: `Engine connection error: ${err.message}`
      });
    }
  }
}

export function initEngineStatusListeners() {
  const refreshStatusBtn = document.getElementById('refreshStatusBtn');
  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener('click', () => checkEngineStatus(true));
  }

  const testConnectionBtn = document.getElementById('testConnectionBtn');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', () => checkEngineStatus(true));
  }

  const apiUrlInput = document.getElementById('apiUrlInput');
  if (apiUrlInput) {
    apiUrlInput.addEventListener('change', () => {
      localStorage.setItem('hostrif_api_url', apiUrlInput.value.trim());
      checkEngineStatus(false);
    });
  }

  const apiKeyInput = document.getElementById('apiKeyInput');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('change', () => {
      localStorage.setItem('hostrif_api_key', apiKeyInput.value.trim());
    });
  }
}
