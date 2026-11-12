// ============================================================
// TikTok 禮物設定：哪個 TikTok 禮物 → 遊戲裡的哪個動作。
//
// 設定存在兩個地方：
//   1. 這個瀏覽器裡（下次開面板還在）
//   2. 「直播用網址」裡 —— 直播軟體（OBS / TikTok LIVE Studio）是另一個瀏覽器，讀不到上面那份，
//      所以面板會把設定寫進網址，把那串網址貼進直播軟體，設定就跟著過去。
//
// 網址格式：&gifts=attack:Rose|TikTok;skill:Lion&other=ignore
//   gifts  每個動作指定哪些禮物（用禮物的英文名稱；#5655 這種寫法代表禮物編號）
//   other  沒被指定的禮物怎麼辦：tier = 照價值分級（預設）、ignore = 忽略
// ============================================================
window.ML = window.ML || {};

ML.createGiftSettings = function (config, params) {
  const KEY = 'curryLive.giftSettings.v1';
  const t = config.tiktok;
  const actionToGift = {};   // 動作代號 → 遊戲禮物代號（例如 attack → rose）
  config.gifts.forEach(g => { if (!actionToGift[g.action]) actionToGift[g.action] = g.id; });
  const giftToAction = id => (config.gifts.find(g => g.id === id) || {}).action;

  // state.map：TikTok 禮物名稱（保留原本大小寫）→ 動作代號
  let state = { map: {}, ignoreUnlisted: !!t.ignoreUnlisted };
  for (const [name, giftId] of Object.entries(t.giftByName || {})) if (giftToAction(giftId)) state.map[name] = giftToAction(giftId);

  function fromUrl() {
    if (!params.has('gifts') && !params.has('other')) return false;
    state = { map: {}, ignoreUnlisted: params.get('other') === 'ignore' };
    for (const part of (params.get('gifts') || '').split(';')) {
      const i = part.indexOf(':'), action = part.slice(0, i);
      if (i < 1 || !actionToGift[action]) continue;
      part.slice(i + 1).split('|').map(n => n.trim()).filter(Boolean).forEach(n => { state.map[n] = action; });
    }
    return true;
  }
  function fromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || typeof saved.map !== 'object') return;
      state = { map: {}, ignoreUnlisted: !!saved.ignoreUnlisted };
      for (const [n, a] of Object.entries(saved.map)) if (actionToGift[a]) state.map[n] = a;
    } catch (e) { /* 讀不到就用預設 */ }
  }
  // 把目前設定套進 config，遊戲實際對應禮物時讀的是 config.tiktok
  function apply() {
    t.giftByName = {};
    for (const [n, a] of Object.entries(state.map)) t.giftByName[n] = actionToGift[a];
    t.ignoreUnlisted = state.ignoreUnlisted;
  }
  function save() {
    apply();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存不了也不影響這次使用 */ }
  }

  if (!fromUrl()) fromStorage();   // 網址裡有設定就以網址為準（直播軟體走這條）
  apply();

  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return {
    actions: Object.keys(actionToGift),
    get map() { return state.map; },
    get ignoreUnlisted() { return state.ignoreUnlisted; },
    // 指定某個禮物對應某個動作；action 給空值 = 取消指定
    set(name, action) {
      name = String(name || '').trim();
      if (!name) return;
      for (const k of Object.keys(state.map)) if (same(k, name)) delete state.map[k];
      if (action && actionToGift[action]) state.map[name] = action;
      save();
    },
    actionOf(name) { const k = Object.keys(state.map).find(k => same(k, name)); return k ? state.map[k] : ''; },
    setIgnoreUnlisted(v) { state.ignoreUnlisted = !!v; save(); },
    // 產生要貼進直播軟體的網址
    liveUrl() {
      const base = location.protocol === 'file:' ? config.siteUrl : location.origin + location.pathname;
      const q = new URLSearchParams();
      q.set('obs', '1');
      if (params.get('ws')) q.set('ws', params.get('ws'));
      else if (location.protocol !== 'http:') q.set('tikfinity', '1');   // 從 http://localhost 開的是橋接程式，會自動連，不用加
      const groups = this.actions.map(a => [a, Object.keys(state.map).filter(n => state.map[n] === a)]).filter(([, list]) => list.length);
      if (groups.length) q.set('gifts', groups.map(([a, list]) => a + ':' + list.join('|')).join(';'));
      if (state.ignoreUnlisted) q.set('other', 'ignore');
      return base + '?' + q.toString();
    },
  };
};
