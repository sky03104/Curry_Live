// ============================================================
// 畫角色層
// 現在的做法：一張頭像 + 陣營色底圈。動態（彈跳、衝撞、震動）由 render.js 移動位置來做。
// 之後要換成連續圖動畫：只改這個檔。draw 會收到 pose（目前的動作）和 poseTime（這個動作
// 已經播了幾秒），照這兩個值挑要畫哪一格即可，其他程式不用動。
//
//   pose： 'idle' 待機 ｜ 'attack' 攻擊中 ｜ 'hit' 被打 ｜ 'down' 倒地
// ============================================================
window.ML = window.ML || {};

ML.createHeroSprite = function (heroes, config, basePath) {
  const images = new Map();   // heroId → 頭像
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
    // (x, y) 是角色中心，size 是角色寬高。state = { pose, poseTime, flash(0~1 閃白強度) }
    draw(ctx, hero, x, y, size, state) {
      const color = (config.factions[hero.faction] || {}).color || '#888';
      const img = images.get(hero.heroId);
      const down = state.pose === 'down';
      const r = size / 2;

      // 腳下影子
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.95, r * 0.7, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      if (down) {                       // 倒地：躺平、變灰、變淡
        ctx.translate(0, r * 0.45);
        ctx.rotate(Math.PI / 2 * 0.92);
        ctx.filter = 'grayscale(1)';
        ctx.globalAlpha = 0.6;
      }
      // 陣營色底圈
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
      ctx.fillStyle = color + 'cc';
      ctx.fill();
      ctx.lineWidth = Math.max(2, size * 0.045);
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      if (img) {
        ctx.drawImage(img, -r, -r, size, size);
        if (state.flash > 0 && !down) {
          ctx.globalAlpha = Math.min(1, state.flash);
          ctx.drawImage(whites.get(hero.heroId), -r, -r, size, size);
        }
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.3}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hero.displayName, 0, 0);
      }
      ctx.restore();
    },
  };
};
