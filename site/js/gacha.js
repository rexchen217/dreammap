/* ══════════════════════════════════════════════
   梦想地图 · 抽卡
   · 「出发」：100 ◆ 心愿币，从所有地区里随机选一个奖池，优先还没集齐的
   · 「十连」：900 ◆，一次十张，必出一张 SR 以上的稀缺、连续十张内保底 UR
   · 本月限定目的地：UR 概率翻倍，UR 保底只要 10 抽
   · 地区单抽券：免费，指定地区抽取
   · 同一奖池内 20 张不重复；每处 1 张 UR（该地最著名的一景）+ 19 张 SR
   · 卡面为胶卷照片样式，品质不写在卡面上
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, sleep, toast, dialog, burst, DUR, REDUCED, nowISO } = U;

  const CARDS = window.DM_CARDS || [];
  const CITIES = window.DM_CITIES || [];
  const cardById = id => CARDS.find(c => c.id === id);
  const poolOf = slug => CARDS.filter(c => c.citySlug === slug);
  const cityOf = slug => CITIES.find(c => c.slug === slug) || { city: slug, sub: '', total: 20 };

  /* ── 抽一张（不含 UI） ── */
  function roll(slug, via) {
    const S = ST.S;
    const un = poolOf(slug).filter(c => !ST.hasCard(c.id));
    if (!un.length) return { complete: true, slug };

    const p = ST.pityOf(slug);
    const feat = ST.isFeatured(slug);                        // 本月限定：UR 概率翻倍
    const cap = feat ? ST.FEAT_PITY : ST.UR_PITY;
    const rate = feat ? Math.min(1, ST.UR_RATE * 2) : ST.UR_RATE;
    const forceUR = (p.n || 0) >= cap - 1;
    const wantUR = forceUR || Math.random() < rate;
    const urLeft = un.filter(c => c.rarity === 'UR');
    const srLeft = un.filter(c => c.rarity !== 'UR');

    let card;
    if (wantUR && urLeft.length) card = urLeft[0];
    else if (srLeft.length) card = U.pick(srLeft);
    else card = un[0];                       // 只剩 UR 没拿到 → 必然是它

    // 记录保底
    if (card.rarity === 'UR') { p.n = 0; p.ur = (p.ur || 0) + 1; }
    else p.n = (p.n || 0) + 1;

    S.own[card.id] = nowISO();
    S.pulls[slug] = (S.pulls[slug] || 0) + 1;
    ST.addLog({ at: nowISO(), slug, cardId: card.id, name: card.name, rarity: card.rarity, via });
    ST.touch('gacha');

    return { card, slug, complete: false, poolDone: poolOf(slug).every(c => ST.hasCard(c.id)) };
  }

  /* ══════ 卡面（胶卷照片） ══════ */
  function filmHTML(card, opts) {
    opts = opts || {};
    const c = cardById(card.cardId || card.id) || card;
    const owned = ST.hasCard(c.id);
    return '<div class="film' + (owned ? '' : ' unowned') + (opts.big ? ' big' : '') + '">' +
      '<div class="film-holes top"></div>' +
      '<div class="film-win">' +
      (owned
        ? '<img src="' + c.file + '" alt="' + esc(c.name) + '"' + (opts.eager ? '' : ' loading="lazy"') + ' decoding="async">'
        : '<div class="film-dev"><span>未冲洗</span></div>') +
      '</div>' +
      '<div class="film-holes bot"></div>' +
      '<div class="film-cap">' + (owned ? esc(c.name) : '???') + '</div>' +
      '</div>';
  }

  /* ══════ 抽卡演出 ══════ */
  let rvBusy = false;

  /* ── 第一幕：出发 · 目的地转盘 ── */
  const REEL_H = 62;
  function spinPhase(layer, slug) {
    return new Promise(resolve => {
      if (REDUCED || !CITIES.length) { resolve(); return; }
      const ROUND = CITIES.length, ROUNDS = 3;
      const idx = Math.max(0, CITIES.findIndex(c => c.slug === slug));
      const ti = ROUNDS * ROUND + idx;                    // 停下来时居中那一行
      const items = [];
      for (let r = 0; r <= ROUNDS; r++) for (const c of CITIES) items.push(c);

      layer.hidden = false;
      if (window.SFX) SFX.play('draw');
      layer.innerHTML =
        '<div class="rv spin">' +
        '<div class="sp-sky"></div>' +
        '<div class="sp-plane"></div>' +
        '<div class="sp-k">随机目的地</div>' +
        '<div class="sp-win"><div class="sp-track">' +
        items.map((c, i) => '<div class="sp-it' + (i === ti ? ' hit' : '') + '">' + esc(c.city) + '</div>').join('') +
        '</div><div class="sp-mid"></div></div>' +
        '<div class="sp-tip">正在挑一个你还没走完的地方…</div>' +
        '</div>';

      const rv = $('.rv', layer), track = $('.sp-track', layer);
      const fadeIn = () => rv.classList.add('on');
      requestAnimationFrame(fadeIn);
      setTimeout(fadeIn, 90);

      // 转起来：淡入后开始减速滚动，1700ms 停在目标地区
      setTimeout(() => {
        track.style.transition = 'transform 1700ms cubic-bezier(.12, .86, .16, 1)';
        track.style.transform = 'translateY(' + ((1 - ti) * REEL_H) + 'px)';
      }, 260);

      setTimeout(() => {
        rv.classList.add('land');
        const b = $('.sp-win', layer).getBoundingClientRect();
        burst(b.left + b.width / 2, b.top + b.height / 2, { count: 22, dist: 130 });
        setTimeout(resolve, 520);
      }, 260 + 1700);
    });
  }

  /* ── 第二幕：照片冲洗揭示 ── */
  async function reveal(result) {
    if (rvBusy) return;
    rvBusy = true;
    const layer = el('reveal');
    layer.onclick = null;
    const c = result.card;
    const isUR = c.rarity === 'UR';
    const cap = isUR
      ? '这张是' + (result.city || cityOf(result.slug).city) + '最著名的一景。'
      : cityOf(result.slug).city + '的一处风景。';

    await spinPhase(layer, result.slug);

    layer.innerHTML =
      '<div class="rv' + (isUR ? ' ur' : ' sr') + '">' +
      '<div class="rv-flash"></div>' +
      (isUR ? '<div class="rv-rain"></div><div class="rv-ring"></div>' : '') +
      '<div class="rv-stage"><div class="rv-card">' +
      '<div class="film dev0' + (isUR ? ' big' : '') + '">' +
      '<div class="film-holes top"></div>' +
      '<div class="film-win"><img src="' + c.file + '" alt="">' +
      '<div class="rv-dev"></div></div>' +
      '<div class="film-holes bot"></div>' +
      '<div class="film-cap">' + esc(c.name) + '</div>' +
      '</div>' +
      '<div class="rv-name">' + esc(c.name) + '</div>' +
      '<div class="rv-cap">' + esc(cap) + '</div>' +
      '</div></div>' +
      '<div class="rv-tip">点击任意位置继续 ▸</div>' +
      '</div>';

    if (isUR) {
      const rain = $('.rv-rain', layer);
      let h = '';
      for (let i = 0; i < 60; i++) h += '<b style="left:' + U.rand(0, 100).toFixed(1) + '%;animation-delay:' + U.randInt(0, 1400) + 'ms"></b>';
      rain.innerHTML = h;
    }

    const rv = $('.rv', layer);
    const fadeIn = () => rv.classList.add('on');
    requestAnimationFrame(fadeIn);
    setTimeout(fadeIn, 90);

    // 冲洗：先显影为负片，再洗出真实照片
    await sleep(DUR(REDUCED ? 120 : 620));
    const film = $('.film', layer);
    if (film) film.classList.remove('dev0');
    if (window.SFX) SFX.play(isUR ? 'ur' : 'card');
    if ($('.rv-flash', layer)) $('.rv-flash', layer).classList.add('go');
    if (isUR) {
      const st = $('.rv-stage', layer).getBoundingClientRect();
      burst(st.left + st.width / 2, st.top + st.height / 2, { count: 54, dist: 300, colors: ['#ffd166', '#ffb020', '#fff3c4', '#7fd8f5'] });
    }

    return new Promise(res => {
      let done = false;
      const close = () => {
        if (done) return; done = true;
        rv.classList.remove('on');
        setTimeout(() => { layer.hidden = true; layer.innerHTML = ''; rvBusy = false; res(); }, DUR(340));
      };
      layer.onclick = close;
      setTimeout(close, REDUCED ? 1600 : (isUR ? 4200 : 3200));
    });
  }

  /* ══════ 十连：沿用单抽的两幕演出 ══════ */

  /* ── 第一幕：十个目的地一起转 ── */
  function tenSpin(layer, results) {
    return new Promise(resolve => {
      const cities = results.filter(r => !r.complete).map(r => cityOf(r.slug).city);
      if (REDUCED || !cities.length) { resolve(); return; }
      const items = [];
      for (let k = 0; k < 3; k++) for (const c of cities) items.push(c);
      const ti = Math.floor(items.length * 0.62);          // 停下来时居中那一行

      layer.hidden = false;
      if (window.SFX) SFX.play('draw');
      layer.innerHTML =
        '<div class="rv spin">' +
        '<div class="sp-sky"></div>' +
        '<div class="sp-plane"></div>' +
        '<div class="sp-k">十连 · 十个目的地</div>' +
        '<div class="sp-win"><div class="sp-track">' +
        items.map((c, i) => '<div class="sp-it' + (i === ti ? ' hit' : '') + '">' + esc(c) + '</div>').join('') +
        '</div><div class="sp-mid"></div></div>' +
        '<div class="sp-tip">十个地方一起挑，底片马上就好…</div>' +
        '</div>';

      const rv = $('.rv', layer), track = $('.sp-track', layer);
      const fadeIn = () => rv.classList.add('on');
      requestAnimationFrame(fadeIn);
      setTimeout(fadeIn, 90);

      setTimeout(() => {
        track.style.transition = 'transform 2400ms cubic-bezier(.12, .86, .16, 1)';
        track.style.transform = 'translateY(' + ((1 - ti) * REEL_H) + 'px)';
      }, 260);

      setTimeout(() => {
        rv.classList.add('land');
        const b = $('.sp-win', layer).getBoundingClientRect();
        burst(b.left + b.width / 2, b.top + b.height / 2, { count: 26, dist: 150 });
        setTimeout(resolve, 480);
      }, 260 + 2400);
    });
  }

  /* ── 第二幕：十张底片依次显影 ── */
  function tenReveal(results) {
    const layer = el('reveal');
    rvBusy = true;
    layer.onclick = null;

    return tenSpin(layer, results).then(() => new Promise(res => {
      const urs = results.filter(r => r.card && r.card.rarity === 'UR');
      const best = urs[0] || results.find(r => r.card) || results[0];
      const donePools = results.filter(r => r.poolDone).map(r => cityOf(r.slug).city);

      layer.hidden = false;
      layer.innerHTML =
        '<div class="rv ten' + (urs.length ? ' ur' : '') + '">' +
        '<div class="rv-flash"></div>' +
        '<div class="ten-k" id="ten-k">十连 · 冲洗中</div>' +
        '<div class="ten-grid">' +
        results.map((r, i) => r.card
          ? '<div class="ten-it' + (r.card.rarity === 'UR' ? ' ur' : '') + '" data-i="' + i + '">' + filmHTML(r.card, { eager: true }) +
            '<div class="ten-n">' + esc(r.card.name) + '</div>' +
            '<div class="ten-s">' + esc(cityOf(r.slug).city) + (r.card.rarity === 'UR' ? ' · 标志性景观' : '') + '</div></div>'
          : '<div class="ten-it empty" data-i="' + i + '"><div class="ten-n">此地已集齐</div><div class="ten-s">' +
            esc(cityOf(r.slug).city) + '</div></div>'
        ).join('') +
        '</div>' +
        '<div class="ten-hd" id="ten-line">一张张冲洗，先别急…</div>' +
        '<div class="ten-tip" id="ten-tip" hidden>点击任意位置继续 ▸</div>' +
        '</div>';

      const rv = $('.rv', layer);
      requestAnimationFrame(() => rv.classList.add('on'));

      // 先全部压成负片，等着一张张显影
      $$('.ten-it', layer).forEach(it => {
        const w = $('.film-win', it);
        if (w) w.insertAdjacentHTML('beforeend', '<div class="rv-dev"></div>');
        const f = $('.film', it);
        if (f) f.classList.add('dev0');
      });

      const line = el('ten-line'), tip = el('ten-tip');
      const order = results.map((r, i) => (r.card ? i : -1)).filter(i => i >= 0);
      let k = 0;

      const finish = () => {
        const kEl = el('ten-k');
        if (kEl) kEl.textContent = '十连 · 洗好了';
        if (line) {
          line.innerHTML = (best && best.card ? '最好的一张：<b class="ten-ur">' + esc(best.card.name) + '</b>' : '') +
            (donePools.length ? ' · ' + esc(donePools.join('、')) + ' 已集齐！' : '');
        }
        if (tip) tip.hidden = false;
        let done = false;
        const close = () => {
          if (done) return; done = true;
          $$('.rv', layer).forEach(x => x.classList.remove('on'));
          setTimeout(() => { layer.hidden = true; layer.innerHTML = ''; rvBusy = false; res(); }, DUR(340));
        };
        layer.onclick = close;
        if (REDUCED) setTimeout(close, 1400);
      };

      const step = () => {
        if (k >= order.length) { finish(); return; }
        const idx = order[k];
        const it = $('.ten-it[data-i="' + idx + '"]', layer);
        const r = results[idx];
        if (it) {
          const f = $('.film', it);
          if (f) f.classList.remove('dev0');
          if (window.SFX) SFX.play(r.card.rarity === 'UR' ? 'ur' : 'card');
          it.classList.add('pop');
          if (r.card.rarity === 'UR') {
            const b = it.getBoundingClientRect();
            burst(b.left + b.width / 2, b.top + b.height / 2,
              { count: 28, dist: 120, colors: ['#ffd166', '#ffb020', '#fff3c4', '#7fd8f5'] });
            const fl = $('.rv-flash', layer);
            if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
            if (line) line.innerHTML = '出现标志性景观：<b class="ten-ur">' + esc(r.card.name) + '</b>';
          } else if (line) {
            line.textContent = '已冲洗 ' + (k + 1) + ' / ' + order.length + ' 张';
          }
        }
        k++;
        setTimeout(step, REDUCED ? 40 : 260);
      };
      setTimeout(step, 420);
    }));
  }

  /* ══════ 抽卡入口 ══════ */
  function randomSlug() {
    const open = CITIES.filter(c => ST.cityOwned(c.slug) < c.total);
    const list = open.length ? open : CITIES;
    // 本月限定目的地的权重翻倍，更容易被抽到
    const pool = [];
    list.forEach(c => { pool.push(c.slug); if (ST.isFeatured(c.slug)) pool.push(c.slug); });
    return U.pick(pool);
  }

  async function drawRandom() {
    if (ST.coins() < ST.PULL_COST) {
      if (window.SFX) SFX.play('err');
      toast('心愿币不够', 'warn', '完成便利贴就能赚到。还差 ' + (ST.PULL_COST - ST.coins()) + ' ◆');
      return;
    }
    const slug = randomSlug();
    if (!ST.spendCoins(ST.PULL_COST)) { toast('心愿币不够', 'warn'); return; }

    const r = roll(slug, 'coin');
    render();
    if (window.APP && APP.refresh) APP.refresh();
    if (!r.complete) await reveal(r);
    afterDraw(r);
  }

  async function drawTen() {
    if (rvBusy) return;
    if (ST.coins() < ST.TEN_COST) {
      if (window.SFX) SFX.play('err');
      toast('心愿币不够', 'warn', '十连要 ' + ST.TEN_COST + ' ◆，还差 ' + (ST.TEN_COST - ST.coins()) + ' ◆');
      return;
    }
    if (!ST.spendCoins(ST.TEN_COST)) { toast('心愿币不够', 'warn'); return; }

    const results = [];
    for (let i = 0; i < 10; i++) {
      const slug = randomSlug();
      results.push(roll(slug, 'ten'));
    }
    render();
    if (window.APP && APP.refresh) APP.refresh();

    const live = results.filter(r => !r.complete);
    if (!live.length) {
      toast('这些地方都已集齐', 'warn', '再去抽卡前，先完成几个目标攒心愿币吧');
      return;
    }
    await tenReveal(results);
    results.forEach(afterDraw);
  }

  async function drawWithTicket(slug) {
    if (ST.tickets(slug) <= 0) {
      if (window.SFX) SFX.play('err');
      toast('还没有' + cityOf(slug).city + '的单抽券', 'warn', '可以在商店里买到'); return;
    }
    const r = roll(slug, 'ticket');
    if (r.complete) {
      if (window.SFX) SFX.play('err');
      toast(cityOf(slug).city + '已经集齐了', 'warn', '这张券先留着吧'); return;
    }
    ST.useTicket(slug);
    render();
    if (window.APP && APP.refresh) APP.refresh();
    await reveal(r);
    afterDraw(r);
  }

  function afterDraw(r) {
    if (!r || r.complete) return;
    if (r.poolDone) {
      const cn = cityOf(r.slug).city;
      setTimeout(() => toast(cn + ' · 全部 20 张集齐！', 'dream', '去相册领收集度奖励，打卡链会送你下一站的券'), DUR(1200));
    }
  }

  /* ══════ 渲染 ══════ */
  function render() {
    const coins = ST.coins();
    const btn = el('g-draw');
    if (btn) {
      btn.disabled = coins < ST.PULL_COST;
      btn.innerHTML = '▶ 出发 <b class="cost">' + ST.PULL_COST + ' ◆</b>';
    }
    const tb = el('g-ten');
    if (tb) {
      tb.disabled = coins < ST.TEN_COST;
      tb.innerHTML = '✦ 十连 <b class="cost">' + ST.TEN_COST + ' ◆</b>';
    }
    const feat = ST.featuredSlug();
    const totalEl = el('g-total');
    if (totalEl) totalEl.textContent = CITIES.length + ' 个地区 · ' + CARDS.length + ' 张';
    const pc = el('g-pool-count');
    if (pc) pc.textContent = CITIES.length + ' 个奖池';

    const hn = el('g-hero-note');
    if (hn) {
      const tickets = ST.ticketsAll();
      const p = feat ? ST.pityOf(feat) : null;
      hn.innerHTML = '当前 ' + fmt(coins) + ' ◆' +
        (tickets ? ' · 另有 ' + tickets + ' 张地区单抽券可用' : '') +
        (feat ? '<br><b class="gp-hot">本月限定：' + esc(cityOf(feat).city) + '</b> · UR 概率翻倍，再抽 ' +
          Math.max(1, ST.FEAT_PITY - (p.n || 0)) + ' 张内必出最著名的一景' : '');
    }

    const grid = el('g-pools');
    if (grid) {
      grid.innerHTML = CITIES.map(city => {
        const got = ST.cityOwned(city.slug);
        const tk = ST.tickets(city.slug);
        const pct = Math.round(got / city.total * 100);
        const done = got >= city.total;
        const urOwned = ST.hasCard(city.urId);
        const feat = ST.isFeatured(city.slug);
        const p = ST.pityOf(city.slug);
        const cap = feat ? ST.FEAT_PITY : ST.UR_PITY;
        const left = Math.max(0, cap - (p.n || 0));
        return '<div class="pool' + (done ? ' done' : '') + (feat ? ' feat' : '') + '">' +
          (feat ? '<div class="po-feat">本月限定</div>' : '') +
          '<div class="po-hd"><div class="po-n">' + esc(city.city) +
          (city.kind === 'country' ? '<i class="po-ct">国</i>' : '') + '</div><div class="po-s">' + esc(city.sub) + '</div></div>' +
          '<div class="po-bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="po-meta"><span>' + got + ' / ' + city.total + '</span>' +
          '<span class="po-ur" title="这里最著名的一景">' + (urOwned ? '★ 已得' : '★ ?') + '</span></div>' +
          (done ? '' : '<div class="po-pity">' + (left === 0 ? '下一张必出★' : '还有 ' + left + ' 张到★') + '</div>') +
          '<button class="pix-btn sm ' + (tk > 0 && !done ? '' : 'ghost') + '" data-slug="' + city.slug + '"' +
          (tk <= 0 || done ? ' disabled' : '') + '>' +
          (done ? '已集齐' : tk > 0 ? '用券抽一张（' + tk + '）' : '没有单抽券') + '</button>' +
          '</div>';
      }).join('');

      $$('#g-pools .pix-btn').forEach(b => b.onclick = () => drawWithTicket(b.dataset.slug));
    }

    const log = el('g-log');
    if (log) {
      const L = ST.S.log || [];
      log.innerHTML = L.length ? L.map(r => {
        const card = cardById(r.cardId) || { name: r.name, file: '' };
        return '<div class="lg' + (r.rarity === 'UR' ? ' ur' : '') + '">' +
          '<img src="' + card.file + '" alt="" loading="lazy" decoding="async">' +
          '<div class="lg-i"><div class="lg-n">' + esc(r.name || card.name) + '</div>' +
          '<div class="lg-s">' + esc(cityOf(r.slug).city) + ' · ' + U.dateCN(r.at) + ' ' + U.timeCN(r.at) +
          ' · ' + (r.via === 'ten' ? '十连' : r.via === 'ticket' ? '单抽券' : '心愿币') + '</div></div>' +
          '<div class="lg-r ' + (r.rarity === 'UR' ? 'ur' : 'sr') + '">' + (r.rarity === 'UR' ? '最著名' : '景观') + '</div>' +
          '</div>';
      }).join('') : '<div class="st-note">还没有抽过。点上面的「出发」开始吧。</div>';
    }
  }

  function bind() {
    el('g-draw').onclick = drawRandom;
    const tb = el('g-ten');
    if (tb) tb.onclick = drawTen;
  }

  window.Gacha = { render, bind, filmHTML, roll, cityOf, cardById, poolOf, CITIES, CARDS, drawRandom, drawWithTicket, drawTen, randomSlug };
})();
