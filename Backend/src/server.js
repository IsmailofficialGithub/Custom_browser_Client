'use strict';

const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('./config');
const prisma = require('./db/prisma');
const handlers = require('./handlers');

function createGrpcServer() {
  const protoPath = path.join(__dirname, '..', 'proto', 'hostrif.proto');
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const hostrifProto = grpc.loadPackageDefinition(packageDefinition).hostrif;
  const server = new grpc.Server();

  server.addService(hostrifProto.HostrifService.service, handlers);
  return server;
}

const adminApp = require('./adminApp');

function start() {
  const server = createGrpcServer();
  const bindAddress = `${config.grpcHost}:${config.grpcPort}`;

  server.bindAsync(
    bindAddress,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('❌ Failed to bind gRPC server:', err);
        process.exit(1);
      }
      console.log(`🚀 HOSTRIF gRPC Server running at ${bindAddress} (port ${port})`);

      prisma.$connect()
        .then(() => console.log('✅ PostgreSQL database connected successfully.'))
        .catch((dbErr) => console.warn('⚠️ PostgreSQL connection pending/offline:', dbErr.message));
    }
  );

  // Start Admin REST API server
  const adminPort = config.adminHttpPort;
  adminApp.listen(adminPort, () => {
    console.log(`🌐 HOSTRIF Admin REST API running at http://0.0.0.0:${adminPort}`);
  });
}

start();
