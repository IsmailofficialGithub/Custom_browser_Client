'use strict';

const prisma = require('../db/prisma');
const { generateEvomiProxies } = require('./evomiService');

async function getUserAssignedProxies(userId, statusFilter = 'all') {
  // If requesting fresh or all proxies, check if Evomi auto-generation is enabled
  if (!statusFilter || statusFilter === 'all' || statusFilter === 'fresh') {
    try {
      const evomiConfig = await prisma.evomiConfig.findUnique({
        where: { userId }
      });

      // Retire proxies made by the old generator, which used the Evomi API key as the
      // proxy username — Evomi rejects those ("Socks5 proxy rejected connection").
      const apiKey = evomiConfig && evomiConfig.apiKey ? evomiConfig.apiKey.trim() : '';
      if (apiKey && !apiKey.includes(':')) {
        const retired = await prisma.proxy.updateMany({
          where: { userId, status: 'fresh', user: apiKey },
          data: { status: 'failed', errorMessage: 'Invalid Evomi credentials (API key used as proxy login) — regenerated' }
        });
        if (retired.count) console.log(`[Evomi AutoGen] Retired ${retired.count} proxies with invalid credentials for user ${userId}`);
      }

      const freshCount = await prisma.proxy.count({
        where: { userId, status: 'fresh' }
      });

      if (freshCount < 10) {
        if (evomiConfig && evomiConfig.enabled && evomiConfig.apiKey) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { memberTeamId: true }
          });

          const needed = (evomiConfig.batchSize || 10) - freshCount;
          if (needed > 0) {
            const newProxies = await generateEvomiProxies(
              evomiConfig,
              userId,
              user?.memberTeamId || null,
              needed
            );
            if (newProxies.length > 0) {
              await prisma.proxy.createMany({ data: newProxies });
            }
          }
        }
      }
    } catch (evomiErr) {
      console.error('[Evomi AutoGen] Error checking/generating proxies:', evomiErr.message);
    }
  }

  const where = { userId };
  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter.toLowerCase().trim();
  }

  const dbProxies = await prisma.proxy.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  const proxies = dbProxies.map((p) => ({
    id: p.id,
    host: p.host,
    port: String(p.port),
    user: p.user || '',
    pass: p.pass || '',
    protocol: p.protocol || 'socks5',
    os: p.os || 'windows',
    status: p.status || 'fresh',
    last_used_at: p.lastUsedAt ? p.lastUsedAt.toISOString() : ''
  }));

  return {
    success: true,
    proxies,
    message: `Retrieved ${proxies.length} assigned proxies.`
  };
}

async function updateProxyLifecycle(userId, proxyId, status, errorMessage = '') {
  if (!proxyId) {
    return {
      success: false,
      message: 'proxy_id is required.'
    };
  }

  const validStatus = ['fresh', 'used', 'failed'].includes(status) ? status : 'used';

  await prisma.proxy.updateMany({
    where: {
      id: proxyId,
      userId
    },
    data: {
      status: validStatus,
      errorMessage: errorMessage || null,
      lastUsedAt: new Date()
    }
  });

  return {
    success: true,
    message: `Proxy ${proxyId} marked as ${validStatus}.`
  };
}

module.exports = {
  getUserAssignedProxies,
  updateProxyLifecycle
};
