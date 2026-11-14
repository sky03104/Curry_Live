// ============================================================
// 畫角色層
// 現在的做法：一張全身圖（腳下不畫任何底圈；陣營靠腳下文字的顏色分辨）。動態（彈跳、衝撞、震動）由 render.js 移動位置來做。
// 之後要換成連續圖動畫：只改這個檔。draw 會收到 pose（目前的動作）和 poseTime（這個動作
// 已經播了幾秒），照這兩個值挑要畫哪一格即可，其他程式不用動。
//
//   idle 時圖片自己會呼吸、晃動（state.phase 讓每隻節奏不同、state.moving 走路時動作較大）
//   pose： 'idle' 待機 ｜ 'attack' 攻擊中 ｜ 'hit' 被打 ｜ 'down' 倒地
// ============================================================
window.ML = window.ML || {};

ML.createHeroSprite = function (heroes, config, basePath) {
  const images = new Map();   // heroId → 全身圖
  const whites = new Map();   // heroId → 同形狀的純白剪影（閃白用）

  function makeWhite(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // 「用到才載入」（2026-11-14）：以前一開網頁就把全部武將圖（約 11 MB）載入，角色越多越慢；
  // 現在某隻武將第一次要畫（上場、換角、BOSS 出現）時，才去下載它那一張圖，之後就在記憶體裡。
  // 狀態：'loading' 下載中（這時先不畫，通常不到 0.1 秒）／'ok' 好了／'error' 載不到（畫底色塊＋名字，BOSS 畫示意怪獸）。
  const loadState = new Map();   // heroId → 'loading' | 'ok' | 'error'
  function load(h) {
    const id = h.heroId, s = loadState.get(id);
    if (s) return s;
    if (h.isBoss && !h.hasArt) { loadState.set(id, 'error'); return 'error'; }   // BOSS 還沒放圖（config.boss.list 的 hasArt 是 false）就不去找圖檔，用示意怪獸
    loadState.set(id, 'loading');
    const img = new Image();
    img.onload = () => { images.set(id, img); whites.set(id, makeWhite(img)); loadState.set(id, 'ok'); };
    img.onerror = () => loadState.set(id, 'error');   // 圖載不到就畫底色塊＋名字，不讓整個遊戲停擺
    img.src = `${basePath}/${id}.png`;
    return 'loading';
  }
  // ---------- 逐格動畫（config.heroAnims）----------
  // 某隻武將有設定的動作（例如米其林的 eat／idle），圖是「一排橫放的連續圖」。第一次畫到才下載。
  const sheets = new Map();   // 'heroId/動作' → 圖
  function animMeta(heroId, name) { const a = (config.heroAnims || {})[heroId]; return a && a[name] || null; }
  function loadSheet(heroId, name) {
    const key = heroId + '/' + name, m = animMeta(heroId, name);
    if (!m) return null;
    if (!sheets.has(key)) {
      sheets.set(key, null);
      const img = new Image();
      img.onload = () => sheets.set(key, img);   // 載不到就維持 null，這個動作就不會播
      img.src = `${basePath}/${m.src}`;
    }
    return sheets.get(key);
  }
  const ready = Promise.resolve();   // 不用等圖：畫面可以馬上開始跑

  // 示意用的怪獸（BOSS 的正式圖檔放進 assets/heroes/<id>.png 之後就不會再用到）：
  // 深色身體、兩支角、發光的眼睛、背上的尖刺。原點在腳底中央，往上畫。
  function drawPlaceholderBoss(g, hero, w, h, t) {
    const accent = hero.accent || '#b45cff', breathe = 1 + Math.sin(t * 2.4) * 0.015;
    g.save(); g.scale(1, breathe);
    const body = g.createLinearGradient(0, -h, 0, 0); body.addColorStop(0, '#3a2260'); body.addColorStop(1, '#150a26');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, -h * 0.4, w * 0.36, h * 0.36, 0, 0, Math.PI * 2); g.fill();            // 身體
    g.beginPath(); g.ellipse(-w * 0.2, -h * 0.12, w * 0.12, h * 0.12, 0, 0, Math.PI * 2); g.fill();     // 前腳
    g.beginPath(); g.ellipse(w * 0.2, -h * 0.12, w * 0.12, h * 0.12, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, -h * 0.72, w * 0.22, h * 0.2, 0, 0, Math.PI * 2); g.fill();            // 頭
    for (const s of [-1, 1]) {                                                                         // 角
      g.beginPath(); g.moveTo(s * w * 0.1, -h * 0.84); g.quadraticCurveTo(s * w * 0.3, -h * 0.96, s * w * 0.28, -h * 1.0);
      g.quadraticCurveTo(s * w * 0.2, -h * 0.92, s * w * 0.04, -h * 0.82); g.closePath(); g.fill();
    }
    g.fillStyle = '#271544';                                                                           // 背上的尖刺
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * w * 0.08 - 8, -h * 0.72); g.lineTo(i * w * 0.08, -h * (0.82 + (3 - Math.abs(i)) * 0.03)); g.lineTo(i * w * 0.08 + 8, -h * 0.72); g.fill(); }
    g.shadowColor = accent; g.shadowBlur = 18; g.fillStyle = accent;                                    // 發光的眼睛
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * w * 0.09, -h * 0.74, w * 0.04, h * 0.025, s * 0.3, 0, Math.PI * 2); g.fill(); }
    g.shadowBlur = 0;
    g.strokeStyle = accent; g.globalAlpha = 0.5; g.lineWidth = 3;                                       // 身上的發光紋路
    g.beginPath(); g.moveTo(-w * 0.2, -h * 0.5); g.quadraticCurveTo(0, -h * 0.58, w * 0.2, -h * 0.5); g.stroke();
    g.globalAlpha = 1; g.restore();
  }

  return {
    ready,
    preload(hero) { load(hero); Object.keys((config.heroAnims || {})[hero.heroId] || {}).forEach(n => loadSheet(hero.heroId, n)); },   // 先去下載（上場時呼叫，讓第一次畫的時候圖已經在了）
    // 這隻武將有幾組待機動畫（idle、idle2、idle3…，依序）；停下來時輪流播
    idleNames(heroId) {
      const a = (config.heroAnims || {})[heroId] || {};
      return Object.keys(a).filter(k => /^idle\d*$/.test(k)).sort((x, y) => (parseInt(x.slice(4)) || 1) - (parseInt(y.slice(4)) || 1));
    },
    // 這隻武將有沒有這個動作、圖準備好了沒；回傳 { 秒數 } 或 null
    animInfo(heroId, name) {
      const m = animMeta(heroId, name);
      return m && loadSheet(heroId, name) ? { dur: m.frames * (m.repeat || 1) / (m.fps || 4) } : null;
    },
    // (x, y) 是角色中心，size 是角色高度。state = { pose, poseTime, flash(0~1 閃白強度), lean(身體傾斜角度), facing(-1 面向左 ~ 1 面向右) }
    draw(ctx, hero, x, y, size, state) {
      if (load(hero) === 'loading') return;   // 這隻的圖還在下載，先不畫（下一格就會出現）
      const color = (config.factions[hero.faction] || {}).color || '#888';
      const img = images.get(hero.heroId);
      const down = state.pose === 'down';
      // 全身圖是直的（312x396），腳貼在圖的最底。BOSS 的圖比例不固定（龍、猿…），照圖片自己的長寬比畫。
      const h = size * 1.12, aspect = hero.isBoss ? (img ? img.naturalWidth / img.naturalHeight : 1.25) : 312 / 396, w = h * aspect;
      const footY = y + size / 2;
      // 正在播逐格動畫（state.anim = { name, t }）：改畫那一格。被打（閃白）時先回到單張圖，閃白才看得到
      let anim = null;
      if (state.anim && !down && !(state.flash > 0.05)) {
        const m = animMeta(hero.heroId, state.anim.name), sh = m && loadSheet(hero.heroId, state.anim.name);
        if (sh) {
          const n = Math.floor(state.anim.t * (m.fps || 4));   // 第幾格（連續算）；repeat 次循環播完後停在最後一格
          anim = { m, sh, frame: n >= m.frames * (m.repeat || 1) ? m.frames - 1 : n % m.frames };
        }
      }

      // 走路中：有登記走路動畫（config.heroAnims.<id>.walk）就循環播（不被打、沒在播別的動畫時）
      if (!anim && state.moving && !down && !(state.flash > 0.05)) {
        const m = animMeta(hero.heroId, 'walk'), sh = m && loadSheet(hero.heroId, 'walk');
        if (sh) anim = { m, sh, frame: Math.floor((state.poseTime || 0) * (m.fps || 8) + (state.phase || 0)) % m.frames };
      }

      ctx.save();
      if (down) {                       // 倒地：躺平、變灰、變淡
        ctx.translate(x, footY - w * 0.42);
        ctx.rotate(Math.PI / 2);
        ctx.filter = 'grayscale(1)';
        ctx.globalAlpha = 0.65;
        ctx.translate(0, h / 2 * 0.8);
      } else {
        ctx.translate(x, footY);
        ctx.rotate(state.lean || 0);   // 以腳為軸心前傾／後仰
        // 左右翻面：facing 是 -1（面向左）到 1（面向右），中間值是正在轉身。
        // 原圖預設面向左；config.artFacesRight 裡列的武將原圖是面向右的。
        const artDir = (config.artFacesRight || []).includes(hero.heroId) ? 1 : -1;
        const turn = (state.facing === undefined ? -1 : state.facing) * artDir;   // 1 = 照原圖畫，-1 = 左右相反
        ctx.scale(Math.sign(turn || 1) * Math.max(0.15, Math.abs(turn)), 1);
        // 待機／走路時圖片自己也會動（以腳為軸心）：呼吸（一下高一下矮）＋身體左右輕晃（頭晃得比腳多）
        if (state.pose === 'idle' && !anim) {
          const t = (state.poseTime || 0), ph = state.phase || 0;
          if (state.moving) {                                   // 走路：隨腳步一壓一彈，身體左右搖
            const step = Math.sin(t * 9 + ph);
            ctx.transform(1, 0, step * 0.06, 1, 0, 0);
            ctx.scale(1 - Math.abs(step) * 0.03, 1 + Math.abs(step) * 0.05);
          } else {                                              // 站著：慢慢呼吸、輕輕晃
            const br = Math.sin(t * 2.4 + ph);
            ctx.transform(1, 0, Math.sin(t * 1.3 + ph * 1.7) * 0.035, 1, 0, 0);
            ctx.scale(1 - br * 0.018, 1 + br * 0.035);
          }
        }
      }
      // 以下以「腳底中央」為原點往上畫
      if (anim) {
        // 動畫圖的像素比例跟單張圖（312x396）一樣，所以用同一個縮放；腳底那一列對在原點
        const k = h / 396, m = anim.m;
        ctx.drawImage(anim.sh, anim.frame * m.cw, 0, m.cw, m.ch, -m.cw * k / 2, -m.ground * k, m.cw * k, m.ch * k);
      } else if (img) {
        ctx.drawImage(img, -w / 2, -h, w, h);
        if (state.flash > 0 && !down) {
          ctx.globalAlpha = Math.min(1, state.flash);
          ctx.drawImage(whites.get(hero.heroId), -w / 2, -h, w, h);
        }
      } else if (hero.isBoss) {
        drawPlaceholderBoss(ctx, hero, w, h, state.poseTime || 0);   // 還沒放 BOSS 的圖：先畫一隻示意用的怪獸
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.22}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hero.displayName, 0, -h / 2);
      }
      ctx.restore();
    },
  };
};
