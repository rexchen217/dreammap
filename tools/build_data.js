// 梦想地图 · 卡牌数据合成脚本
// 读取 data/cards/*.json（唯一数据源），产出：
//   1) data/cards.json        —— 合并数据 + 最终图片 prompt（供图片生成使用）
//   2) site/js/cards.data.js  —— 前端内联数据（window.DM_CITIES / window.DM_CARDS）
// 用法：node tools/build_data.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data', 'cards');

// 地点顺序（地图与相册都按这个顺序排）
const CITY_ORDER = [
  'beijing', 'shanghai', 'hongkong', 'hangzhou', 'tokyo',
  'newyork', 'london', 'paris', 'srilanka', 'rome',
  'kyoto', 'singapore', 'dali', 'chongqing',
  'iceland', 'venice', 'amsterdam', 'barcelona', 'switzerland', 'sydney'
];

// 大洲归类：相册按这个分组
const CONTINENT = {
  beijing: 'asia', shanghai: 'asia', hongkong: 'asia', hangzhou: 'asia', tokyo: 'asia',
  kyoto: 'asia', singapore: 'asia', dali: 'asia', chongqing: 'asia', srilanka: 'asia',
  london: 'europe', paris: 'europe', rome: 'europe', iceland: 'europe', venice: 'europe',
  amsterdam: 'europe', barcelona: 'europe', switzerland: 'europe',
  newyork: 'namerica',
  sydney: 'oceania'
};

// 整片地方就是一个国家（收集度最后一档文案用「国」）
const COUNTRY = ['srilanka', 'singapore', 'iceland', 'switzerland'];

const PFX = 'Photorealistic travel photograph of ';
const SFX = ', shot on 35mm film with Kodak Portra 400, natural daylight, fine film grain, ultra realistic, high detail, travel photography, no text, no watermark, no people looking at camera';

function readCity(slug) {
  const p = path.join(SRC_DIR, slug + '.json');
  if (!fs.existsSync(p)) throw new Error('缺少城市数据文件：' + p);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!raw.cards || raw.cards.length !== 20) {
    throw new Error(`${slug}: 卡牌数量应为 20，实际 ${raw.cards ? raw.cards.length : 0}`);
  }
  const urs = raw.cards.filter(c => c.rarity === 'UR');
  const srs = raw.cards.filter(c => c.rarity === 'SR');
  if (urs.length !== 1) throw new Error(`${slug}: UR 应为 1 张，实际 ${urs.length}`);
  if (srs.length !== 19) throw new Error(`${slug}: SR 应为 19 张，实际 ${srs.length}`);

  return {
    slug: raw.citySlug || slug,
    city: raw.city,
    sub: raw.sub,
    cards: raw.cards.map((c, i) => {
      const nn = String(i + 1).padStart(2, '0');
      const file = `art/${slug}/${nn}.jpg`;
      return {
        id: c.id || `${slug}-${nn}`,
        city: raw.city,
        citySlug: slug,
        idx: i + 1,
        name: c.name,
        rarity: c.rarity,
        intro: c.intro,
        subject: c.subject,
        prompt: PFX + c.subject + SFX,
        file
      };
    })
  };
}

const cities = CITY_ORDER.map(readCity);
const allCards = cities.flatMap(c => c.cards);

// 校验 id 唯一
const seen = new Set();
for (const c of allCards) {
  if (seen.has(c.id)) throw new Error('卡牌 id 重复：' + c.id);
  seen.add(c.id);
}

// ---- 产出 1：合并数据（含 prompt） ----
fs.writeFileSync(
  path.join(ROOT, 'data', 'cards.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), cities }, null, 2),
  'utf8'
);

// ---- 产出 2：前端内联数据 ----
const slimCards = allCards.map(c => ({
  id: c.id, city: c.city, citySlug: c.citySlug, idx: c.idx,
  name: c.name, rarity: c.rarity, intro: c.intro, file: c.file
}));
const slimCities = cities.map(c => ({
  slug: c.slug, city: c.city, sub: c.sub,
  cont: CONTINENT[c.slug] || 'asia',
  kind: COUNTRY.indexOf(c.slug) >= 0 ? 'country' : 'city',
  total: c.cards.length,
  urId: c.cards.find(x => x.rarity === 'UR').id
}));

const js = `/* 自动生成，请勿手改 —— 源数据见 data/cards/*.json，重新生成：node tools/build_data.js */
window.DM_CITIES = ${JSON.stringify(slimCities, null, 1)};
window.DM_CARDS = ${JSON.stringify(slimCards, null, 1)};
`;
fs.writeFileSync(path.join(ROOT, 'site', 'js', 'cards.data.js'), js, 'utf8');

// ---- 报告 ----
console.log(`城市 ${cities.length} 个，卡牌 ${allCards.length} 张（UR ${allCards.filter(c => c.rarity === 'UR').length} / SR ${allCards.filter(c => c.rarity === 'SR').length}）`);
console.log('→ data/cards.json');
console.log('→ site/js/cards.data.js');
const bad = [];
for (const c of allCards) {
  const len = [...c.intro].length;
  if (len < 85 || len > 115) bad.push(`${c.id} ${c.name} 介绍 ${len} 字`);
}
if (bad.length) console.log('介绍字数超出 85-115 字：\n' + bad.join('\n'));
else console.log('全部介绍字数落在 85-115 字区间内。');
