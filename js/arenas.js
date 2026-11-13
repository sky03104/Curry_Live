// ============================================================
// 場地層：武將腳下的「地面」。全部用程式畫、不用圖檔。
// 預設「全場透明」（什麼都不畫，OBS 直接疊在直播畫面上）；選了別的場地，就在武將走動的範圍鋪一張地面。
//
// 怎麼加新場地：在下面 DRAWERS 加一個函式（g=畫布, w/h=場地寬高, rnd=固定亂數），再到 LIST 加一筆名稱。
// 圖只在「尺寸或場地改變」時重畫一次、存起來，之後每一幀只是貼上去，不會拖慢畫面。
// ============================================================
window.ML = window.ML || {};

ML.createArenas = function () {
  // 固定亂數：同一個場地每次畫出來長一樣（不會每次重畫就變樣）
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const R = (rnd, a, b) => a + rnd() * (b - a);

  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  function star(g, cx, cy, r, fill) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = fill; g.fill();
  }

  // ---------- 籃球場 ----------
  function court(g, w, h, rnd) {
    g.fillStyle = '#dfa862'; g.fillRect(0, 0, w, h);
    for (let x = 0, i = 0; x < w; x += 26, i++) {            // 木地板的條紋
      g.fillStyle = `rgba(${i % 2 ? '120,70,20' : '255,235,190'},${R(rnd, 0.04, 0.12)})`; g.fillRect(x, 0, 26, h);
      g.fillStyle = 'rgba(90,50,10,0.22)'; g.fillRect(x, 0, 1.2, h);
    }
    const m = Math.min(w, h) * 0.05, L = m, Rr = w - m, T = m, B = h - m, cy = h / 2;
    const keyW = w * 0.17, keyH = h * 0.4, lineW = Math.max(3, h * 0.012);
    g.fillStyle = 'rgba(200,70,50,0.55)';                       // 兩邊的油漆區
    g.fillRect(L, cy - keyH / 2, keyW, keyH); g.fillRect(Rr - keyW, cy - keyH / 2, keyW, keyH);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = lineW; g.lineJoin = 'round';
    g.strokeRect(L, T, Rr - L, B - T);                           // 邊線
    g.beginPath(); g.moveTo(w / 2, T); g.lineTo(w / 2, B); g.stroke();   // 中線
    g.beginPath(); g.arc(w / 2, cy, h * 0.15, 0, Math.PI * 2); g.stroke();   // 中圈
    g.strokeRect(L, cy - keyH / 2, keyW, keyH); g.strokeRect(Rr - keyW, cy - keyH / 2, keyW, keyH);
    g.beginPath(); g.arc(L + keyW, cy, keyH * 0.32, -Math.PI / 2, Math.PI / 2); g.stroke();                 // 罰球圈
    g.beginPath(); g.arc(Rr - keyW, cy, keyH * 0.32, Math.PI / 2, Math.PI * 1.5); g.stroke();
    const bxL = L + w * 0.045, bxR = Rr - w * 0.045, r3 = h * 0.4;
    g.beginPath(); g.arc(bxL, cy, r3, -1.18, 1.18); g.stroke();                                              // 三分線
    g.beginPath(); g.arc(bxR, cy, r3, Math.PI - 1.18, Math.PI + 1.18); g.stroke();
    for (const [bx, dir] of [[bxL, -1], [bxR, 1]]) {            // 籃板＋籃框
      g.fillStyle = '#fff'; g.fillRect(bx + dir * 10 - 2, cy - h * 0.06, 4, h * 0.12);
      g.beginPath(); g.arc(bx - dir * 2, cy, h * 0.022, 0, Math.PI * 2); g.strokeStyle = '#ff7a2f'; g.lineWidth = lineW * 0.9; g.stroke();
    }
    g.fillStyle = 'rgba(80,40,0,0.08)'; g.fillRect(0, 0, w, h);
  }

  // ---------- 擂台 ----------
  function ring(g, w, h) {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#23283a'], [1, '#14161f']]); g.fillRect(0, 0, w, h);   // 台下的暗處
    const mx = w * 0.04, my = h * 0.07, mw = w - mx * 2, mh = h - my * 2;
    g.fillStyle = 'rgba(0,0,0,0.45)'; rrect(g, mx + 4, my + 8, mw, mh, 14); g.fill();               // 台子的陰影
    g.fillStyle = lin(g, 0, my, 0, my + mh, [[0, '#e9eef8'], [1, '#c6d2ea']]); rrect(g, mx, my, mw, mh, 12); g.fill();   // 白色擂台布
    g.fillStyle = 'rgba(210,60,60,0.16)'; g.beginPath(); g.arc(w / 2, h / 2, Math.min(mw, mh) * 0.34, 0, Math.PI * 2); g.fill();   // 中間紅圈
    g.strokeStyle = 'rgba(210,60,60,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, Math.min(mw, mh) * 0.34, 0, Math.PI * 2); g.stroke();
    star(g, w / 2, h / 2, Math.min(mw, mh) * 0.12, 'rgba(210,60,60,0.35)');
    g.strokeStyle = 'rgba(30,60,140,0.35)'; g.lineWidth = 4; rrect(g, mx + 14, my + 14, mw - 28, mh - 28, 8); g.stroke();   // 台面藍框
    const colors = ['#ef4444', '#ffffff', '#3b82f6'];             // 三條繩子
    colors.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 5; g.globalAlpha = 0.95; rrect(g, mx - i * 7, my - i * 9, mw + i * 14, mh + i * 14, 12); g.stroke(); });
    g.globalAlpha = 1;
    for (const [px, py] of [[mx, my], [mx + mw, my], [mx, my + mh], [mx + mw, my + mh]]) {   // 四個角柱
      g.fillStyle = '#8a1f1f'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(px - 4, py - 4, 4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = rad(g, w / 2, h * 0.45, 0, Math.max(w, h) * 0.6, [[0, 'rgba(255,255,230,0.28)'], [1, 'rgba(0,0,0,0.35)']]); g.fillRect(0, 0, w, h);   // 聚光燈
  }

  // ---------- 戰場 ----------
  function battlefield(g, w, h, rnd) {
    g.fillStyle = lin(g, 0, 0, 0, h * 0.2, [[0, '#f2b36b'], [1, '#c98a52']]); g.fillRect(0, 0, w, h * 0.22);   // 黃昏天空
    g.fillStyle = '#7a5a45'; g.beginPath(); g.moveTo(0, h * 0.2);                                                // 遠山
    for (let x = 0; x <= w + 40; x += 40) g.lineTo(x, h * 0.2 - R(rnd, 4, h * 0.07)); g.lineTo(w, h * 0.22); g.lineTo(0, h * 0.22); g.fill();
    g.fillStyle = lin(g, 0, h * 0.2, 0, h, [[0, '#8a7448'], [0.5, '#6b5636'], [1, '#4d3c25']]); g.fillRect(0, h * 0.2, w, h * 0.8);   // 泥土地
    for (let i = 0; i < w * h / 1800; i++) {                       // 泥土的深淺斑塊
      g.fillStyle = rnd() > 0.5 ? 'rgba(40,25,10,0.13)' : 'rgba(255,225,170,0.08)';
      g.beginPath(); g.ellipse(R(rnd, 0, w), R(rnd, h * 0.22, h), R(rnd, 8, 40), R(rnd, 4, 16), 0, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 4; i++) {                                   // 彈坑
      const cx = R(rnd, w * 0.1, w * 0.9), cy = R(rnd, h * 0.45, h * 0.95), rx = R(rnd, 26, 56);
      g.fillStyle = 'rgba(30,18,6,0.4)'; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,225,170,0.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy - 2, rx, rx * 0.4, 0, Math.PI, Math.PI * 2); g.stroke();
    }
    g.strokeStyle = 'rgba(30,18,6,0.5)'; g.lineWidth = 2; g.lineJoin = 'round';                              // 裂縫
    for (let i = 0; i < 7; i++) {
      let x = R(rnd, 0, w), y = R(rnd, h * 0.3, h); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += R(rnd, -26, 30); y += R(rnd, -14, 18); g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 38; i++) {                                  // 石頭與草叢
      const x = R(rnd, 0, w), y = R(rnd, h * 0.25, h);
      if (rnd() > 0.4) { g.fillStyle = `rgba(${90 + R(rnd, 0, 40)},${85 + R(rnd, 0, 30)},${75 + R(rnd, 0, 30)},0.9)`; g.beginPath(); g.ellipse(x, y, R(rnd, 3, 9), R(rnd, 2, 5), 0, 0, Math.PI * 2); g.fill(); }
      else { g.strokeStyle = '#6f8f3c'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 3, y); g.lineTo(x + k * 5, y - R(rnd, 6, 12)); g.stroke(); } }
    }
    const flags = ['#4A7FA5', '#5C9C89', '#C0872E', '#A5527E'];    // 插在地上的四色戰旗（魏蜀吳群）
    for (let i = 0; i < 4; i++) {
      const x = w * (0.12 + i * 0.25), y = h * 0.2, ph = Math.min(60, h * 0.16);
      g.strokeStyle = '#3d2b18'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x, y - ph); g.stroke();
      g.fillStyle = flags[i]; g.beginPath(); g.moveTo(x, y - ph); g.lineTo(x + 34, y - ph + 8); g.lineTo(x + 28, y - ph + 16); g.lineTo(x + 34, y - ph + 24); g.lineTo(x, y - ph + 22); g.closePath(); g.fill();
    }
    g.fillStyle = lin(g, 0, h * 0.7, 0, h, [[0, 'rgba(60,40,25,0)'], [1, 'rgba(60,40,25,0.4)']]); g.fillRect(0, h * 0.7, w, h * 0.3);
  }

  // ---------- 海灘 ----------
  function beach(g, w, h, rnd) {
    const sea = h * 0.24;
    g.fillStyle = lin(g, 0, 0, 0, sea, [[0, '#2fb2d9'], [1, '#86e0ee']]); g.fillRect(0, 0, w, sea);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
    for (let r = 0; r < 3; r++) { g.beginPath(); for (let x = 0; x <= w; x += 6) { const y = sea * (0.25 + r * 0.25) + Math.sin(x / 26 + r * 2) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    g.fillStyle = lin(g, 0, sea, 0, h, [[0, '#d8c58f'], [0.12, '#f4e2ac'], [1, '#e7c77c']]); g.fillRect(0, sea, w, h - sea);      // 沙
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(0, sea);                                                        // 浪花
    for (let x = 0; x <= w; x += 8) g.lineTo(x, sea + 6 + Math.sin(x / 18) * 5 + Math.sin(x / 7) * 2); g.lineTo(w, sea - 4); g.lineTo(0, sea - 4); g.fill();
    for (let i = 0; i < w * h / 500; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(140,100,40,0.25)' : 'rgba(255,255,255,0.35)'; g.fillRect(R(rnd, 0, w), R(rnd, sea + 10, h), 2, 2); }   // 沙粒
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,205,190,0.95)'; g.beginPath(); g.ellipse(R(rnd, 0, w), R(rnd, sea + 20, h), R(rnd, 4, 8), R(rnd, 3, 6), R(rnd, 0, 3), 0, Math.PI * 2); g.fill(); }   // 貝殼
    for (let i = 0; i < 4; i++) star(g, R(rnd, w * 0.05, w * 0.95), R(rnd, sea + 30, h * 0.95), R(rnd, 7, 11), '#ff8a3d');                    // 海星
    const ux = w * 0.9, uy = sea + (h - sea) * 0.35;                                                                                // 陽傘
    g.strokeStyle = '#7a5a35'; g.lineWidth = 4; g.beginPath(); g.moveTo(ux, uy + 4); g.lineTo(ux, uy - 52); g.stroke();
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#ef4444'; g.beginPath(); g.moveTo(ux, uy - 56); g.arc(ux, uy - 52, 46, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); g.closePath(); g.fill(); }
  }

  // ---------- 雪地 ----------
  function snow(g, w, h, rnd) {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#cfe8f7'], [0.25, '#eef7fd'], [1, '#ffffff']]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {                                  // 後排松樹
      const x = R(rnd, 0, w), base = h * R(rnd, 0.14, 0.26), th = R(rnd, 34, 62);
      g.fillStyle = '#7a5a40'; g.fillRect(x - 3, base - 4, 6, 8);
      for (let k = 0; k < 3; k++) {
        const y = base - k * th * 0.28, ww = th * (0.5 - k * 0.1);
        g.fillStyle = '#2f6b57'; g.beginPath(); g.moveTo(x, y - th * 0.42); g.lineTo(x + ww, y); g.lineTo(x - ww, y); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - th * 0.42); g.lineTo(x + ww * 0.55, y - th * 0.15); g.lineTo(x - ww * 0.55, y - th * 0.15); g.closePath(); g.fill();
      }
    }
    for (let i = 0; i < 14; i++) {                                  // 雪堆
      const x = R(rnd, 0, w), y = R(rnd, h * 0.3, h), rx = R(rnd, 30, 80);
      g.fillStyle = 'rgba(160,200,225,0.35)'; g.beginPath(); g.ellipse(x, y + 4, rx, rx * 0.22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.2, 0, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(150,215,240,0.5)'; g.beginPath(); g.ellipse(R(rnd, w * 0.1, w * 0.9), R(rnd, h * 0.5, h * 0.95), R(rnd, 26, 50), R(rnd, 8, 14), 0, 0, Math.PI * 2); g.fill(); }   // 冰面
    for (let i = 0; i < w * h / 900; i++) { g.fillStyle = `rgba(255,255,255,${R(rnd, 0.6, 1)})`; g.beginPath(); g.arc(R(rnd, 0, w), R(rnd, 0, h), R(rnd, 1, 2.6), 0, Math.PI * 2); g.fill(); }   // 雪花
  }

  // ---------- 夜市 ----------
  function night(g, w, h, rnd) {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#1a1330'], [1, '#2e2044']]); g.fillRect(0, 0, w, h);
    const tile = 46;                                               // 石板地
    for (let y = h * 0.2, row = 0; y < h; y += tile * 0.6, row++) for (let x = (row % 2) * tile / 2; x < w; x += tile) {
      g.strokeStyle = 'rgba(255,230,190,0.07)'; g.lineWidth = 1.5; g.strokeRect(x, y, tile, tile * 0.6);
    }
    const sx = 6; const stallW = (w - sx * 2) / Math.ceil(w / 120);  // 上方一排攤位遮陽棚（紅白條紋）
    for (let x = sx; x < w - 10; x += stallW) {
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#fff4e0' : '#e0453b'; g.fillRect(x + k * stallW / 6, h * 0.02, stallW / 6, h * 0.07); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, h * 0.09, stallW - 2, h * 0.06);
    }
    const n = Math.max(4, Math.round(w / 110)), ly = h * 0.17;       // 燈籠串
    g.strokeStyle = '#d6b36a'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 40; i++) { const x = w * i / 40; i ? g.lineTo(x, ly + Math.sin(i / 40 * Math.PI * n) * 5) : g.moveTo(x, ly); } g.stroke();
    for (let i = 0; i < n * 2; i++) {
      const x = w * (i + 0.5) / (n * 2), y = ly + 14 + (i % 2) * 6;
      g.fillStyle = rad(g, x, y + 16, 0, 90, [[0, 'rgba(255,170,70,0.5)'], [1, 'rgba(255,170,70,0)']]); g.fillRect(x - 90, y - 70, 180, 190);   // 燈籠下面的光暈
      g.fillStyle = i % 3 ? '#ef4444' : '#f59e0b'; g.beginPath(); g.ellipse(x, y, 9, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - 3, y - 4, 2.5, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d6b36a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x, y + 20); g.stroke();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,220,150,${R(rnd, 0.2, 0.6)})`; g.fillRect(R(rnd, 0, w), R(rnd, h * 0.25, h), 2, 2); }
  }

  // ---------- 太空 ----------
  function space(g, w, h, rnd) {
    g.fillStyle = lin(g, 0, 0, w, h, [[0, '#070b24'], [0.55, '#1d1450'], [1, '#2c1b5e']]); g.fillRect(0, 0, w, h);
    for (const [c, x, y, r] of [['rgba(180,90,255,0.3)', 0.2, 0.3, 0.45], ['rgba(40,200,220,0.22)', 0.8, 0.7, 0.5], ['rgba(255,100,170,0.2)', 0.55, 0.12, 0.35]]) {
      g.fillStyle = rad(g, w * x, h * y, 0, Math.max(w, h) * r, [[0, c], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h);     // 星雲
    }
    for (let i = 0; i < w * h / 450; i++) { g.fillStyle = `rgba(255,255,255,${R(rnd, 0.25, 1)})`; g.beginPath(); g.arc(R(rnd, 0, w), R(rnd, 0, h), R(rnd, 0.5, 1.8), 0, Math.PI * 2); g.fill(); }   // 星星
    const px = w * 0.86, py = h * 0.2, pr = Math.min(w, h) * 0.11;                                                              // 有光環的星球
    g.strokeStyle = 'rgba(255,220,170,0.55)'; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.5, -0.3, Math.PI, Math.PI * 2); g.stroke();
    g.fillStyle = rad(g, px - pr * 0.3, py - pr * 0.3, pr * 0.1, pr, [[0, '#ffd8a0'], [1, '#c9703a']]); g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,170,0.85)'; g.lineWidth = 5; g.beginPath(); g.ellipse(px, py, pr * 1.8, pr * 0.5, -0.3, 0, Math.PI); g.stroke();
    g.fillStyle = '#cfd6e6'; g.beginPath(); g.arc(w * 0.1, h * 0.14, pr * 0.28, 0, Math.PI * 2); g.fill();                         // 小月亮
    g.fillStyle = 'rgba(120,130,160,0.5)'; g.beginPath(); g.arc(w * 0.1 - 4, h * 0.14 - 3, pr * 0.07, 0, Math.PI * 2); g.fill();
    const top = h * 0.32;                                                                                                       // 下面是發光的金屬平台
    g.fillStyle = 'rgba(20,24,56,0.78)'; g.fillRect(0, top, w, h - top);
    g.strokeStyle = 'rgba(80,230,240,0.28)'; g.lineWidth = 1.5;
    for (let y = top; y <= h; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x <= w; x += 56) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(80,230,240,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, top); g.lineTo(w, top); g.stroke();
  }

  // ---------- 沙漠 ----------
  function desert(g, w, h, rnd) {
    const sky = h * 0.26;
    g.fillStyle = lin(g, 0, 0, 0, sky, [[0, '#f7c978'], [1, '#fbe6b0']]); g.fillRect(0, 0, w, sky);
    g.fillStyle = rad(g, w * 0.78, sky * 0.55, 0, sky * 1.1, [[0, 'rgba(255,250,215,1)'], [0.35, 'rgba(255,236,170,0.9)'], [1, 'rgba(255,220,140,0)']]); g.fillRect(0, 0, w, sky + 10);   // 大太陽
    for (const [px, pw] of [[w * 0.18, 70], [w * 0.3, 46]]) {                      // 遠處金字塔
      const py = sky + 2; g.fillStyle = '#d9a864'; g.beginPath(); g.moveTo(px - pw, py); g.lineTo(px, py - pw * 0.8); g.lineTo(px + pw, py); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,70,20,0.25)'; g.beginPath(); g.moveTo(px, py - pw * 0.8); g.lineTo(px + pw, py); g.lineTo(px + pw * 0.3, py); g.closePath(); g.fill();
    }
    g.fillStyle = lin(g, 0, sky, 0, h, [[0, '#ecc27a'], [0.5, '#e2ad62'], [1, '#c98f48']]); g.fillRect(0, sky, w, h - sky);   // 沙地
    for (let i = 0; i < 6; i++) {                                                  // 沙丘（亮面＋暗面）
      const cx = R(rnd, 0, w), cy = R(rnd, sky + 20, h), rx = R(rnd, 90, 220), ry = rx * 0.14;
      g.fillStyle = 'rgba(120,70,20,0.16)'; g.beginPath(); g.ellipse(cx + rx * 0.15, cy + ry * 0.4, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,235,185,0.3)'; g.beginPath(); g.ellipse(cx - rx * 0.1, cy - ry * 0.2, rx * 0.8, ry * 0.7, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(130,80,25,0.2)'; g.lineWidth = 1.5;                       // 風吹出的沙紋
    for (let i = 0; i < w * h / 4500; i++) { const x = R(rnd, 0, w), y = R(rnd, sky + 14, h), l = R(rnd, 30, 80); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 5, x + l, y); g.stroke(); }
    for (let i = 0; i < 5; i++) {                                                  // 仙人掌
      const x = R(rnd, w * 0.03, w * 0.97), y = R(rnd, sky + 40, h * 0.97), ch = R(rnd, 26, 44);
      g.fillStyle = 'rgba(100,60,20,0.25)'; g.beginPath(); g.ellipse(x, y + 2, 12, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4f9a58'; rrect(g, x - 5, y - ch, 10, ch, 5); g.fill();
      rrect(g, x - 17, y - ch * 0.65, 8, ch * 0.4, 4); g.fill(); rrect(g, x - 17, y - ch * 0.35, 14, 7, 3); g.fill();
      rrect(g, x + 9, y - ch * 0.8, 8, ch * 0.4, 4); g.fill(); rrect(g, x + 3, y - ch * 0.5, 14, 7, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 2, y - ch + 4, 2, ch - 8);
    }
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${130 + R(rnd, 0, 30)},${95 + R(rnd, 0, 20)},${60 + R(rnd, 0, 20)},0.95)`; g.beginPath(); g.ellipse(R(rnd, 0, w), R(rnd, sky + 20, h), R(rnd, 4, 11), R(rnd, 3, 6), 0, 0, Math.PI * 2); g.fill(); }   // 小石頭
    g.fillStyle = rad(g, w / 2, h * 0.5, Math.min(w, h) * 0.3, Math.max(w, h) * 0.7, [[0, 'rgba(255,200,120,0)'], [1, 'rgba(150,80,20,0.25)']]); g.fillRect(0, 0, w, h);   // 四周微微壓暗
  }

  // ---------- 火山 ----------
  function volcano(g, w, h, rnd) {
    const top = h * 0.34;
    g.fillStyle = lin(g, 0, 0, 0, top, [[0, '#2a0f16'], [0.6, '#7a2a16'], [1, '#d4581f']]); g.fillRect(0, 0, w, top + 4);   // 火紅的天
    const vx = w * 0.72, vb = top + 4, vh = top * 0.95, vw = Math.min(w * 0.22, 260);                                // 火山
    g.fillStyle = '#3a2420'; g.beginPath(); g.moveTo(vx - vw, vb); g.lineTo(vx - vw * 0.16, vb - vh); g.lineTo(vx + vw * 0.16, vb - vh); g.lineTo(vx + vw, vb); g.closePath(); g.fill();
    g.fillStyle = rad(g, vx, vb - vh, 0, vw * 0.35, [[0, 'rgba(255,220,120,0.95)'], [0.4, 'rgba(255,120,30,0.7)'], [1, 'rgba(255,80,0,0)']]); g.fillRect(vx - vw, vb - vh - vw * 0.5, vw * 2, vw);   // 火山口的光
    g.strokeStyle = '#ff7a22'; g.lineWidth = 4; g.lineJoin = 'round';
    for (const o of [-0.08, 0.06]) { g.beginPath(); g.moveTo(vx + vw * o, vb - vh + 2); g.quadraticCurveTo(vx + vw * (o * 3), vb - vh * 0.5, vx + vw * (o * 6), vb); g.stroke(); }   // 岩漿流
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(60,40,40,${0.5 - i * 0.07})`; g.beginPath(); g.ellipse(vx + i * 14 - 20, vb - vh - 16 - i * 20, 22 + i * 10, 14 + i * 5, 0, 0, Math.PI * 2); g.fill(); }   // 濃煙
    g.fillStyle = lin(g, 0, top, 0, h, [[0, '#4a3434'], [0.5, '#392828'], [1, '#2a1c1c']]); g.fillRect(0, top, w, h - top);    // 黑色岩地
    for (let i = 0; i < w * h / 2200; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,170,120,0.06)'; g.beginPath(); g.ellipse(R(rnd, 0, w), R(rnd, top, h), R(rnd, 8, 36), R(rnd, 3, 12), 0, 0, Math.PI * 2); g.fill(); }
    const river = (pts, wd) => {                                                    // 岩漿河（外暈＋橘＋亮芯）
      for (const [lw, col] of [[wd * 2.4, 'rgba(255,90,20,0.22)'], [wd, '#e8480f'], [wd * 0.45, '#ffb43a'], [wd * 0.16, '#fff1b0']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      }
    };
    for (let r = 0; r < 3; r++) {
      let x = R(rnd, 0, w * 0.3) + r * w * 0.3, y = top + 6; const pts = [[x, y]];
      while (y < h + 10) { x += R(rnd, -40, 40); y += R(rnd, 22, 40); pts.push([x, y]); }
      river(pts, R(rnd, 5, 8));
    }
    g.strokeStyle = 'rgba(255,120,40,0.55)'; g.lineWidth = 1.6;                      // 岩縫裡透出的光
    for (let i = 0; i < 9; i++) { let x = R(rnd, 0, w), y = R(rnd, top + 10, h); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += R(rnd, -16, 18); y += R(rnd, -8, 12); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,${150 + R(rnd, 0, 90) | 0},60,${R(rnd, 0.4, 1)})`; g.beginPath(); g.arc(R(rnd, 0, w), R(rnd, 0, h), R(rnd, 0.8, 2.2), 0, Math.PI * 2); g.fill(); }   // 飄起來的火星
    g.fillStyle = lin(g, 0, h * 0.6, 0, h, [[0, 'rgba(255,80,20,0)'], [1, 'rgba(255,80,20,0.18)']]); g.fillRect(0, h * 0.6, w, h * 0.4);
  }

  const LIST = [
    { key: 'none', label: '全場透明（預設）', draw: null },
    { key: 'court', label: '籃球場', draw: court },
    { key: 'ring', label: '擂台', draw: ring },
    { key: 'battlefield', label: '戰場', draw: battlefield },
    { key: 'beach', label: '海灘', draw: beach },
    { key: 'snow', label: '雪地', draw: snow },
    { key: 'night', label: '夜市', draw: night },
    { key: 'space', label: '太空', draw: space },
    { key: 'desert', label: '沙漠', draw: desert },
    { key: 'volcano', label: '火山', draw: volcano },
  ];

  let current = 'none', cache = null, cacheKey = '';
  const find = key => LIST.find(a => a.key === key);

  return {
    list: LIST.map(a => ({ key: a.key, label: a.label })),
    get: () => current,
    isDark: () => current === 'night' || current === 'space' || current === 'volcano',   // 深色場地：陣營文字要調亮才看得到
    set(key) { current = find(key) ? key : 'none'; cacheKey = ''; return current; },
    // 在 rect（武將走動的範圍）鋪上場地。scale 是目前畫布的縮放倍率，圖按這個倍率存，貼上去才不會糊。
    draw(ctx, rect, scale) {
      const a = find(current);
      if (!a || !a.draw || rect.w < 40 || rect.h < 40) return;
      const sc = Math.max(0.5, scale || 1), w = Math.round(rect.w), h = Math.round(rect.h);
      const key = `${current}|${w}|${h}|${sc.toFixed(2)}`;
      if (key !== cacheKey) {
        cache = cache || document.createElement('canvas');
        cache.width = Math.max(1, Math.round(w * sc)); cache.height = Math.max(1, Math.round(h * sc));
        const g = cache.getContext('2d');
        g.setTransform(sc, 0, 0, sc, 0, 0); g.clearRect(0, 0, w, h);
        g.save(); rrect(g, 0, 0, w, h, 18); g.clip();
        a.draw(g, w, h, seeded(20261113 + current.length * 977));
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; rrect(g, 1.5, 1.5, w - 3, h - 3, 17); g.stroke();
        cacheKey = key;
      }
      ctx.drawImage(cache, rect.x, rect.y, rect.w, rect.h);
    },
  };
};
