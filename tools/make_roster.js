// 產生「武將名冊」圖片（發給觀眾看有哪些武將可以選）。
// 用法：node tools/make_roster.js [Curry_Games 的路徑，預設 ../Curry_Games]
// 需要 Playwright（用它開一個看不見的瀏覽器把網頁拍成圖）。
// 另外有一張「全武將清單」：只有陣營、武將名稱、技能名稱，沒有武將圖（純文字一覽表）。
// 輸出到 roster/：一張全武將總覽圖（橫式、一張就看完，不是長圖）+ 蜀魏吳群萌各一張。
// 武將圖用 Curry_Games 的原尺寸全身圖（比遊戲裡縮小過的清楚），資料用 data/heroes.js 加上 data/extra-heroes.js。
// 自己新增的角色（extra: true，例如米其林）不在 Curry_Games 裡，改用 assets/heroes 裡的圖。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const src = path.resolve(process.argv[2] || path.join(root, '..', 'Curry_Games'));
const artDir = path.join(src, 'UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D');
global.window = {};
require(path.join(root, 'data/heroes.js'));
require(path.join(root, 'data/extra-heroes.js'));
require(path.join(root, 'js/config.js'));
const heroes = window.HEROES_DATA, factions = window.GAME_CONFIG.factions;

const img = (id, extra) => {
  const file = extra ? path.join(root, 'assets/heroes', id + '.png') : path.join(artDir, id + '.png');
  if (fs.statSync(file).size < 1000) throw new Error(id + '.png 是 Git LFS 佔位檔，請先在 Curry_Games 執行 git lfs pull（見 CLAUDE.md）');
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
};

function section(key) {
  const f = factions[key], list = heroes.filter(h => h.faction === key);
  return `<section style="--c:${f.color}">
    <h2><span class="seal">${f.label}</span><span class="count">${list.length} 位武將</span></h2>
    <div class="grid">${list.map(h => `
      <div class="card"><div class="pic"><img src="${img(h.heroId, h.extra)}"></div>
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
  <footer>送禮可以攻擊、放技能、回血　｜　留言「@對方名字」鎖定目標<br>想換武將？直接留言新的武將名字　｜　想下場？留言「烙跑」</footer>`;
}

// 全武將總覽：一個陣營一排，全部擠在一張橫式的圖裡（不是長圖）
function pageAll() {
  const keys = Object.keys(factions).filter(k => heroes.some(h => h.faction === k));
  const cols = Math.max(...keys.map(k => heroes.filter(h => h.faction === k).length));
  const row = key => {
    const f = factions[key], list = heroes.filter(h => h.faction === key);
    return `<div class="row" style="--c:${f.color}"><div class="lab"><span class="seal">${f.label}</span><span class="cnt">${list.length}位</span></div>
      <div class="cells">${list.map(h => `<div class="c"><div class="p"><img src="${img(h.heroId, h.extra)}"></div><div class="n">${h.displayName}</div><div class="k">${h.skillName}</div></div>`).join('')}</div></div>`;
  };
  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${cols * 188 + 150 + 60}px; background: #F7F1E3; color: #3E4A46; padding: 26px 30px 22px;
    font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif; }
  header { display: flex; align-items: baseline; justify-content: center; gap: 28px; margin-bottom: 14px; }
  header h1 { font-size: 50px; letter-spacing: 4px; color: #B23F2B; } header .sub { font-size: 28px; letter-spacing: 4px; }
  header .how { padding: 8px 24px; border-radius: 999px; background: #D9563E; color: #fff; font-size: 26px; font-weight: bold; }
  .row { display: flex; align-items: stretch; gap: 10px; margin-top: 10px; background: #fff; border: 3px solid #E3D9BE; border-radius: 20px; padding: 8px 10px; }
  .lab { width: 130px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
  .seal { display: inline-flex; width: 78px; height: 78px; align-items: center; justify-content: center; border-radius: 18px; background: var(--c); color: #fff; font-size: 50px; font-weight: bold; }
  .cnt { font-size: 24px; color: var(--c); font-weight: bold; }
  .cells { display: flex; gap: 8px; }
  .c { width: 180px; border: 3px solid var(--c); border-radius: 14px; overflow: hidden; background: #FBF8EF; text-align: center; padding-bottom: 6px; }
  .p { height: 190px; padding-top: 6px; background: linear-gradient(#fff, color-mix(in srgb, var(--c) 22%, #fff)); } .p img { height: 182px; max-width: 100%; object-fit: contain; }
  .n { font-size: 30px; font-weight: bold; margin-top: 4px; white-space: nowrap; overflow: hidden; } .k { font-size: 20px; color: #6b7672; white-space: nowrap; overflow: hidden; }
  footer { text-align: center; margin-top: 14px; font-size: 22px; color: #8C9490; }
  </style>
  <header><h1>萌戰三國・直播亂鬥</h1><div class="sub">全武將名冊（共 ${heroes.length} 位）</div><div class="how">在直播間留言武將名字，就能上場！</div></header>
  ${keys.map(row).join('')}
  <footer>送禮可以攻擊、放技能、回血　｜　留言「@對方名字」鎖定目標　｜　想換武將？直接留言新的武將名字　｜　想下場？留言「烙跑」</footer>`;
}

// 全武將清單：只有陣營、武將名稱、技能名稱（沒有武將圖），一個陣營一欄
function pageList() {
  const COLS = 5;
  const keys = Object.keys(factions).filter(k => heroes.some(h => h.faction === k));
  const sec = key => {
    const f = factions[key], list = heroes.filter(h => h.faction === key);
    const rows = Math.ceil(list.length / COLS);
    return `<section style="--c:${f.color};flex:${rows} 1 0"><div class="hd"><span class="seal">${f.label}</span><span class="cnt">${list.length} 位</span></div>
      <div class="grid" style="grid-template-rows:repeat(${rows},1fr)">${list.map(h => `<div class="it"><div class="nm${h.displayName.length > 4 ? ' long' : ''}">${h.displayName}</div><div class="sk">${h.skillName}</div></div>`).join('')}</div></section>`;
  };
  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1080px; height: 1920px; }
  body { background: #F7F1E3; color: #3E4A46; padding: 40px 30px 30px; display: flex; flex-direction: column; gap: 12px;
    font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif; }
  header { text-align: center; }
  header h1 { font-size: 56px; letter-spacing: 4px; color: #B23F2B; display: inline; }
  header .sub { font-size: 30px; letter-spacing: 2px; margin-left: 14px; }
  header .how { display: block; margin: 10px auto 0; width: max-content; padding: 6px 26px; border-radius: 999px; background: #D9563E; color: #fff; font-size: 28px; font-weight: bold; }
  section { display: flex; flex-direction: column; background: #fff; border: 4px solid var(--c); border-radius: 18px; padding: 8px 12px 6px; min-height: 0; }
  .hd { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; border-bottom: 3px solid var(--c); }
  .seal { display: inline-flex; width: 52px; height: 52px; align-items: center; justify-content: center; border-radius: 12px; background: var(--c); color: #fff; font-size: 34px; font-weight: bold; }
  .cnt { font-size: 26px; color: var(--c); font-weight: bold; }
  .grid { flex: 1; display: grid; grid-template-columns: repeat(${COLS}, 1fr); }
  .it { display: flex; flex-direction: column; justify-content: center; align-items: center; border-bottom: 1px dashed #E3D9BE; }
  .nm.long { font-size: 34px; }
  .nm { font-size: 42px; font-weight: bold; white-space: nowrap; line-height: 1.15; }
  .sk { font-size: 22px; color: var(--c); font-weight: bold; white-space: nowrap; }
  footer { text-align: center; font-size: 22px; color: #8C9490; }
  </style>
  <header><h1>萌戰三國・直播亂鬥</h1><span class="sub">全武將清單（共 ${heroes.length} 位）</span><span class="how">在直播間留言武將名字，就能上場！</span></header>
  ${keys.map(sec).join('')}
  <footer>大字是武將名字（留言它就能上場），小字是技能名稱</footer>`;
}

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 1.5 });
  const all = Object.keys(factions).filter(k => heroes.some(h => h.faction === k));   // 沒有武將的陣營（BOSS）不做名冊
  const jobs = [[all, `全武將名冊（共 ${heroes.length} 位）`, '全武將名冊.jpg'],
    ...all.map(k => [[k], `${factions[k].label}國武將`.replace('群國', '群雄'), `武將名冊_${factions[k].label}.jpg`])];
  for (const [keys, title, file] of jobs) {
    await tab.setContent(file === '全武將名冊.jpg' ? pageAll() : page(keys, title));
    await tab.screenshot({ path: path.join(root, 'roster', file), fullPage: true, type: 'jpeg', quality: 92 });
    console.log('已產生 roster/' + file);
  }
  const tab2 = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await tab2.setContent(pageList());
  await tab2.screenshot({ path: path.join(root, 'roster', '全武將清單.jpg'), type: 'jpeg', quality: 92 });
  console.log('已產生 roster/全武將清單.jpg');
  await browser.close();
})();
