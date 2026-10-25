/* =====================================================================
   梦想地图 同步服务（零依赖 Node，与 NoteHub 同一模式）
   1) 分发 site/ 静态站点（含本地图片包 art/、像素字体 fonts/）
   2) GET / POST /api/sync —— 读写本机 server-data/ 下的 data.json

   用法：  node dreammap_server.js [端口] [站点目录]
   首次启动会在 server-data/key.txt 生成同步密钥并打印出来。
   公网暴露：  cloudflared tunnel --url http://localhost:8090
   ===================================================================== */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var crypto = require('crypto');

var PORT = parseInt(process.argv[2], 10) || 8090;
var ROOT = path.resolve(process.argv[3] || path.join(__dirname, 'site'));

/* 存档与密钥放在服务脚本旁边的 server-data/，整个目录可随程序一起搬走。
   Electron 内嵌时 __dirname 在只读的 app.asar 里，宿主可用环境变量
   DREAMMAP_DATA_DIR 指到可写目录（桌面版指向用户数据目录）。 */
var DATA_DIR = process.env.DREAMMAP_DATA_DIR
  ? path.resolve(process.env.DREAMMAP_DATA_DIR)
  : path.join(__dirname, 'server-data');
var DATA_FILE = path.join(DATA_DIR, 'data.json');
var KEY_FILE = path.join(DATA_DIR, 'key.txt');

var MAX_BODY = 16 * 1024 * 1024;   /* 单次写入上限 16MB（存档很小，留足余量） */
var EMPTY_DOC = '{"v":1,"rev":0,"profile":{},"notes":[],"tombstones":[]}';

/* ---------------- 同步密钥 ---------------- */

function loadKey() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    var k = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (k) return k;
  } catch (e) { /* 首次运行，下面新建 */ }
  var k = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(KEY_FILE, k + '\n', 'utf8');
  return k;
}

var SYNC_KEY = loadKey();

/* ---------------- 数据读写 ---------------- */

function readDoc() {
  try { return fs.readFileSync(DATA_FILE, 'utf8'); }
  catch (e) { return EMPTY_DOC; }
}

function writeDoc(text) {
  var tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');

  /* 覆盖前轮换备份：当前版本存为 bak.1，最多保留 5 份历史快照 */
  try {
    if (fs.existsSync(DATA_FILE)) {
      for (var i = 4; i >= 1; i--) {
        var from = DATA_FILE + '.bak.' + i;
        var to = DATA_FILE + '.bak.' + (i + 1);
        if (fs.existsSync(from)) {
          try { fs.unlinkSync(to); } catch (e) { /* 忽略 */ }
          fs.renameSync(from, to);
        }
      }
      fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak.1');
    }
  } catch (e) { /* 备份失败不影响主流程 */ }

  fs.renameSync(tmp, DATA_FILE);   /* 先写临时文件再改名，避免写坏 */
}

/* ---------------- 静态文件 ---------------- */

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(res, pathname) {
  var rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  var file = path.join(ROOT, path.normalize(rel).replace(/^[\\/]+/, ''));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

/* ---------------- 请求处理 ---------------- */

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

function allowed(req, url) {
  var k = url.searchParams.get('key') || req.headers['x-sync-key'] || '';
  return !!k && k === SYNC_KEY;
}

/* 读取请求体，超限直接 413 */
function readBody(req, res, onText) {
  var chunks = [], size = 0, tooBig = false;
  req.on('data', function (c) {
    size += c.length;
    if (size > MAX_BODY) { tooBig = true; req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', function () {
    if (tooBig) { sendJson(res, 413, { error: 'payload_too_large' }); return; }
    onText(Buffer.concat(chunks).toString('utf8'));
  });
}

var server = http.createServer(function (req, res) {
  var url = new URL(req.url, 'http://localhost');
  var pathname = url.pathname;

  /* 单文件版（file://）也能跨域调用，鉴权靠密钥 */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Key');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  /* 本机服务信息：仅接受回环地址访问，密钥不会暴露给局域网内其他设备 */
  if (pathname === '/api/info') {
    var ra = (req.socket && req.socket.remoteAddress) || '';
    var isLoop = ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
    if (!isLoop) { sendJson(res, 403, { error: 'forbidden' }); return; }
    if (req.method !== 'GET') { sendJson(res, 405, { error: 'method_not_allowed' }); return; }

    var addr = server.address();
    var port = addr && addr.port;
    sendJson(res, 200, {
      port: port,
      key: SYNC_KEY,
      local: 'http://localhost:' + port + '/',
      lan: lanIps().map(function (ip) { return 'http://' + ip + ':' + port + '/'; })
    });
    return;
  }

  if (pathname === '/api/sync') {
    if (!allowed(req, url)) { sendJson(res, 401, { error: 'invalid_key' }); return; }

    if (req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(readDoc());
      return;
    }

    if (req.method === 'POST') {
      readBody(req, res, function (text) {
        try {
          var doc = JSON.parse(text);
          if (!doc || typeof doc !== 'object' || !Array.isArray(doc.notes)) throw new Error('bad');
        } catch (e) {
          sendJson(res, 400, { error: 'invalid_json' });
          return;
        }
        writeDoc(JSON.stringify(doc));
        sendJson(res, 200, { ok: true, updatedAt: Date.now(), rev: doc.rev || 0 });
      });
      return;
    }

    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(res, pathname); return; }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('405 Method Not Allowed');
});

/* 监听并就绪后回调：打印访问信息，把真实端口交给调用方 */
var VIRTUAL_IF = /vEthernet|VMware|VirtualBox|Hyper-V|WSL|Loopback|kite|Tailscale|ZeroTier|Bluetooth|Npcap/i;

function lanIps() {
  var list = [];
  var ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(function (name) {
    if (VIRTUAL_IF.test(name)) return;   /* 虚拟网卡地址手机连不到，别显示出来误导 */
    (ifs[name] || []).forEach(function (a) {
      if (a.family === 'IPv4' && !a.internal) list.push({ name: name, ip: a.address });
    });
  });
  function rank(n) { return /WLAN|Wi-?Fi|无线|以太网|Ethernet/i.test(n) ? 0 : 1; }
  list.sort(function (a, b) { return rank(a.name) - rank(b.name); });
  return list.map(function (x) { return x.ip; });
}

function onListen(port, cb) {
  var ips = lanIps();

  console.log('');
  console.log('  梦想地图 同步服务已启动');
  console.log('  ------------------------------------------------------------');
  console.log('  站点目录 : ' + ROOT);
  console.log('  数据文件 : ' + DATA_FILE);
  console.log('  同步密钥 : ' + SYNC_KEY);
  console.log('  本机访问 : http://localhost:' + port + '/');
  ips.forEach(function (ip) {
    console.log('  局域网   : http://' + ip + ':' + port + '/');
  });
  console.log('  公网访问 : cloudflared tunnel --url http://localhost:' + port);
  console.log('  ------------------------------------------------------------');
  console.log('');

  if (typeof cb === 'function') cb(port);
}

/* 供 Electron 等宿主内嵌调用；port 传 0 表示交给系统分配空闲端口，root 可覆盖站点目录 */
function start(port, cb, root) {
  var p = (typeof port === 'number') ? port : PORT;
  if (root) ROOT = path.resolve(root);
  server.listen(p, function () { onListen(server.address().port, cb); });
  return server;
}

if (require.main === module) { start(); }

module.exports = {
  start: start,
  server: server,
  key: SYNC_KEY,
  dataFile: DATA_FILE
};
