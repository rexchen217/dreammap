/* ══════════════════════════════════════════════
   梦想地图 · 存档与云同步
   同步模式沿用 NoteHub：自建零依赖 Node 服务 + ?key= 密钥 + 本地改动防抖推送 /
   启动与回到前台时拉取 / 失败静默降级。
   合并策略：进度类只增不减（取 max / 并集），便利贴按 id + updatedAt 后写胜出，
   删除用墓碑记录（保留 90 天）。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const { nowISO, uid, pick, randInt, dateKey, dayStart } = window.UI;

  const KEY = 'dreammap.save.v1';
  const TOMB_KEEP_MS = 90 * 86400000;

  const REWARD = { small: 20, goal: 80, dream: 500 };
  const PULL_COST = 100;        // 心愿币随机目的地单抽
  const TEN_COST = 900;         // 十连（原价 1000）
  const TICKET_COST = 140;      // 商店购买指定地区单抽券
  const GOAL_TICKET_CHANCE = 0.15;
  const UR_RATE = 0.08, UR_PITY = 15;
  const FEAT_PITY = 10;         // 本月限定目的地的保底抽数
  const PIGGY_RATE = 0.02, PIGGY_MAX = 800;   // 存钱罐：每天 2%，上限 800
  const START_COINS = 7200;     // 新存档的初始心愿币（清空数据后也回到这个数）

  const CITY_SLUGS = (window.DM_CITIES || []).map(c => c.slug);

  function blank() {
    return {
      v: 1, rev: 0,
      profile: { nickname: '', avatar: 'm1', dream: '', bio: '', createdAt: '', updatedAt: '' },
      notes: [], tombstones: [],
      acc: { earned: START_COINS, spent: 0, tickE: {}, tickS: {}, pickE: 0, pickS: 0 },
      own: {}, pulls: {}, pity: {},
      piggy: { at: '', saved: 0, total: 0 },
      chain: { done: [] },
      unlock: { colors: [], stickers: [] },
      claimed: {}, log: [], seenDream: 0,
      sync: { url: '', key: '', at: '' },
      set: { theme: 'dusk', sfx: 0.6 }
    };
  }

  let S = blank();
  const listeners = [];
  const on = fn => listeners.push(fn);
  const emit = why => listeners.forEach(f => { try { f(why); } catch (e) { console.warn(e); } });

  function normalize(raw) {
    const b = blank();
    const s = Object.assign(b, raw || {});
    s.profile = Object.assign(b.profile, s.profile || {});
    s.acc = Object.assign(b.acc, s.acc || {});
    s.sync = Object.assign(b.sync, s.sync || {});
    s.set = Object.assign(b.set, s.set || {});
    if (typeof s.set.sfx !== 'number' || !isFinite(s.set.sfx)) s.set.sfx = 0.6;
    s.set.sfx = Math.max(0, Math.min(1, s.set.sfx));
    ['notes', 'tombstones', 'log'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
    ['own', 'pulls', 'pity', 'claimed'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    if (!s.unlock || typeof s.unlock !== 'object') s.unlock = { colors: [], stickers: [] };
    ['colors', 'stickers'].forEach(k => { if (!Array.isArray(s.unlock[k])) s.unlock[k] = []; });
    s.piggy = Object.assign({ at: '', saved: 0, total: 0 }, s.piggy || {});
    s.chain = Object.assign({ done: [] }, s.chain || {});
    if (!Array.isArray(s.chain.done)) s.chain.done = [];
    if (!s.acc.tickE || typeof s.acc.tickE !== 'object') s.acc.tickE = {};
    if (!s.acc.tickS || typeof s.acc.tickS !== 'object') s.acc.tickS = {};
    s.acc.earned = +s.acc.earned || 0;
    if (s.acc.earned < START_COINS) s.acc.earned = START_COINS;   // 老存档补到初始值
    s.acc.spent = +s.acc.spent || 0;
    s.acc.pickE = +s.acc.pickE || 0;
    s.acc.pickS = +s.acc.pickS || 0;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S = normalize(JSON.parse(raw));
    } catch (e) { console.warn('存档读取失败', e); S = blank(); }
    return S;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { console.warn('存档写入失败', e); }
  }
  function touch(why) {
    S.rev = (S.rev || 0) + 1;
    save(); emit(why);
    if (why !== 'sync' && why !== 'boot') pushSoon();
  }

  /* ══════ 货币 ══════ */
  const coins = () => Math.max(0, S.acc.earned - S.acc.spent);
  function grantCoins(n, silent) {
    if (n <= 0) return 0;
    S.acc.earned += n;
    if (!silent) touch('coins');
    return n;
  }
  function spendCoins(n) {
    if (coins() < n) return false;
    S.acc.spent += n; touch('coins'); return true;
  }

  /* ══════ 城市单抽券 ══════ */
  const tickets = slug => Math.max(0, (S.acc.tickE[slug] || 0) - (S.acc.tickS[slug] || 0));
  const ticketsAll = () => CITY_SLUGS.reduce((a, s) => a + tickets(s), 0);
  function giveTicket(slug, n) {
    n = n || 1;
    S.acc.tickE[slug] = (S.acc.tickE[slug] || 0) + n;
    touch('coins');
  }
  function useTicket(slug) {
    if (tickets(slug) <= 0) return false;
    S.acc.tickS[slug] = (S.acc.tickS[slug] || 0) + 1; touch('coins'); return true;
  }
  function randomTicketCity() {
    const open = CITY_SLUGS.filter(s => cityPulled(s) < 20);
    return pick(open.length ? open : CITY_SLUGS);
  }

  /* ══════ UR 自选券 ══════ */
  const picks = () => Math.max(0, S.acc.pickE - S.acc.pickS);
  function givePick(n) { S.acc.pickE += (n || 1); touch('coins'); }
  function usePick() { if (picks() <= 0) return false; S.acc.pickS += 1; touch('coins'); return true; }

  /* ══════ 便利贴 ══════ */
  function addNote(o) {
    const at = nowISO();
    const n = {
      id: uid('nt'), type: o.type || 'small', text: o.text || '',
      color: o.color || 'sun', sticker: o.sticker || 'pin',
      x: Math.round(o.x || 60), y: Math.round(o.y || 60),
      createdAt: at, updatedAt: at, status: 'active'
    };
    if (o.cardId) n.cardId = o.cardId;
    if (o.img) n.img = o.img;
    if (o.font) n.font = o.font;
    S.notes.push(n);
    if (n.type === 'dream' && !S.profile.dream) { S.profile.dream = n.text; S.profile.updatedAt = at; }
    touch('notes'); return n;
  }
  function updateNote(id, patch) {
    const n = S.notes.find(x => x.id === id);
    if (!n) return null;
    Object.assign(n, patch, { updatedAt: nowISO() });
    touch('notes'); return n;
  }
  function dropNote(id) {
    const at = nowISO();
    S.notes = S.notes.filter(x => x.id !== id);
    S.tombstones.push({ id, deletedAt: at });
    touch('notes');
  }
  // 标记完成：便利贴留在数据里（统计要用），墙上不再显示
  function doneNote(id) {
    const n = S.notes.find(x => x.id === id);
    if (!n || n.status === 'done') return null;
    const at = nowISO();
    n.status = 'done'; n.doneAt = at; n.updatedAt = at;

    // 连击：当天第 2 个起每条额外 +5，最多 +25
    const today = dateKey(at);
    const doneToday = S.notes.filter(x => x.status === 'done' && dateKey(x.doneAt) === today).length;
    const combo = Math.min(Math.max(doneToday - 1, 0), 5) * 5;
    const base = REWARD[n.type] || REWARD.small;
    n.granted = base + combo;
    n.comboBonus = combo;
    grantCoins(n.granted, true);

    let ticket = null;
    if (n.type === 'goal' && Math.random() < GOAL_TICKET_CHANCE) {
      ticket = randomTicketCity(); giveTicket(ticket, 1);
    }
    if (n.type === 'dream') { givePick(1); S.seenDream = (S.seenDream || 0) + 1; }
    if (n.parent) stepDone(n.id);

    touch('notes');
    return { note: n, base, combo, ticket, allDone: S.notes.filter(x => x.status === 'active').length === 0 };
  }
  const activeNotes = () => S.notes.filter(n => n.status === 'active');
  const doneNotes = () => S.notes.filter(n => n.status === 'done');
  const noteById = id => S.notes.find(n => n.id === id);
  const notesOf = type => S.notes.filter(n => n.type === type);

  /* ══════ 收集 ══════ */
  const hasCard = id => !!S.own[id];
  const cityPulled = slug => (S.pulls[slug] || 0);
  function ownCard(id) {
    if (S.own[id]) return false;
    S.own[id] = nowISO(); touch('collect'); return true;
  }
  const cityOwned = slug => (window.DM_CARDS || []).filter(c => c.citySlug === slug && S.own[c.id]).length;
  const totalOwned = () => Object.keys(S.own).length;

  /* ══════ 保底 ══════ */
  function pityOf(slug) {
    if (!S.pity[slug]) S.pity[slug] = { n: 0, ur: 0 };
    return S.pity[slug];
  }

  /* ═══════════════════════════════════════════
     玩法扩展
     ═══════════════════════════════════════════ */

  /* ── 打卡链：集齐一处，就把下一站的车票塞给你 ── */
  const fullSlugs = () => CITY_SLUGS.filter(s => cityOwned(s) >= 20);
  function chainNext(slug) {
    const i = CITY_SLUGS.indexOf(slug);
    if (i < 0) return null;
    for (let k = 1; k <= CITY_SLUGS.length; k++) {
      const s = CITY_SLUGS[(i + k) % CITY_SLUGS.length];
      if (cityOwned(s) < 20) return s;
    }
    return null;
  }
  function chainGift(slug) {
    if (!slug || S.chain.done.indexOf(slug) >= 0) return null;
    const nx = chainNext(slug);
    S.chain.done.push(slug);
    if (!nx) { touch('chain'); return null; }
    giveTicket(nx, 1);
    touch('chain');
    return nx;
  }

  /* ── 本月限定目的地：每月轮换，UR 概率翻倍、保底只要 10 抽 ── */
  function featuredSlug() {
    if (!CITY_SLUGS.length) return null;
    const d = new Date();
    const i = (d.getFullYear() * 12 + d.getMonth()) % CITY_SLUGS.length;
    return CITY_SLUGS[i];
  }
  function isFeatured(slug) { return !!slug && slug === featuredSlug(); }

  /* ── 存钱罐：存进去的心愿币每天生 2% 利息，上限 800 ── */
  function settlePiggy() {
    const p = S.piggy;
    if (!p.at) { p.at = nowISO(); return p.saved; }
    if (p.saved <= 0) { p.at = nowISO(); return 0; }
    const t0 = new Date(p.at).getTime();
    const days = Math.floor((Date.now() - t0) / 86400000);
    if (days > 0) {
      const add = Math.min(PIGGY_MAX - p.saved, Math.max(1, Math.round(p.saved * PIGGY_RATE * days)));
      p.saved += add;
      p.total = (p.total || 0) + add;
      p.at = new Date(t0 + days * 86400000).toISOString();
      save();
    }
    return p.saved;
  }
  function piggyDeposit(n) {
    settlePiggy();
    n = Math.floor(Math.min(+n || 0, PIGGY_MAX - S.piggy.saved));
    if (n <= 0) return 0;
    if (!spendCoins(n)) return 0;
    S.piggy.saved += n;
    touch('piggy');
    return n;
  }
  function piggyTake() {
    settlePiggy();
    const n = Math.round(S.piggy.saved);
    if (n <= 0) return 0;
    S.piggy.saved = 0;
    S.piggy.at = nowISO();
    grantCoins(n, true);
    touch('piggy');
    return n;
  }

  /* ── 梦想里程碑：把大梦想拆成能今天就做的小事 ── */
  function addStep(dreamId, text, pos) {
    const d = S.notes.find(n => n.id === dreamId);
    if (!d || d.status === 'done') return null;
    text = (text || '').trim();
    if (!text) return null;
    d.steps = d.steps || [];
    if (d.steps.length >= 6) return null;
    const child = addNote({
      type: 'small', text: text, color: 'mint', sticker: 'pin',
      x: (pos && pos.x) || 60, y: (pos && pos.y) || 60
    });
    child.parent = dreamId;
    d.steps.push({ id: child.id, text: text, at: nowISO(), doneAt: '' });
    touch('notes');
    return child;
  }
  function stepsOf(dreamId) {
    const d = S.notes.find(n => n.id === dreamId);
    return (d && d.steps) || [];
  }
  function stepDone(childId) {
    const d = S.notes.filter(n => n.steps).find(n => n.steps.some(s => s.id === childId));
    if (!d) return null;
    const st = d.steps.find(s => s.id === childId);
    if (!st || st.doneAt) return null;
    st.doneAt = nowISO();
    return d;
  }
  function dropStep(dreamId, stepId) {
    const d = S.notes.find(n => n.id === dreamId);
    if (!d || !d.steps) return;
    d.steps = d.steps.filter(s => s.id !== stepId);
    touch('notes');
  }

  /* ══════ 外观解锁 ══════ */
  const hasColor = id => {
    const c = window.UI.colorOf(id);
    return !!c.free || S.unlock.colors.indexOf(id) >= 0;
  };
  const hasSticker = id => {
    const s = window.UI.stickerOf(id);
    return !!s.free || S.unlock.stickers.indexOf(id) >= 0;
  };
  function unlockColor(id) {
    if (hasColor(id)) return false;
    const c = window.UI.colorOf(id);
    if (!spendCoins(c.cost || 0)) return false;
    S.unlock.colors.push(id); touch('unlock'); return true;
  }
  function unlockSticker(id) {
    if (hasSticker(id)) return false;
    const s = window.UI.stickerOf(id);
    if (!spendCoins(s.cost || 0)) return false;
    S.unlock.stickers.push(id); touch('unlock'); return true;
  }

  /* ══════ 抽卡记录 ══════ */
  function addLog(rec) {
    S.log.unshift(rec);
    if (S.log.length > 60) S.log.length = 60;
  }

  /* ══════ 收集度奖励 ══════ */
  const MILESTONES = [
    { n: 5, coins: 120, label: '初到此地' },
    { n: 10, coins: 220, label: '熟悉街巷' },
    { n: 15, coins: 360, label: '半个本地人' },
    { n: 20, coins: 600, ticket: 2, label: '集齐一座城' }
  ];
  const claimKey = (slug, n) => 'city:' + slug + ':' + n;
  const isClaimed = k => !!S.claimed[k];
  function claim(k, coins, ticket) {
    if (S.claimed[k]) return false;
    S.claimed[k] = nowISO();
    if (coins) grantCoins(coins, true);
    if (ticket) giveTicket(k.split(':')[1], ticket);
    touch('coins');
    return true;
  }
  // 成就奖励：单抽券随机落到一个还没集齐的地区，自选券直接进账
  function claimAch(k, coins, ticket, pick) {
    if (S.claimed[k]) return false;
    S.claimed[k] = nowISO();
    if (coins) grantCoins(coins, true);
    if (ticket) giveTicket(randomTicketCity(), ticket);
    if (pick) givePick(pick);
    touch('coins');
    return true;
  }

  /* ══════ 档案 ══════ */
  function setProfile(patch) {
    Object.assign(S.profile, patch, { updatedAt: nowISO() });
    touch('profile');
  }
  function setSfx(v) {
    S.set.sfx = Math.max(0, Math.min(1, +v || 0));
    touch('set');
  }
  function setSync(url, key) {
    S.sync.url = url || ''; S.sync.key = key || '';
    touch('sync-setting');
  }

  /* ═══════════════════════════════════════════
     云同步
     ═══════════════════════════════════════════ */
  const syncState = { st: 'off', msg: '', at: '' };
  function setSyncState(st, msg) {
    syncState.st = st; syncState.msg = msg || ''; syncState.at = nowISO();
    emit('sync-state');
  }
  const syncOn = () => !!(S.sync.url && S.sync.key);

  function syncUrl(path) {
    let base = (S.sync.url || '').trim().replace(/\/+$/, '');
    if (!base) return null;
    if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
    base = base.replace(/\/api\/sync$/i, '');   // 直接粘贴完整接口地址也能用
    return base + path + '?key=' + encodeURIComponent(S.sync.key || '');
  }

  const numMax = (a, b) => Math.max(+a || 0, +b || 0);
  function mapMax(a, b) {
    const out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(k => { out[k] = numMax(out[k], b[k]); });
    return out;
  }

  function merge(local, remote) {
    if (!remote) return local;
    const L = normalize(local), R = normalize(remote);
    const out = normalize(L);
    out.rev = Math.max(L.rev || 0, R.rev || 0) + 1;

    // 档案：后写胜出
    const lp = new Date(L.profile.updatedAt || 0).getTime();
    const rp = new Date(R.profile.updatedAt || 0).getTime();
    out.profile = rp > lp ? R.profile : L.profile;

    // 便利贴：按 id 后写胜出
    const map = {};
    L.notes.concat(R.notes).forEach(n => {
      const t = new Date(n.updatedAt || 0).getTime();
      if (!map[n.id] || new Date(map[n.id].updatedAt || 0).getTime() < t) map[n.id] = n;
    });
    // 墓碑
    const tombs = {};
    L.tombstones.concat(R.tombstones).forEach(t => {
      if (!t || !t.id) return;
      if (!tombs[t.id] || new Date(tombs[t.id].deletedAt || 0) < new Date(t.deletedAt || 0)) tombs[t.id] = t;
    });
    const cutoff = Date.now() - TOMB_KEEP_MS;
    out.tombstones = Object.values(tombs).filter(t => new Date(t.deletedAt || 0).getTime() > cutoff);
    const dead = {};
    out.tombstones.forEach(t => { dead[t.id] = new Date(t.deletedAt || 0).getTime(); });
    out.notes = Object.values(map).filter(n => !(dead[n.id] && new Date(n.updatedAt || 0).getTime() <= dead[n.id]));

    // 进度类：只增不减
    out.acc.earned = numMax(L.acc.earned, R.acc.earned);
    out.acc.spent = numMax(L.acc.spent, R.acc.spent);
    out.acc.pickE = numMax(L.acc.pickE, R.acc.pickE);
    out.acc.pickS = numMax(L.acc.pickS, R.acc.pickS);
    out.acc.tickE = mapMax(L.acc.tickE, R.acc.tickE);
    out.acc.tickS = mapMax(L.acc.tickS, R.acc.tickS);
    if (out.acc.spent > out.acc.earned) out.acc.earned = out.acc.spent;

    // 收集：并集，保留更早的时间
    out.own = Object.assign({}, R.own);
    Object.keys(L.own).forEach(id => {
      if (!out.own[id] || L.own[id] < out.own[id]) out.own[id] = L.own[id];
    });

    out.pulls = mapMax(L.pulls, R.pulls);
    out.claimed = Object.assign({}, R.claimed, L.claimed);
    out.seenDream = numMax(L.seenDream, R.seenDream);

    // 存钱罐：取余额更高的一侧；打卡链取并集
    out.piggy = (R.piggy.saved > L.piggy.saved) ? R.piggy : L.piggy;
    out.chain = { done: Array.from(new Set(L.chain.done.concat(R.chain.done))) };

    // 保底计数：整体取版本号更高的一侧
    out.pity = (R.rev > L.rev) ? R.pity : L.pity;

    // 已解锁的外观：并集
    out.unlock = {
      colors: Array.from(new Set(L.unlock.colors.concat(R.unlock.colors))),
      stickers: Array.from(new Set(L.unlock.stickers.concat(R.unlock.stickers)))
    };

    // 抽卡记录：按时间合并，取最近 60
    const seen = {};
    out.log = L.log.concat(R.log).filter(r => {
      if (!r) return false;
      const k = (r.at || '') + '|' + (r.cardId || '');
      if (seen[k]) return false;
      seen[k] = 1; return true;
    }).sort((a, b) => (b.at || '') < (a.at || '') ? -1 : 1).slice(0, 60);

    out.sync = L.sync && L.sync.url ? L.sync : R.sync;
    out.set = L.set;
    return out;
  }

  async function doSync(reason) {
    if (!syncOn()) { setSyncState('off'); return false; }
    if (syncState.st === 'syncing') return false;
    setSyncState('syncing');
    try {
      const pullUrl = syncUrl('/api/sync');
      let remote = null;
      const rs = await fetch(pullUrl, { cache: 'no-store' });
      if (rs.ok) {
        const txt = await rs.text();
        if (txt && txt.trim()) remote = JSON.parse(txt);
      }
      const merged = merge(S, remote);

      // 若远端更落后，则把合并结果推回去
      const ahead = merged.rev > (remote && remote.rev || 0);
      S = merged;
      save();
      emit('sync-merge');

      if (ahead || !remote) {
        const ps = await fetch(syncUrl('/api/sync'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(S)
        });
        if (!ps.ok) throw new Error('HTTP ' + ps.status);
      }
      S.sync.at = nowISO(); save();
      setSyncState('ok');
      return true;
    } catch (e) {
      console.warn('同步失败', e);
      setSyncState('err', e && e.message || '网络不可用');
      return false;
    }
  }

  let pushTimer = null;
  function pushSoon() {
    if (!syncOn()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (syncState.st === 'syncing') { pushSoon(); return; }
      setSyncState('syncing');
      fetch(syncUrl('/api/sync'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(S)
      }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        S.sync.at = nowISO(); save();
        setSyncState('ok');
      }).catch(e => setSyncState('err', e && e.message));
    }, 1500);
  }

  let lastPull = 0;
  function pullThrottled() {
    if (!syncOn()) return;
    if (Date.now() - lastPull < 60000) return;
    lastPull = Date.now();
    doSync('foreground');
  }

  function wipe() {
    const keepSync = { url: S.sync.url, key: S.sync.key };
    S = blank();
    S.sync = Object.assign(S.sync, keepSync);
    save(); emit('wipe');
  }

  window.ST = {
    get S() { return S; },
    load, save, touch, on, normalize,
    REWARD, PULL_COST, TEN_COST, TICKET_COST, UR_RATE, UR_PITY, FEAT_PITY, PIGGY_MAX, CITY_SLUGS, MILESTONES,
    coins, grantCoins, spendCoins,
    tickets, ticketsAll, giveTicket, useTicket, randomTicketCity,
    picks, givePick, usePick,
    addNote, updateNote, dropNote, doneNote, activeNotes, doneNotes, noteById, notesOf,
    hasCard, ownCard, cityOwned, cityPulled, totalOwned, own: () => S.own,
    pityOf, addLog, addLogRecord: addLog,
    fullSlugs, chainNext, chainGift, featuredSlug, isFeatured,
    piggyBalance: settlePiggy, piggyDeposit, piggyTake, settlePiggy,
    addStep, stepsOf, stepDone, dropStep,
    MILESTONE_CLAIM: claim, claimKey, isClaimed, ACH_CLAIM: claimAch,
    hasColor, hasSticker, unlockColor, unlockSticker,
    setProfile, setSync, setSfx, wipe,
    syncState, syncOn, syncNow: doSync, pullThrottled, syncUrl,
    merge
  };
})();
