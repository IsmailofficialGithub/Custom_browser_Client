'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'hostrif-super-secret-jwt-key-2026',
  jwtExpiresIn: '30d',
  grpcHost: process.env.GRPC_HOST || '0.0.0.0',
  grpcPort: process.env.GRPC_PORT || '50051',
  adminHttpPort: process.env.ADMIN_HTTP_PORT || '50052',
  defaultAdsPowerUrl: 'http://local.adspower.net:50325'
};
