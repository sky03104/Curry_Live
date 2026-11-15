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
      h.fx.emoji(tv.x, tv.y, ch, tv.size * rnd(0.28, 0.45), Math.cos(a) * s, Math.sin(a) * s - 120, 600, rnd(0.6, 1), rnd(-8, 8));
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
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.6, c, 0.6);
        h.fx.crack(tv.x, tv.y + tv.size * 0.5, tv.size * 1.1, c);
        h.fx.sparks(tv.x, tv.y, c, 24, 500, 6, 0.7);
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
          h.fx.emoji(x, tv.y - tv.size * 2.6, ch, size, rnd(-30, 30), rnd(500, 700), 900, 0.7, rnd(-6, 6));
        });
      },
      onHit(tv, h, p) {
        const c = pick(p, 'color', h.color);
        emojiBurst(tv, h, pick(p, 'emoji', '⭐'), 8, 460);
        h.fx.shock(tv.x, tv.y + tv.size * 0.5, tv.size * 1.8, c, 0.7);
        h.fx.sparks(tv.x, tv.y, c, 30, 560, 6, 0.8);
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
          h.fx.slash(tv.x, tv.y, a, tv.size * rnd(0.8, 1.2), c);
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
        h.ring(tv, { life: 0.7, color: c, max: 2.6, width: 10 });
        h.quake(1.8);
      },
    },
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
    STYLES,
    pick(config, hero, kind) {
      if (!hero || !hero.heroId || hero.isBoss || hero.heroId === 'struct') return null;
      let entry = ((config.heroFx || {})[hero.heroId] || {})[kind];
      if (!entry && hero.faction === 'Meng' && config.heroFxAuto !== false) entry = auto(hero.heroId, kind);
      if (!entry) return null;
      const p = typeof entry === 'string' ? { style: entry } : entry, def = STYLES[p.style];
      return def ? { def, p } : null;
    },
  };
})();
