'use strict';

const assert = require('assert');
const { parseProxyLine, parseProxyList, formatProxyLine, cleanAndFormatProxyList } = require('./proxy-parser');

// 1. host:port:user:pass
const p1 = parseProxyLine('192.168.1.100:8080:alice:secret123');
assert.strictEqual(p1.proxy_host, '192.168.1.100');
assert.strictEqual(p1.proxy_port, '8080');
assert.strictEqual(p1.proxy_user, 'alice');
assert.strictEqual(p1.proxy_password, 'secret123');

// 2. protocol://user:pass@host:port
const p2 = parseProxyLine('socks5://bob:pwd@proxy.example.com:1080');
assert.strictEqual(p2.proxy_type, 'socks5');
assert.strictEqual(p2.proxy_host, 'proxy.example.com');
assert.strictEqual(p2.proxy_port, '1080');
assert.strictEqual(p2.proxy_user, 'bob');
assert.strictEqual(p2.proxy_password, 'pwd');

// 3. user:pass:host:port
const p3 = parseProxyLine('userX:passY:10.0.0.1:3128');
assert.strictEqual(p3.proxy_host, '10.0.0.1');
assert.strictEqual(p3.proxy_port, '3128');
assert.strictEqual(p3.proxy_user, 'userX');
assert.strictEqual(p3.proxy_password, 'passY');

// 4. host:port
const p4 = parseProxyLine('1.1.1.1:80');
assert.strictEqual(p4.proxy_host, '1.1.1.1');
assert.strictEqual(p4.proxy_port, '80');
assert.strictEqual(p4.proxy_user, '');

// 5. parseProxyList multi-line with empty lines and comments
const listText = `
# Comment
192.168.1.100:8080:alice:secret123

socks5://bob:pwd@proxy.example.com:1080
invalid line
1.1.1.1:80
`;
const list = parseProxyList(listText);
assert.strictEqual(list.length, 3);

// 6. formatProxyLine: spaces around colons, quotes, tabs, trailing semicolons
const messyLine1 = ' " 192.168.1.50 : 8080 : user1 : pass1 " ; ';
assert.strictEqual(formatProxyLine(messyLine1), '192.168.1.50:8080:user1:pass1');

const messyLine2 = '10.0.0.2\t3128\tadmin\tsecret,';
assert.strictEqual(formatProxyLine(messyLine2), '10.0.0.2:3128:admin:secret');

// 7. cleanAndFormatProxyList
const messyBatch = `
  "192.168.1.50 : 8080 : user1 : pass1" ,
10.0.0.2\t3128\tadmin\tsecret

# comment line
invalid-gibberish
`;
const formatRes = cleanAndFormatProxyList(messyBatch);
assert.strictEqual(formatRes.validCount, 2);
assert.strictEqual(formatRes.cleanedCount, 2);
assert.strictEqual(formatRes.invalidLines.length, 1);

// 8. OS parsing & defaults
const pOs1 = parseProxyLine('1.2.3.4:8080:alice:pwd:mac');
assert.strictEqual(pOs1.os, 'mac');

const pOs2 = parseProxyLine('1.2.3.4:8080:alice:pwd:android');
assert.strictEqual(pOs2.os, 'android');

const pOs3 = parseProxyLine('1.2.3.4:8080:alice:pwd:ios');
assert.strictEqual(pOs3.os, 'ios');

const pOs4 = parseProxyLine('1.2.3.4:8080', 'mac');
assert.strictEqual(pOs4.os, 'mac');

// 9. Protocol auto-detection for sock, socket, socks5, http
const pSock1 = parseProxyLine('socket:proxy.example.com:1080:user:pass');
assert.strictEqual(pSock1.proxy_type, 'socks5');
assert.strictEqual(pSock1.proxy_host, 'proxy.example.com');
assert.strictEqual(pSock1.proxy_port, '1080');

const pSock2 = parseProxyLine('sock5://user:pass@proxy.example.com:1080');
assert.strictEqual(pSock2.proxy_type, 'socks5');

const pSock3 = parseProxyLine('proxy.example.com:1080:user:pass:sock5');
assert.strictEqual(pSock3.proxy_type, 'socks5');

const pSock4 = parseProxyLine('socket5:proxy.example.com:1080:user:pass');
assert.strictEqual(pSock4.proxy_type, 'socks5');

const pHttp1 = parseProxyLine('http:proxy.example.com:8080:user:pass');
assert.strictEqual(pHttp1.proxy_type, 'http');
assert.strictEqual(pHttp1.proxy_host, 'proxy.example.com');

console.log('✅ proxy-parser and formatter tests passed!');

