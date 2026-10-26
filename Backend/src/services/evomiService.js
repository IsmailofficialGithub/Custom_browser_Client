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

function generateEvomiProxies(evomiConfig, userId, teamId = null, count = 10) {
  if (!evomiConfig || !evomiConfig.apiKey) {
    return [];
  }

  const apiKey = evomiConfig.apiKey.trim();
  const country = (evomiConfig.country || "all").toLowerCase().trim();
  const protocol = (evomiConfig.protocol || "http").toLowerCase().trim();
  const port = protocol === "socks5" ? "1002" : "1000";
  const host = "rp.evomi.com";

  const osList = resolveOsAllocations(evomiConfig.osDistribution, count);

  return osList.map((os) => {
    const sessionId = crypto.randomBytes(4).toString("hex");
    let userParam = apiKey;
    if (country && country !== "all") {
      userParam += "-country-" + country;
    }
    userParam += "-os-" + os + "-session-" + sessionId;

    return {
      userId,
      teamId: teamId || null,
      host,
      port,
      user: userParam,
      pass: "",
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
