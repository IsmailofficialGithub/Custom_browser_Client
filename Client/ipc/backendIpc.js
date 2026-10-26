'use strict';

const { app, ipcMain } = require('electron');
const grpcClient = require('../grpc-client');

function registerBackendIpc() {
  ipcMain.handle('backend:login', async (_event, { email, password, endpoint }) => {
    try {
      if (endpoint) grpcClient.initGrpcClient(endpoint);
      const res = await grpcClient.login(email, password);
      if (res && res.success && res.token) {
        grpcClient.saveSession(app.getPath('userData'), {
          token: res.token,
          userId: res.user_id,
          email: res.email,
          endpoint: endpoint || 'localhost:50051',
          savedAt: Date.now()
        });
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-session', async () => {
    return grpcClient.loadSession(app.getPath('userData'));
  });

  ipcMain.handle('backend:logout', async () => {
    return grpcClient.clearSession(app.getPath('userData'));
  });

  ipcMain.handle('backend:get-config', async (_event, { token, endpoint }) => {
    try {
      if (endpoint) grpcClient.initGrpcClient(endpoint);
      return await grpcClient.getAssignedConfig(token);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-proxies', async (_event, { token, statusFilter, endpoint }) => {
    try {
      if (endpoint) grpcClient.initGrpcClient(endpoint);
      return await grpcClient.getAssignedProxies(token, statusFilter || 'all');
    } catch (err) {
      return { success: false, proxies: [], message: err.message };
    }
  });

  ipcMain.handle('backend:update-proxy-status', async (_event, { token, proxyId, status, errorMessage, endpoint }) => {
    try {
      if (endpoint) grpcClient.initGrpcClient(endpoint);
      return await grpcClient.updateProxyStatus(token, proxyId, status, errorMessage || '');
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-operator-earnings', async (_event, { token, month, page, limit }) => {
    const axios = require('axios');
    const backendUrl = process.env.ADMIN_HTTP_URL || 'http://localhost:50052';
    try {
      const res = await axios.get(`${backendUrl}/api/operator/earnings`, {
        params: { month, page, limit },
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 10000
      });
      return res.data;
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || err.message
      };
    }
  });
}

module.exports = {
  registerBackendIpc
};
