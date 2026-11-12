// ============================================================
// 遊戲規則層：上場、攻擊、鎖定、倒地、復活、排行榜。
// 這裡完全不碰畫面，只算數字，然後用 onFx 通知畫面「發生了什麼事」。
// ============================================================
window.ML = window.ML || {};

ML.createGame = function (config, heroes) {
  const players = new Map();   // 觀眾代號 → 場上的武將
  const scores = new Map();    // 觀眾代號 → 累計傷害（離場後仍保留在排行榜）
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
  function others(p) { return [...players.values()].filter(o => o !== p && !o.down); }

  // ---------- 留言 ----------
  function handleChat(user, rawText) {
    const text = rawText.trim();
    const me = players.get(user.id);

    if (config.commands.unlock.includes(text)) {
      if (me && me.lockId) { me.lockId = null; notice(`${me.name} 解除鎖定`); }
      return;
    }

    if (text.startsWith(config.commands.lockPrefix)) {
      if (!me) return;
      const rest = text.slice(config.commands.lockPrefix.length).trim();
      if (!rest) return;
      // 先找名字完全一樣的；沒有的話，找「@名字 後面還有別的字」的情況（挑名字最長的）
      const cands = [...players.values()].filter(o => o !== me);
      const target = cands.find(o => o.name === rest) ||
        cands.filter(o => rest.startsWith(o.name)).sort((a, b) => b.name.length - a.name.length)[0];
      if (target) { me.lockId = target.id; notice(`${me.name} 鎖定了 ${target.name}`); }
      return;
    }

    const hit = nameTable.find(([name]) => text.includes(name));
    if (!hit) return;   // 沒提到武將
    if (me) { switchHero(me, text, hit[1]); return; }
    if (players.size >= config.maxOnStage) { notice(`場上已滿，${user.name} 請稍候`); return; }
    const hero = hit[1];
    const maxHp = Math.round(hero.baseHp * config.hpMultiplier);
    const p = { id: user.id, name: user.name, hero, maxHp, hp: maxHp, down: false, downAt: 0, lockId: null };
    players.set(user.id, p);
    if (!scores.has(user.id)) scores.set(user.id, { id: user.id, name: user.name, heroName: hero.displayName, damage: 0, kills: 0 });
    else Object.assign(scores.get(user.id), { name: user.name, heroName: hero.displayName });
    fx({ type: 'join', id: p.id });
    notice(`${p.name} 的 ${hero.displayName} 上場！`);
  }

  // ---------- 換武將 ----------
  // 已在場上的觀眾可以換武將，血量照比例帶過去（剩三成血，換過去也是三成），所以不能靠換角補血。
  // 留言必須「剛好只有武將名」才算換角，避免聊天時提到別的武將（例如「呂布好強」）就被誤換。
  function switchHero(me, text, hero) {
    if (text !== hit_name(text) || hero === me.hero) return;
    if (time < (me.switchReadyAt || 0)) { notice(`${me.name} 剛換過武將，請稍等`); return; }
    const ratio = me.hp / me.maxHp;
    me.hero = hero;
    me.maxHp = Math.round(hero.baseHp * config.hpMultiplier);
    me.hp = me.down ? 0 : Math.max(1, Math.round(me.maxHp * ratio));
    me.switchReadyAt = time + config.switchCooldownSeconds;
    scores.get(me.id).heroName = hero.displayName;
    fx({ type: 'switch', id: me.id });
    notice(`${me.name} 換成了 ${hero.displayName}`);
  }
  // 這段留言如果剛好等於某個武將名（或別名）就回傳它，否則回傳 null
  function hit_name(text) { const m = nameTable.find(([name]) => name === text); return m ? m[0] : null; }

  // ---------- 送禮 ----------
  function handleGift(user, giftId, rawCount) {
    const gift = config.gifts.find(g => g.id === giftId);
    if (!gift) return;
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
      const amount = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * action.healPercent * count));
      me.hp += amount;
      fx({ type: 'heal', id: me.id, amount, icon: gift.icon });
      return;
    }

    let targets;
    if (gift.action === 'aoe') {
      targets = others(me);
    } else {
      const locked = players.get(me.lockId);
      const pool = others(me);
      targets = locked && !locked.down ? [locked]
        : pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : [];
    }
    if (!targets.length) { notice(`${me.name} 找不到對手`); return; }

    const score = scores.get(me.id);
    const hits = targets.map(t => {
      const roll = 1 + (Math.random() * 2 - 1) * config.damageVariance;
      const dmg = Math.min(t.hp, Math.max(1, Math.round(me.hero.baseAtk * action.atkMultiplier * count * roll)));
      t.hp -= dmg;
      score.damage += dmg;
      if (t.hp <= 0) { t.down = true; t.downAt = time; score.kills++; }
      return { id: t.id, dmg, down: t.down };
    });
    fx({ type: 'attack', id: me.id, action: gift.action, icon: gift.icon, skillName: me.hero.skillName, hits });
    hits.filter(h => h.down).forEach(h => notice(`${me.name} 擊倒了 ${players.get(h.id).name}！`));
  }

  function reviveRemaining(p) { return p.down ? Math.max(0, config.reviveSeconds - (time - p.downAt)) : 0; }

  return {
    onFx(fn) { fxListeners.push(fn); },
    handleEvent(ev) {
      if (ev.type === 'chat') handleChat(ev.user, ev.text);
      else if (ev.type === 'gift') handleGift(ev.user, ev.giftId, ev.count);
    },
    // 每一格畫面呼叫一次，dt = 經過的秒數
    update(dt) {
      time += dt;
      for (const p of players.values()) {
        if (p.down && time - p.downAt >= config.removeDownedAfterSeconds) {
          players.delete(p.id);
          notice(`${p.name} 倒地太久，離場了`);
        }
      }
    },
    reset() { players.clear(); scores.clear(); time = 0; },
    getPlayers() { return [...players.values()]; },
    getPlayer(id) { return players.get(id); },
    reviveRemaining,
    getLeaderboard() {
      return [...scores.values()].filter(s => s.damage > 0)
        .sort((a, b) => b.damage - a.damage).slice(0, config.leaderboardSize);
    },
  };
};
