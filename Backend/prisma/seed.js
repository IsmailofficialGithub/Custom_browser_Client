'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const demoEmail = 'demo@hostrif.com';
  const demoPassword = 'Demo123!';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // Upsert superadmin user
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash, role: 'admin' },
    create: {
      email: demoEmail,
      passwordHash,
      role: 'admin'
    }
  });

  console.log(`✅ Admin ready: ${user.email} (ID: ${user.id}, Role: admin)`);

  // Upsert sample team
  const sampleTeam = await prisma.team.upsert({
    where: { code: 'alpha' },
    update: { name: 'Alpha Automation Team' },
    create: {
      name: 'Alpha Automation Team',
      code: 'alpha'
    }
  });

  // Upsert sample manager
  const managerPasswordHash = await bcrypt.hash('Manager123!', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@alpha.com' },
    update: {
      passwordHash: managerPasswordHash,
      role: 'manager',
      managedTeamId: sampleTeam.id,
      permissions: ['user.create', 'user.read', 'user.edit', 'proxy.create', 'proxy.read', 'proxy.edit']
    },
    create: {
      email: 'manager@alpha.com',
      passwordHash: managerPasswordHash,
      role: 'manager',
      managedTeamId: sampleTeam.id,
      permissions: ['user.create', 'user.read', 'user.edit', 'proxy.create', 'proxy.read', 'proxy.edit']
    }
  });

  console.log(`✅ Sample Team & Manager ready: ${manager.email} for Team '${sampleTeam.name}' (Code: ${sampleTeam.code})`);

  // Upsert AdsPower configuration
  const adsConfig = await prisma.adsPowerConfig.upsert({
    where: { userId: user.id },
    update: {
      adspowerUrl: 'http://local.adspower.net:50325',
      adspowerApiKey: ''
    },
    create: {
      userId: user.id,
      adspowerUrl: 'http://local.adspower.net:50325',
      adspowerApiKey: ''
    }
  });

  console.log(`✅ AdsPower Config ready: ${adsConfig.adspowerUrl}`);

  // Delete existing demo proxies for clean seed
  await prisma.proxy.deleteMany({ where: { userId: user.id } });

  // Seed sample OS-assigned proxies
  const sampleProxies = [
    { host: 'proxy-us1.hostrif.net', port: '1080', user: 'u_win1', pass: 'p_win1', protocol: 'socks5', os: 'windows', status: 'fresh' },
    { host: 'proxy-us2.hostrif.net', port: '1080', user: 'u_win2', pass: 'p_win2', protocol: 'socks5', os: 'windows', status: 'fresh' },
    { host: 'proxy-uk1.hostrif.net', port: '8080', user: 'u_win3', pass: 'p_win3', protocol: 'http', os: 'windows', status: 'fresh' },
    { host: 'proxy-de1.hostrif.net', port: '1080', user: 'u_mac1', pass: 'p_mac1', protocol: 'socks5', os: 'mac', status: 'fresh' },
    { host: 'proxy-de2.hostrif.net', port: '1080', user: 'u_mac2', pass: 'p_mac2', protocol: 'socks5', os: 'mac', status: 'fresh' },
    { host: 'proxy-fr1.hostrif.net', port: '8080', user: 'u_mac3', pass: 'p_mac3', protocol: 'http', os: 'mac', status: 'fresh' },
    { host: 'proxy-res1.hostrif.net', port: '1080', user: 'u_droid1', pass: 'p_droid1', protocol: 'socks5', os: 'android', status: 'fresh' },
    { host: 'proxy-res2.hostrif.net', port: '1080', user: 'u_droid2', pass: 'p_droid2', protocol: 'socks5', os: 'android', status: 'fresh' },
    { host: 'proxy-mobi1.hostrif.net', port: '1080', user: 'u_ios1', pass: 'p_ios1', protocol: 'socks5', os: 'ios', status: 'fresh' },
    { host: 'proxy-mobi2.hostrif.net', port: '8080', user: 'u_ios2', pass: 'p_ios2', protocol: 'http', os: 'ios', status: 'fresh' }
  ];

  for (const p of sampleProxies) {
    await prisma.proxy.create({
      data: {
        userId: user.id,
        host: p.host,
        port: p.port,
        user: p.user,
        pass: p.pass,
        protocol: p.protocol,
        os: p.os,
        status: p.status
      }
    });
  }

  console.log(`✅ Seeded ${sampleProxies.length} OS-assigned proxies for ${user.email}`);
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
