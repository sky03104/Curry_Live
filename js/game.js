// ============================================================
// 遊戲規則層：上場、攻擊、鎖定、倒地、復活、等級、離場、排行榜。
// 這裡完全不碰畫面，只算數字，然後用 onFx 通知畫面「發生了什麼事」。
// ============================================================
window.ML = window.ML || {};

ML.createGame = function (config, heroes) {
  const players = new Map();   // 觀眾代號 → 場上的武將
  const scores = new Map();    // 觀眾代號 → 這位觀眾的累計紀錄：傷害、擊倒數、等級、經驗值（離場後仍保留）
  const fxListeners = [];
  let time = 0;                // 遊戲內經過的秒數
  // ---------- 陣營模式的狀態（亂鬥模式時完全不用）----------
  const tc = config.team || {};
  let mode = 'brawl';          // 'brawl' 亂鬥 ／ 'team' 陣營
  const structs = new Map();   // 防禦塔與主堡（tower_red、base_red、tower_blue、base_blue）。不放進 players，所以不會被當成武將
  const teamOf = new Map();    // 觀眾代號 → { team: 'red'|'blue', chosen: 自己選的才算 true（系統自動分的第一次改選不算換隊）}
  const swaps = new Map();     // 觀眾代號 → 這場已經換過幾次隊
  let match = { winner: null, restartAt: 0, time: 0 };   // winner：'red'／'blue'／'draw'／null（還沒分勝負）
  const teamLabel = t => (tc.names && tc.names[t]) || (t === 'red' ? '紅隊' : '藍隊');
  const foeOf = t => (t === 'red' ? 'blue' : 'red');
  // ---------- 賽跑模式的狀態 ----------
  const tr = config.race || {};
  let race = null;             // 賽跑：{ phase: 'signup'|'countdown'|'run'|'result', left, cd, t, resLeft, entrants: Map, order, results }
  const raceLock = new Map();  // 觀眾代號 → 他「@」的參賽者代號（沒上場的觀眾也能 @ 參賽者送禮）

  // ---------- 單挑賽的狀態 ----------
  const dc = config.duel || {};
  let duelInvite = null;       // 單挑申請（還沒回應）：{ from, to, left }。這時還是亂鬥模式，畫面中間跳出申請
  let duel = null;             // 單挑賽：{ phase: 'countdown'|'fight'|'result', a, b, cd, t, rage:{a,b}, nextAuto:{a,b}, skillAt:{a,b}, resLeft, result }。進行中 mode 是 'duel'
  const duelLock = new Map();  // 圍觀者代號 → 他「@」的單挑選手代號（之後送禮就是幫那一邊助攻）
  const duelCool = new Map();  // 觀眾代號 → 幾秒（遊戲時間）後才能再發單挑申請
  const duelBlock = new Map(); // 「甲|乙」→ 幾秒（遊戲時間）內甲不能再挑戰乙（被拒絕之後）
  const duelPairLog = new Map(); // 兩人的組合（代號排序後相連）→ 最近單挑過的時間們（反覆單挑刷經驗要遞減）
  const noticeAt = new Map();  // 提醒訊息的節流：key → 上次提醒的時間，免得洗版
  let duelSkipGift = null;     // 剛當成「回應單挑」的那份 TikTok 禮物：接著那份對應的遊戲禮物（普攻）要跳過，不然同一份玫瑰又會打人

  // 留言比對用：武將中文名與別名 → 武將資料（名字長的先比，避免短名搶先）
  const heroById = new Map(heroes.map(h => [h.heroId, h]));
  const nameTable = heroes.map(h => [h.displayName, h]);
  for (const [alias, id] of Object.entries(config.heroAliases || {})) {
    if (heroById.has(id)) nameTable.push([alias, heroById.get(id)]);
  }
  nameTable.sort((a, b) => b[0].length - a[0].length);
  let hostCheck = null;      // 這個人是不是主播：(user) → true／false
  let hostMatch = null;      // 主播文字指令：(user, text) → 遊戲禮物代號或 null（由 host-commands.js 提供）
  let defaultHeroId = '';   // 還沒上場就送禮時自動上場的預設武將（空字串 = 不自動上場）
  // 這位實況主開放哪些武將：留言只比對開放的武將（已在場上的不受影響）。允許清單由 hero-settings.js 決定
  function setHeroPool(ids) {
    const ok = new Set(ids);
    nameTable.length = 0;
    for (const h of heroes) if (ok.has(h.heroId)) nameTable.push([h.displayName, h]);
    for (const [alias, id] of Object.entries(config.heroAliases || {})) if (ok.has(id) && heroById.has(id)) nameTable.push([alias, heroById.get(id)]);
    nameTable.sort((a, b) => b[0].length - a[0].length);
  }

  function fx(e) { fxListeners.forEach(fn => fn(e)); }
  function notice(text) { fx({ type: 'notice', text }); }

  // ---------- BOSS 資料 ----------
  // BOSS 在遊戲裡跟玩家的武將放在同一張表（players）裡，id 固定是 'boss'，所以攻擊、鎖定、顯示都沿用同一套；
  // 只是它不是觀眾（isBoss: true），能力值直接用 config.boss.list 裡寫的數字，不吃等級成長。
  const bossCfg = config.boss || { list: [] };
  const bossById = new Map((bossCfg.list || []).map(b => [b.id, b]));
  const bossQueue = [];        // 排隊中的 BOSS：{ def, by: 招換的觀眾名字 }
  const BOSS_ID = 'boss';
  const bossHero = def => ({ heroId: def.id, displayName: def.displayName, faction: 'Boss', troop: def.troop || 'Vanguard',
    skillName: def.skillName, baseHp: def.hp, baseAtk: def.atk, baseArmor: def.def, isBoss: true, accent: def.accent, hasArt: !!def.hasArt });
  const isBossName = r => /^boss$/i.test(r.trim());
  // ---------- 等級與能力值 ----------
  // 等級跟著「觀眾」走（不是跟著武將），所以換武將、倒地、離場再回來，等級都還在。
  // 能力值 = 武將的基礎值 ×（1 + 每級成長 ×（等級 - 1））
  function stats(p) {
    if (p.isStruct) return { maxHp: p.maxHp, atk: 0, def: p.defv };
    if (p.isBoss) return { maxHp: p.maxHp, atk: p.def.atk, def: p.def.def };
    const g = config.leveling, up = p.prof.level - 1;
    const u = config.uniformHero, base = u && u.enabled ? { hp: u.hp, atk: u.atk, def: u.def } : { hp: p.hero.baseHp, atk: p.hero.baseAtk, def: p.hero.baseArmor };   // 全員同能力（config.uniformHero）
    const bf = p.prof.buffs, atkBuff = bf && bf.atk && bf.atk.until > time ? bf.atk.mult : 1;   // 紅BUFF：攻擊力加倍
    return {
      maxHp: Math.round(base.hp * config.hpMultiplier * (1 + g.hpPerLevel * up)),
      atk: base.atk * (1 + g.atkPerLevel * up) * atkBuff,
      def: base.def * (1 + g.defPerLevel * up),
    };
  }
  // 升到下一級需要多少經驗值
  function xpNeed(level) { const g = config.leveling; return g.xpNeedBase + g.xpNeedPerLevel * level + (g.xpNeedQuad || 0) * level * level; }
  // 等級或武將變了之後重算最大血量；目前血量照比例帶過去（不會因此補血）
  function refreshHp(p) {
    const ratio = p.maxHp ? p.hp / p.maxHp : 1;
    p.maxHp = stats(p).maxHp;
    p.hp = p.down ? 0 : Math.max(1, Math.round(p.maxHp * ratio));
  }
  // 擊倒對手拿經驗值：對手等級越高拿越多；滿了就升級（一次可以連升好幾級）
  function gainKillXp(p, victim) {
    const g = config.leveling;
    // 打比自己低很多級的人，經驗值打折（防止高等刷低等）：低 levelGapFree 級以內不打折，超過的每多 1 級少 levelGapPenalty，最少剩 levelGapMinFactor。打比自己高的不打折
    const gap = p.prof.level - victim.prof.level, over = Math.max(0, gap - (g.levelGapFree || 0));
    const factor = Math.max(g.levelGapMinFactor === undefined ? 0.1 : g.levelGapMinFactor, 1 - over * (g.levelGapPenalty || 0));
    // 同一個人（不管誰打的）短時間內被反覆打倒，每多被打倒一次，經驗值再打折（防止一直打剛復活的人刷經驗）：
    // 過去 repeatKillWindow 秒內已經被打倒過 n 次，這次拿 (1 − n × repeatKillPenalty)，最少剩 repeatKillMinFactor
    const win = g.repeatKillWindow || 0, log = (killLog.get(victim.id) || []).filter(t => time - t < win), repeat = log.length;
    log.push(time); killLog.set(victim.id, log);
    const repeatFactor = win ? Math.max(g.repeatKillMinFactor === undefined ? 0.1 : g.repeatKillMinFactor, 1 - repeat * (g.repeatKillPenalty || 0)) : 1;
    grantXp(p.prof, Math.max(1, Math.round((g.xpPerKillBase + g.xpPerKillPerVictimLevel * victim.prof.level) * factor * repeatFactor)));
  }
  // 給某位觀眾經驗值（prof 是他的累計紀錄；人不在場上也能拿，下次上場就是新等級）。滿了就升級，一次可連升。
  function grantXp(prof, amount) {
    const g = config.leveling;
    if (prof.level >= g.maxLevel) return;
    prof.xp += amount;
    const before = prof.level;
    while (prof.level < g.maxLevel && prof.xp >= xpNeed(prof.level)) { prof.xp -= xpNeed(prof.level); prof.level++; }
    if (prof.level >= g.maxLevel) prof.xp = 0;
    if (prof.level > before) {
      const p = players.get(prof.id);
      if (p && !p.isBoss) refreshHp(p);
      fx({ type: 'levelup', id: prof.id, level: prof.level });
      notice(`${prof.name || '觀眾'} 升到 Lv.${prof.level}！`);
    }
  }

  function others(p) { return [...players.values()].filter(o => o !== p && !o.down); }

  // ---------- 鎖定對象的比對 ----------
  // 觀眾很難把別人的名字打得一模一樣（名字裡有表情符號、特殊符號，畫面上太長的名字還會被截短），
  // 所以由嚴到寬一關一關比，前面的關卡有人符合就不往下：
  //   1. 名字完全一樣　2.「@名字 後面還有別的字」　3. 去掉表情符號／空白／標點、不分大小寫後一樣
  //   4. 同 3 但後面還有別的字　5. 只打了名字開頭幾個字　6. 打的字出現在名字中間　7. 打的是武將名（例如 @呂布）
  const plain = t => String(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');   // 只留文字和數字
  function findLockTarget(me, rest) {
    const cands = [...players.values()].filter(o => o !== me);
    const r = plain(rest);
    const longest = list => list.sort((a, b) => b.name.length - a.name.length)[0];    // 「名字後面還有字」：挑名字最長的
    const closest = list => list.sort((a, b) => plain(a.name).length - plain(b.name).length)[0];   // 「只打一部分」：挑最接近的
    const hero = nameTable.find(([name]) => name === rest || (r && plain(name) === r));
    const boss = players.get(BOSS_ID);
    const foe = mode === 'team' && teamOf.get(me.id) ? foeOf(teamOf.get(me.id).team) : null;
    const steps = [
      () => foe && /^(防禦塔|塔)$/.test(rest.trim()) && structs.get('tower_' + foe),   // 陣營模式：@塔 ＝ 敵方防禦塔
      () => foe && /^(主堡|堡|基地)$/.test(rest.trim()) && structs.get('base_' + foe),
      () => mode === 'team' && [...structs.values()].filter(o => o.name === rest.trim())[0],
      () => boss && isBossName(rest) && boss,                       // @BOSS：鎖定場上的 BOSS（@BOSS的名字走下面一般的名字比對）
      () => cands.filter(o => o.name === rest)[0],
      () => longest(cands.filter(o => rest.startsWith(o.name))),
      () => r && cands.filter(o => plain(o.name) === r)[0],
      () => r && longest(cands.filter(o => plain(o.name) && r.startsWith(plain(o.name)))),
      () => r && closest(cands.filter(o => plain(o.name).startsWith(r))),
      () => r && closest(cands.filter(o => plain(o.name).includes(r))),
      () => hero && (cands.filter(o => o.hero === hero[1] && !o.down)[0] || cands.filter(o => o.hero === hero[1])[0]),
    ];
    for (const step of steps) { const t = step(); if (t) return t; }
    return null;
  }

  // ---------- 留言 ----------
  // ---------- 烙跑（自己下場）----------
  // 留言「整句剛好就是烙跑」才算（標點、空白、大小寫不管），聊天說「他烙跑了」不會誤觸發。
  // 下場後等級、經驗值、累計傷害都保留，再留言武將名可以重新上場，但要先等 leaveRejoinSeconds 秒。
  const left = new Map();   // 觀眾代號 → 烙跑的時間
  const killLog = new Map();   // 觀眾代號 → 最近被打倒的時間們（遊戲秒數）。同一個人被反覆打倒，經驗值遞減用；不存檔
  function isLeaveCommand(text) {
    const t = plain(text);
    return !!t && (config.commands.leave || []).some(c => plain(c) === t);
  }
  function leave(me) {
    if (duelInvite && (duelInvite.from === me.id || duelInvite.to === me.id)) { duelInvite = null; notice(`${me.name} 離場了，單挑申請取消`); fx({ type: 'duelInviteEnd' }); }
    if (duel && duel.phase !== 'result' && (duel.a === me.id || duel.b === me.id)) { players.delete(me.id); left.set(me.id, time); fx({ type: 'leave', id: me.id, hero: me.hero, name: me.name }); notice(`${me.name} 烙跑了！（單挑中途離開，算棄權）`); finishDuel(duel.a === me.id ? duel.b : duel.a, '對手中途離場'); return; }
    players.delete(me.id);
    left.set(me.id, time);
    if (race && race.entrants.has(me.id)) { const e = race.entrants.get(me.id); if (race.phase === 'signup') race.entrants.delete(me.id); else { e.state = 'dnf'; } }   // 賽跑中烙跑＝棄權
    fx({ type: 'leave', id: me.id, hero: me.hero, name: me.name });
    notice(`${me.name} 烙跑了！`);
  }

  function handleChat(user, rawText) {
    // 全形英文（Ｊｏｙ）轉半形、去掉看不見的字元（零寬空白等），再比對；直播軟體傳來的留言常夾這些
    const text = String(rawText).normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
    const me = players.get(user.id);

    if (isLeaveCommand(text)) { if (me) leave(me); return; }

    // 單挑賽：「@乙 單挑」發起申請；被挑戰的人留言「接受／拒絕」回應；單挑中圍觀者「@甲／@乙」選邊助攻
    const inviteName = parseDuelInvite(text);
    if (inviteName !== null) { sendDuelInvite(user, me, inviteName); return; }
    if (duelInvite && user.id === duelInvite.to) {
      const t = plain(text);
      if ((config.commands.duelAccept || []).some(c => plain(c) === t)) { acceptDuel(); return; }
      if ((config.commands.duelRefuse || []).some(c => plain(c) === t)) { refuseDuel(`${me ? me.name : user.name} 拒絕了單挑`); return; }
    }
    if (mode === 'duel') {
      if (config.commands.unlock.includes(text)) { duelLock.delete(user.id); return; }
      if (text.startsWith(config.commands.lockPrefix) || text.startsWith('＠')) { duelLockCmd(user, text.slice(1).trim()); return; }
    }

    if (mode === 'race') {   // 賽跑模式：我要參賽、@參賽者、解除鎖定
      const t = plain(text);
      if ((config.commands.raceJoin || []).some(c => plain(c) === t)) { registerRace(user); return; }
      if (config.commands.unlock.includes(text)) { raceLock.delete(user.id); return; }
      if (text.startsWith(config.commands.lockPrefix) || text.startsWith('＠')) { raceLockCmd(user, text.slice(1).trim()); return; }
    }
    if (mode === 'team') {   // 陣營模式：整句剛好是「加入紅隊／加入藍隊」才算
      const t = plain(text);
      if ((config.commands.joinRed || []).some(c => plain(c) === t)) { joinTeam(user, 'red'); return; }
      if ((config.commands.joinBlue || []).some(c => plain(c) === t)) { joinTeam(user, 'blue'); return; }
    }

    if (config.commands.unlock.includes(text)) {
      if (me && me.lockId) { me.lockId = null; notice(`${me.name} 解除鎖定`); }
      return;
    }

    if (text.startsWith(config.commands.lockPrefix) || text.startsWith('＠')) {   // 半形 @ 和全形 ＠ 都認
      if (!me) return;
      const rest = text.slice(1).trim();
      if (!rest) return;
      const target = findLockTarget(me, rest);
      if (target && mode === 'team' && isAlly(me, target)) { notice(`${me.name} 不能鎖定同隊的 ${target.name}`); return; }
      if (target) { me.lockId = target.id; notice(`${me.name} 鎖定了 ${target.name}`); }
      else notice(`${me.name} 找不到「${rest.length > 10 ? rest.slice(0, 10) + '…' : rest}」`);
      return;
    }

    const lowText = text.toLowerCase();   // 英文名字（Joy）不分大小寫：打 joy、JOY 也算
    const hit = nameTable.find(([name]) => lowText.includes(name.toLowerCase()));
    if (!hit) return;   // 沒提到武將
    if (me) { switchHero(me, text, hit[1]); return; }
    joinHero(user, hit[1]);
  }

  // 讓一位觀眾帶著某隻武將上場（留言武將名、或還沒上場就送禮時自動上場都走這裡）。成功回傳場上的武將，不能上場（剛烙跑、場上滿了）回傳 null
  function joinHero(user, hero, quiet) {
    const wait = (config.leaveRejoinSeconds || 0) - (time - (left.has(user.id) ? left.get(user.id) : -1e9));
    if (wait > 0) { notice(`${user.name} 剛烙跑，還要 ${Math.ceil(wait)} 秒才能再上場`); return null; }
    if ([...players.values()].filter(o => !o.isBoss).length >= config.maxOnStage) { notice(`場上已滿，${user.name} 請稍候`); return null; }
    if (!scores.has(user.id)) scores.set(user.id, { id: user.id, damage: 0, kills: 0, level: 1, xp: 0 });
    const prof = Object.assign(scores.get(user.id), { name: user.name, heroName: hero.displayName });
    const p = { id: user.id, name: user.name, hero, prof, maxHp: 0, hp: 0, down: false, downAt: 0, lockId: null, lastActive: time };
    p.maxHp = p.hp = stats(p).maxHp;
    players.set(user.id, p);
    if (mode === 'team' && !teamOf.has(user.id)) autoAssign(user.id);   // 陣營模式：先分到人數少的那隊（第一次自己改選不算換隊）
    fx({ type: 'join', id: p.id, quiet: !!quiet });   // 一定要通知畫面建立這隻的顯示（以前自動更新放回來的武將漏掉這步，畫面上看不到）
    if (quiet) return p;   // 自動更新後把場上武將放回來：不吵（不跳上場訊息）
    const tm = mode === 'team' && teamOf.get(user.id) ? `【${teamLabel(teamOf.get(user.id).team)}】` : '';
    notice(p.prof.level > 1 ? `${p.name} 的 ${hero.displayName}（Lv.${p.prof.level}）${tm}上場！` : `${p.name} 的 ${hero.displayName} ${tm}上場！`);
    return p;
  }

  // 滿血復活（倒地後送禮、或主播的復活指令都走這裡）
  function revivePlayer(p) {
    p.down = false; p.hp = p.maxHp;
    fx({ type: 'revive', id: p.id });
    notice(`${p.name} 的 ${p.hero.displayName} 滿血復活！`);
  }
  // 主播按鈕「全部回血」：場上所有活著的武將（不含 BOSS）補滿血；倒地的不會被救起來（那要用「復活」）
  function healEveryone() {
    let n = 0;
    for (const p of players.values()) {
      if (p.isBoss || p.down || p.hp >= p.maxHp) continue;
      const amount = Math.round(p.maxHp - p.hp);
      p.hp = p.maxHp;
      fx({ type: 'heal', id: p.id, amount, icon: '💖' });
      n++;
    }
    notice(n ? `主播幫全場 ${n} 位武將補滿血！` : '大家的血都是滿的');
  }
  // 主播指令的執行（留言指令和面板按鈕共用）：復活、或當成送了 count 個那個禮物
  function runHostGift(user, hostGift) {
    if (hostGift.setMode) { gameApi.setMode(hostGift.setMode); return; }
    if (hostGift.race) { if (hostGift.race === 'open') openRace(); else if (hostGift.race === 'openHurdle') openRace('hurdle'); else if (hostGift.race === 'start') raceStartNow(); else if (hostGift.race === 'cancel') cancelRace('主播取消了比賽'); return; }
    if (hostGift.duel === 'cancel') { cancelDuel('主播取消了單挑'); return; }
    if (hostGift.restartMatch) { if (mode === 'team') restartMatch(true); else notice('現在是亂鬥模式，沒有陣營賽可以重開'); return; }
    if (hostGift.revive !== undefined) { hostRevive(user, hostGift.revive); return; }
    if (hostGift.healAll) { healEveryone(); return; }
    notice(`主播指令：${hostGift.label || '動作'} ×${hostGift.count || 1}`);   // 訊息區會寫出這次算幾個：寫 ×1 代表直播網址裡沒帶次數（忘了重貼網址）
    handleGift(user, hostGift.giftId, hostGift.count || 1, config.hostMaxCount);
  }
  // 主播的復活指令：不用等倒地倒數，馬上滿血復活。target 空白 = 主播自己；「全部」= 所有倒地的人；其他 = 用名字找那位觀眾
  function hostRevive(user, target) {
    const t = String(target || '').trim();
    if (!t) {
      const me = players.get(user.id);
      if (!me || me.isBoss) { notice('主播還沒上場，沒有武將可以復活'); return; }
      if (!me.down) { notice(`${me.name} 還活著，不用復活`); return; }
      revivePlayer(me); return;
    }
    if (['全部', '全場', 'all'].includes(t.toLowerCase())) {
      const list = [...players.values()].filter(p => p.down && !p.isBoss);
      if (!list.length) { notice('場上沒有倒地的武將'); return; }
      list.forEach(revivePlayer); return;
    }
    const hit = gameApi.findProfile(t), p = hit && players.get(hit.id);
    if (!hit) { notice(`找不到「${t.length > 10 ? t.slice(0, 10) + '…' : t}」`); return; }
    if (!p || p.isBoss) { notice(`${hit.name} 不在場上`); return; }
    if (!p.down) { notice(`${p.name} 還活著，不用復活`); return; }
    revivePlayer(p);
  }

  // 主播留言「等級 名字 數字」（指令字在 config.commands.setLevel）：把那位觀眾的等級調成那個數字。處理了（不管成功與否）回傳 true
  function hostLevelCommand(text) {
    const words = (config.commands.setLevel || []).slice().sort((a, b) => b.length - a.length);
    const t = String(text).trim();
    const w = words.find(w => t.startsWith(w));
    if (!w) return false;
    const m = t.slice(w.length).trim().match(/^(.*\S)\s+(\d{1,3})$/);   // 最後面一個數字是等級，前面是名字
    if (!m) { notice(`格式：${w} 名字 等級（例如「${w} 小明 30」）`); return true; }
    const hit = findProfileByName(m[1]);
    if (!hit) { notice(`找不到「${m[1].length > 10 ? m[1].slice(0, 10) + '…' : m[1]}」`); return true; }
    gameApi.setLevel(hit.id, Number(m[2]));
    return true;
  }
  function findProfileByName(text) { return gameApi.findProfile(text); }

  // ---------- 換武將 ----------
  // 已在場上的觀眾可以換武將，血量照比例帶過去（剩三成血，換過去也是三成），所以不能靠換角補血。
  // 留言必須「剛好只有武將名」才算換角，避免聊天時提到別的武將（例如「呂布好強」）就被誤換。
  function switchHero(me, text, hero) {
    if (!hit_name(text) || hero === me.hero) return;
    if (duel && (duel.a === me.id || duel.b === me.id)) { notice(`${me.name} 單挑中不能換武將`); return; }
    if (race && race.entrants.has(me.id) && hero.faction !== (tr.faction || 'Meng')) { notice(`${me.name} 參賽中只能換成萌國武將`); return; }
    if (time < (me.switchReadyAt || 0)) { notice(`${me.name} 剛換過武將，請稍等`); return; }
    me.hero = hero;
    refreshHp(me);
    me.switchReadyAt = time + config.switchCooldownSeconds;
    me.prof.heroName = hero.displayName;
    fx({ type: 'switch', id: me.id });
    notice(`${me.name} 換成了 ${hero.displayName}`);
  }
  // 這段留言如果剛好等於某個武將名（或別名）就回傳它，否則回傳 null
  function hit_name(text) { const low = text.toLowerCase(); const m = nameTable.find(([name]) => name.toLowerCase() === low); return m ? m[0] : null; }

  // ---------- 送禮 ----------
  function handleGift(user, giftId, rawCount, comboMax) {   // comboMax：這次最多算幾個（觀眾連送用 maxGiftCombo；主播文字指令放寬到 hostMaxCount）
    const gift = config.gifts.find(g => g.id === giftId);
    if (!gift) return;
    const openKind = (config.actions[gift.action] || {}).openRace;
    if (openKind) {   // 開放賽跑／障礙賽的禮物：不用先上場；只有亂鬥模式時有效
      if (mode !== 'brawl') { notice(`${user.name} 送了開放賽跑的禮物，但${mode === 'race' ? '比賽正在進行中' : '現在不是亂鬥模式'}，沒有生效`); return; }
      const kind = openKind === 'random' ? (Math.random() < 0.5 ? 'normal' : 'hurdle') : openKind;
      notice(`🎁 ${user.name} 送禮開放了${kind === 'hurdle' ? '障礙賽' : '賽跑'}！`);
      openRace(kind);
      return;
    }
    if (mode === 'duel') {   // 單挑中：沒有鑽石數的禮物（面板測試、主播按鈕）照 duel.fakeDiamonds 換算；真的 TikTok 禮物走 tiktokGift（見 handleEvent）。不能回血、不能招換 BOSS
      if (gift.action === 'heal') { notice(`單挑中不能回血，${user.name} 的禮物沒有生效`); return; }
      const fd = (dc.fakeDiamonds || {})[gift.action];
      if (!fd) return;
      duelGift(user, fd, Math.max(1, Math.floor(rawCount) || 1));
      return;
    }
    if (mode === 'race') {   // 賽跑中：一般禮物（普攻、技能…）全部停用；招換 BOSS 也暫停。玫瑰／GG 走 tiktokGift（見 handleEvent）
      if ((config.actions[gift.action] || {}).summon) notice(`賽跑中不能招換 BOSS，${user.name} 的禮物沒有生效`);
      return;
    }
    // 招換 BOSS：不用先上場（這是花大錢的禮物，不該因為沒上場就白送）
    const summonId = (config.actions[gift.action] || {}).summon;
    if (summonId) {
      const n = Math.max(1, Math.min(bossCfg.maxSummonPerGift || 1, Math.floor(rawCount) || 1));
      for (let i = 0; i < n; i++) summonBoss(user, summonId);
      return;
    }
    let me = players.get(user.id);
    if (!me) {
      // 還沒上場就送禮：有設定預設武將就自動帶著它上場，這份禮物照常生效；沒設定就提醒要先留言
      const dh = defaultHeroId && heroById.get(defaultHeroId);
      if (!dh) { notice(`${user.name} 請先留言武將名字上場`); return; }
      me = joinHero(user, dh);
      if (!me) return;
    }
    const count = Math.max(1, Math.min(comboMax || config.maxGiftCombo, Math.floor(rawCount) || 1));
    if (mode === 'team' && !teamOf.has(me.id)) autoAssign(me.id);
    if (mode === 'team' && match.winner) { notice(`本場已結束，${Math.max(1, Math.ceil(match.restartAt - time))} 秒後開始下一場`); return; }

    if (me.down) {
      const wait = reviveRemaining(me);
      if (wait > 0) { notice(`${me.name} 倒地中，還要 ${Math.ceil(wait)} 秒才能復活`); return; }
      revivePlayer(me);
      return;
    }

    const action = config.actions[gift.action];
    if (gift.action === 'heal') {
      // 先用「@名字」鎖定了另一位玩家（還活著、血沒滿）→ 這份回血補給他；否則補自己
      const ally = players.get(me.lockId);
      const target = ally && ally !== me && !ally.isBoss && !ally.isStruct && !ally.down && ally.hp < ally.maxHp && (mode !== 'team' || isAlly(me, ally)) ? ally : me;
      const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * action.healPercent * count));
      target.hp += amount;
      fx({ type: 'heal', id: target.id, amount, icon: gift.icon });
      if (target !== me) notice(`${me.name} 幫 ${target.name} 補血 +${amount}`);
      return;
    }

    let targets;
    if (mode === 'team') targets = teamTargets(me, gift.action === 'aoe');
    else if (gift.action === 'aoe') {
      targets = others(me);
    } else {
      const locked = players.get(me.lockId);
      const pool = others(me);
      const boss = players.get(BOSS_ID);
      targets = locked && !locked.down ? [locked]
        : boss && !boss.down && Math.random() < (bossCfg.autoTargetChance || 0) ? [boss]   // 沒鎖定任何人時，有機會直接打 BOSS
        : pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
    }
    if (!targets.length) { notice(`${me.name} 找不到對手`); return; }

    // 傷害 = 我的攻擊 × 動作倍率 × 禮物數量 × 浮動，再被對方的防禦打折：
    //   防禦等於 defenseFactor 時傷害剩一半，防禦越高折得越多，但永遠不會變成 0
    const atk = stats(me).atk;
    const downed = [];
    const hits = targets.map(t => {
      const roll = 1 + (Math.random() * 2 - 1) * config.damageVariance;
      const reduce = config.defenseFactor / (config.defenseFactor + stats(t).def);
      const dmg = Math.min(t.hp, Math.max(1, Math.round(atk * action.atkMultiplier * count * roll * reduce)));
      t.hp -= dmg;
      me.prof.damage += dmg;
      if (t.isBoss) t.hits.set(me.id, (t.hits.get(me.id) || 0) + dmg);   // 記下誰打過 BOSS（打倒時經驗值平分給他們）
      if (t.hp <= 0) { markDown(t); if (!t.isStruct) me.prof.kills++; if (t.isBoss) t.lastHitId = me.id; downed.push(t); }
      return { id: t.id, dmg, down: t.down };
    });
    fx({ type: 'attack', id: me.id, action: gift.action, icon: gift.icon, skillName: me.hero.skillName, hits });
    downed.forEach(t => { if (t.isBoss) bossDefeated(t, me); else if (t.isStruct) structDown(t, me); else { notice(`${me.name} 擊倒了 ${t.name}！`); gainKillXp(me, t); } });
  }

  // ---------- BOSS ----------
  // 招換：場上沒有 BOSS 就直接叫出來；已經有一隻（含正在倒下的），就排隊，前一隻消失後自動換上。
  function summonBoss(user, bossId) {
    if (Array.isArray(bossId)) bossId = bossId[Math.floor(Math.random() * bossId.length)];   // 例如藍BUFF／紅BUFF 隨機一隻
    const def = bossById.get(bossId);
    if (!def) return;
    const entry = { def, by: user.name };
    if (players.has(BOSS_ID)) {
      if (bossQueue.length >= (bossCfg.maxQueue || 20)) { notice(`${user.name} 招換 ${def.displayName} 失敗：排隊的 BOSS 太多了`); return; }
      bossQueue.push(entry);
      notice(`${user.name} 招換了 ${def.displayName}，排隊第 ${bossQueue.length} 位`);
      fx({ type: 'bossQueue' });
      return;
    }
    spawnBoss(entry);
  }
  function spawnBoss(entry) {
    const def = entry.def;
    const hero = bossHero(def);
    const prof = { id: BOSS_ID, name: def.displayName, heroName: def.displayName, damage: 0, kills: 0, level: def.level, xp: 0 };
    const b = { id: BOSS_ID, name: def.displayName, hero, prof, maxHp: def.hp, hp: def.hp, down: false, downAt: 0, lockId: null,
      lastActive: time, isBoss: true, def, summoner: entry.by, hits: new Map(), lastHitId: null,
      nextAttackAt: time + bossCfg.attackEverySeconds, nextAoeAt: time + bossCfg.aoeEverySeconds };
    players.set(BOSS_ID, b);
    fx({ type: 'join', id: BOSS_ID, boss: true });
    fx({ type: 'bossSpawn', id: BOSS_ID });
    notice(`⚠ ${entry.by} 招換了 BOSS【Lv.${def.level} ${def.displayName}】！`);
  }
  // 被打倒：經驗值平均分給所有打過它的玩家，最後一擊的人再額外多拿尾刀獎勵
  function bossDefeated(b, killer) {
    const ids = [...b.hits.keys()];
    const share = ids.length ? Math.floor(b.def.xp / ids.length) : 0, bonus = b.def.lastHitBonus || 0;
    for (const id of ids) {
      const prof = scores.get(id);
      if (prof) grantXp(prof, share + (id === b.lastHitId ? bonus : 0));
    }
    fx({ type: 'bossDefeated', id: b.id, share, bonus, killer: killer.name });
    if (b.def.reward) grantBuff(killer, b.def.reward);
    notice(`${killer.name} 打倒了 ${b.name}！`);
    notice(`${ids.length} 位參戰者各 +${share} 經驗，尾刀獎勵 +${bonus}`);
  }
  // 擊殺藍BUFF／紅BUFF 的玩家獲得的效果（只有「最後一擊」的人拿得到）。同一種效果再拿到會重新計時，不會疊加。
  function grantBuff(p, r) {
    const prof = p.prof, until = time + (r.seconds || 3600);
    prof.buffs = prof.buffs || {};
    if (r.regenPerSecond) prof.buffs.regen = { until, amount: r.regenPerSecond };
    if (r.atkMultiplier) prof.buffs.atk = { until, mult: r.atkMultiplier };
    fx({ type: 'buffGain', id: p.id, kind: r.regenPerSecond ? 'regen' : 'atk', text: r.regenPerSecond ? '藍BUFF！' : '紅BUFF！' });
    notice(`${p.name} 獲得${r.label || 'BUFF'}（${Math.round((r.seconds || 3600) / 60)} 分鐘）`);
  }
  // 每秒回血（藍BUFF）：每滿 1 秒補一次，畫面上每 2 秒跳一次小小的綠色加號
  function tickBuffs(p, dt) {
    const rg = p.prof.buffs && p.prof.buffs.regen;
    if (!rg || rg.until <= time || p.down || (mode === 'duel' && duel && (duel.a === p.id || duel.b === p.id))) { p.regenAcc = 0; p.regenShown = 0; return; }   // 單挑中不能回血（藍BUFF 也暫停）
    p.regenAcc = (p.regenAcc || 0) + dt;
    while (p.regenAcc >= 1 - 1e-6) {   // 留一點浮點誤差的空間（0.1 加十次會是 0.9999999）
      p.regenAcc -= 1;
      const add = Math.min(p.maxHp - p.hp, rg.amount);
      p.hp += add; p.regenShown = (p.regenShown || 0) + add;
    }
    p.regenFxAcc = (p.regenFxAcc || 0) + dt;
    if (p.regenFxAcc >= 2) { p.regenFxAcc = 0; if (p.regenShown > 0) { fx({ type: 'heal', id: p.id, amount: p.regenShown, quiet: true }); p.regenShown = 0; } }
  }

  // BOSS 出招：aoe = false 隨機打一位玩家；aoe = true 全場攻擊（每位玩家都吃）
  function bossStrike(b, aoe) {
    const pool = [...players.values()].filter(o => !o.isBoss && !o.down);
    if (!pool.length) return;
    const targets = aoe ? pool : [pool[Math.floor(Math.random() * pool.length)]];
    const mult = aoe ? bossCfg.aoeMultiplier : bossCfg.singleMultiplier;
    const hits = targets.map(t => {
      const roll = 1 + (Math.random() * 2 - 1) * config.damageVariance;
      const reduce = config.defenseFactor / (config.defenseFactor + stats(t).def);
      const dmg = Math.min(t.hp, Math.max(1, Math.round(b.def.atk * mult * roll * reduce)));
      t.hp -= dmg;
      if (t.hp <= 0) markDown(t);
      return { id: t.id, dmg, down: t.down };
    });
    fx({ type: 'attack', id: b.id, action: aoe ? 'aoe' : 'attack', icon: '', skillName: aoe ? b.def.aoeName : b.def.skillName, label: aoe ? b.def.aoeName + '！' : '', hits });
    hits.filter(h => h.down).forEach(h => notice(`${b.name} 擊倒了 ${players.get(h.id).name}！`));
  }
  function bossUpdate(b) {
    if (b.down) {
      if (time - b.downAt >= bossCfg.removeAfterSeconds) {      // 倒下一陣子後消失，叫出排隊中的下一隻
        players.delete(BOSS_ID);
        fx({ type: 'bossGone', id: BOSS_ID });
        const next = bossQueue.shift();
        if (next) spawnBoss(next);
      }
      return;
    }
    if (time >= b.nextAoeAt) { b.nextAoeAt = time + bossCfg.aoeEverySeconds; b.nextAttackAt = time + bossCfg.attackEverySeconds; bossStrike(b, true); }   // 全場攻擊那一下順便當作這一輪的單體攻擊，不會緊接著又被打一次
    else if (time >= b.nextAttackAt) { b.nextAttackAt = time + bossCfg.attackEverySeconds; bossStrike(b, false); }
  }

  function reviveRemaining(p) { return p.down ? Math.max(0, (p.reviveAfter || config.reviveSeconds) - (time - p.downAt)) : 0; }


  // ---------- 陣營模式 ----------
  // 倒地：記下時間；陣營模式的復活冷卻會越倒越久（60→90→120→180 秒，每場重算）
  function markDown(t) {
    t.down = true; t.downAt = time;
    if (t.isStruct || t.isBoss) return;
    t.deaths = (t.deaths || 0) + 1;
    const arr = tc.reviveSeconds || [];
    t.reviveAfter = mode === 'team' && arr.length ? arr[Math.min(t.deaths, arr.length) - 1] : config.reviveSeconds;
  }
  const isAlly = (a, b) => { const x = teamOf.get(a.id); if (b.isStruct) return !!(x && x.team === b.team); const y = teamOf.get(b.id); return !!(x && y && x.team === y.team); };
  const teamCount = t => [...players.values()].filter(o => !o.isBoss && teamOf.has(o.id) && teamOf.get(o.id).team === t).length;
  function autoAssign(id) {
    const r = teamCount('red'), b = teamCount('blue');
    teamOf.set(id, { team: r < b ? 'red' : b < r ? 'blue' : (Math.random() < 0.5 ? 'red' : 'blue'), chosen: false });
  }
  // 留言「加入紅隊／加入藍隊」：第一次選隊免費，之後每換一次隊算一次，每場最多 tc.maxSwitches 次
  function joinTeam(user, team) {
    let me = players.get(user.id);
    if (!me) {
      const dh = defaultHeroId && heroById.get(defaultHeroId);
      if (!dh) { notice(`${user.name} 請先留言武將名字上場`); return; }
      me = joinHero(user, dh);
      if (!me) return;
    }
    const cur = teamOf.get(user.id) || { team: null, chosen: false };
    if (cur.team === team) {
      if (!cur.chosen) { cur.chosen = true; teamOf.set(user.id, cur); notice(`${me.name} 加入了${teamLabel(team)}`); } else notice(`${me.name} 已經在${teamLabel(team)}了`);
      return;
    }
    const max = tc.maxSwitches === undefined ? 3 : tc.maxSwitches;
    if (cur.chosen) {
      const used = swaps.get(user.id) || 0;
      if (used >= max) { notice(`${me.name} 這場的換隊次數（${max} 次）已經用完`); return; }
      swaps.set(user.id, used + 1);
      teamOf.set(user.id, { team, chosen: true });
      notice(`${me.name} 換到${teamLabel(team)}（剩 ${max - used - 1} 次換隊）`);
    } else {
      teamOf.set(user.id, { team, chosen: true });
      notice(`${me.name} 加入了${teamLabel(team)}`);
    }
    fx({ type: 'teamJoin', id: user.id, team });
  }
  function makeStruct(kind, team) {
    const isTower = kind === 'tower', name = `${team === 'red' ? '紅方' : '藍方'}${isTower ? '防禦塔' : '主堡'}`;
    const maxHp = isTower ? tc.towerHp : tc.baseHp;
    return { id: `${kind}_${team}`, name, isStruct: true, kind, team, maxHp, hp: maxHp, down: false, downAt: 0, defv: isTower ? tc.towerDef : tc.baseDef,
      hero: { heroId: 'struct', displayName: name, faction: 'Team', troop: 'Ranger', skillName: '' }, lockId: null, nextAt: 0 };
  }
  function initStructs() {
    structs.clear();
    for (const t of ['red', 'blue']) { const tw = makeStruct('tower', t); tw.nextAt = time + (tc.towerAttackEvery || 5); structs.set(tw.id, tw); const b = makeStruct('base', t); structs.set(b.id, b); }
  }
  // 敵方主堡能不能打：防禦塔已經倒了，而且那隊場上沒有活著的武將（沒人也算全倒）
  function baseOpen(team) {
    const tw = structs.get('tower_' + team);
    if (!tw || !tw.down) return false;
    return !teamCount0Alive(team);
  }
  const teamCount0Alive = team => [...players.values()].some(o => !o.isBoss && !o.down && teamOf.has(o.id) && teamOf.get(o.id).team === team);
  // 陣營模式下，這次攻擊要打誰
  function teamTargets(me, aoe) {
    const mine = teamOf.get(me.id).team, foe = foeOf(mine);
    const heroes = [...players.values()].filter(o => !o.isBoss && !o.down && teamOf.has(o.id) && teamOf.get(o.id).team === foe);
    const tower = structs.get('tower_' + foe), base = structs.get('base_' + foe);
    const towerUp = tower && !tower.down, baseUp = base && !base.down && baseOpen(foe);
    const boss = players.get(BOSS_ID), bossUp = boss && !boss.down;
    if (aoe) return [...heroes, ...(towerUp ? [tower] : []), ...(baseUp ? [base] : []), ...(bossUp ? [boss] : [])];
    const locked = players.get(me.lockId) || structs.get(me.lockId);
    if (locked && !locked.down) {
      const ok = locked.isBoss ? true : locked.isStruct ? (locked.team === foe && (locked.kind === 'tower' || baseUp)) : (teamOf.has(locked.id) && teamOf.get(locked.id).team === foe);
      if (ok) return [locked];
      if (locked.isStruct && locked.team === foe && locked.kind === 'base') notice(`${me.name} 主堡還不能打（要先拆塔、而且對方全倒）`);
    }
    if (bossUp && Math.random() < (bossCfg.autoTargetChance || 0)) return [boss];
    if (baseUp) return [base];
    const pool = [...heroes, ...(towerUp ? [tower, tower] : [])];   // 塔算兩份，不然武將多的時候塔都沒人打
    return pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
  }
  function structDown(t, killer) {
    fx({ type: 'structDown', id: t.id });
    if (t.kind === 'tower') { notice(`${killer.name} 拆掉了${t.name}！`); return; }
    endMatch(foeOf(t.team), `${killer.name} 攻破了${t.name}！`);
  }
  function endMatch(winner, why) {
    if (match.winner) return;
    match.winner = winner; match.restartAt = time + (tc.resultSeconds || 15);
    let nWin = 0, nLose = 0;
    for (const [id, t] of teamOf) {
      const prof = scores.get(id); if (!prof) continue;
      const win = winner !== 'draw' && t.team === winner;
      grantXp(prof, win ? tc.winXp : tc.loseXp);
      if (win) nWin++; else nLose++;
    }
    fx({ type: 'teamWin', team: winner });
    notice(winner === 'draw' ? '時間到，平手！' : `🏆 ${teamLabel(winner)}獲勝！`);
    if (why) notice(why);
    if (winner !== 'draw') notice(`${teamLabel(winner)} ${nWin} 位玩家各 +${tc.winXp} 經驗，${teamLabel(foeOf(winner))} ${nLose} 位各 +${tc.loseXp}`);
  }
  // 新的一場：塔堡回滿、大家滿血復活、隊伍重新分（系統先平均分，玩家可以再自己選）
  function restartMatch(manual) {
    initStructs();
    teamOf.clear(); swaps.clear(); match = { winner: null, restartAt: 0, time: 0 };
    const list = [...players.values()].filter(o => !o.isBoss).sort(() => Math.random() - 0.5);
    for (const p of list) { p.down = false; p.hp = p.maxHp; p.deaths = 0; p.reviveAfter = 0; p.lockId = null; autoAssign(p.id); fx({ type: 'revive', id: p.id, quiet: true }); }
    fx({ type: 'matchReset' });
    notice(manual ? '主播重開了陣營賽！可以留言「加入紅隊／加入藍隊」重新選隊' : '新的一場開始！可以留言「加入紅隊／加入藍隊」重新選隊');
  }
  function teamTick(dt) {
    if (match.winner) { if (time >= match.restartAt) restartMatch(false); return; }
    const hasR = teamCount('red') > 0, hasB = teamCount('blue') > 0;
    if (hasR && hasB) match.time += dt;
    if (tc.matchSeconds && match.time >= tc.matchSeconds) {
      const r = structs.get('base_red'), b = structs.get('base_blue'), pr = r.hp / r.maxHp, pb = b.hp / b.maxHp;
      endMatch(Math.abs(pr - pb) < 1e-6 ? 'draw' : pr > pb ? 'red' : 'blue', '時間到，比主堡剩餘血量');
      return;
    }
    // 防禦塔反擊：每隔幾秒隨機打敵方一位活著的武將
    for (const tw of structs.values()) {
      if (tw.kind !== 'tower' || tw.down || time < tw.nextAt) continue;
      tw.nextAt = time + (tc.towerAttackEvery || 5);
      const pool = [...players.values()].filter(o => !o.isBoss && !o.down && teamOf.has(o.id) && teamOf.get(o.id).team === foeOf(tw.team));
      if (!pool.length) continue;
      const t = pool[Math.floor(Math.random() * pool.length)];
      const roll = 1 + (Math.random() * 2 - 1) * config.damageVariance, reduce = config.defenseFactor / (config.defenseFactor + stats(t).def);
      const dmg = Math.min(t.hp, Math.max(1, Math.round(tc.towerAtk * roll * reduce)));
      t.hp -= dmg; if (t.hp <= 0) markDown(t);
      fx({ type: 'attack', id: tw.id, action: 'attack', icon: '', skillName: '', hits: [{ id: t.id, dmg, down: t.down }] });
      if (t.down) notice(`${tw.name}擊倒了 ${t.name}！`);
    }
  }

  // ---------- 賽跑模式 ----------
  const isMeng = h => !!h && h.faction === (tr.faction || 'Meng');
  const rr = (a, b) => a + Math.random() * (b - a);
  // 障礙賽的設定（見 config.race.hurdle）：關卡的位置平均分布在一圈上，第 i 關在 (i+1)/(關數+1)
  const hd = Object.assign({ lapSeconds: 36, passChances: [0.85, 0.75, 0.65, 0.55, 0.45], stumbleMin: 2, stumbleMax: 3, chanceMin: 0.05, chanceMax: 0.95, obstacles: [] }, tr.hurdle || {});
  const hurdlePos = i => (i + 1) / (hd.passChances.length + 1);
  // 這位參賽者現在過第 idx 關的機率（玫瑰加、GG 減）
  function passChanceOf(e, idx) {
    const sum = l => l.reduce((a, b) => a + (b.until > race.t ? b.delta : 0), 0);
    return Math.max(hd.chanceMin, Math.min(hd.chanceMax, hd.passChances[idx] + sum(e.boost) - sum(e.hinder)));
  }
  // 這一場用哪一種賽道：隨機挑，但不會連續兩場同一種（nextTrackId 是測試用，指定下一場）
  let lastTrack = {}, nextTrackId = '';   // lastTrack：一般賽跑與障礙賽各記各的上一場
  function pickTrack(kind) {
    const list = (kind === 'hurdle' && (tr.hurdleTracks || []).length ? tr.hurdleTracks : tr.tracks) || [], ids = list.map(t => t.id), k = kind === 'hurdle' ? 'hurdle' : 'normal';
    if (!ids.length) return 'oval';
    let id = nextTrackId && ids.includes(nextTrackId) ? nextTrackId : '';
    nextTrackId = '';
    if (!id) { const pool = ids.length > 1 ? ids.filter(x => x !== lastTrack[k]) : ids; id = pool[Math.floor(Math.random() * pool.length)]; }
    lastTrack[k] = id; return id;
  }
  // 主播開放報名（按鈕或留言）：進入賽跑模式，報名倒數開始
  function openRace(kind) {
    if (mode === 'duel') { notice('單挑賽進行中，結束後才能開放報名'); return; }
    if (duelInvite) { duelInvite = null; fx({ type: 'duelInviteEnd' }); notice('主播開放了賽跑，單挑申請取消'); }
    if (mode === 'race') { notice(race && race.phase === 'signup' ? '已經在報名中了' : '比賽進行中，結束後才能再開放報名'); return; }
    mode = 'race';
    teamOf.clear(); swaps.clear(); structs.clear(); match = { winner: null, restartAt: 0, time: 0 };
    for (const p of players.values()) p.lockId = null;
    raceLock.clear();
    race = { phase: 'signup', left: tr.signupSeconds || 180, cd: 0, t: 0, resLeft: 0, entrants: new Map(), results: [], track: pickTrack(kind), kind: kind === 'hurdle' ? 'hurdle' : 'normal' };
    notice(race.kind === 'hurdle' ? `🚧 開放障礙賽報名！${Math.round((tr.signupSeconds || 180) / 60)} 分鐘內留言「我要參賽」（只有萌國武將能參賽，要闖 ${hd.passChances.length} 道關卡）` : `🏁 開放報名！${Math.round((tr.signupSeconds || 180) / 60)} 分鐘內留言「我要參賽」（只有萌國武將能參賽）`);
    fx({ type: 'modeChange', mode });
  }
  // 留言「我要參賽」
  function registerRace(user) {
    if (!race || race.phase !== 'signup') { notice(race ? `${user.name} 比賽已經開始，下一場再報名` : ''); return; }
    if (race.entrants.has(user.id)) { notice(`${user.name} 已經報名了`); return; }
    if (race.entrants.size >= (tr.maxPlayers || 8)) { notice(`參賽名額已滿（${tr.maxPlayers || 8} 人），${user.name} 下一場再來`); return; }
    let me = players.get(user.id);
    if (me && !isMeng(me.hero)) { notice(`${me.name} 賽跑只能用萌國武將，請先留言萌國武將的名字換角，再報名`); return; }
    if (!me) {
      let hero = defaultHeroId && heroById.get(defaultHeroId);
      if (!isMeng(hero)) { const pool = heroes.filter(isMeng); hero = pool[Math.floor(Math.random() * pool.length)]; }
      if (!hero) { notice('目前沒有萌國武將可以參賽'); return; }
      me = joinHero(user, hero);
      if (!me) return;
    }
    race.entrants.set(user.id, { id: user.id, lane: race.entrants.size, progress: 0, seg: 0, cp: 0, fails: 0, state: 'ready', restLeft: 0, speed: 1, boost: [], hinder: [], finishedAt: 0, rank: 0 });
    fx({ type: 'raceJoin', id: user.id });
    notice(`🏃 ${me.name} 的 ${me.hero.displayName} 報名參賽！（${race.entrants.size}/${tr.maxPlayers || 8}）`);
  }
  // 「@參賽者」：沒上場的觀眾也能鎖定，之後送玫瑰／GG 才知道要幫誰
  function raceLockCmd(user, rest) {
    if (!rest) return;
    const dummy = players.get(user.id) || { id: user.id };
    const target = findLockTarget(dummy, rest);
    if (target && race && race.entrants.has(target.id)) { raceLock.set(user.id, target.id); notice(`${user.name} 鎖定了參賽者 ${target.name}`); }
    else notice(`${user.name} 找不到參賽者「${rest.length > 10 ? rest.slice(0, 10) + '…' : rest}」`);
  }
  // 玫瑰（助力）／GG（干擾）：參賽者只能助力自己；沒參賽的人要先 @ 參賽者
  function raceGift(user, kind, rawCount) {
    if (!race || (race.phase !== 'run' && race.phase !== 'countdown')) return;
    const n = Math.max(1, Math.min(tr.maxGiftCombo || 20, Math.floor(rawCount) || 1));
    const mine = race.entrants.get(user.id);
    let target;
    if (mine) {
      if (kind === 'hinder') { notice(`${user.name} 參賽者不能干擾別人`); return; }
      target = mine;
    } else {
      const id = raceLock.get(user.id); target = id && race.entrants.get(id);
      if (!target) { notice(`${user.name} 請先留言「@參賽者名字」再送禮`); return; }
    }
    if (target.state === 'done' || target.state === 'dnf') return;
    const list = kind === 'boost' ? target.boost : target.hinder;
    list.push({ until: race.t + (tr.effectSeconds || 10), delta: (kind === 'boost' ? tr.boostStep : tr.hinderStep) * n });
    fx({ type: kind === 'boost' ? 'raceBoost' : 'raceHinder', id: target.id, n });
    const tp = players.get(target.id);
    notice(`${user.name} 幫 ${tp ? tp.name : '參賽者'} ${kind === 'boost' ? '助力 🌹' : '干擾 😈'} ×${n}`);
  }
  // 這位參賽者現在每段結束「停下來休息」的機率
  function restChanceOf(e) {
    const sum = l => l.reduce((a, b) => a + (b.until > race.t ? b.delta : 0), 0);
    return Math.max(tr.chanceMin === undefined ? 0.05 : tr.chanceMin, Math.min(tr.chanceMax || 0.8, (tr.restChance === undefined ? 0.4 : tr.restChance) - sum(e.boost) + sum(e.hinder)));
  }
  function raceRanks() {
    const list = [...race.entrants.values()].filter(e => e.state !== 'dnf');
    list.sort((a, b) => (a.state === 'done' ? 0 : 1) - (b.state === 'done' ? 0 : 1) || (a.state === 'done' ? a.finishedAt - b.finishedAt : b.progress - a.progress));
    list.forEach((e, i) => { e.rank = i + 1; });
    return list;
  }
  function raceStartNow() {
    if (!race || race.phase !== 'signup') { notice('現在不是報名階段'); return; }
    if (race.entrants.size < (tr.minPlayers || 3)) { notice(`報名人數不足（${race.entrants.size}/${tr.minPlayers || 3}），還不能開跑`); return; }
    race.phase = 'countdown'; race.cd = tr.countdown || 3;
    notice(`報名截止！${race.entrants.size} 位選手準備起跑`);
    fx({ type: 'raceCountdown' });
  }
  function cancelRace(why) {
    if (!race) { notice('現在沒有比賽'); return; }
    notice(`比賽取消：${why}`);
    race = null; raceLock.clear(); mode = 'brawl';
    fx({ type: 'modeChange', mode });
  }
  function finishRace(timeout) {
    race.phase = 'result'; race.resLeft = tr.resultSeconds || 15;
    const ranks = raceRanks(), rewards = tr.rewards || [];
    race.results = ranks.slice(0, rewards.length).map((e, i) => ({ id: e.id, rank: i + 1, xp: rewards[i] }));
    for (const r of race.results) { const prof = scores.get(r.id); if (prof) grantXp(prof, r.xp); }
    fx({ type: 'raceResult' });
    notice(timeout ? '時間到！比賽結束' : '🏁 比賽結束！');
    race.results.forEach(r => { const p = players.get(r.id), prof = scores.get(r.id); notice(`第 ${r.rank} 名：${p ? p.name : (prof && prof.name) || '選手'}　+${r.xp} 經驗`); });
  }
  function raceTick(dt) {
    if (!race) return;
    if (race.phase === 'signup') {
      race.left -= dt;
      if (race.left <= 0) { if (race.entrants.size >= (tr.minPlayers || 3)) raceStartNow(); else cancelRace(`報名人數不足（${race.entrants.size}/${tr.minPlayers || 3}）`); }
      return;
    }
    if (race.phase === 'countdown') {
      race.cd -= dt;
      if (race.cd <= 0) { race.phase = 'run'; race.t = 0; for (const e of race.entrants.values()) e.state = 'run'; fx({ type: 'raceGo' }); notice('🏁 開跑！'); }
      return;
    }
    if (race.phase === 'result') { race.resLeft -= dt; if (race.resLeft <= 0) { race = null; raceLock.clear(); mode = 'brawl'; notice('🥊 回到亂鬥模式'); fx({ type: 'modeChange', mode }); } return; }
    race.t += dt;
    const hurdle = race.kind === 'hurdle';
    const segs = tr.segments || 8, base = hurdle ? 1 / hd.lapSeconds : 1 / (segs * (tr.segmentSeconds || 6));
    for (const e of race.entrants.values()) {
      if (e.state === 'done' || e.state === 'dnf') continue;
      if (e.state === 'rest') { e.restLeft -= dt; if (e.restLeft <= 0) { e.state = 'run'; fx({ type: 'raceResume', id: e.id }); } continue; }
      e.progress += base * e.speed * dt;
      if (hurdle && e.cp < hd.passChances.length && e.progress >= hurdlePos(e.cp)) {   // 障礙賽：跑到關卡，擲骰決定過不過；沒過就在關卡前摔倒停幾秒（之後直接繼續，不會再挑戰同一關）
        const idx = e.cp, pos = hurdlePos(idx), ch = passChanceOf(e, idx), ok = Math.random() < ch;
        e.cp++; e.speed = 1 + rr(-0.06, 0.06);
        if (ok) fx({ type: 'hurdlePass', id: e.id, idx, chance: ch });
        else { e.progress = pos; e.fails++; e.state = 'rest'; e.restLeft = rr(hd.stumbleMin, hd.stumbleMax); fx({ type: 'hurdleFail', id: e.id, idx, chance: ch }); continue; }
      }
      if (e.progress >= 1) { e.progress = 1; e.state = 'done'; e.finishedAt = race.t; fx({ type: 'raceFinish', id: e.id }); continue; }
      if (hurdle) continue;
      const seg = Math.floor(e.progress * segs);
      if (seg > e.seg) {   // 跑完一小段：擲骰決定要不要休息；每段速度也有一點點隨機，才不會永遠平手
        e.seg = seg; e.speed = 1 + rr(-0.06, 0.06);
        if (Math.random() < restChanceOf(e)) { e.state = 'rest'; e.restLeft = rr(tr.restMin || 1, tr.restMax || 3); fx({ type: 'raceRest', id: e.id }); }
      }
    }
    const alive = [...race.entrants.values()].filter(e => e.state !== 'dnf');
    if (!alive.length) { cancelRace('所有選手都棄權了'); return; }
    if (alive.every(e => e.state === 'done')) finishRace(false);
    else if (race.t >= (tr.maxSeconds || 300)) finishRace(true);
  }

  // ---------- 單挑賽 ----------
  // 流程見 config.duel 上面的說明。重點規則：
  //   ・申請階段還是亂鬥模式（畫面中間跳出申請）；接受後 mode 變 'duel'，雙方用「單挑血量」（config.duel.hp，一樣多）。
  //   ・只有亂鬥模式、沒有 BOSS 時能發起；雙方都要在場上而且活著。
  //   ・攻擊力看禮物的鑽石數；兩人都會自動小攻擊；怒氣滿了自動放技能；單挑中不能回血。
  //   ・單挑結束：贏的人加經驗（連勝加成）、輸的人扣經驗（可能掉等級）、打倒連勝者拿大量經驗；兩人恢復滿血，回亂鬥模式。
  const pairKey = (a, b) => [a, b].sort().join('|');
  const nameOfId = id => { const p = players.get(id), sc = scores.get(id); return p ? p.name : (sc && sc.name) || '觀眾'; };
  function throttle(key, sec) { if (time - (noticeAt.get(key) || -1e9) < sec) return false; noticeAt.set(key, time); return true; }
  // 「@乙 單挑」或「單挑 @乙」→ 回傳乙的名字（沒有符合回傳 null）
  function parseDuelInvite(text) {
    const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), tail = '[\\s!！~～。.]*$';
    for (const w of (config.commands.duel || [])) {
      const m = text.match(new RegExp('^[@＠]\\s*(.+?)\\s*' + esc(w) + tail)) || text.match(new RegExp('^' + esc(w) + '\\s*[@＠]\\s*(.+?)' + tail));
      if (m && m[1].trim()) return m[1].trim();
    }
    return null;
  }
  function sendDuelInvite(user, me, rest) {
    const nm = user.name;
    if (!dc.enabled) { if (throttle('duelOff', 20)) notice('單挑功能目前沒有開放'); return; }
    if (mode !== 'brawl') { if (throttle('duelMode:' + user.id, 8)) notice(`${nm} 現在不能發起單挑（${mode === 'duel' ? '單挑賽進行中' : mode === 'race' ? '比賽進行中' : '陣營賽進行中'}，只有亂鬥模式可以）`); return; }
    if (!me) { if (throttle('duelJoin:' + user.id, 8)) notice(`${nm} 請先留言武將名字上場，才能發起單挑`); return; }
    if (me.down) { notice(`${nm} 倒地中，不能發起單挑`); return; }
    if (duelInvite) { if (throttle('duelBusy', 8)) notice('目前已經有一個單挑申請在等回應，請稍候'); return; }
    if (players.has(BOSS_ID) || bossQueue.length) { if (throttle('duelBoss', 8)) notice(`${nm} BOSS 在場上（或排隊中），不能發起單挑`); return; }
    const wait = (duelCool.get(user.id) || 0) - time;
    if (wait > 0) { notice(`${nm} 剛發過單挑申請，還要 ${Math.ceil(wait)} 秒才能再發`); return; }
    if (me.name === rest || (plain(me.name) && plain(me.name) === plain(rest))) { notice(`${nm} 不能挑戰自己`); return; }
    const t = findLockTarget(me, rest);
    if (!t || t.isStruct) { notice(`${nm} 找不到「${rest.length > 10 ? rest.slice(0, 10) + '…' : rest}」`); return; }
    if (t.isBoss) { notice(`${nm} 不能向 BOSS 單挑`); return; }
    if (t === me) { notice(`${nm} 不能挑戰自己`); return; }
    if (t.down) { notice(`${nm} ${t.name} 倒地中，不能挑戰`); return; }
    const blk = (duelBlock.get(me.id + '|' + t.id) || 0) - time;
    if (blk > 0) { notice(`${nm} 剛被 ${t.name} 拒絕過，還要 ${Math.ceil(blk)} 秒才能再挑戰他`); return; }
    duelInvite = { from: me.id, to: t.id, left: dc.inviteSeconds || 60 };
    duelCool.set(me.id, time + (dc.inviteCooldown || 300));
    fx({ type: 'duelInvite', from: me.id, to: t.id });
    notice(`⚔ ${me.name} 向 ${t.name} 發出單挑申請！${t.name} 請在 ${dc.inviteSeconds || 60} 秒內送一朵玫瑰接受（送 GG 或不理＝拒絕）`);
  }
  function refuseDuel(why) {
    if (!duelInvite) return;
    const inv = duelInvite; duelInvite = null;
    duelBlock.set(inv.from + '|' + inv.to, time + (dc.refuseBlock || 600));
    fx({ type: 'duelInviteEnd' });
    notice(why || '單挑申請被拒絕了');
  }
  function acceptDuel() {
    if (!duelInvite) return;
    const inv = duelInvite, pa = players.get(inv.from), pb = players.get(inv.to);
    duelInvite = null; fx({ type: 'duelInviteEnd' });
    const cancel = why => notice(`單挑取消：${why}`);
    if (mode !== 'brawl') { cancel('現在不是亂鬥模式'); return; }
    if (!pa || !pb) { cancel('有人離場了'); return; }
    if (pa.down || pb.down) { cancel('有人倒地了'); return; }
    if (players.has(BOSS_ID) || bossQueue.length) { cancel('BOSS 出現了'); return; }
    mode = 'duel'; duelLock.clear(); raceLock.clear();
    for (const p of players.values()) p.lockId = null;
    for (const p of [pa, pb]) { p.maxHp = p.hp = dc.hp; p.down = false; }
    duel = { phase: 'countdown', a: pa.id, b: pb.id, cd: dc.countdown || 3, t: 0, rage: { a: 0, b: 0 }, nextAuto: { a: 0, b: 0 }, skillAt: { a: 0, b: 0 }, resLeft: 0, result: null };
    notice(`⚔ ${pb.name} 接受了挑戰！${pa.name} VS ${pb.name} 單挑開始`);
    fx({ type: 'modeChange', mode });
  }
  // 圍觀者留言「@甲」「@乙」：之後送禮就是幫那一邊助攻（打對面）
  function duelLockCmd(user, rest) {
    if (!rest || !duel || user.id === duel.a || user.id === duel.b) return;
    const dummy = players.get(user.id) || { id: user.id };
    const t = findLockTarget(dummy, rest);
    if (t && (t.id === duel.a || t.id === duel.b)) { duelLock.set(user.id, t.id); notice(`${user.name} 選擇幫 ${t.name} 助攻`); }
    else notice(`${user.name} 只能幫單挑的兩位選手助攻（找不到「${rest.length > 10 ? rest.slice(0, 10) + '…' : rest}」）`);
  }
  // 一次攻擊：from 打 to，扣血、被打的一方加怒氣、通知畫面
  function duelStrike(side, dmg, kind, rageGain) {
    if (!duel || duel.phase !== 'fight') return;
    const other = side === 'a' ? 'b' : 'a', pf = players.get(duel[side]), pt = players.get(duel[other]);
    if (!pf || !pt) return;
    dmg = Math.min(pt.hp, Math.max(1, Math.round(dmg)));
    pt.hp -= dmg;
    duel.rage[side] = Math.min(dc.rageMax, duel.rage[side] + (rageGain || 0));
    duel.rage[other] = Math.min(dc.rageMax, duel.rage[other] + dmg / pt.maxHp * dc.rageHit);   // 被打也加怒氣：落後的人比較有機會翻盤
    fx({ type: 'attack', id: pf.id, action: kind === 'skill' ? 'skill' : 'attack', icon: '', skillName: pf.hero.skillName, hits: [{ id: pt.id, dmg, down: false }] });
    if (pt.hp <= 0) finishDuel(pf.id, `${pf.name} 把 ${pt.name} 打倒了`);
  }
  // 一份禮物：選手自己送 → 打對手；圍觀者要先 @ 選手 → 幫那一邊打（打折）
  function duelGift(user, diamonds, rawCount) {
    if (!duel || duel.phase !== 'fight') return;
    const d = Math.max(1, Number(diamonds) || 1), n = Math.max(1, Math.min(dc.maxGiftCombo || 20, Math.floor(rawCount) || 1));
    let side = user.id === duel.a ? 'a' : user.id === duel.b ? 'b' : null, factor = 1;
    if (!side) {
      const sid = duelLock.get(user.id); side = sid === duel.a ? 'a' : sid === duel.b ? 'b' : null;
      if (!side) { if (throttle('duelNoLock:' + user.id, 15)) notice(`${user.name} 請先留言「@${nameOfId(duel.a)}」或「@${nameOfId(duel.b)}」，再送禮幫他助攻`); return; }
      factor = dc.audienceFactor === undefined ? 0.5 : dc.audienceFactor;
    }
    const pow = Math.pow(d, dc.giftExp === undefined ? 0.5 : dc.giftExp), maxHp = dc.hp;
    const dmg = Math.min(maxHp * (dc.giftCapPercent || 0.35), dc.giftBase * pow * n) * factor;
    if (factor < 1 && d >= (dc.supportNoticeMin || 20)) notice(`${user.name} 幫 ${nameOfId(duel[side])} 助攻！`);
    duelStrike(side, dmg, 'attack', dc.rageGift * pow * n * factor);
  }
  // 結果：winnerId 贏；null ＝ 和局
  function finishDuel(winnerId, why) {
    if (!duel || duel.phase === 'result') return;
    const pa = players.get(duel.a), pb = players.get(duel.b);
    // 先把血量復原（升降級要用正常的最大血量算）
    for (const p of [pa, pb]) if (p) { p.maxHp = stats(p).maxHp; p.hp = p.maxHp; }
    const res = { winnerId, loserId: null, draw: !winnerId, why: why || '', winXp: 0, loseXp: 0, streak: 0, broke: 0, levelDown: false };
    if (winnerId) {
      const loserId = winnerId === duel.a ? duel.b : duel.a, wp = scores.get(winnerId), lp = scores.get(loserId);
      res.loserId = loserId;
      if (wp && lp) applyDuelXp(wp, lp, res);
    }
    duel.phase = 'result'; duel.resLeft = dc.resultSeconds || 15; duel.result = res;
    const loser = res.loserId && players.get(res.loserId);
    if (loser) { loser.down = true; loser.downAt = time; loser.hp = 0; }   // 輸的人躺下（只是演出；結果顯示完就恢復，不套用倒地冷卻）
    fx({ type: 'duelEnd', winner: winnerId, draw: res.draw });
    notice(res.draw ? '⚔ 單挑時間到，雙方平手！' : `🏆 ${nameOfId(winnerId)} 單挑獲勝！`);
    if (why && !res.draw) notice(why);
  }
  // 贏的人加經驗（連勝加成、打倒連勝者獎勵、等級差折扣、同一對人反覆單挑折扣）；輸的人扣經驗（可能掉等級）
  function applyDuelXp(w, l, res) {
    const x = dc.xp || {}, g = config.leveling;
    const ws = (w.streak || 0) + 1, ls = l.streak || 0;
    const streakMult = Math.min(1 + (x.streakStep || 0) * (ws - 1), x.streakMaxMult || 3);
    const brk = ls >= (x.breakMinStreak || 2) ? Math.min(x.breakMax || 2000, (x.breakPerStreak || 0) * ls) : 0;
    const gap = w.level - l.level, over = Math.max(0, gap - (g.levelGapFree || 0));
    const gapF = Math.max(g.levelGapMinFactor === undefined ? 0.1 : g.levelGapMinFactor, 1 - over * (g.levelGapPenalty || 0));
    const key = pairKey(w.id, l.id), win = x.pairWindow || 600, log = (duelPairLog.get(key) || []).filter(t => time - t < win);
    const pairF = Math.max(x.pairMinFactor === undefined ? 0.1 : x.pairMinFactor, 1 - log.length * (x.pairPenalty || 0)); log.push(time); duelPairLog.set(key, log);
    res.winXp = Math.max(1, Math.round(((x.winBase || 0) + (x.winPerLevel || 0) * l.level) * streakMult * gapF * pairF + brk * gapF * pairF));
    res.streak = ws; res.broke = brk > 0 ? ls : 0;
    res.loseXp = Math.max(1, Math.round(((x.loseBase || 0) + (x.losePerLevel || 0) * l.level) * (1 + Math.min(x.loserStreakExtraMax || 1, (x.loserStreakExtra || 0) * ls))));
    w.streak = ws; l.streak = 0;
    w.adj = l.adj = Date.now();   // 輸家的經驗是「扣」的，雲端合併時不能被舊的高等級蓋回去：標上調整時間，以這次為準（贏家一起標，連勝數才會一起存）
    grantXp(w, res.winXp);
    const before = l.level;
    l.xp -= res.loseXp;
    while (l.xp < 0 && l.level > 1) { l.level--; l.xp += xpNeed(l.level); }
    if (l.xp < 0) l.xp = 0;
    if (l.level < before) {
      res.levelDown = true;
      const lp = players.get(l.id); if (lp) { lp.maxHp = stats(lp).maxHp; }
      fx({ type: 'leveldown', id: l.id, level: l.level });
      notice(`${l.name || '觀眾'} 掉到 Lv.${l.level}…`);
    }
    notice(`${w.name} +${res.winXp} 經驗（${ws} 連勝${res.broke ? `，打倒 ${res.broke} 連勝！` : ''}）　${l.name} −${res.loseXp} 經驗`);
  }
  // 單挑結束（或被取消）：兩人恢復滿血、站起來，回亂鬥模式
  function endDuelMode(msg) {
    if (!duel) return;
    for (const id of [duel.a, duel.b]) { const p = players.get(id); if (p) { p.maxHp = stats(p).maxHp; p.hp = p.maxHp; p.down = false; p.deaths = 0; } }
    duel = null; duelLock.clear(); mode = 'brawl';
    notice(msg || '🥊 回到亂鬥模式');
    fx({ type: 'modeChange', mode });
  }
  function cancelDuel(why) {
    if (duelInvite) { duelInvite = null; fx({ type: 'duelInviteEnd' }); notice(`單挑申請取消：${why}`); return; }
    if (!duel) { notice('現在沒有單挑'); return; }
    notice(`單挑取消：${why}`);
    endDuelMode();
  }
  function duelInviteTick(dt) {
    if (!duelInvite) return;
    const pa = players.get(duelInvite.from), pb = players.get(duelInvite.to);
    if (!pa || !pb || pa.down || pb.down) { duelInvite = null; fx({ type: 'duelInviteEnd' }); notice('單挑申請取消：有人離場或倒地了'); return; }
    if (players.has(BOSS_ID)) { duelInvite = null; fx({ type: 'duelInviteEnd' }); notice('單挑申請取消：BOSS 出現了'); return; }
    if ((duelInvite.left -= dt) <= 0) refuseDuel(`${pb.name} 沒有回應，單挑申請視為拒絕`);
  }
  function duelTick(dt) {
    if (!duel) return;
    if (duel.phase === 'result') { if ((duel.resLeft -= dt) <= 0) endDuelMode(); return; }
    const pa = players.get(duel.a), pb = players.get(duel.b);
    if (!pa || !pb) { if (pa || pb) finishDuel(pa ? duel.a : duel.b, '對手離場了'); else { duel = null; mode = 'brawl'; fx({ type: 'modeChange', mode }); } return; }
    if (duel.phase === 'countdown') {
      duel.cd -= dt;
      if (duel.cd <= 0) { duel.phase = 'fight'; duel.t = 0; duel.nextAuto = { a: time + 1, b: time + 1 + (dc.autoAtkEvery || 4) / 2 }; fx({ type: 'duelGo' }); notice('⚔ 開打！'); }
      return;
    }
    duel.t += dt;
    for (const side of ['a', 'b']) {   // 自動小攻擊（沒送禮的人也有動作）；怒氣滿了、技能冷卻好了就自動放技能
      if (!duel || duel.phase !== 'fight') return;
      if (time >= duel.nextAuto[side]) {
        duel.nextAuto[side] = time + (dc.autoAtkEvery || 4);
        duelStrike(side, (dc.autoAtkDmg || 30) * (1 + (Math.random() * 2 - 1) * config.damageVariance), 'attack', dc.autoRage || 0);
      }
      if (duel && duel.phase === 'fight' && duel.rage[side] >= dc.rageMax && time >= duel.skillAt[side]) {
        duel.rage[side] = 0; duel.skillAt[side] = time + (dc.skillCooldown || 3);
        duelStrike(side, dc.skillDmg, 'skill', 0);
      }
    }
    if (duel && duel.phase === 'fight' && duel.t >= (dc.maxSeconds || 180)) {   // 時間到：比剩餘血量，一樣多＝和局
      const d = pa.hp - pb.hp;
      finishDuel(Math.abs(d) < 1 ? null : d > 0 ? duel.a : duel.b, Math.abs(d) < 1 ? '' : '時間到，比剩餘血量');
    }
  }

  const gameApi = {
    setHeroPool,
    setHostMatcher(fn, isHost) { hostMatch = fn; hostCheck = isHost || null; },
    hostPress(user, hostGift) { if (user && user.id && hostGift) runHostGift(user, hostGift); },   // 面板的主播按鈕
    setNextRaceTrack(id) { nextTrackId = id; },   // 測試用：指定下一場賽道
    setDefaultHero(id) { defaultHeroId = heroById.has(id) ? id : ''; },
    onFx(fn) { fxListeners.push(fn); },
    handleEvent(ev) {
      // 任何留言或送禮都算「有動作」，用來判斷這位觀眾還在不在
      const me = ev.user && players.get(ev.user.id);
      if (me) me.lastActive = time;
      if (ev.type === 'chat') {
        // 主播的文字指令：主播本人留言設定好的字 = 送那個動作的禮物（不走一般留言處理）
        const hostGift = hostMatch && hostMatch(ev.user, ev.text);
        if (hostGift) { runHostGift(ev.user, hostGift); return; }
        if (hostCheck && hostCheck(ev.user) && (config.commands.raceOpen || []).some(c => plain(c) === plain(ev.text))) { openRace(); return; }
        if (hostCheck && hostCheck(ev.user) && (config.commands.hurdleOpen || []).some(c => plain(c) === plain(ev.text))) { openRace('hurdle'); return; }   // 主播留言「開放障礙賽」   // 主播留言「開放報名」
        if (hostCheck && hostCheck(ev.user) && hostLevelCommand(ev.text)) return;   // 主播留言「等級 名字 30」：調整等級
        handleChat(ev.user, ev.text);
      }
      else if (ev.type === 'gift') {
        if (ev.tiktokGift && ev.tiktokGift === duelSkipGift) { duelSkipGift = null; return; }   // 這份禮物剛被當成「回應單挑」，不要同時當普攻
        if (mode === 'duel' && ev.tiktokGift) return;                                          // 單挑中：真的 TikTok 禮物改用鑽石數算（見下面 tiktokGift）
        handleGift(ev.user, ev.giftId, ev.count);
      }
      else if (ev.type === 'tiktokGift' && duelInvite && ev.user.id === duelInvite.to) {   // 被挑戰的人送禮：玫瑰＝接受、GG＝拒絕，其他禮物不算回應
        const nm = plain((ev.gift && ev.gift.name) || ''), gn = dc.giftNames || {};
        if ((gn.accept || []).some(n => plain(n) === nm)) { duelSkipGift = ev.gift; acceptDuel(); }
        else if ((gn.refuse || []).some(n => plain(n) === nm)) { duelSkipGift = ev.gift; refuseDuel(`${nameOfId(ev.user.id)} 送 GG 拒絕了單挑`); }
      }
      else if (ev.type === 'tiktokGift' && mode === 'duel') duelGift(ev.user, (ev.gift && ev.gift.diamonds) || 1, ev.count || 1);
      else if (ev.type === 'tiktokGift' && mode === 'race') {   // 賽跑：用禮物名稱判斷是助力還是干擾
        const nm = plain((ev.gift && ev.gift.name) || ''), gn = tr.giftNames || {};
        const kind = (gn.boost || []).some(n => plain(n) === nm) ? 'boost' : (gn.hinder || []).some(n => plain(n) === nm) ? 'hinder' : null;
        if (kind) raceGift(ev.user, kind, ev.count || 1);
      }
    },
    // 每一格畫面呼叫一次，dt = 經過的秒數
    update(dt) {
      time += dt;
      if (mode === 'team') teamTick(dt);
      if (mode === 'race') raceTick(dt);
      if (mode === 'duel') duelTick(dt); else duelInviteTick(dt);
      for (const p of [...players.values()]) {
        if (p.isBoss) { bossUpdate(p); continue; }
        tickBuffs(p, dt);
        if (p.down && time - p.downAt >= config.removeDownedAfterSeconds) {
          players.delete(p.id);
          notice(`${p.name} 倒地太久，離場了`);
        } else if (time - p.lastActive >= config.idleRemoveSeconds && !(race && race.entrants.has(p.id))) {
          players.delete(p.id);   // 太久沒留言也沒送禮：當作已經離開直播間，把位置讓出來（等級和傷害紀錄保留）
          notice(`${p.name} 太久沒動作，離場了`);
        }
      }
    },
    // 清空場上。keepProgress = true 時保留每位觀眾的等級、經驗值、擊倒數（只把場上武將和傷害排行榜清掉）
    reset(keepProgress) {
      players.clear(); left.clear(); killLog.clear(); bossQueue.length = 0; time = 0;
      duelInvite = null; duelLock.clear(); duelCool.clear(); duelBlock.clear(); duelPairLog.clear(); noticeAt.clear(); if (duel) { duel = null; mode = 'brawl'; }
      teamOf.clear(); swaps.clear(); match = { winner: null, restartAt: 0, time: 0 }; if (mode === 'team') initStructs();
      scores.forEach(s => { s.buffs = null; });   // 遊戲時間歸零，BUFF 也一併清掉
      if (keepProgress) scores.forEach(s => { s.damage = 0; }); else scores.clear();
    },
    // 存檔用：交出每位觀眾目前的進度
    exportProfiles() { return [...scores.values()].map(s => ({ id: s.id, name: s.name, level: s.level, xp: s.xp, kills: s.kills, adj: s.adj || 0, streak: s.streak || 0 })); },
    // 讀檔用：把之前存的進度放回來（傷害從 0 開始，所以不會出現在排行榜上，要重新上場才算）
    // merge = true（接上雲端存檔時用）：跟目前已有的進度合併，每位觀眾取比較高的那份，
    //   而且直接改現有的紀錄（場上正在打的武將也會立刻吃到新等級）；不是整個換掉。
    importProfiles(list, merge) {
      const max = config.leveling.maxLevel;
      for (const p of list || []) {
        if (!p || !p.id) continue;
        const level = Math.max(1, Math.min(max, Math.floor(p.level) || 1));
        const xp = level >= max ? 0 : Math.max(0, Math.floor(p.xp) || 0), kills = Math.max(0, Math.floor(p.kills) || 0);
        const cur = scores.get(p.id), adj = Math.floor(Number(p.adj)) || 0;
        if (!cur || !merge) {
          scores.set(p.id, { id: p.id, name: p.name || '', heroName: '', damage: 0, kills, level, xp, adj, streak: Math.max(0, Math.floor(Number(p.streak)) || 0) });
          continue;
        }
        if (adj !== (cur.adj || 0)) {   // 有一方是主播手動調整過的：最後一次調整的算數（可以調低）
          if (adj > (cur.adj || 0)) {
            const leveled = level !== cur.level;
            cur.level = level; cur.xp = xp; cur.adj = adj; cur.streak = Math.max(0, Math.floor(Number(p.streak)) || 0);
            const onStage = players.get(p.id);
            if (leveled && onStage) refreshHp(onStage);
          }
          cur.kills = Math.max(cur.kills, kills);
          if (!cur.name && p.name) cur.name = p.name;
          continue;
        }
        if (level > cur.level || (level === cur.level && xp > cur.xp)) {
          const leveled = level !== cur.level;
          cur.level = level; cur.xp = xp; cur.streak = Math.max(0, Math.floor(Number(p.streak)) || 0);
          const onStage = players.get(p.id);
          if (leveled && onStage) refreshHp(onStage);
        }
        cur.kills = Math.max(cur.kills, kills);
        if (!cur.name && p.name) cur.name = p.name;
      }
    },
    announce(text) { notice(text); },
    // 主播調整某位觀眾的等級（1～上限）。經驗值歸零；調低也算數（標記 adj，合併雲端時以最後一次調整為準）。回傳 { name, level } 或 null
    setLevel(id, level) {
      const s = scores.get(id);
      if (!s) return null;
      const lv = Math.max(1, Math.min(config.leveling.maxLevel, Math.floor(Number(level)) || 1));
      s.level = lv; s.xp = 0; s.adj = Date.now();
      const p = players.get(id);
      if (p && !p.isBoss) refreshHp(p);
      fx({ type: 'levelSet', id, level: lv });
      notice(`${s.name || '觀眾'} 的等級被主播調整為 Lv.${lv}`);
      return { name: s.name || '', level: lv };
    },
    // 用名字找觀眾（含已下場、沒在場上的）：完全一樣 → 去符號後一樣 → 開頭一樣 → 包含。找不到回傳 null
    findProfile(text) {
      const r = plain(text);
      if (!r) return null;
      const all = [...scores.values()].filter(s => s.name);
      const step = [s => s.name === String(text).trim(), s => plain(s.name) === r, s => plain(s.name).startsWith(r), s => plain(s.name).includes(r)];
      for (const f of step) { const hit = all.filter(f); if (hit.length) return hit.sort((a, b) => plain(a.name).length - plain(b.name).length)[0]; }
      return null;
    },
    getPlayers() { return [...players.values()]; },
    // 自動更新網頁前把場上的武將記下來、更新後放回去（只有一般武將，BOSS 不存）
    exportRoster() { return [...players.values()].filter(p => !p.isBoss).map(p => ({ id: p.id, name: p.name, heroId: p.hero.heroId, hp: p.maxHp ? p.hp / p.maxHp : 1, down: !!p.down })); },
    restoreRoster(list) {
      let n = 0;
      for (const r of list || []) {
        const hero = heroById.get(r.heroId);
        if (!hero || players.has(r.id)) continue;
        const p = joinHero({ id: r.id, name: r.name }, hero, true);
        if (!p) continue;
        p.hp = Math.max(1, Math.round(p.maxHp * Math.min(1, Math.max(0, Number(r.hp) || 1))));
        if (r.down) { p.down = true; p.hp = 0; p.downAt = time; }
        n++;
      }
      return n;
    },
    // BOSS 相關（畫面和面板用）
    getBoss() {
      const b = players.get(BOSS_ID);
      return b ? { name: b.name, level: b.def.level, hp: b.hp, maxHp: b.maxHp, down: b.down, summoner: b.summoner,
        attackIn: Math.max(0, b.nextAttackAt - time), aoeIn: Math.max(0, b.nextAoeAt - time) } : null;
    },
    // 某位玩家身上的 BUFF：還剩幾秒（沒有就是 0）
    getBuffs(id) {
      const s = scores.get(id), b = s && s.buffs;
      if (!b) return { regen: 0, atk: 0 };
      return { regen: b.regen && b.regen.until > time ? b.regen.until - time : 0, atk: b.atk && b.atk.until > time ? b.atk.until - time : 0 };
    },
    getBossQueue() { return bossQueue.map(e => ({ name: e.def.displayName, level: e.def.level, by: e.by })); },
    bossHeroes() { return (bossCfg.list || []).map(bossHero); },
    // 測試用：把 BOSS 血量直接設成某個比例（測試尾刀獎勵）／把 BOSS 和排隊全部清掉
    debugBossHp(ratio) { const b = players.get(BOSS_ID); if (b && !b.down) b.hp = Math.max(1, Math.round(b.maxHp * ratio)); },
    clearBosses() { bossQueue.length = 0; if (players.has(BOSS_ID)) { players.delete(BOSS_ID); fx({ type: 'bossGone', id: BOSS_ID }); } },
    // ---------- 陣營模式 API ----------
    getMode() { return mode; },
    // 賽跑：畫面和面板用。沒在賽跑回傳 null
    getRace() {
      if (mode !== 'race' || !race) return null;
      const ranks = race.phase === 'signup' ? [] : raceRanks();
      const trk = [...(tr.tracks || []), ...(tr.hurdleTracks || [])].find(t => t.id === race.track) || {};
      return { kind: race.kind || 'normal', hurdles: race.kind === 'hurdle' ? hd.passChances.map((c, i) => ({ pos: hurdlePos(i), chance: c, icon: (hd.obstacles[i] || {}).icon || '🚧', name: (hd.obstacles[i] || {}).name || '關卡' })) : [], track: race.track || 'oval', trackName: trk.name || '', phase: race.phase, left: Math.max(0, race.left), cd: Math.max(0, race.cd), t: race.t, timeLeft: Math.max(0, (tr.maxSeconds || 300) - race.t), resLeft: Math.max(0, race.resLeft),
        count: race.entrants.size, max: tr.maxPlayers || 8, min: tr.minPlayers || 3, results: race.results, ranks: ranks.map(e => e.id),
        entrants: [...race.entrants.values()].map(e => ({ id: e.id, cp: e.cp, fails: e.fails, lane: e.lane, progress: e.progress, state: e.state, rank: e.rank,
          boost: e.boost.reduce((a, b) => a + (b.until > race.t ? b.delta : 0), 0), hinder: e.hinder.reduce((a, b) => a + (b.until > race.t ? b.delta : 0), 0) })) };
    },
    // 單挑賽：畫面和面板用
    getDuelInvite() {
      if (!duelInvite) return null;
      return { from: duelInvite.from, to: duelInvite.to, fromName: nameOfId(duelInvite.from), toName: nameOfId(duelInvite.to), left: Math.max(0, duelInvite.left), total: dc.inviteSeconds || 60 };
    },
    getDuel() {
      if (!duel) return null;
      const side = k => { const p = players.get(duel[k]), sc = scores.get(duel[k]) || {}; return { id: duel[k], name: nameOfId(duel[k]), hp: p ? Math.max(0, p.hp) : 0, maxHp: p ? p.maxHp : dc.hp, rage: duel.rage[k], rageMax: dc.rageMax, streak: sc.streak || 0, level: sc.level || 1 }; };
      const r = duel.result;
      return { phase: duel.phase, a: side('a'), b: side('b'), cd: Math.max(0, duel.cd), t: duel.t, timeLeft: Math.max(0, (dc.maxSeconds || 180) - duel.t), resLeft: Math.max(0, duel.resLeft),
        result: r ? { winnerId: r.winnerId, loserId: r.loserId, draw: r.draw, why: r.why, winXp: r.winXp, loseXp: r.loseXp, streak: r.streak, broke: r.broke, levelDown: r.levelDown, winnerName: r.winnerId ? nameOfId(r.winnerId) : '', loserName: r.loserId ? nameOfId(r.loserId) : '' } : null };
    },
    duelBusy() { return !!duelInvite || mode === 'duel'; },
    raceBusy() { return mode === 'race' && !!race && (race.phase === 'countdown' || race.phase === 'run'); },
    raceGift(user, kind, count) { raceGift(user, kind, count); },
    setMode(m) {
      if (m === 'race') { openRace(); return; }
      if (duelInvite) { duelInvite = null; fx({ type: 'duelInviteEnd' }); notice('切換模式，單挑申請取消'); }
      if (mode === 'duel') { cancelDuel('主播切換了模式'); if (m === 'brawl') return; }
      if (m === 'hurdle') { openRace('hurdle'); return; }
      if (m === mode) { notice(m === 'team' ? '已經是陣營模式了' : '已經是亂鬥模式了'); return; }
      race = null; raceLock.clear();
      mode = m === 'team' ? 'team' : 'brawl';
      teamOf.clear(); swaps.clear(); match = { winner: null, restartAt: 0, time: 0 };
      if (mode === 'team') {
        initStructs();
        const list = [...players.values()].filter(o => !o.isBoss).sort(() => Math.random() - 0.5);
        for (const p of list) { p.deaths = 0; p.reviveAfter = 0; p.lockId = null; autoAssign(p.id); }
        notice('⚔ 切換成陣營模式！留言「加入紅隊／加入藍隊」選隊（可換 3 次）');
      } else {
        structs.clear();
        for (const p of players.values()) p.lockId = null;
        notice('🥊 切換回亂鬥模式');
      }
      fx({ type: 'modeChange', mode });
    },
    restartMatch() { if (mode === 'team') restartMatch(true); },
    getStructs() { return [...structs.values()]; },
    teamOf(id) { const t = teamOf.get(id); return t ? t.team : null; },
    teamInfo() {
      if (mode !== 'team') return null;
      const left = tc.matchSeconds ? Math.max(0, tc.matchSeconds - match.time) : 0;
      return { red: teamCount('red'), blue: teamCount('blue'), winner: match.winner, restartIn: match.winner ? Math.max(0, match.restartAt - time) : 0, left,
        baseState: t => { const b = structs.get('base_' + t), tw = structs.get('tower_' + t); return b && b.down ? 'down' : baseOpen(t) ? 'open' : tw && !tw.down ? 'tower' : 'guarded'; } };
    },
    exportMode() {
      return mode !== 'team' ? null : { mode, teams: [...teamOf].map(([id, t]) => [id, t.team, t.chosen ? 1 : 0]), swaps: [...swaps], match: { winner: match.winner, time: match.time },
        structs: [...structs.values()].map(s => ({ id: s.id, hp: s.hp, down: s.down })) };
    },
    importMode(m) {
      if (!m || m.mode !== 'team') return;
      if (mode !== 'team') { mode = 'team'; initStructs(); }
      for (const [id, team, chosen] of m.teams || []) if (players.has(id) && (team === 'red' || team === 'blue')) teamOf.set(id, { team, chosen: !!chosen });
      for (const pl of players.values()) if (!pl.isBoss && !teamOf.has(pl.id)) autoAssign(pl.id);
      for (const [id, n] of m.swaps || []) swaps.set(id, n);
      for (const r of m.structs || []) { const s = structs.get(r.id); if (s) { s.hp = Math.max(0, Math.min(s.maxHp, Number(r.hp) || 0)); s.down = !!r.down || s.hp <= 0; } }
      if (m.match) { match.time = Number(m.match.time) || 0; }
    },
    getPlayer(id) { return players.get(id) || structs.get(id); },
    reviveRemaining,
    stats,
    xpNeed,
    // 對 BOSS 的傷害排行榜：場上有 BOSS 才有（沒有就回 null）；只算這一隻 BOSS 的傷害，打完下一隻重新算
    getBossLeaderboard() {
      const b = players.get(BOSS_ID);
      if (!b) return null;
      const rows = [...b.hits.entries()].map(([id, damage]) => { const s = scores.get(id) || {}; return { id, name: s.name || '', level: s.level || 1, heroName: s.heroName || '', damage }; })
        .sort((x, y) => y.damage - x.damage).slice(0, config.leaderboardSize);
      return { name: b.name, rows };
    },
    getLeaderboard() {
      return [...scores.values()].filter(s => s.damage > 0)
        .sort((a, b) => b.damage - a.damage).slice(0, config.leaderboardSize);
    },
  };
  return gameApi;
};
