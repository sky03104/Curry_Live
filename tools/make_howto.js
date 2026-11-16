// 產生「玩法說明」圖片（發給觀眾看怎麼玩；版面是給 TikTok 圖文貼文用的）。
// 用法：node tools/make_howto.js [--attack 玫瑰] [--aoe 煙火] [--skill 皇冠] [--heal 愛心] [--boss1 …] [--boss2 …] [--boss3 …]
//   後面的禮物名稱是「主播自己指定的禮物」，沒給就寫「主播公布」（招換 BOSS 沒給就寫預設鑽石數）。想換說明文字就改下面各張的內容。
// 需要 Playwright。輸出：roster/玩法說明_1.jpg … _13.jpg（前 8 張是玩法（第 5 張陣營模式、第 6 張賽跑模式、第 7 張障礙賽、第 8 張障礙賽 10 種賽道），後面蜀魏吳群萌各一張陣營武將圖，附武將名稱和技能名），每張 1080x1920（9:16），照順序當 TikTok 圖文貼文的輪播圖（滑著看）。
// 版面為 TikTok 留的安全區：上面 130px、下面 300px（標題文字和按鈕會蓋住）、右邊 110px（愛心、留言按鈕）不放重要內容。
// 數字（60 秒復活、99 級、BOSS 鑽石數）請對照 js/config.js；改了設定要回頭改這裡。風格跟武將名冊一致（米白宣紙底）。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
global.window = {};   // 讀武將資料與陣營設定（跟 make_roster.js 一樣）
require(path.join(root, 'data/heroes.js'));
require(path.join(root, 'data/extra-heroes.js'));
require(path.join(root, 'js/config.js'));
global.ML = {};   // 賽道形狀（js/race-tracks.js）只用來取形狀，不畫圖
require(path.join(root, 'js/race-tracks.js'));
const heroData = window.HEROES_DATA, factions = window.GAME_CONFIG.factions;
const FACTION_ORDER = ['Shu', 'Wei', 'Wu', 'Qun', 'Meng'];   // 蜀魏吳群萌（有武將的才做）
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const gift = k => args[k] || '主播公布';
const bossGift = (k, def) => args[k] || def;
const brand = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/brand/curry_ai_studio.png')).toString('base64');
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/heroes', f)).toString('base64');
const hero = (f, name, c) => `<div class="h"><img src="${img(f)}"><span style="background:${c}">${name}</span></div>`;
const TOTAL = 8 + FACTION_ORDER.filter(k => heroData.some(h => h.faction === k)).length;   // 8 張玩法（含陣營模式、賽跑模式、障礙賽、障礙賽賽道）+ 每個陣營一張

// 10 種賽道的小圖：直接用遊戲裡的形狀與路面顏色畫成 SVG，賽道改了重跑就會跟著更新
const trackChips = (list) => (list || window.GAME_CONFIG.race.tracks || []).map(t => {
  const T = ML.buildRaceTrack(t.id, 0, 0, 1, 1, 0.2, 0.02, 4), P = T.pts, d = P.map((q, i) => (i ? 'L' : 'M') + (50 + q.x * 42).toFixed(1) + ' ' + (32 + q.y * 24).toFixed(1)).join('') + 'Z';
  const col = T.theme.surface.replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, 'rgb($1,$2,$3)'), inf = T.theme.infield.replace(/rgba\((\d+),(\d+),(\d+),[^)]+\)/, 'rgb($1,$2,$3)');
  return `<div class="tc"><svg viewBox="0 0 100 64"><path d="${d}" fill="${inf}" stroke="#fff" stroke-width="13" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="9" stroke-linejoin="round"/></svg><span>${t.name}</span></div>`;
}).join('');
const css = `
* { box-sizing: border-box; margin: 0; }
body { background: #888; font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif; color: #3E4A46; }
.slide { width: 1080px; height: 1920px; background: #F7F1E3; position: relative; overflow: hidden; padding: 130px 110px 300px 60px; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; }
.top .t { font-size: 44px; font-weight: 900; color: #3E4A46; } .top .t b { color: #D9563E; }
.top .pg { font-size: 30px; font-weight: 900; color: #fff; background: #3E4A46; border-radius: 30px; padding: 4px 22px; }
.body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
.card { background: #F2ECDA; border: 4px solid #E3D9BE; border-radius: 30px; padding: 34px 36px 34px 140px; position: relative; }
.card .no { position: absolute; left: 30px; top: 32px; width: 86px; height: 86px; border-radius: 50%; background: #D9563E; color: #fff;
  font-size: 50px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 #B23F2B; }
.card h2 { font-size: 62px; font-weight: 900; margin-bottom: 14px; line-height: 1.2; }
.card p { font-size: 46px; line-height: 1.55; }
.say { display: inline-block; background: #fff; border: 3px solid #D9563E; line-height: 1.35; color: #B23F2B; font-weight: 900; border-radius: 14px; padding: 0 14px; margin: 2px 4px; }
.heroes2 { display: flex; gap: 10px; margin-top: 16px; justify-content: space-between; }
.h { text-align: center; } .h img { height: 210px; display: block; margin: 0 auto; }
.h span { display: inline-block; color: #fff; font-size: 32px; font-weight: 700; border-radius: 10px; padding: 1px 12px; margin-top: 4px; }
.acts { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
.act { background: #fff; border-radius: 22px; padding: 20px 26px; border-left: 14px solid var(--c); display: flex; align-items: center; gap: 18px; }
.act b { font-size: 54px; color: var(--c); min-width: 250px; } .act .d { font-size: 36px; color: #5b665f; flex: 1; }
.act .g { font-size: 38px; background: #3E4A46; color: #ffd35c; font-weight: 900; border-radius: 12px; padding: 4px 16px; }
.note { font-size: 34px; color: #8C9490; margin-top: 12px; }
.big { font-size: 56px; line-height: 1.6; }
.boss { display: flex; gap: 14px; margin-top: 18px; }
.boss .b { flex: 1; text-align: center; background: #2a1650; color: #fff; border-radius: 20px; padding: 12px 6px 16px; }
.boss .b { min-width: 0; } .boss .b img { width: 100%; height: 230px; object-fit: contain; display: block; margin: 0 auto; }
.boss .b strong { display: block; font-size: 40px; margin-top: 6px; } .boss .b em { font-style: normal; color: #ffd35c; font-size: 40px; font-weight: 900; }
.buffs { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; }
.buff { border-radius: 22px; padding: 22px 30px; font-size: 42px; color: #fff; line-height: 1.45; } .buff b { font-size: 48px; }
.cover { background: linear-gradient(170deg,#2b3a42,#3E4A46 60%,#2b3a42); color: #fff; padding: 130px 110px 520px 60px; text-align: center; justify-content: center; }
.cover h1 { font-size: 100px; font-weight: 900; letter-spacing: 6px; line-height: 1.2; } .cover h1 b { color: #ffd35c; display: block; }
.cover .sub { font-size: 44px; color: #e8dcc0; margin-top: 18px; }
.cover .row { display: flex; justify-content: center; margin: 46px 0 30px; } .cover .row img { height: 330px; margin: 0 -26px; filter: drop-shadow(0 8px 10px rgba(0,0,0,.4)); }
.steps { display: flex; flex-direction: column; gap: 16px; margin-top: 10px; text-align: left; }
.steps div { background: rgba(255,255,255,.1); border: 3px solid rgba(255,255,255,.25); border-radius: 22px; padding: 16px 26px; font-size: 44px; font-weight: 700; }
.steps i { font-style: normal; display: inline-block; width: 60px; height: 60px; line-height: 60px; text-align: center; border-radius: 50%; background: #D9563E; margin-right: 16px; font-weight: 900; }
.fac-head { display: flex; align-items: center; gap: 22px; margin-bottom: 18px; }
.fac-head .seal { width: 120px; height: 120px; border-radius: 26px; background: var(--c); color: #fff; font-size: 84px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 0 rgba(0,0,0,.2); }
.fac-head .tt { font-size: 66px; font-weight: 900; color: var(--c); line-height: 1.1; } .fac-head .tt small { display: block; font-size: 36px; color: #8C9490; font-weight: 700; margin-top: 6px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.hc { background: #F2ECDA; border: 4px solid var(--c); border-radius: 24px; text-align: center; padding: 12px 6px 14px; min-width: 0; }
.hc .pic { display: flex; align-items: center; justify-content: center; } .hc img { max-width: 100%; object-fit: contain; }
.hc .nm { font-size: 44px; font-weight: 900; margin-top: 4px; line-height: 1.15; }
.hc .sk { font-size: 30px; color: #fff; background: var(--c); border-radius: 12px; display: inline-block; padding: 2px 14px; margin-top: 6px; font-weight: 700; }
.camp { display: flex; gap: 8px; margin-top: 20px; } .camp div { flex: 1; color: #fff; font-weight: 900; font-size: 34px; line-height: 1.25; text-align: center; border-radius: 14px; padding: 22px 4px; }
.track { position: relative; height: 330px; margin-top: 18px; background: #fff; border-radius: 26px; border: 4px solid #E3D9BE; overflow: hidden; }
.track .oval { position: absolute; left: 70px; right: 70px; top: 36px; bottom: 36px; border-radius: 50%; border: 22px solid #c9b48a; background: #8fc07a; }
.track .st { position: absolute; left: 50%; bottom: 22px; width: 8px; height: 50px; background: #D9563E; margin-left: -4px; border-radius: 4px; }
.track img { position: absolute; height: 120px; }
.race3 { display: flex; gap: 14px; margin-top: 16px; } .race3 div { flex: 1; border-radius: 18px; padding: 16px 10px; text-align: center; color: #fff; font-size: 38px; font-weight: 900; line-height: 1.35; } .race3 small { display: block; font-size: 30px; font-weight: 700; opacity: .95; }
.tracks10 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 18px; } .tc { background: #fff; border-radius: 16px; padding: 8px 4px 6px; text-align: center; min-width: 0; } .tc svg { width: 100%; height: auto; display: block; } .tc span { display: block; font-size: 23px; font-weight: 700; line-height: 1.2; }
.gates { display: flex; gap: 10px; margin-top: 18px; } .gt { flex: 1; background: #fff; border-radius: 16px; padding: 10px 4px 8px; text-align: center; min-width: 0; } .gt i { display: block; font-style: normal; font-size: 64px; line-height: 1.1; } .gt b { display: block; font-size: 30px; } .gt span { display: block; font-size: 30px; font-weight: 900; color: #D9563E; }
.brand { display: flex; align-items: center; justify-content: center; gap: 22px; position: absolute; left: 60px; right: 110px; bottom: 310px; }
.brand img { width: 190px; height: 190px; border-radius: 50%; border: 5px solid #ffd35c; background: #F7F1E3; }
.brand span { font-size: 44px; font-weight: 900; color: #fff; letter-spacing: 3px; } .brand small { display: block; font-size: 28px; font-weight: 700; color: #e8dcc0; letter-spacing: 1px; margin-top: 4px; }
.swipe { margin-top: 30px; font-size: 38px; color: #ffd35c; font-weight: 900; }
`;
const top = n => `<div class="top"><div class="t">萌戰三國・<b>直播亂鬥</b></div><div class="pg">${n}/${TOTAL}</div></div>`;

const slides = [
`<div class="slide cover">
  <h1>萌戰三國<b>直播亂鬥</b></h1>
  <div class="sub">留言選武將、送禮打架　30 秒看懂玩法</div>
  <div class="row"><img src="${img('lvbu.png')}"><img src="${img('guanyu.png')}"><img src="${img('diaochan.png')}"><img src="${img('michelin.png')}"></div>
  <div class="steps"><div><i>1</i>留言武將名字　上場！</div><div><i>2</i>送禮物　你的武將出手</div><div><i>3</i>一起打倒大 BOSS</div></div>
  <div class="swipe">往左滑　看玩法＋全部武將 ➜</div>
  <div class="brand"><img src="${brand}"></div></div>`,

`<div class="slide">${top(2)}<div class="body">
  <div class="card"><div class="no">1</div><h2>留言選武將上場</h2>
    <p>留言武將的名字，例如 <span class="say">呂布</span><span class="say">關羽</span><span class="say">貂蟬</span><span class="say">米其林</span>，就會<b>帶著你的名字</b>上場！上場後再留言別的武將名，就能<b>換武將</b>。</p>
    <div class="heroes2">${hero('lvbu.png', '呂布', '#A5527E')}${hero('guanyu.png', '關羽', '#5C9C89')}${hero('diaochan.png', '貂蟬', '#A5527E')}${hero('michelin.png', '米其林', '#E0709A')}</div></div>
  <div class="card"><div class="no">2</div><h2>送禮物　武將出手</h2>
    <div class="acts">
      <div class="act" style="--c:#D9563E"><b>普攻</b><span class="d">打一個人</span><span class="g">${gift('attack')}</span></div>
      <div class="act" style="--c:#C0872E"><b>全場攻擊</b><span class="d">打全部人</span><span class="g">${gift('aoe')}</span></div>
      <div class="act" style="--c:#4A7FA5"><b>技能</b><span class="d">超痛的大招</span><span class="g">${gift('skill')}</span></div>
      <div class="act" style="--c:#5C9C89"><b>回血</b><span class="d">補自己的血</span><span class="g">${gift('heal')}</span></div>
    </div>
    <div class="note">※ 禮物以主播公布的為準。沒上場就送禮，會自動帶一隻武將上場。</div></div>
</div></div>`,

`<div class="slide">${top(3)}<div class="body">
  <div class="card"><div class="no">3</div><h2>鎖定對手　專打他</h2>
    <p>留言 <span class="say">@對方名字</span> 就專打他，也可以 <span class="say">@呂布</span>。想恢復隨機，留言 <span class="say">解除鎖定</span>。先 @ 某人再送回血禮物，就是<b>幫他補血</b>！</p></div>
  <div class="card"><div class="no">4</div><h2>倒地了怎麼辦</h2>
    <p>血量歸零就倒地，<b>等 60 秒</b>後再送任何禮物就<b>滿血復活</b>。想先溜？留言 <span class="say">烙跑</span> 就下場，等級不會不見。</p></div>
  <div class="card"><div class="no">5</div><h2>打倒別人會升級</h2>
    <p>擊倒對手拿經驗值，<b>最高 99 級</b>，血量、攻擊、防禦都變強。<b>等級會存檔</b>，下次開播還在！</p></div>
</div></div>`,

`<div class="slide">${top(4)}<div class="body">
  <div class="card" style="background:#EFE6F7;border-color:#d8c4ee"><div class="no" style="background:#7a3fc0;box-shadow:0 4px 0 #5a2a94">6</div><h2>招換 BOSS　一起打！</h2>
    <p>送「招換禮物」叫出大 BOSS，<b>不用先上場</b>。大家一起打倒它，所有打過的人<b>平分經驗值</b>，最後一擊<b>額外有獎勵</b>！</p>
    <div class="boss">
      <div class="b"><img src="${img('boss_dragon.png')}"><strong>深淵魔龍</strong><em>${bossGift('boss1', '500 鑽')}</em></div>
      <div class="b"><img src="${img('boss_caesar.png')}"><strong>深淵凱薩</strong><em>${bossGift('boss2', '1000 鑽')}</em></div>
      <div class="b"><img src="${img('boss_ape.png')}"><strong>太古巨猿</strong><em>${bossGift('boss3', '1500 鑽')}</em></div>
    </div>
    <div class="buffs">
      <div class="buff" style="background:#2f7fb8"><b>藍BUFF（小 BOSS）</b><br>擊殺的人 1 小時內<b>每秒回 10 血</b></div>
      <div class="buff" style="background:#c8432f"><b>紅BUFF（小 BOSS）</b><br>擊殺的人 1 小時內<b>攻擊力加倍</b></div>
    </div></div>
  <div class="big" style="text-align:center;font-weight:900;color:#D9563E">快來直播間一起玩！</div>
</div></div>`,

`<div class="slide">${top(5)}<div class="body">
  <div class="card" style="background:#FDEBE8;border-color:#f3c4bd"><div class="no" style="background:#c8432f;box-shadow:0 4px 0 #8f2f20">7</div><h2>陣營大戰　紅隊 VS 藍隊</h2>
    <p>主播開啟陣營模式時，留言 <span class="say">加入紅隊</span> 或 <span class="say">加入藍隊</span> 選邊站！<b>每場最多換 3 次隊</b>。</p>
    <div class="camp">
      <div style="background:#c8432f">紅<br>主堡</div><div style="background:#e2756a">紅隊<br>武將</div><div style="background:#7d8590">紅塔</div><div style="background:#7d8590">藍塔</div><div style="background:#5a9ce0">藍隊<br>武將</div><div style="background:#2f6fb8">藍<br>主堡</div>
    </div></div>
  <div class="card"><div class="no">8</div><h2>怎麼贏</h2>
    <p>只能打<b>敵方</b>，不能打自己人。先<b>拆掉敵方防禦塔</b>，再把<b>敵方武將全部打倒</b>，才能<b>攻破主堡</b>！<span class="say">@塔</span><span class="say">@主堡</span> 可以鎖定。</p></div>
  <div class="card"><div class="no">9</div><h2>獎勵</h2>
    <p>贏的那隊<b>所有玩家</b>都拿<b>大量經驗值</b>！陣營模式倒地的<b>復活等待會越來越久</b>（60→90→120→180 秒）。</p></div>
</div></div>`,
`<div class="slide">${top(6)}<div class="body">
  <div class="card" style="background:#E9F5E4;border-color:#bfe0b4"><div class="no" style="background:#4a9a3c;box-shadow:0 4px 0 #2f6f26">10</div><h2>賽跑模式　萌國大賽跑</h2>
    <p>主播開放報名時，留言 <span class="say">我要參賽</span> 就能上場！<b>只有萌國武將能參賽</b>，最多 8 位。<b>10 種賽道，每場隨機一種</b>！</p>
    <div class="tracks10">${trackChips()}</div></div>
  <div class="card"><div class="no">11</div><h2>跑完一圈拿經驗</h2>
    <p>每跑一段<b>可能停下來休息</b>！只有<b>前三名</b>拿經驗值：<b>2000／1000／500</b>。</p></div>
  <div class="card"><div class="no">12</div><h2>送禮幫忙或搗蛋</h2>
    <p>送 <span class="say">玫瑰</span> 讓人<b>少休息</b>，送 <span class="say">GG</span> 讓人<b>多休息</b>。參賽者只能幫自己；沒參賽的要先留言 <span class="say">@參賽者名字</span> 再送禮。</p></div>
</div></div>`,


`<div class="slide">${top(7)}<div class="body">
  <div class="card" style="background:#FFF1DC;border-color:#f0cf9a"><div class="no" style="background:#e08a1e;box-shadow:0 4px 0 #a8620f">13</div><h2>障礙賽　闖 5 道關卡</h2>
    <p>主播開放障礙賽時，留言 <span class="say">我要參賽</span> 報名。跑道上有 <b>5 道關卡</b>，每道<b>機率過關</b>，越後面越難！</p>
    <div class="gates">${(window.GAME_CONFIG.race.hurdle.obstacles || []).map((o, i) => `<div class="gt"><i>${o.icon}</i><b>第${i + 1}關</b><span>${Math.round(window.GAME_CONFIG.race.hurdle.passChances[i] * 100)}%</span></div>`).join('')}</div></div>
  <div class="card"><div class="no">14</div><h2>沒過關會怎樣</h2>
    <p>在關卡前<b>摔倒停 2～3 秒</b>再繼續跑，<b>不會淘汰</b>、也不會退回，大家都能跑完。看<b>誰摔得最少、跑得最快</b>！</p></div>
  <div class="card"><div class="no">15</div><h2>送禮幫忙或搗蛋</h2>
    <p>送 <span class="say">玫瑰</span> 讓人<b>更容易過關</b>，送 <span class="say">GG</span> 讓人<b>更容易摔倒</b>。前三名拿經驗值，賽道有 <b>10 種專屬障礙賽道</b>，每場隨機！</p></div>
</div></div>`,

`<div class="slide">${top(8)}<div class="body">
  <div class="card" style="background:#FFF1DC;border-color:#f0cf9a"><div class="no" style="background:#e08a1e;box-shadow:0 4px 0 #a8620f">16</div><h2>障礙賽　10 種專屬賽道</h2>
    <p>障礙賽有<b>自己的 10 種賽道</b>，<b>每場隨機一種</b>，不會連續兩場一樣！</p>
    <div class="tracks10">${trackChips(window.GAME_CONFIG.race.hurdleTracks)}</div></div>
  <div class="card"><div class="no">17</div><h2>每條賽道都有 5 道關卡</h2>
    <p>跑道上的 <b>🚧 🪨 🌊 🔥 🧱</b> 就是關卡，每道都標著<b>過關率</b>。叢林、峽谷、雪山、古堡、糖果、太空、火山、水道、梯田、馬戲團，<b>看你抽到哪條</b>！</p></div>
  <div class="card"><div class="no">18</div><h2>送 199 鑽開障礙賽</h2>
    <p>送<b>剛好 199 鑽</b>的禮物（亂鬥時），會<b>隨機開放賽跑或障礙賽</b>！報名開始後留言 <span class="say">我要參賽</span>。</p></div>
</div></div>`,
];

// 陣營武將頁：每個武將一格（圖＋名字＋技能名）。每格大小依這個陣營的人數算，11 人也塞得進安全區
const AVAIL_H = 1920 - 130 - 300 - 90 - 140;   // 扣掉上面標題列、陣營標題之後，格子可用的高度
for (const key of FACTION_ORDER) {
  const f = factions[key], list = heroData.filter(h => h.faction === key);
  if (!list.length) continue;
  const rows = Math.ceil(list.length / 3), perRow = Math.min(rows === 1 ? 520 : 430, (AVAIL_H - (key === 'Meng' ? 360 : 0) - (rows - 1) * 14) / rows), imgH = Math.round(perRow - 118);
  slides.push(`<div class="slide" style="--c:${f.color}">${top(slides.length + 1)}<div class="body" style="justify-content:flex-start">
    <div class="fac-head"><div class="seal">${f.label}</div><div class="tt">${f.label + (key === 'Meng' ? '國' : '')}武將<small>${list.length} 位武將　留言名字就能選</small></div></div>
    <div class="grid3">${list.map(h => `<div class="hc"><div class="pic"><img src="${img(h.heroId + '.png')}" style="height:${imgH}px"></div><div class="nm">${h.displayName}</div><div class="sk">${h.skillName}</div></div>`).join('')}</div>
    ${key === 'Meng' ? `<div class="card" style="margin-top:24px;padding-left:36px;text-align:center;background:#FBE9F0;border-color:#F3C4D6"><p style="font-size:46px;line-height:1.5"><b>直播亂鬥專屬的萌國角色</b><br>其他地方看不到，<br>留言名字就能選！<br>${heroData.filter(h => h.faction === 'Meng').map(h => `<span class="say">${h.displayName}</span>`).join('')}</p></div>` : ''}
  </div></div>`);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const f of fs.readdirSync(path.join(root, 'roster'))) if (/^玩法說明.*\.jpg$/.test(f)) fs.unlinkSync(path.join(root, 'roster', f));   // 清掉舊版
  for (let i = 0; i < slides.length; i++) {
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${slides[i]}`); await p.waitForTimeout(400);
    const overflow = await p.evaluate(() => { const s = document.querySelector('.slide'), body = document.querySelector('.body'); return body ? body.scrollHeight - body.clientHeight : 0; });
    const out = path.join(root, 'roster', `玩法說明_${i + 1}.jpg`);
    await p.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log('已輸出', out, fs.statSync(out).size + ' bytes', overflow > 0 ? `⚠ 內容超出 ${overflow}px（會被擠到安全區外）` : '');
  }
  await b.close();
})();
