'use strict';

const { app, ipcMain } = require('electron');
const grpcClient = require('../grpc-client');
const { getBackendEndpoints } = require('../services/remoteConfig');

async function getEffectiveEndpoint(endpoint) {
  if (endpoint && endpoint !== 'localhost:50051' && endpoint !== '127.0.0.1:50051') {
    return endpoint;
  }
  const endpoints = await getBackendEndpoints();
  return endpoints.grpcEndpoint;
}

function registerBackendIpc() {
  ipcMain.handle('backend:login', async (_event, { email, password, endpoint, rememberMe }) => {
    try {
      const targetEndpoint = await getEffectiveEndpoint(endpoint);
      grpcClient.initGrpcClient(targetEndpoint);
      const res = await grpcClient.login(email, password);
      if (res && res.success && res.token) {
        if (rememberMe !== false) {
          grpcClient.saveSession(app.getPath('userData'), {
            token: res.token,
            userId: res.user_id,
            email: res.email,
            endpoint: targetEndpoint,
            savedAt: Date.now()
          });
        } else {
          grpcClient.clearSession(app.getPath('userData'));
        }
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
      const targetEndpoint = await getEffectiveEndpoint(endpoint);
      grpcClient.initGrpcClient(targetEndpoint);
      return await grpcClient.getAssignedConfig(token);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-proxies', async (_event, { token, statusFilter, endpoint }) => {
    try {
      const targetEndpoint = await getEffectiveEndpoint(endpoint);
      grpcClient.initGrpcClient(targetEndpoint);
      return await grpcClient.getAssignedProxies(token, statusFilter || 'all');
    } catch (err) {
      return { success: false, proxies: [], message: err.message };
    }
  });

  ipcMain.handle('backend:update-proxy-status', async (_event, { token, proxyId, status, errorMessage, endpoint }) => {
    try {
      const targetEndpoint = await getEffectiveEndpoint(endpoint);
      grpcClient.initGrpcClient(targetEndpoint);
      return await grpcClient.updateProxyStatus(token, proxyId, status, errorMessage || '');
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backend:get-operator-earnings', async (_event, { token, month, page, limit }) => {
    const axios = require('axios');
    const endpoints = await getBackendEndpoints();
    const backendUrl = endpoints.restUrl;
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
