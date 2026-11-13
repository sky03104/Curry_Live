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
    const img = new Image();
    img.onload = () => { images.set(h.heroId, img); whites.set(h.heroId, makeWhite(img)); resolve(); };
    img.onerror = () => resolve();   // 圖載不到就畫底圈＋名字，不讓整個遊戲停擺
    img.src = `${basePath}/${h.heroId}.png`;
  })));

  return {
    ready,
    // (x, y) 是角色中心，size 是角色高度。state = { pose, poseTime, flash(0~1 閃白強度), lean(身體傾斜角度), facing(-1 面向左 ~ 1 面向右) }
    draw(ctx, hero, x, y, size, state) {
      const color = (config.factions[hero.faction] || {}).color || '#888';
      const img = images.get(hero.heroId);
      const down = state.pose === 'down';
      const h = size * 1.12, w = h * 312 / 396;   // 全身圖是直的（312x396），腳貼在圖的最底
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
