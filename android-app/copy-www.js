/* =====================================================================
   把打包用站点 build/pack-site 复制到 www/，供 Capacitor 打进 apk。
   站内 art/ 照片已由 tools/pack_site.py 压到长边 1600，
   直接复制 site/ 会让安装包白白多出 80MB。
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'build', 'pack-site');
const dst = path.join(__dirname, 'www');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('缺少 build/pack-site，请先执行： python tools/pack_site.py');
  process.exit(1);
}

fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });

let files = 0, bytes = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
})(dst);

console.log('www 已就绪：' + files + ' 个文件，' + (bytes / 1048576).toFixed(1) + ' MB');
