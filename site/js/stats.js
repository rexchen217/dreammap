/* ══════════════════════════════════════════════
   梦想地图 · 足迹（已完成目标的统计）
   不同档次用不同形式呈现：
     · 小目标 → 频率（近 30 天热力图 + 日均 / 连击）
     · 目标   → 投入（从写下来到完成，花了多少天）
     · 梦想   → 里程碑（从写下到达成的时间跨度）
   另有总览、心愿币收支、以及全部完成的「来时路」时间轴。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, toast, DUR } = U;

  const TYPES = { small: '小目标', goal: '目标', dream: '梦想' };
  const DAY = 86400000;

  const daysBetween = (a, b) => Math.max(0, Math.round((U.dayStart(b) - U.dayStart(a)) / DAY));

  function stats() {
    const done = ST.doneNotes().filter(n => n.doneAt);
    const byType = { small: [], goal: [], dream: [] };
    done.forEach(n => { (byType[n.type] || byType.small).push(n); });

    const dateSet = {};
    done.forEach(n => { dateSet[U.dateKey(n.doneAt)] = (dateSet[U.dateKey(n.doneAt)] || 0) + 1; });

    // 当前连续天数
    let cur = 0;
    for (let i = 0; i < 400; i++) {
      const k = U.dateKey(Date.now() - i * DAY);
      if (dateSet[k]) cur++;
      else if (i > 0) break;
      else { /* 今天还没完成也算，继续看昨天 */ }
    }
    // 最长连续
    const keys = Object.keys(dateSet).sort();
    let best = 0, run = 0, prev = null;
    keys.forEach(k => {
      const t = new Date(k + 'T00:00:00').getTime();
      run = (prev !== null && Math.round((t - prev) / DAY) === 1) ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    });

    // 近 30 天
    const heat = [];
    for (let i = 29; i >= 0; i--) {
      const t = Date.now() - i * DAY, k = U.dateKey(t);
      heat.push({ k, n: dateSet[k] || 0, t });
    }
    const sum30 = heat.reduce((a, h) => a + h.n, 0);

    // 小目标专用：热力图与「小目标看频率」这一档只看小目标，不带目标与梦想
    const dateSmall = {};
    byType.small.forEach(n => { const k = U.dateKey(n.doneAt); dateSmall[k] = (dateSmall[k] || 0) + 1; });
    const heatSmall = heat.map(h => ({ k: h.k, n: dateSmall[h.k] || 0, t: h.t }));
    const sum30Small = heatSmall.reduce((a, h) => a + h.n, 0);

    // 用时
    const durOf = n => daysBetween(n.createdAt, n.doneAt);
    const avg = arr => arr.length ? arr.reduce((a, n) => a + durOf(n), 0) / arr.length : 0;
    const maxD = arr => arr.length ? Math.max.apply(null, arr.map(durOf)) : 0;

    const all = ST.S.notes;
    const firstEver = all.length ? all.reduce((a, n) => (a.createdAt < n.createdAt ? a : n)) : null;

    return {
      done, byType, dateSet, cur, best, heat, sum30, heatSmall, sum30Small, avg, maxD, durOf, firstEver,
      active: ST.activeNotes().filter(n => n.type !== 'quote')
    };
  }

  const lv = (n, max) => {
    if (!n) return 0;
    if (max <= 1) return 3;
    return Math.min(4, 1 + Math.round((n / max) * 3));
  };

  /* ══════ 总览 ══════ */
  function renderOverview(s) {
    const host = el('st-overview');
    if (!host) return;
    const totalDone = s.done.length;
    const ageDays = s.firstEver ? daysBetween(s.firstEver.createdAt, Date.now()) : 0;
    const coins = ST.coins();
    const owned = ST.totalOwned(), allCards = (window.DM_CARDS || []).length;

    const box = (label, value, sub, cls) =>
      '<div class="ov ' + (cls || '') + '"><div class="ov-l">' + label + '</div>' +
      '<div class="ov-v">' + value + '</div>' +
      (sub ? '<div class="ov-s">' + sub + '</div>' : '') + '</div>';

    host.innerHTML =
      box('累计完成', totalDone + ' <small>件</small>', '小目标 ' + s.byType.small.length + ' · 目标 ' + s.byType.goal.length + ' · 梦想 ' + s.byType.dream.length, 'hero') +
      box('连续完成', s.cur + ' <small>天</small>', '最长纪录 ' + s.best + ' 天') +
      box('出发至今', ageDays + ' <small>天</small>', s.firstEver ? '第一张：' + U.dateFullCN(s.firstEver.createdAt) : '还没有记录') +
      box('近 30 天', s.sum30 + ' <small>件</small>', '日均 ' + (s.sum30 / 30).toFixed(1) + ' 件') +
      box('心愿币', fmt(coins) + ' <small>◆</small>', '累计赚取 ' + fmt(ST.S.acc.earned) + ' · 花费 ' + fmt(ST.S.acc.spent)) +
      box('相册进度', owned + ' <small>/ ' + allCards + '</small>', '完成度 ' + Math.round(owned / allCards * 100) + '%');

    if (totalDone === 0) {
      host.innerHTML += '<div class="st-note wide">还没有完成任何便利贴。双击墙上任意一张，第一个数字就会出现在这里。</div>';
    }
  }

  /* ══════ 小目标：频率 ══════ */
  function renderHeat(s) {
    const host = el('st-heat');
    if (!host) return;
    const max = Math.max(1, Math.max.apply(null, s.heatSmall.map(h => h.n)));
    host.innerHTML = s.heatSmall.map((h, i) => {
      const l = lv(h.n, max);
      const isToday = i === s.heatSmall.length - 1;
      const wd = '日一二三四五六'[new Date(h.t).getDay()];
      return '<i class="hc lv' + l + (isToday ? ' today' : '') + '" title="' + h.k + '（周' + wd + '）完成 ' + h.n + ' 件">' +
        (h.n ? '<b>' + h.n + '</b>' : '') + '</i>';
    }).join('');

    const note = el('st-heat-note');
    if (note) {
      const days30 = s.heatSmall.filter(h => h.n > 0).length;
      note.innerHTML = '近 30 天里有 <b>' + days30 + '</b> 天你动了手，一共完成 <b>' + s.sum30Small + '</b> 件小目标，' +
        '日均 <b>' + (s.sum30Small / 30).toFixed(1) + '</b> 件。小目标不讲难度，讲的是频率——' +
        (days30 >= 20 ? '你几乎每天都在，这种稳定比爆发狠得多。' : days30 >= 10 ? '节奏已经起来了，再稳一点就更好了。' : '起步阶段，先把「每天都做一件」这件事本身做成。');
    }
  }

  /* ══════ 三档对比 ══════ */
  function renderTiers(s) {
    const host = el('st-tiers');
    if (!host) return;
    const rows = [
      { k: 'small', n: '小目标', form: '频率', tip: '今天就能做完的小事' },
      { k: 'goal', n: '目标', form: '投入', tip: '需要坚持一段时间的事' },
      { k: 'dream', n: '梦想', form: '里程碑', tip: '你真正想去的地方' }
    ];
    host.innerHTML = rows.map(r => {
      const arr = s.byType[r.k];
      const a = s.avg(arr), mx = s.maxD(arr);
      const mid = r.k === 'small'
        ? (arr.length ? '近 30 天 ' + s.sum30Small + ' 件' : '还没有完成')
        : (arr.length ? '平均用时 ' + a.toFixed(1) + ' 天 · 最长 ' + mx + ' 天' : '还没有完成');
      const totalG = arr.reduce((x, n) => x + (n.granted || 0), 0);
      return '<div class="tier">' +
        '<div class="tr-hd"><span class="tr-n">' + r.n + '</span><span class="tr-f">看' + r.form + '</span></div>' +
        '<div class="tr-big">' + arr.length + '<small> 件</small></div>' +
        '<div class="tr-s">' + mid + '</div>' +
        '<div class="tr-s dim">' + r.tip + '</div>' +
        '<div class="tr-bar"><i style="width:' + Math.min(100, arr.length / Math.max(1, s.done.length) * 100) + '%"></i></div>' +
        '<div class="tr-s dim">带来心愿币 ' + fmt(totalG) + ' ◆</div>' +
        '</div>';
    }).join('');
  }

  /* ══════ 目标的投入 ══════ */
  function renderGoalBars(s) {
    const host = el('st-goalbar');
    if (!host) return;
    const arr = s.byType.goal.slice().sort((a, b) => s.durOf(b) - s.durOf(a));
    if (!arr.length) {
      host.innerHTML = '<div class="st-note">还没有完成过「目标」。这类便利贴从写下到完成要花些时间，完成后这里会显示你为它投入了多久。</div>';
      return;
    }
    const mx = Math.max(1, s.maxD(arr));
    host.innerHTML = arr.slice(0, 12).map(n =>
      '<div class="gb"><div class="gb-t">' + esc(n.text) + '</div>' +
      '<div class="gb-r"><div class="gb-f"><i style="width:' + Math.max(4, s.durOf(n) / mx * 100) + '%"></i></div>' +
      '<span class="gb-d">' + s.durOf(n) + ' 天</span></div></div>'
    ).join('') +
      (arr.length > 12 ? '<div class="st-note">只显示投入最久的 12 件，共 ' + arr.length + ' 件。</div>' : '');
  }

  /* ══════ 梦想里程碑 ══════ */
  function renderDreams(s) {
    const host = el('st-dreams');
    if (!host) return;
    const all = ST.notesOf('dream').slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (!all.length) {
      host.innerHTML = '<div class="st-note">还没有写下梦想。它是整张地图的终点，值得你认真想一次。</div>';
      return;
    }
    host.innerHTML = all.map((n, i) => {
      const done = n.status === 'done';
      const span = done ? s.durOf(n) : daysBetween(n.createdAt, Date.now());
      const totalActive = s.active.length;
      return '<div class="dm' + (done ? ' done' : '') + '">' +
        '<div class="dm-no">' + (i + 1) + '</div>' +
        '<div class="dm-i">' +
        '<div class="dm-t">' + esc(n.text) + '</div>' +
        '<div class="dm-s">' + (done
          ? '达成于 ' + U.dateFullCN(n.doneAt) + ' · 从写下到实现用了 <b>' + span + '</b> 天'
          : '已写下 <b>' + span + '</b> 天，还没达成' + (totalActive ? ' · 墙上还有 ' + totalActive + ' 件在推进' : '')) + '</div>' +
        '</div>' +
        '<div class="dm-b ' + (done ? 'ok' : '') + '">' + (done ? '已达成' : '进行中') + '</div>' +
        '</div>';
    }).join('');
  }

  /* ══════ 心愿币收支 ══════ */
  function renderCoins(s) {
    const host = el('st-coins');
    if (!host) return;
    const E = ST.S.acc.earned, P = ST.S.acc.spent;
    const fromSmall = s.byType.small.reduce((a, n) => a + (n.granted || 0), 0);
    const fromGoal = s.byType.goal.reduce((a, n) => a + (n.granted || 0), 0);
    const fromDream = s.byType.dream.reduce((a, n) => a + (n.granted || 0), 0);
    const fromMilestone = Math.max(0, E - fromSmall - fromGoal - fromDream);
    const pulls = Object.keys(ST.S.pulls || {}).reduce((a, k) => a + ST.S.pulls[k], 0);
    const bar = (label, v, cls) => '<div class="cb"><span class="cb-l">' + label + '</span>' +
      '<div class="cb-r"><i style="width:' + (E ? Math.max(1, v / E * 100) : 0) + '%" class="' + (cls || '') + '"></i></div>' +
      '<b class="cb-v">' + fmt(v) + ' ◆</b></div>';
    host.innerHTML =
      '<div class="cv"><div class="cv-l">累计赚取</div><div class="cv-v">' + fmt(E) + ' ◆</div></div>' +
      '<div class="cv"><div class="cv-l">累计花费</div><div class="cv-v">' + fmt(P) + ' ◆</div></div>' +
      '<div class="cv"><div class="cv-l">当前结余</div><div class="cv-v hi">' + fmt(ST.coins()) + ' ◆</div></div>' +
      '<div class="cv"><div class="cv-l">抽卡次数</div><div class="cv-v">' + pulls + ' <small>次</small></div></div>' +
      '<div class="cb-wrap">' + bar('小目标奖励', fromSmall) + bar('目标奖励', fromGoal) +
      bar('梦想奖励', fromDream) + bar('收集度奖励', fromMilestone) + '</div>';
  }

  /* ══════ 来时路时间轴 ══════ */
  function renderTimeline(s) {
    const host = el('st-timeline');
    if (!host) return;
    const arr = s.done.slice().sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
    if (!arr.length) {
      host.innerHTML = '<div class="st-note">这里会按时间倒序记下你完成的每一件事。现在还是空的。</div>';
      return;
    }
    let lastDay = '';
    host.innerHTML = arr.slice(0, 60).map(n => {
      const k = U.dateKey(n.doneAt);
      let head = '';
      if (k !== lastDay) { head = '<div class="tl-day">' + U.dateFullCN(n.doneAt) + '</div>'; lastDay = k; }
      const dur = s.durOf(n);
      return head + '<div class="tl t-' + n.type + '">' +
        '<i class="tl-dot"></i>' +
        '<div class="tl-i"><div class="tl-t">' + esc(n.text) + '</div>' +
        '<div class="tl-s">' + TYPES[n.type] + ' · ' + U.timeCN(n.doneAt) + ' 完成' +
        (n.type === 'small' ? ' · 当天写完当天做' : ' · 用时 ' + dur + ' 天') +
        ' · ＋' + (n.granted || 0) + ' ◆' + (n.comboBonus ? '（连击 +' + n.comboBonus + '）' : '') + '</div>' +
        '</div></div>';
    }).join('') + (arr.length > 60 ? '<div class="st-note">只显示最近 60 件，共 ' + arr.length + ' 件。</div>' : '');
  }

  function render() {
    const s = stats();
    renderOverview(s); renderHeat(s); renderTiers(s);
    renderGoalBars(s); renderDreams(s); renderCoins(s); renderTimeline(s);
  }

  window.Stats = { render };
})();
