// 从网络抓取真实照片填充 site/art/<slug>/NN.jpg（不使用 AI 生成）
// 用法: node tools/fetch_art.js <slug> [slug...] [--force] [--limit N]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'site', 'art');
const CARDS = path.join(ROOT, 'data', 'cards');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' };
const BAD_HOST = /(shutterstock|dreamstime|alamy|istockphoto|gettyimages|depositphotos|123rf|adobe|stockphoto|vecteezy|freepik|tuchong|zcool|699pic|58pic|duitang|nipic|photophoto|pixabay|lookphotos|agefotostock|imago-images|bridgeman)/i;

const args = process.argv.slice(2);
const force = args.includes('--force');
const limit = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1], 10) : Infinity; })();
const slugs = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
if (!slugs.length) { console.error('用法: node tools/fetch_art.js <slug> [...] [--force] [--limit N]'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, timeout = 15000, extra = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    return await fetch(url, { headers: { ...HEADERS, ...extra }, signal: c.signal, redirect: 'follow' });
  } finally { clearTimeout(t); }
}

function soSearch(query) {
  return get(`https://image.so.com/j?q=${encodeURIComponent(query)}&src=srp&sn=0&pn=30`, 18000, { Referer: 'https://image.so.com/' })
    .then(r => r.json())
    .then(j => (j.list || []).filter(x => x.img).map(x => ({ u: x.img, w: x.width || 0, h: x.height || 0 })));
}

async function baiduSearch(query) {
  const r = await get(`https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&word=${encodeURIComponent(query)}&pn=0&rn=30`, 18000,
    { Referer: 'https://image.baidu.com/search/index?tn=baiduimage&word=' + encodeURIComponent(query) });
  const j = await r.json();
  return (j.data || []).filter(x => x.middleURL).map(x => ({ u: x.middleURL, w: x.width || 0, h: x.height || 0 }));
}

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }

function score(c) {
  if (!c.w || !c.h) return 3;
  if (c.w >= 1200) return 0;
  if (c.w >= 1000) return 1;
  if (c.w >= 700) return 2;
  return 3;
}

async function gather(query) {
  let list = [];
  try { list = list.concat(await soSearch(query)); } catch (e) { }
  if (list.filter(c => score(c) <= 1).length < 2) {
    try { list = list.concat(await baiduSearch(query)); } catch (e) { }
  }
  const seen = new Set();
  list = list.filter(c => {
    if (!c.u || BAD_HOST.test(hostOf(c.u))) return false;
    const k = c.u.split('?')[0];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  list.forEach(c => c.s = score(c));
  list.sort((a, b) => a.s - b.s);
  return list;
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function writeWithRetry(dest, buf) {
  for (let i = 0; i < 3; i++) {
    try { fs.writeFileSync(dest, buf); return true; }
    catch (e) {
      if (i === 2) {
        try { const tmp = dest + '.tmp'; fs.writeFileSync(tmp, buf); fs.renameSync(tmp, dest); return true; }
        catch (e2) { console.log('  写入失败', path.basename(dest), e2.code); return false; }
      }
      const until = Date.now() + 1200;
      while (Date.now() < until) { }
    }
  }
  return false;
}

async function tryDownload(cands, dest, used) {
  let best = null;
  let tries = 0;
  for (const c of cands) {
    if (tries >= 12) break;
    if (best && best.s === 0) break;
    tries++;
    try {
      const r = await get(c.u, 12000, { Accept: 'image/*' });
      if (!r.ok) continue;
      const ct = r.headers.get('content-type') || '';
      if (!/image\/(jpeg|jpg|png|webp)/i.test(ct)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 60000) continue;
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (used.hashes.has(hash) || used.urls.has(c.u.split('?')[0])) continue;
      const s = jpegSize(buf);
      if (s && s.w < 500) continue;
      const sc = s ? score({ w: s.w, h: s.h }) : 2;
      if (!best || sc < best.s) best = { buf, s, u: c.u, hash, sc };
    } catch { /* 下一个 */ }
  }
  if (best && writeWithRetry(dest, best.buf)) {
    used.hashes.add(best.hash);
    used.urls.add(best.u.split('?')[0]);
    return best;
  }
  return null;
}

(async () => {
  for (const slug of slugs) {
    const file = path.join(CARDS, slug + '.json');
    if (!fs.existsSync(file)) { console.log(`${slug}: 缺少数据文件`); continue; }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const dir = path.join(ART, slug);
    fs.mkdirSync(dir, { recursive: true });
    const used = { hashes: new Set(), urls: new Set() };
    let done = 0, skipped = 0, failed = [];
    for (let i = 0; i < data.cards.length && done + skipped < limit; i++) {
      const card = data.cards[i];
      const nn = String(i + 1).padStart(2, '0');
      const dest = path.join(dir, nn + '.jpg');
      if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 50000) {
        used.hashes.add(crypto.createHash('md5').update(fs.readFileSync(dest)).digest('hex'));
        skipped++; continue;
      }
      const queries = [`${data.city} ${card.name}`, `${card.name} ${data.city} 景点`, card.subject || card.name];
      let hit = null;
      for (const q of queries) {
        let cands = [];
        try { cands = await gather(q); } catch (e) { console.log('  搜索失败', q, e.message); }
        if (!cands.length) continue;
        hit = await tryDownload(cands, dest, used);
        if (hit) break;
        await sleep(500);
      }
      if (hit) {
        done++;
        console.log(`  ${nn} ${card.name}  <- ${hit.s ? hit.s.w + 'x' + hit.s.h : '?'} ${Math.round(hit.buf.length / 1024)}KB ${hostOf(hit.u)}`);
      } else {
        failed.push(`${nn} ${card.name}`);
        console.log(`  ${nn} ${card.name}  未取到`);
      }
      await sleep(700);
    }
    const total = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
    console.log(`${slug}: 新抓 ${done}，跳过 ${skipped}，目录共 ${total}；失败 ${failed.length}${failed.length ? ' -> ' + failed.join('; ') : ''}`);
  }
})();
