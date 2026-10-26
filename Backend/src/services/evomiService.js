"use strict";

const crypto = require("crypto");

function resolveOsAllocations(osDistribution, totalCount = 10) {
  const defaults = { windows: 50, mac: 30, ios: 20, android: 0 };
  const dist = { ...defaults, ...(osDistribution || {}) };

  const osKeys = ["windows", "mac", "ios", "android"];
  let sum = 0;
  for (const k of osKeys) {
    dist[k] = Math.max(0, Number(dist[k]) || 0);
    sum += dist[k];
  }

  if (sum === 0) {
    dist.windows = 100;
    sum = 100;
  }

  const result = [];
  let remaining = totalCount;

  for (let i = 0; i < osKeys.length; i++) {
    const k = osKeys[i];
    if (i === osKeys.length - 1) {
      for (let j = 0; j < remaining; j++) {
        result.push(k);
      }
    } else {
      const count = Math.round((dist[k] / sum) * totalCount);
      const allocated = Math.min(count, remaining);
      for (let j = 0; j < allocated; j++) {
        result.push(k);
      }
      remaining -= allocated;
    }
  }

  return result;
}

function buildEvomiSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += chars[crypto.randomInt(chars.length)];
  }
  return s;
}

function generateEvomiProxies(evomiConfig, userId, teamId = null, count = 10) {
  if (!evomiConfig || !evomiConfig.apiKey) {
    return [];
  }

  const rawKey = evomiConfig.apiKey.trim();
  const country = (evomiConfig.country || "all").toUpperCase().trim();
  const protocol = (evomiConfig.protocol || "socks5").toLowerCase().trim();
  const port = protocol === "socks5" ? "1002" : "1000";

  // Check if rawKey is in "username:password" format or single key
  let username = "";
  let basePassword = "";

  if (rawKey.includes(":")) {
    const parts = rawKey.split(":");
    username = parts[0].trim();
    basePassword = parts.slice(1).join(":").trim();
  } else {
    username = rawKey;
    basePassword = rawKey;
  }

  const host = "rp.evomi.com";
  const osList = resolveOsAllocations(evomiConfig.osDistribution, count);

  return osList.map((os) => {
    const session = buildEvomiSessionId();
    let devSuffix = "";
    if (os === "windows") devSuffix = "_device-windows";
    else if (os === "android") devSuffix = "_device-unix";

    let loc = "";
    if (country && country !== "ALL") {
      loc = `_country-${country}`;
    }

    // Standard Evomi Core Residential password targeting format
    const pass = `${basePassword}${loc}${devSuffix}_localdns-1_session-${session}_lifetime-1440`;

    return {
      userId,
      teamId: teamId || null,
      host,
      port,
      user: username,
      pass,
      protocol,
      os,
      status: "fresh"
    };
  });
}

module.exports = {
  resolveOsAllocations,
  generateEvomiProxies
};
