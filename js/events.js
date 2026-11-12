// ============================================================
// 事件來源層
// 遊戲只認下面兩種統一格式的事件，不管是誰送來的：
//
//   留言： { type: 'chat', user: { id: '觀眾唯一代號', name: '顯示名字' }, text: '留言內容' }
//   送禮： { type: 'gift', user: { id, name }, giftId: 'rose', count: 1 }
//
// 現在的來源：假事件面板（js/panel.js 呼叫 hub.chat / hub.gift）
// 真實來源：TikFinity 電腦版的 Event API（主要），或本專案的橋接程式 bridge/server.js（備案）。
//           都透過 connectWebSocket 轉成同樣格式傳進來，遊戲邏輯不用改。
// ============================================================
window.ML = window.ML || {};

ML.createEventHub = function () {
  const listeners = [];
  const hub = {
    on(fn) { listeners.push(fn); },
    emit(ev) { listeners.forEach(fn => fn(ev)); },
    chat(user, text) { hub.emit({ type: 'chat', user, text: String(text) }); },
    gift(user, giftId, count) { hub.emit({ type: 'gift', user, giftId, count: count || 1 }); },
  };
  return hub;
};

// 把 TikTok 的禮物對應成遊戲裡的禮物。對應表在 config.tiktok（可在面板的「TikTok 禮物設定」調整）。
// 順序：1. 有沒有指定這個禮物名稱（不分大小寫）→ 2. 有沒有指定這個禮物編號
//       → 3. 沒指定的話，照禮物價值（鑽石數）分級；若設定成「沒指定的一律忽略」就不理它。
// 對不到就回傳 null（這份禮物不會有任何效果）。
ML.mapTikTokGift = function (config, gift) {
  const t = config.tiktok || {}, table = t.giftByName || {};
  const lower = {};
  for (const k of Object.keys(table)) lower[k.trim().toLowerCase()] = table[k];
  const hit = lower[String(gift.name || '').trim().toLowerCase()] || lower['#' + gift.id];
  if (hit) return hit;
  if (t.ignoreUnlisted) return null;
  const tier = (t.giftByDiamonds || []).slice().sort((a, b) => b.atLeast - a.atLeast).find(x => gift.diamonds >= x.atLeast);
  return tier ? tier.gift : null;
};

// ---------- TikFinity 格式 → 統一格式 ----------
// TikFinity 電腦版的 Event API 傳來的是 { event: 'chat' | 'gift' | ..., data: {...} }，
// data 的欄位照 TikTok-Live-Connector。不同版本欄位擺法不一樣（有的攤平、有的包在 user / giftDetails 裡），這裡都認。
ML.createTikFinityReader = function () {
  const streaks = new Map();   // 連送中的禮物：記住上次累計到幾個
  function user(d) {
    const u = d.user || d;
    const id = String(u.userId || u.uniqueId || u.id || u.displayId || '');
    const name = u.nickname || u.uniqueId || u.displayId || '';
    return id && name ? { id: 'tt:' + id, name } : null;
  }
  return function read(msg) {
    const d = msg.data || {}, u = user(d);
    if (!u) return null;
    if (msg.event === 'chat') {
      const text = d.comment || d.content || '';
      return text ? { type: 'chat', user: u, text } : null;
    }
    if (msg.event === 'gift') {
      // 禮物的名稱、價值、類型，不同版本放的位置不一樣：有的直接攤在最外層，有的包在 giftDetails / gift /
      // extendedGiftInfo 裡，而且同一筆資料可能同時有好幾層（例如外層有 giftName，裡面的 gift 只放編號）。
      // 所以每個欄位都要「每一層都找一遍」，不能只挑其中一層。
      const layers = [d, d.giftDetails, d.gift, d.extendedGiftInfo].filter(x => x && typeof x === 'object');
      const pick = (...keys) => { for (const o of layers) for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; };
      const giftId = String(pick('giftId', 'gift_id', 'id') || '');
      const total = Number(pick('repeatCount', 'repeat_count')) || 1;
      let count = total;
      // 連送：TikTok 會一直重複通知「目前累計幾個」，結束時再通知一次。只算比上次多出來的，才不會重複計算。
      if (Number(pick('giftType', 'gift_type', 'type')) === 1) {
        const key = `${u.id}|${giftId}|${d.groupId || ''}`;
        const ended = pick('repeatEnd', 'repeat_end');
        count = total - (streaks.get(key) || 0);
        if (ended && ended !== '0') streaks.delete(key); else streaks.set(key, total);
        if (streaks.size > 5000) streaks.clear();
      }
      if (count <= 0) return null;
      const gift = { id: giftId, name: String(pick('giftName', 'name') || ''), diamonds: Number(pick('diamondCount', 'diamond_count')) || 0 };
      // 禮物圖片的網址（同樣是各版本放的位置不同，找得到就帶上，給畫面上的「禮物提示列」用）
      const first = list => (Array.isArray(list) && list[0]) || '';
      const E = d.extendedGiftInfo || {};
      gift.icon = String(d.giftPictureUrl || ((d.giftDetails || {}).giftImage || {}).giftPictureUrl ||
        first(((d.gift || {}).icon || {}).urlList) || first(((d.gift || {}).image || {}).urlList) ||
        first((E.icon || {}).url_list) || first((E.image || {}).url_list) || '');
      // 名稱和價值都讀不到時，把原始資料留一小段，方便在面板的事件紀錄裡看出問題
      if (!gift.name && !gift.diamonds) gift.raw = JSON.stringify(d).slice(0, 400);
      return { type: 'gift', user: u, count, tiktokGift: gift };
    }
    return null;   // 按讚、追蹤、分享等其他事件目前不使用
  };
};

// 接真實事件來源。兩種來源都走這裡，差別只在網址：
//   ・TikFinity 電腦版的 Event API（ws://localhost:21213/）
//   ・本專案的橋接程式 bridge/server.js（ws://localhost:8081）
// onStatus 會收到 { connected: 是否已連上, text: 白話說明 }。sourceName 是顯示用的名稱。
ML.connectWebSocket = function (hub, url, config, onStatus, sourceName) {
  const report = (connected, text) => onStatus && onStatus({ connected, text });
  const readTikFinity = ML.createTikFinityReader();
  const name = sourceName || '橋接程式';
  function connect() {
    const ws = new WebSocket(url);
    ws.onopen = () => report(true, `已連上${name}`);
    ws.onmessage = (m) => {
      let ev;
      try { ev = JSON.parse(m.data); } catch (e) { return; }   // 格式不對的訊息直接忽略
      if (!ev) return;
      if (ev.event) ev = readTikFinity(ev);                     // TikFinity 格式 → 先轉成統一格式
      if (!ev) return;
      if (ev.type === 'status') { report(ev.connected, ev.text); return; }
      if (!ev.user || !ev.user.id || !ev.user.name) return;
      if (ev.type === 'chat') hub.chat(ev.user, ev.text || '');
      else if (ev.type === 'gift') {
        const giftId = ev.giftId || (ev.tiktokGift && ML.mapTikTokGift(config, ev.tiktokGift));
        // 先通知面板「收到了什麼 TikTok 禮物、對應到哪個動作」（沒對應到也通知，才看得出為什麼沒反應）
        if (ev.tiktokGift) hub.emit({ type: 'tiktokGift', user: ev.user, gift: ev.tiktokGift, count: ev.count, mapped: giftId || null });
        if (giftId) hub.gift(ev.user, giftId, ev.count);
      }
    };
    ws.onclose = () => { report(false, `連不到${name}，3 秒後重試（請確認電腦上的${name}有開著）`); setTimeout(connect, 3000); };
  }
  connect();
};
