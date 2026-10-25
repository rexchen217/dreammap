/* ══════════════════════════════════════════════
   梦想地图 · 成就
   全局成就：事件、梦想、收藏、打卡、抽卡、存钱罐。
   收集度奖励（每个地区 5 / 10 / 15 / 20 张）也并入同一块面板。
   达成后手动领取，避免奖励被悄悄塞进钱包。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, esc, burst, toast } = U;

  const doneAll = () => ST.doneNotes().length;
  const dreamsDone = () => ST.doneNotes().filter(n => n.type === 'dream').length;
  const pulls = () => Object.keys(ST.S.pulls || {}).reduce((a, k) => a + (ST.S.pulls[k] || 0), 0);
  const urs = () => Object.keys(ST.S.own || {}).filter(id => {
    const c = (window.DM_CARDS || []).find(x => x.id === id);
    return c && c.rarity === 'UR';
  }).length;

  const LIST = [
    { id: 'first-done', ic: '✓', name: '开个好头', desc: '完成 1 件事件', need: 1, get: doneAll, coins: 50 },
    { id: 'done-10', ic: '✓', name: '说到做到', desc: '累计完成 10 件事件', need: 10, get: doneAll, coins: 150 },
    { id: 'done-30', ic: '✚', name: '行动派', desc: '累计完成 30 件事件', need: 30, get: doneAll, coins: 400, ticket: 1 },
    { id: 'dream-write', ic: '✎', name: '敢想', desc: '写下第 1 个梦想', need: 1, get: () => ST.notesOf('dream').length, coins: 100 },
    { id: 'dream-1', ic: '★', name: '美梦成真', desc: '完成 1 个梦想', need: 1, get: dreamsDone, coins: 300 },
    { id: 'dream-3', ic: '★', name: '心之所向', desc: '完成 3 个梦想', need: 3, get: dreamsDone, coins: 800, pick: 1 },
    { id: 'wall-5', ic: '▤', name: '墙上热闹', desc: '墙上同时贴 5 张便利贴', need: 5, get: () => ST.activeNotes().length, coins: 100 },
    { id: 'photo-wall', ic: '▣', name: '钉在墙上', desc: '把 1 张照片贴上目标墙', need: 1, get: () => ST.notesOf('photo').length, coins: 80 },
    { id: 'col-50', ic: '▦', name: '初成收藏', desc: '收集 50 张照片', need: 50, get: () => ST.totalOwned(), coins: 200 },
    { id: 'col-100', ic: '▦', name: '收藏家', desc: '收集 100 张照片', need: 100, get: () => ST.totalOwned(), coins: 400, ticket: 2 },
    { id: 'col-200', ic: '◍', name: '半个世界', desc: '收集 200 张照片', need: 200, get: () => ST.totalOwned(), coins: 800 },
    { id: 'col-400', ic: '◍', name: '环球旅人', desc: '收集全部 400 张照片', need: 400, get: () => ST.totalOwned(), coins: 2000, pick: 1 },
    { id: 'city-1', ic: '⚑', name: '初次打卡', desc: '集齐 1 个地区', need: 1, get: () => ST.fullSlugs().length, coins: 300, ticket: 1 },
    { id: 'city-5', ic: '⚑', name: '连成一线', desc: '集齐 5 个地区', need: 5, get: () => ST.fullSlugs().length, coins: 1000, pick: 1 },
    { id: 'city-10', ic: '⚑', name: '打卡达人', desc: '集齐 10 个地区', need: 10, get: () => ST.fullSlugs().length, coins: 2000, pick: 1 },
    { id: 'city-20', ic: '✈', name: '环游世界', desc: '集齐全部 20 个地区', need: 20, get: () => ST.fullSlugs().length, coins: 5000, pick: 3 },
    { id: 'pull-50', ic: '✦', name: '手气不错', desc: '累计抽卡 50 次', need: 50, get: pulls, coins: 200 },
    { id: 'ur-10', ic: '✧', name: '一发入魂', desc: '收集 10 张 UR', need: 10, get: urs, coins: 500 },
    { id: 'piggy-200', ic: '◆', name: '会过日子', desc: '存钱罐累计利息 200', need: 200, get: () => ST.S.piggy.total || 0, coins: 200 }
  ];

  const keyOf = a => 'ach:' + a.id;
  const clampN = (a, n) => Math.min(n, a.need);
  const reached = a => a.get() >= a.need;
  const claimed = a => ST.isClaimed(keyOf(a));
  const gotCount = () => LIST.filter(claimed).length;

  function rewardText(a) {
    const out = [];
    if (a.coins) out.push('+' + a.coins + ' ◆');
    if (a.ticket) out.push('单抽券 ×' + a.ticket);
    if (a.pick) out.push('UR 自选券 ×' + a.pick);
    return out.join(' · ');
  }

  /* ── 成就卡片 ── */
  function mainHTML() {
    const got = gotCount();
    return '<div class="ach-hd"><span>旅行成就</span><span class="ach-n">已达成 <b>' + got + '</b> / ' + LIST.length + '</span></div>' +
      '<div class="ach-grid">' + LIST.map(a => {
        const n = clampN(a, a.get()), ok = reached(a), done = claimed(a);
        return '<div class="ach-card' + (done ? ' done' : ok ? ' ready' : '') + '">' +
          '<div class="ac-top"><span class="ac-ico">' + a.ic + '</span>' +
          '<span class="ac-t">' + esc(a.name) + '</span></div>' +
          '<div class="ac-d">' + esc(a.desc) + '</div>' +
          '<div class="ac-bar"><i style="width:' + Math.round(n / a.need * 100) + '%"></i></div>' +
          '<div class="ac-f"><span class="ac-p">' + n + ' / ' + a.need + '</span>' +
          '<span class="ac-r">' + rewardText(a) + '</span></div>' +
          '<button class="ms' + (done ? ' claimed' : ok ? ' ready' : '') + '" data-ach="' + a.id + '"' +
          (done || !ok ? ' disabled' : '') + '>' + (done ? '✓ 已领取' : ok ? '领取' : '未达成') + '</button>' +
          '</div>';
      }).join('') + '</div>' +
      '<div class="cr-cont">收集成就 · 按地区</div>';
  }

  /* ── 领取 ── */
  function bind(host) {
    $$('[data-ach]', host).forEach(b => {
      b.onclick = () => {
        const a = LIST.find(x => x.id === b.dataset.ach);
        if (!a || claimed(a) || !reached(a)) return;
        if (!ST.ACH_CLAIM(keyOf(a), a.coins, a.ticket, a.pick)) return;
        if (window.SFX) SFX.play('ach');
        burst(innerWidth / 2, innerHeight * .35, { count: 26, dist: 190 });
        toast('成就达成：' + a.name, 'dream', rewardText(a) + ' 已到账');
        if (window.Codex) Codex.render();
        if (window.APP && APP.refresh) APP.refresh();
        if (window.Gacha) Gacha.render();
      };
    });
  }

  window.ACH = { LIST, mainHTML, bind, gotCount, total: LIST.length, keyOf };
})();
