'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(token) {
  if (!token) {
    throw new Error('Missing authentication token.');
  }
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  authenticateToken
};
