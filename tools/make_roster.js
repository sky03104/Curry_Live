// 產生「武將名冊」圖片（發給觀眾看有哪些武將可以選）。
// 用法：node tools/make_roster.js [Curry_Games 的路徑，預設 ../Curry_Games]
// 需要 Playwright（用它開一個看不見的瀏覽器把網頁拍成圖）。
// 輸出到 roster/：一張全武將長圖 + 魏蜀吳群各一張。
// 武將圖用 Curry_Games 的原尺寸全身圖（比遊戲裡縮小過的清楚），資料用 data/heroes.js。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const src = path.resolve(process.argv[2] || path.join(root, '..', 'Curry_Games'));
const artDir = path.join(src, 'UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D');
global.window = {};
require(path.join(root, 'data/heroes.js'));
require(path.join(root, 'js/config.js'));
const heroes = window.HEROES_DATA, factions = window.GAME_CONFIG.factions;

const img = id => {
  const file = path.join(artDir, id + '.png');
  if (fs.statSync(file).size < 1000) throw new Error(id + '.png 是 Git LFS 佔位檔，請先在 Curry_Games 執行 git lfs pull（見 CLAUDE.md）');
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
};

function section(key) {
  const f = factions[key], list = heroes.filter(h => h.faction === key);
  return `<section style="--c:${f.color}">
    <h2><span class="seal">${f.label}</span><span class="count">${list.length} 位武將</span></h2>
    <div class="grid">${list.map(h => `
      <div class="card"><div class="pic"><img src="${img(h.heroId)}"></div>
        <div class="name">${h.displayName}</div><div class="skill">技能｜${h.skillName}</div></div>`).join('')}
    </div></section>`;
}

function page(keys, title) {
  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1080px; background: #F7F1E3; color: #3E4A46; padding: 44px 40px 36px;
    font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif; }
  header { text-align: center; margin-bottom: 26px; }
  header h1 { font-size: 58px; letter-spacing: 4px; color: #B23F2B; }
  header .sub { font-size: 30px; margin-top: 6px; letter-spacing: 6px; }
  header .how { display: inline-block; margin-top: 18px; padding: 12px 30px; border-radius: 999px; background: #D9563E; color: #fff; font-size: 30px; font-weight: bold; }
  section { margin-top: 30px; background: #fff; border: 3px solid #E3D9BE; border-radius: 26px; padding: 22px 22px 26px; }
  h2 { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .seal { display: inline-flex; width: 76px; height: 76px; align-items: center; justify-content: center; border-radius: 18px;
    background: var(--c); color: #fff; font-size: 48px; font-weight: bold; }
  .count { font-size: 28px; color: var(--c); font-weight: bold; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .card { border: 3px solid var(--c); border-radius: 20px; overflow: hidden; background: #FBF8EF; text-align: center; padding-bottom: 12px; }
  .pic { height: 250px; padding-top: 10px; background: linear-gradient(#fff, color-mix(in srgb, var(--c) 22%, #fff)); }
  .pic img { height: 240px; }
  .name { font-size: 38px; font-weight: bold; margin-top: 8px; }
  .skill { font-size: 23px; color: #6b7672; margin-top: 2px; white-space: nowrap; }
  footer { text-align: center; margin-top: 26px; font-size: 24px; color: #8C9490; line-height: 1.6; }
  </style>
  <header><h1>萌戰三國・直播亂鬥</h1><div class="sub">${title}</div><div class="how">在直播間留言武將名字，就能上場！</div></header>
  ${keys.map(section).join('')}
  <footer>送禮可以攻擊、放技能、回血　｜　留言「@對方名字」鎖定目標<br>想換武將？直接留言新的武將名字</footer>`;
}

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 1.5 });
  const all = Object.keys(factions);
  const jobs = [[all, `全武將名冊（共 ${heroes.length} 位）`, '全武將名冊.jpg'],
    ...all.map(k => [[k], `${factions[k].label}國武將`.replace('群國', '群雄'), `武將名冊_${factions[k].label}.jpg`])];
  for (const [keys, title, file] of jobs) {
    await tab.setContent(page(keys, title));
    await tab.screenshot({ path: path.join(root, 'roster', file), fullPage: true, type: 'jpeg', quality: 92 });
    console.log('已產生 roster/' + file);
  }
  await browser.close();
})();
