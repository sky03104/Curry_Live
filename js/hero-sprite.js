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

  const ready = Promise.all(heroes.map(h => new Promise(resolve => {
    if (h.isBoss && !h.hasArt) { resolve(); return; }   // BOSS 還沒放圖（config.boss.list 的 hasArt 是 false）就不去找圖檔，用示意怪獸
    const img = new Image();
    img.onload = () => { images.set(h.heroId, img); whites.set(h.heroId, makeWhite(img)); resolve(); };
    img.onerror = () => resolve();   // 圖載不到就畫底圈＋名字，不讓整個遊戲停擺
    img.src = `${basePath}/${h.heroId}.png`;
  })));

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
    // (x, y) 是角色中心，size 是角色高度。state = { pose, poseTime, flash(0~1 閃白強度), lean(身體傾斜角度), facing(-1 面向左 ~ 1 面向右) }
    draw(ctx, hero, x, y, size, state) {
      const color = (config.factions[hero.faction] || {}).color || '#888';
      const img = images.get(hero.heroId);
      const down = state.pose === 'down';
      // 全身圖是直的（312x396），腳貼在圖的最底。BOSS 的圖比例不固定（龍、猿…），照圖片自己的長寬比畫。
      const h = size * 1.12, aspect = hero.isBoss ? (img ? img.naturalWidth / img.naturalHeight : 1.25) : 312 / 396, w = h * aspect;
      const footY = y + size / 2;

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
        if (state.pose === 'idle') {
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
      if (img) {
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
