'use strict';

const { app, ipcMain } = require('electron');
const grpcClient = require('../grpc-client');

function getEffectiveEndpoint(endpoint) {
  if (endpoint && endpoint !== 'localhost:50051' && endpoint !== '127.0.0.1:50051') {
    return endpoint;
  }
  return process.env.GRPC_SERVER_ENDPOINT || 'api-hostrif-client.ismailabbasi.qzz.io:50051';
}

function registerBackendIpc() {
  ipcMain.handle('backend:login', async (_event, { email, password, endpoint }) => {
    try {
      const targetEndpoint = getEffectiveEndpoint(endpoint);
      grpcClient.initGrpcClient(targetEndpoint);
      const res = await grpcClient.login(email, password);
      if (res && res.success && res.token) {
        grpcClient.saveSession(app.getPath('userData'), {
          token: res.token,
          userId: res.user_id,
          email: res.email,
          endpoint: targetEndpoint,
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
      grpcClient.initGrpcClient(getEffectiveEndpoint(endpoint));
      return await grpcClient.getAssignedConfig(token);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-proxies', async (_event, { token, statusFilter, endpoint }) => {
    try {
      grpcClient.initGrpcClient(getEffectiveEndpoint(endpoint));
      return await grpcClient.getAssignedProxies(token, statusFilter || 'all');
    } catch (err) {
      return { success: false, proxies: [], message: err.message };
    }
  });

  ipcMain.handle('backend:update-proxy-status', async (_event, { token, proxyId, status, errorMessage, endpoint }) => {
    try {
      grpcClient.initGrpcClient(getEffectiveEndpoint(endpoint));
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
