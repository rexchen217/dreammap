/* =====================================================================
   梦想地图 桌面版（Electron 主进程）
   1) 内嵌 dreammap_server.js，在本机固定端口 8090 提供站点 + 同步接口
   2) 打开窗口加载 http://localhost:8090/，与网页版功能完全一致
   固定端口是为了让 localStorage 来源稳定，便利贴与收藏不会因端口变化而丢失。
   手机端把同步地址指向这台电脑即可双向同步（与 NoteHub 同一模式）。
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, Tray, nativeImage, shell, dialog } = require('electron');

const PORT = 8090;
let mainWindow = null;
let tray = null;
let lastPort = PORT;
let forceQuit = false;

/* 启动过程写入日志，方便排查（GUI 应用看不到控制台输出） */
function log() {
  try {
    const line = new Date().toISOString() + ' ' +
      Array.prototype.join.call(arguments, ' ') + '\n';
    fs.appendFileSync(path.join(app.getPath('userData'), 'desktop.log'), line);
  } catch (e) { /* 忽略日志写入失败 */ }
}

/* 站点目录：打包后在 app.asar 内，开发态在上一级目录 */
function resolveSiteDir() {
  return app.isPackaged
    ? path.join(__dirname, 'site')
    : path.join(__dirname, '..', 'build', 'pack-site');
}

/* 内嵌同步服务；端口被占用或加载失败时不阻断使用 */
function startServer() {
  /* 打包后服务脚本在只读的 app.asar 内，存档必须落到可写的用户数据目录 */
  process.env.DREAMMAP_DATA_DIR = path.join(app.getPath('userData'), 'server-data');

  var srv;
  try {
    srv = require('./_generated/dreammap_server.js');
  } catch (e) {
    log('加载同步服务失败：' + (e && e.message));
    return Promise.resolve(PORT);
  }
  return new Promise(function (resolve) {
    srv.server.on('error', function (err) {
      log('同步服务启动异常：' + (err && err.message));
      resolve(PORT);
    });
    srv.start(PORT, function (p) {
      log('同步服务已就绪，端口 ' + p + '，密钥 ' + srv.key);
      resolve(p);
    }, resolveSiteDir());
  });
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    createWindow(lastPort);
  }
}

/* 托盘菜单里直接能看到手机端要填的两项：本机地址与同步密钥 */
function showSyncInfo() {
  var key = '(未生成)';
  var ips = [];
  try {
    key = fs.readFileSync(path.join(app.getPath('userData'), 'server-data', 'key.txt'), 'utf8').trim();
  } catch (e) { /* 服务未起来时文件还不存在 */ }
  try {
    var ifs = require('os').networkInterfaces();
    Object.keys(ifs).forEach(function (name) {
      (ifs[name] || []).forEach(function (a) {
        if (a.family === 'IPv4' && !a.internal) ips.push('http://' + a.address + ':' + PORT);
      });
    });
  } catch (e) { /* 忽略 */ }

  dialog.showMessageBox({
    type: 'info',
    title: '梦想地图 · 云同步',
    message: '手机端在「云同步」里填这两项',
    detail: '服务地址（同一 Wi-Fi 时填第一个）：\n' + (ips.length ? ips.join('\n') : 'http://localhost:' + PORT) +
      '\n\n同步密钥：\n' + key +
      '\n\n在外网同步时，用 cloudflared 之类的隧道把本机 ' + PORT + ' 端口暴露出去，'
      + '把隧道地址填到手机端的服务地址里即可。',
    buttons: ['知道了'],
    noLink: true
  });
}

/* 系统托盘：点关闭按钮只隐藏到托盘，从托盘菜单才真正退出 */
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-16.png'));
  tray = new Tray(icon);
  tray.setToolTip('梦想地图');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开梦想地图', click: showWindow },
    { label: '同步密钥与地址', click: showSyncInfo },
    { type: 'separator' },
    { label: '退出', click: function () { forceQuit = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}

function createWindow(port) {
  lastPort = port;
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: '梦想地图',
    icon: path.join(__dirname, 'window-icon.png'),
    backgroundColor: '#12172b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadURL('http://localhost:' + port + '/');

  mainWindow.webContents.on('did-fail-load', function (e, code, desc, url) {
    log('页面加载失败 ' + code + ' ' + desc + ' ' + url);
  });

  /* 外部链接交给系统浏览器，不在应用内开新窗口 */
  mainWindow.webContents.setWindowOpenHandler(function (d) {
    if (/^https?:/i.test(d.url)) shell.openExternal(d.url);
    return { action: 'deny' };
  });

  /* 关闭按钮 → 隐藏到托盘，保持同步服务在线 */
  mainWindow.on('close', function (e) {
    if (!forceQuit) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', function () { mainWindow = null; });
}

/* 只允许单实例：重复双击时聚焦已打开的窗口 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(function () {
    log('应用启动，打包态=' + app.isPackaged + '，站点目录=' + resolveSiteDir());

    /* 打包版注册开机自启（登录 Windows 后自动启动，手机随时可同步）。
       便携版运行在临时解压目录，execPath 会失效，必须显式指向持久的 exe 路径。 */
    if (app.isPackaged) {
      try {
        const portable = process.env.PORTABLE_EXECUTABLE_FILE;
        app.setLoginItemSettings(portable
          ? { openAtLogin: true, path: portable }
          : { openAtLogin: true });
      } catch (e) { log('自启注册失败：' + e.message); }
    }

    createTray();
    return startServer().then(function (port) { createWindow(port); });
  });

  /* 所有窗口关闭后仍驻留托盘，由托盘菜单显式退出 */
  app.on('window-all-closed', function () { /* 保持托盘运行 */ });

  app.on('before-quit', function () { forceQuit = true; });
}
