/* ══════════════════════════════════════════════
   梦想地图 · 音效
   全部用 Web Audio 现场合成，不加载任何音频文件，离线可用。
   首次点击/触摸时才创建 AudioContext（浏览器自动播放策略要求）。
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null;
  let vol = 0.6;

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = vol;
        master.connect(ctx.destination);
      } catch (e) { return false; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    return true;
  }

  function setVolume(v) {
    vol = Math.max(0, Math.min(1, +v || 0));
    if (master && ctx) {
      try { master.gain.setTargetAtTime(vol, ctx.currentTime, 0.02); }
      catch (e) { master.gain.value = vol; }
    }
  }
  const volume = () => vol;

  /* ── 单个音符 ── */
  function tone(freq, at, dur, o) {
    o = o || {};
    const t = ctx.currentTime + at / 1000;
    const end = t + dur / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) {
      try { osc.frequency.exponentialRampToValueAtTime(o.to, end); } catch (e) { }
    }
    const peak = o.gain == null ? 0.1 : o.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(end + 0.03);
  }

  /* ── 一小段滤波噪声（翻页 / 冲洗） ── */
  function noise(at, dur, o) {
    o = o || {};
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur / 1000));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(o.from || 1600, ctx.currentTime + at / 1000);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, ctx.currentTime + (at + dur) / 1000);
    f.Q.value = o.q || 0.9;
    const g = ctx.createGain();
    g.gain.value = o.gain == null ? 0.1 : o.gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(ctx.currentTime + at / 1000);
  }

  const SOUNDS = {
    // 轻点：所有按钮的底噪
    tap: () => tone(680, 0, 52, { type: 'square', gain: 0.055 }),

    // 洗手账 / 翻相册
    flip: () => {
      noise(0, 130, { from: 2200, to: 700, gain: 0.09 });
      tone(420, 0, 70, { type: 'triangle', gain: 0.04, to: 300 });
    },

    // 照片显影
    card: () => {
      tone(520, 0, 70, { type: 'triangle', gain: 0.07 });
      tone(780, 58, 90, { type: 'triangle', gain: 0.045 });
    },

    // 抽卡转盘起飞
    draw: () => {
      tone(260, 0, 380, { type: 'sawtooth', gain: 0.045, to: 940 });
      tone(520, 0, 300, { type: 'triangle', gain: 0.035, to: 1320 });
      noise(120, 260, { from: 600, to: 2600, gain: 0.03 });
    },

    // 完成一件小事 / 心愿币到账
    done: () => {
      tone(523, 0, 110, { type: 'triangle', gain: 0.1 });
      tone(659, 90, 110, { type: 'triangle', gain: 0.09 });
      tone(784, 180, 180, { type: 'triangle', gain: 0.085 });
    },

    // 金币
    coin: () => {
      tone(988, 0, 70, { type: 'triangle', gain: 0.11 });
      tone(1319, 66, 130, { type: 'triangle', gain: 0.09 });
    },

    // 成就达成
    ach: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 90, 170, { type: 'triangle', gain: 0.095 }));
      tone(1568, 360, 260, { type: 'sine', gain: 0.05 });
      noise(340, 180, { from: 3000, to: 6000, gain: 0.025 });
    },

    // 抽到 UR
    ur: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 70, 220, { type: 'triangle', gain: 0.09 }));
      tone(2093, 300, 420, { type: 'sine', gain: 0.06 });
      tone(2637, 380, 520, { type: 'sine', gain: 0.04 });
      noise(300, 240, { from: 3600, to: 7200, gain: 0.03 });
    },

    // 保存照片
    save: () => {
      tone(660, 0, 70, { type: 'sine', gain: 0.09 });
      tone(990, 66, 110, { type: 'sine', gain: 0.075 });
    },

    // 失败 / 不足
    err: () => {
      tone(196, 0, 110, { type: 'square', gain: 0.07 });
      tone(147, 100, 150, { type: 'square', gain: 0.06 });
    }
  };

  function play(name) {
    if (vol <= 0) return false;
    if (!SOUNDS[name]) return false;
    if (!ensure()) return false;
    try { SOUNDS[name](); return true; }
    catch (e) { return false; }
  }

  document.addEventListener('pointerdown', () => { ensure(); }, { passive: true });

  window.SFX = { play, setVolume, volume, enabled: () => !!AC, unlock: ensure };
})();
