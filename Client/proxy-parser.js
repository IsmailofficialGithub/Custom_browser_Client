'use strict';

/**
 * Proxy parser for HOSTRIF Client with OS and Protocol (SOCKS5/HTTP) detection.
 * Supports:
 * - host:port:user:pass:os:proto (e.g. host:port:user:pass:ios:socks5)
 * - host:port:user:pass:proto:os (e.g. host:port:user:pass:socks5:ios)
 * - host:port:user:pass:proto
 * - host:port:user:pass:os
 * - host:port:user:pass
 * - user:pass@host:port:proto
 * - protocol://user:pass@host:port
 * - host:port
 */

function normalizeOs(raw) {
  if (!raw) return 'windows';
  const s = String(raw).toLowerCase().trim();
  if (['windows', 'win'].includes(s)) return 'windows';
  if (['mac', 'macos', 'darwin'].includes(s)) return 'mac';
  if (['android', 'droid'].includes(s)) return 'android';
  if (['ios', 'iphone', 'ipad'].includes(s)) return 'ios';
  if (['linux', 'ubuntu'].includes(s)) return 'linux';
  return 'windows';
}

function normalizeProto(raw) {
  if (!raw) return 'socks5';
  const s = String(raw).toLowerCase().trim();
  if (/^(socks?[45]?|socket[45]?|socs?)$/i.test(s) || s.startsWith('sock') || s.startsWith('soc')) return 'socks5';
  if (s.startsWith('http')) return 'http';
  return 'socks5';
}

function parseProxyLine(rawLine, defaultOs = 'windows', defaultProto = 'socks5') {
  if (!rawLine || typeof rawLine !== 'string') return null;
  let line = rawLine.trim();
  if (!line || line.startsWith('#')) return null;

  // Extract explicit protocol prefix if like socks5://, socket://, sock://, http://, or socks5:host:port
  let explicitProto = null;
  const protoPrefixMatch = line.match(/^(socks[45]?|sock[45]?|socket[45]?|socs?|https?)(:\/\/|:|\s+)/i);
  if (protoPrefixMatch) {
    explicitProto = normalizeProto(protoPrefixMatch[1]);
    line = line.slice(protoPrefixMatch[0].length).trim();
  }

  // Extract trailing tags (allows both :os and :proto in any order)
  let explicitOs = null;
  for (let iter = 0; iter < 2; iter++) {
    const osMatch = line.match(/:(windows|win|mac|macos|darwin|android|ios|iphone|linux)$/i);
    if (osMatch) {
      explicitOs = normalizeOs(osMatch[1]);
      line = line.slice(0, osMatch.index).trim();
      continue;
    }
    const protoMatch = line.match(/:(socks[45]?|sock[45]?|socket[45]?|socs?|http|https)$/i);
    if (protoMatch) {
      explicitProto = normalizeProto(protoMatch[1]);
      line = line.slice(0, protoMatch.index).trim();
      continue;
    }
  }

  // Auto-detect protocol if not explicitly set
  if (!explicitProto) {
    // Check if raw line starts with or contains any sock/socket keyword
    if (/^\s*(sock|soc)/i.test(rawLine) || /\b(socks[45]?|socket[45]?|sock[45]?|socs?)\b/i.test(rawLine)) {
      explicitProto = 'socks5';
    } else if (/^\s*https?/i.test(rawLine) || /\bhttps?\b/i.test(rawLine)) {
      explicitProto = 'http';
    } else {
      // Check common default ports
      const portMatch = line.match(/:(\d{2,5})\b/);
      if (portMatch) {
        const pNum = parseInt(portMatch[1], 10);
        if ([1080, 1081, 9050, 9150, 10808, 10809].includes(pNum)) {
          explicitProto = 'socks5';
        } else if ([80, 8080, 3128, 8888].includes(pNum)) {
          explicitProto = 'http';
        }
      }
    }
  }

  const effectiveOs = explicitOs || normalizeOs(defaultOs);
  const effectiveProto = explicitProto || normalizeProto(defaultProto);

  let target = line;

  // Check URL scheme if still present
  if (/^[a-zA-Z0-9]+:\/\//.test(line)) {
    try {
      const parsedUrl = new URL(line);
      let pType = (parsedUrl.protocol || '').replace(':', '').toLowerCase();
      pType = normalizeProto(pType);

      return {
        proxy_type: pType,
        proxy_host: parsedUrl.hostname,
        proxy_port: String(parsedUrl.port || (pType === 'socks5' ? 1080 : 80)),
        proxy_user: decodeURIComponent(parsedUrl.username || ''),
        proxy_password: decodeURIComponent(parsedUrl.password || ''),
        os: effectiveOs,
        proxy_soft: 'other',
        raw: rawLine
      };
    } catch {
      // Fall through to manual parsing
    }
  }

  // Remove scheme if present but URL parse failed
  target = target.replace(/^[a-zA-Z0-9]+:\/\//, '');

  // Check for @ symbol: user:pass@host:port
  if (target.includes('@')) {
    const [authPart, hostPart] = target.split('@');
    const [user = '', pass = ''] = authPart.split(':');
    const [host = '', port = (effectiveProto === 'socks5' ? '1080' : '80')] = hostPart.split(':');
    return {
      proxy_type: effectiveProto,
      proxy_host: host.trim(),
      proxy_port: String(port).trim(),
      proxy_user: user.trim(),
      proxy_password: pass.trim(),
      os: effectiveOs,
      proxy_soft: 'other',
      raw: rawLine
    };
  }

  // Colon separated parts
  const parts = target.split(':').map((s) => s.trim());

  if (parts.length === 2) {
    // host:port
    return {
      proxy_type: effectiveProto,
      proxy_host: parts[0],
      proxy_port: String(parts[1]),
      proxy_user: '',
      proxy_password: '',
      os: effectiveOs,
      proxy_soft: 'other',
      raw: rawLine
    };
  }

  if (parts.length >= 4) {
    const part1IsPort = /^\d+$/.test(parts[1]) && parseInt(parts[1], 10) <= 65535;
    const part3IsPort = /^\d+$/.test(parts[3]) && parseInt(parts[3], 10) <= 65535;

    if (part1IsPort) {
      // host:port:user:pass
      return {
        proxy_type: effectiveProto,
        proxy_host: parts[0],
        proxy_port: String(parts[1]),
        proxy_user: parts[2],
        proxy_password: parts.slice(3).join(':'),
        os: effectiveOs,
        proxy_soft: 'other',
        raw: rawLine
      };
    } else if (part3IsPort) {
      // user:pass:host:port
      return {
        proxy_type: effectiveProto,
        proxy_host: parts[2],
        proxy_port: String(parts[3]),
        proxy_user: parts[0],
        proxy_password: parts[1],
        os: effectiveOs,
        proxy_soft: 'other',
        raw: rawLine
      };
    }

    // Default fallback to host:port:user:pass
    return {
      proxy_type: effectiveProto,
      proxy_host: parts[0],
      proxy_port: String(parts[1]),
      proxy_user: parts[2],
      proxy_password: parts.slice(3).join(':'),
      os: effectiveOs,
      proxy_soft: 'other',
      raw: rawLine
    };
  }

  return null;
}

function formatProxyLine(rawLine) {
  if (!rawLine || typeof rawLine !== 'string') return null;
  let line = rawLine.trim();
  if (!line || line.startsWith('#')) return null;

  // Remove surrounding quotes, spaces, and trailing delimiters (, or ;)
  line = line.replace(/^[\s"'`]+/, '').replace(/[\s"'`;,]+$/, '').trim();

  // Strip common label prefixes like "proxy:", "ip:"
  line = line.replace(/^(proxy|ip)\s*:\s*/i, '');

  // Replace tabs with colons if tab separated
  if (line.includes('\t')) {
    line = line.replace(/\t+/g, ':');
  }

  // Remove spaces around colons (e.g. " 1.2.3.4 : 8080 : user : pass ")
  line = line.replace(/\s*:\s*/g, ':');

  // Remove spaces around @ (e.g. "user:pass @ host:port")
  line = line.replace(/\s*@\s*/g, '@');

  return line.trim();
}

function parseProxyList(text, defaultOs = 'windows', defaultProto = 'socks5') {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    const cleaned = formatProxyLine(line);
    if (!cleaned) continue;
    const parsed = parseProxyLine(cleaned, defaultOs, defaultProto);
    if (parsed && parsed.proxy_host && parsed.proxy_port) {
      result.push(parsed);
    }
  }
  return result;
}

function cleanAndFormatProxyList(text, defaultOs = 'windows', defaultProto = 'socks5') {
  if (!text || typeof text !== 'string') {
    return { formattedText: '', totalLines: 0, validCount: 0, cleanedCount: 0, invalidLines: [] };
  }

  const lines = text.split(/\r?\n/);
  const formattedLines = [];
  const invalidLines = [];
  let cleanedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const orig = lines[i];
    const cleaned = formatProxyLine(orig);
    if (!cleaned) continue;

    if (cleaned !== orig.trim()) {
      cleanedCount++;
    }

    const parsed = parseProxyLine(cleaned, defaultOs, defaultProto);
    if (parsed && parsed.proxy_host && parsed.proxy_port) {
      formattedLines.push(cleaned);
    } else {
      invalidLines.push({ line: orig.trim(), index: i + 1 });
    }
  }

  return {
    formattedText: formattedLines.join('\n'),
    totalLines: lines.length,
    validCount: formattedLines.length,
    cleanedCount,
    invalidLines
  };
}

module.exports = {
  normalizeOs,
  normalizeProto,
  parseProxyLine,
  parseProxyList,
  formatProxyLine,
  cleanAndFormatProxyList
};
