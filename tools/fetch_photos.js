// 梦想地图 · 卡面照片抓取脚本（维基共享资源 Wikimedia Commons）
// 按每张卡的检索词搜索，挑一张最贴题的实景照片，缩到 1600px 宽存进 site/art/<slug>/NN.jpg
// 用法：node tools/fetch_photos.js            # 抓所有缺图的地区
//       node tools/fetch_photos.js kyoto dali # 只抓指定地区

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data', 'cards');
const ART_DIR = path.join(ROOT, 'site', 'art');
const CREDIT_FILE = path.join(ROOT, 'data', 'photo_credits.json');
const WIDTH = 1280;

const UA = 'DreamMapPhotoFetcher/1.0 (personal offline app; contact: local user)';

const STOP = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'with', 'for', 'from', 'into', 'over', 'near', 'along', 'a', 'an', 'its', 'their', 'during', 'view', 'looking', 'seen', 'shot', 'light', 'lit', 'day', 'night', 'early', 'late', 'noon', 'dusk', 'dawn', 'sunset', 'sunrise', 'golden', 'hour', 'blue', 'grey', 'gray', 'white', 'black', 'red', 'green', 'warm', 'cool', 'natural', 'clear', 'cloudy', 'misty', 'wide', 'full', 'close', 'long', 'short', 'small', 'large', 'big', 'high', 'low', 'old', 'new', 'modern', 'historic', 'ancient', 'traditional', 'famous', 'well', 'known']);
const BAD = /\b(map|maps|diagram|logo|coat|flag|flags|chart|plan|graph|icon|svg|symbol|seal|banner|poster|stamp|banknote|coin|signature|emblem|sketch|drawing|painting|paintings|engraving|lithograph|screenshot|qr|murillo|goya|watercolour|watercolor|postcard|model|models|replica|miniature|maquette|diorama)\b/i;
const BADCAT = /(paintings|drawings|engravings|prints|artworks|coats of arms|maps|diagrams|logos|banknotes|stamps|documents|books|models)/i;

// 个别检索词在 Commons 上命中太差，单独换词（键是卡牌 id）
const QUERY_FIX = {
  'amsterdam-03': 'Van Gogh Museum building Amsterdam exterior',
  'chongqing-04': '李子坝',
  'chongqing-08': '重庆 夜景',
  'chongqing-14': '鹅岭公园',
  'sydney-15': 'Luna Park Sydney',
  'switzerland-01': 'Matterhorn Zermatt',
  'switzerland-02': 'Jungfrau massif snow',
  'switzerland-04': 'Lake Lucerne',
  'switzerland-05': 'Interlaken Switzerland',
  'switzerland-07': 'Mürren village',
  'switzerland-11': 'Rheinfall Neuhausen waterfall falls',
  'iceland-01': 'Hallgrimskirkja Reykjavik church',
  'chongqing-15': '山城步道',
  'chongqing-20': '金佛山'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, timeout: 30000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : 'https://commons.wikimedia.org' + res.headers.location;
        return get(next, opts).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + url)); }
      if (opts.binary) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        let s = '';
        res.setEncoding('utf8');
        res.on('data', c => { s += c; });
        res.on('end', () => resolve(s));
      }
    });
    req.on('timeout', () => { req.destroy(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(Object.assign({
    format: 'json', formatversion: '2', action: 'query'
  }, params)).toString();
  // Commons 对匿名调用限流很紧，429 就退避重试
  const waits = [3000, 8000, 15000, 25000];
  for (let i = 0; i <= waits.length; i++) {
    try { return JSON.parse(await get(url)); }
    catch (e) {
      if (i === waits.length) throw e;
      await sleep(waits[i]);
    }
  }
}

/* 实在找不到特定景点的照片时，退一步用这一带的风光（仅作兜底） */
const REGION_FALLBACK = {
  dali: '洱海 大理',
  iceland: 'Iceland landscape',
  venice: 'Venice canal',
  amsterdam: 'Amsterdam canal',
  barcelona: 'Barcelona city',
  switzerland: 'Switzerland landscape',
  sydney: 'Sydney harbour',
  singapore: 'Singapore skyline',
  chongqing: '重庆 夜景',
  kyoto: 'Kyoto street'
};

/* ── 一张卡 → 若干检索词（从最贴题到最宽泛） ── */
function queriesFor(card, citySub, cityCN) {
  const out = [];
  const push = s => { s = (s || '').replace(/\s+/g, ' ').trim(); if (s && out.indexOf(s) < 0) out.push(s); };
  const toks = (card.subject || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w.toLowerCase()));
  if (QUERY_FIX[card.id]) push(QUERY_FIX[card.id]);
  push(card.name);
  push(card.q);
  if (cityCN) push(card.name + ' ' + cityCN);
  push(toks.slice(0, 8).join(' '));
  push(toks.slice(0, 5).join(' '));
  push(toks.slice(0, 3).join(' '));
  if (citySub) push(card.q ? card.q + ' ' + citySub : '');
  return out.slice(0, 6);
}

function tokensOf(q) {
  return q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
}

async function search(q, limit) {
  const r = await api({
    generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(WIDTH)
  });
  const pages = (r && r.query && r.query.pages) || [];
  return pages.map(p => {
    const ii = (p.imageinfo || [])[0];
    if (!ii) return null;
    const meta = ii.extmetadata || {};
    const pick = k => (meta[k] && meta[k].value) || '';
    return {
      title: p.title,
      url: ii.thumburl || ii.url,
      w: ii.thumbwidth || ii.width,
      h: ii.thumbheight || ii.height,
      mime: ii.mime,
      cat: pick('Categories'),
      page: ii.descriptionurl || '',
      author: pick('Artist').replace(/<[^>]*>/g, '').trim(),
      license: pick('LicenseShortName')
    };
  }).filter(Boolean);
}

/* 标题与卡片中文名的最长公共子串长度（用来给中文检索结果排序） */
function lcs(a, b) {
  if (!a || !b) return 0;
  let best = 0;
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}

function score(c, qtoks, card) {
  const t = c.title.toLowerCase();
  let s = 0;
  for (const w of qtoks) if (t.indexOf(w) >= 0) s += (w.length >= 6 ? 3 : 2);
  if (card && card.name) s += lcs(card.name, c.title.replace(/^File:/, '')) * 4;
  if (/\.jpe?g$/i.test(c.title)) s += 2;
  const ar = c.w / c.h;
  if (ar >= 1.2 && ar <= 2.1) s += 3;           // 横向照片，和胶片卡面更贴
  else if (ar > 1) s += 1;
  if (c.w >= 2400) s += 1;
  return s;
}

function ok(c) {
  if (!c || !c.url) return false;
  if (!/^image\/jpeg$/.test(c.mime || '')) return false;
  if (BAD.test(c.title)) return false;
  if (c.cat && BADCAT.test(c.cat)) return false;
  if ((c.w || 0) < 900 || (c.h || 0) < 600) return false;
  return true;
}

/* 直接点名某一张文件（检索排序不理想时用） */
const EXACT = {
  'switzerland-02': 'File:Jungfrau 2416.jpg'
};

async function byTitle(title) {
  const r = await api({ titles: title, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: String(WIDTH) });
  const p = (r && r.query && r.query.pages && r.query.pages[0]) || {};
  const ii = (p.imageinfo || [])[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const pick = k => (meta[k] && meta[k].value) || '';
  return {
    title: p.title, url: ii.thumburl || ii.url, w: ii.thumbwidth || ii.width, h: ii.thumbheight || ii.height,
    mime: ii.mime, cat: pick('Categories'), page: ii.descriptionurl || '',
    author: pick('Artist').replace(/<[^>]*>/g, '').trim(), license: pick('LicenseShortName')
  };
}

async function shotFor(card, citySub, used, cityCN, slug) {
  const cands = [];
  if (EXACT[card.id]) {
    try { const c = await byTitle(EXACT[card.id]); if (c) return c; } catch (e) { /* 继续走检索 */ }
  }
  for (const q of queriesFor(card, citySub, cityCN)) {
    let list = [];
    try { list = await search(q, 20); } catch (e) { await sleep(1200); continue; }
    for (const c of list) {
      if (!ok(c) || used.has(c.title)) continue;
      cands.push({ c, s: score(c, tokensOf(q), card) });
    }
    if (cands.length >= 8) break;
    await sleep(500);
  }
  if (!cands.length && REGION_FALLBACK[slug]) {
    try {
      const list = await search(REGION_FALLBACK[slug], 30);
      for (const c of list) {
        if (!ok(c) || used.has(c.title)) continue;
        cands.push({ c, s: score(c, [], card) - 1 });
      }
    } catch (e) { /* 兜底失败就算了 */ }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.s - a.s);
  return cands[0].c;
}

async function grab(url) {
  for (let i = 0; i < 3; i++) {
    try { return await get(url, { binary: true }); }
    catch (e) { if (i === 2) throw e; await sleep(1200 * (i + 1)); }
  }
}

async function runSlug(slug, credits, CONC = 2) {
  const raw = JSON.parse(fs.readFileSync(path.join(SRC_DIR, slug + '.json'), 'utf8'));
  const dir = path.join(ART_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const used = new Set();
  const made = [];
  const misses = [];
  let cursor = 0;

  async function worker() {
    while (cursor < raw.cards.length) {
      const i = cursor++;
      const nn = String(i + 1).padStart(2, '0');
      const out = path.join(dir, nn + '.jpg');
      const card = raw.cards[i];
      if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
        made.push({ idx: nn, name: card.name, skipped: true });
        continue;
      }
      const c = await shotFor(card, raw.sub, used, raw.city, slug);
      if (!c) { misses.push(i); console.log(`  ${nn} ✗ ${card.name}`); continue; }
      used.add(c.title);
      try {
        const buf = await grab(c.url);
        if (!buf || buf.length < 20000) throw new Error('empty');
        fs.writeFileSync(out, buf);
        made.push({ idx: nn, name: card.name, title: c.title, page: c.page, author: c.author, license: c.license, kb: Math.round(buf.length / 1024) });
        console.log(`  ${nn} ✓ ${card.name} ← ${c.title.replace('File:', '')} (${Math.round(buf.length / 1024)}KB)`);
      } catch (e) { misses.push(i); console.log(`  ${nn} ✗ 下载失败 ${card.name}`); }
      await sleep(500);
    }
  }

  await Promise.all(Array.from({ length: CONC }, worker));

  // 缺的再补一轮（请求偶发失败时很有效）
  for (const i of misses) {
    const nn = String(i + 1).padStart(2, '0');
    const card = raw.cards[i];
    if (fs.existsSync(path.join(dir, nn + '.jpg'))) continue;
    await sleep(2500);
    const c = await shotFor(card, raw.sub, used, raw.city, slug);
    if (!c) { made.push({ idx: nn, name: card.name, fail: true }); continue; }
    used.add(c.title);
    try {
      const buf = await grab(c.url);
      fs.writeFileSync(path.join(dir, nn + '.jpg'), buf);
      made.push({ idx: nn, name: card.name, title: c.title, page: c.page, author: c.author, license: c.license, kb: Math.round(buf.length / 1024) });
      console.log(`  ${nn} ✓（补）${card.name} ← ${c.title.replace('File:', '')}`);
    } catch (e) { made.push({ idx: nn, name: card.name, fail: true }); }
  }

  made.sort((a, b) => a.idx.localeCompare(b.idx));
  credits[slug] = made;
  const bad = made.filter(m => m.fail).length;
  console.log(`${slug}: 完成 ${made.length - bad} / ${raw.cards.length}${bad ? '（缺 ' + bad + ' 张）' : ''}`);
  return bad;
}

/* ── 巡检：把检索词根本不沾边的已下载图片列出来（人工/二次抓取用） ── */
function auditSlug(slug) {
  const raws = JSON.parse(fs.readFileSync(path.join(SRC_DIR, slug + '.json'), 'utf8'));
  const credits = fs.existsSync(CREDIT_FILE) ? JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf8')) : {};
  const list = credits[slug] || [];
  const warn = [];
  list.forEach(m => {
    if (!m.title) return;
    const t = m.title.toLowerCase();
    const card = raws.cards[+m.idx - 1] || {};
    const key = tokensOf(card.q || '').filter(w => w.length >= 4);
    if (key.length && !key.some(w => t.indexOf(w) >= 0)) warn.push(`${m.idx} ${m.name} ← ${m.title}`);
  });
  return warn;
}

(async () => {
  const want = process.argv.slice(2);
  let slugs = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
  if (want.length) slugs = slugs.filter(s => want.indexOf(s) >= 0);

  if (process.argv[2] === '--audit') {
    let n = 0;
    (want.length > 1 ? want.slice(1) : slugs).forEach(s => {
      const w = auditSlug(s);
      if (w.length) { console.log('【' + s + '】\n  ' + w.join('\n  ')); n += w.length; }
    });
    console.log('\n可疑 ' + n + ' 张');
    return;
  }

  const credits = fs.existsSync(CREDIT_FILE) ? JSON.parse(fs.readFileSync(CREDIT_FILE, 'utf8')) : {};
  let fails = 0;
  for (const s of slugs) {
    console.log('▶ ' + s);
    try { fails += await runSlug(s, credits); }
    catch (e) { console.log('  ✗ ' + s + ' 失败：' + e.message); fails++; }
  }
  fs.writeFileSync(CREDIT_FILE, JSON.stringify(credits, null, 2), 'utf8');
  console.log('\n全部完成，缺失 ' + fails + ' 张。来源已记到 data/photo_credits.json');
})();
