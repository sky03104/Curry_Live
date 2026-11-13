// 把 tools/boss_art/*.svg 轉成透明背景的 PNG（裁掉四周空白、腳貼底），放進 assets/heroes/。
// 用法：node tools/render_boss_art.js        （需要 playwright，只有「做圖」的人才需要，遊戲本身不需要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SRC = path.join(__dirname, 'boss_art'), OUT = path.join(ROOT, 'assets', 'heroes');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of fs.readdirSync(SRC).filter(n => n.endsWith('.svg') && !n.startsWith('_'))) {   // 底線開頭的是備用檔，不轉
    const svg = fs.readFileSync(path.join(SRC, f), 'utf8');
    const dataUrl = await page.evaluate(async ({ svg }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const S = 1200, c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
      const d = g.getImageData(0, 0, S, S).data;
      let x0 = S, y0 = S, x1 = 0, y1 = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(1, 640 / Math.max(w, h));
      const o = document.createElement('canvas'); o.width = Math.round(w * k); o.height = Math.round(h * k);
      o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, o.width, o.height);
      return o.toDataURL('image/png');
    }, { svg });
    const out = path.join(OUT, f.replace('.svg', '.png'));
    fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('已產生', path.relative(ROOT, out), Math.round(fs.statSync(out).size / 1024) + 'KB');
  }
  await browser.close();
})();
