/* ══════════════════════════════════════════════
   梦想地图 · 图鉴相册
   先按大洲分组，每一洲下再按地区分册；每册 20 张，每页 6 张；翻页时相册像翻书一样翻过去。
   点击卡片可看图片介绍（100 字左右）与卡片等级；收集度达标可领奖励。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, sleep, toast, dialog, confirmDlg, burst, DUR, nowISO } = U;

  const CITIES = window.DM_CITIES || [];
  const PER_PAGE = 6;

  const CONT = { asia: '亚洲', europe: '欧洲', namerica: '北美洲', samerica: '南美洲', africa: '非洲', oceania: '大洋洲' };
  const contOrder = Object.keys(CONT).filter(k => CITIES.some(c => c.cont === k));

  let curCont = (CITIES[0] || {}).cont || 'asia';
  let curSlug = (CITIES[0] || {}).slug;
  let curPage = 0;
  let flipping = false;

  const poolOf = slug => (window.Gacha ? Gacha.poolOf(slug) : (window.DM_CARDS || []).filter(c => c.citySlug === slug));
  const cityOf = slug => CITIES.find(c => c.slug === slug) || { city: slug, sub: '', total: 20, cont: 'asia', kind: 'city' };
  const pagesCount = slug => Math.max(1, Math.ceil(poolOf(slug).length / PER_PAGE));
  // 最后一档：整片地方是一个国家就说「集齐一个国」，否则「集齐一座城」
  const msLabel = (city, ms) => ms.n >= 20 ? (city.kind === 'country' ? '集齐一个国' : '集齐一座城') : ms.label;

  /* ══════ 单张卡片 ══════ */
  function cellHTML(card) {
    const owned = ST.hasCard(card.id);
    return '<button class="cd-cell' + (owned ? '' : ' locked') + '" data-id="' + card.id + '" aria-label="' + esc(card.name) + '">' +
      window.Gacha.filmHTML(card) +
      '</button>';
  }

  /* ══════ 上方信息条 / 大洲 + 地区分册页签 ══════ */
  function renderBar() {
    const owned = ST.totalOwned(), total = (window.DM_CARDS || []).length;
    const fullCities = CITIES.filter(c => ST.cityOwned(c.slug) >= c.total).length;
    const sub = el('cx-sub');
    if (sub) sub.innerHTML = '已收集 <b>' + owned + '</b> / ' + total +
      ' · 集齐 <b>' + fullCities + '</b> / ' + CITIES.length + ' 个地区' +
      (ST.picks() > 0 ? ' · <b class="pick-n">UR 自选券 ' + ST.picks() + ' 张</b>' : '');

    const conts = el('cx-cont');
    if (conts) {
      conts.innerHTML = contOrder.map(k => {
        const list = CITIES.filter(c => c.cont === k);
        const full = list.filter(c => ST.cityOwned(c.slug) >= c.total).length;
        return '<button class="cxc' + (k === curCont ? ' on' : '') + '" data-cont="' + k + '">' +
          esc(CONT[k]) + '<i>' + full + ' / ' + list.length + '</i></button>';
      }).join('');
      $$('#cx-cont .cxc').forEach(b => b.onclick = () => {
        curCont = b.dataset.cont;
        const first = CITIES.filter(c => c.cont === curCont)[0];
        curSlug = first ? first.slug : curSlug;
        curPage = 0;
        renderAll();
      });
    }

    // 当前大洲里没有选中的地区时，落到第一处
    if (!CITIES.some(c => c.slug === curSlug && c.cont === curCont)) {
      const first = CITIES.filter(c => c.cont === curCont)[0];
      if (first) { curSlug = first.slug; curPage = 0; }
    }

    const tabs = el('cx-tabs');
    if (tabs) {
      const list = CITIES.filter(c => c.cont === curCont);
      tabs.innerHTML = list.map(c => {
        const got = ST.cityOwned(c.slug);
        return '<button class="cxt' + (c.slug === curSlug ? ' on' : '') + (got >= c.total ? ' full' : '') + '" data-slug="' + c.slug + '">' +
          '<span class="cxt-n">' + esc(c.city) + '</span><span class="cxt-p">' + got + '/' + c.total + '</span></button>';
      }).join('') +
        (ST.picks() > 0 ? '<button class="cxt pick" id="cx-pick">✦ 用自选券换一张</button>' : '');
      $$('#cx-tabs .cxt[data-slug]').forEach(b => b.onclick = () => goto(b.dataset.slug));
      const pk = el('cx-pick');
      if (pk) pk.onclick = pickUR;
    }
  }

  function goto(slug) {
    if (flipping || slug === curSlug) return;
    const c = CITIES.find(x => x.slug === slug);
    if (c && c.cont !== curCont) curCont = c.cont;
    curSlug = slug; curPage = 0;
    renderAll(true, 1);
    requestAnimationFrame(() => { const t = el('cx-tabs'); if (t) t.scrollLeft = 0; });
  }

  /* ══════ 翻页 ══════ */
  function renderBook(flipDir, dir) {
    const book = el('cx-book');
    if (!book) return;
    const pages = [];
    const pool = poolOf(curSlug);
    for (let i = 0; i < pool.length; i += PER_PAGE) pages.push(pool.slice(i, i + PER_PAGE));
    const page = pages[curPage] || [];
    const html = '<div class="pg">' + page.map(cellHTML).join('') + '</div>';

    if (!flipDir || U.REDUCED) {
      book.innerHTML = html;
      bindCells(book);
      return;
    }

    flipping = true;
    const turner = document.createElement('div');
    turner.className = 'turner';
    if (dir > 0) {
      turner.innerHTML = book.innerHTML;      // 旧页向右翻走
      book.innerHTML = html;
      book.appendChild(turner);
      requestAnimationFrame(() => turner.classList.add('go-fwd'));
      setTimeout(() => { turner.remove(); flipping = false; }, 620);
    } else {
      turner.innerHTML = html;                // 新页从左侧翻回来
      const old = book.innerHTML;
      book.innerHTML = old;
      book.appendChild(turner);
      turner.classList.add('at-back');
      requestAnimationFrame(() => turner.classList.add('go-back'));
      setTimeout(() => { turner.remove(); book.innerHTML = html; bindCells(book); flipping = false; }, 620);
    }
    bindCells(book, true);
  }

  function bindCells(scope, skipTurner) {
    $$('.cd-cell', scope).forEach(b => {
      if (skipTurner && b.closest('.turner')) return;
      b.onclick = () => openCard(b.dataset.id);
    });
  }

  /* ══════ 卡片详情 ══════ */
  function openCard(id) {
    const c = (window.DM_CARDS || []).find(x => x.id === id);
    if (!c) return;
    const owned = ST.hasCard(id);
    const city = cityOf(c.citySlug);
    const lv = c.rarity === 'UR' ? 'UR · 标志性景观' : 'SR · 地方景观';
    const gotAt = owned ? ST.S.own[id] : null;

    dialog({
      wide: true,
      title: owned ? c.name : '??? 未冲洗',
      body:
        '<div class="cd">' +
        '<div class="cd-img">' + window.Gacha.filmHTML(c, { big: true }) + '</div>' +
        '<div class="cd-info">' +
        '<div class="cd-city">' + esc(city.city) + ' · 第 ' + c.idx + ' / ' + city.total + ' 张</div>' +
        '<div class="cd-lv ' + (c.rarity === 'UR' ? 'ur' : 'sr') + '">卡片等级：' + esc(lv) + '</div>' +
        '<div class="cd-intro">' + (owned ? esc(c.intro) : '这张还没有冲洗出来。去「抽卡」里，把 ' + esc(city.city) + ' 的奖池抽满，它就会显影。') + '</div>' +
        (gotAt ? '<div class="cd-when">收集于 ' + U.dateFullCN(gotAt) + ' ' + U.timeCN(gotAt) + '</div>' : '') +
        (owned ? '<div class="cd-acts">' +
          '<button class="pix-btn ghost sm" data-x="wall">✚ 贴到目标墙上</button>' +
          '<button class="pix-btn ghost sm" data-x="save">↓ 存下这张照片</button>' +
          '</div>' : '') +
        '</div></div>',
      ok: '关闭',
      cancel: null,
      onMount: (m, close) => {
        const wallBtn = $('[data-x="wall"]', m);
        if (wallBtn) wallBtn.onclick = () => {
          if (!window.Wall || !Wall.addPhoto(c.id)) { toast('先把这张收进相册吧', 'warn'); return; }
          close(false);
          if (window.APP && APP.tab) APP.tab('wall');
          toast('已经钉到目标墙上了', 'ok', '不喜欢的话长按照片就能取下');
        };
        const saveBtn = $('[data-x="save"]', m);
        if (saveBtn) saveBtn.onclick = async () => {
          close(false);
          const phone = toGallery();
          const ok = await savePhoto(c);
          if (window.SFX) SFX.play(ok ? 'save' : 'err');
          toast(ok ? (phone ? '已存到手机相册' : '照片已保存') : '这个环境不支持保存', ok ? 'ok' : 'warn', ok ? fileNameOf(c) : '可以在电脑版里再存一次');
        };
      }
    });
  }

  /* ══════ 照片导出 ══════ */
  function fileNameOf(c) {
    return '梦想地图-' + cityOf(c.citySlug).city + '-' + c.name + '.jpg';
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* 安卓壳里的相册插件（Capacitor） */
  function gallery() {
    const C = window.Capacitor;
    return (C && C.Plugins && C.Plugins.Gallery) ? C.Plugins.Gallery : null;
  }
  const toGallery = () => !!gallery();

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error || new Error('读取失败'));
      fr.readAsDataURL(blob);
    });
  }

  async function savePhoto(c) {
    const name = fileNameOf(c);
    const G = gallery();
    if (G) {
      try {
        const r = await fetch(c.file, { cache: 'force-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const base64 = await blobToBase64(await r.blob());
        await G.saveImage({ base64: base64, name: name });
        return true;
      } catch (e) {
        console.warn('存相册失败，改走下载', e);
      }
    }
    try {
      const r = await fetch(c.file, { cache: 'force-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      downloadBlob(await r.blob(), name);
      return true;
    } catch (e) {
      // file:// 之类取不到二进制时，退回成直接指向图片的下载链接
      try {
        const a = document.createElement('a');
        a.href = c.file; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        return true;
      } catch (e2) { return false; }
    }
  }

  async function saveAll() {
    const own = (window.DM_CARDS || []).filter(c => ST.hasCard(c.id));
    if (!own.length) { toast('相册里还没有照片', 'warn', '先去抽卡收集几张'); return; }
    const toPhone = toGallery();
    const ok = await confirmDlg('导出全部 ' + own.length + ' 张照片？',
      toPhone ? '会逐张存进手机相册的「Pictures/梦想地图」文件夹。' : '会逐张存成 JPG 到下载文件夹；浏览器可能会询问「是否允许下载多个文件」。', '开始导出');
    if (!ok) return;
    toast('开始导出…', 'ok', '共 ' + own.length + ' 张，先别关掉这一页');
    let n = 0;
    for (const c of own) {
      if (await savePhoto(c)) n++;
      await sleep(320);
    }
    toast('导出了 ' + n + ' 张照片', n ? 'ok' : 'warn', n ? (toPhone ? '在手机相册的「梦想地图」里' : '在下载文件夹里') : '这个环境不支持批量保存，试试电脑版');
  }

  /* ══════ UR 自选券 ══════ */
  function pickUR() {
    if (ST.picks() <= 0) { toast('没有可用的自选券', 'warn'); return; }
    const left = (window.DM_CARDS || []).filter(c => c.rarity === 'UR' && !ST.hasCard(c.id));
    if (!left.length) { toast('二十个地区的 UR 你都已经收集齐了', 'ok', '这张券先留着吧'); return; }
    dialog({
      wide: true,
      title: '用自选券换一张 UR',
      desc: '选一张你还没收集到的、每处地方最著名的那一景。查看图鉴里的 UR 卡片详情可以确认。',
      ok: '取消',
      cancel: null,
      body: '<div class="pick-grid">' + left.map(c =>
        '<button class="pick-cell" data-id="' + c.id + '">' +
        '<span class="pc-c">' + esc(cityOf(c.citySlug).city) + '</span>' +
        '<span class="pc-n">' + esc(c.name) + '</span></button>').join('') + '</div>',
      onMount: (m, close) => {
        $$('.pick-cell', m).forEach(b => b.onclick = () => {
          const id = b.dataset.id;
          if (!ST.usePick()) { toast('自选券不足', 'warn'); return; }
          ST.S.own[id] = nowISO();
          ST.addLog({ at: nowISO(), slug: (window.DM_CARDS.find(x => x.id === id) || {}).citySlug, cardId: id, name: (window.DM_CARDS.find(x => x.id === id) || {}).name, rarity: 'UR', via: 'pick' });
          ST.touch('collect');
          close(true);
          const card = window.DM_CARDS.find(x => x.id === id);
          const city = cityOf(card.citySlug);
          toast('已收进相册：' + card.name, 'dream', city.city);
          renderAll();
          if (window.APP && APP.refresh) APP.refresh();
          if (window.Gacha) Gacha.render();
        });
      }
    });
  }

  /* ══════ 收集度奖励 ══════ */
  function renderRewards() {
    const host = el('cx-rewards');
    if (!host) return;
    const any = ST.picks();
    const chainDone = ST.S.chain.done.length;
    host.innerHTML =
      (window.ACH ? ACH.mainHTML() : '') +
      '<div class="cr-chain"><b>打卡链</b> 已打卡 <b>' + chainDone + '</b> / ' + CITIES.length +
      ' 处 · 每集齐一处，下一站自动送你 1 张地区单抽券</div>' +
      contOrder.map(k => {
        const list = CITIES.filter(c => c.cont === k);
        return '<div class="cr-cont">' + esc(CONT[k]) + '</div>' + list.map(city => {
          const got = ST.cityOwned(city.slug);
          return '<div class="cr-city">' +
            '<div class="cr-hd"><span class="cr-n">' + esc(city.city) +
            (city.kind === 'country' ? '<i class="cr-tag">国</i>' : '') + '</span>' +
            '<span class="cr-p">' + got + ' / ' + city.total + '</span></div>' +
            '<div class="cr-ms">' + ST.MILESTONES.map(ms => {
              const k2 = ST.claimKey(city.slug, ms.n);
              const reached = got >= ms.n, claimed = ST.isClaimed(k2);
              const label = ms.n + ' 张 · ' + msLabel(city, ms) + ' · +' + ms.coins + ' ◆' + (ms.ticket ? ' + 单抽券 ' + ms.ticket + ' 张' : '');
              return '<button class="ms' + (claimed ? ' claimed' : reached ? ' ready' : '') + '" data-k="' + k2 + '" data-s="' + city.slug + '" data-n="' + ms.n + '"' + ((!reached || claimed) ? ' disabled' : '') + '>' +
                (claimed ? '✓ ' : reached ? '领取 ' : '未达成 ') + label + '</button>';
            }).join('') + '</div></div>';
        }).join('');
      }).join('') + (any ? '<div class="st-note">你有 ' + any + ' 张 UR 自选券，可在相册页签上使用。</div>' : '');

    $$('#cx-rewards .ms').forEach(b => b.onclick = () => {
      const slug = b.dataset.s, n = +b.dataset.n;
      const ms = ST.MILESTONES.find(x => x.n === n);
      if (!ms) return;
      if (ST.MILESTONE_CLAIM(ST.claimKey(slug, n), ms.coins, ms.ticket)) {
        burst(U.rand(innerWidth * .3, innerWidth * .7), innerHeight * .4, { count: 30, dist: 200 });
        const city = cityOf(slug);
        let tail = '心愿币 ＋' + ms.coins + (ms.ticket ? ' · 地区单抽券 ＋' + ms.ticket : '');
        if (n >= 20) {
          const nx = ST.chainGift(slug);
          if (nx) tail += ' · 打卡链下一站 ' + cityOf(nx).city + ' 单抽券 ＋1';
        }
        toast(city.city + ' · ' + msLabel(city, ms) + ' 奖励已领取', 'ok', tail);
        renderAll();
        if (window.APP && APP.refresh) APP.refresh();
        if (window.Gacha) Gacha.render();
      }
    });
    if (window.ACH) ACH.bind(host);
  }

  /* ══════ 汇总渲染 ══════ */
  function renderAll(flipDir, dir) {
    renderBar();
    renderBook(flipDir, dir);
    renderRewards();
    const pg = el('cx-page');
    if (pg) pg.textContent = (curPage + 1) + ' / ' + pagesCount(curSlug);
  }

  function turn(dir) {
    if (flipping) return;
    const total = pagesCount(curSlug);
    const nx = curPage + dir;
    if (nx < 0 || nx >= total) {
      toast(dir < 0 ? '已经是第一页了' : '这本册子翻完了', 'warn');
      return;
    }
    curPage = nx;
    if (window.SFX) SFX.play('flip');
    renderAll(true, dir);
  }

  /* ══════ 旅行手账导出 ══════ */
  function exportBook() {
    const own = (window.DM_CARDS || []).filter(c => ST.hasCard(c.id));
    if (!own.length) { toast('还没有可以装订的照片', 'warn', '先去抽卡，再回来做手账'); return; }

    const abs = f => { try { return new URL(f, location.href).href; } catch (e) { return f; } };
    const prof = ST.S.profile || {};
    const d = new Date();
    const stamp = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';

    const secs = contOrder.map(k => {
      const list = CITIES.filter(c => c.cont === k).filter(c => ST.cityOwned(c.slug) > 0);
      if (!list.length) return '';
      return '<section><h2>' + esc(CONT[k]) + '</h2>' + list.map(city => {
        const cards = own.filter(c => c.citySlug === city.slug);
        return '<div class="bk-region"><h3>' + esc(city.city) +
          '<span>' + cards.length + ' / ' + city.total + '</span></h3>' +
          '<div class="bk-grid">' + cards.map(c =>
            '<figure><img src="' + abs(c.file) + '" alt=""><figcaption><b>' + esc(c.name) + '</b>' +
            '<i>' + esc((c.intro || '').slice(0, 46)) + '…</i></figcaption></figure>'
          ).join('') + '</div></div>';
      }).join('') + '</section>';
    }).join('');

    const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>梦想地图 · 旅行手账</title><style>' +
      '*{box-sizing:border-box}body{margin:0;background:#f5f1e6;color:#2c2a24;font-family:"Songti SC","SimSun",serif}' +
      '.cov{padding:64px 56px 40px;border-bottom:3px double #b99c5f}' +
      '.cov .k{letter-spacing:.4em;font-size:12px;color:#8b7a56}' +
      '.cov h1{font-size:40px;margin:18px 0 6px;letter-spacing:.08em}' +
      '.cov .dy{font-size:17px;color:#6a5f45;line-height:1.9;max-width:640px}' +
      '.cov .st{display:flex;gap:34px;margin-top:26px;font-size:13px;color:#5b5240}' +
      '.cov .st b{display:block;font-size:26px;color:#a8802f;font-family:Georgia,serif}' +
      'section{padding:26px 56px}section h2{font-size:15px;letter-spacing:.34em;color:#8b7a56;border-bottom:1px solid #d8cba8;padding-bottom:8px;margin:34px 0 16px}' +
      '.bk-region h3{font-size:20px;margin:20px 0 10px;letter-spacing:.06em}' +
      '.bk-region h3 span{float:right;font-size:12px;color:#8b7a56;letter-spacing:0}' +
      '.bk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}' +
      'figure{margin:0;background:#fff;border:1px solid #e2d8c0;padding:6px}' +
      'figure img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;filter:saturate(.95)}' +
      'figcaption{padding:5px 2px 2px}figcaption b{display:block;font-size:12px;font-weight:600}' +
      'figcaption i{display:block;font-style:normal;font-size:10px;line-height:1.5;color:#7d745f;margin-top:3px}' +
      'footer{padding:20px 56px 48px;font-size:11px;color:#9a9078;text-align:center}' +
      '@page{size:A4;margin:12mm}@media print{body{background:#fff}.bk-grid{grid-template-columns:repeat(3,1fr)}}' +
      '</style></head><body>' +
      '<div class="cov"><div class="k">DREAM MAP · TRAVEL JOURNAL</div>' +
      '<h1>' + esc(prof.nickname || '旅行者') + ' 的旅行手账</h1>' +
      '<div class="dy">' + (prof.dream ? '梦想：' + esc(prof.dream) : '把想去的地方，一张一张收进相册。') + '</div>' +
      '<div class="st"><div><b>' + own.length + '</b>已收集</div><div><b>' +
      CITIES.filter(c => ST.cityOwned(c.slug) >= c.total).length + '</b>已集齐</div><div><b>' +
      CITIES.filter(c => ST.cityOwned(c.slug) > 0).length + '</b>走过的地区</div></div>' +
      '<div class="dy" style="margin-top:26px;font-size:13px">' + stamp + ' 装订</div></div>' +
      secs + '<footer>由「梦想地图」自动排版 · 可直接打印或另存为 PDF</footer></body></html>';

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.warn(e); } }, 900);
      toast('手账已生成', 'ok', '在弹出窗口里打印或另存为 PDF');
      return;
    }
    // 移动端 WebView 常常不给弹窗，退回成一份可下载的 HTML
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '梦想地图-旅行手账.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('手账已存成文件', 'ok', '用浏览器打开后就能打印成 PDF');
    } catch (e) {
      toast('这个环境不支持导出', 'warn', '可以到电脑版的相册里再导一次');
    }
  }

  function bind() {
    el('cx-prev').onclick = () => turn(-1);
    el('cx-next').onclick = () => turn(1);
    const bk = el('cx-book-btn');
    if (bk) bk.onclick = exportBook;
    const sv = el('cx-save-btn');
    if (sv) sv.onclick = saveAll;
    renderAll();
  }

  window.Codex = { render: renderAll, bind, goto, pickUR, openCard };
})();
