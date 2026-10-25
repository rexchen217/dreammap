/* ══════════════════════════════════════════════
   梦想地图 · 商店
   心愿币的用途：① 抽卡 ② 解锁便利贴纸色与贴纸 ③ 购买指定地区单抽券 ④ 存进存钱罐生利息
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, toast, dialog, confirmDlg, burst, DUR } = U;

  const CITIES = window.DM_CITIES || [];

  function renderColors() {
    const host = el('s-colors');
    if (!host) return;
    host.innerHTML = U.COLORS.map(c => {
      const ok = ST.hasColor(c.id);
      return '<button class="shop-item' + (ok ? ' owned' : '') + '" data-c="' + c.id + '">' +
        '<span class="si-sw" style="background:' + c.bg + '"></span>' +
        '<span class="si-n">' + esc(c.name) + '</span>' +
        '<span class="si-p">' + (ok ? '已解锁' : c.cost + ' ◆') + '</span>' +
        '</button>';
    }).join('');

    $$('#s-colors .shop-item').forEach(b => b.onclick = () => {
      const id = b.dataset.c, c = U.colorOf(id);
      if (ST.hasColor(id)) { toast('「' + c.name + '」已经解锁过了', 'warn'); return; }
      if (ST.coins() < c.cost) { if (window.SFX) SFX.play('err'); toast('心愿币不够', 'warn', '还差 ' + (c.cost - ST.coins()) + ' ◆'); return; }
      confirmDlg('解锁「' + c.name + '」纸色？', '花费 ' + c.cost + ' ◆，永久可用。', '解锁')
        .then(ok => { if (!ok) return; if (ST.unlockColor(id)) { if (window.SFX) SFX.play('coin'); toast('已解锁「' + c.name + '」', 'ok', '去目标墙换上新纸色吧'); render(); APP.refresh(); } });
    });
  }

  function renderStickers() {
    const host = el('s-stickers');
    if (!host) return;
    host.innerHTML = U.STICKERS.filter(s => !s.free).map(s => {
      const ok = ST.hasSticker(s.id);
      return '<button class="shop-item' + (ok ? ' owned' : '') + '" data-s="' + s.id + '">' +
        '<span class="si-sw stk-host"><i class="stk stk-' + s.mark + '"></i></span>' +
        '<span class="si-n">' + esc(s.name) + '</span>' +
        '<span class="si-p">' + (ok ? '已解锁' : s.cost + ' ◆') + '</span>' +
        '</button>';
    }).join('');

    $$('#s-stickers .shop-item').forEach(b => b.onclick = () => {
      const id = b.dataset.s, s = U.stickerOf(id);
      if (ST.hasSticker(id)) { toast('「' + s.name + '」已经解锁过了', 'warn'); return; }
      if (ST.coins() < s.cost) { if (window.SFX) SFX.play('err'); toast('心愿币不够', 'warn', '还差 ' + (s.cost - ST.coins()) + ' ◆'); return; }
      confirmDlg('解锁「' + s.name + '」贴纸？', '花费 ' + s.cost + ' ◆，永久可用。', '解锁')
        .then(ok => { if (!ok) return; if (ST.unlockSticker(id)) { if (window.SFX) SFX.play('coin'); toast('已解锁「' + s.name + '」', 'ok'); render(); APP.refresh(); } });
    });
  }

  /* ── 存钱罐 ── */
  function renderPiggy() {
    const host = el('piggy');
    if (!host) return;
    const Bal = ST.piggyBalance();                 // 结算到此刻
    const cap = ST.PIGGY_MAX;
    const pct = Math.round(Bal / cap * 100);
    const coins = ST.coins();
    const empty = coins <= 0;
    const full = Bal >= cap;
    host.innerHTML =
      '<div class="pg-top"><div class="pg-amt">' + fmt(Math.round(Bal)) + '<i>◆</i></div>' +
      '<div class="pg-cap">上限 ' + cap + ' ◆ · 每天 +2%</div></div>' +
      '<div class="pg-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pg-row">' +
      '<button class="pix-btn sm" data-pg="100"' + (empty || full || coins < 100 ? ' disabled' : '') + '>存 100 ◆</button>' +
      '<button class="pix-btn sm ghost" data-pg="all"' + (empty || full ? ' disabled' : '') + '>全存进去</button>' +
      '<button class="pix-btn sm ghost" data-pg="take"' + (Bal <= 0 ? ' disabled' : '') + '>全部取出</button>' +
      '</div>' +
      '<div class="pg-tip">手上 ' + fmt(coins) + ' ◆' + (Bal > 0 ? ' · 存钱罐里的钱随时能取回' : '') + '</div>';

    $$('#piggy [data-pg]').forEach(b => b.onclick = () => {
      const k = b.dataset.pg;
      if (k === 'take') {
        const n = ST.piggyTake();
        if (n > 0) {
          burst(U.rand(innerWidth * .35, innerWidth * .65), innerHeight * .4, { count: 22, dist: 150 });
          toast('取出 ' + n + ' ◆', 'ok', '心愿币回到了手上');
        }
      } else {
        const n = ST.piggyDeposit(k === 'all' ? ST.coins() : 100);
        if (n > 0) toast('存入 ' + n + ' ◆', 'ok', '明天这个时候开始生利息');
      }
      renderPiggy();
      if (window.APP && APP.refresh) APP.refresh();
    });
  }

  function renderTickets() {
    const host = el('s-tickets');
    if (!host) return;
    host.innerHTML = CITIES.map(c => {
      const have = ST.tickets(c.slug);
      const got = ST.cityOwned(c.slug);
      const done = got >= c.total;
      return '<button class="shop-item ticket" data-slug="' + c.slug + '"' + (done ? ' disabled' : '') + '>' +
        '<span class="si-sw tk"><i>票</i></span>' +
        '<span class="si-n">' + esc(c.city) + (c.kind === 'country' ? '<i class="si-tag">国</i>' : '') + '</span>' +
        '<span class="si-p">' + (done ? '已集齐' : '持有 ' + have + ' · ' + ST.TICKET_COST + ' ◆') + '</span>' +
        '</button>';
    }).join('');

    $$('#s-tickets .shop-item').forEach(b => b.onclick = () => {
      const slug = b.dataset.slug;
      const city = CITIES.find(x => x.slug === slug);
      if (!city) return;
      if (ST.coins() < ST.TICKET_COST) { if (window.SFX) SFX.play('err'); toast('心愿币不够', 'warn', '还差 ' + (ST.TICKET_COST - ST.coins()) + ' ◆'); return; }
      confirmDlg('买一张「' + city.city + '」单抽券？',
        '花费 ' + ST.TICKET_COST + ' ◆。买完去「抽卡」页点这个地区，就能指定抽这一池。',
        '买下').then(ok => {
          if (!ok) return;
          if (ST.spendCoins(ST.TICKET_COST)) {
            if (window.SFX) SFX.play('coin');
            ST.giveTicket(slug, 1);
            burst(U.rand(innerWidth * .3, innerWidth * .7), innerHeight * .35, { count: 20, dist: 130 });
            toast(city.city + ' 单抽券 ＋1', 'ok', '目前持有 ' + ST.tickets(slug) + ' 张');
            render(); APP.refresh();
            if (window.Gacha) Gacha.render();
          }
        });
    });
  }

  function render() {
    renderColors(); renderStickers(); renderPiggy(); renderTickets();
  }

  window.Shop = { render };
})();
