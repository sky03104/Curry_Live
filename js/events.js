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

// 把 TikTok 的禮物對應成遊戲裡的禮物（對應表在 js/config.js 的 tiktok）。
// 先看禮物名稱有沒有指定；沒有的話照禮物價值（鑽石數）分級。對不到就回傳 null（忽略這份禮物）。
ML.mapTikTokGift = function (config, gift) {
  const t = config.tiktok || {};
  const byName = (t.giftByName || {})[gift.name];
  if (byName) return byName;
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
      const g = d.giftDetails || d.gift || d;
      const giftId = String(d.giftId || g.id || '');
      const total = Number(d.repeatCount) || 1;
      let count = total;
      // 連送：TikTok 會一直重複通知「目前累計幾個」，結束時再通知一次。只算比上次多出來的，才不會重複計算。
      if ((g.giftType !== undefined ? g.giftType : g.type) === 1) {
        const key = `${u.id}|${giftId}|${d.groupId || ''}`;
        count = total - (streaks.get(key) || 0);
        if (d.repeatEnd) streaks.delete(key); else streaks.set(key, total);
        if (streaks.size > 5000) streaks.clear();
      }
      if (count <= 0) return null;
      return { type: 'gift', user: u, count, tiktokGift: { id: giftId, name: g.giftName || g.name || '', diamonds: Number(g.diamondCount) || 0 } };
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
        if (giftId) hub.gift(ev.user, giftId, ev.count);
      }
    };
    ws.onclose = () => { report(false, `連不到${name}，3 秒後重試（請確認電腦上的${name}有開著）`); setTimeout(connect, 3000); };
  }
  connect();
};
