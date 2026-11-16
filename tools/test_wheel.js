// 轉輪模式規則的自動測試（不開瀏覽器，直接跑 js/game.js）：node tools/test_wheel.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { window: {}, console, Math, Date };
sandbox.window = sandbox; vm.createContext(sandbox);
for (const f of ['js/config.js', 'data/heroes.js', 'data/extra-heroes.js', 'js/game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const config = sandbox.GAME_CONFIG, heroes = sandbox.HEROES_DATA;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };

function setup(opts) {
  const game = sandbox.ML.createGame(config, heroes), notes = [], fxs = [];
  game.onFx(e => { if (e.type === 'notice') notes.push(e.text); else fxs.push(e); });
  if (opts && opts.noVoice) game.setWheelSettings({ voiceEnabled: false });
  const U = n => ({ id: 'tt:' + n, name: n });
  const chat = (n, t) => game.handleEvent({ type: 'chat', user: U(n), text: t });
  const tgift = (n, d, c) => { const g = { name: 'Rose', diamonds: d }; game.handleEvent({ type: 'tiktokGift', user: U(n), gift: g, count: c || 1 }); game.handleEvent({ type: 'gift', user: U(n), giftId: 'rose', count: c || 1, tiktokGift: g }); };   // 跟真的 TikTok 一樣：兩個事件
  const run = sec => { for (let i = 0; i < Math.round(sec * 10); i++) game.update(0.1); };
  const until = (ph, max) => { for (let i = 0; i < (max || 300) * 10; i++) { const w = game.getWheel(); if (w && w.phase === ph) return true; game.update(0.1); } return false; };
  return { game, notes, fxs, U, chat, tgift, run, until, join: (n, h) => chat(n, h || '劉備') };
}

// 1. 累積、零頭、排隊上限、TikTok 事件不重複算
{
  const t = setup(); const { game } = t; t.join('甲');
  t.tgift('甲', 600); ok(game.getWheelProgress('tt:甲').dia === 600 && game.getWheelPending() === 0, '600 鑽還沒滿');
  t.tgift('甲', 400); ok(game.getWheelPending() === 1 && game.getWheelProgress('tt:甲').dia === 0, '再 400 鑽滿 1000 → 排 1 次、累積歸零');
  t.run(0.5);
  const t2 = setup(); t2.join('乙'); t2.tgift('乙', 1500, 1); ok(t2.game.getWheelPending() + (t2.game.getWheel() ? 1 : 0) === 1 && t2.game.getWheelProgress('tt:乙').dia === 500, '1500 鑽 → 1 次、零頭 500 留著');
  const t3 = setup(); t3.join('丙'); t3.tgift('丙', 1000, 13); ok(t3.game.getWheelPending() === 10 && t3.notes.some(x => x.includes('排隊上限')), '一次送 13000 鑽只排 10 次（每人上限）');
  const t4 = setup(); t4.join('丁'); t4.game.handleEvent({ type: 'gift', user: t4.U('丁'), giftId: 'rose', count: 1000 }); ok(t4.game.getWheelPending() === 1, '面板測試禮物：玫瑰 ×1000 = 1000 鑽');
  const t5 = setup(); t5.join('戊'); t5.tgift('戊', 100, 3); ok(t5.game.getWheelProgress('tt:戊').dia === 300, '連送 ×3 的鑽石數相乘');
}
// 2. 轉輪流程：語音 → 開啟 → 準備 → 旋轉 → 結果 → 收起；結果停在指針上
{
  const t = setup(); const { game } = t; t.join('甲'); t.tgift('甲', 1000);
  ok(game.getWheel() === null, '還沒 tick 前轉輪不會憑空出現');
  t.run(0.1); const w0 = game.getWheel(); ok(w0 && w0.phase === 'voice', '先播語音（voice 階段）');
  ok(t.fxs.some(e => e.type === 'wheelVoice'), '送出語音事件');
  ok(t.until('open', 5) && t.until('ready', 5), '語音 → 開啟 → 準備');
  ok(game.getWheel().spinner.id === 'tt:甲' && t.fxs.some(e => e.type === 'wheelReady'), '輪到甲準備轉');
  ok(t.until('spin', 10), '準備完開始旋轉');
  ok(t.until('result', 12), '旋轉結束出結果');
  const R = game.getWheel(), n = R.items.length, slice = Math.PI * 2 / n;
  let off = (R.angle + (R.result + 0.5) * slice - Math.PI) % (Math.PI * 2); if (off > Math.PI) off -= Math.PI * 2; if (off < -Math.PI) off += Math.PI * 2;
  ok(Math.abs(off) <= slice / 2, `停下來時指針指到第 ${R.result} 格的範圍內（誤差 ${off.toFixed(2)}，格寬 ${slice.toFixed(2)}）`);
  ok(game.getWheelHistory()[0].text === R.resultText && game.getWheelHistory()[0].name === '甲', '結果記進紀錄');
  ok(t.until('closing', 12) || game.getWheel() === null, '沒人排隊且不是常駐 → 自動收起');
  t.run(1); ok(game.getWheel() === null && t.fxs.some(e => e.type === 'wheelClose'), '轉輪收起');
}
// 3. 不開語音就直接開；多人排隊依序轉；不在場上的人會帶預設武將
{
  const t = setup({ noVoice: true }); const { game } = t; t.join('甲'); t.tgift('甲', 1000); t.tgift('乙', 1000);
  t.run(0.1); ok(game.getWheel().phase === 'open', '語音關掉：直接開啟');
  ok(t.until('ready', 5) && game.getWheel().spinner.id === 'tt:甲', '甲先轉');
  ok(game.getWheel().pending === 1, '乙排在後面');
  t.until('result', 15); t.until('ready', 15); ok(game.getWheel().spinner.id === 'tt:乙', '甲轉完輪到乙');
  ok(game.getPlayers().some(p => p.id === 'tt:乙'), '乙本來不在場上 → 帶預設武將上場');
}
// 4. BOSS／單挑／賽跑時不開，結束後才開
{
  const t = setup({ noVoice: true }); const { game } = t; t.join('甲'); t.join('乙');
  game.handleEvent({ type: 'gift', user: t.U('甲'), giftId: 'boss1', count: 1 });
  t.tgift('甲', 1000); t.run(3);
  ok(game.getWheel() === null && game.getWheelPending() === 1, 'BOSS 在場：轉輪不開，次數排隊');
  game.clearBosses(); t.run(0.3); ok(game.getWheel() !== null, 'BOSS 走了 → 轉輪自動開');
  const t2 = setup({ noVoice: true }); t2.join('甲'); t2.join('乙'); t2.chat('甲', '@乙 單挑');
  t2.tgift('丙', 1000); t2.run(2); ok(t2.game.getWheel() === null, '單挑申請中轉輪不開');
  const t3 = setup({ noVoice: true }); t3.join('甲'); t3.join('乙'); t3.tgift('甲', 1000); t3.run(0.3);
  t3.chat('甲', '@乙 單挑'); ok(!t3.game.getDuelInvite() && t3.notes.some(x => x.includes('轉輪進行中')), '轉輪開著時不能發起單挑');
  const t4 = setup({ noVoice: true }); t4.join('甲'); t4.tgift('甲', 1000); t4.until('ready', 5); t4.game.setMode('team');
  ok(t4.game.getWheel() === null && t4.game.getWheelPending() === 1, '準備中被切模式打斷：收起、次數還給玩家');
  t4.game.setMode('brawl'); t4.run(0.5); ok(t4.game.getWheel() !== null, '回到亂鬥又自動繼續');
  const t5 = setup({ noVoice: true }); t5.join('甲'); t5.tgift('甲', 1000); t5.until('ready', 5); game.clearBosses();
  t5.game.handleEvent({ type: 'gift', user: t5.U('甲'), giftId: 'boss1', count: 1 }); t5.run(0.3);
  ok(t5.game.getWheel() === null && t5.game.getWheelPending() === 1, '轉輪準備中 BOSS 出現：先收起、次數還給玩家');
}
// 5. 主播開啟（常駐）／關閉／新的一場；玩家留言
{
  const t = setup({ noVoice: true }); const { game } = t;
  game.setHostMatcher(() => null, u => u.id === 'tt:主播');
  t.join('甲'); t.chat('甲', '轉輪模式'); ok(game.getWheel() === null && t.notes.some(x => x.includes('還差 1000 鑽')), '玩家留言「轉輪模式」沒累積 → 提示還差多少');
  t.chat('主播', '轉輪模式'); t.run(0.1); ok(game.getWheel() && game.getWheel().locked, '主播留言「轉輪模式」→ 常駐開啟');
  t.run(5); ok(game.getWheel().phase === 'wait', '沒人排隊時常駐轉輪等著');
  t.tgift('甲', 1000); t.run(0.3); ok(game.getWheel().phase === 'ready', '有人滿鑽 → 常駐轉輪接著轉');
  t.until('result', 20); t.until('wait', 20); ok(game.getWheel().phase === 'wait', '轉完又回到等待（不收起）');
  game.hostPress({ id: 'h', name: '主播' }, { wheel: 'close' }); t.run(1.5); ok(game.getWheel() === null, '主播按「關閉轉輪」→ 收起');
  t.tgift('甲', 1500); t.chat('甲', '轉輪模式'); ok(t.notes.some(x => x.includes('排隊中') || x.includes('馬上輪到')), '玩家留言查到自己排隊中');
  game.hostPress({ id: 'h', name: '主播' }, { wheel: 'reset' }); ok(game.getWheelPending() === 0 && game.getWheelProgress('tt:甲').dia === 0 && game.getWheelHistory().length === 0, '「新的一場」把累積、排隊、紀錄全部歸零');
}
// 6. 設定：項目、門檻、存取
{
  const t = setup({ noVoice: true }); const { game } = t;
  game.setWheelSettings({ items: ['紅', '綠', '', '藍'], threshold: 500 });
  ok(JSON.stringify(game.getWheelSettings().items) === '["紅","綠","藍"]' && game.getWheelSettings().threshold === 500, '空白項目被去掉、門檻可以改');
  game.setWheelSettings({ items: ['只有一項'] }); ok(game.getWheelSettings().items.length >= 2, '少於 2 項時退回預設項目');
  game.setWheelSettings({ items: Array.from({ length: 20 }, (_, i) => '項目' + i) }); ok(game.getWheelSettings().items.length === 12, '最多 12 項');
  game.setWheelSettings({ items: ['紅', '綠', '藍'], threshold: 500 });
  t.join('甲'); t.tgift('甲', 500); t.until('ready', 5); ok(game.getWheel().items.length === 3, '轉輪格數＝設定的項目數');
  t.tgift('甲', 300);
  const data = game.exportWheel(); ok(data.acc.length >= 1, '有累積資料可存'); const g2 = sandbox.ML.createGame(config, heroes); g2.importWheel(JSON.parse(JSON.stringify(data)));
  ok(g2.exportWheel().acc.length === data.acc.length, '累積資料可以存、可以讀回');
}
console.log(`\n${pass} 項通過、${fail} 項失敗`);
process.exit(fail ? 1 : 0);
