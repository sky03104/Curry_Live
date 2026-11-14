// ============================================================
// 畫面層：排位置、程式動態（彈跳、衝撞、閃白、震動）、名字、血條、排行榜、訊息。
// 這裡不改遊戲規則，只把 game.js 算好的結果「演」出來。
// 角色本體怎麼畫交給 hero-sprite.js。
// ============================================================
window.ML = window.ML || {};

ML.createRenderer = function (canvas, game, config, sprite, effects, getLegend, arenas) {
  const ctx = canvas.getContext('2d');
  const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif';
  const views = new Map();   // 觀眾代號 → 畫面上這隻武將的顯示狀態
  let floats = [];           // 飄起來的字（傷害數字、補血、技能名）
  let rings = [];            // 擴散的圓圈（全場攻擊、技能命中）
  let timers = [];           // 「幾秒後做某事」（讓扣血剛好發生在撞到的那一刻）
  let toasts = [];           // 左下角訊息
  let time = 0, W = 0, H = 0, viewK = 1;   // viewK：畫面整體縮小的比例（很小的直播畫面會等比例縮小來畫）
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
      sprite.preload(p.hero);   // 先去下載這隻的圖（用到才載入）
      views.set(e.id, { id: e.id, boss: !!p.isBoss, deadT: 0, x: null, y: null, size: p.isBoss ? 200 : 80, hp: p.hp, shownHp: p.hp, down: false,
        flash: 0, shake: 0, hop: 1, hopH: 1.2, lunge: null, pending: 0, kbx: 0, kby: 0, face: -1, faceShown: -1, phase: Math.random() * 6 });
      if (W > 0) layout();   // 馬上排好位置：上場和送禮可能發生在同一瞬間（沒上場就送禮會自動上場），攻擊演出需要它的位置
      return;
    }
    const v = views.get(e.id);
    if (!v) return;
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
      let delay;       // 幾秒後「打中」
      let onHit;       // 打中那一刻，在每個被打的人身上放的特效
      v.hold = 1.6; v.goal = null;   // 出招期間站定不走動
      if (e.action !== 'aoe' && !big) startAnim(v, 'attack');   // 有出招逐格動畫的武將（魚哥）：普攻播 attack
      if (tv0 && e.action !== 'aoe' && tv0.x !== v.x) v.face = Math.sign(tv0.x - v.x);   // 轉身面向對手

      if (e.action === 'aoe') {
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
      } else if (!big) {
        // 普攻：衝過去砍一刀（2026-11-13 放慢放大：衝撞時間拉長、刀光變大、多一圈衝擊波）
        v.lunge = { to: e.hits[0].id, t: 0, dur: 0.62 };
        delay = 0.31;
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

        if (style === 'slam') {            // 猛將：衝過去重擊，地面裂開
          after(charge, () => { v.lunge = { to: tv0.id, t: 0, dur: 0.72 }; startAnim(v, 'skill'); });
          delay = charge + 0.36;
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
      if (big && typeof delay === 'number' && ((config.troops[hero.troop] || {}).skillFx || 'slam') !== 'slam') after(Math.max(0.2, delay - 0.65), () => startAnim(v, 'skill'));
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
    const n = list.length;
    const wide = W >= H;
    const lbW = wide ? clamp(W * 0.26, 260, 340) : W - 32;
    const lbRows = Math.max(1, game.getLeaderboard().length);
    const lbH = 50 + lbRows * 32;
    const lb = { x: W - lbW - 16, y: 16, w: lbW, h: lbH };
    // 對 BOSS 的傷害排行榜：放在傷害排行榜正下方，場上有 BOSS 才出現（2026-11-14 咖哩要求）
    const bl = game.getBossLeaderboard();
    const lb2 = bl ? { x: lb.x, y: lb.y + lb.h + 10, w: lb.w, h: 50 + Math.max(1, bl.rows.length) * 32, data: bl } : null;
    const top = lb2 ? lb2.y + lb2.h - lb.y : lbH;   // 排行榜們（一個或兩個）合起來佔的高度
    const arena = wide ? { x: 16, y: 16, w: W - lbW - 48, h: H - 32 }
                       : { x: 16, y: top + 32, w: W - 32, h: H - top - 48 - 100 };   // 直式：底下留 100 給訊息
    // 禮物提示列：告訴觀眾「送哪個禮物會觸發哪個動作」。
    // （2026-11-13 咖哩要求移到畫面右下角；2026-11-14 再要求改成「一排直的」：一個動作一列，從右下角往上疊。
    //   空間不夠（排行榜佔了很多、或畫面很扁）就整排縮小，最小縮到一半。）
    const items = getLegend ? getLegend() : [];
    let legend = null;
    if (items.length) {
      // 2026-11-14 咖哩用手機看說「還是霧霧的」：直播影片壓縮會把彩色的字糊掉（顏色資訊被壓得很粗，只有明暗保得住），
      // 所以提示列的字一律用純白＋最粗字重、底色用接近純黑，靠「明暗對比」撐住清晰度；字放到 34；沒有禮物圖片的格子不再畫空方框，省出空間給字。
      const base = { rowH: 54, gap: 4, icon: 40, colGap: 8, font: 34, hintFont: 26 };
      ctx.font = `900 ${base.font}px ${FONT}`;
      const wOf = it => { const img = giftIcon(it.icon); return 14 + (img ? base.icon + 8 : 0) + ctx.measureText(it.label).width + (it.hint ? 10 + ctx.measureText(it.hint).width * base.hintFont / base.font : 0) + 14; };
      // 兩排直的：左邊是一般動作（普攻、全場、技能、回血），最右邊是招換 BOSS（紫色底）；只有一種就只畫一排
      const cols = [items.filter(i => !i.boss), items.filter(i => i.boss)].filter(c => c.length)
        .map(list => ({ list, w: Math.max(...list.map(wOf)) }));
      const natW = cols.reduce((a, c) => a + c.w, 0) + (cols.length - 1) * base.colGap;
      const natH = Math.max(...cols.map(c => c.list.length)) * (base.rowH + base.gap) - base.gap;
      const stackBottom = lb2 ? lb2.y + lb2.h : lb.y + lb.h;                    // 右上角排行榜們的最下緣
      const avail = H - 16 - (wide ? stackBottom + 12 + (H >= 700 ? 4 * 24 : 0) : 120);   // 橫式：排行榜下面剩多少（畫面夠高才多留 4 行訊息的位置，扁的畫面把空間都給提示列）
      const minScale = Math.max(0.8, Math.min(1.1, 14 / (viewK * base.font)));   // 畫面被等比例縮小時（例如直播橫幅），提示列的字要補回來：在螢幕上至少約 14 像素高
      const scale = clamp(avail / natH, minScale, 1.1);   // 最大 1.1 倍（再大會蓋住畫面）
      const w = natW * scale, h = natH * scale;
      legend = { cols, scale, base, w, h, x: W - 16 - w, y: H - 16 - h };
      if (!wide) arena.w -= w + 8;                                              // 直式：場地讓出右邊這一塊
      else if (arena.x + arena.w > legend.x - 12) arena.w = Math.max(120, legend.x - 12 - arena.x);   // 橫式：提示列比右邊那一欄寬時，武將的活動範圍也往左縮
    }
    const wander = config.wander && config.wander.enabled;
    // BOSS：又大又固定，站在場地中間偏下；一般武將會被推開、不會疊在它身上
    const bossV = views.get('boss');
    if (bossV && game.getPlayer('boss')) {
      const bs = clamp(Math.min(arena.h * 0.45, arena.w * 0.31), 90, 280);   // 2026-11-13 咖哩嫌太大：比原本小約兩成
      const tx = arena.x + arena.w / 2, ty = arena.y + arena.h * 0.78 - bs / 2;
      if (bossV.x === null) { bossV.x = tx; bossV.y = ty; bossV.size = bs; }
      bossV.tsize = bs; bossV.tx = tx; bossV.ty = ty;
    }
    if (n) {
      // 試每一種「一排幾隻」，挑角色能畫最大的那種
      let best = null;
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cw = arena.w / cols, ch = arena.h / rows;
        const size = Math.min(cw * 0.6, ch * 0.5, 190) * (wander ? 0.85 : 1);   // 留空間給名字、血條、腳下兩行字；會走動時再小一點才有路可走
        if (!best || size > best.size) best = { cols, rows, cw, ch, size };
      }
      // 會走動時，武將高度最多佔場地高度的 36%，上下才留得出走動的空間（扁長的畫面特別需要）
      const size = Math.max(36, wander ? Math.min(best.size, arena.h * 0.36) : best.size);
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
    floats.forEach(f => f.age += dt); floats = floats.filter(f => f.age < (f.life || 1) && views.has(f.v.id));
    rings.forEach(r => r.age += dt); rings = rings.filter(r => r.age < r.life);
    toasts.forEach(t => t.age += dt); toasts = toasts.filter(t => t.age < 5);
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
  function roam(dt) {
    const cfg = config.wander, b = bounds;
    const list = [...views.values()].filter(v => v.x !== null);
    for (const v of list) {
      v.moving = false; v.want = 0; v.px = v.x; v.py = v.y;
      // 倒地、正在出招或挨打時不走動（BOSS 固定站著）
      if (v.boss || v.down || v.lunge || v.pending > 0 || v.hold > 0) continue;
      if (!v.goal) {
        if ((v.rest = (v.rest === undefined ? Math.random() * cfg.restMax : v.rest) - dt) > 0) continue;
        // 隨機挑幾個候選地點，只考慮「走過去不會擠到別人」的，從中選最空的；
        // 都會擠到別人就先不走，等一下再找（硬走過去只會被推回來、卡在原地）
        const reach = cfg.stepMax * v.size;   // 一次最多走多遠
        let best = null;
        for (let c = 0; c < 10; c++) {
          const x = clamp(v.x + (Math.random() * 2 - 1) * reach, b.x0, b.x1), y = clamp(v.y + (Math.random() * 2 - 1) * reach, b.y0, b.y1);
          if (Math.hypot(x - v.x, y - v.y) < v.size * 0.4) continue;       // 太近了，等於沒走
          let room = 9;
          for (const o of list) if (o !== v) room = Math.min(room, gap(x, y, (o.goal || o).x, (o.goal || o).y, o.boss ? (v.size + o.size) / 2 : v.size));
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
      const wa = a.boss ? 0 : c.boss ? 1 : a.down ? 0 : c.down ? 1 : 0.5;   // BOSS 推不動，別人會被推開
      a.x -= dx * push * wa; a.y -= dy * push * wa; c.x += dx * push * (1 - wa); c.y += dy * push * (1 - wa);
    }
    for (const v of list) {
      if (!v.down && !v.boss) { v.x = clamp(v.x, b.x0, b.x1); v.y = clamp(v.y, b.y0, b.y1); }
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
    const pose = v.down ? 'down' : v.lunge ? 'attack' : v.flash > 0 ? 'hit' : 'idle';
    // 身體傾斜：衝撞時往前傾，被打時往後仰
    let lean = 0;
    if (v.lunge) { const t = views.get(v.lunge.to); if (t) lean = Math.sign(t.x - v.x || 1) * 0.22 * Math.sin(Math.PI * v.lunge.t / v.lunge.dur); }
    else lean = clamp(v.kbx / size * 1.4, -0.35, 0.35) + (v.moving ? v.dir * 0.06 : 0);   // 走路時微微往前進方向傾
    sprite.draw(ctx, p.hero, x, y, size, { pose, poseTime: v.lunge ? v.lunge.t : time, flash: v.flash, lean, facing: v.faceShown, phase: v.phase, moving: v.moving, anim: v.anim });

    // 血條
    const bw = Math.max(54, size * 0.95), bh = Math.max(7, size * 0.09);
    const bx = x - bw / 2, by = y - r - size * 0.05 - bh - 6;   // 全身圖比 size 高一點，血條跟著往上
    const ratio = clamp(v.shownHp / p.maxHp, 0, 1);
    // 圓角膠囊：白底、粉色細邊，裡面是柔和的彩色血量，上面一道亮光；左端一顆小愛心
    const pill = (px, py, w, h) => { const rr = h / 2; ctx.beginPath(); ctx.moveTo(px + rr, py); ctx.arcTo(px + w, py, px + w, py + h, rr); ctx.arcTo(px + w, py + h, px, py + h, rr); ctx.arcTo(px, py + h, px, py, rr); ctx.arcTo(px, py, px + w, py, rr); ctx.closePath(); };
    ctx.save();
    pill(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffb8cf'; ctx.stroke();
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

    // 觀眾名字（血條上方）、武將名（腳下）
    // 名字前面加等級，例如「Lv.5 小明」
    ctx.font = `bold ${fs}px ${FONT}`;
    const lv = `Lv.${p.prof.level} `, nm = short(p.name, 8);
    const lvW = ctx.measureText(lv).width * 0.8, nmW = ctx.measureText(nm).width, left = x - (lvW + nmW) / 2;
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
    } else if (p.lockId && game.getPlayer(p.lockId)) {
      text(`鎖定▶${short(game.getPlayer(p.lockId).name, 7)}`, x, ly, fs * 0.72, '#ffd35c');
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
    if (lb2) drawBossLeaderboard(lb2);
    if (legend) drawLegend(legend);
    drawBossQueue(arena, lb);

    // 訊息：橫式放在排行榜下方，直式放在畫面最底下（都不會蓋到武將）
    const wide = W >= H;
    toasts.forEach((t, i) => {
      ctx.globalAlpha = t.age > 4 ? 5 - t.age : 1;
      if (wide) text(t.text, lb.x + 4, (lb2 ? lb2.y + lb2.h : lb.y + lb.h) + 22 + i * 24, 14, '#fff', 'left');
      else text(t.text, 20, H - 16 - (toasts.length - 1 - i) * 24, 15, '#fff', 'left');
      ctx.globalAlpha = 1;
    });

    if (!views.size) text('留言武將名字上場，例如「呂布」', arena.x + arena.w / 2, arena.y + arena.h / 2, 26, '#fff');
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
