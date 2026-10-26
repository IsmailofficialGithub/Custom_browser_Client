export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function now() {
  return new Date().toLocaleTimeString();
}

export function formatTime(secs) {
  const s = Math.max(0, parseInt(secs, 10) || 0);
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const rem = (s % 60).toString().padStart(2, '0');
  return `${m}:${rem}`;
}
