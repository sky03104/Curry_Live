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

  // 留言比對用：武將中文名與別名 → 武將資料（名字長的先比，避免短名搶先）
  const heroById = new Map(heroes.map(h => [h.heroId, h]));
  const nameTable = heroes.map(h => [h.displayName, h]);
  for (const [alias, id] of Object.entries(config.heroAliases || {})) {
    if (heroById.has(id)) nameTable.push([alias, heroById.get(id)]);
  }
  nameTable.sort((a, b) => b[0].length - a[0].length);

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
    if (p.isBoss) return { maxHp: p.maxHp, atk: p.def.atk, def: p.def.def };
    const g = config.leveling, up = p.prof.level - 1;
    return {
      maxHp: Math.round(p.hero.baseHp * config.hpMultiplier * (1 + g.hpPerLevel * up)),
      atk: p.hero.baseAtk * (1 + g.atkPerLevel * up),
      def: p.hero.baseArmor * (1 + g.defPerLevel * up),
    };
  }
  // 升到下一級需要多少經驗值
  function xpNeed(level) { return config.leveling.xpNeedBase + config.leveling.xpNeedPerLevel * level; }
  // 等級或武將變了之後重算最大血量；目前血量照比例帶過去（不會因此補血）
  function refreshHp(p) {
    const ratio = p.maxHp ? p.hp / p.maxHp : 1;
    p.maxHp = stats(p).maxHp;
    p.hp = p.down ? 0 : Math.max(1, Math.round(p.maxHp * ratio));
  }
  // 擊倒對手拿經驗值：對手等級越高拿越多；滿了就升級（一次可以連升好幾級）
  function gainKillXp(p, victim) {
    const g = config.leveling;
    grantXp(p.prof, g.xpPerKillBase + g.xpPerKillPerVictimLevel * victim.prof.level);
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
    const steps = [
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
  function isLeaveCommand(text) {
    const t = plain(text);
    return !!t && (config.commands.leave || []).some(c => plain(c) === t);
  }
  function leave(me) {
    players.delete(me.id);
    left.set(me.id, time);
    fx({ type: 'leave', id: me.id, hero: me.hero, name: me.name });
    notice(`${me.name} 烙跑了！`);
  }

  function handleChat(user, rawText) {
    const text = rawText.trim();
    const me = players.get(user.id);

    if (isLeaveCommand(text)) { if (me) leave(me); return; }

    if (config.commands.unlock.includes(text)) {
      if (me && me.lockId) { me.lockId = null; notice(`${me.name} 解除鎖定`); }
      return;
    }

    if (text.startsWith(config.commands.lockPrefix) || text.startsWith('＠')) {   // 半形 @ 和全形 ＠ 都認
      if (!me) return;
      const rest = text.slice(1).trim();
      if (!rest) return;
      const target = findLockTarget(me, rest);
      if (target) { me.lockId = target.id; notice(`${me.name} 鎖定了 ${target.name}`); }
      else notice(`${me.name} 找不到「${rest.length > 10 ? rest.slice(0, 10) + '…' : rest}」`);
      return;
    }

    const hit = nameTable.find(([name]) => text.includes(name));
    if (!hit) return;   // 沒提到武將
    if (me) { switchHero(me, text, hit[1]); return; }
    const wait = (config.leaveRejoinSeconds || 0) - (time - (left.has(user.id) ? left.get(user.id) : -1e9));
    if (wait > 0) { notice(`${user.name} 剛烙跑，還要 ${Math.ceil(wait)} 秒才能再上場`); return; }
    if ([...players.values()].filter(o => !o.isBoss).length >= config.maxOnStage) { notice(`場上已滿，${user.name} 請稍候`); return; }
    const hero = hit[1];
    if (!scores.has(user.id)) scores.set(user.id, { id: user.id, damage: 0, kills: 0, level: 1, xp: 0 });
    const prof = Object.assign(scores.get(user.id), { name: user.name, heroName: hero.displayName });
    const p = { id: user.id, name: user.name, hero, prof, maxHp: 0, hp: 0, down: false, downAt: 0, lockId: null, lastActive: time };
    p.maxHp = p.hp = stats(p).maxHp;
    players.set(user.id, p);
    fx({ type: 'join', id: p.id });
    notice(p.prof.level > 1 ? `${p.name} 的 ${hero.displayName}（Lv.${p.prof.level}）上場！` : `${p.name} 的 ${hero.displayName} 上場！`);
  }

  // ---------- 換武將 ----------
  // 已在場上的觀眾可以換武將，血量照比例帶過去（剩三成血，換過去也是三成），所以不能靠換角補血。
  // 留言必須「剛好只有武將名」才算換角，避免聊天時提到別的武將（例如「呂布好強」）就被誤換。
  function switchHero(me, text, hero) {
    if (text !== hit_name(text) || hero === me.hero) return;
    if (time < (me.switchReadyAt || 0)) { notice(`${me.name} 剛換過武將，請稍等`); return; }
    me.hero = hero;
    refreshHp(me);
    me.switchReadyAt = time + config.switchCooldownSeconds;
    me.prof.heroName = hero.displayName;
    fx({ type: 'switch', id: me.id });
    notice(`${me.name} 換成了 ${hero.displayName}`);
  }
  // 這段留言如果剛好等於某個武將名（或別名）就回傳它，否則回傳 null
  function hit_name(text) { const m = nameTable.find(([name]) => name === text); return m ? m[0] : null; }

  // ---------- 送禮 ----------
  function handleGift(user, giftId, rawCount) {
    const gift = config.gifts.find(g => g.id === giftId);
    if (!gift) return;
    // 招換 BOSS：不用先上場（這是花大錢的禮物，不該因為沒上場就白送）
    const summonId = (config.actions[gift.action] || {}).summon;
    if (summonId) {
      const n = Math.max(1, Math.min(bossCfg.maxSummonPerGift || 1, Math.floor(rawCount) || 1));
      for (let i = 0; i < n; i++) summonBoss(user, summonId);
      return;
    }
    const me = players.get(user.id);
    if (!me) { notice(`${user.name} 請先留言武將名字上場`); return; }
    const count = Math.max(1, Math.min(config.maxGiftCombo, Math.floor(rawCount) || 1));

    if (me.down) {
      const wait = reviveRemaining(me);
      if (wait > 0) { notice(`${me.name} 倒地中，還要 ${Math.ceil(wait)} 秒才能復活`); return; }
      me.down = false; me.hp = me.maxHp;
      fx({ type: 'revive', id: me.id });
      notice(`${me.name} 的 ${me.hero.displayName} 滿血復活！`);
      return;
    }

    const action = config.actions[gift.action];
    if (gift.action === 'heal') {
      // 先用「@名字」鎖定了另一位玩家（還活著、血沒滿）→ 這份回血補給他；否則補自己
      const ally = players.get(me.lockId);
      const target = ally && ally !== me && !ally.isBoss && !ally.down && ally.hp < ally.maxHp ? ally : me;
      const amount = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * action.healPercent * count));
      target.hp += amount;
      fx({ type: 'heal', id: target.id, amount, icon: gift.icon });
      if (target !== me) notice(`${me.name} 幫 ${target.name} 補血 +${amount}`);
      return;
    }

    let targets;
    if (gift.action === 'aoe') {
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
      if (t.hp <= 0) { t.down = true; t.downAt = time; me.prof.kills++; if (t.isBoss) t.lastHitId = me.id; downed.push(t); }
      return { id: t.id, dmg, down: t.down };
    });
    fx({ type: 'attack', id: me.id, action: gift.action, icon: gift.icon, skillName: me.hero.skillName, hits });
    downed.forEach(t => { if (t.isBoss) bossDefeated(t, me); else { notice(`${me.name} 擊倒了 ${t.name}！`); gainKillXp(me, t); } });
  }

  // ---------- BOSS ----------
  // 招換：場上沒有 BOSS 就直接叫出來；已經有一隻（含正在倒下的），就排隊，前一隻消失後自動換上。
  function summonBoss(user, bossId) {
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
    notice(`${killer.name} 打倒了 ${b.name}！`);
    notice(`${ids.length} 位參戰者各 +${share} 經驗，尾刀獎勵 +${bonus}`);
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
      if (t.hp <= 0) { t.down = true; t.downAt = time; }
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
    if (time >= b.nextAoeAt) { b.nextAoeAt = time + bossCfg.aoeEverySeconds; b.nextAttackAt = Math.max(b.nextAttackAt, time + 2); bossStrike(b, true); }
    else if (time >= b.nextAttackAt) { b.nextAttackAt = time + bossCfg.attackEverySeconds; bossStrike(b, false); }
  }

  function reviveRemaining(p) { return p.down ? Math.max(0, config.reviveSeconds - (time - p.downAt)) : 0; }

  return {
    onFx(fn) { fxListeners.push(fn); },
    handleEvent(ev) {
      // 任何留言或送禮都算「有動作」，用來判斷這位觀眾還在不在
      const me = ev.user && players.get(ev.user.id);
      if (me) me.lastActive = time;
      if (ev.type === 'chat') handleChat(ev.user, ev.text);
      else if (ev.type === 'gift') handleGift(ev.user, ev.giftId, ev.count);
    },
    // 每一格畫面呼叫一次，dt = 經過的秒數
    update(dt) {
      time += dt;
      for (const p of [...players.values()]) {
        if (p.isBoss) { bossUpdate(p); continue; }
        if (p.down && time - p.downAt >= config.removeDownedAfterSeconds) {
          players.delete(p.id);
          notice(`${p.name} 倒地太久，離場了`);
        } else if (time - p.lastActive >= config.idleRemoveSeconds) {
          players.delete(p.id);   // 太久沒留言也沒送禮：當作已經離開直播間，把位置讓出來（等級和傷害紀錄保留）
          notice(`${p.name} 太久沒動作，離場了`);
        }
      }
    },
    // 清空場上。keepProgress = true 時保留每位觀眾的等級、經驗值、擊倒數（只把場上武將和傷害排行榜清掉）
    reset(keepProgress) {
      players.clear(); left.clear(); bossQueue.length = 0; time = 0;
      if (keepProgress) scores.forEach(s => { s.damage = 0; }); else scores.clear();
    },
    // 存檔用：交出每位觀眾目前的進度
    exportProfiles() { return [...scores.values()].map(s => ({ id: s.id, name: s.name, level: s.level, xp: s.xp, kills: s.kills })); },
    // 讀檔用：把之前存的進度放回來（傷害從 0 開始，所以不會出現在排行榜上，要重新上場才算）
    // merge = true（接上雲端存檔時用）：跟目前已有的進度合併，每位觀眾取比較高的那份，
    //   而且直接改現有的紀錄（場上正在打的武將也會立刻吃到新等級）；不是整個換掉。
    importProfiles(list, merge) {
      const max = config.leveling.maxLevel;
      for (const p of list || []) {
        if (!p || !p.id) continue;
        const level = Math.max(1, Math.min(max, Math.floor(p.level) || 1));
        const xp = level >= max ? 0 : Math.max(0, Math.floor(p.xp) || 0), kills = Math.max(0, Math.floor(p.kills) || 0);
        const cur = scores.get(p.id);
        if (!cur || !merge) {
          scores.set(p.id, { id: p.id, name: p.name || '', heroName: '', damage: 0, kills, level, xp });
          continue;
        }
        if (level > cur.level || (level === cur.level && xp > cur.xp)) {
          const leveled = level !== cur.level;
          cur.level = level; cur.xp = xp;
          const onStage = players.get(p.id);
          if (leveled && onStage) refreshHp(onStage);
        }
        cur.kills = Math.max(cur.kills, kills);
        if (!cur.name && p.name) cur.name = p.name;
      }
    },
    announce(text) { notice(text); },
    getPlayers() { return [...players.values()]; },
    // BOSS 相關（畫面和面板用）
    getBoss() {
      const b = players.get(BOSS_ID);
      return b ? { name: b.name, level: b.def.level, hp: b.hp, maxHp: b.maxHp, down: b.down, summoner: b.summoner,
        attackIn: Math.max(0, b.nextAttackAt - time), aoeIn: Math.max(0, b.nextAoeAt - time) } : null;
    },
    getBossQueue() { return bossQueue.map(e => ({ name: e.def.displayName, level: e.def.level, by: e.by })); },
    bossHeroes() { return (bossCfg.list || []).map(bossHero); },
    // 測試用：把 BOSS 血量直接設成某個比例（測試尾刀獎勵）／把 BOSS 和排隊全部清掉
    debugBossHp(ratio) { const b = players.get(BOSS_ID); if (b && !b.down) b.hp = Math.max(1, Math.round(b.maxHp * ratio)); },
    clearBosses() { bossQueue.length = 0; if (players.has(BOSS_ID)) { players.delete(BOSS_ID); fx({ type: 'bossGone', id: BOSS_ID }); } },
    getPlayer(id) { return players.get(id); },
    reviveRemaining,
    stats,
    xpNeed,
    getLeaderboard() {
      return [...scores.values()].filter(s => s.damage > 0)
        .sort((a, b) => b.damage - a.damage).slice(0, config.leaderboardSize);
    },
  };
};
