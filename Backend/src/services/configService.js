'use strict';

const prisma = require('../db/prisma');
const config = require('../config');

async function getUserAdsPowerConfig(userId) {
  let userConfig = await prisma.adsPowerConfig.findUnique({
    where: { userId }
  });

  if (!userConfig) {
    userConfig = await prisma.adsPowerConfig.create({
      data: {
        userId,
        adspowerUrl: config.defaultAdsPowerUrl,
        adspowerApiKey: ''
      }
    });
  }

  return {
    success: true,
    adspowerUrl: userConfig.adspowerUrl || config.defaultAdsPowerUrl,
    adspowerApiKey: userConfig.adspowerApiKey || '',
    message: 'Configuration retrieved successfully.'
  };
}

module.exports = {
  getUserAdsPowerConfig
};
