// ============================================================
// 畫面層：排位置、程式動態（彈跳、衝撞、閃白、震動）、名字、血條、排行榜、訊息。
// 這裡不改遊戲規則，只把 game.js 算好的結果「演」出來。
// 角色本體怎麼畫交給 hero-sprite.js。
// ============================================================
window.ML = window.ML || {};

ML.createRenderer = function (canvas, game, config, sprite, effects, getLegend, arenas) {
  const ctx = canvas.getContext('2d');
  const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif';
  let raceGeo = null;          // 賽跑：橢圓跑道的位置與大小（每格排位置時重算）
  let lastModeName = 'brawl';  // 上一次排位置時的模式（亂鬥／陣營／賽跑），一換就重排所有武將
  let lastTeamMode = false;   // 上一次排位置時是不是陣營模式（模式一換就重排）
  const views = new Map();   // 觀眾代號 → 畫面上這隻武將的顯示狀態
  let floats = [];           // 飄起來的字（傷害數字、補血、技能名）
  let rings = [];            // 擴散的圓圈（全場攻擊、技能命中）
  let timers = [];           // 「幾秒後做某事」（讓扣血剛好發生在撞到的那一刻）
  const toastLife = config.toastSeconds || 60;   // 訊息停留秒數（最後 1 秒逐漸變淡）
  let toasts = [];           // 左下角訊息
  let time = 0, W = 0, H = 0, viewK = 1;   // viewK：畫面整體縮小的比例（很小的直播畫面會等比例縮小來畫）
  let dim = null;            // 技能發動時畫面短暫變暗
  let toastBox = null;       // 橫式且有禮物提示列時：系統訊息放在提示列左邊（{ right, bottom, w }）；沒有就 null，訊息放回排行榜下面
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

  // 替一隻武將（或 BOSS）建立畫面上的顯示狀態。上場通知和排位置時都會用到：排位置時發現有人沒有顯示狀態，也會補建，不會因為漏了通知就看不到
  function makeView(p) {
    if (!p || views.has(p.id)) return views.get(p.id);
    sprite.preload(p.hero);   // 先去下載這隻的圖（用到才載入）
    const v = { id: p.id, boss: !!p.isBoss, deadT: 0, x: null, y: null, size: p.isBoss ? 200 : 80, hp: p.hp, shownHp: p.hp, down: !!p.down,
      flash: 0, shake: 0, hop: 1, hopH: 1.2, lunge: null, pending: 0, kbx: 0, kby: 0, face: -1, faceShown: -1, phase: Math.random() * 6 };
    views.set(p.id, v);
    return v;
  }
  // ---------- 接收遊戲通知，排入動態 ----------
  let leavers = [];          // 烙跑的武將：已經不在遊戲裡了，但畫面上還要演完「跑出畫面」
  game.onFx(e => {
    if (e.type === 'leave') {
      // 烙跑：畫面上的角色朝最近的那一邊跑出去（越跑越快、越來越淡），揚起一陣塵土
      const v = views.get(e.id);
      views.delete(e.id);
      if (v && v.x !== null) {
        const dir = v.x < W / 2 ? -1 : 1;
        leavers.push({ hero: e.hero, x: v.x, y: v.y, size: v.size, dir, age: 0, life: 1.5, dust: 0 });
        effects.sparks(v.x, feet(v), '#e8dcc0', 16, 260, 6, 0.6, 0);
      }
      return;
    }
    if (e.type === 'notice') {
      toasts.push({ text: e.text, age: 0 });
      if (toasts.length > 4) toasts.shift();
      return;
    }
    if (e.type === 'join') {
      const p = game.getPlayer(e.id);
      makeView(p);
      if (W > 0) layout();   // 馬上排好位置：上場和送禮可能發生在同一瞬間（沒上場就送禮會自動上場），攻擊演出需要它的位置
      return;
    }
    if (e.type === 'teamWin') {   // 分出勝負：贏的那方主堡噴金光、整個畫面震一下
      for (const sv of views.values()) {
        if (!sv.struct) continue;
        const st = game.getPlayer(sv.id);
        if (st && st.kind === 'base' && e.team !== 'draw' && st.team === e.team) { effects.pillar(sv.x, feet(sv), sv.size * 1.4, sv.size * 3.2, '#ffd35c'); effects.sparks(sv.x, sv.y, '#ffd35c', 60, 700, 7, 1.2); rings.push({ v: sv, age: 0, life: 1.2, color: '#ffd35c', max: 3, width: 12 }); }
      }
      quake = 1.6;
      return;
    }
    const v = views.get(e.id);
    if (!v) return;
    if (e.type === 'structDown') {         // 防禦塔／主堡被打爆：碎石、火花、震動
      v.shake = 1.2; quake = 1.4;
      effects.sparks(v.x, v.y, '#ffb347', 50, 640, 7, 1);
      effects.crack(v.x, feet(v), v.size * 1.6, '#ffb347');
      rings.push({ v, age: 0, life: 0.8, color: '#ffb347', max: 2.4, width: 10 });
      floats.push({ v, text: '摧毀！', color: '#ffb347', scale: 1.5, age: 0, life: 2 });
      return;
    }
    if (e.type === 'raceJoin') { v.hop = 1; v.hopH = 0.7; rings.push({ v, age: 0, life: 0.5, color: '#ffd35c', max: 1.6, width: 6 }); floats.push({ v, text: '參賽！', color: '#ffd35c', scale: 1.1, age: 0, life: 1.4 }); return; }
    if (e.type === 'raceRest') { v.moving = false; startAnim(v, 'idle'); floats.push({ v, text: '💤', color: '#9ad0ff', scale: 1.1, age: 0, life: 1.6 }); return; }
    if (e.type === 'raceBoost') {      // 玫瑰助力：花瓣往上飄、一圈光
      for (let i = 0; i < Math.min(14, 4 + e.n * 2); i++) effects.emoji(v.x + (Math.random() - 0.5) * v.size, v.y, Math.random() < 0.5 ? '🌹' : '🌸', v.size * (0.25 + Math.random() * 0.2), (Math.random() - 0.5) * 80, -(80 + Math.random() * 120), 40, 1 + Math.random() * 0.5, (Math.random() - 0.5) * 6, v.y + v.size * 0.5);
      rings.push({ v, age: 0, life: 0.6, color: '#ff8fb8', max: 1.8, width: 6 }); floats.push({ v, text: '加速！', color: '#ff8fb8', scale: 1, age: 0, life: 1.2 }); return;
    }
    if (e.type === 'raceHinder') {     // GG 干擾：頭上一朵烏雲
      effects.emoji(v.x, v.y - v.size * 0.85, '☁️', v.size * 0.7, 0, 0, 0, 1.6, 0);
      for (let i = 0; i < 4; i++) effects.emoji(v.x + (Math.random() - 0.5) * v.size * 0.6, v.y - v.size * 0.55, '💢', v.size * 0.28, (Math.random() - 0.5) * 60, 80 + Math.random() * 80, 200, 0.8, 0, v.y + v.size * 0.5);
      v.shake = 0.8; floats.push({ v, text: '被干擾！', color: '#c9b3ff', scale: 1, age: 0, life: 1.2 }); return;
    }
    if (e.type === 'raceFinish') { v.moving = false; v.hop = 1; v.hopH = 1.2; effects.sparks(v.x, v.y, '#ffd35c', 30, 520, 6, 0.9); floats.push({ v, text: '完賽！', color: '#ffd35c', scale: 1.3, age: 0, life: 1.8 }); return; }
    if (e.type === 'teamJoin') {           // 選隊／換隊：隊色光圈
      const tcol = (config.team.colors || {})[e.team] || '#fff';
      v.hop = 1; v.hopH = 0.6;
      rings.push({ v, age: 0, life: 0.5, color: tcol, max: 1.6, width: 6 });
      floats.push({ v, text: (config.team.names || {})[e.team] || e.team, color: tcol, scale: 1.1, age: 0, life: 1.4 });
      return;
    }
    if (e.type === 'bossSpawn') {         // BOSS 降臨：等版面排好位置（下一格）再放紫色光柱、震動、畫面變暗
      after(0.25, () => {
        if (!views.has(e.id) || v.x === null) return;
        dim = { age: 0, life: 2 };
        quake = 1.6; v.shake = 0.8;
        effects.pillar(v.x, feet(v), v.size * 1.3, v.size * 3, '#b45cff');
        effects.crack(v.x, feet(v), v.size * 1.8, '#b45cff');
        effects.sparks(v.x, feet(v), '#d9a8ff', 50, 620, 7, 0.9);
        rings.push({ v, age: 0, life: 0.9, color: '#b45cff', max: 2.6, width: 12 });
        floats.push({ v, text: `BOSS 降臨！`, color: '#d9a8ff', scale: 1.6, age: 0, life: 2.4 });
      });
      return;
    }
    if (e.type === 'bossDefeated') {      // 打倒 BOSS：大爆發、金色字樣
      v.shake = 1; quake = 1.8;
      effects.sparks(v.x, v.y, '#ffd35c', 70, 700, 7, 1.1);
      effects.pillar(v.x, feet(v), v.size * 1.2, v.size * 3, '#ffd35c');
      rings.push({ v, age: 0, life: 1, color: '#ffd35c', max: 3, width: 12 });
      floats.push({ v, text: 'BOSS 被打倒！', color: '#ffd35c', scale: 1.6, age: 0, life: 2.6 });
      floats.push({ v, text: `每人 +${e.share} 經驗　尾刀 ${e.killer} +${e.bonus}`, color: '#fff3c0', scale: 0.75, age: 0.2, life: 3 });
      return;
    }
    if (e.type === 'levelSet') {          // 主播調整等級：白色光點、跳出新等級
      const p = game.getPlayer(e.id);
      v.hop = 1; v.hopH = 0.6;
      if (p && v.pending === 0) { v.hp = p.hp; v.shownHp = p.hp; }
      effects.rise(v.x, v.y, '#ffffff', 18, v.size * 0.4);
      floats.push({ v, text: `調整為 Lv.${e.level}`, color: '#ffffff', scale: 1.1, age: 0, life: 1.6 });
      return;
    }
    if (e.type === 'levelup') {           // 升級：金色光柱、光點往上飄、跳出等級
      const p = game.getPlayer(e.id);
      v.hop = 1; v.hopH = 0.9;
      if (v.pending === 0) { v.hp = p.hp; v.shownHp = p.hp; }
      effects.pillar(v.x, feet(v), v.size * 0.9, v.size * 2.2, '#ffd35c');
      effects.rise(v.x, v.y, '#ffd35c', 26, v.size * 0.45);
      floats.push({ v, text: `升級！Lv.${e.level}`, color: '#ffd35c', scale: 1.2, age: 0, life: 1.6 });
    } else if (e.type === 'switch') {            // 換武將：一陣光點、跳一下，血條直接對到新數值
      const p = game.getPlayer(e.id);
      v.hop = 1; v.hopH = 0.8; v.flash = 1;
      if (v.pending === 0) { v.hp = p.hp; v.shownHp = p.hp; }
      effects.sparks(v.x, v.y, '#ffffff', 18, 320, 5, 0.5, 0);
      rings.push({ v, age: 0, life: 0.4, color: '#ffffff', max: 1.2 });
    } else if (e.type === 'revive' && e.quiet) {   // 新的一場：大家一起復活，只跳一下
      v.hop = 1; v.hopH = 0.6;
    } else if (e.type === 'revive') {
      v.hop = 1; v.hopH = 1.4; v.flash = 1;
      effects.pillar(v.x, feet(v), v.size * 0.9, v.size * 2.2, '#ffe27a');
      effects.rise(v.x, v.y, '#ffe27a', 22, v.size * 0.4);
      floats.push({ v, text: '復活！', color: '#ffe27a', scale: 1.3, age: 0 });
    } else if (e.type === 'buffGain') {      // 獲得 BUFF：藍／紅色光柱＋字樣
      const c = e.kind === 'regen' ? '#4db8ff' : '#ff5c4d';
      v.hop = 1; v.hopH = 1;
      effects.pillar(v.x, feet(v), v.size * 0.9, v.size * 2.4, c);
      effects.rise(v.x, v.y, c, 24, v.size * 0.5);
      rings.push({ v, age: 0, life: 0.7, color: c, max: 1.8, width: 8 });
      floats.push({ v, text: e.text, color: c, scale: 1.3, age: 0, life: 1.8 });
    } else if (e.type === 'heal' && e.quiet) {   // 藍BUFF 的持續回血：只跳一個小小的綠色字
      floats.push({ v, text: '+' + e.amount, color: '#7dffa0', scale: 0.7, age: 0, life: 1 });
    } else if (e.type === 'heal') {
      v.hop = 1; v.hopH = 0.5;
      effects.rise(v.x, v.y + v.size * 0.2, '#7dffa0', 20, v.size * 0.4);
      rings.push({ v, age: 0, life: 0.5, color: '#7dffa0', max: 1.2 });
      floats.push({ v, text: '+' + e.amount, color: '#7dffa0', scale: 1, age: 0 });
      startAnim(v, 'eat');   // 有「吃東西」動畫的武將（米其林）回血時播一次
    } else if (e.type === 'attack') {
      const hero = game.getPlayer(e.id).hero;
      const color = bright((config.factions[hero.faction] || { color: '#cccccc' }).color);
      const big = e.action === 'skill';
      const tv0 = views.get(e.hits[0].id);
      // 專屬特效（js/hero-fx.js）：這隻武將的普攻／技能有登記（或萌國自動配）時用它，否則照原本依兵種的演出
      const fxs = (!v.fixed && !v.boss && ML.heroFx && e.action !== 'aoe') ? ML.heroFx.pick(config, hero, big ? 'skill' : 'attack') : null;
      const H = { v, fx: effects, color, after, quake: n => { quake = Math.max(quake, n); },
        ring: (t, o) => rings.push(Object.assign({ v: t, age: 0 }, o)),
        float: (t, txt, c, sc) => floats.push({ v: t, text: txt, color: c, scale: sc || 1.2, age: 0, life: 1.4 }) };
      let customSkill = false;
      const color2 = v.fixed ? ((config.team.colors || {})[(game.getPlayer(e.id) || {}).team] || '#ffffff') : color;
      let delay;       // 幾秒後「打中」
      let onHit;       // 打中那一刻，在每個被打的人身上放的特效
      v.hold = 1.6; v.goal = null;   // 出招期間站定不走動
      if (e.action !== 'aoe' && !big) startAnim(v, 'attack');   // 有出招逐格動畫的武將（魚哥）：普攻播 attack
      if (tv0 && e.action !== 'aoe' && tv0.x !== v.x) v.face = Math.sign(tv0.x - v.x);   // 轉身面向對手

      if (v.fixed && tv0) {              // 防禦塔反擊：頂端射出光彈
        effects.orb(v.x, v.y - v.size * 0.3, tv0.x, tv0.y, v.size * 0.3, color2, 0.5);
        delay = 0.5;
        onHit = tv => { effects.sparks(tv.x, tv.y, color2, 24, 460, 6, 0.7); rings.push({ v: tv, age: 0, life: 0.4, color: color2, max: 1.2 }); };
      } else if (e.action === 'aoe') {
        // 全場攻擊（大招，刻意做得慢、做得大，讓觀眾看得出「每個人都被打到」）：
        //   集氣（畫面變暗、跳出招式名）→ 高高跳起 → 落地：地裂＋兩道震波往外擴散
        //   → 震波掃到誰，誰就被金色光柱打中、噴火花、被震退（離得越遠越晚被打到）
        const charge = 0.5, land = charge + 0.38;
        dim = { age: 0, life: land + 1.3 };
        v.shake = 0.5; v.hold = 2.4;
        effects.converge(v.x, v.y, '#ffd35c', v.size * 1.2, charge);
        floats.push({ v, text: e.label || '全場攻擊！', color: v.boss ? '#d9a8ff' : '#ffd35c', scale: 1.4, age: 0, life: 2 });
        after(charge, () => { v.hop = 1; v.hopH = 1.8; });
        after(land, () => {
          rings.push({ v, age: 0, life: 0.9, color: '#ffd35c', max: 0, width: 18 });
          effects.crack(v.x, feet(v), v.size * 1.4, '#ffd35c');
          effects.sparks(v.x, feet(v), '#ffd35c', 40, 560, 6, 0.8);
          quake = 1.2;
        });
        after(land + 0.18, () => rings.push({ v, age: 0, life: 0.9, color: '#fff3c0', max: 0, width: 8 }));
        const far = Math.hypot(W, H) * 0.5;
        delay = tv => land + 0.08 + Math.min(1, Math.hypot(tv.x - v.x, tv.y - v.y) / far) * 0.75;   // 震波掃到的時間
        onHit = tv => {
          effects.pillar(tv.x, feet(tv), tv.size * 0.9, tv.size * 2.2, '#ffd35c');
          effects.crack(tv.x, feet(tv), tv.size * 0.7, '#ffd35c');
          effects.sparks(tv.x, tv.y, '#ffd35c', 22, 460, 5, 0.7);
          rings.push({ v: tv, age: 0, life: 0.45, color: '#ff6b5c', max: 1.5 });
        };
      } else if (!big && fxs) {            // 專屬普攻
        const ai = sprite.animInfo(hero.heroId, 'attack'), hitT = ai && ai.hit;
        if (fxs.def.lunge !== false) v.lunge = { to: e.hits[0].id, t: 0, dur: (hitT || fxs.def.hit || 0.31) * 2 };
        delay = hitT || fxs.def.hit || 0.31;
        if (fxs.def.fire && tv0) fxs.def.fire(H, tv0, fxs.p);
        onHit = tv => fxs.def.onHit(tv, H, fxs.p);
      } else if (!big) {
        // 普攻：衝過去砍一刀（2026-11-13 放慢放大：衝撞時間拉長、刀光變大、多一圈衝擊波）
        const ai = sprite.animInfo(hero.heroId, 'attack'), hitT = ai && ai.hit;   // 動畫有登記打中的那一格（hitFrame）：衝撞和傷害的時間跟著它走（小妮的大錘慢動作）
        v.lunge = { to: e.hits[0].id, t: 0, dur: hitT ? hitT * 2 : 0.62 };
        delay = hitT || 0.31;
        onHit = tv => {
          effects.slash(tv.x, tv.y, Math.atan2(tv.y - v.y, tv.x - v.x), tv.size * 0.9, color);
          effects.sparks(tv.x, tv.y, '#ffe9a8', 22, 460, 6, 0.7);
          rings.push({ v: tv, age: 0, life: 0.4, color: '#ffe9a8', max: 1.1 });
        };
      } else {
        // 技能：先集氣（畫面變暗、光點往身上收、跳出技能名），再依兵種演出
        // （2026-11-13 放慢放大：集氣拉長、每種演出的特效都加大並多停留一下）
        const charge = 0.85;
        const style = (config.troops[hero.troop] || {}).skillFx || 'slam';
        dim = { age: 0, life: charge + 1.3 };
        v.shake = 0.6; v.hold = 2.6;
        effects.converge(v.x, v.y, color, v.size * 1.4, charge);
        floats.push({ v, text: `「${e.skillName}」`, color: '#ffd35c', scale: 1.5, age: 0, life: 2.3 });
        if (!tv0) return;

        if (fxs) {                          // 專屬技能
          const si2 = sprite.animInfo(hero.heroId, 'skill'), hitS2 = si2 && si2.hit, base = hitS2 || fxs.def.hit || 0.5;
          customSkill = true;
          delay = charge + base;
          if (fxs.def.lunge) after(charge, () => { v.lunge = { to: tv0.id, t: 0, dur: base * 2 }; startAnim(v, 'skill'); if (fxs.def.fire) fxs.def.fire(H, tv0, fxs.p); });
          else {
            after(charge, () => { v.hop = 1; v.hopH = 0.5; if (fxs.def.fire) fxs.def.fire(H, tv0, fxs.p); if (hitS2) startAnim(v, 'skill'); });
            if (!hitS2) after(Math.max(0.2, delay - 0.65), () => startAnim(v, 'skill'));
          }
          onHit = tv => fxs.def.onHit(tv, H, fxs.p);
        } else if (style === 'slam') {            // 猛將：衝過去重擊，地面裂開
          const si = sprite.animInfo(hero.heroId, 'skill'), hitS = si && si.hit;   // 同上：技能動畫有 hitFrame 就照它的時間
          after(charge, () => { v.lunge = { to: tv0.id, t: 0, dur: hitS ? hitS * 2 : 0.72 }; startAnim(v, 'skill'); });
          delay = charge + (hitS || 0.36);
          onHit = tv => {
            const ang = Math.atan2(tv.y - v.y, tv.x - v.x);
            effects.slash(tv.x, tv.y, ang, tv.size * 1.3, color);
            after(0.12, () => effects.slash(tv.x, tv.y, ang + Math.PI * 0.6, tv.size * 1.1, '#ffffff'));   // 第二刀，交叉斬
            effects.crack(tv.x, feet(tv), tv.size * 1.7, color);
            effects.sparks(tv.x, tv.y, color, 45, 620, 7, 0.9);
            rings.push({ v: tv, age: 0, life: 0.6, color, max: 2.2, width: 8 });
            quake = 1.3;
          };
        } else if (style === 'magic') {    // 謀士：對手腳下出現法陣，然後連續落雷
          after(charge, () => { v.hop = 1; v.hopH = 0.6; effects.circle(tv0.x, feet(tv0), tv0.size * 1.3, color, 1.5); });
          delay = charge + 0.7;
          onHit = tv => {
            const strike = () => effects.bolt(tv.x, tv.y, Math.max(tv.y + 20, tv.size * 3), color, Math.max(5, tv.size * 0.07));
            strike(); after(0.14, strike); after(0.28, strike);
            effects.sparks(tv.x, tv.y, color, 40, 560, 7, 0.9);
            rings.push({ v: tv, age: 0, life: 0.6, color, max: 2, width: 8 });
            quake = 1;
          };
        } else if (style === 'ranged') {   // 遊俠：射出大光彈，命中爆開
          after(charge, () => { v.hop = 1; v.hopH = 0.4; effects.orb(v.x, v.y, tv0.x, tv0.y, v.size * 0.4, color, 0.5); });
          delay = charge + 0.5;
          onHit = tv => {
            effects.sparks(tv.x, tv.y, color, 50, 640, 7, 0.9);
            rings.push({ v: tv, age: 0, life: 0.55, color, max: 2.2, width: 8 });
            rings.push({ v: tv, age: 0, life: 0.8, color: '#ffffff', max: 3, width: 4 });
            quake = 0.9;
          };
        } else {                            // 統帥：自身光環爆發，對手被大光柱擊中
          after(charge, () => {
            v.hop = 1; v.hopH = 0.7;
            rings.push({ v, age: 0, life: 0.8, color, max: 3.5, width: 8 });
            effects.sparks(v.x, v.y, color, 36, 520, 6, 0.8, 0);
          });
          delay = charge + 0.5;
          onHit = tv => {
            effects.pillar(tv.x, feet(tv), tv.size * 1.6, tv.size * 3.2, color);
            effects.crack(tv.x, feet(tv), tv.size * 1.2, color);
            effects.sparks(tv.x, feet(tv), color, 40, 560, 7, 0.9);
            rings.push({ v: tv, age: 0, life: 0.6, color, max: 2, width: 8 });
            quake = 1;
          };
        }
      }

      // 技能不是「衝撞」型（謀士、遊俠、統帥）的武將若有 skill 逐格動畫：算好打中的時間，讓動畫的打擊那一格剛好對上（動畫約 0.65 秒後打到）
      if (big && !customSkill && typeof delay === 'number' && ((config.troops[hero.troop] || {}).skillFx || 'slam') !== 'slam') after(Math.max(0.2, delay - 0.65), () => startAnim(v, 'skill'));
      for (const h of e.hits) {
        const tv = views.get(h.id);
        if (!tv) continue;
        tv.pending++;
        const strong = big || e.action === 'aoe';   // 技能與全場攻擊：震得大、退得遠、數字大
        after(typeof delay === 'function' ? delay(tv) : delay, () => {
          tv.pending--;
          tv.hp -= h.dmg;
          if (h.down) tv.down = true;
          tv.flash = 1; tv.shake = strong ? 2 : 1.4;
          // 被打的人往「遠離攻擊者」的方向退一下
          const dx = tv.x - v.x, dy = tv.y - v.y, d = Math.hypot(dx, dy) || 1;
          const push = tv.size * (strong ? 0.5 : 0.3);
          tv.kbx = dx / d * push; tv.kby = dy / d * push;
          effects.sparks(tv.x, tv.y, '#ffffff', 6, 260, 3);   // 碎光
          onHit(tv);
          floats.push({ v: tv, text: '-' + h.dmg, color: strong ? '#ffb13c' : '#ff5c4d', scale: strong ? 1.6 : 1.2, age: 0, life: strong ? 1.8 : 1.4 });
        });
      }
    }
  });

  // ---------- 排位置 ----------
  function layout() {
    const list = game.getPlayers().filter(p => !p.isBoss);   // BOSS 不參與一般武將的排位
    list.forEach(makeView);   // 保險：場上有人沒有顯示狀態就補建
    const bp = game.getPlayer('boss'); if (bp && bp.isBoss) makeView(bp);
    const n = list.length;
    const wide = W >= H;
    const lbW = wide ? clamp(W * 0.26, 260, 340) : W - 32;
    const lbRows = game.getMode() === 'race' ? 5 : Math.max(1, game.getLeaderboard().length);   // 賽跑時右上角改顯示前 5 名
    const lbH = 50 + lbRows * 32;
    const lb = { x: W - lbW - 16, y: 16, w: lbW, h: lbH };
    // 對 BOSS 的傷害排行榜：放在傷害排行榜正下方，場上有 BOSS 才出現（2026-11-14 咖哩要求）
    const bl = game.getBossLeaderboard();
    // 橫式：放在傷害排行榜「左邊」、頂端對齊（2026-11-14 咖哩要求，直播畫面下方版面不夠）；直式：維持放在正下方
    const lb2 = bl ? { x: wide ? lb.x - 10 - lb.w : lb.x, y: wide ? lb.y : lb.y + lb.h + 10, w: lb.w, h: 50 + Math.max(1, bl.rows.length) * 32, data: bl } : null;
    const top = lb2 && !wide ? lb2.y + lb2.h - lb.y : lbH;   // 排行榜們（一個或兩個）合起來佔的高度
    const arena = wide ? { x: 16, y: 16, w: W - lbW - 48 - (lb2 ? lb2.w + 10 : 0), h: H - 32 }   // 橫式：對 BOSS 排行榜出現時，場地也往左讓出它那一塊
                       : { x: 16, y: top + 32, w: W - 32, h: H - top - 48 - 100 };   // 直式：底下留 100 給訊息
    // 禮物提示列：告訴觀眾「送哪個禮物會觸發哪個動作」。
    // （2026-11-13 咖哩要求移到畫面右下角；2026-11-14 再要求改成「一排直的」：一個動作一列，從右下角往上疊。
    //   空間不夠（排行榜佔了很多、或畫面很扁）就整排縮小，最小縮到一半。）
    toastBox = null;
    const arenaFullW = arena.w;   // 還沒被禮物提示列擠窄的場地寬度（武將走動範圍用：提示列上方的空地也可以走）
    const items = getLegend && game.getMode() !== 'race' ? getLegend() : [];   // 賽跑模式：普攻、技能、招換 BOSS 都停用，右下角的指令提示列先隱藏
    let legend = null;
    if (items.length) {
      // 2026-11-14 咖哩用手機看說「還是霧霧的」：直播影片壓縮會把彩色的字糊掉（顏色資訊被壓得很粗，只有明暗保得住），
      // 所以提示列的字一律用純白＋最粗字重、底色用接近純黑，靠「明暗對比」撐住清晰度；字放到 34；沒有禮物圖片的格子不再畫空方框，省出空間給字。
      const base = { rowH: 44, gap: 4, icon: 32, colGap: 8, font: 27, hintFont: 21 };   // 2026-11-15 咖哩嫌字太大、武將太小：字 34→27
      ctx.font = `900 ${base.font}px ${FONT}`;
      const wOf = it => { const img = giftIcon(it.icon); return 14 + (img ? base.icon + 8 : 0) + ctx.measureText(it.label).width + (it.hint ? 10 + ctx.measureText(it.hint).width * base.hintFont / base.font : 0) + 14; };
      // 兩排直的：左邊是一般動作（普攻、全場、技能、回血），最右邊是招換 BOSS（紫色底）；只有一種就只畫一排
      // 2026-11-14 咖哩要求改成四排：一般動作兩排、招換 BOSS 兩排（每組各自對半分，前面那排多一個）
      const split = list => list.length < 2 ? [list] : [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))];
      // 2026-11-15 咖哩要求再改成「兩排」：所有指令照順序（一般動作在前、招換 BOSS 在後）對半分成左右兩排，黃／紫色帶仍區分兩種
      // 2026-11-15 咖哩再改：左排＝一般動作、右排＝招換 BOSS；「招換BUFF（藍紅隨機）」不顯示（它是紅藍隨機，跟分開的藍BUFF／紅BUFF 重複）
      const cols = [items.filter(i => !i.boss), items.filter(i => i.boss && i.action !== 'buff')].filter(c => c.length)
        .map(list => ({ list, w: Math.max(...list.map(wOf)) }));
      const natW = cols.reduce((a, c) => a + c.w, 0) + (cols.length - 1) * base.colGap;
      const natH = Math.max(...cols.map(c => c.list.length)) * (base.rowH + base.gap) - base.gap;
      const stackBottom = lb2 ? Math.max(lb.y + lb.h, lb2.y + lb2.h) : lb.y + lb.h;                    // 右上角排行榜們的最下緣
      const avail = H - 16 - (wide ? stackBottom + 12 + (H >= 700 ? 4 * 24 : 0) : 120);   // 橫式：排行榜下面剩多少（畫面夠高才多留 4 行訊息的位置，扁的畫面把空間都給提示列）
      const minScale = Math.max(0.8, Math.min(1.1, 12 / (viewK * base.font)));   // 畫面被等比例縮小時（例如直播橫幅），提示列的字要補回來：在螢幕上至少約 14 像素高
      const scale = clamp(avail / natH, minScale, 1.1);   // 最大 1.1 倍（再大會蓋住畫面）
      const w = natW * scale, h = natH * scale;
      legend = { cols, scale, base, w, h, x: W - 16 - w, y: H - 16 - h };
      if (wide) toastBox = { right: legend.x - 12, bottom: H - 16, w: 330 };   // 系統訊息：放在指令左邊、貼著底、新的在最下面往上疊
      if (!wide) arena.w -= w + 8;                                              // 直式：場地讓出右邊這一塊
      else if (arena.x + arena.w > legend.x - 12) arena.w = Math.max(120, legend.x - 12 - arena.x);   // 橫式：提示列比右邊那一欄寬時，武將的活動範圍也往左縮
    }
    const wander = config.wander && config.wander.enabled;
    const teamMode = game.getMode() === 'team';
    const modeNow = game.getMode();
    if (modeNow !== lastModeName) {   // 任何模式切換（含賽跑）：所有武將重新排位置
      lastModeName = modeNow;
      for (const v of views.values()) if (!v.boss && !v.fixed) { v.x = null; v.y = null; v.goal = null; v.tx = undefined; v.rest = undefined; v.race = false; }
    }
    if (teamMode !== lastTeamMode) {   // 切換亂鬥／陣營模式：所有武將重新排位置（不然切回亂鬥後會留在原本地盤的位置、站成一排）
      lastTeamMode = teamMode;
      for (const v of views.values()) if (!v.boss && !v.fixed) { v.x = null; v.y = null; v.goal = null; v.tx = undefined; v.rest = undefined; }
    }
    const tb = toastBox;
    // BOSS：又大又固定，站在場地中間偏下；一般武將會被推開、不會疊在它身上
    const bossV = views.get('boss');
    if (bossV && game.getPlayer('boss')) {
      const bs = teamMode ? clamp(Math.min(arena.h * 0.5, arena.w * 0.17), 80, 240) : clamp(Math.min(arena.h * 0.45, arena.w * 0.31), 90, 280);   // 2026-11-13 咖哩嫌太大：比原本小約兩成
      const tx = arena.x + arena.w / 2, ty = teamMode ? arena.y + arena.h - 50 - bs / 2 : arena.y + arena.h * 0.78 - bs / 2;   // 陣營模式：站在兩座塔中間
      if (bossV.x === null) { bossV.x = tx; bossV.y = ty; bossV.size = bs; }
      bossV.tsize = bs; bossV.tx = tx; bossV.ty = ty;
    }
    if (!teamMode) for (const v of views.values()) { v.zx0 = undefined; v.zx1 = undefined; v.zy0 = undefined; v.zy1 = undefined; }
    const raceR = modeNow === 'race' ? game.getRace() : null;
    raceGeo = null;
    if (raceR) {
      // 賽跑：橢圓跑道在場地中央偏下；參賽者照進度沿跑道跑，沒參賽的留在中間的內場
      const n = Math.max(3, raceR.count), es = clamp(Math.min(arena.h * 0.2, arena.w * 0.07), 34, 80);
      const halfH = Math.max(50, arena.h * 0.5 - 40 - es * 0.5);   // 跑道（含寬度）上下最多能佔的半高
      const band = Math.min(clamp(es * 0.16, 5, 11) * Math.min(8, n) + es * 0.5, halfH * 0.75);   // 跑道不要太寬，不然中間的內場會變得很窄；選手在不同的道上會有一點上下重疊，沒關係
      const laneGap = Math.max(4, (band - es * 0.5) / Math.min(8, n));
      const cx = arena.x + arena.w / 2, cy = arena.y + arena.h * 0.56 + 8;
      const rx = Math.max(band * 0.6 + 10, arena.w * 0.5 - band / 2 - es * 0.8), ry = Math.max(band * 0.55 + 4, halfH - band / 2);
      // 弧長對照表：進度（0～1，照路程算）換成橢圓上的角度，這樣在直道和彎道上的視覺速度才一樣
      const N = 240, tab = [0]; let px = rx, py = 0;
      for (let i = 1; i <= N; i++) { const th = i / N * Math.PI * 2, x = rx * Math.cos(th), y = ry * Math.sin(th); tab.push(tab[i - 1] + Math.hypot(x - px, y - py)); px = x; py = y; }
      raceGeo = { cx, cy, rx, ry, band, laneGap, es, n, tab, total: tab[N] };
      const ix = Math.max(10, (rx - band / 2 - es * 0.5) * 0.85), iy = Math.max(8, ry - band / 2 - es * 0.45);
      for (const p of list) {
        const v = views.get(p.id); if (!v) continue;
        const entrant = raceR.entrants.some(e => e.id === p.id);
        v.tsize = es * (entrant ? 1 : 0.85); v.race = entrant;
        if (v.x === null) { v.x = cx; v.y = cy; v.size = v.tsize; }
        if (entrant) { v.tx = undefined; v.zx0 = v.zx1 = v.zy0 = v.zy1 = undefined; }
        else { v.zx0 = cx - ix; v.zx1 = cx + ix; v.zy0 = cy - iy; v.zy1 = cy + iy; v.tx = undefined; }
      }
      const xr = wide ? arena.x + arenaFullW : arena.x + arena.w;
      bounds = { x0: arena.x + es * 0.6, x1: xr - es * 0.6, y0: arena.y, y1: arena.y + arena.h, size: es, lg: null };
    } else if (teamMode) {
      // 陣營模式：紅方主堡｜紅隊武將｜紅方塔｜藍方塔｜藍隊武將｜藍方主堡
      const sB = clamp(Math.min(arena.h * 0.5, arena.w * 0.15), 60, 170), sT = sB * 0.75;   // 2026-11-15 咖哩看直播覺得塔堡太小：放大
      const footY = arena.y + arena.h - 50, mid = arena.x + arena.w / 2;
      const place = { base_red: [arena.x + sB * 0.64, sB], tower_red: [mid - sT * 0.6, sT], tower_blue: [mid + sT * 0.6, sT], base_blue: [arena.x + arena.w - sB * 0.64, sB] };
      for (const st of game.getStructs()) {
        let sv = views.get(st.id);
        if (!sv) { sv = { id: st.id, boss: false, struct: true, fixed: true, deadT: 0, x: null, y: null, size: 80, hp: st.hp, shownHp: st.hp, down: st.down, flash: 0, shake: 0, hop: 0, hopH: 1, lunge: null, pending: 0, kbx: 0, kby: 0, face: 1, faceShown: 1, phase: Math.random() * 6 }; views.set(st.id, sv); }
        const [px, ps] = place[st.id];
        sv.tx = px; sv.ty = footY - ps / 2; sv.tsize = ps;
        if (sv.x === null) { sv.x = sv.tx; sv.y = sv.ty; sv.size = ps; }
      }
      // 地盤：從主堡中心一路到自己的塔（武將可以站在塔堡前面，畫面窄的時候才不會擠成一團）
      const zone = { red: { x0: place.base_red[0] + sB * 0.35, x1: place.tower_red[0] - sT * 0.15 }, blue: { x0: place.tower_blue[0] + sT * 0.15, x1: place.base_blue[0] - sB * 0.35 } };
      const groups = { red: list.filter(p => game.teamOf(p.id) === 'red'), blue: list.filter(p => game.teamOf(p.id) === 'blue') };
      let size = 190;
      for (const t of ['red', 'blue']) {
        const m = groups[t].length, zw = Math.max(40, zone[t].x1 - zone[t].x0); let best = 0;
        for (let cols = 1; cols <= Math.max(1, m); cols++) { const rows = Math.ceil(Math.max(1, m) / cols); best = Math.max(best, Math.min(zw / cols * 0.6, arena.h / rows * 0.5)); }
        size = Math.min(size, best);
      }
      size = Math.max(32, Math.min(size, arena.h * 0.4));
      for (const t of ['red', 'blue']) {
        const m = groups[t].length, z = zone[t], zw = Math.max(40, z.x1 - z.x0);
        let bc = { cols: 1, s: 0 };
        for (let cols = 1; cols <= Math.max(1, m); cols++) { const rows = Math.ceil(Math.max(1, m) / cols), sz = Math.min(zw / cols * 0.6, arena.h / rows * 0.5); if (sz > bc.s) bc = { cols, s: sz }; }
        const rows = Math.ceil(Math.max(1, m) / bc.cols), cw = zw / bc.cols, ch = arena.h / rows;
        groups[t].forEach((p, i) => {
          const v = views.get(p.id); if (!v) return;
          const row = Math.floor(i / bc.cols), col = i % bc.cols, inRow = row === rows - 1 ? m - row * bc.cols : bc.cols;
          const yLo = arena.y + size * 0.65 + 50 + 44, yHi = Math.max(yLo, arena.y + arena.h - size * 0.5 - 56);   // 跟下面 bounds 同一個上下範圍：一開始就平均散在整個高度，不會全擠在最上面
          const tx = (z.x0 + z.x1) / 2 + (col - (inRow - 1) / 2) * cw, ty = yLo + (row + 0.5) / rows * (yHi - yLo);
          if (v.x === null) { v.x = tx; v.y = ty; v.size = size; }
          v.tsize = size; v.team = t;
          v.zx0 = z.x0 + size * 0.5; v.zx1 = Math.max(v.zx0, z.x1 - size * 0.5);
          if (!wander) { v.tx = clamp(tx, v.zx0, v.zx1); v.ty = ty; } else { v.tx = undefined; }
        });
      }
      const xr = wide ? arena.x + arenaFullW : arena.x + arena.w;
      bounds = { x0: arena.x + size * 0.6, x1: xr - size * 0.6, y0: arena.y + size * 0.65 + 50, y1: arena.y + arena.h - size * 0.5 - 56, size,
                 lg: wide && legend ? { x: legend.x - (tb ? tb.w + 18 : 0), y: legend.y } : null };
      bounds.y0 += 44;   // 上方資訊列和兩行訊息的位置
      if (bounds.y0 > bounds.y1) bounds.y0 = bounds.y1 = (bounds.y0 + bounds.y1) / 2;
    } else if (n) {
      // 試每一種「一排幾隻」，挑角色能畫最大的那種
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cw = arena.w / cols, ch = arena.h / rows;
        const size = Math.min(cw * 0.6, ch * 0.5, 190);   // 留空間給名字、血條、腳下兩行字（2026-11-15 咖哩嫌武將太小：走動時的 0.85 倍縮小拿掉）
        if (!best || size > best.size) best = { cols, rows, cw, ch, size };
      }
      // 會走動時，武將高度最多佔場地高度的 36%，上下才留得出走動的空間（扁長的畫面特別需要）
      const size = Math.max(36, wander ? Math.min(best.size, arena.h * 0.42) : best.size);
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
      // 橫式：禮物提示列只是右下角的一塊障礙，它上方的空地武將也可以走（2026-11-14 咖哩要求），所以右界用沒被擠窄的寬度，
      // 走到提示列正上方那一段時，往下的界線改成「提示列的上緣」（見 capY）
      const xr = wide ? arena.x + arenaFullW : arena.x + arena.w;
      bounds = { x0: arena.x + size * 0.6, x1: xr - size * 0.6,
                 y0: arena.y + size * 0.65 + 50, y1: arena.y + arena.h - size * 0.5 - 56,
                 size, lg: wide && legend ? { x: legend.x - (tb ? tb.w + 18 : 0), y: legend.y } : null };   // 障礙物＝提示列＋它左邊的訊息區，武將不鑽進去
      // 畫面很小時上下可能擠到沒有空間（下限比上限還高）：這時就讓大家排在同一條水平線上、只左右走
      if (bounds.y0 > bounds.y1) bounds.y0 = bounds.y1 = (bounds.y0 + bounds.y1) / 2;
      if (bounds.x0 > bounds.x1) bounds.x0 = bounds.x1 = (bounds.x0 + bounds.x1) / 2;
    }
    return { lb, lb2, arena, legend };
  }

  // ---------- 每一格：更新 ----------
  function update(dt) {
    time += dt;
    const due = timers.filter(t => (t.t -= dt) <= 0);
    timers = timers.filter(t => t.t > 0);
    due.forEach(t => t.fn());
    effects.update(dt);
    updateLeavers(dt);
    quake = Math.max(0, quake - dt * 3);
    if (dim && (dim.age += dt) >= dim.life) dim = null;

    for (const [id, v] of views) {
      const p = game.getPlayer(id);
      if (!p) { views.delete(id); continue; }
      if (v.pending === 0) { v.hp = p.hp; v.down = p.down; }   // 沒有演到一半的攻擊時，跟規則層對齊
      if (v.boss && v.down) v.deadT += dt;                      // BOSS 倒下後慢慢淡出
      const k = Math.min(1, dt * 8);
      v.shownHp += (v.hp - v.shownHp) * Math.min(1, dt * 12);
      if (v.tsize) v.size += (v.tsize - v.size) * k;
      if (v.tx !== undefined) { v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; }
      v.hold = Math.max(0, (v.hold || 0) - dt);
      v.faceShown += clamp(v.face - v.faceShown, -dt * 12, dt * 12);   // 轉身不是瞬間翻面，而是很快地轉過去
      v.flash = Math.max(0, v.flash - dt * 4);
      if (v.anim && ((v.anim.t += dt) >= v.anim.dur + 0.3 || v.down || (v.lunge && !v.anim.fight))) v.anim = null;   // 播完（或倒地、出招）就結束
      v.shake = Math.max(0, v.shake - dt * 4);
      v.hop = Math.max(0, v.hop - dt * 2.2);
      const kd = Math.max(0, 1 - dt * 7); v.kbx *= kd; v.kby *= kd;   // 擊退慢慢彈回原位
      if (v.lunge && (v.lunge.t += dt) >= v.lunge.dur) v.lunge = null;
    }
    if (config.wander && config.wander.enabled && bounds) roam(dt);
    driveRace(dt);
    floats.forEach(f => f.age += dt); floats = floats.filter(f => f.age < (f.life || 1) && views.has(f.v.id));
    rings.forEach(r => r.age += dt); rings = rings.filter(r => r.age < r.life);
    toasts.forEach(t => t.age += dt); toasts = toasts.filter(t => t.age < toastLife);
  }

  // ---------- 賽跑：跑道幾何與參賽者的位置 ----------
  // 路程比例（0～1）換成橢圓角度；從底部中央的起跑線出發，逆時針（先往右跑）
  function raceTheta(g, frac) {
    const f = ((frac % 1) + 1) % 1, s = f * g.total, tab = g.tab;
    let lo = 0, hi = tab.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] <= s) lo = m; else hi = m; }
    const t = (s - tab[lo]) / Math.max(1e-6, tab[hi] - tab[lo]);
    return Math.PI / 2 - (lo + t) / (tab.length - 1) * Math.PI * 2;
  }
  function racePoint(g, frac, lane) {
    const th = raceTheta(g, frac), off = (lane - (g.n - 1) / 2) * g.laneGap;
    return { x: g.cx + (g.rx + off) * Math.cos(th), y: g.cy + (g.ry + off) * Math.sin(th), th };
  }
  function driveRace(dt) {
    const R = raceGeo && game.getMode() === 'race' ? game.getRace() : null;
    if (!R) return;
    const g = raceGeo, k = Math.min(1, dt * 12);
    for (const e of R.entrants) {
      const v = views.get(e.id);
      if (!v) continue;
      v.race = true;
      const pad = e.lane * 0.011 * Math.max(0, 1 - e.progress * 25);   // 起跑前站在線後面一點（一格一格錯開），開跑後慢慢排進跑道
      const P = racePoint(g, e.progress - pad, e.lane);
      v.x += (P.x - v.x) * k; v.y += (P.y - v.size * 0.35 - v.y) * k;
      if (Math.abs(Math.sin(P.th)) > 0.05) v.face = Math.sign(Math.sin(P.th));   // 在上緣往左跑、下緣往右跑，彎道上保持原方向
      v.moving = e.state === 'run';
      v.goal = null; v.hold = Math.max(v.hold || 0, 0.2);
    }
  }
  function drawTrack() {
    const g = raceGeo;
    if (!g || game.getMode() !== 'race') return;
    const R = game.getRace(); if (!R) return;
    ctx.save();
    ctx.fillStyle = 'rgba(70,150,86,0.30)'; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.rx - g.band / 2, g.ry - g.band / 2, 0, 0, Math.PI * 2); ctx.fill();   // 內場草地
    ctx.strokeStyle = 'rgba(204,134,76,0.70)'; ctx.lineWidth = g.band + 4; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.rx, g.ry, 0, 0, Math.PI * 2); ctx.stroke();   // 跑道
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
    for (const d of [-g.band / 2, g.band / 2]) { ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.rx + d, g.ry + d, 0, 0, Math.PI * 2); ctx.stroke(); }   // 內外白線
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 10]);
    for (let i = 1; i < Math.min(8, g.n); i++) { const d = (i - 0.5 - (g.n - 1) / 2) * g.laneGap; ctx.beginPath(); ctx.ellipse(g.cx, g.cy, g.rx + d, g.ry + d, 0, 0, Math.PI * 2); ctx.stroke(); }   // 分道線
    ctx.setLineDash([]);
    const segs = config.race.segments || 8;   // 每一小段的記號：到這裡會擲骰決定要不要休息
    for (let i = 1; i < segs; i++) { const th = raceTheta(g, i / segs); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(g.cx + g.rx * Math.cos(th), g.cy + g.ry * Math.sin(th), 3, 0, Math.PI * 2); ctx.fill(); }
    // 起跑／終點線（黑白格）
    const y0 = g.cy + g.ry - g.band / 2, y1 = g.cy + g.ry + g.band / 2, cell = Math.max(6, g.band / 6);
    for (let i = 0; i * cell < y1 - y0; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(g.cx - cell + j * cell, y0 + i * cell, cell, Math.min(cell, y1 - y0 - i * cell)); }
    text('起跑線', g.cx, y1 + 14, 14, '#fff');
    ctx.restore();
  }
  function drawRaceBadges() {
    const g = raceGeo, R = g && game.getMode() === 'race' ? game.getRace() : null;
    if (!R || R.phase === 'signup') return;
    for (const e of R.entrants) {
      const v = views.get(e.id); if (!v || v.x === null || !e.rank) continue;
      const r = Math.max(9, v.size * 0.2), bx = v.x + v.size * 0.42, by = v.y - v.size * 0.5;
      ctx.fillStyle = ['#ffd35c', '#dcdcdc', '#d99a6c'][e.rank - 1] || '#5a6a78'; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      text(String(e.rank), bx, by + 1, r * 1.25, e.rank <= 3 ? '#3a2a10' : '#fff');
      if (e.state === 'done') text('🏁', bx + r * 1.6, by, r * 1.5, '#fff');
    }
  }
  function drawRaceBoard(lb, R) {
    ctx.fillStyle = 'rgba(22,26,30,0.78)'; ctx.beginPath(); ctx.roundRect(lb.x, lb.y, lb.w, lb.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    text('🏁 賽跑名次', lb.x + lb.w / 2, lb.y + 24, 20, '#ffd35c');
    const rows = R.phase === 'signup' ? R.entrants.map((e, i) => ({ id: e.id, rank: i + 1, e })) : R.ranks.map((id, i) => ({ id, rank: i + 1, e: R.entrants.find(x => x.id === id) }));
    if (!rows.length) text('還沒有人報名', lb.x + lb.w / 2, lb.y + 62, 14, '#aaa', 'center', false);
    rows.slice(0, 5).forEach((r, i) => {
      const y = lb.y + 62 + i * 32, p = game.getPlayer(r.id);
      text(R.phase === 'signup' ? '•' : String(r.rank), lb.x + 22, y, 18, ['#ffd35c', '#dcdcdc', '#d99a6c'][r.rank - 1] && R.phase !== 'signup' ? ['#ffd35c', '#dcdcdc', '#d99a6c'][r.rank - 1] : '#fff');
      text(short(p ? p.name : '', 7), lb.x + 42, y, 16, '#fff', 'left');
      const st = r.e.state === 'done' ? '完賽' : r.e.state === 'dnf' ? '棄權' : r.e.state === 'rest' ? '💤 休息' : r.e.state === 'ready' ? '準備' : Math.round(r.e.progress * 100) + '%';
      text(st, lb.x + lb.w - 14, y, 16, r.e.state === 'rest' ? '#9ad0ff' : '#b8e8b0', 'right');
    });
  }
  function drawRaceHud(arena) {
    const R = game.getMode() === 'race' ? game.getRace() : null;
    if (!R) return;
    const cx = arena.x + arena.w / 2, y = arena.y + 18, mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let label = '';
    if (R.phase === 'signup') label = `🏁 報名中 ${mmss(R.left)}　${R.count}/${R.max} 人　留言「我要參賽」`;
    else if (R.phase === 'countdown') label = `🏁 ${R.count} 位選手準備起跑`;
    else if (R.phase === 'run') label = `🏁 比賽中　⏱ ${mmss(R.t)}`;
    else label = '🏁 比賽結束';
    ctx.font = `bold 20px ${FONT}`;
    const w = Math.min(arena.w - 10, ctx.measureText(label).width + 40);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y - 18, w, 36, 18); ctx.fill(); ctx.restore();
    text(label, cx, y, 20, '#fff');
    if (R.phase === 'countdown') {
      const n = Math.ceil(R.cd);
      ctx.save(); ctx.globalAlpha = 0.9; text(String(n), cx, arena.y + arena.h * 0.5, 140 - (R.cd % 1) * 30, '#ffd35c', 'center', true); ctx.restore();
    } else if (R.phase === 'run' && R.t < 1.2) text('GO!', cx, arena.y + arena.h * 0.5, 120, '#7dffa0');
    if (R.phase === 'result') {
      const by = arena.y + arena.h * 0.42;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(arena.x, by - 70, arena.w, 150); ctx.restore();
      text('🏆 比賽結果', cx, by - 44, 36, '#ffd35c');
      R.results.forEach((r, i) => { const p = game.getPlayer(r.id); text(`第 ${r.rank} 名　${short(p ? p.name : '', 8)}　+${r.xp} 經驗`, cx, by - 6 + i * 30, 24, ['#ffd35c', '#dcdcdc', '#d99a6c'][i]); });
      if (!R.results.length) text('沒有人完賽', cx, by + 10, 24, '#fff');
    }
  }

  // 待機時在場上隨意走動：走到一個隨機地點 → 停一下 → 再挑下一個地點
  // 兩隻武將「隔多開」的算法：左右隔一個身寬即可，上下要隔更開（因為頭上有名字血條、腳下有字）。
  // 回傳值小於 1 代表太近、會互相擋到。
  function gap(ax, ay, bx, by, size) {
    return Math.hypot((bx - ax) / (size * 1.05), (by - ay) / (size * 1.2 + Math.min(62, size * 0.8)));   // 武將小的時候，上下需要的間隔也跟著小
  }
  // 逐格動畫：這隻武將有設定這個動作（config.heroAnims）才播；播的時候站定不走，播完再繼續
  function startAnim(v, name) {
    const p = game.getPlayer(v.id);
    // 有好幾組待機動畫（idle、idle2…）的武將：每次停下來隨機挑一組（時而啃骨頭、時而吃漢堡喝奶茶，每組機率一樣）
    if (name === 'idle' && p && !p.isBoss) { const list = sprite.idleNames(p.hero.heroId); if (list.length > 1) name = list[Math.floor(Math.random() * list.length)]; }
    const info = p && !p.isBoss && !v.down && sprite.animInfo(p.hero.heroId, name);
    if (!info) return;
    v.anim = { name, t: 0, dur: info.dur, fight: name === 'attack' || name === 'skill' };   // 出招動畫（attack／skill）衝撞時也繼續播
    v.hold = Math.max(v.hold || 0, info.dur + 0.3);
  }
  // 走到禮物提示列正上方時，不能再往下鑽進去：y 最多到提示列上緣（腳下還有兩行字要留位置）
  function capY(b, x, y) {
    if (!b.lg || x + b.size * 0.6 <= b.lg.x - 8) return y;
    return Math.max(b.y0, Math.min(y, b.lg.y - b.size * 0.5 - 56 - 6));
  }
  function roam(dt) {
    const cfg = config.wander, b = bounds;
    const list = [...views.values()].filter(v => v.x !== null);
    for (const v of list) {
      v.moving = false; v.want = 0; v.px = v.x; v.py = v.y;
      if (v.zx0 !== undefined && (v.x < v.zx0 || v.x > v.zx1)) v.x += (clamp(v.x, v.zx0, v.zx1) - v.x) * Math.min(1, dt * 4);
      if (v.zy0 !== undefined && (v.y < v.zy0 || v.y > v.zy1)) v.y += (clamp(v.y, v.zy0, v.zy1) - v.y) * Math.min(1, dt * 4);   // 賽跑：沒參賽的被擠出內場就慢慢走回來   // 陣營模式：被推出自己那隊的地盤就慢慢走回來
      // 倒地、正在出招或挨打時不走動（BOSS 固定站著）
      if (v.boss || v.fixed || v.race || v.down || v.lunge || v.pending > 0 || v.hold > 0) continue;
      if (!v.goal) {
        if ((v.rest = (v.rest === undefined ? Math.random() * cfg.restMax : v.rest) - dt) > 0) continue;
        // 隨機挑幾個候選地點，只考慮「走過去不會擠到別人」的，從中選最空的；
        // 都會擠到別人就先不走，等一下再找（硬走過去只會被推回來、卡在原地）
        const reach = cfg.stepMax * v.size;   // 一次最多走多遠
        let best = null;
        for (let c = 0; c < 10; c++) {
          const x = clamp(v.x + (Math.random() * 2 - 1) * reach, v.zx0 !== undefined ? v.zx0 : b.x0, v.zx1 !== undefined ? v.zx1 : b.x1), y = capY(b, x, clamp(v.y + (Math.random() * 2 - 1) * reach, v.zy0 !== undefined ? v.zy0 : b.y0, v.zy1 !== undefined ? v.zy1 : b.y1));
          if (Math.hypot(x - v.x, y - v.y) < v.size * 0.4) continue;       // 太近了，等於沒走
          let room = 9;
          for (const o of list) if (o !== v) room = Math.min(room, gap(x, y, (o.goal || o).x, (o.goal || o).y, o.boss || o.fixed ? (v.size + o.size) / 2 : v.size));
          if (room < 1.05) continue;
          room = Math.min(room, 2) + Math.random() * 0.3;   // 夠空就好，不必永遠跑去最空的角落
          if (!best || room > best.room) best = { x, y, room };
        }
        if (!best) { v.rest = 0.5 + Math.random(); continue; }
        v.goal = best; v.stall = 0;
      }
      const dx = v.goal.x - v.x, dy = v.goal.y - v.y, d = Math.hypot(dx, dy), step = cfg.speed * v.size * dt;
      if (d <= step) { v.goal = null; v.rest = cfg.restMin + Math.random() * (cfg.restMax - cfg.restMin); if (!v.anim) startAnim(v, 'idle'); continue; }   // 走到定點停下來：有待機動畫就播一次
      v.x += dx / d * step; v.y += dy / d * step;
      v.want = step; v.dir = Math.sign(dx);
      if (Math.abs(v.goal.x - v.x) > v.size * 0.2) v.face = v.dir;   // 面向前進方向（幾乎直上直下時不轉身）
    }
    // 互相靠太近就輕輕推開，避免疊在一起；倒地的不會被推走
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j];
      const g = gap(a.x, a.y, c.x, c.y, (a.size + c.size) / 2);
      if (g >= 1 || (a.down && c.down)) continue;
      const dx = c.x - a.x || 0.01, dy = c.y - a.y, d = Math.hypot(dx, dy);
      const push = (1 - g) * a.size * Math.min(1, dt * 5) / d;
      const wa = a.boss || a.fixed ? 0 : c.boss || c.fixed ? 1 : a.down ? 0 : c.down ? 1 : 0.5;   // BOSS 推不動，別人會被推開
      a.x -= dx * push * wa; a.y -= dy * push * wa; c.x += dx * push * (1 - wa); c.y += dy * push * (1 - wa);
    }
    for (const v of list) {
      if (!v.down && !v.boss && !v.fixed && !v.race) { v.x = clamp(v.x, v.zx0 !== undefined ? Math.min(b.x0, v.zx0) : b.x0, v.zx1 !== undefined ? Math.max(b.x1, v.zx1) : b.x1); v.y = capY(b, v.x, clamp(v.y, v.zy0 !== undefined ? v.zy0 : b.y0, v.zy1 !== undefined ? v.zy1 : b.y1)); }
      if (!v.want) continue;
      // 這一格實際有沒有前進？有前進才算「走路中」（才會一顛一顛）。
      // 一直被擋住走不動超過半秒，就放棄這個目的地、休息一下再換地方，不會卡在原地踏步。
      const moved = Math.hypot(v.x - v.px, v.y - v.py);
      if (moved >= v.want * 0.5) { v.moving = true; v.stall = Math.max(0, (v.stall || 0) - dt); }
      else if ((v.stall = (v.stall || 0) + dt) > 0.5) { v.goal = null; v.stall = 0; v.rest = 0.8 + Math.random() * 1.5; }
    }
  }

  // 烙跑中的武將現在畫在哪：一開始慢慢起步，後面越跑越快
  function leaverPos(g) {
    const k = g.age / g.life;
    return { x: g.x + g.dir * g.size * (0.3 * k + 5 * k * k), y: g.y - Math.abs(Math.sin(g.age * 16)) * g.size * 0.08 };
  }
  function updateLeavers(dt) {
    for (const g of leavers) {
      g.age += dt;
      if ((g.dust -= dt) <= 0) { g.dust = 0.07; const p = leaverPos(g); effects.sparks(p.x - g.dir * g.size * 0.2, g.y + g.size / 2, '#e8dcc0', 4, 140, 4, 0.4, 0); }
    }
    leavers = leavers.filter(g => g.age < g.life);
  }
  function drawLeavers() {
    for (const g of leavers) {
      const k = g.age / g.life, p = leaverPos(g);
      ctx.save();
      ctx.globalAlpha = k < 0.55 ? 1 : Math.max(0, (1 - k) / 0.45);
      sprite.draw(ctx, g.hero, p.x, p.y, g.size, { pose: 'idle', poseTime: g.age, flash: 0, lean: g.dir * 0.2, facing: g.dir });
      text('烙跑！', g.x + g.dir * g.size * 0.3 * k, g.y - g.size * 0.62 - k * g.size * 0.25, clamp(g.size * 0.3, 18, 38), '#ffd35c');
      ctx.restore();
    }
  }

  // 這隻武將此刻畫在哪（待機位置 + 各種動態造成的位移）
  function pos(v) {
    let x = v.x, y = v.y;
    if (v.moving) y -= Math.abs(Math.sin(time * 9 + v.phase)) * v.size * 0.05;    // 走路時一顛一顛
    else if (!v.down) y += Math.sin(time * 2.4 + v.phase) * v.size * 0.01;      // 待機：整張圖只留一點點浮動，主要靠圖片本身呼吸（hero-sprite.js）
    if (v.hop > 0) y -= Math.sin(Math.PI * (1 - v.hop)) * v.size * 0.5 * v.hopH; // 彈跳
    if (v.lunge) {                                                              // 衝撞（去了再回來）
      const t = views.get(v.lunge.to);
      if (t) { const s = Math.sin(Math.PI * v.lunge.t / v.lunge.dur) * 0.6; x += (t.x - v.x) * s; y += (t.y - v.y) * s; }
    }
    x += v.kbx; y += v.kby;                                                     // 擊退
    if (v.shake > 0) { x += (Math.random() - 0.5) * v.shake * v.size * 0.2; y += (Math.random() - 0.5) * v.shake * v.size * 0.1; }
    return { x, y };
  }

  // ---------- BOSS ----------
  // 腳下的紫色光圈：一團柔和的光暈、兩圈會轉的符文環、往上飄的光點。原點是 BOSS 的腳底。
  function drawBossAura(x, footY, size, accent) {
    const rx = size * 0.62, pulse = 0.8 + Math.sin(time * 2.2) * 0.2;
    ctx.save();
    ctx.translate(x, footY); ctx.scale(1, 0.3);                                   // 壓扁成地上的橢圓
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.6);
    glow.addColorStop(0, `rgba(190,110,255,${0.85 * pulse})`); glow.addColorStop(0.55, `rgba(140,70,230,${0.4 * pulse})`); glow.addColorStop(1, 'rgba(120,60,220,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, rx * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#c27bff'; ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(226,180,255,${0.95 * pulse})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.stroke();               // 外圈
    ctx.lineWidth = 4; ctx.setLineDash([rx * 0.18, rx * 0.1]); ctx.lineDashOffset = -time * rx * 0.6;
    ctx.beginPath(); ctx.arc(0, 0, rx * 0.8, 0, Math.PI * 2); ctx.stroke();         // 會轉的虛線符文環
    ctx.setLineDash([rx * 0.06, rx * 0.2]); ctx.lineDashOffset = time * rx * 0.5; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, rx * 0.58, 0, Math.PI * 2); ctx.stroke();        // 內圈（反方向轉）
    ctx.restore();
    ctx.save();
    for (let i = 0; i < 12; i++) {                                                 // 往上飄的光點
      const a = i * 2.4 + time * 0.35, k = ((time * 0.45 + i * 0.173) % 1);
      const px = x + Math.cos(a) * rx * (0.25 + (i % 5) * 0.14), py = footY - k * size * 0.95 - Math.abs(Math.sin(a)) * size * 0.04;
      ctx.globalAlpha = Math.sin(Math.PI * k) * 0.9;
      ctx.fillStyle = i % 3 ? '#e6c8ff' : accent;
      ctx.beginPath(); ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss(v, p, x, y) {
    const size = v.size, r = size / 2, accent = p.hero.accent || '#b45cff';
    const fade = v.down ? Math.max(0, 1 - v.deadT / 3) : 1;                        // 倒下後 3 秒淡出
    ctx.save();
    ctx.globalAlpha = fade;
    if (!v.down) drawBossAura(x, y + r, size, accent);
    else { ctx.globalAlpha = fade * 0.6; drawBossAura(x, y + r, size, accent); ctx.globalAlpha = fade; }
    const pose = v.down ? 'down' : v.lunge ? 'attack' : v.flash > 0 ? 'hit' : 'idle';
    let lean = 0;
    if (v.lunge) { const t = views.get(v.lunge.to); if (t) lean = Math.sign(t.x - v.x || 1) * 0.12 * Math.sin(Math.PI * v.lunge.t / v.lunge.dur); }
    else lean = clamp(v.kbx / size * 1.4, -0.2, 0.2);
    sprite.draw(ctx, p.hero, x, y, size, { pose, poseTime: v.lunge ? v.lunge.t : time, flash: v.flash, lean, facing: v.faceShown, phase: v.phase, moving: false });

    // 血條（比一般武將寬）：紫到粉紅的漸層，中間寫血量數字
    const bw = clamp(size * 0.95, 150, 330), bh = clamp(size * 0.07, 14, 24), fs = clamp(size * 0.1, 16, 30);
    const bx = x - bw / 2, by = y - r - size * 0.12 - bh;
    const ratio = clamp(v.shownHp / p.maxHp, 0, 1);
    const pill = (px, py, w, h) => { const rr = h / 2; ctx.beginPath(); ctx.moveTo(px + rr, py); ctx.arcTo(px + w, py, px + w, py + h, rr); ctx.arcTo(px + w, py + h, px, py + h, rr); ctx.arcTo(px, py + h, px, py, rr); ctx.arcTo(px, py, px + w, py, rr); ctx.closePath(); };
    ctx.save();
    pill(bx - 3, by - 3, bw + 6, bh + 6); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c27bff'; ctx.stroke();
    if (ratio > 0.005) {
      const fw = Math.max(bh, bw * ratio);
      pill(bx, by, fw, bh);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#9b4dff'); g.addColorStop(1, '#ff5c9a');
      ctx.fillStyle = g; ctx.fill(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(bx, by + bh * 0.1, fw, bh * 0.3);
    }
    ctx.restore();
    text(`${Math.max(0, Math.ceil(v.shownHp))} / ${p.maxHp}`, x, by + bh / 2, Math.max(11, bh * 0.75), '#fff');
    // 名字：Lv + 名稱
    ctx.font = `bold ${fs}px ${FONT}`;
    const lv = `Lv.${p.prof.level} `, lvW = ctx.measureText(lv).width * 0.8, nmW = ctx.measureText(p.name).width, left = x - (lvW + nmW) / 2;
    text(lv, left, by - fs * 0.85, fs * 0.8, '#ffd35c', 'left');
    text(p.name, left + lvW, by - fs * 0.9, fs, '#e6c8ff', 'left');
    // 腳下：陣營・名稱，再下面是出招倒數
    const fac = config.factions.Boss;
    text(`${fac.label}・${p.name}`, x, y + r + fs * 0.9, fs * 0.8, '#d9a8ff');
    const b = game.getBoss();
    if (b && !b.down) text(`下次攻擊 ${Math.ceil(b.attackIn)} 秒　全場攻擊 ${Math.ceil(b.aoeIn)} 秒`, x, y + r + fs * 1.9, fs * 0.62, '#cfb4ff');
    ctx.restore();
  }

  // 排隊中的 BOSS：一條細長的小標籤。橫式放在排行榜左邊，直式放在場地左上角
  function drawBossQueue(arena, lb) {
    const q = game.getBossQueue();
    if (!q.length) return;
    const wide = W >= H;
    let label = 'BOSS 排隊 ▸ ' + q.slice(0, 3).map((e, i) => `${i + 1}.${e.name}`).join('  ') + (q.length > 3 ? `  +${q.length - 3}` : '');
    ctx.font = 'bold 15px ' + FONT;
    const w = ctx.measureText(label).width + 24, h = 34;
    const x = wide ? lb.x - 12 - w : arena.x + 8, y = wide ? lb.y : arena.y + 8;
    ctx.fillStyle = 'rgba(40,16,72,0.85)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(194,123,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(label, x + 12, y + h / 2, 15, '#e6c8ff', 'left');
  }

  function drawHero(v) {
    const p = game.getPlayer(v.id);
    const { x, y } = pos(v);
    const size = v.size, r = size / 2, fs = clamp(size * 0.2, 12, 22);
    if (p.isBoss) { drawBoss(v, p, x, y); return; }
    if (p.isStruct) { drawStruct(v, p, x, y); return; }
    const pose = v.down ? 'down' : v.lunge ? 'attack' : v.flash > 0 ? 'hit' : 'idle';
    // 身體傾斜：衝撞時往前傾，被打時往後仰
    let lean = 0;
    if (v.lunge) { const t = views.get(v.lunge.to); if (t) lean = Math.sign(t.x - v.x || 1) * 0.22 * Math.sin(Math.PI * v.lunge.t / v.lunge.dur); }
    else lean = clamp(v.kbx / size * 1.4, -0.35, 0.35) + (v.moving ? v.dir * 0.06 : 0);   // 走路時微微往前進方向傾
    sprite.draw(ctx, p.hero, x, y, size, { pose, poseTime: v.lunge ? v.lunge.t : time, flash: v.flash, lean, facing: v.faceShown, phase: v.phase, moving: v.moving, anim: v.anim });

    const raceMode = game.getMode() === 'race';
    // 血條（賽跑時不畫血條、經驗條、BUFF 章，只留名字）
    if (raceMode) ctx.globalAlpha = 0;
    const bw = Math.max(54, size * 0.95), bh = Math.max(7, size * 0.09);
    const bx = x - bw / 2, by = y - r - size * 0.05 - bh - 6;   // 全身圖比 size 高一點，血條跟著往上
    const ratio = clamp(v.shownHp / p.maxHp, 0, 1);
    // 圓角膠囊：白底、粉色細邊，裡面是柔和的彩色血量，上面一道亮光；左端一顆小愛心
    const pill = (px, py, w, h) => { const rr = h / 2; ctx.beginPath(); ctx.moveTo(px + rr, py); ctx.arcTo(px + w, py, px + w, py + h, rr); ctx.arcTo(px + w, py + h, px, py + h, rr); ctx.arcTo(px, py + h, px, py, rr); ctx.arcTo(px, py, px + w, py, rr); ctx.closePath(); };
    ctx.save();
    pill(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#fff'; ctx.fill();
    const tcol = game.getMode() === 'team' && game.teamOf(p.id) ? (config.team.colors || {})[game.teamOf(p.id)] : null;   // 陣營模式：血條外框用隊色
    ctx.lineWidth = tcol ? 3 : 1.5; ctx.strokeStyle = tcol || '#ffb8cf'; ctx.stroke();
    if (ratio > 0.01 && !v.down) {
      const fw = Math.max(bh, bw * ratio);   // 血很少時也留一小顆圓，才看得到
      pill(bx, by, fw, bh);
      ctx.fillStyle = ratio > 0.5 ? '#6fdc8c' : ratio > 0.25 ? '#ffd24d' : '#ff6b81';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(bx, by + bh * 0.12, fw, bh * 0.3);   // 亮光
    }
    ctx.restore();
    // 愛心（壓在血條左端，大小跟名字一樣；跟著心跳輕輕一縮一放）
    const beat = v.down ? 1 : 1 + Math.max(0, Math.sin(time * 5 + v.phase)) ** 6 * 0.18;
    const hx = bx + fs * 0.35, hy = by + bh / 2 - fs * 0.05, hs = fs * 1.15 * beat;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(hs / 10, hs / 10);
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-11, -2, -5, -9, 0, -3.5); ctx.bezierCurveTo(5, -9, 11, -2, 0, 5); ctx.closePath();
    ctx.fillStyle = v.down ? '#c9c9c9' : '#ff5c8a'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.stroke();
    if (!v.down) { ctx.beginPath(); ctx.ellipse(-3.6, -3.2, 1.7, 1.1, -0.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); }   // 愛心上的小亮點
    ctx.restore();
    // 經驗條（血條下面細細一條淡藍；滿級就不畫）
    if (p.prof.level < config.leveling.maxLevel) {
      const ey = by + bh + 3, eh = 4, er = clamp(p.prof.xp / game.xpNeed(p.prof.level), 0, 1);
      ctx.save(); pill(bx, ey, bw, eh); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#bfe6ff'; ctx.stroke();
      if (er > 0) { pill(bx, ey, Math.max(eh, bw * er), eh); ctx.fillStyle = '#6cc8ff'; ctx.fill(); }
      ctx.restore();
    }

    // BUFF 標示：血條右邊的小圓章。藍＝每秒回血（回），紅＝攻擊力加倍（攻）
    const bf = game.getBuffs(p.id);
    if (bf.regen || bf.atk) {
      const rr = Math.max(8, fs * 0.55); let bxx = bx + bw + 6 + rr;
      for (const [on, col, ch] of [[bf.regen, '#3aa8ff', '回'], [bf.atk, '#ff5c4d', '攻']]) {
        if (!on) continue;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bxx, by + bh / 2, rr, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        text(ch, bxx, by + bh / 2 + 1, rr * 1.15, '#fff');
        bxx += rr * 2 + 4;
      }
    }

    if (raceMode) ctx.globalAlpha = 1;
    // 觀眾名字（血條上方）、武將名（腳下）
    // 名字前面加等級，例如「Lv.5 小明」
    ctx.font = `bold ${fs}px ${FONT}`;
    const lv = `Lv.${p.prof.level} `, nm = short(p.name, 8);
    const lvW = ctx.measureText(lv).width * 0.8, nmW = ctx.measureText(nm).width, left = x - (lvW + nmW) / 2;
    if (tcol) { ctx.fillStyle = tcol; ctx.beginPath(); ctx.arc(left - fs * 0.5, by - fs * 0.75, fs * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }   // 名字前面一顆隊色圓點
    text(lv, left, by - fs * 0.7, fs * 0.8, v.down ? '#bbb' : '#ffd35c', 'left');
    text(nm, left + lvW, by - fs * 0.75, fs, v.down ? '#bbb' : '#fff', 'left');
    const fac = config.factions[p.hero.faction] || { label: '', color: '#888' };
    let facColor = fac.color;
    if (arenas && arenas.isDark()) {   // 深色場地：把陣營色往白色調亮，不然深紫、深藍在黑底上看不清楚
      const n = parseInt(String(fac.color).slice(1), 16), mix = c => Math.round(c + (255 - c) * 0.6);
      if (!isNaN(n)) facColor = `rgb(${mix(n >> 16 & 255)},${mix(n >> 8 & 255)},${mix(n & 255)})`;
    }
    text(`${fac.label}・${p.hero.displayName}`, x, y + r + fs * 0.85, fs * 0.8, facColor);

    // 最下面一行：倒地倒數 或 鎖定對象
    const ly = y + r + fs * 1.85;
    if (v.down) {
      const wait = Math.ceil(game.reviveRemaining(p));
      if (wait > 0) text(`倒地 ${wait} 秒後可復活`, x, ly, fs * 0.78, '#ffb0a6');
      else if (Math.sin(time * 6) > -0.3) text('送禮復活！', x, ly, fs * 0.9, '#ffe27a');
    } else if (!raceMode && p.lockId && game.getPlayer(p.lockId)) {
      text(`鎖定▶${short(game.getPlayer(p.lockId).name, 7)}`, x, ly, fs * 0.72, '#ffd35c');
    }
  }

  // ---------- 陣營模式：防禦塔、主堡、上方資訊列 ----------
  function drawStruct(v, p, x, y) {
    const s = v.size, fy = y + s / 2, col = (config.team.colors || {})[p.team] || '#fff', down = v.down;
    const info = game.teamInfo(), st = info ? info.baseState(p.team) : 'tower';
    ctx.save();
    const lines = (...a) => { ctx.beginPath(); a.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); };
    const stone = (x0, y0, w, h, light) => { const g = ctx.createLinearGradient(x0, y0, x0 + w, y0); g.addColorStop(0, light ? '#b9c1cb' : '#8d96a1'); g.addColorStop(1, light ? '#8d96a1' : '#6b747f'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h); ctx.lineWidth = 2; ctx.strokeStyle = '#3a4048'; ctx.strokeRect(x0, y0, w, h); };
    const hitK = Math.max(0, v.flash);
    if (p.kind === 'tower') {
      const w = s * 0.5, h = s * 0.95 * (down ? 0.32 : 1);
      stone(x - w / 2, fy - h, w, h, true);
      if (!down) {
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, fy - h * 0.55, w, h * 0.12);                      // 隊色橫條
        stone(x - w * 0.62, fy - h - s * 0.08, w * 1.24, s * 0.1, false);                              // 平台
        for (let i = 0; i < 3; i++) stone(x - w * 0.6 + i * w * 0.48, fy - h - s * 0.17, w * 0.28, s * 0.09, true);   // 垛口
        const pulse = 0.75 + Math.sin(time * 3 + v.phase) * 0.25;
        ctx.shadowColor = col; ctx.shadowBlur = 18 * pulse; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, fy - h - s * 0.3, s * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;   // 頂端發光的水晶
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - s * 0.03, fy - h - s * 0.33, s * 0.03, 0, Math.PI * 2); ctx.fill();
      } else { ctx.fillStyle = '#6b747f'; lines([x - w * 0.9, fy], [x - w * 0.5, fy - h * 1.4], [x - w * 0.1, fy]); ctx.fill(); lines([x + w * 0.1, fy], [x + w * 0.45, fy - h * 1.1], [x + w * 0.9, fy]); ctx.fill(); }
    } else {
      const w = s * 1.0, h = s * 0.72 * (down ? 0.35 : 1);
      stone(x - w / 2, fy - h, w, h, true);
      if (!down) {
        stone(x - w * 0.62, fy - h * 1.35, w * 0.26, h * 1.35, false); stone(x + w * 0.36, fy - h * 1.35, w * 0.26, h * 1.35, false);   // 兩側角樓
        for (let i = 0; i < 5; i++) stone(x - w * 0.48 + i * w * 0.2, fy - h - s * 0.08, w * 0.12, s * 0.08, true);            // 垛口
        ctx.fillStyle = '#2a2f36'; ctx.beginPath(); ctx.moveTo(x - w * 0.16, fy); ctx.lineTo(x - w * 0.16, fy - h * 0.45); ctx.arc(x, fy - h * 0.45, w * 0.16, Math.PI, 0); ctx.lineTo(x + w * 0.16, fy); ctx.closePath(); ctx.fill();   // 城門
        ctx.fillStyle = col; ctx.fillRect(x - w / 2, fy - h * 0.8, w, h * 0.1);                                                  // 隊色橫條
        const fx2 = x, fyp = fy - h * 1.35 - s * 0.05, wave = Math.sin(time * 4 + v.phase) * s * 0.03;                           // 旗子
        ctx.strokeStyle = '#3a4048'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx2, fy - h * 1.05); ctx.lineTo(fx2, fyp - s * 0.3); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx2, fyp - s * 0.3); ctx.lineTo(fx2 + s * 0.32, fyp - s * 0.22 + wave); ctx.lineTo(fx2, fyp - s * 0.12); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (st !== 'open') {   // 還不能打：外面罩一層護盾
          const pr = 0.55 + Math.sin(time * 2.4) * 0.15;
          ctx.fillStyle = `rgba(120,200,255,${0.16 * pr})`; ctx.strokeStyle = `rgba(160,225,255,${0.9 * pr})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, fy - h * 0.6, w * 0.62, h * 1.0, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else { ctx.fillStyle = '#6b747f'; for (let i = 0; i < 4; i++) { lines([x - w * 0.5 + i * w * 0.25, fy], [x - w * 0.42 + i * w * 0.25, fy - h * 1.2], [x - w * 0.3 + i * w * 0.25, fy]); ctx.fill(); } }
    }
    if (hitK > 0) { ctx.fillStyle = `rgba(255,255,255,${hitK * 0.55})`; ctx.fillRect(x - s * 0.55, fy - s, s * 1.1, s); }   // 被打閃白
    ctx.restore();
    // 血條（隊色）
    const bw = Math.max(80, s * 1.15), bh = clamp(s * 0.15, 13, 22), bx = x - bw / 2, by = fy - s * (p.kind === 'tower' ? 1.45 : 1.55) - bh;
    const ratio = clamp(v.shownHp / p.maxHp, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, (bh + 6) / 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    if (ratio > 0.005) { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * ratio), bh, bh / 2); ctx.fill(); }
    ctx.restore();
    text(`${down ? 0 : Math.max(0, Math.ceil(v.shownHp))}`, x, by + bh / 2, Math.max(11, bh * 0.85), '#fff');
    const fs = clamp(s * 0.26, 18, 28);   // 名字、說明字放大（直播橫幅縮得很小，原本幾乎看不清楚）
    text(p.kind === 'tower' ? (p.team === 'red' ? '紅塔' : '藍塔') : p.name, x, by - fs * 0.7, fs, col);   // 兩座塔貼在一起，名字縮短才不會疊在一起
    if (p.kind === 'base' && !down) {
      const msg = st === 'open' ? '可以攻擊！' : st === 'tower' ? '先拆防禦塔' : '要先打倒全部武將';
      text(msg, x, fy + fs * 0.9, fs * 0.72, st === 'open' ? '#ffe27a' : '#cfe9ff');
    }
  }
  // 陣營模式上方資訊列：紅隊人數｜剩餘時間｜藍隊人數；分出勝負時畫結果橫幅
  function drawTeamHud(arena) {
    const info = game.teamInfo();
    if (!info) return;
    const cx = arena.x + arena.w / 2, y = arena.y + 18, cols = config.team.colors || {};
    const mm = Math.floor(info.left / 60), ss = String(Math.floor(info.left % 60)).padStart(2, '0');
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.beginPath(); ctx.roundRect(cx - 190, y - 18, 380, 36, 18); ctx.fill();
    ctx.restore();
    text(`紅隊 ${info.red} 人`, cx - 105, y, 20, cols.red, 'center');
    text(`${mm}:${ss}`, cx, y, 20, '#fff', 'center');
    text(`${info.blue} 人 藍隊`, cx + 105, y, 20, cols.blue, 'center');
    if (info.winner) {
      const w = info.winner, label = w === 'draw' ? '平手！' : `${(config.team.names || {})[w]}獲勝！`, c = w === 'draw' ? '#fff' : cols[w];
      const by = arena.y + arena.h * 0.42;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(arena.x, by - 52, arena.w, 104); ctx.restore();
      text(`🏆 ${label}`, cx, by - 8, 54, c, 'center', true);
      text(`${Math.ceil(info.restartIn)} 秒後開始下一場`, cx, by + 34, 22, '#fff', 'center');
    }
  }

  // 禮物圖片：第一次用到時才去下載，下載好之前（或下載失敗）先不畫圖、只顯示禮物名稱
  const iconCache = new Map();
  function giftIcon(url) {
    if (!url) return null;
    if (!iconCache.has(url)) {
      const img = new Image();
      const entry = { img, ok: false };
      img.onload = () => { entry.ok = true; };
      img.src = url;
      iconCache.set(url, entry);
    }
    const e = iconCache.get(url);
    return e.ok ? e.img : null;
  }

  // 提示列專用的字：純白、最粗、描邊細（字小時粗描邊會把筆畫糊成一團）
  function legendText(str, x, y, size, color) {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.1); ctx.strokeStyle = '#000';
    ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function drawLegend(lg) {
    const k = lg.scale, bs = lg.base, h = bs.rowH * k;
    let cx = lg.x;
    lg.cols.forEach(col => {
      const cw = col.w * k;
      col.list.forEach((it, i) => {
        const y = lg.y + lg.h - (col.list.length - i) * (bs.rowH + bs.gap) * k + bs.gap * k, x = cx;   // 每一排都從最底下往上疊（貼齊右下角）
        ctx.fillStyle = it.boss ? 'rgba(24,8,48,0.96)' : 'rgba(0,0,0,0.95)';   // 幾乎純黑的底：跟白字的明暗對比最大
        ctx.beginPath(); ctx.roundRect(x, y, cw, h, 10 * k); ctx.fill();
        ctx.fillStyle = it.boss ? '#b45cff' : '#ffd35c';                         // 左邊一條色帶區分兩種（顏色只放在色帶，不放在字上）
        ctx.beginPath(); ctx.roundRect(x, y, 7 * k, h, [10 * k, 0, 0, 10 * k]); ctx.fill();
        let tx = x + 14 * k;
        const img = giftIcon(it.icon);
        if (img) { const size = bs.icon * k; ctx.drawImage(img, tx, y + (h - size) / 2, size, size); tx += size + 8 * k; }
        legendText(it.label, tx, y + h / 2, bs.font * k, '#fff');
        if (it.hint) {                                                          // 預設的招換 BOSS 要幾顆鑽
          ctx.font = `900 ${bs.font * k}px ${FONT}`;
          legendText(it.hint, tx + ctx.measureText(it.label).width + 10 * k, y + h / 2 + 1 * k, bs.hintFont * k, '#fff');
        }
      });
      cx += cw + bs.colGap * k;
    });
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
      text(`Lv.${s.level} ${s.heroName}`, lb.x + lb.w * 0.5, y, 13, '#b8c4cc', 'left', false);
      text(String(s.damage), lb.x + lb.w - 14, y, 17, '#ff8a7a', 'right');
    });
  }

  function drawBossLeaderboard(b) {
    const { name, rows } = b.data;
    ctx.fillStyle = 'rgba(40,16,72,0.82)';
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(194,123,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(`對${short(name, 6)}傷害`, b.x + b.w / 2, b.y + 24, 20, '#e6c8ff');
    if (!rows.length) text('還沒有人打到它', b.x + b.w / 2, b.y + 62, 14, '#c9b0e6', 'center', false);
    rows.forEach((s, i) => {
      const y = b.y + 62 + i * 32;
      text(String(i + 1), b.x + 22, y, 18, ['#ffd35c', '#dcdcdc', '#d99a6c'][i] || '#fff');
      text(short(s.name, 7), b.x + 42, y, 16, '#fff', 'left');
      text(`Lv.${s.level} ${s.heroName}`, b.x + b.w * 0.5, y, 13, '#c9b0e6', 'left', false);
      text(String(s.damage), b.x + b.w - 14, y, 17, '#ff8a7a', 'right');
    });
  }

  // ---------- 每一格：畫 ----------
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    if (!cw || !ch) return;
    // 畫面很小時（例如直播軟體裡把來源縮得很小），排行榜和文字的固定大小會把武將擠到沒地方站。
    // 所以小於「橫式 900x480／直式 480x760」時，整個畫面等比例縮小來畫，版面比例維持不變。
    const k = cw >= ch ? Math.min(1, cw / 900, ch / 480) : Math.min(1, cw / 480, ch / 760);
    W = cw / k; H = ch / k; viewK = k;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    ctx.clearRect(0, 0, W, H);   // 清成透明

    const { lb, lb2, arena, legend } = layout();
    if (arenas) arenas.draw(ctx, { x: 4, y: 4, w: W - 8, h: H - 8 }, dpr * k);   // 場地地面：鋪滿整個畫面（排行榜、禮物提示列畫在它上面）；預設全場透明＝什麼都不畫

    drawTrack();   // 賽跑：橢圓跑道（畫在武將下面）
    if (dim) {   // 技能發動：畫面短暫變暗，讓特效更顯眼
      ctx.fillStyle = `rgba(0,0,0,${config.skillDim * Math.sin(Math.PI * dim.age / dim.life)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    if (quake > 0) ctx.translate((Math.random() - 0.5) * quake * 14, (Math.random() - 0.5) * quake * 14);   // 重擊時整個畫面震一下
    effects.draw(ctx, true);    // 貼在地上的特效（法陣、地裂）

    // 正在衝撞的畫在最上面，其餘照前後位置
    [...views.values()].filter(v => v.x !== null)
      .sort((a, b) => (a.lunge ? 1 : 0) - (b.lunge ? 1 : 0) || feet(a) - feet(b)).forEach(drawHero);

    for (const r of rings) {
      if (!views.has(r.v.id)) continue;
      const k = r.age / r.life;
      const radius = (r.max ? r.v.size * r.max : Math.hypot(W, H) * 0.5) * k;
      ctx.beginPath(); ctx.arc(r.v.x, r.v.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = r.width || (r.max ? 5 : 10);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    drawLeavers();
    drawRaceBadges();
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

    drawTeamHud(arena);
    drawRaceHud(arena);
    if (game.getRace()) drawRaceBoard(lb, game.getRace()); else drawLeaderboard(lb);
    if (lb2) drawBossLeaderboard(lb2);
    if (legend) drawLegend(legend);
    drawBossQueue(arena, lb2 && W >= H ? lb2 : lb);

    // 訊息：橫式放在排行榜下方，直式放在畫面最底下（都不會蓋到武將）
    const wide = W >= H;
    toasts.forEach((t, i) => {
      ctx.globalAlpha = t.age > toastLife - 1 ? toastLife - t.age : 1;
      if (game.getMode() === 'team') {   // 陣營模式：右下角被主堡佔了，訊息改成兩行放在上方資訊列下面
        const k = toasts.length - 1 - i;
        if (k <= 1) text(t.text, arena.x + arena.w / 2, arena.y + 56 + (1 - k) * 22, 15, '#fff', 'center');
        ctx.globalAlpha = 1; return;
      }
      if (wide && toastBox) {   // 在提示列左邊、貼底、靠右對齊，新的在最下面、舊的往上；太長的字自動縮小塞進寬度
        ctx.font = `bold 15px ${FONT}`;
        const fs = Math.min(15, 15 * toastBox.w / Math.max(1, ctx.measureText(t.text).width));
        text(t.text, toastBox.right, toastBox.bottom - 12 - (toasts.length - 1 - i) * 24, fs, '#fff', 'right');
      } else if (wide) text(t.text, lb.x + 4, (lb2 && !wide ? lb2.y + lb2.h : lb.y + lb.h) + 22 + i * 24, 14, '#fff', 'left');
      else text(t.text, 20, H - 16 - (toasts.length - 1 - i) * 24, 15, '#fff', 'left');
      ctx.globalAlpha = 1;
    });

    if (![...views.values()].some(v => !v.fixed)) text('留言武將名字上場，例如「呂布」', arena.x + arena.w / 2, arena.y + arena.h / 2, 26, '#fff');
  }

  return {
    arenas,
    frame(dt) { update(dt); draw(); },
    // 自動測試用：讀出每隻武將目前的位置
    debugViews() { return [...views.values()].map(v => ({ id: v.id, x: v.x, y: v.y, size: v.size, down: v.down, face: v.face, moving: v.moving, anim: v.anim ? v.anim.name : '' })); },
    debugBounds() { return bounds; },
    reset() { views.clear(); leavers = []; floats = []; rings = []; timers = []; toasts = []; dim = null; quake = 0; effects.clear(); },
  };
};
