import { loadSavedProxies } from './modules/state.js';
import { renderIcons } from './modules/icons.js';
import { initNav } from './modules/nav.js';
import { initNotificationListeners } from './modules/notifications.js';
import { checkEngineStatus, initEngineStatusListeners } from './modules/engineStatus.js';
import { renderProxyTable, initProxyTableListeners } from './modules/proxyTable.js';
import { initProxyInputListeners } from './modules/proxyInput.js';
import { initAuthAndSession, initAuthListeners } from './modules/authUi.js';
import { initRunnerUi } from './modules/runnerUi.js';
import { initEarningsUi } from './modules/earningsUi.js';

function bootstrapApp() {
  // Load cached proxies and render icons
  loadSavedProxies();
  renderIcons();

  // Initialize modular controllers
  initNav();
  initNotificationListeners();
  initEngineStatusListeners();
  initProxyTableListeners();
  initProxyInputListeners();
  initAuthListeners();
  initRunnerUi();
  initEarningsUi();

  // Load Settings from localStorage
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const savedUrl = localStorage.getItem('hostrif_api_url') || 'http://127.0.0.1:50325';
  const effectiveUrl = savedUrl.includes(':50425') ? savedUrl.replace(':50425', ':50325') : savedUrl;
  localStorage.setItem('hostrif_api_url', effectiveUrl);
  if (apiUrlInput) apiUrlInput.value = effectiveUrl;
  if (apiKeyInput && savedKey) apiKeyInput.value = savedKey;

  // Render initial views
  renderProxyTable();
  checkEngineStatus(false);
  initAuthAndSession();
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
