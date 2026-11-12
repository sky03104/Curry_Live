// ============================================================
// 畫面層：排位置、程式動態（彈跳、衝撞、閃白、震動）、名字、血條、排行榜、訊息。
// 這裡不改遊戲規則，只把 game.js 算好的結果「演」出來。
// 角色本體怎麼畫交給 hero-sprite.js。
// ============================================================
window.ML = window.ML || {};

ML.createRenderer = function (canvas, game, config, sprite) {
  const ctx = canvas.getContext('2d');
  const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif';
  const views = new Map();   // 觀眾代號 → 畫面上這隻武將的顯示狀態
  let floats = [];           // 飄起來的字（傷害數字、補血、技能名）
  let rings = [];            // 擴散的圓圈（全場攻擊、技能命中）
  let timers = [];           // 「幾秒後做某事」（讓扣血剛好發生在撞到的那一刻）
  let toasts = [];           // 左下角訊息
  let time = 0, W = 0, H = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const after = (sec, fn) => timers.push({ t: sec, fn });

  function text(str, x, y, size, color, align, bold) {
    ctx.font = `${bold === false ? '' : 'bold '}${size}px ${FONT}`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ---------- 接收遊戲通知，排入動態 ----------
  game.onFx(e => {
    if (e.type === 'notice') {
      toasts.push({ text: e.text, age: 0 });
      if (toasts.length > 4) toasts.shift();
      return;
    }
    if (e.type === 'join') {
      const p = game.getPlayer(e.id);
      views.set(e.id, { id: e.id, x: null, y: null, size: 80, hp: p.hp, shownHp: p.hp, down: false,
        flash: 0, shake: 0, hop: 1, hopH: 1.2, lunge: null, pending: 0, phase: Math.random() * 6 });
      return;
    }
    const v = views.get(e.id);
    if (!v) return;
    if (e.type === 'revive') {
      v.hop = 1; v.hopH = 1.4; v.flash = 1;
      floats.push({ v, text: '復活！', color: '#ffe27a', scale: 1.3, age: 0 });
    } else if (e.type === 'heal') {
      v.hop = 1; v.hopH = 0.5;
      rings.push({ v, age: 0, life: 0.5, color: '#7dffa0', max: 1.2 });
      floats.push({ v, text: '+' + e.amount, color: '#7dffa0', scale: 1, age: 0 });
    } else if (e.type === 'attack') {
      const big = e.action === 'skill';
      let delay;
      if (e.action === 'aoe') {            // 全場攻擊：原地跳起，落地震波
        v.hop = 1; v.hopH = 1.6; delay = 0.3;
        after(delay, () => rings.push({ v, age: 0, life: 0.6, color: '#ffd35c', max: 0 }));
      } else {                              // 普攻／技能：衝過去撞
        const dur = big ? 0.55 : 0.36;
        v.lunge = { to: e.hits[0].id, t: 0, dur };
        delay = dur / 2;
        if (big) floats.push({ v, text: `「${e.skillName}」`, color: '#ffd35c', scale: 1.25, age: 0, life: 1.4 });
      }
      for (const h of e.hits) {
        const tv = views.get(h.id);
        if (!tv) continue;
        tv.pending++;
        after(delay, () => {
          tv.pending--;
          tv.hp -= h.dmg;
          if (h.down) tv.down = true;
          tv.flash = 1; tv.shake = big ? 1.8 : 1;
          if (big) rings.push({ v: tv, age: 0, life: 0.4, color: '#ff6b5c', max: 1.6 });
          floats.push({ v: tv, text: '-' + h.dmg, color: big ? '#ffb13c' : '#ff5c4d', scale: big ? 1.5 : 1, age: 0 });
        });
      }
    }
  });

  // ---------- 排位置 ----------
  function layout() {
    const list = game.getPlayers();
    const n = list.length;
    const wide = W >= H;
    const lbW = wide ? clamp(W * 0.26, 260, 340) : W - 32;
    const lbRows = Math.max(1, game.getLeaderboard().length);
    const lbH = 50 + lbRows * 32;
    const lb = { x: W - lbW - 16, y: 16, w: lbW, h: lbH };
    const arena = wide ? { x: 16, y: 16, w: W - lbW - 48, h: H - 32 }
                       : { x: 16, y: lbH + 32, w: W - 32, h: H - lbH - 48 - 100 };   // 直式：底下留 100 給訊息
    if (n) {
      // 試每一種「一排幾隻」，挑角色能畫最大的那種
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cw = arena.w / cols, ch = arena.h / rows;
        const size = Math.min(cw * 0.6, ch * 0.5, 190);   // 留空間給名字、血條、腳下兩行字
        if (!best || size > best.size) best = { cols, rows, cw, ch, size };
      }
      const size = Math.max(36, best.size);
      list.forEach((p, i) => {
        const v = views.get(p.id);
        if (!v) return;
        const row = Math.floor(i / best.cols), col = i % best.cols;
        const inRow = row === best.rows - 1 ? n - row * best.cols : best.cols;
        const tx = arena.x + arena.w / 2 + (col - (inRow - 1) / 2) * best.cw;
        const ty = arena.y + (row + 0.5) * best.ch + 8;
        if (v.x === null) { v.x = tx; v.y = ty; v.size = size; }
        v.tx = tx; v.ty = ty; v.tsize = size;
      });
    }
    return { lb, arena };
  }

  // ---------- 每一格：更新 ----------
  function update(dt) {
    time += dt;
    const due = timers.filter(t => (t.t -= dt) <= 0);
    timers = timers.filter(t => t.t > 0);
    due.forEach(t => t.fn());

    for (const [id, v] of views) {
      const p = game.getPlayer(id);
      if (!p) { views.delete(id); continue; }
      if (v.pending === 0) { v.hp = p.hp; v.down = p.down; }   // 沒有演到一半的攻擊時，跟規則層對齊
      const k = Math.min(1, dt * 8);
      v.shownHp += (v.hp - v.shownHp) * Math.min(1, dt * 12);
      if (v.tx !== undefined) { v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.size += (v.tsize - v.size) * k; }
      v.flash = Math.max(0, v.flash - dt * 4);
      v.shake = Math.max(0, v.shake - dt * 4);
      v.hop = Math.max(0, v.hop - dt * 2.2);
      if (v.lunge && (v.lunge.t += dt) >= v.lunge.dur) v.lunge = null;
    }
    floats.forEach(f => f.age += dt); floats = floats.filter(f => f.age < (f.life || 1) && views.has(f.v.id));
    rings.forEach(r => r.age += dt); rings = rings.filter(r => r.age < r.life);
    toasts.forEach(t => t.age += dt); toasts = toasts.filter(t => t.age < 5);
  }

  // 這隻武將此刻畫在哪（待機位置 + 各種動態造成的位移）
  function pos(v) {
    let x = v.x, y = v.y;
    if (!v.down) y += Math.sin(time * 2.4 + v.phase) * v.size * 0.03;           // 待機輕輕浮動
    if (v.hop > 0) y -= Math.sin(Math.PI * (1 - v.hop)) * v.size * 0.5 * v.hopH; // 彈跳
    if (v.lunge) {                                                              // 衝撞（去了再回來）
      const t = views.get(v.lunge.to);
      if (t) { const s = Math.sin(Math.PI * v.lunge.t / v.lunge.dur) * 0.6; x += (t.x - v.x) * s; y += (t.y - v.y) * s; }
    }
    if (v.shake > 0) { x += (Math.random() - 0.5) * v.shake * v.size * 0.2; y += (Math.random() - 0.5) * v.shake * v.size * 0.1; }
    return { x, y };
  }

  function drawHero(v) {
    const p = game.getPlayer(v.id);
    const { x, y } = pos(v);
    const size = v.size, r = size / 2, fs = clamp(size * 0.2, 12, 22);
    const pose = v.down ? 'down' : v.lunge ? 'attack' : v.flash > 0 ? 'hit' : 'idle';
    sprite.draw(ctx, p.hero, x, y, size, { pose, poseTime: v.lunge ? v.lunge.t : time, flash: v.flash });

    // 血條
    const bw = Math.max(54, size * 0.95), bh = Math.max(7, size * 0.09);
    const bx = x - bw / 2, by = y - r - size * 0.05 - bh - 6;   // 全身圖比 size 高一點，血條跟著往上
    const ratio = clamp(v.shownHp / p.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = ratio > 0.5 ? '#58d26a' : ratio > 0.25 ? '#f0c23c' : '#ee5544';
    ctx.fillRect(bx, by, bw * ratio, bh);

    // 觀眾名字（血條上方）、武將名（腳下）
    text(short(p.name, 8), x, by - fs * 0.75, fs, v.down ? '#bbb' : '#fff');
    const fac = config.factions[p.hero.faction] || { label: '', color: '#888' };
    text(`${fac.label}・${p.hero.displayName}`, x, y + r + fs * 0.85, fs * 0.8, fac.color);

    // 最下面一行：倒地倒數 或 鎖定對象
    const ly = y + r + fs * 1.85;
    if (v.down) {
      const wait = Math.ceil(game.reviveRemaining(p));
      if (wait > 0) text(`倒地 ${wait} 秒後可復活`, x, ly, fs * 0.78, '#ffb0a6');
      else if (Math.sin(time * 6) > -0.3) text('送禮復活！', x, ly, fs * 0.9, '#ffe27a');
    } else if (p.lockId && game.getPlayer(p.lockId)) {
      text(`鎖定▶${short(game.getPlayer(p.lockId).name, 7)}`, x, ly, fs * 0.72, '#ffd35c');
    }
  }

  function drawLeaderboard(lb) {
    const rows = game.getLeaderboard();
    ctx.fillStyle = 'rgba(22,26,30,0.78)';
    ctx.beginPath(); ctx.roundRect(lb.x, lb.y, lb.w, lb.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    text('傷害排行榜', lb.x + lb.w / 2, lb.y + 24, 20, '#ffd35c');
    if (!rows.length) text('還沒有人造成傷害', lb.x + lb.w / 2, lb.y + 62, 14, '#aaa', 'center', false);
    rows.forEach((s, i) => {
      const y = lb.y + 62 + i * 32;
      text(String(i + 1), lb.x + 22, y, 18, ['#ffd35c', '#dcdcdc', '#d99a6c'][i] || '#fff');
      text(short(s.name, 7), lb.x + 42, y, 16, '#fff', 'left');
      text(s.heroName, lb.x + lb.w * 0.58, y, 13, '#b8c4cc', 'left', false);
      text(String(s.damage), lb.x + lb.w - 14, y, 17, '#ff8a7a', 'right');
    });
  }

  // ---------- 每一格：畫 ----------
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    W = cw; H = ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);   // 清成透明
    if (!W || !H) return;

    const { lb, arena } = layout();

    // 正在衝撞的畫在最上面，其餘照前後位置
    [...views.values()].filter(v => v.x !== null)
      .sort((a, b) => (a.lunge ? 1 : 0) - (b.lunge ? 1 : 0) || a.y - b.y).forEach(drawHero);

    for (const r of rings) {
      if (!views.has(r.v.id)) continue;
      const k = r.age / r.life;
      const radius = (r.max ? r.v.size * r.max : Math.hypot(W, H) * 0.5) * k;
      ctx.beginPath(); ctx.arc(r.v.x, r.v.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = r.max ? 5 : 10;
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const f of floats) {
      const life = f.life || 1, k = f.age / life;
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      const pop = 1 + Math.max(0, 0.15 - f.age) * 3;   // 剛出現時放大一下
      text(f.text, f.v.x, f.v.y - f.v.size * 0.35 - k * f.v.size * 0.7,
        clamp(f.v.size * 0.3, 18, 40) * f.scale * pop, f.color);
      ctx.globalAlpha = 1;
    }

    drawLeaderboard(lb);

    // 訊息：橫式放在排行榜下方，直式放在畫面最底下（都不會蓋到武將）
    const wide = W >= H;
    toasts.forEach((t, i) => {
      ctx.globalAlpha = t.age > 4 ? 5 - t.age : 1;
      if (wide) text(t.text, lb.x + 4, lb.y + lb.h + 22 + i * 24, 14, '#fff', 'left');
      else text(t.text, 20, H - 16 - (toasts.length - 1 - i) * 24, 15, '#fff', 'left');
      ctx.globalAlpha = 1;
    });

    if (!views.size) text('留言武將名字上場，例如「呂布」', arena.x + arena.w / 2, arena.y + arena.h / 2, 26, '#fff');
  }

  return {
    frame(dt) { update(dt); draw(); },
    reset() { views.clear(); floats = []; rings = []; timers = []; toasts = []; },
  };
};
