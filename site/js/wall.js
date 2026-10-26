/* ══════════════════════════════════════════════
   梦想地图 · 目标墙
   便利贴贴在墙上；拖动改变位置；双击（双击 / 双击触屏）＝完成它。
   梦想便利贴单独钉在墙顶的「梦想区」，纸色为鎏金，尺寸更大。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, sleep, clamp, toast, dialog, confirmDlg, burst, floatText, centerOf, cheer, colorOf, stickerOf, DUR, REDUCED } = U;

  const DREAM_W = 200, DREAM_H = 132;
  const NOTE_W = 152, NOTE_H = 116;
  const PHOTO_W = 176, PHOTO_H = 204;
  const QUOTE_W = 124;

  /* ── 激励语字体 ── */
  const QUOTE_FONTS = [
    { id: 'kai', name: '楷书' },
    { id: 'xing', name: '行书' },
    { id: 'cao', name: '草书' },
    { id: 'script', name: '连笔' },
    { id: 'fancy', name: '花体' },
    { id: 'round', name: '圆体' }
  ];
  const FONT_STACK = {
    kai: "'QuoteKai','KaiTi','STKaiti','楷体',serif",
    xing: "'QuoteXing','STXingkai','华文行楷','KaiTi',cursive",
    cao: "'QuoteCao','STXingkai','华文行楷',cursive",
    script: "'QuoteScript','Segoe Script','Dancing Script',cursive",
    fancy: "'QuoteFancy','Segoe Script','Great Vibes',cursive",
    round: "'QuoteRound','Varela Round','Comic Sans MS',sans-serif"
  };
  const fontOf = id => FONT_STACK[id] || FONT_STACK.kai;

  /* 激励语是窄长条，按字数估算它会长到多高（用于贴墙时避免越界） */
  function quoteHeight(text) {
    let units = 0;
    for (const ch of String(text || '')) {
      units += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.55;
    }
    const lines = Math.max(1, Math.ceil((units + 1) / 5.4));
    return 50 + lines * 27;
  }

  let editId = null, pendingPos = null;

  /* ── 稳定倾斜角（由 id 派生，刷新不变） ── */
  function tiltOf(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (h % 9) - 4;
  }

  const sizeOf = (type, n) => type === 'dream' ? { w: DREAM_W, h: DREAM_H }
    : type === 'photo' ? { w: PHOTO_W, h: PHOTO_H }
      : type === 'quote' ? { w: QUOTE_W, h: n ? quoteHeight(n.text) : 130 }
        : { w: NOTE_W, h: NOTE_H };
  const PAN = () => el('wall-pan');
  const containerFor = type => type === 'dream' ? el('w-dreams') : PAN();
  const typeLabel = { small: '小目标', goal: '目标', dream: '梦想', photo: '照片', quote: '激励语' };

  /* ══════ 背景墙视图（可缩放 / 可拖动） ══════ */
  const VIEW_MIN = 0.4, VIEW_MAX = 2.6;
  let view = { s: 1, tx: 0, ty: 0 };
  let W0 = 0, H0 = 0;

  function layout() {
    const wall = el('wall'), pan = PAN();
    if (!wall || !pan) return;
    W0 = Math.max(1180, Math.round(wall.clientWidth * 1.7));
    H0 = Math.max(820, Math.round(wall.clientHeight * 1.6));
    pan.style.width = W0 + 'px';
    pan.style.height = H0 + 'px';
    applyView();

    // 梦想区：槽位固定为可视区大小，缩放靠 transform
    const dz = el('w-dreams'), zone = el('w-dreamzone');
    if (dz && zone) {
      DW = zone.clientWidth; DH = zone.clientHeight;
      dz.style.width = DW + 'px';
      dz.style.height = DH + 'px';
      applyDView();
      zoomDzUI();
    }
  }

  /* ── 梦想区视图（独立缩放 / 拖动） ── */
  const DZ_MIN = 0.7, DZ_MAX = 2.2;
  let dview = { s: 1, tx: 0, ty: 0 };
  let DW = 0, DH = 0;

  function applyDView() {
    const dz = el('w-dreams'), zone = el('w-dreamzone');
    if (!dz || !zone) return;
    const vw = zone.clientWidth, vh = zone.clientHeight;
    const w = DW * dview.s, h = DH * dview.s;
    dview.tx = w <= vw ? (vw - w) / 2 : clamp(dview.tx, vw - w, 0);
    dview.ty = h <= vh ? (vh - h) / 2 : clamp(dview.ty, vh - h, 0);
    dz.style.transform = 'translate(' + Math.round(dview.tx) + 'px,' + Math.round(dview.ty) + 'px) scale(' + dview.s + ')';
  }

  function zoomDzUI() {
    const v = el('dz-zoom-val');
    if (v) v.textContent = Math.round(dview.s * 100) + '%';
    const zin = el('dz-zoom-in'), zout = el('dz-zoom-out');
    if (zin) zin.disabled = dview.s >= DZ_MAX - 0.01;
    if (zout) zout.disabled = dview.s <= DZ_MIN + 0.01;
  }

  function zoomDzAt(f, px, py) {
    const zone = el('w-dreamzone');
    if (!zone) return;
    const r = zone.getBoundingClientRect();
    const lx = (px - r.left - dview.tx) / dview.s;
    const ly = (py - r.top - dview.ty) / dview.s;
    const ns = clamp(dview.s * f, DZ_MIN, DZ_MAX);
    if (Math.abs(ns - dview.s) < 0.001) return;
    dview.s = ns;
    dview.tx = (px - r.left) - lx * ns;
    dview.ty = (py - r.top) - ly * ns;
    applyDView(); zoomDzUI();
  }

  function zoomDzCenter(f) {
    const zone = el('w-dreamzone');
    if (!zone) return;
    const r = zone.getBoundingClientRect();
    // 以现有梦想便利贴的重心为缩放中心，放大后不至于把第一张挤出可视区
    const ns = ST.activeNotes().filter(n => n.type === 'dream');
    let lx = DW / 2, ly = DH / 2;
    if (ns.length) {
      lx = ns.reduce((s, n) => s + n.x + DREAM_W / 2, 0) / ns.length;
      ly = ns.reduce((s, n) => s + n.y + DREAM_H / 2, 0) / ns.length;
    }
    zoomDzAt(f, r.left + lx * dview.s + dview.tx, r.top + ly * dview.s + dview.ty);
  }

  function applyView() {
    const wall = el('wall'), pan = PAN();
    if (!wall || !pan) return;
    const vw = wall.clientWidth, vh = wall.clientHeight;
    const w = W0 * view.s, h = H0 * view.s;
    view.tx = w <= vw ? (vw - w) / 2 : clamp(view.tx, vw - w, 0);
    view.ty = h <= vh ? (vh - h) / 2 : clamp(view.ty, vh - h, 0);
    pan.style.transform = 'translate(' + Math.round(view.tx) + 'px,' + Math.round(view.ty) + 'px) scale(' + view.s + ')';
  }

  function zoomUI() {
    const v = el('w-zoom-val');
    if (v) v.textContent = Math.round(view.s * 100) + '%';
    const zin = el('w-zoom-in'), zout = el('w-zoom-out');
    if (zin) zin.disabled = view.s >= VIEW_MAX - 0.01;
    if (zout) zout.disabled = view.s <= VIEW_MIN + 0.01;
  }

  // 以屏幕上某一点为锚点缩放（滚轮 / 双指）
  function zoomAt(f, px, py) {
    const wall = el('wall');
    if (!wall) return;
    const r = wall.getBoundingClientRect();
    const lx = (px - r.left - view.tx) / view.s;
    const ly = (py - r.top - view.ty) / view.s;
    const ns = clamp(view.s * f, VIEW_MIN, VIEW_MAX);
    if (Math.abs(ns - view.s) < 0.001) return;
    view.s = ns;
    view.tx = (px - r.left) - lx * ns;
    view.ty = (py - r.top) - ly * ns;
    applyView(); zoomUI();
  }

  function zoomCenter(f) {
    const wall = el('wall');
    if (!wall) return;
    const r = wall.getBoundingClientRect();
    zoomAt(f, r.left + r.width / 2, r.top + r.height / 2);
  }

  /* ── 找一个不重叠的位置 ── */
  function freeSpot(host, w, h) {
    // 墙可能因为切到别的页签而暂时隐藏，这时 clientWidth 是 0，退回上次算出的画布尺寸
    const cw = host.clientWidth || W0 || 1180, ch = host.clientHeight || H0 || 820;
    const busy = ST.activeNotes()
      .filter(n => containerFor(n.type) === host)
      .map(n => { const s = sizeOf(n.type, n); return { x: n.x, y: n.y, w: s.w, h: s.h }; });
    for (let y = 12; y < ch - h - 12; y += 26) {
      for (let x = 12; x < cw - w - 12; x += 26) {
        const hit = busy.some(b => !(x + w + 10 < b.x || b.x + b.w + 10 < x || y + h + 10 < b.y || b.y + b.h + 10 < y));
        if (!hit) return { x, y };
      }
    }
    return {
      x: clamp(20 + Math.random() * Math.max(10, cw - w - 40), 8, Math.max(8, cw - w - 8)),
      y: clamp(20 + Math.random() * Math.max(10, ch - h - 40), 8, Math.max(8, ch - h - 8))
    };
  }

  /* ── 渲染一张便利贴 ── */
  function noteNode(n) {
    const c = colorOf(n.color), sk = stickerOf(n.sticker);
    const d = document.createElement('div');
    d.className = 'note t-' + n.type + (n.type === 'dream' ? ' dream' : '') +
      (n.type === 'quote' ? ' qf-' + (n.font || 'kai') : '');
    d.dataset.id = n.id;
    d.style.left = n.x + 'px';
    d.style.top = n.y + 'px';
    d.style.setProperty('--bg', c.bg);
    d.style.setProperty('--ink', c.ink);
    d.style.setProperty('--tilt', tiltOf(n.id) + 'deg');

    // 照片便利贴：相册里收集到的实景照片钉在墙上
    if (n.type === 'photo') {
      const card = (window.DM_CARDS || []).find(x => x.id === n.cardId);
      d.innerHTML =
        '<i class="stk stk-pin"></i>' +
        (card
          ? '<div class="n-photo"><img src="' + card.file + '" alt="' + esc(card.name) + '" draggable="false"></div>'
          : '<div class="n-photo"></div>') +
        '<div class="n-cap">' + esc(n.text) + '<i>' + esc(card ? cityName(card.citySlug) : '照片') + '</i></div>';
      bindNote(d, n);
      return d;
    }

    const steps = n.type === 'dream' ? (n.steps || []) : [];
    const doneN = steps.filter(s => s.doneAt).length;
    d.classList.toggle('has-img', !!(n.img && n.type === 'dream'));
    d.innerHTML =
      (sk.mark ? '<i class="stk stk-' + sk.mark + '"></i>' : '') +
      (n.img && n.type === 'dream' ? '<div class="n-img"><img src="' + n.img + '" alt="" draggable="false"></div>' : '') +
      '<div class="n-tag">' + typeLabel[n.type] + '</div>' +
      '<div class="n-txt">' + esc(n.text) + '</div>' +
      '<div class="n-meta">' + U.dateCN(n.createdAt) + '</div>' +
      (n.type === 'dream'
        ? '<div class="n-steps' + (steps.length ? ' has' : '') + '">' +
          (steps.length ? '里程碑 ' + doneN + ' / ' + steps.length : '＋ 拆成小目标') + '</div>'
        : '');
    bindNote(d, n);
    const sp = $('.n-steps', d);
    if (sp) {
      sp.addEventListener('pointerdown', e => e.stopPropagation());
      sp.addEventListener('click', e => { e.stopPropagation(); openSteps(n.id); });
    }
    return d;
  }

  /* ── 拖动 + 双击 + 长按 ── */
  function bindNote(node, n) {
    const host = containerFor(n.type);
    // 梦想区有自己的缩放，屏幕位移要按所在区域的倍率换算
    const sc = () => (n.type === 'dream' ? dview.s : view.s);
    let sx = 0, sy = 0, ox = 0, oy = 0, moved = 0, dragging = false, pid = null;
    let lpTimer = null, lpFired = false, lastTap = 0;

    node.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      pid = e.pointerId;
      sx = e.clientX; sy = e.clientY; ox = n.x; oy = n.y; moved = 0; dragging = true; lpFired = false;
      try { node.setPointerCapture(pid); } catch (_) { }
      node.classList.add('grab');
      lpTimer = setTimeout(() => {
        lpTimer = null; lpFired = true; dragging = false;
        node.classList.remove('grab');
        try { node.releasePointerCapture(pid); } catch (_) { }
        if (n.type === 'photo') openPhotoMenu(n.id); else openNoteMenu(n.id);
      }, 560);
      e.stopPropagation();
    });

    node.addEventListener('pointermove', e => {
      if (!dragging || lpFired) return;
      const dx = (e.clientX - sx) / sc(), dy = (e.clientY - sy) / sc();
      moved = Math.max(moved, Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy));
      // 手指按下时抖几像素很常见，给长按留一点余量，别一动就把菜单取消掉
      if (moved > 8 && lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      if (moved <= 5) return;
      const sz = sizeOf(n.type, n);
      const cw = host.clientWidth, ch = host.clientHeight;
      const nx = clamp(ox + dx, 4, Math.max(4, cw - sz.w - 4));
      const ny = clamp(oy + dy, 4, Math.max(4, ch - sz.h - 4));
      node.style.left = nx + 'px';
      node.style.top = ny + 'px';
      node.dataset.nx = nx; node.dataset.ny = ny;
    });

    node.addEventListener('pointerup', e => {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      node.classList.remove('grab');
      if (lpFired) { lpFired = false; dragging = false; return; }
      if (!dragging) return;
      dragging = false;
      if (moved > 5) {
        ST.updateNote(n.id, { x: +node.dataset.nx || n.x, y: +node.dataset.ny || n.y });
        n.x = +node.dataset.nx || n.x; n.y = +node.dataset.ny || n.y;
        return;
      }
      // 单击 → 判定双击
      const now = Date.now();
      if (now - lastTap < 360) {
        lastTap = 0;
        if (n.type === 'photo') openPhoto(n.id);
        else if (n.type === 'quote') toast('这句话不用完成，留着陪你走', 'ok');
        else askComplete(n.id);
      }
      else {
        lastTap = now;
        if (!REDUCED) node.animate(
          [{ transform: 'rotate(var(--tilt)) scale(1)' }, { transform: 'rotate(var(--tilt)) scale(1.05)' }, { transform: 'rotate(var(--tilt)) scale(1)' }],
          { duration: 200, easing: 'ease-out' });
      }
    });
    node.addEventListener('pointercancel', () => {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      dragging = false; node.classList.remove('grab');
    });
    node.addEventListener('contextmenu', e => { e.preventDefault(); });
  }

  /* ── 梦想里程碑拆分 ── */
  function openSteps(id) {
    const n = ST.noteById(id);
    if (!n) return;

    const paint = (host) => {
      const steps = ST.stepsOf(id);
      host.innerHTML =
        '<div class="sp-list">' + (steps.length
          ? steps.map(s => '<div class="sp-it' + (s.doneAt ? ' done' : '') + '">' +
            '<span>' + (s.doneAt ? '✓ ' : '') + esc(s.text) + '</span>' +
            (s.doneAt ? '<i>已完成</i>' : '<button class="sp-x" data-x="' + s.id + '" title="删掉这条">✕</button>') +
            '</div>').join('')
          : '<div class="sp-none">还没有拆过。把一个梦想拆成几件今天就能做的事，它才有开始的可能。</div>') +
        '</div>' +
        '<div class="sp-add"><input class="pix-input" id="sp-txt" maxlength="30" placeholder="下一步能做的一件小事…">' +
        '<button class="pix-btn sm" id="sp-ok"' + (steps.length >= 6 ? ' disabled' : '') + '>加上</button></div>' +
        '<div class="sp-tip">' + (steps.length >= 6 ? '最多拆 6 步，先做起来。' : '加进来的每一步，都会变成墙上一张新的小目标。') + '</div>';

      const inp = $('#sp-txt', host);
      const add = () => {
        const v = ($('#sp-txt', host) || {}).value || '';
        if (!v.trim()) return;
        const spot = freeSpot(PAN(), NOTE_W, NOTE_H);
        if (ST.addStep(id, v, spot)) { render(); paint(host); if (window.APP && APP.refresh) APP.refresh(); }
      };
      const btn = $('#sp-ok', host);
      if (btn) btn.onclick = add;
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      $$('.sp-x', host).forEach(b => b.onclick = () => {
        const sid = b.dataset.x;
        ST.dropStep(id, sid);
        const child = ST.noteById(sid);
        if (child && child.status === 'active') ST.dropNote(sid);
        render(); paint(host);
      });
    };

    dialog({
      title: '把梦想拆成几步',
      desc: n.text,
      ok: '完成',
      cancel: null,
      body: '<div class="sp-box"></div>',
      onMount: (m) => { paint($('.sp-box', m)); }
    });
  }

  /* ── 便利贴长按菜单 ── */
  function openNoteMenu(id) {
    const n = ST.noteById(id);
    if (!n) return;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) { }
    dialog({
      title: '这张便利贴',
      desc: n.text,
      ok: '标记完成',
      cancel: '取消',
      body: '<div class="md-row"><button class="pix-btn ghost sm" data-x="edit">编辑内容</button>' +
        '<button class="pix-btn ghost sm" data-x="del">撕掉这张</button></div>',
      onMount: (m, close) => {
        $('[data-x="edit"]', m).onclick = () => { close(false); openComposer({ editId: id }); };
        $('[data-x="del"]', m).onclick = () => {
          close(false);
          confirmDlg('撕掉这张便利贴？', '「' + n.text + '」会从墙上消失，不计入完成统计。', '撕掉', true).then(ok => {
            if (ok) { ST.dropNote(id); render(); }
          });
        };
      }
    }).then(v => { if (v === true) askComplete(id); });
  }

  /* ── 照片长按菜单 ── */
  function askRemovePhoto(id) {
    confirmDlg('从墙上取下这张照片？', '照片还在相册里，随时可以再贴一次。', '取下', true).then(ok => {
      if (!ok) return;
      ST.dropNote(id);
      render();
      if (window.APP && APP.refresh) APP.refresh();
    });
  }

  function openPhotoMenu(id) {
    const n = ST.noteById(id);
    if (!n) return;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) { }
    dialog({
      title: '这张照片',
      desc: n.text,
      ok: '关闭',
      cancel: null,
      body: '<div class="md-row"><button class="pix-btn ghost sm" data-x="go">去相册看这张</button>' +
        '<button class="pix-btn ghost sm" data-x="off">从墙上取下</button></div>',
      onMount: (m, close) => {
        $('[data-x="go"]', m).onclick = () => { close(false); openPhoto(id); };
        $('[data-x="off"]', m).onclick = () => { close(false); askRemovePhoto(id); };
      }
    });
  }

  /* ── 打开照片对应的卡片详情 ── */
  function openPhoto(id) {
    const n = ST.noteById(id);
    if (!n || !window.Codex) return;
    if (window.APP && APP.tab) APP.tab('codex');
    setTimeout(() => {
      if (window.Codex.goto && n.cardId) {
        const card = (window.DM_CARDS || []).find(c => c.id === n.cardId);
        if (card) Codex.goto(card.citySlug);
      }
      setTimeout(() => Codex.openCard(n.cardId), 240);
    }, 260);
  }

  /* ── 把相册里的一张照片贴到目标墙上 ── */
  function addPhoto(cardId) {
    const card = (window.DM_CARDS || []).find(c => c.id === cardId);
    if (!card || !ST.hasCard(card.id)) return false;
    layout();
    const host = PAN();
    const sz = sizeOf('photo');
    const pos = freeSpot(host, sz.w, sz.h);
    ST.addNote({ type: 'photo', text: card.name, cardId: card.id, x: pos.x, y: pos.y });
    render();
    if (window.APP && APP.refresh) APP.refresh();
    return true;
  }

  /* ── 完成确认 ── */
  function askComplete(id) {
    const n = ST.noteById(id);
    if (!n) return;
    if (n.type === 'quote') { toast('这句话不用完成，留着陪你走', 'ok'); return; }
    const bonusLine = '完成后这张便利贴会从墙上消失，并计入你的「来时路」。';
    confirmDlg('完成「' + n.text + '」？', bonusLine, '我完成了').then(ok => { if (ok) complete(id); });
  }

  /* ── 完成：渐隐 + 鼓励 + 奖励 ── */
  async function complete(id) {
    const n = ST.noteById(id);
    if (!n) return;
    const node = $('.note[data-id="' + id + '"]');
    const pos = centerOf(node);
    const r = ST.doneNote(id);
    if (!r) return;
    if (window.SFX) SFX.play(n.type === 'dream' ? 'ur' : 'done');

    if (node) {
      node.classList.add('poof');
      await sleep(DUR(560));
    }
    render();

    burst(pos.x, pos.y, { count: n.type === 'dream' ? 46 : 28, dist: n.type === 'dream' ? 240 : 170 });
    floatText(pos.x, pos.y - 10, '＋' + r.granted + ' ◆', 'coin');

    let sub = '心愿币 ＋' + fmt(r.granted) + (r.combo ? '（含连击 ＋' + r.combo + '）' : '');
    if (r.ticket) sub += ' · 掉落 ' + cityName(r.ticket) + '单抽券 ×1';
    toast(cheer(n.type), n.type === 'dream' ? 'dream' : 'ok', sub);

    if (window.APP && APP.refresh) APP.refresh();

    if (n.type === 'dream') {
      await sleep(DUR(420));
      await U.grandFx('梦想 · 达成', [
        '「' + n.text + '」',
        '你做到了。不是运气，是你一步一步走过来的。',
        '这幅地图上，又多了一个真的抵达过的地方。'
      ]);
      await dialog({
        title: '你获得了一张 UR 自选券',
        desc: '去相册里，挑一张你最想要的 UR 照片收进图鉴吧。它由你自己指定，不看运气。',
        ok: '去相册选一张',
        cancel: '等会儿'
      }).then(v => { if (v === true && window.APP && APP.tab) APP.tab('codex'); });
    } else if (ST.activeNotes().length === 0 && n.type === 'small') {
      setTimeout(() => toast('墙上空了。要不要再贴一张？', 'ok', '点空白处就能贴'), DUR(900));
    }
  }

  const cityName = slug => {
    const c = (window.DM_CITIES || []).find(x => x.slug === slug);
    return c ? c.city : slug;
  };

  /* ── 渲染 ── */
  function render() {
    layout(); zoomUI();
    const all = ST.activeNotes();
    const dreams = all.filter(n => n.type === 'dream');
    const others = all.filter(n => n.type !== 'dream');

    const dz = el('w-dreams'), wl = PAN();
    if (!wl) return;
    // 清掉旧的便利贴，保留空态节点
    $$('.note', dz).forEach(n => n.remove());
    $$('.note', wl).forEach(n => n.remove());

    // 窗口尺寸变化后，旧坐标可能落在墙外，渲染时统一收进可视范围
    const fix = (n, host) => {
      const sz = sizeOf(n.type, n);
      const cw = host.clientWidth, ch = host.clientHeight;
      const x = clamp(n.x, 4, Math.max(4, cw - sz.w - 4));
      const y = clamp(n.y, 4, Math.max(4, ch - sz.h - 4));
      if (x !== n.x || y !== n.y) { ST.updateNote(n.id, { x, y }); n.x = x; n.y = y; }
      return n;
    };
    dreams.forEach(n => dz.appendChild(noteNode(fix(n, dz))));
    others.forEach(n => wl.appendChild(noteNode(fix(n, wl))));

    let de = $('.dz-empty', dz);
    if (dreams.length === 0) {
      if (!de) { de = document.createElement('div'); de.className = 'dz-empty'; de.innerHTML = '<span>还没有梦想，点这里钉上一个</span>'; dz.appendChild(de); }
    } else if (de) de.remove();

    el('w-empty').hidden = others.length > 0;
  }

  /* ── 选中的图压成小 jpg，长边不超过 560 ── */
  function shrinkImage(file, maxSide) {
    const LIM = maxSide || 560;
    return new Promise((ok, fail) => {
      const fr = new FileReader();
      fr.onerror = () => fail(new Error('read'));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => fail(new Error('decode'));
        im.onload = () => {
          let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
          if (!w || !h) return fail(new Error('empty'));
          const k = Math.min(1, LIM / Math.max(w, h));
          w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(im, 0, 0, w, h);
          let out = '';
          try { out = cv.toDataURL('image/jpeg', 0.72); } catch (_) { return fail(new Error('encode')); }
          // 压缩后仍偏大（超过约 260KB）就再降一档
          if (out.length > 350000) {
            try { out = cv.toDataURL('image/jpeg', 0.55); } catch (_) { }
          }
          ok(out);
        };
        im.src = String(fr.result || '');
      };
      fr.readAsDataURL(file);
    });
  }

  /* ══════ 便利贴编辑器 ══════ */
  function openComposer(o) {
    o = o || {};
    editId = o.editId || null;
    const box = el('composer');
    const n = editId ? ST.noteById(editId) : null;
    const st = {
      type: n ? n.type : (o.type || 'small'),
      color: n ? n.color : 'sun',
      sticker: n ? n.sticker : 'pin',
      text: n ? n.text : '',
      img: (n && n.img) || '',
      font: (n && n.font) || 'kai'
    };
    pendingPos = o.pos || null;

    const PLACE = {
      small: '例如：今天喝够 2L 水',
      goal: '例如：连续一周运动',
      dream: '例如：考上 XX 大学',
      quote: '例如：慢一点，也是在往前走'
    };

    box.hidden = false;
    box.innerHTML =
      '<div class="md-mask"></div>' +
      '<div class="cp-box">' +
      '<div class="cp-title">' + (n ? '编辑便利贴' : '贴一张新的便利贴') + '</div>' +
      '<div class="cp-seg" id="cp-type">' +
      ['small', 'goal', 'dream', 'quote'].map(t => '<button data-t="' + t + '" class="' + (st.type === t ? 'on' : '') + '">' + typeLabel[t] + '</button>').join('') +
      '</div>' +
      '<div class="cp-lbl">写点什么</div>' +
      '<textarea id="cp-text" class="pix-input" rows="2" maxlength="60" placeholder="' + PLACE[st.type] + '">' + esc(st.text) + '</textarea>' +
      '<div class="cp-sec" id="cp-sec-font" hidden>' +
      '<div class="cp-lbl">字体风格</div>' +
      '<div class="cp-fonts" id="cp-fonts"></div>' +
      '</div>' +
      '<div class="cp-sec" id="cp-sec-img">' +
      '<div class="cp-lbl">配一张图<span class="cp-warn" id="cp-img-warn"></span></div>' +
      '<div class="cp-imgrow">' +
      '<button class="pix-btn ghost sm" id="cp-img-pick">＋ 选择图片</button>' +
      '<div class="cp-imgprev" id="cp-img-prev" hidden><img alt=""><button class="cp-img-x" id="cp-img-x" title="移除图片">✕</button></div>' +
      '</div>' +
      '<input type="file" id="cp-img-file" accept="image/*" hidden>' +
      '<div class="cp-tip" id="cp-img-tip">会自动压成适合便利贴的小图，只存在本机。</div>' +
      '</div>' +
      '<div class="cp-sec" id="cp-sec-color">' +
      '<div class="cp-lbl">纸色<span class="cp-warn" id="cp-warn"></span></div>' +
      '<div class="cp-swatches" id="cp-colors"></div>' +
      '</div>' +
      '<div class="cp-lbl">图钉 / 贴纸</div>' +
      '<div class="cp-swatches" id="cp-stickers"></div>' +
      '<div class="cp-actions"><button class="pix-btn ghost" id="cp-cancel">取消</button>' +
      '<button class="pix-btn" id="cp-save">' + (n ? '保存' : '贴上墙') + '</button></div>' +
      '</div>';

    const warn = t => { const w = el('cp-warn'); if (w) w.textContent = t || ''; };

    function paintColors() {
      warn('');
      el('cp-colors').innerHTML = U.COLORS.map(c => {
        const ok = ST.hasColor(c.id);
        return '<button class="csw' + (st.color === c.id ? ' on' : '') + (ok ? '' : ' locked') +
          '" data-c="' + c.id + '" style="background:' + c.bg + '" title="' + c.name + '">' +
          (ok ? '' : '<i class="lk">' + c.cost + '</i>') + '</button>';
      }).join('');
      $$('#cp-colors .csw').forEach(b => b.onclick = () => {
        const id = b.dataset.c, c = colorOf(id);
        if (ST.hasColor(id)) { st.color = id; paintColors(); return; }
        if (ST.coins() < c.cost) { warn('心愿币不够（需要 ' + c.cost + ' ◆）'); return; }
        confirmDlg('解锁「' + c.name + '」纸色？', '花费 ' + c.cost + ' ◆ 心愿币，永久可用。', '解锁').then(ok => {
          if (!ok) return;
          if (ST.unlockColor(id)) { st.color = id; toast('已解锁「' + c.name + '」', 'ok'); paintColors(); if (window.APP) APP.refresh(); }
          else warn('心愿币不够');
        });
      });
    }
    function paintStickers() {
      el('cp-stickers').innerHTML = U.STICKERS.map(s => {
        const ok = ST.hasSticker(s.id);
        return '<button class="ssw' + (st.sticker === s.id ? ' on' : '') + (ok ? '' : ' locked') + '" data-s="' + s.id + '">' +
          (s.mark ? '<i class="stk stk-' + s.mark + '"></i>' : '<i>无</i>') +
          (ok ? '' : '<i class="lk">' + s.cost + '</i>') + '</button>';
      }).join('');
      $$('#cp-stickers .ssw').forEach(b => b.onclick = () => {
        const id = b.dataset.s, s = stickerOf(id);
        if (ST.hasSticker(id)) { st.sticker = id; paintStickers(); return; }
        if (ST.coins() < s.cost) { warn('心愿币不够（需要 ' + s.cost + ' ◆）'); return; }
        confirmDlg('解锁「' + s.name + '」贴纸？', '花费 ' + s.cost + ' ◆ 心愿币，永久可用。', '解锁').then(ok => {
          if (!ok) return;
          if (ST.unlockSticker(id)) { st.sticker = id; toast('已解锁「' + s.name + '」', 'ok'); paintStickers(); if (window.APP) APP.refresh(); }
          else warn('心愿币不够');
        });
      });
    }
    function paintFonts() {
      el('cp-fonts').innerHTML = QUOTE_FONTS.map(f =>
        '<button class="qfb' + (st.font === f.id ? ' on' : '') + '" data-f="' + f.id + '" type="button">' + f.name + '</button>').join('');
      $$('#cp-fonts .qfb').forEach(b => b.onclick = () => {
        st.font = b.dataset.f;
        paintFonts(); paintPreview();
      });
    }
    function paintPreview() {
      const t = el('cp-text');
      if (!t) return;
      t.style.fontFamily = st.type === 'quote' ? fontOf(st.font) : '';
      t.style.fontSize = st.type === 'quote' ? '17px' : '';
    }
    paintColors(); paintStickers(); paintFonts();

    /* ── 梦想配图：选图 → 等比压缩成小 jpg → 预览 ── */
    function paintImg() {
      const box2 = el('cp-img-prev');
      if (!box2) return;
      box2.hidden = !st.img;
      if (st.img) $('img', box2).src = st.img;
      el('cp-img-pick').textContent = st.img ? '换一张图' : '＋ 选择图片';
      el('cp-img-tip').textContent = st.img ? '已选好，保存后钉在梦想便利贴上。' : '会自动压成适合便利贴的小图，只存在本机。';
    }
    el('cp-img-pick').onclick = () => el('cp-img-file').click();
    el('cp-img-x').onclick = e => { e.stopPropagation(); st.img = ''; el('cp-img-file').value = ''; paintImg(); };
    el('cp-img-file').onchange = async e => {
      const f = (e.target.files || [])[0];
      if (!f) return;
      const w = el('cp-img-warn');
      if (w) w.textContent = '';
      try {
        st.img = await shrinkImage(f);
        paintImg();
      } catch (_) {
        if (w) w.textContent = '这张图读不出来，换一张试试';
      }
      e.target.value = '';
    };
    paintImg();

    // 梦想便利贴固定为鎏金纸，选色对它无效，直接收起这一块
    function syncType() {
      el('cp-sec-color').hidden = (st.type === 'dream');
      el('cp-sec-img').hidden = (st.type !== 'dream');
      el('cp-sec-font').hidden = (st.type !== 'quote');
      $('.pix-input', box).placeholder = PLACE[st.type];
      paintPreview();
      $$('#cp-type button').forEach(x => x.classList.toggle('on', x.dataset.t === st.type));
    }
    $$('#cp-type button').forEach(b => b.onclick = () => { st.type = b.dataset.t; syncType(); });
    syncType();

    const close = () => { box.classList.remove('on'); setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, DUR(200)); };
    el('cp-cancel').onclick = close;
    $('.md-mask', box).onclick = close;
    el('cp-save').onclick = () => {
      const txt = el('cp-text').value.trim();
      if (!txt) { toast('还没写内容呢', 'warn'); el('cp-text').focus(); return; }
      if (editId) {
        const old = ST.noteById(editId);
        const moved = old && old.type !== st.type;
        ST.updateNote(editId, {
          text: txt, color: st.color, sticker: st.sticker, type: st.type,
          img: st.type === 'dream' ? (st.img || '') : '',
          font: st.type === 'quote' ? st.font : ''
        });
        if (moved && old.type === 'dream') { /* 类型变了，重新计算位置 */ }
        close(); render(); toast('已更新', 'ok');
      } else {
        const host = containerFor(st.type);
        const sz = sizeOf(st.type, { text: txt });
        let pos = pendingPos;
        if (!pos) pos = freeSpot(host, sz.w, sz.h);
        else {
          const cw = host.clientWidth, ch = host.clientHeight;
          pos = { x: clamp(pos.x - sz.w / 2, 4, Math.max(4, cw - sz.w - 4)), y: clamp(pos.y - sz.h / 2, 4, Math.max(4, ch - sz.h - 4)) };
        }
        ST.addNote({
          type: st.type, text: txt, color: st.color, sticker: st.sticker,
          x: pos.x, y: pos.y, img: st.type === 'dream' ? (st.img || '') : '',
          font: st.type === 'quote' ? st.font : ''
        });
        close(); render();
        toast('贴上了', 'ok', st.type === 'dream' ? '这是梦想，慢慢来'
          : st.type === 'quote' ? '这句话会一直在墙上陪着你' : '双击它就能标记完成');
        if (window.APP && APP.refresh) APP.refresh();
      }
    };
    requestAnimationFrame(() => { box.classList.add('on'); setTimeout(() => { const t = el('cp-text'); if (t) t.focus(); }, DUR(260)); });
  }

  /* ── 空白处：拖动平移 / 缩放 / 新贴一张 ── */
  function bindWallTap() {
    // 梦想区：拖动平移 / 滚轮缩放 / 点空白贴梦想
    const zone = el('w-dreamzone');
    let dpan = null, dMoved = false, dTarget = null;

    zone.addEventListener('pointerdown', e => {
      if (e.target.closest('.note') || e.target.closest('.dz-tools')) return;
      if (e.button !== undefined && e.button !== 0) return;
      dpan = { x: e.clientX, y: e.clientY, tx: dview.tx, ty: dview.ty };
      dMoved = false; dTarget = e.target;
      try { zone.setPointerCapture(e.pointerId); } catch (_) { }
    });

    zone.addEventListener('pointermove', e => {
      if (!dpan) return;
      const dx = e.clientX - dpan.x, dy = e.clientY - dpan.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) dMoved = true;
      if (!dMoved) return;
      dview.tx = dpan.tx + dx; dview.ty = dpan.ty + dy;
      applyDView();
    });

    zone.addEventListener('pointerup', e => {
      if (!dpan) return;
      const wasTap = !dMoved;
      dpan = null;
      if (!wasTap) return;
      const t = dTarget || e.target;
      if (t.closest('.note')) return;
      if (e.target.closest('.dz-empty') || t.closest('.dz-empty')) { openComposer({ type: 'dream' }); return; }
      const r = zone.getBoundingClientRect();
      openComposer({
        type: 'dream',
        pos: {
          x: (e.clientX - r.left - dview.tx) / dview.s,
          y: (e.clientY - r.top - dview.ty) / dview.s
        }
      });
    });
    zone.addEventListener('pointercancel', () => { dpan = null; dMoved = false; });

    zone.addEventListener('wheel', e => {
      if (e.target.closest('.dz-tools')) return;
      e.preventDefault();
      zoomDzAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    }, { passive: false });

    el('dz-zoom-in').onclick = () => zoomDzCenter(1.2);
    el('dz-zoom-out').onclick = () => zoomDzCenter(1 / 1.2);
    el('dz-zoom-reset').onclick = () => { dview = { s: 1, tx: 0, ty: 0 }; applyDView(); zoomDzUI(); };

    const wall = el('wall');
    const pointers = new Map();
    let pan0 = null, pinch0 = null, moved = false, tapPt = null;

    wall.addEventListener('pointerdown', e => {
      if (e.target.closest('.note') || e.target.closest('.wall-tools')) return;
      if (e.button !== undefined && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        pan0 = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
        moved = false; tapPt = { x: e.clientX, y: e.clientY };
      } else if (pointers.size === 2) {
        const p = Array.from(pointers.values());
        pinch0 = {
          d: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), s: view.s,
          mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2, tx: view.tx, ty: view.ty
        };
        moved = true;
      }
      try { wall.setPointerCapture(e.pointerId); } catch (_) { }
    });

    wall.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2 && pinch0) {
        const p = Array.from(pointers.values());
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        view.s = clamp(pinch0.s * (d / pinch0.d), VIEW_MIN, VIEW_MAX);
        view.tx = pinch0.tx + (mx - pinch0.mx);
        view.ty = pinch0.ty + (my - pinch0.my);
        applyView(); zoomUI();
        return;
      }
      if (!pan0) return;
      const dx = e.clientX - pan0.x, dy = e.clientY - pan0.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
      view.tx = pan0.tx + dx; view.ty = pan0.ty + dy;
      applyView();
    });

    const end = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      if (pointers.size > 0) return;
      const wasTap = !moved && tapPt;
      pan0 = null; moved = false;
      if (wasTap) {
        const r = wall.getBoundingClientRect();
        const lx = clamp((tapPt.x - r.left - view.tx) / view.s, 0, W0);
        const ly = clamp((tapPt.y - r.top - view.ty) / view.s, 0, H0);
        openComposer({ type: 'small', pos: { x: lx, y: ly } });
      }
      tapPt = null;
    };
    wall.addEventListener('pointerup', end);
    wall.addEventListener('pointercancel', e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      if (pointers.size === 0) { pan0 = null; moved = false; tapPt = null; }
    });

    wall.addEventListener('wheel', e => {
      if (e.target.closest('.wall-tools')) return;
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    }, { passive: false });

    el('w-zoom-in').onclick = () => zoomCenter(1.2);
    el('w-zoom-out').onclick = () => zoomCenter(1 / 1.2);
    el('w-zoom-reset').onclick = () => { view = { s: 1, tx: 0, ty: 0 }; applyView(); zoomUI(); };
    el('w-add').onclick = () => openComposer({ type: 'small' });
  }

  window.Wall = { render, openComposer, bindWallTap, cityName, layout, addPhoto };
})();
