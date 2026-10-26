'use strict';

const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

let client = null;
let currentEndpoint = process.env.GRPC_SERVER_ENDPOINT || 'localhost:50051';

function getProtoPath() {
  const localProto = path.join(__dirname, 'proto', 'hostrif.proto');
  if (fs.existsSync(localProto)) return localProto;
  const backendProto = path.join(__dirname, '..', 'Backend', 'proto', 'hostrif.proto');
  if (fs.existsSync(backendProto)) return backendProto;
  return localProto;
}

function initGrpcClient(endpoint = 'localhost:50051') {
  if (client && currentEndpoint === endpoint) return client;
  currentEndpoint = endpoint;

  const protoPath = getProtoPath();
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const hostrifProto = grpc.loadPackageDefinition(packageDefinition).hostrif;
  client = new hostrifProto.HostrifService(endpoint, grpc.credentials.createInsecure());
  return client;
}

function getClient() {
  if (!client) {
    initGrpcClient(currentEndpoint);
  }
  return client;
}

function login(email, password) {
  return new Promise((resolve, reject) => {
    getClient().Login({ email, password }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function getAssignedConfig(token) {
  return new Promise((resolve, reject) => {
    getClient().GetAssignedConfig({ token }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function getAssignedProxies(token, statusFilter = 'all') {
  return new Promise((resolve, reject) => {
    getClient().GetAssignedProxies({ token, status_filter: statusFilter }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function updateProxyStatus(token, proxyId, status, errorMessage = '') {
  return new Promise((resolve, reject) => {
    getClient().UpdateProxyStatus(
      { token, proxy_id: proxyId, status, error_message: errorMessage },
      (err, res) => {
        if (err) return reject(err);
        resolve(res);
      }
    );
  });
}

// Session persistence in userData
function getSessionFilePath(userDataPath) {
  return path.join(userDataPath || __dirname, 'session.json');
}

function loadSession(userDataPath) {
  try {
    const fPath = getSessionFilePath(userDataPath);
    if (!fs.existsSync(fPath)) return null;
    const raw = fs.readFileSync(fPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(userDataPath, sessionData) {
  try {
    const fPath = getSessionFilePath(userDataPath);
    fs.writeFileSync(fPath, JSON.stringify(sessionData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save session:', err);
    return false;
  }
}

function clearSession(userDataPath) {
  try {
    const fPath = getSessionFilePath(userDataPath);
    if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  initGrpcClient,
  login,
  getAssignedConfig,
  getAssignedProxies,
  updateProxyStatus,
  loadSession,
  saveSession,
  clearSession
};
