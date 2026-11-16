// 單挑賽規則的自動測試（不開瀏覽器，直接跑 js/game.js）：node tools/test_duel.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { window: {}, console, Math, Date };
sandbox.window = sandbox; vm.createContext(sandbox);
for (const f of ['js/config.js', 'data/heroes.js', 'data/extra-heroes.js', 'js/game.js', 'js/cloud-save.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const config = sandbox.GAME_CONFIG, heroes = sandbox.HEROES_DATA;
config.wheel.enabled = false;   // 單挑測試用大禮物，不要讓轉輪插進來
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };

function setup() {
  const game = sandbox.ML.createGame(config, heroes);
  const notes = [], fxs = [];
  game.onFx(e => { if (e.type === 'notice') notes.push(e.text); else fxs.push(e); });
  const U = n => ({ id: 'tt:' + n, name: n });
  const chat = (n, t) => game.handleEvent({ type: 'chat', user: U(n), text: t });
  const tgift = (n, name, d, c) => { const g = { name, diamonds: d || 1 }; game.handleEvent({ type: 'tiktokGift', user: U(n), gift: g, count: c || 1 }); game.handleEvent({ type: 'gift', user: U(n), giftId: 'rose', count: c || 1, tiktokGift: g }); };   // 跟真的 TikTok 一樣：先 tiktokGift、再對應過的 gift
  const run = sec => { for (let i = 0; i < sec * 10; i++) game.update(0.1); };
  const join = (n, h) => chat(n, h || '劉備');
  return { game, notes, fxs, U, chat, tgift, run, join, last: () => notes[notes.length - 1] };
}

// 1. 發起、接受
{
  const t = setup(); const { game } = t;
  t.join('甲'); t.join('乙'); t.join('丙');
  t.chat('甲', '@乙 單挑');
  ok(game.getDuelInvite() && game.getDuelInvite().toName === '乙', '甲@乙單挑 → 出現申請');
  ok(game.getMode() === 'brawl', '申請階段還是亂鬥模式');
  const hp0 = game.getPlayer('tt:乙').hp;
  t.tgift('丙', '玫瑰', 1); ok(game.getDuelInvite(), '別人送玫瑰不算接受');
  t.tgift('甲', '玫瑰', 1); ok(game.getDuelInvite(), '甲自己送玫瑰不算接受');
  t.chat('丙', '@甲 單挑'); ok(t.notes.some(x => x.includes('已經有一個單挑申請')), '已有申請時別人不能再發');
  t.tgift('乙', '玫瑰', 1);
  ok(!game.getDuelInvite() && game.getMode() === 'duel', '乙送玫瑰 → 進入單挑');
  ok(game.getPlayer('tt:乙').hp === config.duel.hp && game.getPlayer('tt:甲').hp === config.duel.hp, '雙方血量一樣');
  ok(!fxs0(t).some(e => e.type === 'attack' && e.id === 'tt:乙'), '乙的玫瑰只當接受，沒有同時當普攻');
  ok(game.getDuel().phase === 'countdown', '先倒數');
  t.run(3.5); ok(game.getDuel().phase === 'fight', '倒數完開打');
}
function fxs0(t) { return t.fxs; }

// 2. 拒絕：GG／沒反應／留言拒絕，以及發起限制
{
  const t = setup(); const { game } = t;
  t.join('甲'); t.join('乙');
  t.chat('甲', '@乙 單挑'); t.tgift('乙', 'GG', 1);
  ok(!game.getDuelInvite() && game.getMode() === 'brawl', '送 GG → 拒絕，回亂鬥');
  ok(!t.fxs.some(e => e.type === 'attack'), 'GG 沒有同時當普攻打人');
  t.chat('甲', '@乙 單挑'); ok(t.notes.some(x => x.includes('剛發過單挑申請')), '發完 5 分鐘內不能再發');
  t.run(301); t.chat('甲', '@乙 單挑'); ok(t.notes.some(x => x.includes('拒絕過')), '被拒絕後 10 分鐘內不能再挑戰同一個人');
  t.run(310);
  t.chat('甲', '@乙 單挑'); ok(game.getDuelInvite(), '過了冷卻可以再發');
  t.run(61); ok(!game.getDuelInvite() && t.notes.some(x => x.includes('沒有回應')), '60 秒沒反應 → 視為拒絕');
  t.run(700);
  t.chat('甲', '@乙 單挑'); t.chat('乙', '拒絕'); ok(!game.getDuelInvite(), '留言「拒絕」');
  t.run(700);
  t.chat('甲', '@乙 單挑'); t.chat('乙', '接受'); ok(game.getMode() === 'duel', '留言「接受」也能接受');
}
{
  const t = setup(); const { game } = t;
  t.join('甲'); t.join('乙');
  t.chat('甲', '@自己 單挑'); ok(t.notes.some(x => x.includes('找不到')), '找不到的名字');
  t.chat('甲', '@甲 單挑'); ok(t.notes.some(x => x.includes('不能挑戰自己')), '不能挑戰自己');
  t.chat('路人', '@乙 單挑'); ok(t.notes.some(x => x.includes('請先留言武將名字上場')), '沒上場不能發起');
  t.chat('甲', '單挑 @乙'); ok(game.getDuelInvite(), '「單挑 @乙」也行');
  t.run(1); t.chat('乙', '接受'); t.run(3.5);
  t.chat('甲', '@乙 單挑'); ok(true, '單挑中再發不會出錯');
  const lock = game.getPlayer('tt:甲').lockId; ok(!lock, '「@乙 單挑」不會變成鎖定');
}
{ // 賽跑／BOSS 時不能發起
  const t = setup(); const { game } = t;
  t.join('甲'); t.join('乙');
  game.handleEvent({ type: 'gift', user: t.U('甲'), giftId: 'boss1', count: 1 });
  t.chat('甲', '@乙 單挑'); ok(!game.getDuelInvite(), 'BOSS 在場不能發起');
  game.clearBosses();
  game.setMode('race'); t.chat('甲', '@乙 單挑'); ok(!game.getDuelInvite(), '賽跑中不能發起');
}

// 3. 單挑進行：傷害、助攻、不能回血、怒氣技能、自動攻擊、時間到
function startDuel(t, a, b) {
  t.join(a); t.join(b); t.chat(a, `@${b} 單挑`); t.chat(b, '接受'); t.run(3.5);
}
{
  const t = setup(); const { game } = t; startDuel(t, '甲', '乙'); t.join('丙'); t.join('丁');
  const pb = game.getPlayer('tt:乙');
  t.tgift('甲', 'Rose', 1); const d1 = config.duel.hp - pb.hp; ok(config.duel.hp === 5000 && d1 >= 35 && d1 <= 45, `1 鑽傷害約 40（${d1}）`);
  const hp1 = pb.hp; t.tgift('甲', 'Galaxy', 1000); const d2 = hp1 - pb.hp; ok(d2 > 1000 && d2 <= config.duel.hp * 0.35 + 1, `1000 鑽傷害有上限（${d2}）`);
  const hp2 = pb.hp; t.tgift('甲', 'Universe', 34999); const d3 = hp2 - pb.hp; ok(Math.abs(d3 - config.duel.hp * 0.35) < 2, `大禮最多打 35%（${d3}）`);
  t.tgift('丙', 'Rose', 1); ok(t.notes.some(x => x.includes('請先留言「@')), '圍觀者沒 @ 就送禮 → 提醒');
  t.chat('丙', '@甲'); ok(t.notes.some(x => x.includes('丙 選擇幫 甲 助攻')), '圍觀者 @甲');
  const hp3 = pb.hp; t.tgift('丙', 'Rose', 100); const d4 = hp3 - pb.hp; ok(d4 > 150 && d4 < 250, `助攻打對面、打 5 折（${d4}）`);
  { const A = game.getDuelAssists(); ok(A.length === 1 && A[0].name === '丙' && A[0].damage > 150 && A[0].sideName === '甲', `助攻榜記下丙幫甲打了 ${A[0] && Math.round(A[0].damage)}`); }
  t.chat('丁', '@戊'); ok(t.notes.some(x => x.includes('只能幫單挑的兩位選手助攻')), '圍觀者只能 @ 選手');
  const pa = game.getPlayer('tt:甲'), hpa = pa.hp; game.handleEvent({ type: 'gift', user: t.U('甲'), giftId: 'heart', count: 1 });
  ok(pa.hp === hpa && t.notes.some(x => x.includes('單挑中不能回血')), '單挑中不能回血');
  t.chat('甲', '劉備'); t.chat('甲', '關羽'); ok(t.notes.some(x => x.includes('單挑中不能換武將')), '單挑中不能換武將');
  t.chat('丙', '烙跑'); ok(game.getMode() === 'duel', '圍觀者離場不影響單挑');
}
{ // 自動小攻擊 + 怒氣技能
  const t = setup(); const { game } = t; startDuel(t, '甲', '乙');
  const pa = game.getPlayer('tt:甲'), pb = game.getPlayer('tt:乙');
  t.run(20); ok(pa.hp < config.duel.hp && pb.hp < config.duel.hp, `沒人送禮也會互相自動小攻擊（甲 ${Math.round(pa.hp)}／乙 ${Math.round(pb.hp)}）`);
  t.fxs.length = 0; t.tgift('甲', 'Rose', 300, 3);   // 怒氣塞滿
  t.run(0.5); ok(game.getDuel().a.rage >= 100 && !t.fxs.some(e => e.action === 'skill'), '怒氣滿了先閃爍等一下，還沒放技能');
  t.run(2.5); ok(t.fxs.some(e => e.type === 'attack' && e.action === 'skill' && e.id === 'tt:甲'), '閃爍完自動放技能');
  ok(game.getDuel().a.rage < 100, '放技能後怒氣歸零');
}
{ // 時間到：比血量；一樣多＝和局
  const t = setup(); const { game } = t; startDuel(t, '甲', '乙');
  const pb = game.getPlayer('tt:乙'); t.tgift('甲', 'Rose', 100);
  t.run(config.duel.maxSeconds + 1);
  const D = game.getDuel(); ok(D && D.phase === 'result' && D.result.winnerId === 'tt:甲', '時間到比剩餘血量，血多的贏');
  t.run(config.duel.resultSeconds + 1); ok(game.getMode() === 'brawl' && !game.getDuel(), '結果顯示完自動回亂鬥');
  ok(game.getPlayer('tt:甲').hp === game.getPlayer('tt:甲').maxHp && !game.getPlayer('tt:乙').down, '雙方恢復滿血、輸家站起來');
  ok(game.getPlayer('tt:甲').maxHp === game.stats(game.getPlayer('tt:甲')).maxHp, '血量上限復原成一般亂鬥的數字');
}

// 4. 經驗值：連勝、打倒連勝者、掉等級、同一對反覆單挑
function duelWin(t, win, lose) {   // win 送大禮直接打爆 lose
  config.duel.inviteCooldown = 1; t.run(2);
  startDuel(t, win, lose);
  for (let i = 0; i < 6 && t.game.getDuel() && t.game.getDuel().phase === 'fight'; i++) t.tgift(win, 'Universe', 34999);
  const R = t.game.getDuel() && t.game.getDuel().result;
  t.run(config.duel.resultSeconds + 1);
  return R;
}
{
  const t = setup(); const { game } = t;
  game.importProfiles([{ id: 'tt:甲', name: '甲', level: 10, xp: 100 }, { id: 'tt:乙', name: '乙', level: 10, xp: 100 }, { id: 'tt:丙', name: '丙', level: 10, xp: 100 }, { id: 'tt:丁', name: '丁', level: 10, xp: 100 }, { id: 'tt:戊', name: '戊', level: 1, xp: 0 }]);
  const prof = id => game.exportProfiles().find(p => p.id === id);
  let R = duelWin(t, '甲', '乙');
  ok(R && R.winnerId === 'tt:甲' && R.streak === 1, '甲贏，1 連勝');
  const expWin1 = (config.duel.xp.winBase + config.duel.xp.winPerLevel * 10); ok(R.winXp === expWin1, `第 1 場贏拿 ${expWin1}（${R.winXp}）`);
  ok(prof('tt:乙').level < 10 || prof('tt:乙').xp < 100, '乙被扣經驗');
  ok(prof('tt:甲').adj > 0 && prof('tt:乙').adj > 0, '雙方都標上調整時間（雲端合併才不會被舊的蓋回去）');
  ok(prof('tt:甲').streak === 1 && prof('tt:乙').streak === 0, '連勝數存進進度');
  R = duelWin(t, '甲', '丙'); ok(R.streak === 2 && R.winXp > expWin1, `連勝加成：2 連勝拿更多（${R.winXp}）`);
  R = duelWin(t, '甲', '丁'); ok(R.streak === 3 && R.winXp > expWin1 * 1.4, `3 連勝（${R.winXp}）`);
  const before = prof('tt:丁');
  // 丙 打倒 甲（3 連勝）
  R = duelWin(t, '丙', '甲'); ok(R.broke === 3 && R.winXp > expWin1 * 2, `打倒 3 連勝的人拿大量經驗（${R.winXp}）`);
  ok(prof('tt:甲').streak === 0 && prof('tt:丙').streak === 1, '被打倒的連勝歸零');
  // 同一對人反覆單挑遞減
  const x1 = duelWin(t, '丁', '戊'), x2 = duelWin(t, '丁', '戊'), x3 = duelWin(t, '丁', '戊');
  ok(x1 && x2 && x3 && x2.winXp < x1.winXp * 1.5 && x3.winXp / (1 + 0.25 * 2) < x2.winXp / (1 + 0.25 * 1) + 1, `同一對反覆單挑經驗遞減（${x1.winXp}→${x2.winXp}→${x3.winXp}）`);
  ok(prof('tt:戊').level === 1 && prof('tt:戊').xp === 0, '1 級輸家最低扣到 0，不會變負');
}
{ // 輸家掉等級
  const t = setup(); const { game } = t;
  game.importProfiles([{ id: 'tt:甲', name: '甲', level: 5, xp: 3 }, { id: 'tt:乙', name: '乙', level: 5, xp: 3 }]);
  const lv0 = game.exportProfiles().find(p => p.id === 'tt:乙');
  const R = duelWin(t, '甲', '乙'); const lv1 = game.exportProfiles().find(p => p.id === 'tt:乙');
  ok(R.levelDown && lv1.level === 4, `輸家掉等級（Lv.${lv0.level}→Lv.${lv1.level}，扣 ${R.loseXp}）`);
  ok(lv1.xp >= 0, '掉級後經驗值不為負');
  ok(t.fxs.some(e => e.type === 'leveldown'), '有掉等級的演出通知');
}
{ // 中途烙跑＝棄權；取消
  const t = setup(); const { game } = t; startDuel(t, '甲', '乙');
  t.chat('乙', '烙跑'); const D = game.getDuel();
  ok(D && D.phase === 'result' && D.result.winnerId === 'tt:甲', '單挑中途烙跑＝棄權，對手贏');
  t.run(20); ok(game.getMode() === 'brawl', '自動回亂鬥');
  const t2 = setup(); startDuel(t2, '甲', '乙'); t2.game.hostPress({ id: 'h', name: '主播' }, { duel: 'cancel' });
  ok(t2.game.getMode() === 'brawl' && !t2.game.getDuel(), '主播取消單挑 → 回亂鬥，不加不扣經驗');
  ok(t2.game.exportProfiles().every(p => !p.streak && !p.adj), '取消不影響連勝與經驗');
}
{ // 存檔來回
  const t = setup(); const { game } = t;
  game.importProfiles([{ id: 'tt:甲', name: '甲', level: 3, xp: 5, streak: 4, adj: 123 }]);
  ok(game.exportProfiles()[0].streak === 4, '連勝數能存進、讀出');
  const m = sandbox.ML.mergeProfiles([{ id: 'tt:甲', level: 3, xp: 1, streak: 0, adj: 0 }], [{ id: 'tt:甲', level: 2, xp: 0, streak: 5, adj: 99 }]);
  ok(m[0].streak === 5 && m[0].level === 2, '雲端合併：最後一次調整（單挑輸）的那份整個算數，包含連勝');
}
console.log(`\n${pass} 項通過、${fail} 項失敗`);
process.exit(fail ? 1 : 0);
