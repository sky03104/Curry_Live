// ============================================================
// 武將專屬特效：每隻武將的「普攻」「技能」可以各挑一種專屬演出。
//
// 怎麼幫新角色加專屬特效（以後新增的萌國角色都這樣做）：
//   1. 在 js/config.js 的 heroFx 加一行，例如：
//        newhero: { attack: { style: 'emojiPop', emoji: '🍩' }, skill: { style: 'emojiRain', emoji: '🍩', n: 12 } }
//      style 從下面 STYLES 挑一種，emoji、color、n 是可以調的參數；沒寫的參數用預設值。
//   2. 想要全新的演出：在下面 STYLES 加一個新的函式組（照其他幾個抄，主要寫 onHit），config 就能用它。
//   沒有登記的萌國角色，會依武將代號自動配一組（每隻不一樣），所以新角色就算忘了登記也不會沒特效；
//   魏蜀吳群沒登記的維持原本依兵種的演出。
//
// 每個演出（style）的欄位：
//   lunge   true＝衝過去（普攻預設 true、技能預設 false）　hit＝幾秒後打中（沒寫普攻 0.31、技能 0.5；動畫有 hitFrame 時以動畫為準）
//   fire(h, tv, p)   出招那一刻（投射物、集氣後的起手式）　onHit(tv, h, p)   打中那一刻，每個被打的人各呼叫一次
//   h 是 render.js 傳進來的工具：h.v 出招的人、h.fx 特效零件、h.color 陣營色、h.after(秒, 函式)、h.quake(強度)、h.ring(對象, 設定)、h.float(對象, 字, 顏色, 大小)
//   p 是 config 裡寫的參數（emoji、color、n…）
// ============================================================
window.ML = window.ML || {};

(function () {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (p, k, d) => (p && p[k] !== undefined ? p[k] : d);

  // 表情符號往四面八方炸開
  function emojiBurst(tv, h, ch, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(0.4, 1) * speed;
      h.fx.emoji(tv.x, tv.y, ch, tv.size * rnd(0.28, 0.45), Math.cos(a) * s, Math.sin(a) * s - 120, 600, rnd(0.6, 1), rnd(-8, 8), tv.y + tv.size * 0.5);
    }
  }

  const STYLES = {
    // ---------- 普攻 ----------
    // 咬一口：上下兩排尖牙合起來
    bite: {
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ffffff');
        h.fx.fang(tv.x, tv.y, tv.size * 0.8, c);
        h.fx.sparks(tv.x, tv.y, '#ffe9a8', 16, 380, 5, 0.6);
        h.ring(tv, { life: 0.35, color: c, max: 1.2 });
      },
    },
    // 爪痕：三道平行的爪痕
    claw: {
      onHit(tv, h, p) {
        const c = pick(p, 'color', h.color), ang = Math.atan2(tv.y - h.v.y, tv.x - h.v.x) + rnd(-0.5, 0.5) + 0.6;
        h.fx.claw(tv.x, tv.y, ang, tv.size * 0.8, c);
        h.fx.sparks(tv.x, tv.y, c, 18, 420, 5, 0.6);
        h.ring(tv, { life: 0.35, color: c, max: 1.1 });
      },
    },
    // 表情符號爆開（愛心、南瓜…）
    emojiPop: {
      onHit(tv, h, p) {
        emojiBurst(tv, h, pick(p, 'emoji', '⭐'), pick(p, 'n', 9), 420);
        h.ring(tv, { life: 0.4, color: pick(p, 'color', h.color), max: 1.3 });
      },
    },
    // 丟東西過去（起司、骨頭…）：表情符號飛向對手，命中爆開
    projectile: {
      lunge: false, hit: 0.45,
      fire(h, tv, p) {
        const ch = pick(p, 'emoji', '⭐'), t = 0.42, size = h.v.size * 0.4;
        const dx = tv.x - h.v.x, dy = tv.y - h.v.y;
        h.fx.emoji(h.v.x, h.v.y - h.v.size * 0.1, ch, size, dx / t, dy / t - 80, 0, t, 14);
      },
      onHit(tv, h, p) { emojiBurst(tv, h, pick(p, 'emoji', '⭐'), 6, 360); h.fx.sparks(tv.x, tv.y, pick(p, 'color', '#ffe27a'), 14, 400, 5, 0.6); },
    },
    // 重擊震波：地上一圈震波＋小地裂
    shockSmash: {
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ffd35c');
        h.fx.sprite('melee_hammer-smash', tv.x, tv.y + tv.size * 0.5, { w: tv.size * 3, life: 0.9 });   // 圖片特效：錘擊震地
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.6, c, 0.6);
        h.fx.crack(tv.x, tv.y + tv.size * 0.5, tv.size * 1.1, c);
        h.fx.sparks(tv.x, tv.y, c, 24, 500, 6, 0.7);
        h.fx.debris(tv.x, tv.y + tv.size * 0.4, '#8a7a66', 7, 480, tv.y + tv.size * 0.5);
        h.quake(0.5);
      },
    },

    // ---------- 技能 ----------
    // 東西從天上掉下來（骨頭雨、南瓜雨…）
    emojiRain: {
      hit: 0.6,
      fire(h, tv, p) {
        const ch = pick(p, 'emoji', '⭐'), n = pick(p, 'n', 10), big = pick(p, 'big', 0.5);
        for (let i = 0; i < n; i++) h.after(i * 0.04, () => {
          const x = tv.x + rnd(-tv.size * 0.8, tv.size * 0.8), size = tv.size * rnd(0.3, 0.3 + big);
          h.fx.emoji(x, tv.y - tv.size * 2.6, ch, size, rnd(-30, 30), rnd(500, 700), 900, 0.7, rnd(-6, 6), tv.y + tv.size * 0.5);
        });
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', h.color);
        emojiBurst(tv, h, pick(p, 'emoji', '⭐'), 8, 460);
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.8, c, 0.7);
        h.fx.sparks(tv.x, tv.y, c, 30, 560, 6, 0.8);
        h.fx.debris(tv.x, tv.y + tv.size * 0.4, '#8a7a66', 8, 520, tv.y + tv.size * 0.5);
        h.ring(tv, { life: 0.6, color: c, max: 2, width: 8 });
        h.quake(0.8);
      },
    },
    // 風刃：好幾道弧形風刃從四面八方劃過
    windBlades: {
      hit: 0.55,
      fire(h, tv, p) {
        const c = pick(p, 'color', '#8fffd0');
        for (let i = 0; i < 6; i++) h.after(0.05 + i * 0.07, () => {
          const a = i * Math.PI / 3 + rnd(-0.3, 0.3);
          h.fx.sprite('wind_wind-blade', tv.x - Math.cos(a) * tv.size * 0.6, tv.y - Math.sin(a) * tv.size * 0.6, { w: tv.size * 2.4, rot: a, life: 0.6 });   // 圖片特效：風刃
          h.fx.emoji(tv.x + Math.cos(a) * tv.size, tv.y + Math.sin(a) * tv.size, pick(p, 'emoji', '🍃'), tv.size * 0.3, -Math.cos(a) * 260, -Math.sin(a) * 260, 0, 0.5, 10);
        });
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#8fffd0');
        h.fx.sparks(tv.x, tv.y, c, 36, 600, 6, 0.8);
        h.ring(tv, { life: 0.5, color: c, max: 2.2, width: 7 });
        h.ring(tv, { life: 0.8, color: '#ffffff', max: 3, width: 3 });
        h.quake(0.7);
      },
    },
    // 暖心光波：愛心一串飛過去，打中爆出大愛心與暖色光柱
    heartWave: {
      hit: 0.6,
      fire(h, tv, p) {
        const ch = pick(p, 'emoji', '💖'), c = pick(p, 'color', '#ff8fb8');
        for (let i = 0; i < 9; i++) h.after(i * 0.05, () => {
          const t = 0.4, dx = tv.x - h.v.x, dy = tv.y - h.v.y;
          h.fx.emoji(h.v.x, h.v.y, ch, h.v.size * rnd(0.25, 0.4), dx / t + rnd(-60, 60), dy / t - 180 + rnd(-60, 60), 300, t + 0.1, rnd(-4, 4));
        });
        h.ring(h.v, { life: 0.8, color: c, max: 3, width: 8 });
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ff8fb8');
        emojiBurst(tv, h, pick(p, 'emoji', '💖'), 14, 520);
        h.fx.pillar(tv.x, tv.y + tv.size * 0.5, tv.size * 1.4, tv.size * 3, c);
        h.fx.sparks(tv.x, tv.y, '#ffe0ee', 34, 560, 6, 0.9, 120);
        h.ring(tv, { life: 0.7, color: c, max: 2.4, width: 9 });
        h.quake(0.7);
      },
    },
    // 食物旋風：一圈表情符號繞著對手轉、往上捲
    emojiStorm: {
      hit: 0.7,
      fire(h, tv, p) {
        const ch = pick(p, 'emoji', '⭐'), n = pick(p, 'n', 16);
        for (let i = 0; i < n; i++) h.after(i * 0.03, () => {
          const a = i / n * Math.PI * 4, r = tv.size * (0.3 + i / n * 0.9), sp = 380;
          h.fx.emoji(tv.x + Math.cos(a) * r, tv.y + tv.size * 0.4 + Math.sin(a) * r * 0.3, ch, tv.size * rnd(0.3, 0.45), -Math.sin(a) * sp, -rnd(180, 300), 80, 0.9, 10);
        });
        h.fx.circle(tv.x, tv.y + tv.size * 0.5, tv.size * 1.4, pick(p, 'color', '#ffd35c'), 1.4);
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ffd35c');
        for (let i = 0; i < 4; i++) h.after(i * 0.1, () => h.fx.bolt(tv.x, tv.y, Math.max(tv.y + 20, tv.size * 3), c, Math.max(4, tv.size * 0.06)));
        emojiBurst(tv, h, pick(p, 'emoji', '⭐'), 10, 480);
        h.ring(tv, { life: 0.6, color: c, max: 2.2, width: 8 });
        h.quake(0.9);
      },
    },
    // 猛虎撲殺：衝過去，幾道大爪痕交叉＋暗色光柱
    tigerPounce: {
      lunge: true, hit: 0.4,
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#b06cff'), base = Math.atan2(tv.y - h.v.y, tv.x - h.v.x);
        [-0.9, 0.5, 1.7].forEach((d, i) => h.after(i * 0.08, () => h.fx.claw(tv.x, tv.y, base + d, tv.size * 0.95, i === 1 ? '#ffffff' : c)));
        h.fx.pillar(tv.x, tv.y + tv.size * 0.5, tv.size * 1.5, tv.size * 3.2, c);
        h.fx.crack(tv.x, tv.y + tv.size * 0.5, tv.size * 1.7, c);
        h.fx.sparks(tv.x, tv.y, c, 44, 640, 7, 0.9);
        h.fx.debris(tv.x, tv.y + tv.size * 0.4, '#5a4a78', 10, 600, tv.y + tv.size * 0.5);
        h.ring(tv, { life: 0.6, color: c, max: 2.4, width: 9 });
        h.quake(1.2);
      },
    },
    // 大字蓋章：一個大字（100T）從天上砸下來，地面大震波
    stampSmash: {
      hit: 0.5,
      fire(h, tv, p) { h.fx.stamp(tv.x, tv.y - tv.size * 0.1, pick(p, 'text', '100T'), tv.size * 1.1, pick(p, 'color', '#ffd35c'), 1); },
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ffd35c');
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 2.6, c, 0.9);
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.6, '#ffffff', 0.6);
        h.fx.crack(tv.x, tv.y + tv.size * 0.5, tv.size * 2, c);
        h.fx.sparks(tv.x, tv.y, c, 50, 700, 7, 1);
        h.fx.debris(tv.x, tv.y + tv.size * 0.4, '#8a7a66', 16, 760, tv.y + tv.size * 0.5);
        h.ring(tv, { life: 0.7, color: c, max: 2.6, width: 10 });
        h.quake(1.8);
      },
    },
  };



  // ❤️ 專屬：甜蜜系的兩組演出（棒棒糖當大錘子）
  Object.assign(STYLES, {
    // 甜蜜重擊（普攻）：衝過去，棒棒糖砸下去——粉紅震波＋糖果和愛心炸開＋粉紅火花（不用錘擊圖：它是土色，跟粉紅甜點不搭）
    sweetSmash: {
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ff8fb8');
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.7, c, 0.7, true);
        h.fx.sparks(tv.x, tv.y, c, 22, 480, 5, 0.7); h.fx.sparks(tv.x, tv.y, '#ffffff', 10, 380, 4, 0.5);
        for (const ch of ['🍬', '💖', '🍭']) emojiBurst(tv, h, ch, 3, 420);
        h.ring(tv, { life: 0.4, color: c, max: 1.4, width: 7 });
        h.quake(0.55);
      },
    },
    // 甜蜜糖果風暴（技能）：地上浮出粉紅法陣，一堆大棒棒糖從天上砸下來，落地炸出超大愛心、糖果雨和粉紅震波
    candyBang: {
      hit: 0.75,
      fire(h, tv, p) {
        const c = pick(p, 'color', '#ff8fb8');
        h.fx.circle(tv.x, tv.y + tv.size * 0.5, tv.size * 1.6, c, 1.4);
        const n = pick(p, 'n', 9), list = ['🍭', '🍭', '🍬', '🍭'];
        for (let i = 0; i < n; i++) h.after(i * 0.05, () => {
          const x = tv.x + rnd(-tv.size * 0.9, tv.size * 0.9);
          h.fx.emoji(x, tv.y - tv.size * 2.8, list[i % list.length], tv.size * rnd(0.45, 1.1), rnd(-30, 30), rnd(520, 760), 900, 0.75, rnd(-6, 6), tv.y + tv.size * 0.5);
        });
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', '#ff8fb8'), fy = tv.y + tv.size * 0.5;
        h.fx.stamp(tv.x, tv.y - tv.size * 0.2, '❤️', tv.size * 1.5, '#ff5c9a', 1);   // 超大愛心蓋章
        h.fx.shock(tv.x, fy, tv.size * 2.6, c, 0.9, true); h.fx.shock(tv.x, fy, tv.size * 1.6, '#ffffff', 0.6, true);
        h.fx.pillar(tv.x, fy, tv.size * 1.4, tv.size * 3.2, c);
        h.fx.sparks(tv.x, tv.y, c, 46, 680, 7, 1); h.fx.sparks(tv.x, tv.y, '#ffffff', 18, 520, 5, 0.8);
        for (const ch of ['🍭', '🍬', '💖', '💗']) emojiBurst(tv, h, ch, 5, 520);
        h.fx.debris(tv.x, tv.y + tv.size * 0.4, '#ff9ec7', 10, 560, fy);
        h.ring(tv, { life: 0.7, color: c, max: 2.6, width: 10 });
        h.quake(1.3);
      },
    },
  });

  // ============================================================
  // 圖片特效組合（pixelfx，三國武將用）：config.heroFx 裡只要寫組合名稱，例如  guanyu: { attack: 'heavy', skill: 'earthSpike' }
  // 組合在下面 PRESETS 定義：base＝用哪一種演出骨架，fire＝出招那一刻放的特效，list＝打中那一刻放的特效。
  // 特效項目（每一項是一個圖片特效或零件）：
  //   n 圖片特效名稱（ML.FX_SPRITES 的名字）　w 寬度（單位：被打的人的大小的幾倍）　at 'target'（預設，放在被打的人身上）或 'self'（放在出招的人身上）
  //   ground 貼地（會被武將蓋住）　rot 'dir'＝依出招方向旋轉（會自動處理朝左）　flip 'dir'＝只在對手在左邊時左右翻面　delay 延遲秒數　life 播放秒數　dy 往下偏多少（單位：大小）
  //   fly 秒數＝從出招的人飛到對手身上　sky＝從對手頭上高處落下　bolt＝放一道落雷（零件）
  // 沒寫 sparks／quake 的特效就只有圖片；寫了會多一些火花、震動、命中星芒。
  // ============================================================
  function playList(list, tv, h, c) {
    const dx = tv.x - h.v.x, dy = tv.y - h.v.y, a = Math.atan2(dy, dx), left = Math.cos(a) < 0;
    for (const it of list || []) h.after(it.delay || 0, () => {
      if (it.bolt) { h.fx.bolt(tv.x + (it.dx || 0) * tv.size, tv.y, Math.max(tv.y + 20, tv.size * 3), c, Math.max(4, tv.size * 0.06)); return; }
      const sx = it.at === 'self' ? h.v.x : tv.x + (it.dx || 0) * tv.size, sy = (it.at === 'self' ? h.v.y : tv.y) + (it.ground ? tv.size * 0.5 : 0) + (it.dy || 0) * tv.size;
      const o = { w: tv.size * (it.w || 2.5), ground: !!it.ground, life: it.life };
      if (it.rot === 'dir') { o.rot = left ? a - Math.PI : a; o.flip = left; } else if (it.flip === 'dir') o.flip = left;
      if (it.fly || it.sky) {
        const t = typeof it.fly === 'number' ? it.fly : 0.4, x0 = it.sky ? tv.x + (it.dx || 0) * tv.size : h.v.x, y0 = it.sky ? tv.y - tv.size * 3 : h.v.y - h.v.size * 0.1;
        const d = (ML.FX_SPRITES || {})[it.n]; if (!d) return;
        o.life = t; o.loop = [0, d.frames.length - 1, 2];
        if (it.sky) { const ang = Math.atan2(tv.y - y0, tv.x + (it.dx || 0) * tv.size - x0); o.rot = ang; }
        const sp = h.fx.sprite(it.n, x0, y0, o);
        if (sp) { sp.vx = 1; sp.x0 = x0; sp.y0 = y0; sp.x1 = tv.x + (it.dx || 0) * tv.size; sp.y1 = tv.y; }
        return;
      }
      h.fx.sprite(it.n, sx, sy, o);
    });
  }
  function sprExtras(tv, h, p) {
    const c = pick(p, 'color', h.color);
    if (p.hitSpark !== false) h.fx.hit(tv.x, tv.y, tv.size * 0.8);
    if (p.sparks) h.fx.sparks(tv.x, tv.y, p.sparks === true ? c : p.sparks, 22, 480, 5, 0.7);
    if (p.ring) h.ring(tv, { life: 0.5, color: c, max: 1.8, width: 6 });
    if (p.quake) h.quake(p.quake);
  }
  Object.assign(STYLES, {
    // 近戰普攻：衝過去，打中那一刻放圖片特效
    sprMelee: { lunge: true, hit: 0.31, onHit(tv, h, p) { playList(p.list, tv, h, pick(p, 'color', h.color)); sprExtras(tv, h, p); } },
    // 遠程普攻：不衝，出招那一刻放飛行的東西，打中放爆開
    sprShot: { lunge: false, hit: 0.45, fire(h, tv, p) { playList(p.fire, tv, h, pick(p, 'color', h.color)); }, onHit(tv, h, p) { playList(p.list, tv, h, pick(p, 'color', h.color)); sprExtras(tv, h, p); } },
    // 技能：出招那一刻先放（集氣、飛行），打中放主特效
    sprSkill: { lunge: false, hit: 0.6, fire(h, tv, p) { playList(p.fire, tv, h, pick(p, 'color', h.color)); }, onHit(tv, h, p) { playList(p.list, tv, h, pick(p, 'color', h.color)); sprExtras(tv, h, Object.assign({ hitSpark: false, ring: true }, p)); } },
  });
  const PRESETS = {
    // ----- 普攻 -----
    heavy:     { base: 'sprMelee', list: [{ n: 'px_melee_heavy-cleave', w: 3.4, rot: 'dir' }], sparks: true },
    double:    { base: 'sprMelee', list: [{ n: 'px_melee_double-slash', w: 3, rot: 'dir' }] },
    spin:      { base: 'sprMelee', list: [{ n: 'px_melee_spin-slash', w: 3, flip: 'dir' }] },
    flurry:    { base: 'sprMelee', list: [{ n: 'px_melee_dagger-flurry', w: 2.8, rot: 'dir' }] },
    sweep:     { base: 'sprMelee', list: [{ n: 'px_melee_spear-sweep', w: 3.4, flip: 'dir' }] },
    scythe:    { base: 'sprMelee', list: [{ n: 'px_melee_scythe-reap', w: 3, flip: 'dir' }], sparks: '#b48cff' },
    hammerHit: { base: 'sprMelee', list: [{ n: 'px_melee_hammer-smash', w: 3, flip: 'dir', ground: true }], quake: 0.5, sparks: true },
    arrowShot: { base: 'sprShot', fire: [{ n: 'px_projectiles_arrow', w: 1.3, at: 'self', fly: 0.35, rot: 'dir' }], list: [] },
    fireballShot: { base: 'sprShot', fire: [{ n: 'px_fire_fireball', w: 1.8, at: 'self', fly: 0.45, rot: 'dir' }], list: [{ n: 'fire_fireball-impact', w: 2.4 }], sparks: '#ffb04a' },
    missiles:  { base: 'sprShot', hit: 0.5, fire: [{ n: 'px_arcane_arcane-missiles', w: 3.8, at: 'self', rot: 'dir' }], list: [], sparks: '#c58bff' },
    // ----- 技能 -----
    holyStrike:  { base: 'sprSkill', list: [{ n: 'px_holy_smite', w: 3.4 }], quake: 0.6 },
    holyPillar:  { base: 'sprSkill', list: [{ n: 'px_holy_holy-pillar', w: 3.4 }], quake: 0.6 },
    earthSpike:  { base: 'sprSkill', list: [{ n: 'px_nature_earth-spike', w: 4, ground: true }], quake: 0.9, sparks: '#c9a66b' },
    quake:       { base: 'sprSkill', list: [{ n: 'px_nature_quake', w: 5, ground: true }], quake: 1.2 },
    sweepWave:   { base: 'sprSkill', hit: 0.5, list: [{ n: 'px_melee_spear-sweep', w: 5, flip: 'dir' }, { n: 'px_melee_spear-sweep', w: 4, flip: 'dir', delay: 0.15, dy: -0.15 }], quake: 0.7 },
    thunderBlast:{ base: 'sprSkill', list: [{ bolt: true }, { bolt: true, delay: 0.1, dx: -0.5 }, { bolt: true, delay: 0.2, dx: 0.5 }, { n: 'px_lightning_zap-hit', w: 3, delay: 0.1 }], quake: 0.8 },
    thunderRing: { base: 'sprSkill', list: [{ bolt: true }, { bolt: true, delay: 0.12, dx: -0.6 }, { bolt: true, delay: 0.24, dx: 0.6 }, { n: 'px_fire_fire-ring', w: 5, ground: true, delay: 0.1 }], quake: 0.9 },
    tornado:     { base: 'sprSkill', hit: 0.7, list: [{ n: 'px_fire_fire-tornado', w: 2.8, ground: true, dy: -0.4, life: 2 }], quake: 0.8 },
    fireRing:    { base: 'sprSkill', list: [{ n: 'px_fire_fire-ring', w: 5, ground: true }], quake: 0.8 },
    meteor:      { base: 'sprSkill', hit: 0.8, list: [{ n: 'px_fire_meteor', w: 6, ground: true }], quake: 1.4 },
    firePillar:  { base: 'sprSkill', list: [{ n: 'px_fire_flame-pillar', w: 3, ground: true }], quake: 0.9 },
    fireStorm:   { base: 'sprSkill', list: [{ n: 'px_fire_flame-pillar', w: 3, ground: true }, { n: 'px_fire_fire-ring', w: 5, ground: true, delay: 0.2 }], quake: 1.1 },
    frostNova:   { base: 'sprSkill', list: [{ n: 'px_ice_frost-nova', w: 5, ground: true }], quake: 0.5, sparks: '#bfe8ff' },
    iceSpikes:   { base: 'sprSkill', list: [{ n: 'px_ice_ice-spikes', w: 5, ground: true }], quake: 0.7, sparks: '#bfe8ff' },
    darkBurst:   { base: 'sprSkill', list: [{ n: 'px_shadow_dark-explosion', w: 5, ground: true }], quake: 1, sparks: '#b48cff' },
    curse:       { base: 'sprSkill', list: [{ n: 'px_shadow_curse', w: 2.6, dy: -0.2 }], quake: 0.4, sparks: '#b48cff' },
    starFall:    { base: 'sprSkill', hit: 0.7, list: [{ n: 'px_arcane_star-fall', w: 5, ground: true }], quake: 0.8, sparks: '#ffe9a8' },
    wave:        { base: 'sprSkill', list: [{ n: 'px_water_wave-crash', w: 5, ground: true }], quake: 0.6, sparks: '#9bdcff' },
    plasma:      { base: 'sprSkill', list: [{ n: 'px_explosions_plasma-explosion', w: 4.4 }], quake: 1, sparks: '#9fb0ff' },
    healRing:    { base: 'sprSkill', fire: [{ n: 'px_holy_heal-aoe', w: 3.4, at: 'self', ground: true, life: 1.6 }], list: [{ n: 'px_holy_smite', w: 3 }], quake: 0.5 },
    arrowRain:   { base: 'sprSkill', hit: 0.6, fire: [-1, -0.5, 0, 0.5, 1].map((d, i) => ({ n: 'px_projectiles_arrow', w: 1.3, sky: true, fly: 0.45, dx: d * 0.9, delay: i * 0.05 })), list: [{ n: 'px_fire_flame-pillar', w: 2.4, ground: true }], quake: 0.7 },
    arrowVolley: { base: 'sprSkill', hit: 0.55, fire: [-0.8, -0.4, 0, 0.4, 0.8].map((d, i) => ({ n: 'px_projectiles_arrow', w: 1.3, at: 'self', fly: 0.4, rot: 'dir', dx: d, delay: i * 0.06 })), list: [{ n: 'px_impacts_crit-hit', w: 2.8 }], quake: 0.6 },
    fireballBlast:{ base: 'sprSkill', hit: 0.55, fire: [{ n: 'px_fire_fireball', w: 2.4, at: 'self', fly: 0.5, rot: 'dir' }], list: [{ n: 'px_fire_fire-ring', w: 4.4, ground: true }], quake: 0.9 },
  };

  // 沒登記的萌國角色：依武將代號自動配一組（同一個代號每次都一樣；不同角色大多不一樣）
  const AUTO_EMOJI = ['⭐', '🍩', '🍀', '🍓', '🌸', '🔥', '💫', '🍉', '🍭', '🎈'];
  const AUTO_ATTACK = ['bite', 'claw', 'emojiPop', 'projectile', 'shockSmash'];
  const AUTO_SKILL = ['emojiRain', 'windBlades', 'heartWave', 'emojiStorm', 'tigerPounce'];
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  function auto(heroId, kind) {
    const h = hash(heroId), list = kind === 'skill' ? AUTO_SKILL : AUTO_ATTACK;
    return { style: list[h % list.length], emoji: AUTO_EMOJI[Math.floor(((h * 2654435761) >>> 0) / 4294967296 * AUTO_EMOJI.length)] };
  }

  // 查某隻武將的某種動作（'attack'／'skill'）有沒有專屬特效。回傳 { def, p } 或 null（null＝用原本依兵種的演出）
  ML.heroFx = {
    STYLES, PRESETS,
    pick(config, hero, kind) {
      if (!hero || !hero.heroId || hero.isBoss || hero.heroId === 'struct') return null;
      let entry = ((config.heroFx || {})[hero.heroId] || {})[kind];
      if (!entry && hero.faction === 'Meng' && config.heroFxAuto !== false) entry = auto(hero.heroId, kind);
      if (!entry) return null;
      let p = typeof entry === 'string' ? { style: entry } : entry, def = STYLES[p.style];
      if (!def && PRESETS[p.style]) { const pr = PRESETS[p.style]; def = STYLES[pr.base]; p = Object.assign({}, pr, p); if (pr.hit) def = Object.assign({}, def, { hit: pr.hit }); }   // 組合名稱：展開成骨架＋參數（hit 可以覆蓋命中秒數）
      return def ? { def, p } : null;
    },
  };
})();
