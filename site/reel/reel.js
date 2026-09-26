/*
 * MARKET PULSE — a 15 second motion-graphics reel, drawn and scored entirely in code.
 *
 * Reel.frame(ctx, t, data)       draws the frame at time t (seconds) onto ctx's canvas
 * Reel.buildAudio(ac, when, off) schedules the soundtrack on any (Offline)AudioContext
 *
 * Everything is deterministic in t, so the same code drives the live intro on the
 * blog and the frame-by-frame MP4 render (scripts/render_reel.mjs).
 */
(function (root) {
  'use strict';

  const W = 1920, H = 1080, DURATION = 15, BPM = 120, BEAT = 60 / BPM;
  const C = {
    bg: '#05060a', green: '#1ef2a0', red: '#ff3355', amber: '#ffb627', blue: '#4d7cff',
    white: '#f3f5fa', dim: 'rgba(243,245,250,0.5)', faint: 'rgba(243,245,250,0.12)',
  };
  const F = {
    display: '"Space Grotesk", "Noto Sans KR", sans-serif',
    mono: '"JetBrains Mono", "DejaVu Sans Mono", monospace',
    kr: '"Noto Sans KR", "Space Grotesk", sans-serif',
  };

  // ---------------------------------------------------------------- math
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  };
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fmt = (v, d) => {
    const [i, f] = Math.abs(v).toFixed(d).split('.');
    return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
  };
  const pct = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

  // kick drum sections (visual beat pulse follows the music)
  const kickOn = t => (t >= 2 && t < 4.5) || (t >= 6.5 && t < 13.5);
  const pulse = t => (kickOn(t) ? Math.exp(-((t % BEAT) / BEAT) * 7) : 0);

  // ---------------------------------------------------------------- data
  const CANDLES = (() => {
    const r = rng(7), out = [];
    let p = 2480;
    for (let i = 0; i < 48; i++) {
      const o = p;
      let c = o + 13.5 + (r() - 0.42) * 42;
      if (i % 9 === 5) c = o - (18 + r() * 20);
      out.push({ o, c, hi: Math.max(o, c) + r() * 16, lo: Math.min(o, c) - r() * 16, v: 0.25 + r() * 0.75 });
      p = c;
    }
    return out;
  })();
  const TAPE = [['SAMSUNG', 2.41], ['SK HYNIX', 5.1], ['NVDA', 4.22], ['TSLA', -1.87], ['AAPL', 0.94], ['NAVER', 1.33],
    ['KAKAO', -0.72], ['USD/KRW', -0.35], ['BTC', 3.8], ['GOLD', 0.61], ['WTI', -1.12], ['HYUNDAI', 2.05],
    ['NASDAQ', 1.76], ['NIKKEI', 0.88]];
  const SPARKS = (() => {
    const r = rng(99), out = [];
    for (let i = 0; i < 170; i++) {
      const a = -Math.PI * 0.15 + r() * Math.PI * 1.1;
      const sp = 300 + r() * 1300;
      out.push({ vx: Math.cos(a) * sp * (r() < 0.5 ? -0.6 : 1), vy: Math.sin(a) * sp - 500, life: 0.6 + r() * 1.1, hot: r() < 0.35, d: r() * 0.12 });
    }
    return out;
  })();
  const CONTINENTS = [[45, -100, 22, 35], [-15, -60, 22, 15], [52, 15, 12, 22], [5, 20, 30, 20], [45, 95, 20, 45],
    [22, 78, 10, 8], [5, 110, 10, 15], [-25, 134, 11, 17], [72, -42, 8, 15], [24, 45, 9, 10], [36, 138, 6, 4],
    [62, 100, 10, 50], [15, -90, 8, 12]];
  const isLand = (lat, lon) => CONTINENTS.some(([a, b, ra, rb]) => {
    let dl = lon - b; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
    return ((lat - a) / ra) ** 2 + (dl / rb) ** 2 < 1;
  });
  const sph = (lat, lon) => {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.sin(lo), -Math.sin(la), Math.cos(la) * Math.cos(lo)];
  };
  const GLOBE = (() => {
    const n = 2600, out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * i;
      const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const lat = Math.asin(-y) * 180 / Math.PI, lon = Math.atan2(x, z) * 180 / Math.PI;
      out.push([x, y, z, isLand(lat, lon)]);
    }
    return out;
  })();
  const CITIES = [['NYSE', 40.7, -74, 1.2], ['LSE', 51.5, -0.1, 0.8], ['DAX', 50.1, 8.7, 1.1], ['NIKKEI', 35.7, 139.7, 2.4],
    ['KOSPI', 37.6, 127, 3.1], ['HSI', 22.3, 114.2, 1.9], ['SSE', 31.2, 121.5, 0.6], ['SENSEX', 19.1, 72.9, 1.4],
    ['ASX', -33.9, 151.2, 0.9], ['B3', -23.5, -46.6, 1.7], ['STI', 1.35, 103.8, 0.5]].map(c => ({ name: c[0], v: sph(c[1], c[2]), chg: c[3] }));
  const ARCS = [[0, 1], [1, 2], [2, 7], [7, 10], [10, 5], [5, 4], [4, 3], [3, 0], [6, 4], [8, 10], [9, 0], [1, 5], [3, 8], [2, 6]];
  const SECTORS = [
    ['AI', '인공지능', 6.8, 3.1, [0, 0, 0.34, 0.55]], ['CHIPS', '반도체', 4.2, 7.4, [0.34, 0, 0.24, 0.55]],
    ['ENERGY', '에너지', -2.1, 1.2, [0.58, 0, 0.22, 0.3]], ['BIO', '바이오', 1.8, -3.3, [0.8, 0, 0.2, 0.3]],
    ['BANKS', '금융', -0.9, 2.2, [0.58, 0.3, 0.14, 0.25]], ['EV', '전기차', 3.5, -1.6, [0.72, 0.3, 0.28, 0.25]],
    ['CRYPTO', '가상자산', -4.6, 9.8, [0, 0.55, 0.22, 0.45]], ['GOLD', '금', 0.7, 1.9, [0.22, 0.55, 0.16, 0.45]],
    ['FX', '외환', -0.4, -1.1, [0.38, 0.55, 0.14, 0.45]], ['REITS', '리츠', -1.3, 0.6, [0.52, 0.55, 0.16, 0.45]],
    ['SHIPPING', '조선·해운', 2.9, 4.4, [0.68, 0.55, 0.17, 0.45]], ['GAMING', '게임', -2.7, 2.8, [0.85, 0.55, 0.15, 0.45]],
  ];
  const STREAKS = (() => {
    const r = rng(5), out = [];
    for (let i = 0; i < 280; i++) out.push({ a: r() * TAU, v: 0.5 + r() * 1.1, p: r(), w: 1 + r() * 2.5, blue: r() < 0.4 });
    return out;
  })();
  const LOGO = 'MARKET PULSE';
  const LOGO_FX = (() => {
    const r = rng(31);
    return LOGO.split('').map(() => ({ dx: (r() - 0.5) * 1800, dy: (r() - 0.5) * 1000, rot: (r() - 0.5) * 3, s: 2 + r() * 3 }));
  })();
  const FALLBACK = ['금리', '환율', '반도체', '비트코인', '코스피', '엔비디아', '유가', '삼성전자', '금값', '테슬라']
    .map(k => ({ keyword: k, traffic: '' }));

  // ---------------------------------------------------------------- drawing helpers
  let S = 1; // device pixels per logical pixel (shadowBlur is not affected by transforms)
  function glow(g, color, blur) { g.shadowColor = color; g.shadowBlur = blur * S; }
  function noGlow(g) { g.shadowBlur = 0; }
  function text(g, s, x, y, font, color, align = 'left', base = 'alphabetic', spacing = 0) {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    g.fillText(s, x, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  function typed(s, p) { return s.slice(0, Math.round(s.length * clamp(p))); }

  function odometer(g, value, decimals, x, y, size, color, align = 'left') {
    const str = fmt(value, decimals);
    g.font = `700 ${size}px ${F.mono}`;
    const cw = g.measureText('0').width, total = cw * str.length;
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const scaled = Math.abs(value) * Math.pow(10, decimals);
    // place index of each char (rightmost digit = 0)
    const places = []; let k = 0;
    for (let i = str.length - 1; i >= 0; i--) places[i] = /\d/.test(str[i]) ? k++ : -1;
    g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const lh = size * 1.05;
    for (let i = 0; i < str.length; i++, cx += cw) {
      const ch = str[i], pl = places[i];
      if (pl < 0) { g.fillText(ch, cx, y); continue; }
      const unit = Math.pow(10, pl);
      const d0 = Math.floor(scaled / unit) % 10;
      const rem = scaled % unit;
      const frac = pl === 0 ? scaled % 1 : Math.max(0, rem - (unit - 1));
      g.save();
      g.beginPath(); g.rect(cx - 2, y - size * 0.8, cw + 4, size * 0.86); g.clip();
      g.fillText(String(d0), cx, y - frac * lh);
      if (frac > 0.001) g.fillText(String((d0 + 1) % 10), cx, y + (1 - frac) * lh);
      g.restore();
    }
    return total;
  }

  function stripes(g, y, h, off) {
    g.save();
    g.beginPath(); g.rect(0, y, W, h); g.clip();
    g.fillStyle = C.amber; g.fillRect(0, y, W, h);
    g.fillStyle = '#0b0b0b';
    for (let x = -h - 80 + (off % 80); x < W + h; x += 80) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y); g.lineTo(x + 40 - h, y + h); g.lineTo(x - h, y + h); g.fill();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- background + HUD
  function background(g, t) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    // section-tinted light
    let tint = '77,124,255';
    if (t >= 2 && t < 4.5) tint = '30,242,160';
    else if (t >= 4.5 && t < 6.5) tint = '255,51,85';
    else if (t >= 6.5 && t < 9) tint = '30,242,160';
    else if (t >= 9 && t < 11.5) tint = '255,182,39';
    const a = t < 1 ? 0 : 0.2 + pulse(t) * 0.08;
    const grd = g.createRadialGradient(960, 540, 50, 960, 540, 1100);
    grd.addColorStop(0, `rgba(${tint},${a})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // drifting grid
    const ga = (t < 0.8 ? 0 : prog(t, 0.8, 1.6)) * (0.05 + pulse(t) * 0.05);
    if (ga > 0) {
      g.strokeStyle = `rgba(150,170,230,${ga})`; g.lineWidth = 1;
      const off = (t * 40) % 80;
      g.beginPath();
      for (let x = -off; x < W; x += 80) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = -off * 0.5; y < H; y += 80) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
    }
  }

  const SECTIONS = [[0, '01  OPENING BELL'], [2, '02  BULL RUN'], [4.5, '03  SELL-OFF'], [6.5, '04  REBOUND'],
    [9, '05  ROTATION'], [11.5, '06  WHAT WE SEARCH'], [13.5, '07  CLOSING BELL']];
  function hud(g, t) {
    const a = prog(t, 1.1, 1.5) * (1 - prog(t, 14.4, 14.7));
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    g.strokeStyle = 'rgba(243,245,250,0.4)'; g.lineWidth = 2;
    const m = 44, L = 36;
    g.beginPath();
    g.moveTo(m, m + L); g.lineTo(m, m); g.lineTo(m + L, m);
    g.moveTo(W - m - L, m); g.lineTo(W - m, m); g.lineTo(W - m, m + L);
    g.moveTo(m, H - m - L); g.lineTo(m, H - m); g.lineTo(m + L, H - m);
    g.moveTo(W - m - L, H - m); g.lineTo(W - m, H - m); g.lineTo(W - m, H - m - L);
    g.stroke();
    const f = `500 17px ${F.mono}`;
    text(g, 'MARKET PULSE — REEL 2026', m + 18, m + 30, f, C.dim, 'left', 'alphabetic', 3);
    let sec = SECTIONS[0][1];
    for (const [s, n] of SECTIONS) if (t >= s) sec = n;
    text(g, sec, W - m - 18, m + 30, f, C.dim, 'right', 'alphabetic', 3);
    if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = C.red; g.beginPath(); g.arc(W - m - 18 - g.measureText(sec).width - 34, m + 24, 6, 0, TAU); g.fill(); }
    const fr = Math.floor(t * 30), tc = `00:00:${String(Math.floor(t)).padStart(2, '0')}:${String(fr % 30).padStart(2, '0')}`;
    text(g, 'TC ' + tc, m + 18, H - m - 16, f, C.dim, 'left', 'alphabetic', 3);
    text(g, '1920×1080 · CANVAS · WEB AUDIO', W - m - 18, H - m - 16, f, C.dim, 'right', 'alphabetic', 3);
    g.restore();
  }

  // ---------------------------------------------------------------- 01 opening bell (0 – 2)
  function s1(g, t) {
    if (t > 2.1) return;
    g.save();
    const z = 1 + E.inExpo(prog(t, 1.7, 2.08)) * 5;
    g.translate(960, 600); g.scale(z, z); g.translate(-960, -600);
    g.globalAlpha = 1 - prog(t, 1.9, 2.08);

    // horizon line
    const lw = E.outExpo(prog(t, 0.05, 0.75)) * 1560;
    glow(g, 'rgba(255,255,255,0.9)', 18);
    g.fillStyle = C.white; g.fillRect(960 - lw / 2, 598, lw, 3);
    noGlow(g);
    // ruler ticks
    const tk = prog(t, 0.35, 0.95);
    g.fillStyle = 'rgba(243,245,250,0.35)';
    for (let i = 0; i <= 39; i++) {
      if (i / 39 > tk) break;
      const x = 180 + i * 40, h = i % 5 === 0 ? 16 : 8;
      g.fillRect(x, 606, 2, h);
    }

    // clock
    const secs = t < 0.45 ? 57 : t < 0.72 ? 58 : 59;
    const open = t >= 1.0;
    const cp = E.inOutCubic(prog(t, 1.0, 1.45));
    const cy = lerp(520, 300, cp), cs = lerp(76, 34, cp);
    const ca = prog(t, 0.12, 0.22);
    if (ca > 0) {
      g.save(); g.globalAlpha *= ca;
      const label = open ? '09:00:00' : `08:59:${secs}`;
      if (open) glow(g, C.amber, 30 * (1 - cp * 0.6));
      text(g, label, 960, cy, `700 ${cs}px ${F.mono}`, open ? C.amber : C.white, 'center', 'alphabetic', 4);
      noGlow(g);
      if (cp > 0.5) text(g, 'KST — OPENING BELL', 960, cy + 44, `500 20px ${F.mono}`, C.dim, 'center', 'alphabetic', 6);
      g.restore();
    }

    // bell ring shockwaves
    for (const [t0, col] of [[1.0, C.amber], [1.12, C.white]]) {
      const p = prog(t, t0, t0 + 0.95);
      if (p > 0 && p < 1) {
        g.strokeStyle = col; g.globalAlpha = (1 - p) * 0.8 * (1 - prog(t, 1.9, 2.08));
        g.lineWidth = 8 * (1 - p) + 0.5;
        g.beginPath(); g.arc(960, 600, E.outCubic(p) * 1100, 0, TAU); g.stroke();
        g.globalAlpha = 1 - prog(t, 1.9, 2.08);
      }
    }

    // THE MARKETS — letters rise out of the horizon
    const word = 'THE MARKETS';
    g.font = `700 200px ${F.display}`;
    const ws = g.measureText(word).width;
    g.save();
    g.beginPath(); g.rect(0, 0, W, 596); g.clip();
    let x = 960 - ws / 2;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i], cw = g.measureText(ch).width;
      const p = E.outExpo(prog(t, 1.02 + i * 0.035, 1.6 + i * 0.035));
      if (p > 0) text(g, ch, x, 572 + (1 - p) * 240, `700 200px ${F.display}`, C.white);
      x += cw;
    }
    g.restore();
    // ARE OPEN — typed under the line
    const tp = prog(t, 1.35, 1.7);
    if (tp > 0) {
      const s = typed('ARE OPEN FOR BUSINESS', tp);
      text(g, s + (Math.floor(t * 8) % 2 ? '▌' : ' '), 960, 680, `500 38px ${F.mono}`, C.green, 'center', 'alphabetic', 10);
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 02 bull run (2 – 4.5) + crash line
  const CS = 34, CW = 18, PY = p => 880 - (p - 2480) * 0.72;
  const revealAt = t => (t - 2.0) / 0.052;
  function s2(g, t) {
    if (t < 1.85 || t > 5.7) return;
    const r = clamp(revealAt(t), 0, CANDLES.length);
    const headX = r * CS;
    const camX = Math.max(0, headX - 1280);
    const enter = E.outExpo(prog(t, 1.85, 2.5));
    const crash = prog(t, 4.5, 5.35);
    g.save();
    const groupA = prog(t, 1.85, 2.1) * (1 - prog(t, 5.3, 5.7));
    g.globalAlpha = groupA;
    const z = lerp(1.3, 1, enter) * (1 + 0.012 * pulse(t));
    g.translate(960, 540); g.scale(z, z); g.rotate(E.inOutCubic(crash) * 0.06); g.translate(-960, -540);
    g.translate(0, -E.inOutCubic(crash) * 300);
    if (t > 4.3 && t < 4.5) g.translate((hash(t * 300) - 0.5) * 10, (hash(t * 170) - 0.5) * 10);

    // price grid
    g.lineWidth = 1;
    for (let p = 2500; p <= 3200; p += 100) {
      const y = PY(p);
      g.strokeStyle = 'rgba(243,245,250,0.07)';
      g.beginPath(); g.moveTo(80, y); g.lineTo(1840, y); g.stroke();
      text(g, fmt(p, 0), 1840, y - 8, `500 18px ${F.mono}`, 'rgba(243,245,250,0.3)', 'right');
    }

    g.save();
    g.translate(200 - camX, 0);
    const bright = t < 4.5 ? 1 : lerp(1, 0.28, prog(t, 4.5, 4.7));
    // volume
    for (let i = 0; i < Math.ceil(r); i++) {
      const c = CANDLES[i], p = E.outCubic(clamp(r - i));
      g.fillStyle = c.c >= c.o ? `rgba(30,242,160,${0.22 * bright})` : `rgba(255,51,85,${0.22 * bright})`;
      const vh = c.v * 90 * p;
      g.fillRect(i * CS, 925 - vh, CW, vh);
    }
    // candles
    for (let i = 0; i < Math.ceil(r); i++) {
      const c = CANDLES[i], p = E.outBack(clamp((r - i) * 1.2));
      const up = c.c >= c.o, col = up ? C.green : C.red;
      const x = i * CS;
      g.globalAlpha = groupA * bright;
      g.fillStyle = col;
      const mid = PY(c.o), yc = lerp(mid, PY(c.c), p);
      const wk = clamp(p);
      g.fillRect(x + CW / 2 - 1, lerp(mid, PY(c.hi), wk), 2, lerp(mid, PY(c.lo), wk) - lerp(mid, PY(c.hi), wk));
      const top = Math.min(mid, yc), hgt = Math.max(3, Math.abs(yc - mid));
      if (i === Math.ceil(r) - 1 && t < 4.5) glow(g, col, 24);
      g.fillRect(x, top, CW, hgt);
      noGlow(g);
    }
    g.globalAlpha = groupA;
    // moving average + area
    const n = Math.floor(r);
    if (n > 1) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        let s = 0, k = 0;
        for (let j = Math.max(0, i - 4); j <= i; j++) { s += CANDLES[j].c; k++; }
        pts.push([i * CS + CW / 2, PY(s / k)]);
      }
      const area = g.createLinearGradient(0, 380, 0, 925);
      area.addColorStop(0, `rgba(30,242,160,${0.2 * bright})`); area.addColorStop(1, 'rgba(30,242,160,0)');
      g.beginPath(); g.moveTo(pts[0][0], 925);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.lineTo(pts[pts.length - 1][0], 925); g.closePath(); g.fillStyle = area; g.fill();
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = C.amber; g.lineWidth = 3; g.globalAlpha *= bright;
      glow(g, C.amber, 14); g.stroke(); noGlow(g);
      g.globalAlpha = groupA;
    }
    // head marker + price tag
    const last = CANDLES[Math.max(0, Math.ceil(r) - 1)];
    const hp = lerp(last.o, last.c, E.outCubic(clamp(r - Math.floor(r) || 1)));
    const hx = (Math.ceil(r) - 1) * CS + CW / 2, hy = PY(hp);
    if (t < 4.5) {
      g.setLineDash([6, 8]); g.strokeStyle = 'rgba(30,242,160,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(camX + 1540, hy); g.stroke(); g.setLineDash([]);
      g.fillStyle = C.green; g.fillRect(camX + 1540, hy - 20, 150, 40);
      text(g, fmt(hp, 2), camX + 1615, hy + 1, `700 22px ${F.mono}`, '#04140c', 'center', 'middle');
      const pr = (t * 2) % 1;
      g.strokeStyle = `rgba(30,242,160,${1 - pr})`; g.lineWidth = 2;
      g.beginPath(); g.arc(hx, hy, 8 + pr * 30, 0, TAU); g.stroke();
      glow(g, C.green, 20); g.fillStyle = C.white; g.beginPath(); g.arc(hx, hy, 7, 0, TAU); g.fill(); noGlow(g);
    }

    // ---- 03 crash line + sparks, in chart space so the camera follows the fall
    if (t >= 4.5) {
      const end = CANDLES[CANDLES.length - 1];
      const x0 = (CANDLES.length - 1) * CS + CW / 2, y0 = PY(end.c);
      const drop = [[0, 0], [40, 60], [70, 40], [120, 210], [150, 180], [210, 420], [240, 390], [320, 700], [350, 660], [460, 1000]];
      const p = E.outExpo(prog(t, 4.5, 4.95));
      const cut = p * (drop.length - 1);
      g.globalAlpha = 1 - prog(t, 5.5, 5.8);
      g.beginPath(); g.moveTo(x0, y0);
      for (let i = 1; i <= Math.ceil(cut); i++) {
        const a = drop[i - 1], b = drop[i], f = clamp(cut - (i - 1));
        g.lineTo(x0 + lerp(a[0], b[0], f), y0 + lerp(a[1], b[1], f));
      }
      g.strokeStyle = C.red; g.lineWidth = 7; g.lineJoin = 'round';
      glow(g, C.red, 30); g.stroke(); noGlow(g);
      // sparks
      const dt0 = t - 4.5;
      g.lineCap = 'round';
      for (const s of SPARKS) {
        const dt = dt0 - s.d;
        if (dt <= 0 || dt > s.life) continue;
        const k = 1 - dt / s.life;
        const x = x0 + s.vx * dt, y = y0 + s.vy * dt + 0.5 * 1800 * dt * dt;
        const vx = s.vx, vy = s.vy + 1800 * dt;
        g.strokeStyle = s.hot ? `rgba(255,220,150,${k})` : `rgba(255,51,85,${k})`;
        g.lineWidth = 3 * k + 0.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - vx * 0.02, y - vy * 0.02); g.stroke();
      }
      g.lineCap = 'butt';
    }
    g.restore();
    g.restore();

    // HUD-level counter + ticker tape (screen space)
    const ua = prog(t, 2.05, 2.35) * (1 - prog(t, 4.5, 4.62));
    if (ua > 0) {
      g.save(); g.globalAlpha = ua;
      const slide = (1 - E.outExpo(prog(t, 2.05, 2.6))) * -60;
      text(g, 'KOSPI  ·  코스피 종합지수', 130 + slide, 160, `500 24px ${F.kr}`, C.dim, 'left', 'alphabetic', 2);
      odometer(g, hp, 2, 124 + slide, 280, 116, C.white);
      const ch = (hp / 2480 - 1) * 100;
      g.fillStyle = 'rgba(30,242,160,0.16)';
      g.fillRect(130 + slide, 310, 250, 52);
      text(g, '▲ ' + pct(ch), 148 + slide, 346, `700 32px ${F.mono}`, C.green);
      g.restore();
      tape(g, t, ua);
    }
  }
  function tape(g, t, a) {
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 936, W, 54);
    g.fillStyle = 'rgba(243,245,250,0.12)'; g.fillRect(0, 936, W, 1);
    g.font = `600 26px ${F.mono}`;
    const items = TAPE.map(([n, v]) => [`${n} `, `${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`, v]);
    let total = 0; const widths = items.map(([a2, b]) => { const w = g.measureText(a2).width + g.measureText(b).width + 70; total += w; return w; });
    let x = -((t * 340) % total);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    while (x < W) {
      items.forEach(([n, v, raw], i) => {
        if (x < W && x + widths[i] > 0) {
          g.fillStyle = C.white; g.fillText(n, x, 964);
          g.fillStyle = raw >= 0 ? C.green : C.red; g.fillText(v, x + g.measureText(n).width, 964);
        }
        x += widths[i];
      });
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 03 sell-off / halt (4.5 – 6.5)
  function s3(g, t) {
    if (t < 4.5 || t > 6.55) return;
    // SELL-OFF slam
    if (t < 5.62) {
      const p = E.outExpo(prog(t, 4.5, 4.72));
      const sc = lerp(2.8, 1, p);
      const squash = 1 - E.inExpo(prog(t, 5.42, 5.6));
      g.save();
      g.translate(960, 560); g.scale(sc, sc * squash); g.rotate(-0.04 * (1 - p));
      // echo trails after impact
      for (let k = 0; k < 3; k++) {
        const e = prog(t, 4.6 + k * 0.1, 5.2 + k * 0.1);
        if (e > 0 && e < 1) {
          g.save(); g.scale(1 + e * 0.5, 1 + e * 0.5);
          g.strokeStyle = `rgba(255,51,85,${(1 - e) * 0.6})`; g.lineWidth = 3;
          g.font = `700 300px ${F.display}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.strokeText('SELL-OFF', 0, 0); g.restore();
        }
      }
      glow(g, 'rgba(255,51,85,0.8)', 40);
      text(g, 'SELL-OFF', 0, 0, `700 300px ${F.display}`, C.white, 'center', 'middle');
      noGlow(g);
      g.restore();
      const np = E.outExpo(prog(t, 4.62, 5.3));
      if (t > 4.6) {
        g.save(); g.globalAlpha = prog(t, 4.6, 4.7) * squash;
        g.font = `700 108px ${F.mono}`;
        text(g, '▼', 700, 820, `700 80px ${F.mono}`, C.red, 'center');
        const ow = odometer(g, -12.4 * np, 1, 780, 850, 108, C.red, 'left');
        text(g, '%', 790 + ow, 850, `700 108px ${F.mono}`, C.red);
        text(g, '장중 최대 낙폭 · INTRADAY LOW', 960, 915, `500 26px ${F.kr}`, C.dim, 'center', 'alphabetic', 3);
        g.restore();
      }
    }
    // circuit breaker
    if (t >= 5.52) {
      const inP = E.outExpo(prog(t, 5.52, 5.85));
      const close = E.inExpo(prog(t, 6.2, 6.5));
      const bh = lerp(110, 560, close);
      g.save();
      g.fillStyle = `rgba(0,0,0,${0.55 * inP})`; g.fillRect(0, 0, W, H);
      stripes(g, lerp(-110, 0, inP), bh, t * 260);
      stripes(g, lerp(H, H - bh, inP) + (1 - inP) * 0, bh, -t * 260);
      if (close < 0.35) {
        g.globalAlpha = inP * (1 - close * 2.8);
        text(g, '⚠  CIRCUIT BREAKER  ⚠', 960, 360, `700 34px ${F.mono}`, C.amber, 'center', 'alphabetic', 10);
        const blink = Math.floor(t * 7) % 2 ? 1 : 0.35;
        g.save(); g.globalAlpha *= blink;
        glow(g, 'rgba(255,255,255,0.5)', 24);
        const wp = E.outExpo(prog(t, 5.55, 5.9));
        g.beginPath(); g.rect(960 - 700 * wp, 420, 1400 * wp, 190); g.clip();
        text(g, 'TRADING HALTED', 960, 560, `700 150px ${F.display}`, C.white, 'center');
        noGlow(g); g.restore();
        const left = 20 * 60 * (1 - E.inOutCubic(prog(t, 5.7, 6.2)));
        const mm = Math.floor(left / 60), ss = Math.floor(left % 60), cc = Math.floor((left * 100) % 100);
        text(g, `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`, 960, 710, `700 84px ${F.mono}`, C.amber, 'center', 'alphabetic', 4);
        g.fillStyle = 'rgba(255,182,39,0.2)'; g.fillRect(560, 745, 800, 8);
        g.fillStyle = C.amber; g.fillRect(560, 745, 800 * (left / 1200), 8);
        text(g, '서킷브레이커 발동 · 전 종목 매매 일시 정지', 960, 820, `500 34px ${F.kr}`, C.dim, 'center');
      }
      g.restore();
    }
  }

  // ---------------------------------------------------------------- 04 rebound / globe (6.5 – 9)
  function s4(g, t) {
    if (t < 6.45 || t > 9.1) return;
    const out = E.inExpo(prog(t, 8.72, 9.05));
    // rising sweep line
    const sp = E.inOutCubic(prog(t, 6.55, 7.7));
    if (sp > 0) {
      g.save(); g.globalAlpha = 1 - out;
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const y = 1000 - Math.pow(u, 1.6) * 330 - Math.sin(u * 22) * 14 * (1 - u) - Math.sin(u * 9) * 10;
        pts.push([u * W, y]);
      }
      const n = Math.max(2, Math.floor(sp * 60) + 1);
      const grd = g.createLinearGradient(0, 650, 0, H);
      grd.addColorStop(0, 'rgba(30,242,160,0.28)'); grd.addColorStop(1, 'rgba(30,242,160,0)');
      g.beginPath(); g.moveTo(0, H);
      for (let i = 0; i < n; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[n - 1][0], H); g.closePath(); g.fillStyle = grd; g.fill();
      g.beginPath(); for (let i = 0; i < n; i++) (i ? g.lineTo : g.moveTo).call(g, pts[i][0], pts[i][1]);
      g.strokeStyle = C.green; g.lineWidth = 4; glow(g, C.green, 22); g.stroke();
      g.fillStyle = C.white; g.beginPath(); g.arc(pts[n - 1][0], pts[n - 1][1], 7, 0, TAU); g.fill(); noGlow(g);
      g.restore();
    }

    // globe
    const gp = E.outBack(prog(t, 6.5, 7.15));
    const R = 360 * gp * (1 + out * 5);
    const cx = lerp(1250, 960, out), cy = 520;
    const a = -1.25 - (t - 6.5) * 0.42 - out * 2.5, b = -0.38;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const rot = v => {
      const x1 = v[0] * ca + v[2] * sa, z1 = -v[0] * sa + v[2] * ca;
      return [x1, v[1] * cb - z1 * sb, v[1] * sb + z1 * cb];
    };
    if (R > 1) {
      g.save(); g.globalAlpha = 1 - prog(t, 8.9, 9.08);
      const halo = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.35);
      halo.addColorStop(0, 'rgba(77,124,255,0.18)'); halo.addColorStop(1, 'rgba(77,124,255,0)');
      g.fillStyle = halo; g.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
      for (const p of GLOBE) {
        const [x, y, z] = rot(p);
        const land = p[3];
        if (z < 0 && !land) continue;
        const depth = (z + 1) / 2;
        const s = (land ? 2.6 : 1.3) * (0.5 + depth) * Math.max(1, R / 360 * 0.6);
        g.fillStyle = land
          ? (z > 0 ? `rgba(120,200,255,${0.25 + depth * 0.7})` : `rgba(77,124,255,${0.08 + depth * 0.12})`)
          : `rgba(120,140,200,${depth * 0.22})`;
        g.fillRect(cx + x * R - s / 2, cy + y * R - s / 2, s, s);
      }
      // capital-flow arcs
      g.lineCap = 'round';
      ARCS.forEach(([i, j], k) => {
        const A = CITIES[i].v, B = CITIES[j].v;
        const dot = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1), om = Math.acos(dot), so = Math.sin(om);
        const P = 1.5, u = (t - 6.75 - k * 0.12) / P;
        if (u < 0) return;
        const f = u - Math.floor(u);
        const head = clamp(f / 0.55), tail = clamp((f - 0.3) / 0.55);
        if (head <= tail) return;
        const col = [C.green, C.amber, '#8fb2ff'][k % 3];
        g.strokeStyle = col; g.lineWidth = 2.5;
        g.beginPath();
        let started = false, hx = 0, hy = 0, hv = false;
        for (let s = 0; s <= 24; s++) {
          const q = lerp(tail, head, s / 24);
          const w1 = Math.sin((1 - q) * om) / so, w2 = Math.sin(q * om) / so;
          const lift = 1 + 0.28 * Math.sin(Math.PI * q) * (om / Math.PI + 0.3);
          const v = [(A[0] * w1 + B[0] * w2) * lift, (A[1] * w1 + B[1] * w2) * lift, (A[2] * w1 + B[2] * w2) * lift];
          const [x, y, z] = rot(v);
          const vis = z > 0 || x * x + y * y > 1;
          const px = cx + x * R, py = cy + y * R;
          if (vis) { started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; } else started = false;
          if (s === 24) { hx = px; hy = py; hv = vis; }
        }
        glow(g, col, 12); g.stroke();
        if (hv && head < 1) { g.fillStyle = C.white; g.beginPath(); g.arc(hx, hy, 4, 0, TAU); g.fill(); }
        noGlow(g);
      });
      g.lineCap = 'butt';
      // exchanges
      CITIES.forEach((c, k) => {
        const [x, y, z] = rot(c.v);
        if (z < -0.05) return;
        const px = cx + x * R, py = cy + y * R;
        const pr = ((t + k * 0.37) % 1.2) / 1.2;
        g.strokeStyle = `rgba(30,242,160,${(1 - pr) * clamp(z * 3)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(px, py, 6 + pr * 26, 0, TAU); g.stroke();
        g.fillStyle = C.green; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
        const la = clamp((z - 0.25) * 3) * prog(t, 7.0 + k * 0.05, 7.3 + k * 0.05) * (1 - out);
        if (la > 0) {
          g.save(); g.globalAlpha *= la;
          g.fillStyle = 'rgba(5,6,10,0.75)';
          g.font = `700 19px ${F.mono}`;
          const label = `${c.name} ▲${c.chg.toFixed(1)}%`, lw = g.measureText(label).width + 20;
          g.fillRect(px + 14, py - 34, lw, 30);
          g.fillStyle = C.green; g.fillRect(px + 14, py - 34, 3, 30);
          text(g, label, px + 26, py - 19, `700 19px ${F.mono}`, C.white, 'left', 'middle');
          g.restore();
        }
      });
      g.restore();
    }

    // headline
    g.save(); g.globalAlpha = 1 - E.outCubic(prog(t, 8.6, 8.85));
    text(g, typed('GLOBAL MARKETS · 24H', prog(t, 6.55, 6.9)), 140, 330, `500 24px ${F.mono}`, C.dim, 'left', 'alphabetic', 6);
    [['V-SHAPED', C.white, 6.6], ['REBOUND', C.green, 6.74]].forEach(([s, col, t0], i) => {
      const p = E.outExpo(prog(t, t0, t0 + 0.6));
      const y = 470 + i * 150;
      g.save(); g.beginPath(); g.rect(120, y - 140, 900, 165); g.clip();
      if (i === 1) glow(g, 'rgba(30,242,160,0.6)', 30);
      text(g, s, 132 - (1 - p) * 700, y, `700 150px ${F.display}`, col);
      noGlow(g); g.restore();
    });
    const rp = E.outExpo(prog(t, 6.95, 7.6));
    if (rp > 0) {
      text(g, '▲ ', 140, 700, `700 44px ${F.mono}`, C.green);
      const ow = odometer(g, 18.7 * rp, 1, 190, 700, 44, C.green);
      text(g, '%  FROM THE LOWS', 192 + ow, 700, `700 44px ${F.mono}`, C.green);
      text(g, '저점 대비 반등', 142, 750, `500 28px ${F.kr}`, C.dim);
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 05 sector rotation (9 – 11.5)
  function s5(g, t) {
    if (t < 8.95 || t > 11.55) return;
    const X0 = 100, Y0 = 190, AW = 1720, AH = 740, GAP = 8;
    const push = 1 + prog(t, 9, 11.5) * 0.05;
    const boom = E.inExpo(prog(t, 11.22, 11.5));
    g.save();
    g.translate(960, 560); g.scale(push, push); g.rotate(lerp(-0.012, 0.012, prog(t, 9, 11.5))); g.translate(-960, -560);
    const ha = prog(t, 9.0, 9.2) * (1 - boom);
    text(g, typed('SECTOR ROTATION', prog(t, 9.0, 9.35)), X0, 150, `700 56px ${F.display}`, `rgba(243,245,250,${ha})`, 'left', 'alphabetic', 2);
    text(g, '섹터별 등락률 · LIVE HEATMAP', X0 + AW, 150, `500 24px ${F.kr}`, `rgba(243,245,250,${0.5 * ha})`, 'right', 'alphabetic', 2);

    SECTORS.forEach(([name, kr, v1, v2, [fx, fy, fw, fh]], i) => {
      const x = X0 + fx * AW + GAP / 2, y = Y0 + fy * AH + GAP / 2, w = fw * AW - GAP, h = fh * AH - GAP;
      const tcx = x + w / 2, tcy = y + h / 2;
      const dist = Math.hypot((tcx - 960) / 960, (tcy - 560) / 540);
      const d0 = 9.02 + dist * 0.38;
      const ep = prog(t, d0, d0 + 0.5);
      if (ep <= 0) return;
      const fl0 = 10.25 + i * 0.035, fp = prog(t, fl0, fl0 + 0.28);
      const flipS = fp > 0 && fp < 1 ? Math.abs(Math.cos(fp * Math.PI)) : 1;
      const val = fp >= 0.5 ? v2 : v1;
      const shown = fp >= 0.5 ? v2 : v1 * E.outCubic(prog(t, d0 + 0.1, d0 + 0.7));
      const inten = clamp(Math.abs(val) / 8, 0.15, 1);
      const base = val >= 0 ? [30, 242, 160] : [255, 51, 85];
      g.save();
      const dir = Math.atan2(tcy - 560, tcx - 960);
      g.translate(tcx + Math.cos(dir) * boom * 1500, tcy + Math.sin(dir) * boom * 1100);
      g.rotate(boom * (i % 2 ? 0.8 : -0.8));
      g.scale(1, E.outBack(ep) * flipS);
      g.globalAlpha = 1 - boom;
      const bump = pulse(t) * 0.12;
      g.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${0.16 + inten * 0.5 + bump})`;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},0.9)`; g.fillRect(-w / 2, -h / 2, w, 3);
      const flash = 1 - prog(t, d0, d0 + 0.3);
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.7})`; g.fillRect(-w / 2, -h / 2, w, h); }
      g.font = `700 100px ${F.display}`;
      const fs = Math.min(92, Math.min(w, h) * 0.26, (w - 44) / (g.measureText(name).width / 100));
      text(g, name, -w / 2 + 22, -h / 2 + 22 + fs * 0.85, `700 ${fs}px ${F.display}`, C.white);
      text(g, kr, -w / 2 + 24, -h / 2 + 30 + fs * 0.85 + fs * 0.5, `500 ${Math.max(16, fs * 0.36)}px ${F.kr}`, 'rgba(243,245,250,0.7)');
      text(g, pct(shown), w / 2 - 20, h / 2 - 20, `700 ${Math.max(20, fs * 0.55)}px ${F.mono}`, C.white, 'right');
      g.restore();
    });
    g.restore();
  }

  // ---------------------------------------------------------------- 06 search countdown (11.5 – 13.5)
  function s6(g, t, data) {
    if (t < 11.45 || t > 13.62) return;
    const inten = prog(t, 11.45, 11.7) * (1 - prog(t, 13.1, 13.5));
    const kws = data && data.keywords && data.keywords.length ? data.keywords : FALLBACK;
    // warp streaks
    g.save(); g.lineCap = 'round';
    for (const s of STREAKS) {
      const d = (s.p + (t - 11.45) * s.v * 0.9) % 1;
      const r0 = 30 + d * d * 1300, len = 10 + d * d * 300;
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      g.strokeStyle = s.blue ? `rgba(120,160,255,${d * 0.8 * inten})` : `rgba(243,245,250,${d * 0.7 * inten})`;
      g.lineWidth = s.w * (0.4 + d);
      g.beginPath(); g.moveTo(960 + ca * r0, 540 + sa * r0); g.lineTo(960 + ca * (r0 + len), 540 + sa * (r0 + len)); g.stroke();
    }
    g.restore();
    // header
    const ha = prog(t, 11.55, 11.8) * (1 - prog(t, 13.35, 13.5));
    text(g, 'WHAT KOREA IS SEARCHING  ·  LIVE', 960, 150, `500 24px ${F.mono}`, `rgba(243,245,250,${0.6 * ha})`, 'center', 'alphabetic', 8);
    text(g, `실시간 검색어 TOP 10${data && data.stamp ? '  ·  ' + data.stamp : ''}`, 960, 205, `700 38px ${F.kr}`, `rgba(243,245,250,${ha})`, 'center');

    // keywords fly through, 10 → 1
    const items = kws.slice(0, 10);
    for (let j = 0; j < items.length; j++) {
      const rank = items.length - j, it = items[rank - 1];
      const ts = rank === 1 ? 13.08 : 11.55 + j * 0.16;
      const last = rank === 1;
      let sc, alpha, x, y;
      if (!last) {
        const s = prog(t, ts, ts + 0.5);
        if (s <= 0 || s >= 1) continue;
        sc = lerp(0.12, 3.4, E.inCubic(s));
        alpha = s < 0.2 ? s / 0.2 : s > 0.6 ? (1 - s) / 0.4 : 1;
        const th = j * 2.4;
        x = 960 + Math.cos(th) * 460 * (sc - 0.12); y = 560 + Math.sin(th) * 260 * (sc - 0.12);
      } else {
        const s = E.outBack(prog(t, ts, ts + 0.38));
        if (s <= 0) continue;
        sc = lerp(0.12, 1, s);
        alpha = prog(t, ts, ts + 0.1) * (1 - prog(t, 13.45, 13.56));
        x = 960; y = 580;
      }
      g.save();
      g.globalAlpha = clamp(alpha);
      g.translate(x, y); g.scale(sc, sc);
      g.font = `900 120px ${F.kr}`;
      const kwW = g.measureText(it.keyword).width;
      const fit = Math.min(1, 1100 / Math.max(1, kwW));
      g.scale(fit, fit);
      const rankS = `#${rank}`;
      g.font = `700 70px ${F.mono}`;
      const rw = g.measureText(rankS).width;
      const total = rw + 40 + kwW, x0 = -total / 2;
      g.strokeStyle = C.amber; g.lineWidth = 3;
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.strokeText(rankS, x0, 0);
      if (last) glow(g, 'rgba(255,182,39,0.7)', 40);
      text(g, it.keyword, x0 + rw + 40, 6, `900 120px ${F.kr}`, last ? C.amber : C.white, 'left', 'middle');
      noGlow(g);
      if (it.traffic) text(g, `${it.traffic} 검색`, x0 + rw + 44, 96, `500 32px ${F.kr}`, C.dim, 'left', 'middle');
      g.restore();
    }
    if (t > 13.25) text(g, '지금 1위 검색어', 960, 775, `500 30px ${F.kr}`, `rgba(243,245,250,${0.7 * prog(t, 13.25, 13.35) * (1 - prog(t, 13.45, 13.56))})`, 'center', 'alphabetic', 4);
  }

  // ---------------------------------------------------------------- 07 closing bell / logo (13.5 – 15)
  const ekg = x => {
    const k = [[1060, 0], [1100, -24], [1125, 32], [1160, -150], [1195, 70], [1225, -18], [1250, 0]];
    if (x <= k[0][0] || x >= k[k.length - 1][0]) return 0;
    for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return lerp(k[i - 1][1], k[i][1], (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
    return 0;
  };
  function s7(g, t) {
    if (t < 13.5) return;
    // letters converge
    g.font = `700 170px ${F.display}`;
    const full = g.measureText(LOGO).width;
    let x = 960 - full / 2;
    for (let i = 0; i < LOGO.length; i++) {
      const ch = LOGO[i], cw = g.measureText(ch).width;
      const fx = LOGO_FX[i], p = E.outExpo(prog(t, 13.52 + i * 0.028, 14.1 + i * 0.028));
      if (ch !== ' ' && p > 0) {
        g.save();
        g.globalAlpha = clamp(p * 1.4);
        g.translate(x + cw / 2 + fx.dx * (1 - p), 560 + fx.dy * (1 - p));
        g.rotate(fx.rot * (1 - p)); const s = lerp(fx.s, 1, p); g.scale(s, s);
        const u = (i - 7) / 4;
        const col = i > 6 ? `rgb(${Math.round(lerp(30, 111, u))},${Math.round(lerp(242, 211, u))},${Math.round(lerp(160, 255, u))})` : C.white;
        if (i > 6) glow(g, 'rgba(30,242,160,0.5)', 30 * p);
        text(g, ch, 0, 0, `700 170px ${F.display}`, col, 'center', 'alphabetic');
        noGlow(g);
        g.restore();
      }
      x += cw;
    }
    // EKG underline
    const ep = E.inOutCubic(prog(t, 13.6, 14.1));
    if (ep > 0) {
      const xa = 460, xb = lerp(xa, 1460, ep);
      g.beginPath();
      for (let px = xa; px <= xb; px += 4) (px === xa ? g.moveTo : g.lineTo).call(g, px, 640 + ekg(px));
      const bell = Math.exp(-Math.max(0, t - 14.0) * 4) * (t >= 14 ? 1 : 0);
      g.strokeStyle = C.green; g.lineWidth = 4 + bell * 3; glow(g, C.green, 18 + bell * 40); g.stroke();
      g.fillStyle = C.white; g.beginPath(); g.arc(xb, 640 + ekg(xb), 6, 0, TAU); g.fill(); noGlow(g);
    }
    // closing bell ring
    const rp = prog(t, 14.0, 14.9);
    if (rp > 0 && rp < 1) {
      g.strokeStyle = `rgba(255,182,39,${(1 - rp) * 0.7})`; g.lineWidth = 6 * (1 - rp) + 0.5;
      g.beginPath(); g.arc(1160, 490, E.outCubic(rp) * 1200, 0, TAU); g.stroke();
    }
    const sa = E.outExpo(prog(t, 14.1, 14.5));
    text(g, '실시간 트렌드 기록', 960, 760 + (1 - sa) * 30, `700 46px ${F.kr}`, `rgba(243,245,250,${sa})`, 'center', 'alphabetic', 4);
    const ua = prog(t, 14.25, 14.5);
    text(g, 'sulllll.github.io/claude_cloud', 960, 815, `500 28px ${F.mono}`, `rgba(243,245,250,${0.55 * ua})`, 'center', 'alphabetic', 3);
    const ka = prog(t, 14.35, 14.6);
    text(g, 'DESIGNED, ANIMATED & SCORED IN PURE CODE — CANVAS · WEB AUDIO · ZERO ASSETS', 960, 985, `500 17px ${F.mono}`, `rgba(243,245,250,${0.4 * ka})`, 'center', 'alphabetic', 4);
  }

  // ---------------------------------------------------------------- post FX
  const FLASHES = [[1.0, '255,255,255', 0.5, 0.35], [4.5, '255,70,100', 0.75, 0.35], [6.5, '255,255,255', 0.95, 0.3],
    [9.02, '255,255,255', 0.45, 0.22], [11.48, '255,255,255', 0.55, 0.22], [13.5, '255,255,255', 0.85, 0.32], [14.0, '255,210,140', 0.25, 0.4]];
  const SHAKES = [[1.0, 6], [4.5, 38], [6.5, 12], [9.02, 8], [13.5, 12], [14.0, 5]];
  const CHROMA = [[4.5, 28], [6.5, 12], [9.02, 9], [11.48, 10], [13.5, 12]];
  const decay = (list, t, k) => list.reduce((s, [t0, a]) => s + (t >= t0 ? a * Math.exp(-(t - t0) * k) : 0), 0);
  function shakeAt(t) {
    const a = decay(SHAKES, t, 5) + (t > 4.3 && t < 4.5 ? 4 : 0);
    return [a * Math.sin(t * 97 + 1.3) * Math.cos(t * 41), a * Math.sin(t * 83 + 0.2)];
  }
  function chromaAt(t) {
    let c = decay(CHROMA, t, 6);
    if (t > 4.9 && t < 6.3 && hash(Math.floor(t * 20)) > 0.72) c += 14;
    if (t > 11.5 && t < 13.2) c += 2.5;
    return c;
  }
  function slicesAt(t) {
    if (t >= 4.5 && t < 4.78) return 7;
    if (t > 4.9 && t < 6.3 && hash(Math.floor(t * 15) + 7) > 0.8) return 4;
    if (t >= 6.5 && t < 6.58) return 3;
    return 0;
  }
  function overlays(g, t) {
    for (const [t0, col, a, d] of FLASHES) {
      if (t < t0 || t > t0 + d * 2) continue;
      g.fillStyle = `rgba(${col},${a * Math.exp(-((t - t0) / d) * 3)})`; g.fillRect(0, 0, W, H);
    }
    const v = g.createRadialGradient(960, 540, 420, 960, 540, 1150);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // scanlines + grain
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
    if (grain) {
      g.save();
      g.globalAlpha = 0.05; g.globalCompositeOperation = 'screen';
      const ox = Math.floor(hash(Math.floor(t * 30)) * 256), oy = Math.floor(hash(Math.floor(t * 30) + 3) * 256);
      g.translate(-ox, -oy); g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, W + 256, H + 256);
      g.restore();
    }
    const fade = prog(t, 14.7, 15) + (1 - prog(t, 0, 0.06));
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${clamp(fade)})`; g.fillRect(0, 0, W, H); }
  }

  let grain = null;
  const bufs = {};
  function buffer(name, w, h) {
    let b = bufs[name];
    if (!b) { b = document.createElement('canvas'); bufs[name] = b; }
    if (b.width !== w || b.height !== h) { b.width = w; b.height = h; }
    return b;
  }
  function makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(3);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    return c;
  }

  function frame(target, t, data) {
    t = clamp(t, 0, DURATION);
    if (!grain) grain = makeGrain();
    const cw = target.canvas.width, ch = target.canvas.height;
    const s = Math.min(cw / W, ch / H), ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;
    S = s;
    const buf = buffer('main', cw, ch), g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    g.setTransform(s, 0, 0, s, ox, oy);
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    background(g, t);
    s4(g, t); s2(g, t); s1(g, t); s3(g, t); s5(g, t); s6(g, t, data); s7(g, t);
    hud(g, t);
    overlays(g, t);
    g.restore();

    // composite with shake / chromatic split / glitch slices
    const [sx, sy] = shakeAt(t).map(v => v * s);
    const ca = chromaAt(t) * s;
    const m = Math.abs(sx) + Math.abs(sy) + ca + 1;
    const T = target;
    T.setTransform(1, 0, 0, 1, 0, 0);
    T.globalCompositeOperation = 'source-over';
    T.fillStyle = '#000'; T.fillRect(0, 0, cw, ch);
    const draw = (src, dx) => T.drawImage(src, -m + sx + dx, -m + sy, cw + 2 * m, ch + 2 * m);
    if (ca > 0.6) {
      const r = buffer('r', cw, ch), c = buffer('c', cw, ch);
      for (const [b, col] of [[r, '#ff0000'], [c, '#00ffff']]) {
        const x = b.getContext('2d');
        x.globalCompositeOperation = 'source-over'; x.drawImage(buf, 0, 0);
        x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cw, ch);
        x.globalCompositeOperation = 'source-over';
      }
      draw(r, ca); T.globalCompositeOperation = 'lighter'; draw(c, -ca); T.globalCompositeOperation = 'source-over';
    } else draw(buf, 0);
    const n = slicesAt(t);
    for (let i = 0; i < n; i++) {
      const hsh = hash(Math.floor(t * 30) * 13 + i);
      const y = Math.floor(hsh * ch), h = Math.floor((0.02 + hash(i * 7 + Math.floor(t * 30)) * 0.08) * ch);
      const off = (hash(i * 3 + Math.floor(t * 60)) - 0.5) * 160 * s;
      T.drawImage(buf, 0, y, cw, h, off, y, cw, h);
    }
  }

  // ---------------------------------------------------------------- soundtrack (Web Audio synthesis)
  function buildAudio(ac, when, offset) {
    offset = offset || 0;
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ac.destination);
    const sr = ac.sampleRate;
    const noise = ac.createBuffer(1, sr * 2, sr);
    { const d = noise.getChannelData(0), r = rng(11); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    const T = te => when + te - offset;
    const ok = te => te >= offset - 0.002;
    const pan = (node, p) => { if (!ac.createStereoPanner) return node; const s = ac.createStereoPanner(); s.pan.value = p; node.connect(s); return s; };
    const env = (gain, t0, a, peak, d) => {
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    };
    const noiseSrc = (t0, dur) => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t0); s.stop(t0 + dur + 0.05); return s; };

    function kick(te, big) {
      if (!ok(te)) return; const t0 = T(te);
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(big ? 130 : 160, t0); o.frequency.exponentialRampToValueAtTime(big ? 32 : 42, t0 + (big ? 0.4 : 0.13));
      env(g, t0, 0.002, big ? 1.2 : 0.95, big ? 1.4 : 0.34);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 1.6);
      const n = noiseSrc(t0, 0.02), hp = ac.createBiquadFilter(), ng = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2500; env(ng, t0, 0.001, 0.25, 0.015);
      n.connect(hp); hp.connect(ng); ng.connect(master);
    }
    function hat(te, vel, open, p) {
      if (!ok(te)) return; const t0 = T(te);
      const n = noiseSrc(t0, open ? 0.25 : 0.06), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 8000; env(g, t0, 0.001, 0.22 * vel, open ? 0.2 : 0.04);
      n.connect(hp); hp.connect(g); pan(g, p || 0).connect(master);
    }
    function snare(te, vel) {
      if (!ok(te)) return; const t0 = T(te);
      const n = noiseSrc(t0, 0.25), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7; env(g, t0, 0.001, 0.5 * vel, 0.17);
      n.connect(bp); bp.connect(g); g.connect(master);
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(150, t0 + 0.08);
      env(og, t0, 0.001, 0.3 * vel, 0.09); o.connect(og); og.connect(master); o.start(t0); o.stop(t0 + 0.2);
    }
    function bass(te, f, dur) {
      if (!ok(te)) return; const t0 = T(te);
      const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f / 2;
      lp.type = 'lowpass'; lp.Q.value = 7;
      lp.frequency.setValueAtTime(1400, t0); lp.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      env(g, t0, 0.005, 0.32, dur);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
      o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
    }
    function pluck(te, f, vel, p) {
      if (!ok(te)) return; const t0 = T(te);
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t0); lp.frequency.exponentialRampToValueAtTime(500, t0 + 0.14);
      env(g, t0, 0.002, 0.09 * vel, 0.16);
      o.connect(lp); lp.connect(g); pan(g, p).connect(master); o.start(t0); o.stop(t0 + 0.25);
    }
    const padBus = ac.createGain(); padBus.connect(master);
    function pad(te, dur, freqs, level) {
      const start = Math.max(te, offset); if (start >= te + dur) return;
      const t0 = T(start), t1 = T(te + dur);
      const lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 1;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(level || 0.05, t0 + 0.12);
      g.gain.setValueAtTime(level || 0.05, Math.max(t0 + 0.12, t1 - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.25);
      lp.connect(g); g.connect(padBus);
      for (const f of freqs) for (const det of [-8, 8]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t0); o.stop(t1 + 0.3);
      }
    }
    function riser(te, dur, level) {
      const start = Math.max(te, offset); if (start >= te + dur) return;
      const t0 = T(start), t1 = T(te + dur);
      const n = noiseSrc(t0, t1 - t0), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(300 + 8000 * ((start - te) / dur), t0); bp.frequency.exponentialRampToValueAtTime(9000, t1);
      g.gain.setValueAtTime(0.001, t0); g.gain.linearRampToValueAtTime(level, t1); g.gain.linearRampToValueAtTime(0.0001, t1 + 0.03);
      n.connect(bp); bp.connect(g); g.connect(master);
    }
    function whoosh(te, dur, up) {
      if (!ok(te)) return; const t0 = T(te);
      const n = noiseSrc(t0, dur), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(up ? 400 : 4000, t0); bp.frequency.exponentialRampToValueAtTime(up ? 5000 : 300, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.35, t0 + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      n.connect(bp); bp.connect(g); g.connect(master);
    }
    function bell(te, strikes, level) {
      for (let k = 0; k < strikes; k++) {
        const ts = te + k * 0.09; if (!ok(ts)) continue; const t0 = T(ts);
        const lv = level * (k === 0 ? 1 : 0.45);
        [[1, 1], [2.0, 0.5], [2.76, 0.4], [4.07, 0.25], [5.4, 0.18], [6.8, 0.1]].forEach(([r, a]) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'sine'; o.frequency.value = 587 * r;
          env(g, t0, 0.002, lv * a, (k === strikes - 1 ? 2.4 : 0.5) / Math.sqrt(r));
          o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 2.6);
        });
      }
    }
    function tick(te) {
      if (!ok(te)) return; const t0 = T(te);
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 2400;
      env(g, t0, 0.001, 0.12, 0.03); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.06);
    }
    function blip(te, f, dur, level, type) {
      if (!ok(te)) return; const t0 = T(te);
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.value = f;
      env(g, t0, 0.002, level, dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function impact(te) {
      kick(te, true);
      if (!ok(te)) return; const t0 = T(te);
      const n = noiseSrc(t0, 1.4), lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 1.2);
      env(g, t0, 0.002, 0.6, 1.2); n.connect(lp); lp.connect(g); g.connect(master);
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(24, t0 + 1.6);
      env(og, t0, 0.005, 0.9, 1.6); o.connect(og); og.connect(master); o.start(t0); o.stop(t0 + 1.8);
    }

    const N = { A1: 55, C2: 65.41, F1: 43.65, G1: 49, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F3: 174.61, G3: 196, G4: 392 };
    const CH = { Am: [N.A3, N.C4, N.E4], F: [N.F3, N.A3, N.C4], G: [N.G3, N.B3, N.D4], C: [N.C4, N.E4, N.G4] };
    const ROOT = { Am: N.A1, F: N.F1, G: N.G1, C: N.C2 };
    const PROG = [[2, 3, 'Am'], [3, 4, 'F'], [4, 4.5, 'G'], [6.5, 7.5, 'C'], [7.5, 8.5, 'G'], [8.5, 9, 'Am'],
      [9, 10, 'F'], [10, 11, 'C'], [11, 11.5, 'G'], [11.5, 12.5, 'Am'], [12.5, 13, 'F'], [13, 13.5, 'G']];
    const chordAt = t => { for (const [a, b, c] of PROG) if (t >= a && t < b) return c; return 'Am'; };

    // 01 opening: clock ticks, bell, whoosh into the drop
    [0.18, 0.45, 0.72].forEach(tick);
    bell(1.0, 7, 0.16);
    pad(1.0, 1.0, [N.A3, N.E4], 0.03);
    whoosh(1.62, 0.4, true);
    // grooves
    for (let b = 0; b < 30; b++) {
      const bt = b * BEAT;
      if (!kickOn(bt)) continue;
      kick(bt, false);
      if (b % 2 === 1) snare(bt, 0.8);
      hat(bt + BEAT / 2, 1, (b % 4) === 3, 0.25);
      if (bt >= 11.5) { hat(bt + BEAT / 4, 0.55, false, -0.3); hat(bt + BEAT * 3 / 4, 0.55, false, 0.3); }
      const c = chordAt(bt);
      bass(bt + BEAT / 2, ROOT[c], 0.22);
      if (bt >= 9) {
        const arp = CH[c].map(f => f * 2);
        [0, 1, 2, 1].forEach((k, i) => pluck(bt + i * BEAT / 4, arp[k], 0.9, i % 2 ? 0.4 : -0.4));
      }
      if (ok(bt)) { // sidechain pump
        padBus.gain.setValueAtTime(0.3, T(bt)); padBus.gain.linearRampToValueAtTime(1, T(bt) + 0.24);
      }
    }
    for (const [a, b, c] of PROG) pad(a, b - a, CH[c], 0.045);
    // build + drop into the crash
    for (let i = 0; i < 8; i++) snare(4.0 + i * 0.0625, 0.25 + i * 0.09);
    riser(3.4, 1.1, 0.3);
    impact(4.5);
    // glitch stutters during the sell-off
    { const r = rng(21); for (let te = 4.62; te < 5.5; te += 0.0625) if (r() > 0.45) blip(te, 180 + r() * 1800, 0.035, 0.07); }
    blip(4.52, 110, 0.7, 0.15, 'sawtooth');
    // halt alarm
    for (let i = 0, te = 5.55; te < 6.25; te += 0.125, i++) blip(te, i % 2 ? 660 : 880, 0.1, 0.06);
    riser(5.9, 0.6, 0.35);
    impact(6.5);
    whoosh(8.7, 0.35, true);
    kick(9.0, true);
    whoosh(11.2, 0.3, false);
    // keyword fly-bys
    for (let j = 0; j < 9; j++) whoosh(11.55 + j * 0.16 + 0.24, 0.22, j % 2 === 0);
    blip(13.08, 1760, 0.25, 0.05, "triangle"); blip(13.08, 880, 0.35, 0.06, "triangle");
    riser(12.9, 0.6, 0.25);
    // outro
    impact(13.5);
    pad(13.5, 1.5, [N.A3, N.C4, N.E4, 493.88], 0.05);
    bell(14.0, 1, 0.22);
    return master;
  }

  // latest.json snapshot -> reel data
  function dataFrom(snap) {
    if (!snap || !snap.items || !snap.items.length) return null;
    return { keywords: snap.items.map(i => ({ keyword: i.keyword, traffic: i.traffic })), stamp: snap.collected_at };
  }
  const FONTS = ['700 100px "Space Grotesk"', '500 100px "JetBrains Mono"', '700 100px "JetBrains Mono"',
    '500 100px "Noto Sans KR"', '700 100px "Noto Sans KR"', '900 100px "Noto Sans KR"'];
  function loadFonts(timeoutMs) {
    if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
    const all = Promise.all(FONTS.map(f => document.fonts.load(f, '가A1'))).catch(() => {});
    return Promise.race([all, new Promise(r => setTimeout(r, timeoutMs || 2500))]);
  }
  root.Reel = { W, H, DURATION, frame, buildAudio, dataFrom, loadFonts };
})(typeof window !== 'undefined' ? window : globalThis);
