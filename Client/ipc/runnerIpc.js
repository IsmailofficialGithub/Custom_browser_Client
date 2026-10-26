'use strict';

const { ipcMain } = require('electron');
const runnerService = require('../services/runnerService');
const { parseProxyList } = require('../proxy-parser');
const { startAutoRecording, handleProfileClosed } = require('./recorderIpc');

function registerRunnerIpc(mainWindow) {
  runnerService.setListeners({
    onLog: (item) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:log', item);
      }
    },
    onStatus: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:status', status);
      }
    },
    onProgress: (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runner:progress', progress);
      }
    }
  });

  runnerService.setSessionHooks({
    onProfileLaunched: async ({ profileName }) => {
      startAutoRecording(profileName);
    },
    onProfileClosed: async ({ profileName }) => {
      return await handleProfileClosed(profileName, mainWindow);
    }
  });

  ipcMain.handle('runner:test-engine', async (_event, { baseUrl, apiKey }) => {
    return await runnerService.testEngine(baseUrl, apiKey);
  });

  ipcMain.handle('runner:test-adspower', async (_event, { baseUrl, apiKey }) => {
    return await runnerService.testEngine(baseUrl, apiKey);
  });

  ipcMain.handle('runner:start', async (_event, { proxies: inputProxies, proxiesText, defaultOs, defaultProto, baseUrl, apiKey }) => {
    let proxies = [];
    if (Array.isArray(inputProxies) && inputProxies.length > 0) {
      proxies = inputProxies;
    } else if (proxiesText) {
      proxies = parseProxyList(proxiesText, defaultOs, defaultProto);
    }

    if (proxies.length === 0) {
      return { ok: false, error: 'No valid proxies found to run.' };
    }

    return await runnerService.start(proxies, { baseUrl, apiKey });
  });

  ipcMain.handle('runner:stop', async () => {
    return runnerService.stop();
  });

  ipcMain.handle('runner:skip', async () => {
    return runnerService.skip();
  });
}

module.exports = {
  registerRunnerIpc
};
