/* ══════════════════════════════════════════════
   梦想地图 · 旅行星球（地图模块）
   纯自写 Canvas 三维地球：正交投影 + 本地生成的陆地掩膜，
   不引入任何外部库、不联网、不读外部贴图。
     · 拖动旋转 / 松手惯性 / 空闲自转
     · 地球上的亮点＝一处收集地，点击直达该地相册
   ══════════════════════════════════════════════ */
(function () {
  'use strict';
  const U = window.UI;
  const { $, $$, el, esc, clamp, burst, REDUCED } = U;

  const DEG = Math.PI / 180, RAD2DEG = 180 / Math.PI, HALFPI = Math.PI / 2;

  const CITIES = window.DM_CITIES || [];
  const CONT = { asia: '亚洲', europe: '欧洲', namerica: '北美洲', samerica: '南美洲', africa: '非洲', oceania: '大洋洲' };

  /* ── 各处收集地的经纬度 ── */
  const GEO = {
    beijing: [39.90, 116.40], shanghai: [31.23, 121.47], hongkong: [22.32, 114.17],
    hangzhou: [30.25, 120.17], tokyo: [35.68, 139.69], newyork: [40.71, -74.01],
    london: [51.51, -0.13], paris: [48.86, 2.35], srilanka: [7.87, 80.77], rome: [41.90, 12.50],
    kyoto: [35.01, 135.77], singapore: [1.35, 103.82], dali: [25.61, 100.27],
    chongqing: [29.56, 106.55], iceland: [64.15, -21.94], venice: [45.44, 12.32],
    amsterdam: [52.37, 4.90], barcelona: [41.39, 2.17], switzerland: [46.95, 7.45], sydney: [-33.87, 151.21]
  };

  /* ── 简化陆地轮廓（经纬度，[lat,lng]）——手绘近似，够看即可 ── */
  const LAND = [
    // 北美
    [[68, -166], [70, -152], [70, -140], [70, -125], [72, -110], [73, -95], [73, -80], [70, -68], [64, -65], [60, -64],
     [55, -60], [52, -56], [47, -52], [44, -63], [41, -70], [37, -75], [32, -79], [31, -81], [25, -81], [27, -83],
     [30, -86], [29, -91], [28, -96], [22, -97], [19, -96], [20, -105], [23, -110], [27, -113], [32, -117], [37, -122],
     [42, -124], [47, -124], [52, -127], [56, -134], [58, -141], [60, -148], [59, -153], [62, -166]],
    // 中美洲
    [[18, -94], [17, -90], [15, -88], [13, -87], [11, -85], [9, -80], [8, -78], [7, -80], [8, -83], [10, -85],
     [12, -87], [14, -91], [16, -96]],
    // 格陵兰
    [[83, -45], [83, -30], [81, -19], [76, -19], [70, -22], [66, -34], [60, -43], [60, -50], [65, -54], [70, -55],
     [76, -68], [80, -63]],
    // 南美
    [[12, -72], [11, -64], [8, -60], [7, -52], [4, -51], [0, -50], [-3, -42], [-8, -35], [-13, -39], [-18, -40],
     [-23, -42], [-25, -48], [-30, -51], [-35, -54], [-38, -58], [-41, -63], [-45, -66], [-50, -69], [-54, -68],
     [-55, -69], [-53, -72], [-48, -75], [-44, -74], [-40, -74], [-37, -73], [-33, -72], [-30, -71], [-24, -70],
     [-18, -70], [-14, -76], [-6, -81], [-3, -80], [-1, -80], [1, -79], [5, -77], [8, -77], [9, -76]],
    // 非洲
    [[37, -6], [37, 10], [33, 10], [31, 25], [31, 34], [24, 35], [22, 37], [15, 40], [11, 51], [5, 48],
     [-1, 42], [-11, 40], [-16, 39], [-22, 35], [-27, 33], [-34, 26], [-34, 18], [-29, 16], [-23, 14], [-17, 12],
     [-5, 9], [4, 9], [4, -8], [7, -13], [15, -17], [21, -17], [28, -13], [33, -8]],
    // 欧亚
    [[36, -9], [43, -9], [48, -5], [51, 2], [54, 8], [57, 8], [59, 11], [63, 8], [66, 12], [69, 18],
     [71, 26], [69, 33], [72, 42], [70, 52], [73, 60], [76, 72], [75, 90], [73, 105], [74, 120], [72, 135],
     [70, 142], [67, 152], [66, 162], [69, 172], [68, 180], [63, 180], [62, 168], [60, 160], [57, 156], [54, 150],
     [59, 143], [56, 137], [52, 140], [47, 139], [43, 133], [40, 128], [36, 127], [33, 124], [30, 122], [26, 120],
     [22, 114], [21, 109], [18, 107], [12, 109], [10, 106], [13, 100], [8, 98], [2, 103], [6, 100], [12, 95],
     [16, 94], [20, 93], [22, 88], [20, 85], [16, 82], [9, 79], [8, 77], [14, 74], [19, 73], [23, 68],
     [25, 62], [26, 57], [22, 60], [18, 57], [13, 44], [18, 42], [22, 39], [28, 35], [30, 33], [31, 34],
     [33, 35], [36, 36], [36, 31], [38, 27], [40, 26], [42, 29], [41, 29], [37, 23], [38, 22], [40, 19],
     [42, 19], [45, 14], [44, 10], [43, 7], [43, 3], [41, 3], [39, 0], [37, -2], [36, -6]],
    // 澳大利亚
    [[-11, 131], [-11, 136], [-12, 142], [-15, 146], [-18, 147], [-21, 149], [-25, 153], [-28, 154], [-32, 153],
     [-36, 150], [-38, 146], [-39, 144], [-37, 140], [-35, 137], [-34, 135], [-32, 133], [-33, 129], [-34, 124],
     [-33, 119], [-34, 116], [-32, 115], [-28, 114], [-24, 113], [-22, 114], [-19, 121], [-15, 124], [-14, 127],
     [-12, 130]],
    // 南极
    [[-90, -180], [-90, 180], [-64, 180], [-70, 140], [-66, 100], [-70, 60], [-68, 20], [-72, -20], [-70, -60],
     [-74, -100], [-72, -140], [-64, -180]],
    // 岛屿
    [[45, 141], [42, 144], [38, 141], [35, 140], [33, 135], [34, 132], [36, 133], [37, 137], [41, 140]],   // 日本
    [[33, 130], [33, 132], [31, 131], [31, 129]],                                                             // 九州
    [[45, 141], [43, 146], [42, 143], [44, 140]],                                                             // 北海道
    [[58, -5], [57, -2], [54, 0], [51, 1], [50, -5], [53, -4], [56, -6]],                                     // 不列颠
    [[55, -8], [54, -6], [52, -6], [51, -10], [54, -10]],                                                     // 爱尔兰
    [[66, -22], [66, -14], [64, -14], [63, -21], [65, -24]],                                                 // 冰岛
    [[1.45, 103.60], [1.47, 104.10], [1.15, 104.05], [1.18, 103.60]],                                         // 新加坡
    [[-12, 49], [-16, 50], [-22, 48], [-25, 45], [-22, 44], [-16, 44], [-12, 46]],                           // 马达加斯加
    [[9, 80], [7, 82], [6, 80], [8, 79]],                                                                     // 斯里兰卡
    [[5, 95], [4, 98], [1, 102], [-2, 104], [-6, 106], [-6, 102], [-3, 100], [1, 98]],                        // 苏门答腊
    [[-6, 105], [-6, 112], [-8, 114], [-8, 106]],                                                             // 爪哇
    [[7, 117], [7, 119], [4, 119], [0, 117], [-4, 115], [-3, 110], [1, 109], [4, 113]],                       // 婆罗洲
    [[1, 125], [0, 121], [-5, 120], [-5, 123], [0, 125]],                                                     // 苏拉威西
    [[-1, 131], [-2, 141], [-6, 147], [-9, 150], [-8, 141], [-9, 134], [-5, 133], [-2, 132]],                 // 新几内亚
    [[18, 121], [14, 122], [10, 124], [6, 126], [6, 122], [10, 122], [14, 120]],                              // 菲律宾
    [[23, -82], [21, -75], [20, -75], [23, -84]],                                                             // 古巴
    [[25, 121], [25, 122], [22, 121], [23, 120]],                                                             // 台湾
    [[-35, 174], [-37, 176], [-39, 178], [-41, 175], [-42, 173], [-38, 174], [-36, 173]],                     // 新西兰北
    [[-41, 174], [-44, 171], [-47, 168], [-46, 167], [-43, 171]]                                              // 新西兰南
  ];

  /* ══════ 陆地掩膜（等距圆柱投影，8px = 1°） ══════ */
  const MW = 2880, MH = 1440, MPX = 8, SHELF = 26;
  let mask = null, shal = null;

  /* ── 陆地低频起伏（世界固定，只生成一次）── */
  const terW = 360, terH = 180;
  let terr = null;
  function buildTerrain() {
    terr = new Float32Array(terW * terH);
    let seed = 20261020;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    [[12, 6, 0.45], [24, 12, 0.28], [48, 24, 0.17], [96, 48, 0.10]].forEach(o => {
      const gx = o[0], gy = o[1], w = o[2];
      const lat2 = new Float32Array((gx + 1) * (gy + 1));
      for (let i = 0; i < lat2.length; i++) lat2[i] = rnd();
      for (let y = 0; y < terH; y++) {
        const fy = y / terH * gy, y0 = Math.min(gy - 1, fy | 0), ty = fy - y0;
        const sy = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < terW; x++) {
          const fx = x / terW * gx, x0 = Math.min(gx - 1, fx | 0), tx = fx - x0;
          const sx = tx * tx * (3 - 2 * tx);
          const a = lat2[y0 * (gx + 1) + x0], b = lat2[y0 * (gx + 1) + x0 + 1];
          const c = lat2[(y0 + 1) * (gx + 1) + x0], d = lat2[(y0 + 1) * (gx + 1) + x0 + 1];
          const top = a + (b - a) * sx, bot = c + (d - c) * sx;
          terr[y * terW + x] += w * (top + (bot - top) * sy);
        }
      }
    });
  }
  function buildMask() {
    const c = document.createElement('canvas');
    c.width = MW; c.height = MH;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    const polys = (window.DM_LAND && window.DM_LAND.length) ? window.DM_LAND : LAND;
    polys.forEach(poly => {
      // land.data.js 是「一串数字」的紧凑格式，老的手绘数据是 [lat,lng] 数对
      const flat = typeof poly[0] === 'number';
      const n = flat ? poly.length / 2 : poly.length;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const lat = flat ? poly[i * 2] : poly[i][0];
        const lng = flat ? poly[i * 2 + 1] : poly[i][1];
        const x = (lng + 180) * MPX, y = (90 - lat) * MPX;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath(); g.fill();
    });
    // 轻微虚化，让海岸线是柔和过渡而不是硬台阶
    const c2 = document.createElement('canvas');
    c2.width = MW; c2.height = MH;
    const g2 = c2.getContext('2d');
    g2.filter = 'blur(0.7px)';
    g2.drawImage(c, 0, 0);
    g2.filter = 'none';
    const d = g2.getImageData(0, 0, MW, MH).data;
    mask = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) mask[i] = d[i * 4 + 3];

    // 近岸浅水：算出每个海面像素离陆地多远，渲染时由浅到深过渡
    const solid = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) solid[i] = mask[i] > 127 ? 1 : 0;
    const dist = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) dist[i] = solid[i] ? 0 : SHELF;
    for (let y = 1; y < MH; y++) {
      for (let x = 1; x < MW - 1; x++) {
        const i = y * MW + x;
        if (!dist[i]) continue;
        let v = dist[i - MW] + 1;
        v = Math.min(v, dist[i - MW - 1] + 1, dist[i - MW + 1] + 1, dist[i - 1] + 1);
        if (v < dist[i]) dist[i] = v;
      }
    }
    for (let y = MH - 2; y >= 0; y--) {
      for (let x = MW - 2; x > 0; x--) {
        const i = y * MW + x;
        if (!dist[i]) continue;
        let v = dist[i + MW] + 1;
        v = Math.min(v, dist[i + MW - 1] + 1, dist[i + MW + 1] + 1, dist[i + 1] + 1);
        if (v < dist[i]) dist[i] = v;
      }
    }
    shal = dist;
  }

  /* ══════ 渲染状态 ══════ */
  let cv, ctx, stage, scale = 1;
  let cx = 0, cy = 0, R = 0, Rbase = 0, RR = 0, D = 0;
  let zoom = 1;
  let buf = null, sphereCv = null, sctx = null;
  let viewLat = 14, viewLng = 100;          // 视角中心
  let velocity = 0, dragging = null, dragDist = 0;
  let hits = [], t0 = 0, running = false, raf = null;
  let stars = [];

  // 逐像素预算表（与旋转无关的部分，只在尺寸变化时算一次）
  let inC, vy1a, vz1a, ua, invUa, sgna, edgeU, sha, atma, aaa, spa, asinTab, atanTab;

  // 光照方向（视空间，左上打光）
  const LX = -0.42, LY = 0.50, LZ = 0.76;

  function buildTables() {
    const n = D * D;
    inC = new Uint8Array(n);
    edgeU = new Uint8Array(n);
    vy1a = new Float32Array(n);
    vz1a = new Float32Array(n);
    ua = new Float32Array(n);
    invUa = new Float32Array(n);
    sgna = new Int8Array(n);
    sha = new Float32Array(n);
    atma = new Float32Array(n);
    aaa = new Uint8Array(n);
    spa = new Float32Array(n);
    const off = (D - 1) / 2;
    let i = 0;
    for (let py = 0; py < D; py++) {
      const v = (py - off) / RR;
      for (let px = 0; px < D; px++, i++) {
        const u = (px - off) / RR;
        const rr = u * u + v * v;
        if (rr > 1.02) { inC[i] = 0; continue; }
        inC[i] = rr <= 1 ? 1 : 0;
        const vz1 = Math.sqrt(Math.max(0, 1 - rr));
        const vy1 = -v;
        vy1a[i] = vy1; vz1a[i] = vz1; ua[i] = u;
        const au = Math.abs(u);
        invUa[i] = au < 1e-6 ? 0 : 1 / au;
        sgna[i] = u < 0 ? -1 : 1;
        edgeU[i] = au < 1.6 / RR ? 1 : 0;
        const lam = clamp(u * LX + vy1 * LY + vz1 * LZ, 0, 1);
        const rim = Math.pow(rr, 7) * 0.85;
        let shf = 0.28 + 0.72 * lam;
        if (edgeU[i]) shf = 0.44 + 0.56 * lam;      // 侧边补光，免得整圈发黑
        sha[i] = shf;
        atma[i] = rim;
        spa[i] = Math.pow(lam, 26) * 58;              // 海面高光，让球体更立体
        aaa[i] = inC[i] ? clamp((1 - rr) * RR * 1.8, 0, 1) * 255 : 0;
      }
    }
    // asin → 掩膜行号（掩膜 8px = 1°），存成小数供插值
    asinTab = new Float32Array(2049);
    for (let k = 0; k <= 2048; k++) {
      const vy = k / 1024 - 1;
      asinTab[k] = clamp((90 - Math.asin(clamp(vy, -1, 1)) * RAD2DEG) * (MH / 180), 0, MH - 1);
    }
    // atan 表：r ∈ [0,64] 步长 1/16，用时线性插值，避免近球缘按整块台阶取经度
    atanTab = new Float32Array(1025);
    for (let k = 0; k <= 1024; k++) atanTab[k] = Math.atan(k / 16);

    buf = ctx.createImageData(D, D);
    if (!sphereCv || sphereCv.width !== D) {
      sphereCv = document.createElement('canvas');
      sphereCv.width = D; sphereCv.height = D;
      sctx = sphereCv.getContext('2d');
    }
  }

  /* 缩放：显示半径随时变，逐像素渲染半径封顶，避免放大后卡顿 */
  function applyZoom() {
    R = Rbase * zoom;
    const want = Math.max(64, Math.round(Math.min(R, 520) / 8) * 8);
    if (want !== RR) { RR = want; D = Math.ceil(2 * RR) + 2; buildTables(); }
  }

  function zoomUI() {
    const v = el('mp-zoom-val');
    if (v) v.textContent = Math.round(zoom * 100) + '%';
    const zi = el('mp-zoom-in'), zo = el('mp-zoom-out');
    if (zi) zi.disabled = zoom >= 2.6 - 0.01;
    if (zo) zo.disabled = zoom <= 1.001;
  }

  function setZoom(z) {
    const nz = clamp(z, 1, 2.6);
    if (Math.abs(nz - zoom) < 0.001) return;
    zoom = nz;
    applyZoom(); zoomUI();
  }

  function fit() {
    stage = el('mp-stage');
    if (!stage || !cv) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    // 页签还没显示时量不到尺寸，等它真正出现再重建，避免拿 0 尺寸把球画成一小块
    if (w < 60 || h < 60) return;
    scale = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    cx = cv.width / 2; cy = cv.height / 2;
    Rbase = Math.min(cv.width * 0.34, cv.height * 0.46);
    if (!mask) buildMask();
    if (!terr) buildTerrain();
    RR = 0; applyZoom();
    stars = [];
    let seed = 20261020;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 130; i++) {
      stars.push({ x: rnd() * cv.width, y: rnd() * cv.height, s: rnd() < .12 ? 2 : 1, d: rnd() * 3000 });
    }
  }

  /* ══════ 逐像素画出球面 ══════ */
  function paintSphere(t) {
    const a = viewLat * DEG, ca = Math.cos(a), sa = Math.sin(a);
    const d = buf.data, wrap = MW;
    const lngOff = viewLng + 180;
    const lastX = wrap - 1, lastY = MH - 1;
    for (let i = 0, j = 0; i < D * D; i++, j += 4) {
      if (!inC[i]) { d[j + 3] = 0; continue; }
      const vy = vy1a[i] * ca + vz1a[i] * sa;
      const vz = -vy1a[i] * sa + vz1a[i] * ca;

      // 纬度：查表后按小数插值，海岸不会被 8px 的行格子切成横条
      let kfy = (vy + 1) * 1024;
      if (kfy < 0) kfy = 0; else if (kfy > 2048) kfy = 2048;
      const ky0 = kfy | 0, ky1 = ky0 < 2048 ? ky0 + 1 : 2048;
      const rowF = asinTab[ky0] + (asinTab[ky1] - asinTab[ky0]) * (kfy - ky0);
      const iy = rowF | 0, ty = rowF - iy;
      const iy2 = iy < lastY ? iy + 1 : lastY;

      // 经度：atan 表线性插值；r 很大时用 atan(r) ≈ π/2 - 1/r
      let thDeg;
      if (edgeU[i]) {
        thDeg = Math.atan2(ua[i], vz) * RAD2DEG;
      } else {
        const r = vz * invUa[i];
        const kf = r * 16;
        let at;
        if (kf > 1024) at = HALFPI - 1 / r;
        else {
          const k0 = kf | 0, k1 = k0 < 1024 ? k0 + 1 : 1024;
          at = atanTab[k0] + (atanTab[k1] - atanTab[k0]) * (kf - k0);
        }
        thDeg = sgna[i] * (HALFPI - at) * RAD2DEG;
      }
      const fx = (thDeg + lngOff) * (MW / 360);
      const ffx = Math.floor(fx);
      let mx = ffx % wrap; if (mx < 0) mx += wrap;
      const tx = fx - ffx;
      const mx2 = mx < lastX ? mx + 1 : 0;

      // 掩膜双线性采样：海岸是柔和过渡，而不是 1/8° 的方块台阶
      const row0 = iy * wrap, row1 = iy2 * wrap;
      const c00 = mask[row0 + mx], c10 = mask[row0 + mx2];
      const c01 = mask[row1 + mx], c11 = mask[row1 + mx2];
      const b0 = c00 + (c10 - c00) * tx, b1 = c01 + (c11 - c01) * tx;
      const cov = (b0 + (b1 - b0) * ty) / 255;

      const s = sha[i];
      let r, g, b;
      if (cov < 0.99) {
        // 海水：越靠岸越浅，深海更沉；海面加一点高光
        const sh = shal[row0 + mx];
        const sw = sh >= SHELF ? 0 : (1 - sh / SHELF);
        r = 14 + 24 * sw; g = 38 + 56 * sw; b = 88 + 48 * sw;
        const sp = spa[i] * (1 - cov);
        r += sp; g += sp * 1.1; b += sp * 1.2;
      }
      if (cov > 0.01) {
        // 陆地：低频起伏 + 极冠，避免整块纯色
        const tXn = mx / wrap * terW, tX0 = tXn | 0;
        const tX1 = tX0 < terW - 1 ? tX0 + 1 : 0, ftx = tXn - tX0;
        const tYn = rowF / MH * terH, tY0 = tYn | 0;
        const tY1 = tY0 < terH - 1 ? tY0 + 1 : 0, fty = tYn - tY0;
        const t0 = tY0 * terW, t1 = tY1 * terW;
        const e0 = terr[t0 + tX0] + (terr[t0 + tX1] - terr[t0 + tX0]) * ftx;
        const e1 = terr[t1 + tX0] + (terr[t1 + tX1] - terr[t1 + tX0]) * ftx;
        const elv = e0 + (e1 - e0) * fty;
        const lum = 0.84 + elv * 0.36;
        const tint = 0.94 + elv * 0.14;
        let lr = 88 * lum, lg = 144 * lum, lb = 96 * lum * tint;
        // 极冠
        const ap = iy < MH / 2 ? iy : MH - iy;
        if (ap < 136) {
          const k = Math.min(1, (136 - ap) / 80);
          lr += (206 - lr) * k; lg += (224 - lg) * k; lb += (242 - lb) * k;
        }
        if (cov < 0.99) {
          r = r * (1 - cov) + lr * cov;
          g = g * (1 - cov) + lg * cov;
          b = b * (1 - cov) + lb * cov;
        } else { r = lr; g = lg; b = lb; }
      }
      r *= s; g *= s; b *= s;
      const at = atma[i];
      d[j] = r + (96 - r) * at;
      d[j + 1] = g + (176 - g) * at;
      d[j + 2] = b + (235 - b) * at;
      d[j + 3] = aaa[i];
    }
    // 先画到离屏，再按当前缩放贴回来：放大时逐像素分辨率封顶，仍然有细节
    sctx.putImageData(buf, 0, 0);
    const k2 = R / RR, dw = D * k2, dh = D * k2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sphereCv, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function project(lat, lng) {
    const a = viewLat * DEG, ca = Math.cos(a), sa = Math.sin(a);
    const phi = lat * DEG, th = (lng - viewLng) * DEG;
    const vx = Math.cos(phi) * Math.sin(th);
    const vy = Math.sin(phi);
    const vz = Math.cos(phi) * Math.cos(th);
    const vy1 = vy * ca - vz * sa;
    const vz1 = vy * sa + vz * ca;
    return { x: cx + R * vx, y: cy - R * vy1, z: vz1 };
  }

  /* ══════ 经纬网格 ══════ */
  function graticule() {
    ctx.lineWidth = Math.max(1, scale * 0.8);
    const lats = [-60, -30, 0, 30, 60];
    const lngs = [];
    for (let l = -180; l < 180; l += 30) lngs.push(l);
    ctx.strokeStyle = 'rgba(176,205,255,.15)';
    lngs.forEach(lng => {
      ctx.beginPath();
      let pen = false;
      for (let la = -90; la <= 90; la += 4) {
        const p = project(la, lng);
        if (p.z > 0.01) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; }
        else pen = false;
      }
      ctx.stroke();
    });
    lats.forEach(lat => {
      ctx.beginPath();
      ctx.strokeStyle = lat === 0 ? 'rgba(255,209,102,.22)' : 'rgba(176,205,255,.15)';
      let pen = false;
      for (let lng = -180; lng <= 180; lng += 4) {
        const p = project(lat, lng);
        if (p.z > 0.01) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; }
        else pen = false;
      }
      ctx.stroke();
    });
  }

  /* ══════ 城市亮点 ══════ */
  const FONT = 'Zpix, "Microsoft YaHei", sans-serif';
  function markers(t) {
    hits = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const list = CITIES.map(c => {
      const g = GEO[c.slug] || [0, 0];
      return { c, p: project(g[0], g[1]) };
    }).sort((A, B) => A.p.z - B.p.z);

    list.forEach(({ c, p }, idx) => {
      if (p.z <= 0.04) return;
      const got = ST.cityOwned(c.slug), full = got >= c.total;
      const fade = clamp((p.z - 0.04) / 0.3, 0, 1);
      const col = full ? '#2bb3a3' : got > 0 ? '#ffb020' : '#9aa3c8';
      const pulse = 0.5 + 0.5 * Math.sin(t / 500 + idx * 1.7);
      const rr = (5 + pulse * 3.2) * scale;
      ctx.globalAlpha = fade * (0.5 - pulse * 0.2);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, scale * 1.4);
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.fillStyle = col;
      const dot = Math.max(2, Math.round(2.6 * scale));
      ctx.fillRect(Math.round(p.x - dot), Math.round(p.y - dot), dot * 2, dot * 2);
      ctx.fillStyle = full ? '#eafff9' : '#fff8e2';
      ctx.fillRect(Math.round(p.x - scale), Math.round(p.y - scale), Math.max(1, Math.round(scale)), Math.max(1, Math.round(scale)));
      ctx.globalAlpha = 1;
      hits.push({ x: p.x, y: p.y, slug: c.slug, city: c.city });
    });

    // 标签单独一趟：由近到远排布，互相避让，放不下就只留亮点
    const boxes = [];
    const front = list.filter(o => o.p.z > 0.22).sort((A, B) => B.p.z - A.p.z);
    front.forEach(({ c, p }) => {
      const got = ST.cityOwned(c.slug), full = got >= c.total;
      const fade = clamp((p.z - 0.22) / 0.25, 0, 1);
      if (fade <= 0.02) return;
      const label = c.city + (got ? ' ' + got + '/' + c.total : '');
      ctx.font = '600 ' + Math.round(11 * scale) + 'px ' + FONT;
      const tw = ctx.measureText(label).width;
      const bw = tw + 8 * scale, bh = 16 * scale;
      // 候选位置：先上方，再下方，再右上、左上
      const cands = [
        [p.x, p.y - (14 * scale + Math.min(p.z, 1) * 4 * scale)],
        [p.x, p.y + (15 * scale)],
        [p.x + tw / 2 + 9 * scale, p.y],
        [p.x - tw / 2 - 9 * scale, p.y]
      ];
      let put = null;
      for (const q of cands) {
        const box = { x: q[0] - bw / 2, y: q[1] - bh / 2, w: bw, h: bh };
        const clash = boxes.some(b => !(box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y));
        if (!clash) { put = { q, box }; break; }
      }
      if (!put) return;
      boxes.push(put.box);
      const cxq = put.q[0], cyq = put.q[1];
      ctx.globalAlpha = fade * 0.78;
      ctx.fillStyle = '#0b1030';
      ctx.fillRect(Math.round(cxq - bw / 2), Math.round(cyq - bh / 2), Math.round(bw), Math.round(bh));
      ctx.globalAlpha = fade;
      ctx.fillStyle = full ? '#7ff0dd' : '#ffd166';
      ctx.fillText(label, cxq, cyq);
      ctx.globalAlpha = 1;
    });
  }

  /* ══════ 一帧 ══════ */
  function frame(now) {
    if (!running) return;
    const view = el('v-map');
    if (!view || !view.classList.contains('on') || !cv) { running = false; raf = null; return; }
    // 页签刚切过来 / 窗口改了大小时，重新量一次画布
    if (stage && stage.clientWidth > 60 && Math.abs(cv.width - stage.clientWidth * scale) > 2) fit();
    const t = now - t0;
    if (!dragging) {
      if (Math.abs(velocity) > 0.02) { viewLng += velocity; velocity *= 0.93; }
      else if (!REDUCED) viewLng += 0.055;
      viewLng = ((viewLng + 180) % 360 + 360) % 360 - 180;
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    // 星点
    stars.forEach(s => {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin((t + s.d) / 1600));
      ctx.globalAlpha = tw * 0.5;
      ctx.fillStyle = '#dce6ff';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    });
    ctx.globalAlpha = 1;

    paintSphere(t);

    // 大气辉光：只在球体边缘外一圈，别把整颗球的颜色冲淡
    const gr = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.26);
    gr.addColorStop(0, 'rgba(120,190,255,0)');
    gr.addColorStop(.34, 'rgba(120,190,255,.26)');
    gr.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.26, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    graticule();
    markers(t);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true; t0 = performance.now(); velocity = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  /* ══════ 进入城市相册 ══════ */
  function enterCity(slug) {
    const city = CITIES.find(c => c.slug === slug);
    if (window.APP && APP.tab) APP.tab('codex');
    if (window.Codex) Codex.goto(slug);
    if (city) U.toast('已翻到「' + city.city + '」的旅行相册', 'ok', '双击照片可以看介绍');
  }

  function nearestHit(px, py) {
    let best = null, bd = 26 * scale;
    hits.forEach(h => {
      const d = Math.hypot(h.x - px, h.y - py);
      if (d < bd) { bd = d; best = h; }
    });
    return best;
  }

  /* ══════ 交互 ══════ */
  function bindPointer() {
    if (!cv || cv.dataset.bound) return;
    cv.dataset.bound = '1';
    const ptrs = new Map();
    let pinch = null;

    cv.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        dragging = { x: e.clientX, y: e.clientY };
        dragDist = 0; velocity = 0; pinch = null;
      } else if (ptrs.size === 2) {
        const p = Array.from(ptrs.values());
        pinch = { d: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), z: zoom };
        dragging = null; dragDist = 99;
      }
      try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    });

    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size >= 2 && pinch) {
        const p = Array.from(ptrs.values());
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        setZoom(pinch.z * (d / pinch.d));
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      dragDist += Math.abs(dx) + Math.abs(dy);
      viewLng -= dx * 0.30;
      viewLat = clamp(viewLat + dy * 0.30, -80, 80);
      velocity = -dx * 0.30;
      dragging = { x: e.clientX, y: e.clientY };
    });

    const up = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (!dragging) return;
      const wasDrag = dragDist > 6;
      dragging = null;
      if (wasDrag || e.type === 'pointercancel') return;
      const r = cv.getBoundingClientRect();
      const px = (e.clientX - r.left) * scale, py = (e.clientY - r.top) * scale;
      const hit = nearestHit(px, py);
      if (hit) {
        burst(hit.x / scale, hit.y / scale, { count: 20, dist: 110 });
        enterCity(hit.slug);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    cv.addEventListener('wheel', e => {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });

    const zi = el('mp-zoom-in'), zo = el('mp-zoom-out'), zr = el('mp-zoom-reset');
    if (zi) zi.onclick = () => setZoom(zoom * 1.25);
    if (zo) zo.onclick = () => setZoom(zoom / 1.25);
    if (zr) zr.onclick = () => setZoom(1);
  }

  /* ══════ 侧栏 ══════ */
  function renderSide() {
    const lit = CITIES.filter(c => ST.cityOwned(c.slug) > 0).length;
    const owned = ST.totalOwned(), total = (window.DM_CARDS || []).length;
    const full = CITIES.filter(c => ST.cityOwned(c.slug) >= c.total).length;
    const sub = el('mp-sub');
    if (sub) sub.innerHTML = '已点亮 <b>' + lit + '</b> / ' + CITIES.length + ' 个地区 · 集齐 <b>' + full +
      '</b> 处 · 共收集 <b>' + owned + '</b> / ' + total + ' 张';

    const lg = el('mp-legend');
    if (lg) lg.innerHTML = '<span><i style="color:#9aa3c8;font-style:normal">□</i>未开始</span>' +
      '<span><i style="color:#ffb020;font-style:normal">■</i>收集中</span>' +
      '<span><i style="color:#2bb3a3;font-style:normal">■</i>已集齐</span>';

    const grid = el('mp-grid');
    if (grid) {
      const order = Object.keys(CONT).filter(k => CITIES.some(c => c.cont === k));
      grid.innerHTML = order.map(k => {
        const list = CITIES.filter(c => c.cont === k);
        const fullN = list.filter(c => ST.cityOwned(c.slug) >= c.total).length;
        return '<div class="mp-cont">' + esc(CONT[k]) + '<i>' + fullN + ' / ' + list.length + '</i></div>' +
          list.map(c => {
            const got = ST.cityOwned(c.slug);
            const done = got >= c.total;
            return '<button class="mp-cell' + (done ? ' done' : '') + '" data-slug="' + c.slug + '">' +
              '<span class="mc-n">' + (done ? '<span class="mp-star">★</span> ' : '') + esc(c.city) +
              (c.kind === 'country' ? '<i class="mc-tag">国</i>' : '') + '</span>' +
              '<span class="mc-p">' + got + ' / ' + c.total + '</span>' +
              '</button>';
          }).join('');
      }).join('');
      $$('#mp-grid .mp-cell').forEach(b => b.onclick = () => enterCity(b.dataset.slug));
    }
  }

  /* ══════ 对外 ══════ */
  function render() {
    if (!cv) { cv = el('mp-canvas'); if (!cv) return; ctx = cv.getContext('2d'); }
    if (!ctx) ctx = cv.getContext('2d');
    if (!stage) fit();
    else if (stage.clientWidth > 60 && Math.abs(cv.width - stage.clientWidth * scale) > 2) fit();
    bindPointer();
    zoomUI();
    renderSide();
    start();
  }

  window.Map3D = { render, fit, stop, enterCity, get view() { return { lat: viewLat, lng: viewLng }; } };
})();
