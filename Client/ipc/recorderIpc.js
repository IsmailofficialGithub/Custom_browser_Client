'use strict';

const { BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const grpcClient = require('../grpc-client');
const { app } = require('electron');

let floatingRecorderWindow = null;

function spawnFloatingRecorder() {
  if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
    floatingRecorderWindow.show();
    floatingRecorderWindow.focus();
    return;
  }

  floatingRecorderWindow = new BrowserWindow({
    width: 280,
    height: 52,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    type: 'toolbar', // Keep floating on top of Chromium & full-screen apps on Linux
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Enforce topmost z-order across all desktop workspaces & apps
  floatingRecorderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  floatingRecorderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  floatingRecorderWindow.on('blur', () => {
    if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
      floatingRecorderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      floatingRecorderWindow.moveTop();
    }
  });

  floatingRecorderWindow.loadFile(path.join(__dirname, '..', 'src', 'floating-recorder.html'));

  floatingRecorderWindow.on('closed', () => {
    floatingRecorderWindow = null;
  });
}

function closeFloatingRecorder() {
  if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
    floatingRecorderWindow.close();
    floatingRecorderWindow = null;
  }
}

function registerRecorderIpc() {
  ipcMain.handle('recorder:spawn', () => {
    spawnFloatingRecorder();
    return { success: true };
  });

  ipcMain.handle('recorder:close', () => {
    closeFloatingRecorder();
    return { success: true };
  });

  let cachedSourceId = null;
  ipcMain.handle('recorder:get-source-id', async () => {
    if (cachedSourceId) {
      return cachedSourceId;
    }
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources && sources.length > 0) {
        cachedSourceId = sources[0].id;
        return cachedSourceId;
      }
    } catch (err) {
      console.warn('[Recorder] desktopCapturer.getSources failed:', err.message);
    }
    return null;
  });

  ipcMain.handle('recorder:upload', async (_event, { buffer, duration }) => {
    const fs = require('fs');
    const os = require('os');
    const tempFilePath = path.join(os.tmpdir(), `lead_rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.webm`);

    try {
      // Resolve current user session
      const session = grpcClient.loadSession(app.getPath('userData'));
      const userId = session?.userId || 'anonymous';

      // Write to temp file on disk to prevent RAM bloat during stream transmission
      await fs.promises.writeFile(tempFilePath, Buffer.from(buffer));

      const backendUrl = process.env.ADMIN_HTTP_URL || 'http://localhost:50052';

      // Resilient upload with retry (handles concurrent server spikes or 429 backoff)
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const form = new FormData();
          form.append('userId', userId);
          form.append('videoDuration', String(duration || 0));
          form.append('video', fs.createReadStream(tempFilePath), {
            filename: path.basename(tempFilePath),
            contentType: 'video/webm'
          });

          const res = await axios.post(`${backendUrl}/api/leads/upload`, form, {
            headers: {
              ...form.getHeaders()
            },
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024,
            timeout: 45000 // 45s safety timeout
          });

          return res.data;
        } catch (postErr) {
          lastError = postErr;
          // If server reported busy (429) or connection dropped, wait briefly before retrying
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, attempt * 1500));
          }
        }
      }

      console.error('Recorder upload exhausted retries:', lastError?.message);
      return { success: false, message: lastError?.response?.data?.message || lastError?.message || 'Upload failed' };
    } catch (err) {
      console.error('Recorder upload error:', err.message);
      return { success: false, message: err.message };
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }
    }
  });
}

function startAutoRecording(profileName) {
  spawnFloatingRecorder();
  if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
    if (floatingRecorderWindow.webContents.isLoading()) {
      floatingRecorderWindow.webContents.once('did-finish-load', () => {
        floatingRecorderWindow.webContents.send('recorder:auto-start', { profileName });
      });
    } else {
      floatingRecorderWindow.webContents.send('recorder:auto-start', { profileName });
    }
  }
}

async function handleProfileClosed(profileName, mainWindow) {
  const { dialog } = require('electron');
  const parent = (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed())
    ? floatingRecorderWindow
    : mainWindow;

  // Confirmation dialog: Only upload if lead was completed successfully
  const { response } = await dialog.showMessageBox(parent, {
    type: 'question',
    buttons: ['Submit as Lead Proof', 'Discard / Incomplete'],
    defaultId: 0,
    cancelId: 1,
    title: 'Lead Completion Confirmation',
    message: `Browser session for "${profileName}" closed.`,
    detail: 'Was this lead completed successfully?\n\n• Submit: Uploads 5 FPS proof for audit and PKR credit.\n• Discard: Deletes video proof without uploading.',
    noLink: true
  });

  const shouldSubmit = response === 0;
  if (floatingRecorderWindow && !floatingRecorderWindow.isDestroyed()) {
    floatingRecorderWindow.webContents.send('recorder:session-decision', {
      action: shouldSubmit ? 'submit' : 'discard',
      profileName
    });
  }

  return { submitted: shouldSubmit };
}

module.exports = {
  registerRecorderIpc,
  spawnFloatingRecorder,
  closeFloatingRecorder,
  startAutoRecording,
  handleProfileClosed
};
