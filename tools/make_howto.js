// 產生「玩法說明」圖片（發給觀眾看怎麼玩）。
// 用法：node tools/make_howto.js [--attack 玫瑰] [--aoe 煙火] [--skill 皇冠] [--heal 愛心] [--boss1 …] [--boss2 …] [--boss3 …] [--buff …]
//   後面的禮物名稱是「主播自己指定的禮物」，沒給就寫「主播公布」。想換說明文字就改下面的 steps。
// 需要 Playwright。輸出：roster/玩法說明.jpg（寬 1080，高度依內容）。風格跟武將名冊一致（米白宣紙底）。
// 數字（60 秒復活、99 級、BOSS 鑽石數）請對照 js/config.js；改了設定要回頭改這裡。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const gift = k => args[k] || '主播公布';
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/heroes', f)).toString('base64');
const hero = (f, name, c) => `<div class="h"><img src="${img(f)}"><span style="background:${c}">${name}</span></div>`;

const html = `<!doctype html><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; }
body { width: 1080px; background: #F7F1E3; color: #3E4A46; padding: 0 0 40px;
  font-family: "Noto Sans TC","Microsoft JhengHei","PingFang TC","WenQuanYi Zen Hei",sans-serif; }
header { background: linear-gradient(135deg,#2b3a42,#3E4A46); color: #fff; padding: 46px 52px 44px; min-height: 180px; position: relative; overflow: hidden; }
header h1 { font-size: 54px; letter-spacing: 3px; font-weight: 900; white-space: nowrap; }
header h1 b { color: #ffd35c; }
header p { font-size: 28px; margin-top: 10px; color: #e8dcc0; }
header .heroes { position: absolute; right: 30px; bottom: 0; display: flex; gap: 0; }
header .heroes img { height: 150px; margin-left: -30px; filter: drop-shadow(0 4px 6px rgba(0,0,0,.35)); }
.wrap { padding: 28px 40px 0; display: flex; flex-direction: column; gap: 22px; }
.card { background: #F2ECDA; border: 3px solid #E3D9BE; border-radius: 22px; padding: 26px 30px 26px 112px; position: relative; }
.card .no { position: absolute; left: 26px; top: 24px; width: 66px; height: 66px; border-radius: 50%; background: #D9563E; color: #fff;
  font-size: 38px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 0 #B23F2B; }
.card h2 { font-size: 40px; font-weight: 900; margin-bottom: 8px; }
.card p { font-size: 30px; line-height: 1.55; }
.say { display: inline-block; background: #fff; border: 2.5px solid #D9563E; color: #B23F2B; font-weight: 900; border-radius: 12px; padding: 0 12px; margin: 0 4px; }
.heroes2 { display: flex; gap: 14px; margin-top: 12px; }
.h { text-align: center; } .h img { height: 150px; display: block; margin: 0 auto; }
.h span { display: inline-block; color: #fff; font-size: 24px; font-weight: 700; border-radius: 10px; padding: 1px 12px; margin-top: 2px; }
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.act { background: #fff; border-radius: 16px; padding: 12px 18px; border-left: 10px solid var(--c); }
.act b { font-size: 34px; color: var(--c); } .act .g { float: right; font-size: 28px; background: #3E4A46; color: #ffd35c; font-weight: 900; border-radius: 10px; padding: 0 12px; margin-top: 2px; }
.act div { font-size: 26px; margin-top: 4px; clear: both; color: #5b665f; }
.boss { display: flex; gap: 12px; margin-top: 12px; align-items: flex-end; }
.boss .b { flex: 1; text-align: center; background: #2a1650; color: #fff; border-radius: 16px; padding: 8px 6px 12px; }
.boss .b img { height: 130px; display: block; margin: 0 auto; }
.boss .b strong { display: block; font-size: 28px; margin-top: 2px; } .boss .b em { font-style: normal; color: #ffd35c; font-size: 26px; font-weight: 900; }
.buffs { display: flex; gap: 12px; margin-top: 12px; }
.buff { flex: 1; border-radius: 16px; padding: 12px 18px; font-size: 27px; color: #fff; line-height: 1.45; }
.buff b { font-size: 31px; }
footer { text-align: center; margin-top: 26px; font-size: 26px; color: #8C9490; }
</style>
<header>
  <h1>萌戰三國・<b>直播亂鬥</b></h1><p>留言選武將、送禮打架　30 秒看懂玩法</p>
  <div class="heroes"><img src="${img('lvbu.png')}"><img src="${img('guanyu.png')}"><img src="${img('diaochan.png')}"><img src="${img('michelin.png')}"></div>
</header>
<div class="wrap">
  <div class="card"><div class="no">1</div><h2>留言選武將上場</h2>
    <p>在聊天室留言武將的名字，例如 <span class="say">呂布</span><span class="say">關羽</span><span class="say">貂蟬</span><span class="say">米其林</span>，你的武將就會<b>帶著你的名字</b>上場！已經上場後再留言別的武將名，就能<b>換武將</b>。</p>
    <div class="heroes2">${hero('lvbu.png', '呂布', '#A5527E')}${hero('guanyu.png', '關羽', '#5C9C89')}${hero('diaochan.png', '貂蟬', '#A5527E')}${hero('zhugeliang.png', '諸葛亮', '#5C9C89')}${hero('michelin.png', '米其林', '#E0709A')}${hero('dabao.png', '大寶', '#E0709A')}</div></div>

  <div class="card"><div class="no">2</div><h2>送禮物，你的武將就出手</h2>
    <p>不同的禮物，有不同的招式：</p>
    <div class="acts">
      <div class="act" style="--c:#D9563E"><span class="g">${gift('attack')}</span><b>普攻</b><div>打一個人</div></div>
      <div class="act" style="--c:#C0872E"><span class="g">${gift('aoe')}</span><b>全場攻擊</b><div>場上所有人都挨打</div></div>
      <div class="act" style="--c:#4A7FA5"><span class="g">${gift('skill')}</span><b>技能</b><div>超痛的大招</div></div>
      <div class="act" style="--c:#5C9C89"><span class="g">${gift('heal')}</span><b>回血</b><div>補自己的血</div></div>
    </div>
    <p style="font-size:25px;color:#8C9490;margin-top:8px">※ 禮物名稱以主播公布的為準。還沒上場就送禮，會自動帶一隻武將上場。</p></div>

  <div class="card"><div class="no">3</div><h2>鎖定對手　專打他！</h2>
    <p>留言 <span class="say">@對方名字</span> 就專打他（也可以 @武將名，例如 <span class="say">@呂布</span>）。想恢復隨機，留言 <span class="say">解除鎖定</span>。先 @ 某人再送回血禮物，就是<b>幫他補血</b>！</p></div>

  <div class="card"><div class="no">4</div><h2>倒地了怎麼辦？</h2>
    <p>血量歸零就倒地。<b>等 60 秒</b>後，再送任何禮物就能<b>滿血復活</b>。想先溜？留言 <span class="say">烙跑</span> 就下場，等級不會不見，想回來再留言武將名（要等 60 秒）。</p></div>

  <div class="card"><div class="no">5</div><h2>打倒別人會升級！</h2>
    <p>擊倒對手拿經驗值，滿了就升級，<b>最高 99 級</b>，血量、攻擊、防禦都會變強。<b>等級會存檔</b>，下次開播還在！</p></div>

  <div class="card" style="background:#EFE6F7;border-color:#d8c4ee"><div class="no" style="background:#7a3fc0;box-shadow:0 3px 0 #5a2a94">6</div><h2>招換 BOSS　大家一起打！</h2>
    <p>送「招換禮物」就能叫出大 BOSS，<b>不用先上場</b>。BOSS 會定時攻擊大家，一起打倒它，所有打過的人<b>平分經驗值</b>，最後一擊的人<b>額外有獎勵</b>！</p>
    <div class="boss">
      <div class="b"><img src="${img('boss_dragon.png')}"><strong>深淵魔龍</strong><em>${gift('boss1') === '主播公布' ? '500 鑽' : gift('boss1')}</em></div>
      <div class="b"><img src="${img('boss_caesar.png')}"><strong>深淵凱薩</strong><em>${gift('boss2') === '主播公布' ? '1000 鑽' : gift('boss2')}</em></div>
      <div class="b"><img src="${img('boss_ape.png')}"><strong>太古巨猿</strong><em>${gift('boss3') === '主播公布' ? '1500 鑽' : gift('boss3')}</em></div>
    </div>
    <div class="buffs">
      <div class="buff" style="background:#2f7fb8"><b>藍BUFF（小 BOSS）</b><br>擊殺的人，<b>1 小時內每秒回 10 血</b></div>
      <div class="buff" style="background:#c8432f"><b>紅BUFF（小 BOSS）</b><br>擊殺的人，<b>1 小時內攻擊力加倍</b></div>
    </div></div>
</div>
<footer>萌戰三國・直播亂鬥　｜　武將名冊請看另一張圖</footer>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 1 });
  await p.setContent(html); await p.waitForTimeout(600);
  const out = path.join(root, 'roster', '玩法說明.jpg');
  await p.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 92 });
  console.log('已輸出', out, fs.statSync(out).size + ' bytes'); await b.close();
})();
