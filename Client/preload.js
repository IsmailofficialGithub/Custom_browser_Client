'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  testEngine: async (baseUrl, apiKey) => {
    try {
      return await ipcRenderer.invoke('runner:test-engine', { baseUrl, apiKey });
    } catch (err) {
      return await ipcRenderer.invoke('runner:test-adspower', { baseUrl, apiKey });
    }
  },
  testAdsPower: (baseUrl, apiKey) => ipcRenderer.invoke('runner:test-engine', { baseUrl, apiKey }),
  formatProxies: (text) => ipcRenderer.invoke('proxy:format', text),
  parseProxies: (text, defaultOs, defaultProto) => ipcRenderer.invoke('proxy:parse', { text, defaultOs, defaultProto }),
  startSequential: (options) => ipcRenderer.invoke('runner:start', options),
  stopSequential: () => ipcRenderer.invoke('runner:stop'),
  skipCurrent: () => ipcRenderer.invoke('runner:skip'),
  openProxyFile: () => ipcRenderer.invoke('dialog:open-file'),

  // Backend gRPC API
  login: (email, password, endpoint, rememberMe) => ipcRenderer.invoke('backend:login', { email, password, endpoint, rememberMe }),
  getSession: () => ipcRenderer.invoke('backend:get-session'),
  logout: () => ipcRenderer.invoke('backend:logout'),
  fetchAssignedConfig: (token, endpoint) => ipcRenderer.invoke('backend:get-config', { token, endpoint }),
  fetchAssignedProxies: (token, statusFilter, endpoint) => ipcRenderer.invoke('backend:get-proxies', { token, statusFilter, endpoint }),
  updateProxyStatus: (token, proxyId, status, errorMessage, endpoint) => ipcRenderer.invoke('backend:update-proxy-status', { token, proxyId, status, errorMessage, endpoint }),
  fetchOperatorEarnings: (token, options) => ipcRenderer.invoke('backend:get-operator-earnings', { token, ...options }),

  // Screen Recorder & Floating Widget
  spawnFloatingRecorder: () => ipcRenderer.invoke('recorder:spawn'),
  closeFloatingRecorder: () => ipcRenderer.invoke('recorder:close'),
  getPrimaryScreenSourceId: () => ipcRenderer.invoke('recorder:get-source-id'),
  uploadLeadRecording: (data) => ipcRenderer.invoke('recorder:upload', data),

  onAutoStartRecording: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('recorder:auto-start', handler);
    return () => ipcRenderer.removeListener('recorder:auto-start', handler);
  },
  onSessionDecision: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('recorder:session-decision', handler);
    return () => ipcRenderer.removeListener('recorder:session-decision', handler);
  },

  onLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('runner:log', handler);
    return () => ipcRenderer.removeListener('runner:log', handler);
  },
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('runner:progress', handler);
    return () => ipcRenderer.removeListener('runner:progress', handler);
  },
  onStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('runner:status', handler);
    return () => ipcRenderer.removeListener('runner:status', handler);
  }
});
