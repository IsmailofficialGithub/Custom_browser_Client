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

const EVOMI_GENERATE_URL = "https://api.evomi.com/public/generate";
/** rpc = Core Residential (Evomi's default; matches the Money_browser campaign generator). */
const EVOMI_DEFAULT_PRODUCT = "rpc";

/**
 * Generate proxies for an Evomi API key through Evomi's official generate API.
 * Evomi returns ready-made host:port:username:password lines for the product, so the
 * host, port and proxy credentials are always the right ones. (Building them by hand
 * used the API key as username/password, which Evomi rejects:
 * "Socks5 proxy rejected connection - Failure".)
 * @returns {Promise<object[]>} rows for prisma.proxy.createMany
 * @throws when Evomi returns an error (invalid key, no balance, ...)
 */
async function generateViaEvomiApi(evomiConfig, userId, teamId, count) {
  const apiKey = evomiConfig.apiKey.trim();
  const protocol = String(evomiConfig.protocol || "socks5").toLowerCase().trim() === "http" ? "http" : "socks5";
  const country = String(evomiConfig.country || "all").toUpperCase().trim();

  const params = new URLSearchParams({
    apikey: apiKey,
    product: evomiConfig.product || EVOMI_DEFAULT_PRODUCT,
    session: "hard",
    protocol,
    format: "2", // host:port:username:password
    prepend_protocol: "false",
    amount: String(Math.max(1, Math.min(100, count)))
  });
  if (country && country !== "ALL" && country !== "WORLDWIDE") params.set("countries", country);

  const res = await fetch(`${EVOMI_GENERATE_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
  const text = (await res.text()).trim();
  if (!res.ok || text.startsWith("{")) {
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch (_) { /* plain text */ }
    throw new Error(`Evomi generate failed (HTTP ${res.status}): ${String(msg).slice(0, 200)}`);
  }

  const osList = resolveOsAllocations(evomiConfig.osDistribution, count);
  const rows = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length && rows.length < count; i++) {
    const line = lines[i].includes("://") ? lines[i].split("://")[1] : lines[i];
    const parts = line.split(":");
    if (parts.length < 4) continue;
    const [host, port, user] = parts;
    let pass = parts.slice(3).join(":");
    const os = osList[rows.length] || "windows";
    // Evomi only allows the Windows TCP/IP fingerprint; other _device-* values are rejected.
    if (os === "windows") pass = `${pass}_device-windows`;
    rows.push({ userId, teamId: teamId || null, host, port: String(port), user, pass, protocol, os, status: "fresh" });
  }
  return rows;
}

async function generateEvomiProxies(evomiConfig, userId, teamId = null, count = 10) {
  if (!evomiConfig || !evomiConfig.apiKey) {
    return [];
  }

  const rawKey = evomiConfig.apiKey.trim();

  // A plain API key: let Evomi generate the proxies (correct host + proxy credentials).
  if (!rawKey.includes(":")) {
    return generateViaEvomiApi(evomiConfig, userId, teamId, count);
  }

  // "proxyUsername:proxyPassword" entered by hand — build the proxies locally (legacy path).
  const country = (evomiConfig.country || "all").toUpperCase().trim();
  const protocol = (evomiConfig.protocol || "socks5").toLowerCase().trim();
  const port = protocol === "socks5" ? "1002" : "1000";
  const parts = rawKey.split(":");
  const username = parts[0].trim();
  const basePassword = parts.slice(1).join(":").trim();

  const host = "rp.evomi.com";
  const osList = resolveOsAllocations(evomiConfig.osDistribution, count);

  return osList.map((os) => {
    const session = buildEvomiSessionId();
    // Evomi only allows the Windows TCP/IP fingerprint; "_device-unix" etc. are rejected.
    const devSuffix = os === "windows" ? "_device-windows" : "";

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
