'use strict';

const { authenticateToken } = require('../middleware/auth');
const { loginUser } = require('../services/authService');
const { getUserAdsPowerConfig } = require('../services/configService');
const { getUserAssignedProxies, updateProxyLifecycle } = require('../services/proxyService');

async function handleLogin(call, callback) {
  try {
    const { email, password } = call.request;
    const result = await loginUser(email, password);
    return callback(null, {
      success: result.success,
      token: result.token,
      message: result.message,
      user_id: result.userId || '',
      email: result.email || ''
    });
  } catch (err) {
    console.error('[gRPC Handler] Login error:', err);
    return callback(null, {
      success: false,
      token: '',
      message: `Login error: ${err.message}`,
      user_id: '',
      email: ''
    });
  }
}

async function handleGetAssignedConfig(call, callback) {
  try {
    const decoded = authenticateToken(call.request.token);
    const result = await getUserAdsPowerConfig(decoded.userId);
    return callback(null, {
      success: result.success,
      adspower_url: result.adspowerUrl,
      adspower_api_key: result.adspowerApiKey,
      message: result.message
    });
  } catch (err) {
    console.error('[gRPC Handler] GetAssignedConfig error:', err);
    return callback(null, {
      success: false,
      adspower_url: '',
      adspower_api_key: '',
      message: err.message
    });
  }
}

async function handleGetAssignedProxies(call, callback) {
  try {
    const { token, status_filter } = call.request;
    const decoded = authenticateToken(token);
    const result = await getUserAssignedProxies(decoded.userId, status_filter);
    return callback(null, {
      success: result.success,
      proxies: result.proxies,
      message: result.message
    });
  } catch (err) {
    console.error('[gRPC Handler] GetAssignedProxies error:', err);
    return callback(null, {
      success: false,
      proxies: [],
      message: err.message
    });
  }
}

async function handleUpdateProxyStatus(call, callback) {
  try {
    const { token, proxy_id, status, error_message } = call.request;
    const decoded = authenticateToken(token);
    const result = await updateProxyLifecycle(decoded.userId, proxy_id, status, error_message);
    return callback(null, {
      success: result.success,
      message: result.message
    });
  } catch (err) {
    console.error('[gRPC Handler] UpdateProxyStatus error:', err);
    return callback(null, {
      success: false,
      message: err.message
    });
  }
}

module.exports = {
  Login: handleLogin,
  GetAssignedConfig: handleGetAssignedConfig,
  GetAssignedProxies: handleGetAssignedProxies,
  UpdateProxyStatus: handleUpdateProxyStatus
};
