'use strict';

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const protoPath = path.join(__dirname, '..', 'proto', 'hostrif.proto');
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const hostrifProto = grpc.loadPackageDefinition(packageDefinition).hostrif;
const client = new hostrifProto.HostrifService('localhost:50051', grpc.credentials.createInsecure());

function login(email, password) {
  return new Promise((resolve, reject) => {
    client.Login({ email, password }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function getConfig(token) {
  return new Promise((resolve, reject) => {
    client.GetAssignedConfig({ token }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function getProxies(token, status_filter = 'all') {
  return new Promise((resolve, reject) => {
    client.GetAssignedProxies({ token, status_filter }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function updateProxyStatus(token, proxy_id, status, error_message = '') {
  return new Promise((resolve, reject) => {
    client.UpdateProxyStatus({ token, proxy_id, status, error_message }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

async function runTests() {
  console.log('🧪 Starting gRPC integration test...');

  try {
    // 1. Test Login
    console.log('1. Testing Login...');
    const loginRes = await login('demo@hostrif.com', 'Demo123!');
    console.log('Login result:', loginRes);
    if (!loginRes.success) throw new Error('Login failed: ' + loginRes.message);

    const token = loginRes.token;

    // 2. Test GetAssignedConfig
    console.log('\n2. Testing GetAssignedConfig...');
    const configRes = await getConfig(token);
    console.log('Config result:', configRes);
    if (!configRes.success) throw new Error('GetAssignedConfig failed: ' + configRes.message);

    // 3. Test GetAssignedProxies
    console.log('\n3. Testing GetAssignedProxies...');
    const proxiesRes = await getProxies(token, 'all');
    console.log(`Found ${proxiesRes.proxies.length} proxies.`);
    if (!proxiesRes.success) throw new Error('GetAssignedProxies failed: ' + proxiesRes.message);

    if (proxiesRes.proxies.length > 0) {
      const sample = proxiesRes.proxies[0];
      console.log('First proxy item:', sample);

      // 4. Test UpdateProxyStatus
      console.log(`\n4. Testing UpdateProxyStatus on proxy ${sample.id}...`);
      const updateRes = await updateProxyStatus(token, sample.id, 'used');
      console.log('Update result:', updateRes);
      if (!updateRes.success) throw new Error('UpdateProxyStatus failed: ' + updateRes.message);
    }

    console.log('\n🎉 ALL gRPC TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTests();
