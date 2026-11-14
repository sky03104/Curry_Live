// ============================================================
// 存檔：把每位觀眾的等級、經驗值、擊倒數存起來，下次開播還在。
//
// 存在哪裡：存在「正在跑這個網頁的那個瀏覽器」裡（瀏覽器內建的小儲存空間）。
//   ・直播軟體（OBS / TikTok LIVE Studio）裡的直播畫面，存在直播軟體自己的瀏覽器裡
//   ・你用 Chrome 開的面板，存在 Chrome 裡
//   這兩份是分開的、互不相通。真正算數的是直播軟體那一份。
//
// 存檔名稱：網址加 &save=名稱 可以指定用哪一份存檔。換一個名稱＝開一份全新的存檔（等級全部從 1 開始），
//   舊的那份還在，把名稱改回去就回來了。沒指定就用 default。
//
// 不存的東西：場上有哪些武將、血量、傷害排行榜（每次開播重新計算）。
// ============================================================
window.ML = window.ML || {};

ML.createSave = function (config, params) {
  const slot = String(params.get('save') || 'default').slice(0, 40);
  const KEY = 'curryLive.save.' + slot;
  const MAX = 5000;   // 最多記幾位觀眾，超過就丟掉最久沒出現的
  let lastSeen = {};  // 觀眾代號 → 上次出現的時間

  return {
    slot,
    // 讀出存檔，回傳 [{ id, name, level, xp, kills }]。讀不到或壞掉就當作沒有存檔。
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(KEY));
        if (!data || !Array.isArray(data.profiles)) return [];
        lastSeen = {};
        data.profiles.forEach(p => { lastSeen[p.id] = p.seen || 0; });
        return data.profiles;
      } catch (e) { return []; }
    },
    // 存檔。active 是這次有動靜的觀眾代號（用來更新「上次出現時間」）。回傳是否成功。
    store(profiles, active) {
      const now = Date.now();
      (active || []).forEach(id => { lastSeen[id] = now; });
      // 還是 1 級、0 經驗、沒擊倒過人的不用存（等於沒有進度）
      let list = profiles.filter(p => p.level > 1 || p.xp > 0 || p.kills > 0 || p.adj)
        .map(p => ({ id: p.id, name: p.name, level: p.level, xp: p.xp, kills: p.kills, adj: p.adj || 0, seen: lastSeen[p.id] || now }));
      if (list.length > MAX) list = list.sort((a, b) => b.seen - a.seen).slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: now, profiles: list })); return true; } catch (e) { return false; }
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { /* 沒東西可清 */ } lastSeen = {}; },
  };
};
