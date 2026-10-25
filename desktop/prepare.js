/* =====================================================================
   构建前准备：把根目录的 dreammap_server.js 复制到本工程内，
   让 electron-builder 能把它打进安装包（同名源文件只保留一份，始终最新）。
   同时确认打包用站点 build/pack-site 已生成。
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'dreammap_server.js');
const dir = path.join(__dirname, '_generated');
const dst = path.join(dir, 'dreammap_server.js');

fs.mkdirSync(dir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('已同步 dreammap_server.js → _generated/dreammap_server.js');

const site = path.join(__dirname, '..', 'build', 'pack-site', 'index.html');
if (!fs.existsSync(site)) {
  console.warn('\n[警告] 打包用站点不存在，请先执行： python tools/pack_site.py\n');
} else {
  console.log('打包用站点已就绪：build/pack-site');
}
