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
//   icons  有指定的禮物的圖片網址（畫面上的「禮物提示列」要用）
// ============================================================
window.ML = window.ML || {};

ML.createGiftSettings = function (config, params) {
  const KEY = 'curryLive.giftSettings.v1';
  const t = config.tiktok;
  const actionToGift = {};   // 動作代號 → 遊戲禮物代號（例如 attack → rose）
  config.gifts.forEach(g => { if (!actionToGift[g.action]) actionToGift[g.action] = g.id; });
  const giftToAction = id => (config.gifts.find(g => g.id === id) || {}).action;

  // state.map：TikTok 禮物名稱（保留原本大小寫）→ 動作代號
  // state.icons：TikTok 禮物名稱 → 禮物圖片網址（觀眾送過這個禮物之後才會知道）
  let state = { map: {}, ignoreUnlisted: !!t.ignoreUnlisted, icons: {} };
  for (const [name, giftId] of Object.entries(t.giftByName || {})) if (giftToAction(giftId)) state.map[name] = giftToAction(giftId);

  function fromUrl() {
    if (!params.has('gifts') && !params.has('other')) return false;
    state = { map: {}, ignoreUnlisted: params.get('other') === 'ignore', icons: {} };
    try { Object.assign(state.icons, JSON.parse(params.get('icons') || '{}')); } catch (e) { /* 圖片網址壞了就不顯示圖 */ }
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
      state = { map: {}, ignoreUnlisted: !!saved.ignoreUnlisted, icons: (saved.icons && typeof saved.icons === 'object') ? saved.icons : {} };
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
    // 記住某個禮物的圖片網址（收到禮物時呼叫）。回傳 true 代表是新學到的
    rememberIcon(name, url) {
      if (!name || !/^https?:|^file:/.test(url || '')) return false;
      const key = Object.keys(state.icons).find(k => same(k, name)) || name;
      if (state.icons[key] === url) return false;
      state.icons[key] = url;
      const keys = Object.keys(state.icons);
      if (keys.length > 60) delete state.icons[keys[0]];   // 只留最近的 60 個，避免越存越多
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存不了不影響這次使用 */ }
      return true;
    },
    iconOf(name) { const k = Object.keys(state.icons).find(k => same(k, name)); return k ? state.icons[k] : ''; },
    // 畫面上「禮物提示列」的內容：每個有指定禮物的動作一格（禮物名、圖片網址、動作名稱）
    // 招換 BOSS 的三個指令一律列出來：有指定禮物就顯示那個禮物；沒指定就顯示預設要幾顆鑽（500／1000／1500）。
    legend() {
      const tiers = (config.tiktok.giftByDiamonds || []);
      return this.actions.map(a => {
        const name = Object.keys(state.map).find(n => state.map[n] === a);
        const boss = !!config.actions[a].summon;
        if (name) return { action: a, label: config.actions[a].label, name, icon: this.iconOf(name), boss };
        if (!boss || state.ignoreUnlisted) return null;
        const tier = tiers.find(x => x.gift === actionToGift[a]);   // 這隻 BOSS 的預設鑽石門檻
        return tier ? { action: a, label: config.actions[a].label, name: '', icon: '', hint: String(tier.atLeast), boss } : null;
      }).filter(Boolean);
    },
    // 產生要貼進直播軟體的網址
    // extra：要另外加進網址的參數（例如存檔名稱 { save: '第二季' }）
    liveUrl(extra) {
      const base = location.protocol === 'file:' ? config.siteUrl : location.origin + location.pathname;
      const q = new URLSearchParams();
      q.set('obs', '1');
      if (params.get('ws')) q.set('ws', params.get('ws'));
      else if (location.protocol !== 'http:') q.set('tikfinity', '1');   // 從 http://localhost 開的是橋接程式，會自動連，不用加
      const groups = this.actions.map(a => [a, Object.keys(state.map).filter(n => state.map[n] === a)]).filter(([, list]) => list.length);
      if (groups.length) q.set('gifts', groups.map(([a, list]) => a + ':' + list.join('|')).join(';'));
      if (state.ignoreUnlisted) q.set('other', 'ignore');
      const icons = {};
      for (const n of Object.keys(state.map)) if (this.iconOf(n)) icons[n] = this.iconOf(n);
      if (Object.keys(icons).length) q.set('icons', JSON.stringify(icons));
      for (const [k, v] of Object.entries(extra || {})) if (v) q.set(k, v);
      return base + '?' + q.toString();
    },
  };
};
