'use strict';

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { parseProxyList, cleanAndFormatProxyList } = require('../proxy-parser');

function registerProxyIpc(mainWindow) {
  ipcMain.handle('proxy:format', async (_event, rawText) => {
    return cleanAndFormatProxyList(rawText);
  });

  ipcMain.handle('proxy:parse', async (_event, { text, defaultOs, defaultProto }) => {
    return parseProxyList(text, defaultOs, defaultProto);
  });

  ipcMain.handle('dialog:open-file', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Proxies File',
      properties: ['openFile'],
      filters: [
        { name: 'Text / Proxy Files', extensions: ['txt', 'json', 'csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content, fileName: path.basename(filePath) };
    } catch (err) {
      return { error: `Failed to read file: ${err.message}` };
    }
  });
}

module.exports = {
  registerProxyIpc
};
