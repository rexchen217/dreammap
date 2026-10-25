/* ══════════════════════════════════════════════
   梦想地图 · 像素形象
   10 位旅行者（男 5 / 女 5）+ 5 只猫 + 5 只狗，每位都有独立的样子。
   画布逻辑尺寸 20×26（四周留 1px 给描边），展示时用 image-rendering:pixelated 放大。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const SPR_W = 20, SPR_H = 26, PAD = 1;
  const OL = '#171521';           // 统一描边色
  const EYE = '#2b2620';
  const WHITE = '#fffdf6';

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(c, k) {
    const [r, g, b] = hexToRgb(c);
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  /* ── 形象定义 ── */
  const AVATARS = [
    { id: 'm1', name: '阿岸', g: 'm', skin: '#f3c9a3', hair: '#2b2620', hs: 'short', outfit: '#3d6fa8', outfit2: '#2a4f7d', pants: '#3a4763', acc: 'camera', desc: '挂着相机，走哪儿拍到哪儿。' },
    { id: 'm2', name: '小野', g: 'm', skin: '#e8b184', hair: '#5b3a1e', hs: 'spiky', outfit: '#e07a45', outfit2: '#b85b2c', pants: '#4a4038', acc: 'backpack', desc: '背一只旧帆布包，说走就走。' },
    { id: 'm3', name: '陆行', g: 'm', skin: '#cf8f61', hair: '#2b2620', hs: 'cap', outfit: '#2f9e8f', outfit2: '#1f7a6d', pants: '#3a3f4a', acc: 'glasses', desc: '帽檐压低，路线早排好了。' },
    { id: 'm4', name: '阿海', g: 'm', skin: '#e8b184', hair: '#3a4a6b', hs: 'pony', outfit: '#e8c46c', outfit2: '#c2a24e', pants: '#4a5578', acc: 'uke', desc: '走到哪儿都带着琴。' },
    { id: 'm5', name: '老周', g: 'm', skin: '#a9703f', hair: '#d9d3c8', hs: 'beard', outfit: '#6b4f34', outfit2: '#4c3823', pants: '#3d3428', acc: 'hat', desc: '走得慢，但从不掉队。' },
    { id: 'f1', name: '柠', g: 'f', skin: '#f3c9a3', hair: '#8a5a2b', hs: 'twintail', outfit: '#f4b6bd', outfit2: '#d4909a', pants: '#5a4664', acc: 'camera', desc: '双马尾＋小相机，记账也记风景。' },
    { id: 'f2', name: '茉', g: 'f', skin: '#e8b184', hair: '#2b2620', hs: 'long', outfit: '#cfc2f0', outfit2: '#a294c9', pants: '#4a4060', acc: 'flower', desc: '长发别一朵花，走得比谁都稳。' },
    { id: 'f3', name: '西柚', g: 'f', skin: '#f3c9a3', hair: '#e07a45', hs: 'bob', outfit: '#9fe0c2', outfit2: '#77bfa0', pants: '#3f5a52', acc: 'phones', desc: '一路戴着耳机，有自己的节奏。' },
    { id: 'f4', name: '小满', g: 'f', skin: '#cf8f61', hair: '#2b2620', hs: 'bun', outfit: '#a9d8f7', outfit2: '#82b3d2', pants: '#38495e', acc: 'backpack', desc: '丸子头＋小背包，什么都装得下。' },
    { id: 'f5', name: '阿岚', g: 'f', skin: '#e8b184', hair: '#3a4a6b', hs: 'hood', outfit: '#7fa4d8', outfit2: '#5a7cae', pants: '#2f3a4e', acc: 'map', desc: '兜帽一拉，手里攥着地图。' },

    /* ── 猫 5 只 ── */
    { id: 'c1', name: '阿橘', g: 'c', kind: 'pet', fur: '#e0913f', fur2: '#f6d3a6', extra: '#b96b28', ear: 'pointy', tail: 'striped', mark: 'stripe', acc: 'scarf', collar: '#3d6fa8', desc: '橘色虎斑，尾巴像一串糖葫芦。' },
    { id: 'c2', name: '墨墨', g: 'c', kind: 'pet', fur: '#3b3a45', fur2: '#6a6878', extra: '#2b2a33', ear: 'pointy', tail: 'up', mark: 'none', acc: 'bell', collar: '#2f9e8f', eye: '#ffd166', desc: '黑猫，夜里走路没有声音。' },
    { id: 'c3', name: '奶盖', g: 'c', kind: 'pet', fur: '#f3e6cf', fur2: '#fffaf0', extra: '#d9c3a3', ear: 'pointy', tail: 'curl', mark: 'none', acc: 'bow', collar: '#f4b6bd', desc: '奶白色，头顶一只粉蝴蝶结。' },
    { id: 'c4', name: '三花', g: 'c', kind: 'pet', fur: '#f5ede0', fur2: '#fffaf2', extra: '#d98a4a', extra2: '#4a4550', ear: 'fold', tail: 'curl', mark: 'patch', acc: 'scarf', collar: '#cfc2f0', desc: '三花猫，脸上像落了两片秋叶。' },
    { id: 'c5', name: '灰灰', g: 'c', kind: 'pet', fur: '#9aa0ab', fur2: '#c9ced8', extra: '#7a808c', ear: 'fold', tail: 'up', mark: 'none', acc: 'bell', collar: '#e07a45', desc: '折耳灰猫，脖子上的铃铛很轻。' },

    /* ── 狗 5 只 ── */
    { id: 'd1', name: '豆豆', g: 'd', kind: 'pet', fur: '#d9a566', fur2: '#f6e6c8', extra: '#c08c4f', ear: 'pointy', tail: 'up', mark: 'none', acc: 'scarf', collar: '#c0392b', desc: '柴犬豆豆，笑起来眼睛弯弯。' },
    { id: 'd2', name: '阿黄', g: 'd', kind: 'pet', fur: '#e3b552', fur2: '#faeecb', extra: '#c99a3f', ear: 'flop', tail: 'up', mark: 'none', acc: 'scarf', collar: '#3d6fa8', desc: '金毛阿黄，见谁都摇尾巴。' },
    { id: 'd3', name: '黑豆', g: 'd', kind: 'pet', fur: '#4a4650', fur2: '#f1ede2', extra: '#33303a', ear: 'flop', tail: 'striped', mark: 'patch', acc: 'bell', collar: '#2f9e8f', desc: '黑白花的小狗，胸口一片雪。' },
    { id: 'd4', name: '雪球', g: 'd', kind: 'pet', fur: '#f2efe4', fur2: '#fffdf6', extra: '#e0dccf', ear: 'pointy', tail: 'curl', mark: 'none', acc: 'bow', collar: '#f4b6bd', desc: '萨摩耶雪球，毛比雪还白。' },
    { id: 'd5', name: '咖啡', g: 'd', kind: 'pet', fur: '#8a6242', fur2: '#c9a57a', extra: '#6b4a30', ear: 'flop', tail: 'striped', mark: 'none', acc: 'bell', collar: '#e8c46c', desc: '巧克力色，走得慢，鼻子最灵。' }
  ];
  const byId = id => AVATARS.find(a => a.id === id) || AVATARS[0];

  /* ── 绘制原语 ── */
  function makePainter(ctx) {
    return function px(x, y, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x + PAD, y + PAD, w, h);
    };
  }

  /* ══════ 身体：腿 / 鞋 / 外套 / 手臂 / 腰带 ══════ */
  function drawBody(px, a) {
    const o1 = a.outfit, o2 = a.outfit2, pn = a.pants, sk = a.skin;
    const oHi = shade(o1, 1.14), oDk = shade(o1, .84), pDk = shade(pn, .78);

    // 腿
    px(5, 18, 3, 5, pn); px(10, 18, 3, 5, pn);
    px(5, 18, 1, 5, pDk); px(10, 18, 1, 5, pDk);          // 裤缝阴影
    // 鞋
    px(4, 22, 4, 2, '#3a3630'); px(10, 22, 4, 2, '#3a3630');
    px(4, 22, 4, 1, '#575046'); px(10, 22, 4, 1, '#575046');
    px(4, 23, 4, 1, '#242220'); px(10, 23, 4, 1, '#242220');

    // 上衣
    px(3, 11, 12, 6, o1);
    px(3, 11, 12, 1, oHi);                                 // 肩线高光
    px(3, 15, 12, 2, o2);                                  // 下摆
    px(7, 11, 4, 1, shade(o1, .62));                       // 领口
    px(6, 11, 1, 2, shade(o1, .74)); px(11, 11, 1, 2, shade(o1, .74));  // 翻领
    px(8, 12, 2, 4, oDk);                                  // 开襟
    px(4, 13, 2, 1, oHi); px(12, 13, 2, 1, oHi);           // 口袋

    // 手臂（袖子 + 袖口 + 手）
    px(1, 12, 2, 5, o1); px(15, 12, 2, 5, o1);
    px(1, 12, 2, 1, oHi); px(15, 12, 2, 1, oHi);
    px(1, 16, 2, 1, o2); px(15, 16, 2, 1, o2);
    px(1, 17, 2, 1, sk); px(15, 17, 2, 1, sk);

    // 腰带
    px(3, 17, 12, 1, pDk);
    px(8, 17, 2, 1, '#d0a52c');
  }

  /* ══════ 头部：脸 / 耳 / 眼 / 腮红 / 嘴 ══════ */
  function drawHead(px, a) {
    const s = a.skin, sDk = shade(s, .86);
    px(6, 0, 8, 1, s);
    px(5, 1, 10, 1, s);
    px(4, 2, 10, 6, s);
    px(5, 8, 8, 1, s);
    px(6, 9, 6, 1, shade(s, .97));                         // 下巴
    px(7, 10, 4, 1, shade(s, .8));                         // 脖子

    // 耳朵
    px(3, 4, 1, 2, sDk); px(14, 4, 1, 2, sDk);

    // 眼睛（2×2，留一颗高光）
    px(6, 4, 2, 2, EYE); px(10, 4, 2, 2, EYE);
    px(7, 4, 1, 1, WHITE); px(11, 4, 1, 1, WHITE);

    // 腮红 + 嘴
    px(5, 6, 1, 1, 'rgba(255,138,138,.4)');
    px(12, 6, 1, 1, 'rgba(255,138,138,.4)');
    px(8, 7, 2, 1, shade(s, .55));
  }

  /* ── 通用发型底：蓬顶 + 中分刘海 + 鬓角 ── */
  function hairBase(px, h, hl) {
    px(6, -1, 6, 1, h);
    px(5, 0, 8, 1, h);
    px(4, 1, 10, 1, h);
    px(4, 2, 10, 1, h);
    px(4, 3, 2, 1, h); px(12, 3, 2, 1, h);
    px(4, 4, 1, 2, h); px(13, 4, 1, 2, h);
    px(6, 0, 3, 1, hl);
  }

  /* ══════ 发型 ══════ */
  function drawHair(px, a) {
    const h = a.hair, hd = shade(h, .74), hl = shade(h, 1.22);
    switch (a.hs) {
      case 'short':
        hairBase(px, h, hl);
        px(4, 3, 3, 1, hd);
        break;

      case 'spiky':
        px(4, 1, 10, 2, h);
        px(4, 2, 10, 1, h);
        px(5, -1, 1, 2, h); px(7, -1, 1, 2, h); px(9, -1, 1, 2, h); px(11, -1, 1, 2, h);
        px(4, 4, 1, 2, h); px(13, 4, 1, 2, h);
        px(6, 0, 3, 1, hl); px(5, -1, 1, 1, hl);
        break;

      case 'cap':
        px(4, -1, 10, 3, '#6b7480');
        px(5, -1, 5, 1, '#8b96a4');
        px(3, 2, 12, 1, '#586370');                        // 帽檐
        px(4, 1, 10, 1, '#3f4753');                        // 帽檐阴影
        px(8, -1, 2, 1, '#cfd7e0');
        break;
      case 'pony':
        hairBase(px, h, hl);
        px(14, 2, 2, 5, h); px(14, 7, 2, 2, hd);           // 侧马尾
        px(15, 3, 1, 3, hl);
        break;

      case 'beard':
        px(4, 1, 10, 1, h); px(4, 0, 10, 1, h);
        px(4, 2, 1, 2, h); px(13, 2, 1, 2, h);
        px(8, 0, 3, 1, hl);
        px(5, 7, 8, 2, h); px(6, 9, 6, 1, h);              // 大胡子
        px(4, 6, 1, 2, h); px(14, 6, 1, 2, h);
        px(8, 7, 2, 1, hd);                                // 唇上的胡子
        break;

      case 'twintail':
        hairBase(px, h, hl);
        px(1, 5, 2, 6, h); px(1, 10, 2, 1, hd);           // 左双马尾
        px(16, 5, 2, 6, h); px(16, 10, 2, 1, hd);         // 右双马尾
        px(2, 6, 1, 3, hl); px(16, 6, 1, 3, hl);
        break;

      case 'long':
        hairBase(px, h, hl);
        px(3, 3, 1, 9, h); px(14, 3, 1, 9, h);             // 长发垂到肩下
        px(3, 11, 1, 1, hd); px(14, 11, 1, 1, hd);
        px(4, 1, 1, 2, hl); px(13, 1, 1, 2, hl);
        break;

      case 'bob':
        hairBase(px, h, hl);
        px(3, 3, 2, 4, h); px(13, 3, 2, 4, h);
        px(3, 6, 2, 1, hd); px(13, 6, 2, 1, hd);
        px(4, 1, 1, 2, hl); px(13, 1, 1, 2, hl);
        break;

      case 'bun':
        px(5, -1, 8, 2, h); px(4, 1, 10, 2, h);
        px(4, 3, 1, 2, h); px(13, 3, 1, 2, h);
        px(14, 0, 3, 3, h); px(15, 0, 1, 1, hl);            // 侧边丸子头
        px(6, 0, 3, 1, hl);
        break;

      case 'hood':
        px(4, -1, 10, 3, a.outfit2);                        // 兜帽顶
        px(2, 0, 2, 10, a.outfit2); px(14, 0, 2, 10, a.outfit2);   // 帽边
        px(3, 1, 1, 9, shade(a.outfit2, 1.2));
        px(5, 1, 8, 1, shade(a.outfit2, .74));              // 帽檐阴影
        px(15, 1, 1, 9, shade(a.outfit2, .8));
        px(5, 3, 1, 3, a.hair); px(12, 3, 1, 3, a.hair);    // 露出的头发
        px(6, -1, 2, 1, shade(a.outfit2, 1.3));
        break;
    }
  }

  /* ══════ 随身行李 ══════ */
  function drawAcc(px, a) {
    switch (a.acc) {
      case 'camera':
        px(5, 11, 1, 3, '#43382c'); px(10, 11, 1, 3, '#43382c');   // 背带
        px(6, 13, 5, 3, '#2f343d');
        px(6, 13, 5, 1, '#454d59');
        px(8, 14, 2, 1, '#9fd0ea');                                // 镜头
        px(11, 14, 1, 1, '#6b7686');
        break;

      case 'backpack':
        px(1, 11, 1, 7, '#8a6647'); px(15, 11, 1, 7, '#8a6647');   // 包身露在两侧
        px(4, 11, 1, 5, '#6b4f34'); px(12, 11, 1, 5, '#6b4f34');   // 肩带
        px(1, 16, 1, 1, '#5c412a'); px(15, 16, 1, 1, '#5c412a');
        break;

      case 'glasses':
        px(5, 3, 3, 2, 'rgba(30,34,44,.78)');
        px(10, 3, 3, 2, 'rgba(30,34,44,.78)');
        px(8, 3, 2, 1, '#3a3f4a');                                 // 鼻梁
        px(5, 3, 3, 1, 'rgba(160,210,235,.45)'); px(10, 3, 3, 1, 'rgba(160,210,235,.45)');
        px(6, 4, 1, 1, '#2b2620'); px(11, 4, 1, 1, '#2b2620');
        break;

      case 'uke':
        px(2, 14, 4, 4, '#d9a566');                                // 琴箱
        px(2, 14, 4, 1, '#e8bd82');
        px(3, 15, 2, 2, '#8a5a2b');                                // 音孔
        px(4, 10, 1, 4, '#6b4f34');                                // 琴颈
        px(3, 9, 3, 1, '#4a3826');
        break;

      case 'hat':
        px(2, 2, 16, 1, '#6b4f34');                                // 帽檐
        px(5, -1, 10, 3, '#8a6a48');                               // 帽冠
        px(5, 1, 10, 1, '#4a3826');                                // 帽带
        px(7, 0, 3, 1, '#a08258');
        break;

      case 'flower':
        px(12, 0, 3, 2, '#ff8fa3'); px(13, 1, 1, 1, '#ffe066');
        px(11, 1, 1, 1, '#ffb3c1');
        break;

      case 'phones':
        px(6, -1, 8, 1, '#3a3f4a');                                // 头梁
        px(4, 2, 1, 3, '#3a3f4a'); px(15, 2, 1, 3, '#3a3f4a');     // 耳罩
        px(4, 3, 1, 1, '#7fd8f5'); px(15, 3, 1, 1, '#7fd8f5');
        break;

      case 'map':
        px(13, 14, 3, 4, '#f4ece0');
        px(13, 14, 3, 1, '#cbb894');
        px(14, 16, 1, 1, '#a9d8f7'); px(14, 17, 1, 1, '#d9b3a0');
        break;
    }
  }

  /* ══════ 猫 / 狗：同一个骨架，换耳朵、尾巴与花纹 ══════ */
  function drawPet(px, a) {
    const f = a.fur, fD = shade(f, .82), fL = shade(f, 1.14);
    const belly = a.fur2 || shade(f, 1.3);
    const dark = '#2b2620';
    const eye = a.eye || dark;

    // 尾巴（先画，压在身体后面）
    if (a.tail === 'curl') {
      px(14, 15, 2, 6, f);
      px(15, 20, 2, 2, f);
      px(14, 15, 1, 4, fD);
    } else if (a.tail === 'up') {
      px(14, 12, 2, 8, f);
      px(15, 10, 2, 3, f);
      px(15, 8, 2, 3, f);
      px(14, 13, 1, 5, fL);
    } else {
      px(14, 16, 3, 4, f);
      px(14, 16, 3, 1, fD); px(14, 18, 3, 1, fD);
      px(16, 19, 2, 2, f);
    }

    // 后腿与脚掌
    px(6, 20, 4, 3, fD); px(11, 20, 4, 3, fD);
    px(6, 22, 4, 1, belly); px(11, 22, 4, 1, belly);

    // 身体
    px(5, 13, 10, 7, f);
    px(5, 13, 10, 1, fL);
    px(7, 14, 6, 6, belly);
    px(5, 19, 10, 1, fD);

    // 前爪
    px(5, 18, 3, 5, f); px(12, 18, 3, 5, f);
    px(5, 22, 3, 1, belly); px(12, 22, 3, 1, belly);

    // 围巾 / 项圈 / 领结
    if (a.acc === 'scarf') {
      px(5, 12, 10, 2, a.collar);
      px(5, 12, 10, 1, shade(a.collar, 1.18));
      px(4, 13, 2, 3, a.collar);
      px(4, 15, 2, 1, shade(a.collar, .78));
    } else if (a.acc === 'bell') {
      px(6, 12, 8, 1, a.collar);
      px(9, 13, 2, 1, a.collar);
      px(9, 14, 2, 1, '#f2c94c');
      px(9, 14, 1, 1, '#fff3c4');
    } else if (a.acc === 'bow') {
      px(5, 12, 10, 1, shade(a.collar, .85));
      px(12, 11, 2, 2, a.collar); px(15, 11, 2, 2, a.collar);
      px(14, 11, 1, 2, shade(a.collar, .7));
    }

    // 头
    px(5, 1, 10, 1, f);
    px(4, 2, 12, 1, f);
    px(3, 3, 14, 6, f);
    px(4, 9, 12, 1, f);
    px(5, 10, 10, 1, f);
    px(5, 1, 10, 1, fL);

    // 耳朵
    if (a.ear === 'pointy') {
      px(3, 0, 3, 3, f); px(4, 1, 1, 1, '#eaa3ad');
      px(14, 0, 3, 3, f); px(15, 1, 1, 1, '#eaa3ad');
    } else if (a.ear === 'flop') {
      px(2, 3, 2, 6, fD); px(16, 3, 2, 6, fD);
      px(2, 8, 2, 1, shade(f, .7)); px(16, 8, 2, 1, shade(f, .7));
    } else {
      px(3, 2, 3, 2, fD); px(14, 2, 3, 2, fD);
      px(3, 4, 2, 1, fD); px(15, 4, 2, 1, fD);
    }

    // 花纹
    if (a.mark === 'patch') {
      px(4, 3, 3, 3, a.extra);
      px(12, 5, 3, 3, a.extra2 || a.extra);
    } else if (a.mark === 'stripe') {
      px(8, 1, 1, 3, shade(f, .74));
      px(10, 1, 1, 3, shade(f, .74));
      px(6, 2, 1, 2, shade(f, .74));
      px(12, 2, 1, 2, shade(f, .74));
    }

    // 眼睛
    px(6, 5, 2, 2, eye); px(12, 5, 2, 2, eye);
    px(7, 5, 1, 1, WHITE); px(13, 5, 1, 1, WHITE);

    // 口鼻与胡须
    px(8, 8, 4, 2, belly);
    px(9, 7, 2, 1, '#d98a95');
    px(9, 9, 2, 1, dark);
    px(3, 7, 2, 1, 'rgba(255,255,255,.5)');
    px(15, 7, 2, 1, 'rgba(255,255,255,.5)');
  }


  function addOutline(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
    const add = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (alpha(x, y) > 0) continue;
        if (alpha(x - 1, y) > 0 || alpha(x + 1, y) > 0 || alpha(x, y - 1) > 0 || alpha(x, y + 1) > 0) add.push(y * w + x);
      }
    }
    const c = hexToRgb(OL);
    for (const i of add) {
      const p = i * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ── 生成一个 20×26 的画布 ── */
  function spriteCanvas(id, size) {
    const a = byId(id);
    const cv = document.createElement('canvas');
    cv.width = SPR_W; cv.height = SPR_H;
    cv.className = 'pix-avatar';
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const px = makePainter(ctx);
    if (a.kind === 'pet') {
      drawPet(px, a);
    } else {
      drawBody(px, a);
      drawHead(px, a);
      drawHair(px, a);
      drawAcc(px, a);
    }
    addOutline(ctx, SPR_W, SPR_H);
    // 展示尺寸
    const s = size || 4;
    cv.style.width = (SPR_W * s) + 'px';
    cv.style.height = (SPR_H * s) + 'px';
    return cv;
  }

  /* ── 把形象画到一个已有节点里 ── */
  function paint(node, id, size) {
    if (!node) return;
    node.innerHTML = '';
    node.appendChild(spriteCanvas(id, size));
  }

  /* ── 大图（引导页/详情） ── */
  function bigCanvas(id, size) {
    const cv = spriteCanvas(id, size || 6);
    cv.classList.add('big');
    return cv;
  }

  window.AV = {
    AVATARS, byId, spriteCanvas, paint, bigCanvas,
    SPR_W, SPR_H,
    males: () => AVATARS.filter(a => a.g === 'm'),
    females: () => AVATARS.filter(a => a.g === 'f')
  };
})();
