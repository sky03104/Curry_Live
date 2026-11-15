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
    // 火花／光點：帶一小段尾巴，看起來像在飛
    p(ctx, i, k) {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = i.color; ctx.lineCap = 'round';
      ctx.lineWidth = i.size * (1 - k * 0.6);
      ctx.beginPath(); ctx.moveTo(i.x, i.y); ctx.lineTo(i.x - i.vx * 0.035, i.y - i.vy * 0.035); ctx.stroke();
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
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      ctx.translate(i.x, i.y); ctx.rotate(i.rot);
      ctx.font = `${i.size}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i.ch, 0, 0);
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
      for (const dir of [-1, 1]) {
        for (let c = 0; c < n; c++) {
          const x = i.x - w / 2 + (c + 0.5) * w / n, y = i.y + dir * (gap + i.r * 0.12);
          ctx.beginPath(); ctx.moveTo(x - w / n * 0.5, y + dir * i.r * 0.5); ctx.lineTo(x + w / n * 0.5, y + dir * i.r * 0.5); ctx.lineTo(x, y);
          ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = i.color; ctx.stroke();
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
      ctx.lineJoin = 'round'; ctx.lineWidth = i.size * 0.22; ctx.strokeStyle = '#2a1a10'; ctx.strokeText(i.text, 0, 0);
      ctx.fillStyle = i.color; ctx.fillText(i.text, 0, 0);
    },
    // 地面震波：壓扁成橢圓的一圈，往外擴散
    shock(ctx, i, k) {
      ctx.translate(i.x, i.y); ctx.scale(1, 0.38);
      ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = i.color; ctx.lineWidth = i.r * 0.12 * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(0, 0, i.r * Math.min(1, 0.15 + k * 1.1), 0, Math.PI * 2); ctx.stroke();
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
        if (i.type === 'emoji') {
          i.x += i.vx * dt; i.y += i.vy * dt; i.vy += i.g * dt; i.rot += i.vr * dt;
        } else if (i.type === 'p') {
          i.x += i.vx * dt; i.y += i.vy * dt; i.vy += i.g * dt;
          i.vx *= 1 - Math.min(1, dt * i.drag); i.vy *= 1 - Math.min(1, dt * i.drag);
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
        if (!i.ground || i.type === 'circle') ctx.globalCompositeOperation = 'lighter';   // 發光感：顏色疊加變亮
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
      for (let c = 0; c < 26; c++) {
        const a = rnd(0, Math.PI * 2), d = rnd(0.7, 1.2) * radius, t = rnd(0.6, 1) * life;
        add({ type: 'p', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d / t, vy: -Math.sin(a) * d / t,
          g: 0, drag: 0, size: rnd(3, 6), color: Math.random() < 0.3 ? '#fff' : color, life: t });
      }
      add({ type: 'glow', x, y, r: radius * 0.9, color, life });
    },
    // 往上飄的光點（回血、復活）
    rise(x, y, color, n, spread) {
      for (let c = 0; c < n; c++) {
        add({ type: 'p', x: x + rnd(-spread, spread), y: y + rnd(-spread, spread) * 0.6, vx: rnd(-15, 15), vy: rnd(-160, -70),
          g: 0, drag: 0.5, size: rnd(3, 6), color: Math.random() < 0.3 ? '#fff' : color, life: rnd(0.5, 0.9) });
      }
    },
    slash(x, y, angle, r, color) { add({ type: 'slash', x, y, angle, r, color, life: 0.45 }); },
    circle(x, y, r, color, life) { add({ type: 'circle', ground: true, x, y, r, color, life }); },
    bolt(x, y, h, color, w) {
      const pts = jagged(x + rnd(-h * 0.15, h * 0.15), y - h, x, y, 9, h * 0.06);
      const mid = pts[5];
      add({ type: 'bolt', pts, branch: jagged(mid[0], mid[1], mid[0] + rnd(-1, 1) * h * 0.25, mid[1] + h * 0.25, 4, h * 0.04), color, w, life: 0.5 });
    },
    pillar(x, y, w, h, color) { add({ type: 'pillar', x, y, w, h, color, life: 0.7 }); },
    crack(x, y, r, color) {
      const lines = [];
      for (let c = 0; c < 7; c++) { const a = c / 7 * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(0.6, 1) * r; lines.push(jagged(0, 0, Math.cos(a) * d, Math.sin(a) * d, 4, r * 0.1)); }
      add({ type: 'crack', ground: true, x, y, lines, color, life: 0.9 });
    },
    // 專屬特效用的零件
    emoji(x, y, ch, size, vx, vy, g, life, vr) { add({ type: 'emoji', ch, x, y, vx: vx || 0, vy: vy || 0, g: g || 0, size, rot: 0, vr: vr || 0, life: life || 1 }); },
    claw(x, y, angle, r, color) { add({ type: 'claw', x, y, angle, r, color, life: 0.5 }); },
    fang(x, y, r, color) { add({ type: 'fang', x, y, r, color, life: 0.5 }); },
    stamp(x, y, text, size, color, life) { add({ type: 'stamp', x, y, text, size, color, life: life || 0.9 }); },
    shock(x, y, r, color, life) { add({ type: 'shock', ground: true, x, y, r, color, life: life || 0.7 }); },
    orb(x0, y0, x1, y1, r, color, life) { add({ type: 'orb', x: x0, y: y0, x0, y0, x1, y1, r, color, life, arc: Math.abs(x1 - x0) * 0.12 }); },
  };
  return fx;
};
