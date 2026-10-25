/* ══════════════════════════════════════════════
   梦想地图 · 通用工具层
   DOM 助手 / 提示条 / 对话框 / 粒子特效 / 文案库
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const el = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[randInt(0, arr.length - 1)];

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = ms => (REDUCED ? Math.min(ms, 60) : ms);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function nowISO() { return new Date().toISOString(); }

  function uid(prefix) {
    return (prefix || 'n') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function dateKey(d) {
    const t = d ? new Date(d) : new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function dayStart(d) {
    const t = d ? new Date(d) : new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }
  function dayDiff(a, b) {
    return Math.round((dayStart(a) - dayStart(b)) / 86400000);
  }
  function dateCN(iso) {
    const d = new Date(iso);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function dateFullCN(iso) {
    const d = new Date(iso);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function timeCN(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ── 提示条 ── */
  function toast(msg, kind, sub) {
    const box = el('toasts');
    if (!box) return;
    const n = document.createElement('div');
    n.className = 'toast' + (kind ? ' ' + kind : '');
    n.innerHTML = '<div class="t-main">' + esc(msg) + '</div>' + (sub ? '<div class="t-sub">' + esc(sub) + '</div>' : '');
    box.appendChild(n);
    requestAnimationFrame(() => n.classList.add('on'));
    setTimeout(() => {
      n.classList.remove('on');
      setTimeout(() => n.remove(), DUR(320));
    }, REDUCED ? 2200 : 3200);
  }

  /* ── 通用对话框 ── */
  // opts: {title, desc, body, ok:'确定', cancel:'取消'|null, danger}
  let dlgSeq = 0;
  function dialog(opts) {
    return new Promise(resolve => {
      const m = el('modal');
      const mine = ++dlgSeq;
      m.dataset.dlg = String(mine);
      m.hidden = false;
      m.innerHTML =
        '<div class="md-mask"></div>' +
        '<div class="md-box' + (opts.wide ? ' wide' : '') + '">' +
        '<div class="md-title">' + esc(opts.title || '') + '</div>' +
        (opts.desc ? '<div class="md-desc">' + esc(opts.desc) + '</div>' : '') +
        (opts.body || '') +
        '<div class="md-actions">' +
        (opts.cancel === null ? '' : '<button class="pix-btn ghost" data-a="c">' + esc(opts.cancel || '取消') + '</button>') +
        '<button class="pix-btn' + (opts.danger ? ' danger' : '') + '" data-a="o">' + esc(opts.ok || '确定') + '</button>' +
        '</div></div>';

      const close = v => {
        m.classList.remove('on');
        setTimeout(() => {
          // 已经被下一个对话框接管时，别把它的内容一起清掉
          if (m.dataset.dlg !== String(mine)) return;
          m.hidden = true; m.innerHTML = '';
        }, DUR(200));
        resolve(v);
      };
      requestAnimationFrame(() => m.classList.add('on'));
      $('[data-a="o"]', m).onclick = () => close(opts.value !== undefined ? opts.value : true);
      const c = $('[data-a="c"]', m);
      if (c) c.onclick = () => close(false);
      $('.md-mask', m).onclick = () => { if (opts.cancel !== null) close(false); };
      if (opts.onMount) opts.onMount(m, close);
    });
  }
  const confirmDlg = (title, desc, ok, danger) =>
    dialog({ title, desc, ok: ok || '确定', danger }).then(v => v === true);

  /* ── 粒子爆发（Web Animations，自动清理） ── */
  function burst(x, y, o) {
    if (REDUCED) return;
    o = o || {};
    const host = el('fx');
    const n = o.count || 26;
    const colors = o.colors || ['#ffd166', '#ff9f4a', '#ffe9b0', '#7fd8f5', '#ff7a8a'];
    const dist = o.dist || 150;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'pt' + (o.square ? ' sq' : '');
      const size = randInt(4, o.max || 9);
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;background:' +
        colors[i % colors.length] + ';box-shadow:0 0 6px ' + colors[i % colors.length];
      host.appendChild(s);
      const ang = rand(0, Math.PI * 2), d = rand(dist * 0.35, dist);
      s.animate([
        { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + Math.cos(ang) * d + 'px),calc(-50% + ' + (Math.sin(ang) * d - 40) + 'px)) scale(.25) rotate(' + randInt(-220, 220) + 'deg)', opacity: 0 }
      ], { duration: randInt(650, 1200), easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = function () { s.remove(); };
      if (i > 60) break;
    }
  }

  /* ── 飘字 ── */
  function floatText(x, y, text, cls) {
    const host = el('fx');
    const n = document.createElement('div');
    n.className = 'float-txt ' + (cls || '');
    n.textContent = text;
    n.style.left = x + 'px';
    n.style.top = y + 'px';
    host.appendChild(n);
    n.animate([
      { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-26px) scale(1.12)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-72px) scale(1)', opacity: 0 }
    ], { duration: DUR(1500), easing: 'ease-out' }).onfinish = function () { n.remove(); };
  }

  /* ── 元素中心坐标（视口坐标） ── */
  function centerOf(node) {
    if (!node) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ── 璀璨特效（完成梦想时） ── */
  function grandFx(title, lines) {
    const host = el('fx');
    const w = document.createElement('div');
    w.className = 'grand' + (REDUCED ? ' plain' : '');
    let rays = '';
    for (let i = 0; i < 24; i++) {
      rays += '<i style="transform:rotate(' + (i * 15) + 'deg) translateY(-' + randInt(90, 130) + '%) scaleY(' + rand(0.7, 1.25).toFixed(2) + ')"></i>';
    }
    let stars = '';
    for (let i = 0; i < 90; i++) {
      stars += '<b style="left:' + rand(0, 100).toFixed(2) + '%;top:' + rand(0, 100).toFixed(2) + '%;animation-delay:' + rand(0, 900).toFixed(0) + 'ms;--d:' + rand(1400, 2900).toFixed(0) + 'ms"></b>';
    }
    w.innerHTML =
      '<div class="gr-sky"></div><div class="gr-stars">' + stars + '</div>' +
      '<div class="gr-ring"></div><div class="gr-rays">' + rays + '</div>' +
      '<div class="gr-core"></div>' +
      '<div class="gr-txt"><div class="gr-t">' + esc(title) + '</div>' +
      lines.map((s, i) => '<div class="gr-l" style="animation-delay:' + (500 + i * 420) + 'ms">' + esc(s) + '</div>').join('') +
      '</div>';
    host.appendChild(w);
    requestAnimationFrame(() => w.classList.add('on'));
    return new Promise(res => {
      setTimeout(() => {
        w.classList.remove('on');
        setTimeout(() => { w.remove(); res(); }, DUR(700));
      }, REDUCED ? 2600 : 6200);
    });
  }

  /* ── 文案库（朋友口吻） ── */
  const CHEER = {
    small: [
      '搞定！这种小事都不放过，你是真的狠。',
      '又清掉一件。别小看它，日子就是这么攒起来的。',
      '打勾了，舒服吧？继续。',
      '看见没，你说你会做，你真的做了。',
      '这一下很轻，但落在正确的位置上。',
      '喝水、早睡、走两步——你在偷偷变强。',
      '小事不拖，大事才追得上你。'
    ],
    goal: [
      '这个可不简单，你居然真扛下来了。',
      '这么难的都啃下来了，那些小事还算什么。',
      '攒出来的不是成绩，是底气。',
      '别人的计划停在第二天，你走到了这里。',
      '我服。真的。',
      '你比昨天那个自己，强了一整档。'
    ],
    dream: [
      '你做到了。不是运气，是你一步一步走过来的。',
      '从第一张小便利贴到今天，每一步都算数。',
      '这不是终点，是你终于配得上的那个自己。'
    ]
  };
  const cheer = type => pick(CHEER[type] || CHEER.small);

  /* ── 便利贴配色（免费的 6 种 + 商店解锁） ── */
  const COLORS = [
    { id: 'sun', name: '柠黄', bg: '#ffe066', ink: '#4a3a10', free: true },
    { id: 'mint', name: '薄荷', bg: '#9fe8c8', ink: '#12402f', free: true },
    { id: 'sky', name: '天蓝', bg: '#a9d8f7', ink: '#103250', free: true },
    { id: 'rose', name: '杏粉', bg: '#ffc2c7', ink: '#52212a', free: true },
    { id: 'lilac', name: '烟紫', bg: '#cfc2f0', ink: '#312550', free: true },
    { id: 'sand', name: '米白', bg: '#f4ece0', ink: '#3d3629', free: true },
    { id: 'coral', name: '珊瑚', bg: '#ff9f7f', ink: '#4a1e0d', cost: 120 },
    { id: 'forest', name: '松绿', bg: '#7fc79b', ink: '#0f3320', cost: 160 },
    { id: 'denim', name: '牛仔', bg: '#7fa4d8', ink: '#132441', cost: 200 },
    { id: 'plum', name: '深梅', bg: '#c98bb8', ink: '#43102f', cost: 240 },
    { id: 'gold', name: '鎏金', bg: '#f0cf7a', ink: '#4a3308', cost: 320 },
    { id: 'night', name: '夜航', bg: '#4a5578', ink: '#eef1ff', cost: 400 }
  ];
  const STICKERS = [
    { id: 'none', name: '无', cost: 0, free: true, mark: '' },
    { id: 'pin', name: '圆图钉', cost: 0, free: true, mark: 'pin' },
    { id: 'tape', name: '纸胶带', cost: 0, free: true, mark: 'tape' },
    { id: 'star', name: '星星贴', cost: 100, mark: 'star' },
    { id: 'camera', name: '相机贴', cost: 140, mark: 'camera' },
    { id: 'plane', name: '纸飞机', cost: 180, mark: 'plane' },
    { id: 'heart', name: '小爱心', cost: 220, mark: 'heart' },
    { id: 'leaf', name: '四叶草', cost: 260, mark: 'leaf' }
  ];
  const colorOf = id => COLORS.find(c => c.id === id) || COLORS[0];
  const stickerOf = id => STICKERS.find(s => s.id === id) || STICKERS[1];

  window.UI = {
    $, $$, el, sleep, clamp, rand, randInt, pick, esc, fmt, nowISO, uid,
    dateKey, dayStart, dayDiff, dateCN, dateFullCN, timeCN,
    toast, dialog, confirmDlg, burst, floatText, centerOf, grandFx,
    cheer, CHEER, COLORS, STICKERS, colorOf, stickerOf,
    REDUCED, DUR
  };
})();
