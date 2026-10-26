'use strict';

const fs = require('fs');
const path = require('path');

// Load Client/.env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
}

const { app, BrowserWindow } = require('electron');

// Enable PipeWire capturer on Linux Wayland environments and auto-select desktop capture without prompts
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('auto-select-desktop-capture-source', 'Entire screen');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
const { registerRunnerIpc } = require('./ipc/runnerIpc');
const { registerProxyIpc } = require('./ipc/proxyIpc');
const { registerBackendIpc } = require('./ipc/backendIpc');
const { registerRecorderIpc } = require('./ipc/recorderIpc');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: 'HOSTRIF Client',
    backgroundColor: '#030510',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register window-dependent IPC handlers
  registerRunnerIpc(mainWindow);
  registerProxyIpc(mainWindow);
}

app.whenReady().then(() => {
  createWindow();
  registerBackendIpc();
  registerRecorderIpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
