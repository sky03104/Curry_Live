// ============================================================
// 畫面層：排位置、程式動態（彈跳、衝撞、閃白、震動）、名字、血條、排行榜、訊息。
// 這裡不改遊戲規則，只把 game.js 算好的結果「演」出來。
// 角色本體怎麼畫交給 hero-sprite.js。
// ============================================================
window.ML = window.ML || {};

ML.createRenderer = function (canvas, game, config, sprite, effects) {
  const ctx = canvas.getContext('2d');
  const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif';
  const views = new Map();   // 觀眾代號 → 畫面上這隻武將的顯示狀態
  let floats = [];           // 飄起來的字（傷害數字、補血、技能名）
  let rings = [];            // 擴散的圓圈（全場攻擊、技能命中）
  let timers = [];           // 「幾秒後做某事」（讓扣血剛好發生在撞到的那一刻）
  let toasts = [];           // 左下角訊息
  let time = 0, W = 0, H = 0;
  let dim = null;            // 技能發動時畫面短暫變暗
  let bounds = null;         // 武將可以走動的範圍
  let quake = 0;             // 整個畫面震動的強度（重擊時）

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
  // 把陣營色調亮，當特效的顏色
  function bright(hex) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => Math.round(c + (255 - c) * 0.3).toString(16).padStart(2, '0')).join('');
  }
  const feet = v => v.y + v.size / 2;

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
        flash: 0, shake: 0, hop: 1, hopH: 1.2, lunge: null, pending: 0, kbx: 0, kby: 0, face: -1, faceShown: -1, phase: Math.random() * 6 });
      return;
    }
    const v = views.get(e.id);
    if (!v) return;
    if (e.type === 'revive') {
      v.hop = 1; v.hopH = 1.4; v.flash = 1;
      effects.pillar(v.x, feet(v), v.size * 0.9, v.size * 2.2, '#ffe27a');
      effects.rise(v.x, v.y, '#ffe27a', 22, v.size * 0.4);
      floats.push({ v, text: '復活！', color: '#ffe27a', scale: 1.3, age: 0 });
    } else if (e.type === 'heal') {
      v.hop = 1; v.hopH = 0.5;
      effects.rise(v.x, v.y + v.size * 0.2, '#7dffa0', 20, v.size * 0.4);
      rings.push({ v, age: 0, life: 0.5, color: '#7dffa0', max: 1.2 });
      floats.push({ v, text: '+' + e.amount, color: '#7dffa0', scale: 1, age: 0 });
    } else if (e.type === 'attack') {
      const hero = game.getPlayer(e.id).hero;
      const color = bright((config.factions[hero.faction] || { color: '#cccccc' }).color);
      const big = e.action === 'skill';
      const tv0 = views.get(e.hits[0].id);
      let delay;       // 幾秒後「打中」
      let onHit;       // 打中那一刻，在每個被打的人身上放的特效
      v.hold = 1.4; v.goal = null;   // 出招期間站定不走動
      if (tv0 && e.action !== 'aoe' && tv0.x !== v.x) v.face = Math.sign(tv0.x - v.x);   // 轉身面向對手

      if (e.action === 'aoe') {
        // 全場攻擊：原地跳起，落地震波
        v.hop = 1; v.hopH = 1.6; delay = 0.3;
        after(delay, () => {
          rings.push({ v, age: 0, life: 0.6, color: '#ffd35c', max: 0 });
          effects.crack(v.x, feet(v), v.size * 0.9, '#ffd35c');
          effects.sparks(v.x, feet(v), '#ffd35c', 24, 420, 5, 0.6);
          quake = 0.7;
        });
        onHit = tv => effects.sparks(tv.x, tv.y, '#ffd35c', 10, 300, 4);
      } else if (!big) {
        // 普攻：衝過去砍一刀
        v.lunge = { to: e.hits[0].id, t: 0, dur: 0.36 };
        delay = 0.18;
        onHit = tv => {
          effects.slash(tv.x, tv.y, Math.atan2(tv.y - v.y, tv.x - v.x), tv.size * 0.55, color);
          effects.sparks(tv.x, tv.y, '#ffe9a8', 12, 380, 4);
        };
      } else {
        // 技能：先集氣（畫面變暗、光點往身上收、跳出技能名），再依兵種演出
        const charge = 0.5;
        const style = (config.troops[hero.troop] || {}).skillFx || 'slam';
        dim = { age: 0, life: charge + 0.7 };
        v.shake = 0.5;
        effects.converge(v.x, v.y, color, v.size * 1.1, charge);
        floats.push({ v, text: `「${e.skillName}」`, color: '#ffd35c', scale: 1.25, age: 0, life: 1.5 });
        if (!tv0) return;

        if (style === 'slam') {            // 猛將：衝過去重擊，地面裂開
          after(charge, () => { v.lunge = { to: tv0.id, t: 0, dur: 0.5 }; });
          delay = charge + 0.25;
          onHit = tv => {
            effects.slash(tv.x, tv.y, Math.atan2(tv.y - v.y, tv.x - v.x), tv.size * 0.8, color);
            effects.crack(tv.x, feet(tv), tv.size * 1.1, color);
            effects.sparks(tv.x, tv.y, color, 30, 560, 6, 0.7);
            quake = 1;
          };
        } else if (style === 'magic') {    // 謀士：對手腳下出現法陣，然後落雷
          after(charge, () => { v.hop = 1; v.hopH = 0.5; effects.circle(tv0.x, feet(tv0), tv0.size * 0.8, color, 0.9); });
          delay = charge + 0.45;
          onHit = tv => {
            effects.bolt(tv.x, tv.y, Math.max(tv.y + 20, tv.size * 3), color, Math.max(3, tv.size * 0.04));
            effects.sparks(tv.x, tv.y, color, 24, 460, 5, 0.6);
            quake = 0.6;
          };
        } else if (style === 'ranged') {   // 遊俠：射出光彈
          after(charge, () => { v.hop = 1; v.hopH = 0.35; effects.orb(v.x, v.y, tv0.x, tv0.y, v.size * 0.22, color, 0.28); });
          delay = charge + 0.28;
          onHit = tv => {
            effects.sparks(tv.x, tv.y, color, 30, 520, 5, 0.6);
            rings.push({ v: tv, age: 0, life: 0.35, color, max: 1.3 });
          };
        } else {                            // 統帥：自身光環爆發，對手被光柱擊中
          after(charge, () => {
            v.hop = 1; v.hopH = 0.6;
            rings.push({ v, age: 0, life: 0.5, color, max: 2.4 });
            effects.sparks(v.x, v.y, color, 22, 420, 5, 0.6, 0);
          });
          delay = charge + 0.3;
          onHit = tv => {
            effects.pillar(tv.x, feet(tv), tv.size * 1.1, tv.size * 2.2, color);
            effects.sparks(tv.x, feet(tv), color, 22, 420, 5, 0.6);
            quake = 0.6;
          };
        }
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
          // 被打的人往「遠離攻擊者」的方向退一下
          const dx = tv.x - v.x, dy = tv.y - v.y, d = Math.hypot(dx, dy) || 1;
          const push = tv.size * (big ? 0.45 : 0.22);
          tv.kbx = dx / d * push; tv.kby = dy / d * push;
          effects.sparks(tv.x, tv.y, '#ffffff', 6, 260, 3);   // 碎光
          onHit(tv);
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
    const wander = config.wander && config.wander.enabled;
    if (n) {
      // 試每一種「一排幾隻」，挑角色能畫最大的那種
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cw = arena.w / cols, ch = arena.h / rows;
        const size = Math.min(cw * 0.6, ch * 0.5, 190) * (wander ? 0.85 : 1);   // 留空間給名字、血條、腳下兩行字；會走動時再小一點才有路可走
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
        v.tsize = size;
        if (!wander) { v.tx = tx; v.ty = ty; }   // 不走動：固定站在格子上
      });
      // 可走動範圍：四邊往內縮，確保名字、血條、腳下的字不會跑出畫面
      bounds = { x0: arena.x + size * 0.6, x1: arena.x + arena.w - size * 0.6,
                 y0: arena.y + size * 0.65 + 50, y1: arena.y + arena.h - size * 0.5 - 56 };
    }
    return { lb, arena };
  }

  // ---------- 每一格：更新 ----------
  function update(dt) {
    time += dt;
    const due = timers.filter(t => (t.t -= dt) <= 0);
    timers = timers.filter(t => t.t > 0);
    due.forEach(t => t.fn());
    effects.update(dt);
    quake = Math.max(0, quake - dt * 3);
    if (dim && (dim.age += dt) >= dim.life) dim = null;

    for (const [id, v] of views) {
      const p = game.getPlayer(id);
      if (!p) { views.delete(id); continue; }
      if (v.pending === 0) { v.hp = p.hp; v.down = p.down; }   // 沒有演到一半的攻擊時，跟規則層對齊
      const k = Math.min(1, dt * 8);
      v.shownHp += (v.hp - v.shownHp) * Math.min(1, dt * 12);
      if (v.tsize) v.size += (v.tsize - v.size) * k;
      if (v.tx !== undefined) { v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; }
      v.hold = Math.max(0, (v.hold || 0) - dt);
      v.faceShown += clamp(v.face - v.faceShown, -dt * 12, dt * 12);   // 轉身不是瞬間翻面，而是很快地轉過去
      v.flash = Math.max(0, v.flash - dt * 4);
      v.shake = Math.max(0, v.shake - dt * 4);
      v.hop = Math.max(0, v.hop - dt * 2.2);
      const kd = Math.max(0, 1 - dt * 7); v.kbx *= kd; v.kby *= kd;   // 擊退慢慢彈回原位
      if (v.lunge && (v.lunge.t += dt) >= v.lunge.dur) v.lunge = null;
    }
    if (config.wander && config.wander.enabled && bounds) roam(dt);
    floats.forEach(f => f.age += dt); floats = floats.filter(f => f.age < (f.life || 1) && views.has(f.v.id));
    rings.forEach(r => r.age += dt); rings = rings.filter(r => r.age < r.life);
    toasts.forEach(t => t.age += dt); toasts = toasts.filter(t => t.age < 5);
  }

  // 待機時在場上隨意走動：走到一個隨機地點 → 停一下 → 再挑下一個地點
  // 兩隻武將「隔多開」的算法：左右隔一個身寬即可，上下要隔更開（因為頭上有名字血條、腳下有字）。
  // 回傳值小於 1 代表太近、會互相擋到。
  function gap(ax, ay, bx, by, size) {
    return Math.hypot((bx - ax) / (size * 1.05), (by - ay) / (size * 1.2 + 62));
  }
  function roam(dt) {
    const cfg = config.wander, b = bounds;
    const list = [...views.values()].filter(v => v.x !== null);
    for (const v of list) {
      v.moving = false;
      // 倒地、正在出招或挨打時不走動
      if (v.down || v.lunge || v.pending > 0 || v.hold > 0) continue;
      if (!v.goal) {
        if ((v.rest = (v.rest === undefined ? Math.random() * cfg.restMax : v.rest) - dt) > 0) continue;
        // 隨機挑幾個候選地點，選離其他人最遠的那個，大家才會散開、不會擠成一團
        const reach = cfg.stepMax * v.size;   // 一次最多走多遠
        let best = null;
        for (let c = 0; c < 8; c++) {
          const x = clamp(v.x + (Math.random() * 2 - 1) * reach, b.x0, b.x1), y = clamp(v.y + (Math.random() * 2 - 1) * reach, b.y0, b.y1);
          let room = 9;
          for (const o of list) if (o !== v) room = Math.min(room, gap(x, y, (o.goal || o).x, (o.goal || o).y, v.size));
          room = Math.min(room, 2) + Math.random() * 0.3;   // 夠空就好，不必永遠跑去最空的角落
          if (!best || room > best.room) best = { x, y, room };
        }
        v.goal = best;
      }
      const dx = v.goal.x - v.x, dy = v.goal.y - v.y, d = Math.hypot(dx, dy), step = cfg.speed * v.size * dt;
      if (d <= step) { v.goal = null; v.rest = cfg.restMin + Math.random() * (cfg.restMax - cfg.restMin); continue; }
      v.x += dx / d * step; v.y += dy / d * step;
      v.moving = true; v.dir = Math.sign(dx);
      if (Math.abs(v.goal.x - v.x) > v.size * 0.2) v.face = v.dir;   // 面向前進方向（幾乎直上直下時不轉身）
    }
    // 互相靠太近就輕輕推開，避免疊在一起；倒地的不會被推走
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j];
      const g = gap(a.x, a.y, c.x, c.y, (a.size + c.size) / 2);
      if (g >= 1 || (a.down && c.down)) continue;
      const dx = c.x - a.x || 0.01, dy = c.y - a.y, d = Math.hypot(dx, dy);
      const push = (1 - g) * a.size * Math.min(1, dt * 5) / d;
      const wa = a.down ? 0 : c.down ? 1 : 0.5;
      a.x -= dx * push * wa; a.y -= dy * push * wa; c.x += dx * push * (1 - wa); c.y += dy * push * (1 - wa);
    }
    for (const v of list) { if (!v.down) { v.x = clamp(v.x, b.x0, b.x1); v.y = clamp(v.y, b.y0, b.y1); } }
  }

  // 這隻武將此刻畫在哪（待機位置 + 各種動態造成的位移）
  function pos(v) {
    let x = v.x, y = v.y;
    if (v.moving) y -= Math.abs(Math.sin(time * 9 + v.phase)) * v.size * 0.05;    // 走路時一顛一顛
    else if (!v.down) y += Math.sin(time * 2.4 + v.phase) * v.size * 0.03;      // 待機輕輕浮動
    if (v.hop > 0) y -= Math.sin(Math.PI * (1 - v.hop)) * v.size * 0.5 * v.hopH; // 彈跳
    if (v.lunge) {                                                              // 衝撞（去了再回來）
      const t = views.get(v.lunge.to);
      if (t) { const s = Math.sin(Math.PI * v.lunge.t / v.lunge.dur) * 0.6; x += (t.x - v.x) * s; y += (t.y - v.y) * s; }
    }
    x += v.kbx; y += v.kby;                                                     // 擊退
    if (v.shake > 0) { x += (Math.random() - 0.5) * v.shake * v.size * 0.2; y += (Math.random() - 0.5) * v.shake * v.size * 0.1; }
    return { x, y };
  }

  function drawHero(v) {
    const p = game.getPlayer(v.id);
    const { x, y } = pos(v);
    const size = v.size, r = size / 2, fs = clamp(size * 0.2, 12, 22);
    const pose = v.down ? 'down' : v.lunge ? 'attack' : v.flash > 0 ? 'hit' : 'idle';
    // 身體傾斜：衝撞時往前傾，被打時往後仰
    let lean = 0;
    if (v.lunge) { const t = views.get(v.lunge.to); if (t) lean = Math.sign(t.x - v.x || 1) * 0.22 * Math.sin(Math.PI * v.lunge.t / v.lunge.dur); }
    else lean = clamp(v.kbx / size * 1.4, -0.35, 0.35) + (v.moving ? v.dir * 0.06 : 0);   // 走路時微微往前進方向傾
    sprite.draw(ctx, p.hero, x, y, size, { pose, poseTime: v.lunge ? v.lunge.t : time, flash: v.flash, lean, facing: v.faceShown });

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

    if (dim) {   // 技能發動：畫面短暫變暗，讓特效更顯眼
      ctx.fillStyle = `rgba(0,0,0,${config.skillDim * Math.sin(Math.PI * dim.age / dim.life)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    if (quake > 0) ctx.translate((Math.random() - 0.5) * quake * 14, (Math.random() - 0.5) * quake * 14);   // 重擊時整個畫面震一下
    effects.draw(ctx, true);    // 貼在地上的特效（法陣、地裂）

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
    effects.draw(ctx, false);   // 其他特效（刀光、火花、落雷…）
    ctx.restore();

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
    // 自動測試用：讀出每隻武將目前的位置
    debugViews() { return [...views.values()].map(v => ({ id: v.id, x: v.x, y: v.y, size: v.size, down: v.down, face: v.face, moving: v.moving })); },
    debugBounds() { return bounds; },
    reset() { views.clear(); floats = []; rings = []; timers = []; toasts = []; dim = null; quake = 0; effects.clear(); },
  };
};
