'use strict';

const express = require('express');
const cors = require('cors');
const prisma = require('./db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Auth & RBAC Middleware ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { userId, email, role, managedTeamId, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    // Admin has universal superuser access
    if (req.user.role === 'admin') return next();

    // Manager must possess the specific granular permission
    if (req.user.role === 'manager') {
      const perms = req.user.permissions || [];
      if (perms.includes(action)) return next();
      return res.status(403).json({
        success: false,
        message: `Forbidden: Missing required permission [${action}].`
      });
    }

    return res.status(403).json({ success: false, message: 'Forbidden.' });
  };
}

// ── 1. Auth Routes (Admin & Manager) ────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password, teamCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { managedTeam: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Role-based validation
    if (user.role === 'user') {
      return res.status(403).json({ success: false, message: 'Operators must sign in through the desktop client.' });
    }

    if (user.role === 'manager') {
      if (!teamCode) {
        return res.status(400).json({ success: false, message: 'Team ID/Code is required for Manager login.' });
      }
      if (!user.managedTeam || user.managedTeam.code.toLowerCase() !== teamCode.trim().toLowerCase()) {
        return res.status(403).json({ success: false, message: 'Invalid Team Code for this manager account.' });
      }
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      managedTeamId: user.managedTeamId || null,
      teamCode: user.managedTeam?.code || null,
      teamName: user.managedTeam?.name || null,
      permissions: user.permissions || []
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    return res.json({
      success: true,
      token,
      user: tokenPayload
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/me', requireAuth, async (req, res) => {
  return res.json({ success: true, user: req.user });
});

// ── 2. Team Management Routes (Admin Only) ──────────────────────────────────
app.get('/api/admin/teams', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'manager' && req.user.managedTeamId) {
      where.id = req.user.managedTeamId;
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        managers: { select: { id: true, email: true, permissions: true } },
        _count: {
          select: { members: true, proxies: true }
        }
      }
    });

    return res.json({ success: true, teams });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/teams', requireAuth, requirePermission('team.create'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Team name and code are required.' });
    }

    const cleanCode = code.trim().toLowerCase();
    const existing = await prisma.team.findFirst({
      where: { OR: [{ name: name.trim() }, { code: cleanCode }] }
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Team name or code already exists.' });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        code: cleanCode
      }
    });

    return res.status(201).json({ success: true, team });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/teams/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'manager' && req.user.managedTeamId !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        managers: { select: { id: true, email: true, permissions: true, createdAt: true } },
        members: { select: { id: true, email: true, createdAt: true, _count: { select: { proxies: true } } } },
        proxies: { select: { id: true, host: true, port: true, protocol: true, os: true, status: true, userId: true } }
      }
    });

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });
    return res.json({ success: true, team });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/teams/:id', requireAuth, requirePermission('team.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (code) {
      const cleanCode = code.trim().toLowerCase();
      const existing = await prisma.team.findFirst({
        where: { code: cleanCode, NOT: { id } }
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Team code is already in use.' });
      }
      data.code = cleanCode;
    }

    const updated = await prisma.team.update({
      where: { id },
      data
    });

    return res.json({ success: true, team: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/teams/:id', requireAuth, requirePermission('team.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.team.delete({ where: { id } });
    return res.json({ success: true, message: 'Team deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 3. KPI Metrics & Stats Route ──────────────────────────────────────────
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  try {
    const isManager = req.user.role === 'manager';
    const userWhere = isManager ? { memberTeamId: req.user.managedTeamId } : {};
    const proxyWhere = isManager ? { teamId: req.user.managedTeamId } : {};

    const [userCount, proxies, configs] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.proxy.findMany({ where: proxyWhere, select: { status: true, os: true, protocol: true } }),
      prisma.adsPowerConfig.findMany({ select: { adspowerUrl: true } })
    ]);

    const statusCounts = { fresh: 0, in_use: 0, used: 0, failed: 0 };
    const osCounts = { windows: 0, mac: 0, android: 0, ios: 0 };
    const protocolCounts = { socks5: 0, http: 0 };

    for (const p of proxies) {
      const s = p.status || 'fresh';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      const o = (p.os || 'windows').toLowerCase();
      if (osCounts[o] !== undefined) osCounts[o]++;
      const pr = (p.protocol || 'socks5').toLowerCase();
      if (protocolCounts[pr] !== undefined) protocolCounts[pr]++;
    }

    return res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalProxies: proxies.length,
        proxiesByStatus: statusCounts,
        proxiesByOs: osCounts,
        proxiesByProtocol: protocolCounts,
        activeAdsPowerConfigs: configs.filter((c) => !!c.adspowerUrl).length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4. User Management Routes ─────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requirePermission('user.read'), async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'manager') {
      where.memberTeamId = req.user.managedTeamId;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        adsPowerConfig: true,
        evomiConfig: true,
        managedTeam: true,
        memberTeam: true,
        _count: {
          select: { proxies: true }
        }
      }
    });

    const safeUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      permissions: u.permissions,
      managedTeam: u.managedTeam ? { id: u.managedTeam.id, name: u.managedTeam.name, code: u.managedTeam.code } : null,
      memberTeam: u.memberTeam ? { id: u.memberTeam.id, name: u.memberTeam.name, code: u.memberTeam.code } : null,
      createdAt: u.createdAt,
      proxyCount: u._count.proxies,
      adsPowerUrl: u.adsPowerConfig?.adspowerUrl || '',
      adsPowerApiKey: u.adsPowerConfig?.adspowerApiKey || '',
      evomiConfig: u.evomiConfig
        ? {
            enabled: u.evomiConfig.enabled,
            apiKey: u.evomiConfig.apiKey,
            country: u.evomiConfig.country,
            protocol: u.evomiConfig.protocol,
            osDistribution: u.evomiConfig.osDistribution,
            batchSize: u.evomiConfig.batchSize
          }
        : null
    }));

    return res.json({ success: true, users: safeUsers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Evomi Settings for User
app.put('/api/admin/users/:id/evomi', requireAuth, requirePermission('user.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, apiKey, country, protocol, osDistribution, batchSize } = req.body;

    if (req.user.role === 'manager') {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.memberTeamId !== req.user.managedTeamId) {
        return res.status(403).json({ success: false, message: 'Forbidden: User not in your team.' });
      }
    }

    const saved = await prisma.evomiConfig.upsert({
      where: { userId: id },
      create: {
        userId: id,
        enabled: Boolean(enabled),
        apiKey: apiKey ? String(apiKey).trim() : '',
        country: country ? String(country).trim().toLowerCase() : 'all',
        protocol: protocol === 'socks5' ? 'socks5' : 'http',
        osDistribution: osDistribution || { windows: 50, mac: 30, ios: 20, android: 0 },
        batchSize: Number(batchSize) || 10
      },
      update: {
        enabled: Boolean(enabled),
        ...(apiKey !== undefined && { apiKey: String(apiKey).trim() }),
        ...(country !== undefined && { country: String(country).trim().toLowerCase() }),
        ...(protocol !== undefined && { protocol: protocol === 'socks5' ? 'socks5' : 'http' }),
        ...(osDistribution !== undefined && { osDistribution }),
        ...(batchSize !== undefined && { batchSize: Number(batchSize) || 10 })
      }
    });

    return res.json({ success: true, evomiConfig: saved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users', requireAuth, requirePermission('user.create'), async (req, res) => {
  try {
    const { email, password, role = 'user', permissions = [], managedTeamId, memberTeamId, adspowerUrl, adspowerApiKey } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    // Managers can only create users within their own team
    const assignedMemberTeamId = req.user.role === 'manager' ? req.user.managedTeamId : memberTeamId;
    const assignedRole = req.user.role === 'manager' ? 'user' : role;

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        role: assignedRole,
        permissions: assignedRole === 'manager' ? permissions : [],
        managedTeamId: assignedRole === 'manager' ? managedTeamId : null,
        memberTeamId: assignedMemberTeamId || null,
        adsPowerConfig: {
          create: {
            adspowerUrl: adspowerUrl || config.defaultAdsPowerUrl,
            adspowerApiKey: adspowerApiKey || ''
          }
        }
      },
      include: { adsPowerConfig: true, managedTeam: true, memberTeam: true }
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/users/:id', requireAuth, requirePermission('user.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role, permissions, managedTeamId, memberTeamId } = req.body;

    // Check manager scoping
    if (req.user.role === 'manager') {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.memberTeamId !== req.user.managedTeamId) {
        return res.status(403).json({ success: false, message: 'Forbidden: User not in your team.' });
      }
    }

    const data = {};
    if (email) data.email = email.trim().toLowerCase();
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    if (req.user.role === 'admin') {
      if (role) data.role = role;
      if (Array.isArray(permissions)) data.permissions = permissions;
      if (managedTeamId !== undefined) data.managedTeamId = managedTeamId;
      if (memberTeamId !== undefined) data.memberTeamId = memberTeamId;
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });

    return res.json({ success: true, user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requirePermission('user.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'manager') {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser || targetUser.memberTeamId !== req.user.managedTeamId) {
        return res.status(403).json({ success: false, message: 'Forbidden: User not in your team.' });
      }
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 5. Proxy Management Routes ────────────────────────────────────────────
app.get('/api/admin/proxies', requireAuth, requirePermission('proxy.read'), async (req, res) => {
  try {
    const { userId, status, os, protocol, search } = req.query;
    const where = {};

    if (req.user.role === 'manager') {
      where.teamId = req.user.managedTeamId;
    }

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (os) where.os = os;
    if (protocol) where.protocol = protocol;
    if (search) {
      where.OR = [
        { host: { contains: search } },
        { user: { contains: search } },
        { userRef: { email: { contains: search } } }
      ];
    }

    const proxies = await prisma.proxy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        userRef: { select: { id: true, email: true } },
        team: { select: { id: true, name: true, code: true } }
      }
    });

    return res.json({ success: true, proxies });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/proxies/batch', requireAuth, requirePermission('proxy.create'), async (req, res) => {
  try {
    const { userId, proxies } = req.body;
    if (!userId || !Array.isArray(proxies) || proxies.length === 0) {
      return res.status(400).json({ success: false, message: 'userId and non-empty proxies array required.' });
    }

    // Lookup user to resolve team
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found.' });

    if (req.user.role === 'manager' && targetUser.memberTeamId !== req.user.managedTeamId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot assign to user outside your team.' });
    }

    const teamId = targetUser.memberTeamId || (req.user.role === 'manager' ? req.user.managedTeamId : null);

    const records = proxies.map((p) => ({
      userId,
      teamId,
      host: p.host,
      port: String(p.port),
      user: p.user || '',
      pass: p.pass || '',
      protocol: p.protocol || 'socks5',
      os: p.os || 'windows',
      status: p.status || 'fresh'
    }));

    const result = await prisma.proxy.createMany({ data: records });

    return res.status(201).json({
      success: true,
      count: result.count,
      message: `Imported and assigned ${result.count} proxies.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/proxies/bulk-status', requireAuth, requirePermission('proxy.edit'), async (req, res) => {
  try {
    const { proxyIds, status } = req.body;
    if (!Array.isArray(proxyIds) || !status) {
      return res.status(400).json({ success: false, message: 'proxyIds array and status required.' });
    }

    const where = { id: { in: proxyIds } };
    if (req.user.role === 'manager') where.teamId = req.user.managedTeamId;

    const updated = await prisma.proxy.updateMany({
      where,
      data: { status }
    });

    return res.json({ success: true, updatedCount: updated.count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/proxies', requireAuth, requirePermission('proxy.delete'), async (req, res) => {
  try {
    const { proxyIds } = req.body;
    if (!Array.isArray(proxyIds) || proxyIds.length === 0) {
      return res.status(400).json({ success: false, message: 'proxyIds array required.' });
    }

    const where = { id: { in: proxyIds } };
    if (req.user.role === 'manager') where.teamId = req.user.managedTeamId;

    const deleted = await prisma.proxy.deleteMany({ where });

    return res.json({ success: true, deletedCount: deleted.count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 6. AdsPower Config Management Routes ──────────────────────────────────
app.get('/api/admin/configs', requireAuth, requirePermission('config.read'), async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'manager') {
      where.user = { memberTeamId: req.user.managedTeamId };
    }

    const configs = await prisma.adsPowerConfig.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, memberTeam: true } }
      }
    });
    return res.json({ success: true, configs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/configs/:userId', requireAuth, requirePermission('config.edit'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { adspowerUrl, adspowerApiKey } = req.body;

    if (req.user.role === 'manager') {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || targetUser.memberTeamId !== req.user.managedTeamId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Target user not in your team.' });
      }
    }

    const updated = await prisma.adsPowerConfig.upsert({
      where: { userId },
      update: {
        adspowerUrl: adspowerUrl || config.defaultAdsPowerUrl,
        adspowerApiKey: adspowerApiKey || ''
      },
      create: {
        userId,
        adspowerUrl: adspowerUrl || config.defaultAdsPowerUrl,
        adspowerApiKey: adspowerApiKey || ''
      }
    });

    return res.json({ success: true, config: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 7. Scalable Video Upload Storage Configuration ────────────────────────
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { calculateLeadMetrics } = require('./services/salaryMath');

const uploadsRootDir = path.join(__dirname, '..', 'uploads', 'recordings');
if (!fs.existsSync(uploadsRootDir)) {
  fs.mkdirSync(uploadsRootDir, { recursive: true });
}

// Serve uploaded recordings statically
app.use('/uploads/recordings', express.static(uploadsRootDir));

// Concurrency control: prevent server starvation when hundreds of operators upload recordings
let activeUploadCount = 0;
const MAX_CONCURRENT_UPLOADS = 30;

function uploadConcurrencyGuard(req, res, next) {
  if (activeUploadCount >= MAX_CONCURRENT_UPLOADS) {
    res.setHeader('Retry-After', '3');
    return res.status(429).json({
      success: false,
      message: 'Server upload queue is currently full. Please retry in a few seconds.'
    });
  }
  activeUploadCount++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      activeUploadCount = Math.max(0, activeUploadCount - 1);
    }
  };
  res.on('finish', release);
  res.on('close', release);
  next();
}

// Disk storage partitioned by YYYY/MM/DD/userId to avoid filesystem inode exhaustion
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const userId = req.body.userId || 'anonymous';
    const targetDir = path.join(uploadsRootDir, year, month, day, userId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webm`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 35 * 1024 * 1024 } // 35MB max per compressed 5 FPS recording (~35 mins capacity)
});

// ── 8. Lead Video Upload Endpoint (Called by Electron Desktop Client) ───────
app.post('/api/leads/upload', uploadConcurrencyGuard, upload.single('video'), async (req, res) => {
  try {
    const { userId, videoDuration = '0' } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video recording file provided.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { salaryConfig: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    // Calculate current locked per-lead rate
    const salary = user.salaryConfig ? user.salaryConfig.monthlySalary : 0;
    const goal = user.salaryConfig ? user.salaryConfig.dailyLeadGoal : 50;
    const metrics = calculateLeadMetrics(salary, goal, new Date());

    // Relative web URL for streaming
    const relativePath = path.relative(uploadsRootDir, req.file.path).replace(/\\/g, '/');
    const videoUrl = `/uploads/recordings/${relativePath}`;

    const lead = await prisma.leadSubmission.create({
      data: {
        userId: user.id,
        teamId: user.memberTeamId,
        videoUrl,
        fileSizeBytes: req.file.size,
        videoDuration: parseInt(videoDuration, 10) || 0,
        calculatedPay: metrics.perLeadValue,
        status: 'pending'
      }
    });

    return res.status(201).json({
      success: true,
      leadId: lead.id,
      videoUrl: lead.videoUrl,
      calculatedPay: lead.calculatedPay,
      message: 'Video proof received and queued for review.'
    });
  } catch (err) {
    console.error('Lead upload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 9. Salary & Calendar Metrics Endpoints (Admin & Manager) ───────────────
app.get('/api/admin/salary/metrics/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        salaryConfig: true,
        monthlyLedgers: true
      }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const salary = user.salaryConfig?.monthlySalary || 0;
    const goal = user.salaryConfig?.dailyLeadGoal || 50;
    const metrics = calculateLeadMetrics(salary, goal, new Date());

    // Fetch this month's submissions
    const startOfMonth = new Date(metrics.year, metrics.month - 1, 1);
    const endOfMonth = new Date(metrics.year, metrics.month, 0, 23, 59, 59);

    const submissions = await prisma.leadSubmission.findMany({
      where: {
        userId,
        submittedAt: { gte: startOfMonth, lte: endOfMonth }
      },
      select: { id: true, status: true, calculatedPay: true, submittedAt: true }
    });

    // Group submissions by day of month (1 to daysInMonth)
    const calendarDays = {};
    for (let d = 1; d <= metrics.daysInMonth; d++) {
      calendarDays[d] = {
        day: d,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        earnings: 0,
        dayRate: 0
      };
    }

    let approvedCount = 0;
    let earnedThisMonth = 0;

    for (const sub of submissions) {
      const day = new Date(sub.submittedAt).getDate();
      if (calendarDays[day]) {
        calendarDays[day].total++;
        const pay = Number(sub.calculatedPay) || 0;
        if (pay > 0 && !calendarDays[day].dayRate) {
          calendarDays[day].dayRate = pay;
        }
        if (sub.status === 'approved') {
          calendarDays[day].approved++;
          calendarDays[day].earnings += pay;
          approvedCount++;
          earnedThisMonth += pay;
        } else if (sub.status === 'pending') {
          calendarDays[day].pending++;
        } else if (sub.status === 'rejected') {
          calendarDays[day].rejected++;
        }
      }
    }

    return res.json({
      success: true,
      metrics,
      summary: {
        totalSubmissions: submissions.length,
        approvedLeads: approvedCount,
        earnedTotal: Number(earnedThisMonth.toFixed(2))
      },
      calendarDays: Object.values(calendarDays)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/salary/config/:userId', requireAuth, requirePermission('user.edit'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { monthlySalary, dailyLeadGoal, currency = 'PKR' } = req.body;

    const updated = await prisma.userSalaryConfig.upsert({
      where: { userId },
      update: {
        monthlySalary: parseFloat(monthlySalary) || 0,
        dailyLeadGoal: parseInt(dailyLeadGoal, 10) || 50,
        currency
      },
      create: {
        userId,
        monthlySalary: parseFloat(monthlySalary) || 0,
        dailyLeadGoal: parseInt(dailyLeadGoal, 10) || 50,
        currency
      }
    });

    return res.json({ success: true, config: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 10. Lead Video Proof Audit & Approval Endpoints ────────────────────────
app.get('/api/admin/leads', requireAuth, async (req, res) => {
  try {
    const { status, userId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (req.user.role === 'manager') {
      where.teamId = req.user.managedTeamId;
    }

    const leads = await prisma.leadSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true } },
        team: { select: { id: true, name: true, code: true } }
      }
    });

    return res.json({ success: true, leads });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/leads/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await prisma.leadSubmission.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!lead) return res.status(404).json({ success: false, message: 'Lead submission not found.' });

    const updated = await prisma.leadSubmission.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedBy: req.user.email,
        reviewedAt: new Date()
      }
    });

    // Update or insert into MonthlyLedger
    const subDate = new Date(lead.submittedAt);
    const year = subDate.getFullYear();
    const month = subDate.getMonth() + 1;

    await prisma.monthlyLedger.upsert({
      where: {
        userId_year_month: {
          userId: lead.userId,
          year,
          month
        }
      },
      update: {
        approvedLeads: { increment: 1 },
        earnedCredit: { increment: lead.calculatedPay }
      },
      create: {
        userId: lead.userId,
        year,
        month,
        baseSalary: 0,
        approvedLeads: 1,
        earnedCredit: lead.calculatedPay
      }
    });

    return res.json({ success: true, lead: updated, credited: lead.calculatedPay });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/leads/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes = '' } = req.body;

    const updated = await prisma.leadSubmission.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedBy: req.user.email,
        reviewedAt: new Date(),
        reviewNotes
      }
    });

    return res.json({ success: true, lead: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── 11. Operator Self-Service Earnings & Approved Leads (Desktop Client) ─────
app.get('/api/operator/earnings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));

    // Resolve date boundary for selected month (YYYY-MM or current)
    let targetYear, targetMonth;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split('-');
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        salaryConfig: true,
        monthlyLedgers: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Operator not found.' });
    }

    const monthlySalary = user.salaryConfig?.monthlySalary || 0;
    const dailyGoal = user.salaryConfig?.dailyLeadGoal || 50;
    const currency = user.salaryConfig?.currency || 'PKR';

    // Calculate dynamic calendar math for the targeted month
    const metrics = calculateLeadMetrics(monthlySalary, dailyGoal, startOfMonth);

    // Filter counts for targeted month
    const [totalApproved, totalPending, totalRejected] = await Promise.all([
      prisma.leadSubmission.count({
        where: {
          userId,
          status: 'approved',
          submittedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      }),
      prisma.leadSubmission.count({
        where: {
          userId,
          status: 'pending',
          submittedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      }),
      prisma.leadSubmission.count({
        where: {
          userId,
          status: 'rejected',
          submittedAt: { gte: startOfMonth, lte: endOfMonth }
        }
      })
    ]);

    // Sum the actual locked earnings for each approved lead across the month (day-based rates preserved)
    const approvedMonthLeads = await prisma.leadSubmission.findMany({
      where: {
        userId,
        status: 'approved',
        submittedAt: { gte: startOfMonth, lte: endOfMonth }
      },
      select: { calculatedPay: true }
    });

    const totalEarned = Number(
      approvedMonthLeads.reduce((sum, item) => sum + (Number(item.calculatedPay) || 0), 0).toFixed(2)
    );

    // Paginated list of approved leads
    const approvedLeads = await prisma.leadSubmission.findMany({
      where: {
        userId,
        status: 'approved',
        submittedAt: { gte: startOfMonth, lte: endOfMonth }
      },
      orderBy: { submittedAt: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        submittedAt: true,
        reviewedAt: true,
        videoDuration: true,
        calculatedPay: true,
        videoUrl: true,
        status: true
      }
    });

    // Build available months list (current month + any month with submissions/ledgers)
    const distinctSubmissions = await prisma.leadSubmission.findMany({
      where: { userId },
      select: { submittedAt: true },
      distinct: ['submittedAt']
    });

    const monthsSet = new Set();
    const curNow = new Date();
    const curKey = `${curNow.getFullYear()}-${String(curNow.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(curKey);

    for (const sub of distinctSubmissions) {
      const d = new Date(sub.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(key);
    }
    for (const led of user.monthlyLedgers || []) {
      const key = `${led.year}-${String(led.month).padStart(2, '0')}`;
      monthsSet.add(key);
    }

    const availableMonths = Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map((val) => {
        const [y, m] = val.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const label = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return {
          value: val,
          label: val === curKey ? `${label} (Current)` : label,
          isCurrent: val === curKey
        };
      });

    const selectedKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const selectedDate = new Date(targetYear, targetMonth - 1, 1);
    const monthLabel = selectedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const totalPages = Math.ceil(totalApproved / pageSize) || 1;

    return res.json({
      success: true,
      selectedMonth: selectedKey,
      monthLabel,
      isCurrentMonth: selectedKey === curKey,
      availableMonths,
      metrics: {
        monthlySalary,
        dailyGoal,
        perLeadValue: metrics.perLeadValue,
        currency,
        daysInMonth: metrics.daysInMonth,
        monthlyTarget: metrics.daysInMonth * dailyGoal
      },
      summary: {
        approvedCount: totalApproved,
        totalEarned,
        pendingCount: totalPending,
        rejectedCount: totalRejected
      },
      leads: approvedLeads,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalCount: totalApproved,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('Operator earnings error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = app;

