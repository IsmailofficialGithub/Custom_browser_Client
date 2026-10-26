import { state } from './state.js';
import { renderIcons } from './icons.js';

const TAB_TITLES = {
  runner: 'Sequential Runner',
  proxies: 'Proxy Management',
  earnings: 'My Earnings & Approved Leads',
  settings: 'Settings'
};

export function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');
  const pageTitle = document.getElementById('pageTitle');

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      if (!targetTab || targetTab === state.currentTab) return;

      navItems.forEach((item) => item.classList.remove('active'));
      tabViews.forEach((view) => view.classList.remove('active'));

      btn.classList.add('active');
      const targetView = document.getElementById(`tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
      if (targetView) targetView.classList.add('active');

      state.currentTab = targetTab;
      if (pageTitle) pageTitle.textContent = TAB_TITLES[targetTab] || 'HOSTRIF Client';
      renderIcons();

      window.dispatchEvent(new CustomEvent('tab-changed', { detail: { tab: targetTab } }));
    });
  });
}
