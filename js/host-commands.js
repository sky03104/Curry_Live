// ============================================================
// 主播文字指令：主播不能送禮物給自己，所以改成「主播自己在直播間留言一句設定好的字」，效果就跟送那個動作的禮物一樣。
//   - 只認「主播本人」：用 TikTok 的使用者代號比對（暱稱可以被別人亂取一樣的，代號不行）。
//   - 整句剛好等於設定的字才觸發（前後空白不算，英文不分大小寫）；別人打一樣的字沒反應。
//   - 設定存在這個瀏覽器，並寫進「直播用網址」：&host=主播代號&cmd={"attack":"打他","skill":"大招"}
// ============================================================
window.ML = window.ML || {};

ML.createHostCommands = function (config) {
  const params = arguments[1] || new URLSearchParams();
  const KEY = 'curryLive.hostCmd.v1';
  const actionToGift = {};   // 動作 → 遊戲禮物代號（跟送那個動作的禮物一樣處理）
  config.gifts.forEach(g => { if (!actionToGift[g.action]) actionToGift[g.action] = g.id; });
  const actions = Object.keys(actionToGift);
  const maxCount = a => (config.actions[a] && config.actions[a].summon) ? (config.boss && config.boss.maxSummonPerGift) || 3 : config.maxGiftCombo || 10;   // 次數上限：跟連送禮物一樣（一般動作 10、招換 BOSS 3）
  let state = { hostId: '', hostName: '', cmds: {}, counts: {} };

  function cleanCmds(o) {
    const out = {};
    if (o && typeof o === 'object') for (const [a, t] of Object.entries(o)) if (actionToGift[a] && typeof t === 'string' && t.trim()) out[a] = t.trim().slice(0, 40);
    return out;
  }
  function cleanCounts(o) {
    const out = {};
    if (o && typeof o === 'object') for (const [a, n] of Object.entries(o)) { const v = Math.floor(Number(n)); if (actionToGift[a] && v > 1) out[a] = Math.min(v, maxCount(a)); }
    return out;
  }
  function fromUrl() {
    if (!params.has('host') && !params.has('cmd')) return false;
    state.hostId = (params.get('host') || '').slice(0, 80);
    try { state.cmds = cleanCmds(JSON.parse(params.get('cmd') || '{}')); } catch (e) { state.cmds = {}; }
    try { state.counts = cleanCounts(JSON.parse(params.get('cnt') || '{}')); } catch (e) { state.counts = {}; }
    return true;
  }
  function fromStorage() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s) state = { hostId: String(s.hostId || ''), hostName: String(s.hostName || ''), cmds: cleanCmds(s.cmds), counts: cleanCounts(s.counts) };
    } catch (e) { /* 讀不到就當沒設定 */ }
  }
  if (!fromUrl()) fromStorage();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存不了不影響這次使用 */ } };
  const norm = t => String(t || '').trim().toLowerCase();

  return {
    actions,
    get hostId() { return state.hostId; },
    get hostName() { return state.hostName; },
    get cmds() { return state.cmds; },
    countOf(a) { return state.counts[a] || 1; },
    maxCount,
    // 這個動作一次算幾個（等於連送幾個禮物）：1～上限
    setCount(a, n) { if (!actionToGift[a]) return; const v = Math.max(1, Math.min(maxCount(a), Math.floor(Number(n)) || 1)); if (v > 1) state.counts[a] = v; else delete state.counts[a]; save(); },
    setHost(id, name) { state.hostId = String(id || ''); state.hostName = String(name || ''); save(); },
    // 設定某個動作的指令文字；空字串 = 取消
    setCmd(action, text) {
      if (!actionToGift[action]) return;
      const t = String(text || '').trim().slice(0, 40);
      if (t) state.cmds[action] = t; else delete state.cmds[action];
      save();
    },
    isHost(user) { return !!(state.hostId && user && user.id === state.hostId); },
    // 這句留言是不是主播的指令？是就回傳 { giftId, count }（count = 這個動作設定的次數），不是回傳 null
    match(user, text) {
      if (!state.hostId || !user || user.id !== state.hostId) return null;
      const t = norm(text);
      if (!t) return null;
      const a = actions.find(a => state.cmds[a] && norm(state.cmds[a]) === t);
      return a ? { giftId: actionToGift[a], count: state.counts[a] || 1 } : null;
    },
    // 同一句字被設給兩個動作時，後面那個永遠不會觸發 → 面板用來提醒
    duplicates() {
      const seen = new Map(), dup = [];
      for (const a of actions) { const t = norm(state.cmds[a]); if (!t) continue; if (seen.has(t)) dup.push(a); else seen.set(t, a); }
      return dup;
    },
    urlParams() {
      const out = {};
      if (state.hostId) out.host = state.hostId;
      if (Object.keys(state.cmds).length) out.cmd = JSON.stringify(state.cmds);
      const cnt = {}; for (const a of Object.keys(state.counts)) if (state.cmds[a]) cnt[a] = state.counts[a];
      if (Object.keys(cnt).length) out.cnt = JSON.stringify(cnt);
      return out;
    },
  };
};
