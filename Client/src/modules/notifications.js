import { now } from './utils.js';
import { renderIcons } from './icons.js';

let promptTimeout = null;

export function showPromptBanner(message, type = 'info') {
  const banner = document.getElementById('proxyPromptBanner');
  const text = document.getElementById('promptText');
  const icon = document.getElementById('promptIcon');
  if (!banner || !text || !icon) return;

  banner.className = `prompt-banner ${type}`;
  text.textContent = message;

  if (type === 'success') {
    icon.setAttribute('data-lucide', 'check-circle');
  } else if (type === 'warning') {
    icon.setAttribute('data-lucide', 'alert-circle');
  } else if (type === 'danger') {
    icon.setAttribute('data-lucide', 'alert-triangle');
  } else {
    icon.setAttribute('data-lucide', 'info');
  }

  banner.classList.remove('hidden');
  renderIcons();

  if (promptTimeout) clearTimeout(promptTimeout);
  promptTimeout = setTimeout(() => {
    banner.classList.add('hidden');
  }, 6000);
}

export function appendLog({ timestamp, level = 'info', message }) {
  const terminal = document.getElementById('logTerminal');
  if (!terminal) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = timestamp || now();

  const tagSpan = document.createElement('span');
  tagSpan.className = `tag tag-${level}`;
  tagSpan.textContent = level.toUpperCase();

  const msgSpan = document.createElement('span');
  msgSpan.className = 'msg';
  msgSpan.textContent = message;

  entry.appendChild(timeSpan);
  entry.appendChild(tagSpan);
  entry.appendChild(msgSpan);

  terminal.appendChild(entry);
  terminal.scrollTop = terminal.scrollHeight;
}

export function initNotificationListeners() {
  const promptCloseBtn = document.getElementById('promptCloseBtn');
  if (promptCloseBtn) {
    promptCloseBtn.addEventListener('click', () => {
      const banner = document.getElementById('proxyPromptBanner');
      if (banner) banner.classList.add('hidden');
      if (promptTimeout) clearTimeout(promptTimeout);
    });
  }

  const clearLogBtn = document.getElementById('clearLogBtn');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      const terminal = document.getElementById('logTerminal');
      if (terminal) terminal.innerHTML = '';
    });
  }
}
