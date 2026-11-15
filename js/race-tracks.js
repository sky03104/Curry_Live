// 賽跑的跑道：10 種形狀＋各自的外觀（路面顏色、邊線、內場的裝飾）。
// 這裡只管「跑道長什麼樣、選手沿著它怎麼跑」：
//   ML.buildRaceTrack(...)   算出這一格要用的跑道（形狀、路程表、內場空地），同樣的尺寸會直接用快取
//   ML.raceTrackPoint(...)   某個路程比例（0～1）、某一道，站在哪個位置、面向哪個方向
//   ML.drawRaceTrack(...)    把跑道畫出來
// 誰贏、每段要不要休息這些規則在 game.js，這裡完全不碰。
// 加新跑道：在下面的 TRACKS 加一組（id、形狀 f 或 poly、theme），再把 id 與名字加進 js/config.js 的 race.tracks。
window.ML = window.ML || {};
(function () {
  const N = 360;                       // 一圈取幾個點
  const TAU = Math.PI * 2;
  const ang = u => Math.PI / 2 - TAU * u;   // u 從 0 到 1：由底部中央出發、逆時針（先往右）繞一圈
  const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

  // ---------- 形狀：每種跑道一個函式（座標 -1～1，y 往下），最後會自動撐滿整個場地 ----------
  const TRACKS = [
    { id: 'oval', f: u => { const a = ang(u); return [Math.cos(a), Math.sin(a)]; },
      theme: { surface: 'rgba(204,134,76,0.78)', infield: 'rgba(70,150,86,0.34)', edge: 'white', deco: 'none' } },
    { id: 'kart', f: u => { const a = ang(u); return [spow(Math.cos(a), 0.5), spow(Math.sin(a), 0.5)]; },
      theme: { surface: 'rgba(66,72,82,0.9)', infield: 'rgba(60,130,70,0.45)', edge: 'curb', lane: 'rgba(255,255,255,0.3)', deco: 'stripes' } },
    { id: 'eight', keepStart: true, f: u => { const a = Math.PI / 4 + TAU * u; return [Math.cos(a), Math.sin(2 * a)]; },
      theme: { surface: 'rgba(222,180,110,0.88)', infield: 'rgba(240,214,150,0.5)', edge: 'white', edgeColor: '#fff6dc', deco: 'dunes' } },
    { id: 'flower', f: u => { const a = ang(u), r = 1 + 0.2 * Math.cos(6 * (a - Math.PI / 2)); return [r * Math.cos(a), r * Math.sin(a)]; },
      theme: { surface: 'rgba(244,178,200,0.88)', infield: 'rgba(150,210,140,0.5)', edge: 'white', deco: 'flowers' } },
    { id: 'triangle', poly: [[0, -1], [1, 0.85], [-1, 0.85]], round: 3,
      theme: { surface: 'rgba(170,215,240,0.88)', infield: 'rgba(235,247,255,0.55)', edge: 'neon', edgeColor: '#ffffff', glow: '#6fe3ff', deco: 'snow' } },
    { id: 'dumbbell', f: u => { const a = ang(u), x = Math.cos(a); return [x, Math.sin(a) * (0.5 + 0.5 * x * x)]; },
      theme: { surface: 'rgba(72,44,40,0.93)', infield: 'rgba(40,22,20,0.62)', edge: 'neon', edgeColor: '#ffb066', glow: '#ff6a1f', deco: 'lava' } },
    { id: 'wave', f: u => { const a = ang(u), x = Math.cos(a); return [x, Math.sin(a) * 0.82 + 0.2 * Math.sin(3 * Math.PI * x)]; },
      theme: { surface: 'rgba(176,128,76,0.92)', infield: 'rgba(40,120,190,0.55)', edge: 'white', ticks: 'rgba(60,38,18,0.35)', deco: 'waves' } },
    { id: 'star', poly: (() => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.52 : 1; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; })(), round: 2,
      theme: { surface: 'rgba(40,36,100,0.92)', infield: 'rgba(14,12,48,0.66)', edge: 'neon', edgeColor: '#bffcf2', glow: '#4defd6', deco: 'stars' } },
    { id: 'heart', smooth: 6, f: u => { const t = TAU * u; return [16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; },
      theme: { surface: 'rgba(255,160,190,0.9)', infield: 'rgba(255,225,235,0.58)', edge: 'white', deco: 'hearts' } },
    { id: 'lshape', poly: [[-1, -1], [0.15, -1], [0.15, 0.1], [1, 0.1], [1, 1], [-1, 1]], round: 3,
      theme: { surface: 'rgba(58,62,70,0.92)', infield: 'rgba(110,120,135,0.5)', edge: 'white', center: 'rgba(255,214,60,0.85)', deco: 'city' } },
    // ---------- 障礙賽專用的 10 種賽道（id 都以 h_ 開頭；清單在 config.race.hurdleTracks）----------
    { id: 'h_jungle', lowStart: true, f: u => { const a = ang(u); return [Math.cos(a) + 0.14 * Math.sin(3 * a), 0.9 * Math.sin(a) + 0.12 * Math.cos(4 * a)]; },
      theme: { surface: 'rgba(150,108,56,0.9)', infield: 'rgba(40,110,50,0.55)', edge: 'white', edgeColor: '#d8f0b0', deco: 'emoji', emojis: ['🌴', '🌿', '🦜', '🍃'] } },
    { id: 'h_canyon', poly: [[-1, -1], [0.3, -1], [0.3, -0.2], [1, -0.2], [1, 1], [-0.3, 1], [-0.3, 0.2], [-1, 0.2]], round: 2,
      theme: { surface: 'rgba(204,120,72,0.92)', infield: 'rgba(160,84,50,0.55)', edge: 'white', edgeColor: '#ffe2c0', deco: 'emoji', emojis: ['🌵', '🪨', '🦂'] } },
    { id: 'h_snow', poly: [[-1, 0.9], [-0.55, 0], [-0.25, 0.3], [0.15, -1], [0.6, 0.15], [1, 0.9]], round: 2,
      theme: { surface: 'rgba(214,232,248,0.94)', infield: 'rgba(120,160,205,0.5)', edge: 'neon', edgeColor: '#ffffff', glow: '#8fd8ff', deco: 'emoji', emojis: ['❄️', '⛄', '🏔️'] } },
    { id: 'h_castle', poly: [[-0.36, -1], [0.36, -1], [0.36, -0.36], [1, -0.36], [1, 0.36], [0.36, 0.36], [0.36, 1], [-0.36, 1], [-0.36, 0.36], [-1, 0.36], [-1, -0.36], [-0.36, -0.36]], round: 2,
      theme: { surface: 'rgba(120,124,136,0.94)', infield: 'rgba(70,72,86,0.6)', edge: 'curb', ticks: 'rgba(30,30,40,0.35)', deco: 'emoji', emojis: ['🏰', '🛡️', '⚔️'] } },
    { id: 'h_candy', f: u => { const a = ang(u), r = 1 + 0.075 * Math.tanh(4 * Math.sin(10 * a)); return [r * Math.cos(a), r * Math.sin(a)]; },
      theme: { surface: 'rgba(255,170,205,0.92)', infield: 'rgba(255,238,200,0.6)', edge: 'curb', lane: 'rgba(255,255,255,0.45)', deco: 'emoji', emojis: ['🍭', '🍬', '🧁', '🍩'] } },
    { id: 'h_space', f: u => { const a = ang(u), r = 1 + 0.13 * Math.sin(3 * a + 1) + 0.08 * Math.sin(5 * a + 2); return [r * Math.cos(a), r * Math.sin(a)]; },
      theme: { surface: 'rgba(62,54,110,0.94)', infield: 'rgba(16,12,40,0.7)', edge: 'neon', edgeColor: '#ffd9a0', glow: '#ff9a3c', deco: 'emoji', emojis: ['☄️', '🪐', '⭐', '🛸'] } },
    { id: 'h_volcano', f: u => { const a = ang(u), x = Math.cos(a); let y = Math.sin(a); if (y < 0) y += 0.5 * (1 - x * x) * -y * 2.2 * 0.5; return [x, y]; },
      theme: { surface: 'rgba(96,36,28,0.95)', infield: 'rgba(50,16,12,0.65)', edge: 'neon', edgeColor: '#ff9a5a', glow: '#ff5a1f', deco: 'emoji', emojis: ['🌋', '🔥', '💥'] } },
    { id: 'h_river', f: u => { const a = ang(u), x = Math.cos(a); return [x, 0.5 * Math.sin(3 * x) + 0.42 * Math.sin(a)]; },
      theme: { surface: 'rgba(70,170,230,0.92)', infield: 'rgba(210,240,255,0.55)', edge: 'white', lane: 'rgba(255,255,255,0.5)', deco: 'emoji', emojis: ['🫧', '💦', '🐟', '🦆'] } },
    { id: 'h_terrace', poly: [[-1, 1], [1, 1], [1, 0.3], [0.4, 0.3], [0.4, -0.3], [-0.2, -0.3], [-0.2, -1], [-1, -1]], round: 2,
      theme: { surface: 'rgba(196,164,96,0.94)', infield: 'rgba(110,170,80,0.55)', edge: 'white', edgeColor: '#fff3c4', deco: 'emoji', emojis: ['🌾', '🌱', '🐝'] } },
    { id: 'h_circus', poly: (() => { const p = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; p.push([Math.cos(a), Math.sin(a)]); } return p; })(), round: 1,
      theme: { surface: 'rgba(170,70,200,0.92)', infield: 'rgba(255,224,120,0.55)', edge: 'curb', deco: 'emoji', emojis: ['🎈', '🎪', '🤡', '🎠'] } },
  ];
  const BY_ID = {}; TRACKS.forEach(t => { BY_ID[t.id] = t; });
  ML.raceTrackIds = TRACKS.map(t => t.id);

  // ---------- 形狀的前處理（只做一次）----------
  function chaikin(p, it) {   // 多邊形磨圓：每個角切掉一點，重複幾次就變圓角
    for (let k = 0; k < it; k++) {
      const q = [];
      for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
      p = q;
    }
    return p;
  }
  function resample(p, n) {   // 照路程平均取 n 個點
    const cum = [0]; for (let i = 1; i <= p.length; i++) { const a = p[i - 1], b = p[i % p.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const total = cum[p.length], out = []; let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i / n * total; while (j < p.length - 1 && cum[j + 1] <= s) j++;
      const a = p[j], b = p[(j + 1) % p.length], t = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  }
  const baseCache = {};
  function baseOf(id) {
    if (baseCache[id]) return baseCache[id];
    const d = BY_ID[id] || BY_ID.oval;
    let p;
    if (d.poly) p = chaikin(d.poly.map(v => v.slice()), d.round || 0);
    else { p = []; for (let i = 0; i < 720; i++) p.push(d.f(i / 720)); }
    p = resample(p, N);
    if (d.smooth) { const s = d.smooth, q = p.map(() => [0, 0]); for (let i = 0; i < N; i++) { let x = 0, y = 0; for (let k = -s; k <= s; k++) { const c = p[(i + k + N) % N]; x += c[0]; y += c[1]; } q[i] = [x / (2 * s + 1), y / (2 * s + 1)]; } p = q; }
    // 撐滿 -1～1
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const v of p) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    p = p.map(v => [(v[0] - (x0 + x1) / 2) / ((x1 - x0) / 2), (v[1] - (y0 + y1) / 2) / ((y1 - y0) / 2)]);
    // 方向：一律「底部往右、逆時針」（跟橢圓一樣）；反了就倒過來
    let A = 0; for (let i = 0; i < N; i++) { const a = p[i], b = p[(i + 1) % N]; A += a[0] * b[1] - b[0] * a[1]; }
    if (A > 0) p.reverse();
    // 起跑點：挑「比較低、比較靠中間、這一段是平順直線」的地方，把起點轉到那裡
    const tan = i => { const a = p[(i - 2 + N) % N], b = p[(i + 2) % N]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    let best = -1, bestScore = -1e9;
    for (let i = 0; i < N; i++) {
      const a = tan(i), flat = Math.abs(Math.sin(a)) < 0.3;
      let dA = Math.abs(tan((i + 8) % N) - tan((i - 8 + N) % N)); if (dA > Math.PI) dA = TAU - dA;
      if (!flat || dA > 0.5) continue;
      const score = p[i][1] - 0.15 * Math.abs(p[i][0]);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (d.lowStart) { best = 0; for (let i = 1; i < N; i++) if (p[i][1] - 0.15 * Math.abs(p[i][0]) > p[best][1] - 0.15 * Math.abs(p[best][0])) best = i; }   // 形狀太彎、找不到平順的直線時：直接用最低的點當起點
    if (best < 0) for (let i = 0; i < N; i++) if (p[i][1] > bestScore) { bestScore = p[i][1]; best = i; }
    if (!d.keepStart) p = p.slice(best).concat(p.slice(0, best));
    return (baseCache[id] = p);
  }

  // ---------- 這一格要用的跑道（尺寸不變就用快取）----------
  const buildCache = {};
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  // 內場空地：在跑道圍起來的範圍裡，找最大的一塊長方形（沒參賽的武將站這裡），跟跑道（含寬度）保持距離
  function findInfield(pts, band, bb) {
    const m = band / 2 + 8; let best = null;
    for (let gx = 0; gx <= 12; gx++) for (let gy = 0; gy <= 8; gy++) {
      const cx = bb.x0 + (bb.x1 - bb.x0) * (0.1 + 0.8 * gx / 12), cy = bb.y0 + (bb.y1 - bb.y0) * (0.1 + 0.8 * gy / 8);
      if (!inside(pts, cx, cy)) continue;
      for (const asp of [1, 2, 3, 4]) {
        const ok = hw => { const hh = hw / asp; for (let i = 0; i < pts.length; i += 2) { const p = pts[i]; if (p.x > cx - hw - m && p.x < cx + hw + m && p.y > cy - hh - m && p.y < cy + hh + m) return false; } return true; };
        let lo = 0, hi = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
        for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
        const area = lo * lo / asp;
        if (!best || area > best.area) best = { area, x0: cx - lo, x1: cx + lo, y0: cy - lo / asp, y1: cy + lo / asp };
      }
    }
    return best || { area: 0, x0: (bb.x0 + bb.x1) / 2, x1: (bb.x0 + bb.x1) / 2, y0: (bb.y0 + bb.y1) / 2, y1: (bb.y0 + bb.y1) / 2 };
  }
  ML.buildRaceTrack = function (id, cx, cy, rx, ry, band, laneGap, n) {
    if (!BY_ID[id]) id = 'oval';
    const key = [id, Math.round(cx), Math.round(cy), Math.round(rx), Math.round(ry), Math.round(band), Math.round(laneGap * 10), n].join('|');
    if (buildCache.key === key) return buildCache.val;
    const base = baseOf(id), pts = base.map(v => ({ x: cx + v[0] * rx, y: cy + v[1] * ry }));
    const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[N - 1] + Math.hypot(pts[0].x - pts[N - 1].x, pts[0].y - pts[N - 1].y);
    for (let i = 0; i < N; i++) {   // 方向與外側法線（外側＝逆時針前進方向的右手邊，跟橢圓「半徑往外」同一邊）
      const a = pts[(i - 3 + N) % N], b = pts[(i + 3) % N], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      pts[i].tx = (b.x - a.x) / d; pts[i].ty = (b.y - a.y) / d; pts[i].nx = -pts[i].ty; pts[i].ny = pts[i].tx;
    }
    const bb = { x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry };
    const T = { id, theme: BY_ID[id].theme, pts, cum, total, band, laneGap, n, cx, cy, rx, ry, bb, infield: findInfield(pts, band, bb) };
    // 內場裝飾的位置（固定亂數，每次畫都一樣）
    const R = rng(Array.from(id).reduce((a, c) => a * 31 + c.charCodeAt(0), 7)), deco = [];
    for (let i = 0; i < 90; i++) deco.push({ x: bb.x0 + R() * (bb.x1 - bb.x0), y: bb.y0 + R() * (bb.y1 - bb.y0), r: R(), k: Math.floor(R() * 4) });
    T.deco = deco;
    buildCache.key = key; buildCache.val = T;
    return T;
  };
  // 路程比例 → 位置（off＝離中線多遠，往外為正）
  ML.raceTrackPoint = function (T, frac, off) {
    const f = ((frac % 1) + 1) % 1, s = f * T.total, cum = T.cum;
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = T.pts[lo], b = T.pts[(lo + 1) % N], end = lo === N - 1 ? T.total : cum[lo + 1], t = Math.min(1, Math.max(0, (s - cum[lo]) / Math.max(1e-6, end - cum[lo])));
    const tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t, d = Math.hypot(tx, ty) || 1, ux = tx / d, uy = ty / d;
    return { x: a.x + (b.x - a.x) * t - uy * off, y: a.y + (b.y - a.y) * t + ux * off, tx: ux, ty: uy };
  };

  // ---------- 畫跑道 ----------
  function paintTrack(ctx, T, segs) {
    const th = T.theme, P = T.pts, band = T.band;
    const trace = (off) => { ctx.beginPath(); for (let i = 0; i < N; i++) { const p = P[i], x = p.x + p.nx * off, y = p.y + p.ny * off; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); };
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    // 內場：底色＋裝飾（裝飾只畫在跑道圍起來的範圍裡）
    trace(0); ctx.fillStyle = th.infield; ctx.fill();
    ctx.save(); trace(0); ctx.clip();
    const sc = Math.max(0.6, Math.min(1.6, Math.min(T.rx, T.ry) / 110));   // 場地大小不同，裝飾也跟著放大縮小
    const D = T.deco;
    if (th.deco === 'stripes') { ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 14 * sc; for (let k = -10; k < 40; k++) { const x = T.bb.x0 + k * 30 * sc; ctx.beginPath(); ctx.moveTo(x, T.bb.y0); ctx.lineTo(x + (T.bb.y1 - T.bb.y0) * 0.6, T.bb.y1); ctx.stroke(); } }
    else if (th.deco === 'dunes') { ctx.strokeStyle = 'rgba(150,100,40,0.4)'; ctx.lineWidth = 2; for (const d of D) { ctx.beginPath(); ctx.arc(d.x, d.y, (8 + d.r * 16) * sc, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
    else if (th.deco === 'flowers') { const pal = ['#ff7aa8', '#ffffff', '#ffd35c', '#c79bff']; for (const d of D) { ctx.fillStyle = pal[d.k]; ctx.beginPath(); ctx.arc(d.x, d.y, (3 + d.r * 3) * sc, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(d.x, d.y, 1.3 * sc, 0, TAU); ctx.fill(); } }
    else if (th.deco === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of D) { ctx.beginPath(); ctx.arc(d.x, d.y, (1.4 + d.r * 2.4) * sc, 0, TAU); ctx.fill(); } }
    else if (th.deco === 'lava') { ctx.strokeStyle = 'rgba(255,120,40,0.75)'; ctx.lineWidth = 2 * sc; ctx.lineJoin = 'miter'; for (let i = 0; i < D.length; i += 2) { const d = D[i], e = D[i + 1]; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + (e.r - 0.5) * 40 * sc, d.y + 10 * sc); ctx.lineTo(d.x + (e.r - 0.5) * 22 * sc, d.y + 22 * sc); ctx.lineTo(d.x + (d.r - 0.5) * 50 * sc, d.y + 36 * sc); ctx.stroke(); } ctx.lineJoin = 'round'; }
    else if (th.deco === 'waves') { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2 * sc; for (const d of D) { const w = (7 + d.r * 7) * sc; ctx.beginPath(); ctx.moveTo(d.x - w, d.y); ctx.quadraticCurveTo(d.x - w / 2, d.y - w / 2, d.x, d.y); ctx.quadraticCurveTo(d.x + w / 2, d.y + w / 2, d.x + w, d.y); ctx.stroke(); } }
    else if (th.deco === 'stars') { for (const d of D) { ctx.fillStyle = `rgba(255,255,255,${0.45 + d.r * 0.5})`; const r = (0.8 + d.r * 1.8) * sc; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, TAU); ctx.fill(); if (d.k === 0) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x - r * 3, d.y); ctx.lineTo(d.x + r * 3, d.y); ctx.moveTo(d.x, d.y - r * 3); ctx.lineTo(d.x, d.y + r * 3); ctx.stroke(); } } }
    else if (th.deco === 'emoji') { const em = th.emojis || ['⭐']; ctx.globalAlpha = 0.6; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 0; i < D.length; i += 2) { const d = D[i]; ctx.font = `${Math.round((13 + d.r * 14) * sc)}px sans-serif`; ctx.fillText(em[d.k % em.length], d.x, d.y); } ctx.globalAlpha = 1; }
    else if (th.deco === 'hearts') { ctx.globalAlpha = 0.6; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; for (let i = 0; i < D.length; i += 2) { const d = D[i]; ctx.font = `${Math.round((12 + d.r * 12) * sc)}px sans-serif`; ctx.fillText(d.k % 2 ? '💗' : '💕', d.x, d.y); } ctx.globalAlpha = 1; }
    else if (th.deco === 'city') { for (let i = 0; i < D.length; i += 2) { const d = D[i], w = (14 + d.r * 22) * sc, h = (14 + D[i + 1].r * 22) * sc; ctx.fillStyle = 'rgba(70,80,100,0.55)'; ctx.fillRect(d.x - w / 2, d.y - h / 2, w, h); ctx.fillStyle = 'rgba(255,230,140,0.7)'; ctx.fillRect(d.x - w / 2 + 2, d.y - h / 2 + 2, Math.max(2, w / 4), Math.max(2, h / 5)); } }
    ctx.restore();
    // 路面：先畫比路面寬一點的邊線色，把中間挖空，再鋪路面——這樣邊線永遠貼著路面外緣，轉彎很急的地方也不會有線打結
    const ew = band + 10;
    ctx.save(); trace(0);
    if (th.edge === 'curb') { ctx.lineWidth = ew; ctx.strokeStyle = '#d93a2f'; ctx.setLineDash([14, 14]); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineDashOffset = 14; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
    else if (th.edge === 'neon') { ctx.shadowColor = th.glow; ctx.shadowBlur = 16; ctx.lineWidth = ew; ctx.strokeStyle = th.edgeColor || '#fff'; ctx.stroke(); }
    else { ctx.lineWidth = ew; ctx.strokeStyle = th.edgeColor || 'rgba(255,255,255,0.92)'; ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; trace(0); ctx.lineWidth = band + 4; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
    trace(0); ctx.strokeStyle = th.surface; ctx.lineWidth = band + 4; ctx.stroke();
    if (th.ticks) {   // 木棧道的接縫
      ctx.strokeStyle = th.ticks; ctx.lineWidth = 2;
      const step = Math.max(10, band * 0.9); let acc = 0;
      for (let i = 0; i < N; i += 1) { acc += T.total / N; if (acc < step) continue; acc = 0; const p = P[i]; ctx.beginPath(); ctx.moveTo(p.x - p.nx * band / 2, p.y - p.ny * band / 2); ctx.lineTo(p.x + p.nx * band / 2, p.y + p.ny * band / 2); ctx.stroke(); }
    }
    // 分道線；城市街道另有黃色中線
    ctx.strokeStyle = th.lane || 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 10]);
    for (let i = 1; i < Math.min(8, T.n); i++) { trace((i - 0.5 - (T.n - 1) / 2) * T.laneGap); ctx.stroke(); }
    if (th.center) { ctx.strokeStyle = th.center; ctx.lineWidth = 3; ctx.setLineDash([16, 14]); trace(0); ctx.stroke(); }
    ctx.setLineDash([]);
    // 每一小段的記號：到這裡會擲骰決定要不要休息
    for (let i = 1; i < segs; i++) { const p = ML.raceTrackPoint(T, i / segs, 0); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill(); }
    // 起跑／終點線（黑白格，橫跨整個跑道寬度）
    const s = P[0], cell = Math.max(6, band / 6), cols = Math.ceil(band / cell);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.ty, s.tx));
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(-cell + j * cell, -band / 2 + i * cell, cell, Math.min(cell, band / 2 - (-band / 2 + i * cell))); }
    ctx.restore();
    ctx.restore();
  }
  // 跑道畫在一張離螢幕的圖上（尺寸不變就不重畫），每格只貼上去；「起跑線」字樣每格直接畫（要用 render 的字型函式）
  ML.drawRaceTrack = function (ctx, T, text, segs) {
    const cv = ctx.canvas, tf = ctx.getTransform(), key = [cv.width, cv.height, tf.a.toFixed(3), tf.d.toFixed(3), T.id, T.cx, T.cy, T.rx, T.ry, T.band, T.n, segs].join('|');
    if (!T.layer || T.layer.key !== key) {
      const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
      const x2 = c2.getContext('2d'); x2.setTransform(tf.a, 0, 0, tf.d, 0, 0);
      paintTrack(x2, T, segs); T.layer = { key, cv: c2 };
    }
    ctx.drawImage(T.layer.cv, 0, 0, cv.width / tf.a, cv.height / tf.d);
    const s = T.pts[0];
    text('起跑線', s.x + s.nx * (T.band / 2 + 14), s.y + s.ny * (T.band / 2 + 14), 14, '#fff');
  };
})();
