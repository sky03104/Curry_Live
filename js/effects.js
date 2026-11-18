// ============================================================
// 特效層：刀光、火花、法陣、落雷、光彈、光柱、地裂、集氣。
// 全部用程式畫，不需要圖檔。render.js 決定「什麼時候、在哪裡」放特效，
// 這裡只負責「每種特效長什麼樣子」。之後想換成圖片特效，只改這個檔。
// ============================================================
window.ML = window.ML || {};

ML.createEffects = function () {
  let items = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const add = (o) => { o.age = 0; items.push(o); return o; };

  // ---------- 圖片特效（assets/fx，資料在 js/fx-sprites.js）----------
  // 第一次用到才下載那張圖；還沒載好的時候就略過那一次（下次就有了）。圖片特效不夠時，原本程式畫的特效仍保留。
  const SPR = ML.FX_SPRITES || {};
  const sprImgs = {};
  function sprImg(name) {
    const d = SPR[name]; if (!d) return null;
    let e = sprImgs[name];
    if (!e) {
      e = sprImgs[name] = { img: new Image(), ok: false };
      e.img.onload = () => { e.ok = true; };
      e.img.src = 'assets/fx/' + d.src + (window.APP_VERSION ? '?v=' + window.APP_VERSION : '');
    }
    return e.ok ? e.img : null;
  }
  // 目前時間對應第幾格（每格有自己的時間，整段拉長／縮短成 life 秒）
  function sprFrame(d, k, loop) {
    const fr = d.frames, a = loop ? loop[0] : 0, b = loop ? loop[1] : fr.length - 1;
    if (loop) { const n = b - a + 1; return a + Math.floor(k * n * (loop[2] || 1)) % n; }
    let tot = 0; for (let i = a; i <= b; i++) tot += fr[i][6];
    let t = Math.min(0.9999, k) * tot;
    for (let i = a; i <= b; i++) { if (t < fr[i][6]) return i; t -= fr[i][6]; }
    return b;
  }

  // 一條有粗細變化的折線（落雷、地裂共用）
  function jagged(x0, y0, x1, y1, parts, wobble) {
    const pts = [[x0, y0]];
    for (let i = 1; i < parts; i++) {
      const t = i / parts;
      pts.push([x0 + (x1 - x0) * t + rnd(-wobble, wobble), y0 + (y1 - y0) * t + rnd(-wobble, wobble) * 0.4]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function strokePts(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  const draw = {
    // 圖片特效：i.scale＝原圖一個像素放大成幾個畫面像素；i.rot 旋轉；i.flip 左右翻；i.cx 水平置中；i.loop 只循環某幾格
    sprite(ctx, i, k) {
      const d = SPR[i.name], img = sprImg(i.name); if (!d || !img) return;
      const f = d.frames[sprFrame(d, k, i.loop)];
      const px = i.cx ? d.w / 2 : d.pivot[0], py = d.pivot[1];
      const s = i.scale;
      ctx.imageSmoothingEnabled = !d.pixel;
      ctx.translate(i.x, i.y); if (i.rot) ctx.rotate(i.rot); if (i.flip) ctx.scale(-1, 1);
      if (i.alpha !== undefined) ctx.globalAlpha = i.alpha;
      // f = [圖上 x, y, 寬, 高, 去掉透明邊後的基準點 x, y, 毫秒]；基準點在原圖裡的位置 px,py 要換算成去邊後的位置
      const ox = f[4] - (d.pivot[0] - px), oy = f[5];
      ctx.drawImage(img, f[0], f[1], f[2], f[3], -ox * s, -oy * s, f[2] * s, f[3] * s);
    },
    // 火花／光點：帶一小段尾巴，看起來像在飛
    p(ctx, i, k) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = i.color; ctx.lineCap = 'round';
      ctx.lineWidth = i.size * (1 - k * 0.6);
      ctx.beginPath(); ctx.moveTo(i.x, i.y); ctx.lineTo(i.x - i.vx * 0.035, i.y - i.vy * 0.035); ctx.stroke();
      ctx.fillStyle = i.color; ctx.beginPath(); ctx.arc(i.x, i.y, i.size * 0.55, 0, Math.PI * 2); ctx.fill();   // 圓圓的亮頭，看起來比較立體
    },
    // 刀光：一道中間粗兩頭尖的弧線，很快掃過去再淡掉
    slash(ctx, i, k) {
      const shown = Math.min(1, k * 3), N = 14;
      ctx.lineCap = 'round';
      for (const [color, wide] of [[i.color, 1], ['#ffffff', 0.45]]) {
        ctx.strokeStyle = color; ctx.globalAlpha = (1 - k) * (wide === 1 ? 0.85 : 1);
        for (let s = 0; s < N * shown; s++) {
          const t0 = s / N, t1 = (s + 1) / N;
          ctx.lineWidth = Math.max(1, Math.sin(Math.PI * (t0 + t1) / 2) * i.r * 0.22 * wide);
          ctx.beginPath();
          ctx.arc(i.x, i.y, i.r, i.angle - 1.2 + t0 * 2.4, i.angle - 1.2 + t1 * 2.4);
          ctx.stroke();
        }
      }
    },
    // 法陣：畫在腳下的旋轉圓陣（壓扁成橢圓，看起來像貼在地上）
    circle(ctx, i, k) {
      ctx.translate(i.x, i.y); ctx.scale(1, 0.36); ctx.rotate(i.age * 2.5);
      ctx.globalAlpha = Math.min(1, k * 5, (1 - k) * 4);
      ctx.strokeStyle = i.color; ctx.shadowColor = i.color; ctx.shadowBlur = 12; ctx.lineWidth = 3;
      const r = i.r * Math.min(1, k * 4);
      for (const rr of [r, r * 0.72]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
      for (const off of [0, Math.PI]) {       // 兩個三角形疊成六芒星
        ctx.beginPath();
        for (let n = 0; n < 3; n++) { const a = off + n * Math.PI * 2 / 3; ctx[n ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); }
        ctx.closePath(); ctx.stroke();
      }
    },
    // 落雷：從上方劈下來的折線，會閃爍
    bolt(ctx, i, k) {
      ctx.globalAlpha = (1 - k) * (Math.random() > 0.25 ? 1 : 0.4);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = i.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = i.color; ctx.lineWidth = i.w * 2.4; strokePts(ctx, i.pts);
      ctx.lineWidth = i.w * 1.2; strokePts(ctx, i.branch);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = i.w; strokePts(ctx, i.pts);
    },
    // 光柱：從天而降的一道光，越來越細
    pillar(ctx, i, k) {
      const w = i.w * (1 - k * 0.7);
      const g = ctx.createLinearGradient(i.x - w / 2, 0, i.x + w / 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, i.color);
      g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, i.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = g;
      ctx.fillRect(i.x - w / 2, i.y - i.h, w, i.h);
    },
    // 地裂：從腳下往外裂開的幾條縫
    crack(ctx, i, k) {
      ctx.translate(i.x, i.y); ctx.scale(1, 0.4);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const grow = Math.min(1, k * 6);
      for (const line of i.lines) {
        const pts = line.map(p => [p[0] * grow, p[1] * grow]);
        ctx.strokeStyle = 'rgba(20,10,5,0.9)'; ctx.lineWidth = 7; strokePts(ctx, pts);
        ctx.strokeStyle = i.color; ctx.lineWidth = 3; strokePts(ctx, pts);
      }
    },
    // 光暈：集氣時身上的一團光
    glow(ctx, i, k) {
      const r = i.r * (0.6 + 0.4 * k);
      const g = ctx.createRadialGradient(i.x, i.y, 0, i.x, i.y, r);
      g.addColorStop(0, i.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = Math.sin(Math.PI * k) * 0.8; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(i.x, i.y, r, 0, Math.PI * 2); ctx.fill();
    },
    // 表情符號粒子（骨頭、愛心、南瓜、起司…專屬特效用）：會轉、會掉、最後淡出
    emoji(ctx, i, k) {
      ctx.globalCompositeOperation = 'source-over';
      const fade = k < 0.75 ? 1 : (1 - k) / 0.25;
      if (i.groundY !== undefined) {   // 地上的影子：離地越近越大越清楚（有高度的感覺）
        const h = Math.max(0, i.groundY - i.y), near = 1 - Math.min(1, h / (i.size * 7));
        ctx.save(); ctx.globalAlpha = fade * (0.12 + 0.35 * near); ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(i.x, i.groundY, i.size * (0.25 + 0.3 * near), i.size * (0.08 + 0.1 * near), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = fade;
      ctx.translate(i.x, i.y); ctx.rotate(i.rot * 0.35); ctx.scale(Math.max(0.4, Math.abs(Math.cos(i.rot * 0.9))), 1);   // 一邊轉一邊壓扁＝像在空中翻面
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = i.size * 0.25; ctx.shadowOffsetY = i.size * 0.12;
      ctx.font = `${i.size}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i.ch, 0, 0);
    },
    // 碎塊：有三個面（上亮、左中、右暗）的小立方體，會翻滾、落地時有影子（地裂、砸地時飛出去的碎石）
    chunk(ctx, i, k) {
      ctx.globalCompositeOperation = 'source-over';
      const fade = k < 0.7 ? 1 : (1 - k) / 0.3, s = i.size;
      ctx.globalAlpha = fade * 0.4; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(i.x, i.groundY, s * 0.7, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade; ctx.translate(i.x, i.y); ctx.rotate(i.rot);
      const face = (pts, col) => { ctx.beginPath(); pts.forEach((p, n) => (n ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(); };
      face([[0, -0.6], [0.55, -0.3], [0, 0], [-0.55, -0.3]], i.light);   // 上面
      face([[-0.55, -0.3], [0, 0], [0, 0.6], [-0.55, 0.3]], i.mid);      // 左面
      face([[0.55, -0.3], [0, 0], [0, 0.6], [0.55, 0.3]], i.dark);       // 右面
    },
    // 爪痕：三道平行的斜線一道一道劃出來
    claw(ctx, i, k) {
      ctx.lineCap = 'round';
      for (let n = 0; n < 3; n++) {
        const t = Math.min(1, Math.max(0, (k - n * 0.08) * 3.5)); if (t <= 0) continue;
        const off = (n - 1) * i.r * 0.34, ox = -Math.sin(i.angle) * off, oy = Math.cos(i.angle) * off;
        const x0 = i.x + ox - Math.cos(i.angle) * i.r * 0.9, y0 = i.y + oy - Math.sin(i.angle) * i.r * 0.9;
        const x1 = x0 + Math.cos(i.angle) * i.r * 1.8 * t, y1 = y0 + Math.sin(i.angle) * i.r * 1.8 * t;
        ctx.globalAlpha = Math.min(1, (1 - k) * 2);
        ctx.strokeStyle = i.color; ctx.lineWidth = i.r * 0.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = i.r * 0.07; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    },
    // 尖牙：上下兩排三角形的牙從兩邊合起來，咬一口
    fang(ctx, i, k) {
      const close = Math.min(1, k * 4), w = i.r * 1.6, n = 5, gap = (1 - close) * i.r * 0.9;
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.lineJoin = 'round';
      ctx.save(); ctx.globalAlpha *= 0.55; ctx.fillStyle = '#2a0a10'; ctx.beginPath(); ctx.ellipse(i.x, i.y, w / 2, gap + i.r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // 嘴裡的暗處
      for (const dir of [-1, 1]) {
        for (let c = 0; c < n; c++) {
          const x = i.x - w / 2 + (c + 0.5) * w / n, y = i.y + dir * (gap + i.r * 0.12);
          ctx.beginPath(); ctx.moveTo(x - w / n * 0.5, y + dir * i.r * 0.5); ctx.lineTo(x + w / n * 0.5, y + dir * i.r * 0.5); ctx.lineTo(x, y);
          ctx.closePath(); const tg = ctx.createLinearGradient(x, y, x, y + dir * i.r * 0.5); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#c9c4d6');
          ctx.fillStyle = tg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = i.color; ctx.stroke();
        }
      }
    },
    // 大字蓋章：一個大字從天上「砰」地蓋下來（例如「100T」）
    stamp(ctx, i, k) {
      const drop = Math.min(1, k * 4), sc = 2.6 - 1.6 * drop * drop, y = i.y - (1 - drop) * i.size * 2.2;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      ctx.translate(i.x, y); ctx.scale(sc, sc);
      ctx.font = `900 ${i.size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(i.text, i.size * 0.12, i.size * 0.32);   // 地上的影子
      ctx.fillStyle = '#6b4310'; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = i.size * 0.22;
      for (let d = Math.round(i.size * 0.16); d >= 1; d--) { ctx.strokeText(i.text, d * 0.5, d); ctx.fillText(i.text, d * 0.5, d); }   // 一層層往下疊＝立體的厚度
      ctx.strokeText(i.text, 0, 0);
      const g = ctx.createLinearGradient(0, -i.size * 0.5, 0, i.size * 0.5); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, i.color); g.addColorStop(1, '#b8801f');
      ctx.fillStyle = g; ctx.fillText(i.text, 0, 0);
    },
    // 地面震波：壓扁成橢圓的一圈，往外擴散
    shock(ctx, i, k) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(i.x, i.y); ctx.scale(1, 0.38);
      const rr = i.r * Math.min(1, 0.15 + k * 1.1), lw = i.r * 0.12 * (1 - k * 0.6), al = (1 - k) * 0.9;
      const dust = ctx.createRadialGradient(0, 0, rr * 0.3, 0, 0, rr);   // 圈內一層淡淡的塵土
      dust.addColorStop(0, 'rgba(255,255,255,0)'); dust.addColorStop(1, i.color);
      ctx.globalAlpha = al * 0.25; ctx.fillStyle = dust; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      for (const [dy, col, a] of [[lw * 0.9, 'rgba(0,0,0,0.55)', 1], [0, i.color, 1], [-lw * 0.25, '#ffffff', 0.55]]) {   // 下層暗邊＋彩色環＋上緣亮邊＝有厚度的環
        ctx.globalAlpha = al * a; ctx.strokeStyle = col; ctx.lineWidth = col === '#ffffff' ? lw * 0.35 : lw;
        ctx.beginPath(); ctx.arc(0, dy, rr, 0, Math.PI * 2); ctx.stroke();
      }
    },
    // 光彈：飛向對手的一顆光球
    orb(ctx, i) {
      const g = ctx.createRadialGradient(i.x, i.y, 0, i.x, i.y, i.r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, i.color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(i.x, i.y, i.r, 0, Math.PI * 2); ctx.fill();
    },
  };

  const fx = {
    update(dt) {
      for (const i of items) {
        i.age += dt;
        if (i.type === 'chunk') {
          i.x += i.vx * dt; i.y += i.vy * dt; i.vy += i.g * dt; i.rot += i.vr * dt;
          if (i.y > i.groundY) { i.y = i.groundY; i.vy *= -0.38; i.vx *= 0.65; i.vr *= 0.6; }   // 落地彈一下
        } else if (i.type === 'emoji') {
          i.x += i.vx * dt; i.y += i.vy * dt; i.vy += i.g * dt; i.rot += i.vr * dt;
        } else if (i.type === 'p') {
          i.x += i.vx * dt; i.y += i.vy * dt; i.vy += i.g * dt;
          i.vx *= 1 - Math.min(1, dt * i.drag); i.vy *= 1 - Math.min(1, dt * i.drag);
        } else if (i.type === 'sprite' && i.vx !== undefined) {   // 會飛的圖片特效
          const kk = Math.min(1, i.age / i.life);
          i.x = i.x0 + (i.x1 - i.x0) * kk; i.y = i.y0 + (i.y1 - i.y0) * kk;
        } else if (i.type === 'orb') {
          const k = Math.min(1, i.age / i.life);
          i.x = i.x0 + (i.x1 - i.x0) * k; i.y = i.y0 + (i.y1 - i.y0) * k - Math.sin(Math.PI * k) * i.arc;
          fx.sparks(i.x, i.y, i.color, 2, 60, i.r * 0.25, 0.3);   // 拖尾
        }
      }
      items = items.filter(i => i.age < i.life);
    },
    clear() { items = []; },
    // ground = true 畫貼在地上的（法陣、地裂，要被武將蓋住）；false 畫其他（蓋在武將上面）
    draw(ctx, ground) {
      for (const i of items) {
        if (!!i.ground !== ground) continue;
        ctx.save();
        if (i.type !== 'sprite' && (!i.ground || i.type === 'circle')) ctx.globalCompositeOperation = 'lighter';   // 發光感：顏色疊加變亮
        draw[i.type](ctx, i, i.age / i.life);
        ctx.restore();
      }
    },

    sparks(x, y, color, n, speed, size, life, gravity) {
      for (let c = 0; c < n; c++) {
        const a = rnd(0, Math.PI * 2), s = rnd(0.3, 1) * speed;
        add({ type: 'p', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity === undefined ? 500 : gravity,
          drag: 2.5, size: rnd(0.6, 1.2) * size, color: Math.random() < 0.3 ? '#fff' : color, life: rnd(0.6, 1) * (life || 0.5) });
      }
    },
    // 集氣：一圈光點往身上收
    converge(x, y, color, radius, life) {
      if (SPR['status_power-up-aura']) fx.sprite('status_power-up-aura', x, y + radius * 0.55, { w: radius * 1.9, life: Math.max(0.5, life) });
      for (let c = 0; c < 26; c++) {
        const a = rnd(0, Math.PI * 2), d = rnd(0.7, 1.2) * radius, t = rnd(0.6, 1) * life;
        add({ type: 'p', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d / t, vy: -Math.sin(a) * d / t,
          g: 0, drag: 0, size: rnd(3, 6), color: Math.random() < 0.3 ? '#fff' : color, life: t });
      }
      add({ type: 'glow', x, y, r: radius * 0.9, color, life });
    },
    // 往上飄的光點（回血、復活）
    rise(x, y, color, n, spread) {
      if (SPR['holy_holy-heal']) fx.sprite('holy_holy-heal', x, y + spread * 1.2, { w: spread * 5, life: 1.2 });
      if (SPR['px_holy_heal-aoe']) fx.sprite('px_holy_heal-aoe', x, y + spread * 1.2, { w: spread * 7, ground: true, life: 1.6 });   // 腳下一圈綠色治療光環（pixelfx）
      for (let c = 0; c < n; c++) {
        add({ type: 'p', x: x + rnd(-spread, spread), y: y + rnd(-spread, spread) * 0.6, vx: rnd(-15, 15), vy: rnd(-160, -70),
          g: 0, drag: 0.5, size: rnd(3, 6), color: Math.random() < 0.3 ? '#fff' : color, life: rnd(0.5, 0.9) });
      }
    },
    // 通用：放一個圖片特效。opts：w 畫面上要多寬（像素）或 scale；rot；flip；ground（貼地、被武將蓋住）；life（秒）；cx；loop
    sprite(name, x, y, o) {
      o = o || {}; const d = SPR[name]; if (!d) return null;
      const scale = o.scale || (o.w ? o.w / d.w : 3);
      const total = d.frames.reduce((a, f) => a + f[6], 0) / 1000;
      return add({ type: 'sprite', name, x, y, scale, rot: o.rot || 0, flip: !!o.flip, cx: !!o.cx, loop: o.loop, alpha: o.alpha,
        ground: !!o.ground, life: o.life || total });
    },
    // 隨機挑一個有載入的圖片特效（pixelfx 的特效跟原本的輪流用，每次看起來不一樣）
    pick(names) { const ok = names.filter(n => SPR[n]); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null; },
    // 命中火花（打中的瞬間）
    hit(x, y, size) { return fx.sprite(Math.random() < 0.25 && SPR['px_impacts_crit-hit'] ? 'px_impacts_crit-hit' : 'hit_spark', x, y, { w: size * 1.6, life: 0.5 }); },
    // 大爆炸（全場攻擊、塔堡被打爆）
    explode(x, y, size, ground) { return fx.sprite('explosions_big-explosion', x, y, { w: size * 2.4, life: 1.0 }); },
    slash(x, y, angle, r, color) {
      if (SPR['melee_axe-smear']) {
        const n = fx.pick(['melee_axe-smear', 'px_melee_double-slash', 'px_melee_spin-slash', 'px_melee_dagger-flurry']);   // 斬擊：原本的斜月斬＋pixelfx 的三種輪流用
        fx.sprite(n, x, y, { w: r * 2.6, rot: angle, life: n.indexOf('px_') === 0 ? 0.8 : 0.5 }); fx.hit(x, y, r * 0.8); return;
      }
      add({ type: 'slash', x, y, angle, r, color, life: 0.45 });
    },
    circle(x, y, r, color, life) {
      if (SPR['arcane_magic-circle']) { fx.sprite('arcane_magic-circle', x, y, { w: r * 2.6, ground: true, life: life || 1.4 }); return; }
      add({ type: 'circle', ground: true, x, y, r, color, life });
    },
    bolt(x, y, h, color, w) {
      if (SPR['lightning_lightning-strike']) {
        fx.sprite('lightning_lightning-strike', x, y, { scale: Math.max(1.5, h / 110), life: 0.6 });
        if (SPR['px_lightning_zap-hit']) fx.sprite('px_lightning_zap-hit', x, y, { w: Math.max(90, h * 0.7), life: 0.9 });   // 落點多一團電火花（pixelfx）
        return;
      }
      const pts = jagged(x + rnd(-h * 0.15, h * 0.15), y - h, x, y, 9, h * 0.06);
      const mid = pts[5];
      add({ type: 'bolt', pts, branch: jagged(mid[0], mid[1], mid[0] + rnd(-1, 1) * h * 0.25, mid[1] + h * 0.25, 4, h * 0.04), color, w, life: 0.5 });
    },
    pillar(x, y, w, h, color) {
      if (SPR['holy_divine-beam']) { fx.sprite('holy_divine-beam', x, y, { scale: Math.max(1.5, h / 90), life: 0.9 }); return; }
      add({ type: 'pillar', x, y, w, h, color, life: 0.7 });
    },
    crack(x, y, r, color) {
      if (SPR['px_fire_fire-tornado'] && Math.random() < 0.4) {   // 四成機率：地上捲起一道火焰龍捲風（pixelfx）
        fx.sprite('px_fire_fire-tornado', x, y + r * 0.2, { w: r * 2.2, life: 1.8 }); fx.sprite('nature_fissure', x, y, { w: r * 2.4, cx: true, ground: true, life: 1.0 }); return;
      }
      if (SPR['nature_fissure']) { fx.sprite('nature_fissure', x, y, { w: r * 2.4, cx: true, ground: true, life: 1.0 }); return; }
      const lines = [];
      for (let c = 0; c < 7; c++) { const a = c / 7 * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(0.6, 1) * r; lines.push(jagged(0, 0, Math.cos(a) * d, Math.sin(a) * d, 4, r * 0.1)); }
      add({ type: 'crack', ground: true, x, y, lines, color, life: 0.9 });
    },
    // 專屬特效用的零件
    emoji(x, y, ch, size, vx, vy, g, life, vr, groundY) { add({ type: 'emoji', ch, x, y, vx: vx || 0, vy: vy || 0, g: g || 0, size, rot: 0, vr: vr || 0, life: life || 1, groundY }); },
    // 碎石塊：從 (x, y) 往上噴出去，落到 groundY 彈一下。color 是基底色（自動算出亮面和暗面）
    debris(x, y, color, n, speed, groundY) {
      const shade = (hex, f) => { const v = parseInt(String(hex).slice(1), 16); if (isNaN(v)) return hex; const m = c => Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)))); return `rgb(${m(v >> 16 & 255)},${m(v >> 8 & 255)},${m(v & 255)})`; };
      for (let c = 0; c < n; c++) {
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), s = rnd(0.4, 1) * speed;
        add({ type: 'chunk', x: x + rnd(-8, 8), y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 1400, size: rnd(5, 11), rot: rnd(0, 6), vr: rnd(-9, 9), groundY: groundY === undefined ? y + 40 : groundY,
          light: shade(color, 0.45), mid: shade(color, 0), dark: shade(color, -0.45), life: rnd(0.9, 1.3) });
      }
    },
    claw(x, y, angle, r, color) {
      if (SPR['melee_shadow-claw']) {
        if (Math.random() < 0.5 && SPR['px_melee_claw-swipe']) fx.sprite('px_melee_claw-swipe', x, y, { w: r * 2.2, rot: angle, life: 0.9 });   // pixelfx 的爪痕（朝向打的方向）
        else fx.sprite('melee_shadow-claw', x, y, { w: r * 2.2, rot: angle + Math.PI * 0.5, life: 0.5 });
        fx.hit(x, y, r * 0.7); return;
      }
      add({ type: 'claw', x, y, angle, r, color, life: 0.5 });
    },
    fang(x, y, r, color) { add({ type: 'fang', x, y, r, color, life: 0.5 }); fx.hit(x, y, r * 0.7); },
    stamp(x, y, text, size, color, life) { add({ type: 'stamp', x, y, text, size, color, life: life || 0.9 }); },
    shock(x, y, r, color, life) {
      if (SPR['explosions_fire-nova']) {
        const white = String(color).toLowerCase() === '#ffffff';
        const alt = Math.random() < 0.4 ? (white ? 'px_explosions_plasma-explosion' : 'px_fire_fire-ring') : null;   // 一部分換成 pixelfx 的電漿爆炸／火圈
        if (alt && SPR[alt]) { fx.sprite(alt, x, y, { w: r * (white ? 2.2 : 3.2), ground: true, life: alt === 'px_fire_fire-ring' ? 1.6 : 1.0 }); return; }
        fx.sprite(white ? 'explosions_arcane-burst' : 'explosions_fire-nova', x, y, { w: r * (white ? 2.2 : 2.6), ground: true, life: Math.max(0.8, (life || 0.7) * 1.4) }); return;
      }
      add({ type: 'shock', ground: true, x, y, r, color, life: life || 0.7 });
    },
    orb(x0, y0, x1, y1, r, color, life) {
      if (SPR['arcane_arcane-orb-projectile']) {   // 飛行中循環播前幾格，到了再炸開
        const ang = Math.atan2(y1 - y0, x1 - x0);
        const o = fx.sprite('arcane_arcane-orb-projectile', x0, y0, { w: r * 7, rot: ang, loop: [0, 7, 2], life: life });
        o.vx = 1; o.x0 = x0; o.y0 = y0; o.x1 = x1; o.y1 = y1;
        setTimeout(() => fx.sprite('explosions_arcane-burst', x1, y1, { w: r * 6, life: 0.7 }), Math.max(0, life * 1000 - 40));
        return;
      }
      add({ type: 'orb', x: x0, y: y0, x0, y0, x1, y1, r, color, life, arc: Math.abs(x1 - x0) * 0.12 }); },
  };
  return fx;
};
