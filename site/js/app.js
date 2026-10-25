/* ══════════════════════════════════════════════
   梦想地图 · 启动 / 引导 / 导航 / 云同步设置
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, fmt, sleep, toast, dialog, confirmDlg, burst, DUR } = U;

  let curTab = 'wall';
  let obStep = 0, obPick = 'm1', obGender = 'm';

  /* ══════ 顶部栏 ══════ */
  function motto() {
    const bio = (ST.S.profile.bio || '').trim();
    if (bio) return bio;
    const dreams = ST.notesOf('dream');
    const doneDreams = dreams.filter(n => n.status === 'done').length;
    const act = ST.activeNotes().filter(n => n.type !== 'photo' && n.type !== 'dream' && n.type !== 'quote').length;
    const quotes = ST.activeNotes().filter(n => n.type === 'quote').length;
    if (!ST.S.notes.length) return '地图摊开了，先写下第一个梦想';
    if (dreams.length && doneDreams === dreams.length) return '你已经兑现了写下的梦想';
    if (act === 0) return quotes ? '墙上留了 ' + quotes + ' 句激励语，再写一件想做的' : '墙上空了，贴一张新的吧';
    if (act === 1) return '就差 1 件，今天能清掉';
    if (act <= 3) return '墙上还有 ' + act + ' 件，很近';
    return '墙上还有 ' + act + ' 件在推进';
  }

  function renderHeader() {
    const S = ST.S;
    AV.paint(el('p-avatar'), S.profile.avatar || 'm1', 2);
    el('p-nick').textContent = S.profile.nickname || '旅人';
    el('p-motto').textContent = motto();
    el('p-coins').textContent = fmt(ST.coins());

    const dot = el('p-sync');
    const st = ST.syncState.st;
    dot.className = 'sync-dot ' + st;
    dot.title = st === 'ok' ? '已同步' + (S.sync.at ? '（' + U.timeCN(S.sync.at) + '）' : '')
      : st === 'syncing' ? '同步中…'
        : st === 'err' ? '同步失败：' + (ST.syncState.msg || '网络不可用')
          : '未配置云同步（点击设置）';
  }

  /* ══════ 视图 ══════ */
  function renderView(t) {
    try {
      if (t === 'wall') Wall.render();
      else if (t === 'gacha') Gacha.render();
      else if (t === 'map') Map3D.render();
      else if (t === 'codex') Codex.render();
      else if (t === 'shop') Shop.render();
      else if (t === 'stats') Stats.render();
    } catch (e) { console.warn('渲染失败：' + t, e); }
  }

  function refresh() {
    if (window.SFX) SFX.setVolume(ST.S.set.sfx);
    renderHeader();
    renderView(curTab);
    // 空墙上的小人
    const art = el('w-empty-art');
    if (art && !art.dataset.done) {
      AV.paint(art, ST.S.profile.avatar || 'm1', 3);
      art.dataset.done = '1';
    }
  }

  function tab(t) {
    curTab = t;
    $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + t));
    renderView(t);
    window.scrollTo({ top: 0, behavior: U.REDUCED ? 'auto' : 'smooth' });
  }

  /* ══════ 首次进入引导 ══════ */
  function paintObList() {
    const host = el('ob-alist');
    if (!host) return;
    host.innerHTML = AV.AVATARS.filter(a => a.g === obGender).map(a =>
      '<button class="ob-av' + (a.id === obPick ? ' on' : '') + '" data-id="' + a.id + '">' +
      '<span class="ob-avbox"></span>' +
      '<span class="ob-avn">' + esc(a.name) + '</span>' +
      '<span class="ob-avd">' + esc(a.desc) + '</span>' +
      '</button>').join('');
    $$('#ob-alist .ob-av').forEach(b => {
      AV.paint($('.ob-avbox', b), b.dataset.id, 3);
      b.onclick = () => {
        obPick = b.dataset.id;
        $$('#ob-alist .ob-av').forEach(x => x.classList.toggle('on', x.dataset.id === obPick));
        el('ob-picked-name').textContent = AV.byId(obPick).name;
      };
    });
    el('ob-picked-name').textContent = AV.byId(obPick).name;
  }

  function openOnboard() {
    obStep = 0; obPick = 'm1'; obGender = 'm';
    el('onboard').hidden = false;
    requestAnimationFrame(() => el('onboard').classList.add('on'));
    paintObList();
    showObStep(0);
  }

  function showObStep(i) {
    obStep = i;
    $$('#onboard .ob-step').forEach(s => s.classList.toggle('on', +s.dataset.step === i));
    $$('#onboard .ob-steps i').forEach((d, k) => d.classList.toggle('on', k <= i));
    el('ob-back').hidden = i === 0;
    el('ob-next').textContent = i === 2 ? '开始使用' : '继续';
    if (i === 0) setTimeout(() => { const n = el('ob-nick'); if (n && !n.value) n.focus(); }, DUR(300));
    if (i === 1) setTimeout(() => { const d = el('ob-dream'); if (d && !d.value && !U.REDUCED) d.focus(); }, DUR(300));
  }

  function nextOb() {
    if (obStep === 0) {
      const v = el('ob-nick').value.trim();
      if (!v) { toast('还没写昵称呢', 'warn', '随便取一个也行'); el('ob-nick').focus(); return; }
      ST.setProfile({ nickname: v });
      showObStep(1);
      return;
    }
    if (obStep === 1) {
      const v = el('ob-dream').value.trim();
      if (!v) { toast('梦想还空着', 'warn', '写一个你真正想要的'); el('ob-dream').focus(); return; }
      ST.setProfile({ dream: v });
      showObStep(2);
      return;
    }
    finishOb();
  }

  async function finishOb() {
    const dream = (el('ob-dream').value || '').trim();
    ST.setProfile({ nickname: el('ob-nick').value.trim() || '旅人', avatar: obPick, dream: dream });
    if (!ST.notesOf('dream').length) {
      ST.addNote({ type: 'dream', text: dream, color: 'gold', sticker: 'pin', x: 24, y: 16 });
    }
    el('onboard').classList.remove('on');
    await sleep(DUR(420));
    el('onboard').hidden = true;
    start();
    setTimeout(() => {
      const node = $('.note.t-dream');
      const c = U.centerOf(node);
      burst(c.x, c.y, { count: 34, dist: 200, colors: ['#ffd166', '#ffb020', '#fff3c4'] });
      toast('地图摊开了', 'ok', '点空白处贴一张便利贴，双击它就代表完成');
    }, DUR(600));
  }

  function bindOnboard() {
    el('ob-next').onclick = nextOb;
    el('ob-back').onclick = () => showObStep(Math.max(0, obStep - 1));
    el('ob-nick').addEventListener('keydown', e => { if (e.key === 'Enter') nextOb(); });
    $$('#onboard .gbtn').forEach(b => b.onclick = () => {
      obGender = b.dataset.g;
      $$('#onboard .gbtn').forEach(x => x.classList.toggle('on', x === b));
      const first = AV.AVATARS.filter(a => a.g === obGender)[0];
      if (first && AV.byId(obPick).g !== obGender) obPick = first.id;
      paintObList();
    });
    $$('#onboard .chip').forEach(b => b.onclick = () => { el('ob-dream').value = b.dataset.dream; });
  }

  /* ══════ 本机服务信息 ══════ */

  function copyText(text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
  }

  /* 从 /api/info 读取本机地址与密钥；只有本机访问才会返回，手机端自动隐藏 */
  function loadLocalInfo(m) {
    const box = $('#sy-local', m);
    if (!box || !window.fetch) return;

    fetch('/api/info', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(info => {
        if (!info || !info.key) return;

        const rows = [];
        (info.lan || []).forEach(u => rows.push(['局域网地址', u]));
        if (!rows.length) rows.push(['本机地址', info.local]);
        rows.push(['同步密钥', info.key]);
        const target = (info.lan && info.lan[0]) || info.local;

        box.innerHTML =
          '<div class="sy-local-h"><span>本机服务</span>' +
          '<button class="pix-btn ghost sm" data-x="fill">一键填入</button></div>' +
          rows.map(r =>
            '<div class="sy-local-r"><span class="k">' + esc(r[0]) + '</span>' +
            '<code class="v">' + esc(r[1]) + '</code>' +
            '<button class="pix-btn ghost sm" data-copy="' + esc(r[1]) + '">复制</button></div>'
          ).join('') +
          '<div class="sy-local-note">仅在本机打开时显示。手机连同一 Wi-Fi 时，填上面的局域网地址和密钥。</div>';
        box.hidden = false;

        $('[data-x="fill"]', box).onclick = () => {
          $('#sy-url', m).value = target;
          $('#sy-key', m).value = info.key;
          toast('已填入地址和密钥', 'ok');
        };
        $$('[data-copy]', box).forEach(b => {
          b.onclick = () => {
            copyText(b.dataset.copy);
            b.textContent = '已复制';
            setTimeout(() => { b.textContent = '复制'; }, 1200);
          };
        });
      })
      .catch(() => { /* 非本机环境不显示 */ });
  }

  /* ══════ 云同步设置 ══════ */
  function openSync() {
    const S = ST.S;
    const stTxt = {
      ok: '上次同步：' + (S.sync.at ? U.dateFullCN(S.sync.at) + ' ' + U.timeCN(S.sync.at) : '刚刚'),
      err: '上次同步失败：' + (ST.syncState.msg || '网络不可用'),
      syncing: '正在同步…',
      off: '还没有配置云同步'
    }[ST.syncState.st];

    dialog({
      title: '云同步',
      desc: '和自己的「梦想地图」服务端同步。手机和电脑填同一组地址和密钥，进度就会合到一起。',
      ok: '保存并同步',
      cancel: '取消',
      body:
        '<div class="sy-form">' +
        '<div id="sy-local" class="sy-local" hidden></div>' +
        '<label class="sy-l">服务地址</label>' +
        '<input id="sy-url" class="pix-input" placeholder="http://192.168.1.10:8090" value="' + esc(S.sync.url || '') + '">' +
        '<label class="sy-l">同步密钥</label>' +
        '<input id="sy-key" class="pix-input" placeholder="自己设一串，两台设备填一样" value="' + esc(S.sync.key || '') + '">' +
        '<div class="sy-st">' + esc(stTxt) + '</div>' +
        '<div class="sy-acts"><button class="pix-btn ghost sm" data-x="now">立即同步</button>' +
        '<button class="pix-btn ghost sm danger" data-x="wipe">清空本机所有数据</button></div>' +
        '<div class="sy-help">合并规则：便利贴按修改时间后写胜出，心愿币与收集进度只增不减，删掉的便利贴会留下记录以免被同步回来。' +
        '没配好也不影响使用，所有内容都存在本机。</div>' +
        '</div>',
      onMount: (m, close) => {
        loadLocalInfo(m);
        const save = async () => {
          ST.setSync($('#sy-url', m).value.trim(), $('#sy-key', m).value.trim());
          if (!ST.syncOn()) { toast('地址和密钥都要填', 'warn'); return false; }
          toast('正在同步…', 'ok');
          const ok = await ST.syncNow('manual');
          toast(ok ? '同步完成' : '同步失败', ok ? 'ok' : 'warn', ok ? '进度已合并' : (ST.syncState.msg || ''));
          return true;
        };
        // 覆盖默认的「确定」行为：先保存配置再关闭
        $('[data-a="o"]', m).onclick = async () => {
          const done = await save();
          close(!!done);
        };
        $('[data-x="now"]', m).onclick = async () => {
          const done = await save();
          close(true); if (done) refresh();
        };
        $('[data-x="wipe"]', m).onclick = () => {
          close(false);
          confirmDlg('清空本机所有数据？', '便利贴、心愿币、相册全部会回到初始状态，且无法恢复。服务端上已有的内容下次同步时还会回来。', '确定清空', true)
            .then(ok => { if (ok) { ST.wipe(); location.reload(); } });
        };
      }
    }).then(v => { if (v === true) { refresh(); renderView(curTab); } }).catch(() => { });
  }

  /* ══════ 个人资料 ══════ */
  function openProfile() {
    const S = ST.S;
    let pick = S.profile.avatar || 'm1';
    const GROUPS = [
      { g: 'm', label: '男生' }, { g: 'f', label: '女生' },
      { g: 'c', label: '猫' }, { g: 'd', label: '狗' }
    ];
    let grp = AV.byId(pick).g;
    const groupHTML = () => GROUPS.filter(x => AV.AVATARS.some(a => a.g === x.g)).map(x =>
      '<button class="pf-gb' + (x.g === grp ? ' on' : '') + '" data-g="' + x.g + '">' + x.label + '</button>').join('');
    const first = S.notes.reduce((m, n) => (!m || n.createdAt < m ? n.createdAt : m), '');
    const got = window.ACH ? ACH.gotCount() : 0;
    const all = window.ACH ? ACH.total : 0;

    dialog({
      wide: true, title: '个人资料', desc: '这些资料只留在本机，随时可以改。', ok: '保存',
      body:
        '<div class="pf-top">' +
        '<div class="pf-av" id="pf-av"></div>' +
        '<div class="pf-fields">' +
        '<label class="pf-l" for="pf-nick">昵称</label>' +
        '<input id="pf-nick" class="pix-input" maxlength="12" autocomplete="off" placeholder="旅人" value="' + esc(S.profile.nickname || '') + '">' +
        '<label class="pf-l" for="pf-bio">一句话宣言（留空则显示今日进度）</label>' +
        '<input id="pf-bio" class="pix-input" maxlength="24" autocomplete="off" placeholder="今天也走一小步" value="' + esc(S.profile.bio || '') + '">' +
        '</div></div>' +
        '<div class="pf-stats">' +
        '<div class="pf-st"><b>' + (first ? U.dateCN(first) : '—') + '</b><span>出发时间</span></div>' +
        '<div class="pf-st"><b>' + ST.totalOwned() + '</b><span>收藏照片</span></div>' +
        '<div class="pf-st"><b>' + ST.doneNotes().length + '</b><span>完成事件</span></div>' +
        '<div class="pf-st"><b>' + got + '/' + all + '</b><span>成就</span></div>' +
        '</div>' +
        '<label class="pf-l" for="pf-vol">音效音量</label>' +
        '<div class="pf-vol">' +
        '<button class="pf-mute" id="pf-mute" type="button" title="静音 / 恢复">静音</button>' +
        '<input id="pf-vol" type="range" min="0" max="100" step="5" value="' + Math.round((S.set.sfx != null ? S.set.sfx : 0.6) * 100) + '">' +
        '<span id="pf-vol-val">—</span>' +
        '<button class="pix-btn ghost sm" id="pf-try" type="button">试听</button>' +
        '</div>' +
        '<label class="pf-l">换形象</label>' +
        '<div class="pf-groups">' + groupHTML() + '</div>' +
        '<div class="pick-grid av pf-avs" id="pf-avs"></div>',
      onMount: (m, close) => {
        const paintPick = () => {
          AV.paint($('#pf-av', m), pick, 4);
          $$('.pick-cell', m).forEach(b => b.classList.toggle('on', b.dataset.id === pick));
        };
        const paintGroup = () => {
          const host = $('#pf-avs', m);
          host.innerHTML = AV.AVATARS.filter(a => a.g === grp).map(a =>
            '<button class="pick-cell" data-id="' + a.id + '"><span class="pc-box"></span><span class="pc-n">' + esc(a.name) + '</span></button>').join('');
          $$('.pick-cell', host).forEach(b => {
            AV.paint($('.pc-box', b), b.dataset.id, 2);
            b.onclick = () => { pick = b.dataset.id; paintPick(); };
          });
          paintPick();
        };
        $$('.pf-gb', m).forEach(b => b.onclick = () => {
          grp = b.dataset.g;
          $$('.pf-gb', m).forEach(x => x.classList.toggle('on', x === b));
          paintGroup();
        });
        paintGroup();

        // 音效音量
        const volEl = $('#pf-vol', m), valEl = $('#pf-vol-val', m), muteEl = $('#pf-mute', m);
        let lastVol = +volEl.value || 60;
        const paintVol = () => {
          const v = Math.max(0, Math.min(100, +volEl.value || 0));
          valEl.textContent = v + '%';
          muteEl.textContent = v === 0 ? '开启' : '静音';
          if (window.SFX) SFX.setVolume(v / 100);
        };
        volEl.oninput = paintVol;
        volEl.onchange = () => { if (window.SFX) SFX.play('card'); };
        muteEl.onclick = () => {
          if (+volEl.value > 0) { lastVol = +volEl.value; volEl.value = '0'; }
          else volEl.value = String(lastVol || 60);
          paintVol();
        };
        const tryBtn = $('#pf-try', m);
        if (tryBtn) tryBtn.onclick = () => { if (window.SFX) SFX.play('done'); };
        paintVol();

        const cancelBtn = $('[data-a="c"]', m);
        if (cancelBtn) cancelBtn.onclick = () => {
          if (window.SFX) SFX.setVolume(ST.S.set.sfx);
          close(false);
        };

        $('[data-a="o"]', m).onclick = () => {
          const nick = ($('#pf-nick', m).value || '').trim() || '旅人';
          const bio = ($('#pf-bio', m).value || '').trim();
          ST.setProfile({ nickname: nick, bio: bio, avatar: pick });
          ST.setSfx(Math.max(0, Math.min(100, +volEl.value || 0)) / 100);
          close(true);
        };
      }
    }).then(v => {
      if (v === true) { refresh(); toast('资料已更新', 'ok', '昵称、宣言和形象都记下了'); }
    });
  }

  /* ══════ 启动 ══════ */
  function start() {
    el('app').hidden = false;
    requestAnimationFrame(() => el('app').classList.add('on'));
    refresh();
    $$('#tabbar button').forEach(b => b.onclick = () => tab(b.dataset.tab));
    el('w-add').onclick = () => Wall.openComposer({ type: 'small' });
    Wall.bindWallTap();
    Gacha.bind();
    Codex.bind();
    el('g-draw').onclick = () => Gacha.drawRandom();
    el('p-sync').onclick = openSync;
    el('p-avatar').onclick = openProfile;

    // 全局「？说明」折叠
    document.addEventListener('click', e => {
      const q = e.target.closest('.qbtn');
      if (!q) return;
      const body = document.querySelector('[data-qbody="' + q.dataset.q + '"]');
      if (body) body.hidden = !body.hidden;
    });

    // 按钮轻点音效
    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (window.SFX) SFX.play('tap');
    });

    // 同步回调
    ST.on(() => refresh());
    ST.on(() => { /* 同步状态变化时刷新小圆点 */ });

    // 启动即拉一次远端
    if (ST.syncOn()) {
      setTimeout(() => ST.syncNow('boot').then(() => { refresh(); renderView(curTab); }), 600);
    } else {
      toast('还没有配置云同步', 'ok', '点右上角的云朵图标，填一次地址和密钥即可跨设备同步');
    }
  }

  function boot() {
    ST.load();
    const tips = ['正在摊开地图…', '正在冲洗底片…', '正在数你的心愿币…'];
    let i = 0;
    const t = setInterval(() => { const n = el('boot-tip'); if (n) n.textContent = tips[++i % tips.length]; }, 620);
    setTimeout(() => {
      clearInterval(t);
      const b = el('boot');
      b.classList.add('off');
      setTimeout(() => { b.hidden = true; }, 620);
      bindOnboard();
      if (ST.S.profile.nickname) start(); else openOnboard();
    }, U.REDUCED ? 200 : 1700);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) ST.pullThrottled(); });
  window.addEventListener('online', () => { if (ST.syncOn()) ST.syncNow('online'); });
  let rzT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (curTab === 'wall') Wall.render();
      if (curTab === 'map') { Map3D.fit(); Map3D.render(); }
    }, 200);
  });

  window.APP = { tab, refresh, renderView, get curTab() { return curTab; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
