// ============================================================
// 事件來源層
// 遊戲只認下面兩種統一格式的事件，不管是誰送來的：
//
//   留言： { type: 'chat', user: { id: '觀眾唯一代號', name: '顯示名字' }, text: '留言內容' }
//   送禮： { type: 'gift', user: { id, name }, giftId: 'rose', count: 1 }
//
// 現在的來源：假事件面板（js/panel.js 呼叫 hub.chat / hub.gift）
// 真實來源：本機的橋接程式（bridge/server.js，用 TikTok-Live-Connector 連 TikTok）
//           透過 connectWebSocket 把同樣格式傳進來，遊戲邏輯不用改。
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

// 接本機的橋接程式（bridge/server.js）。它會把真的 TikTok 留言和送禮用上面的統一格式傳過來。
// onStatus 會收到 { connected: 是否已連上 TikTok, text: 白話說明 }。
ML.connectWebSocket = function (hub, url, config, onStatus) {
  const report = (connected, text) => onStatus && onStatus({ connected, text });
  function connect() {
    const ws = new WebSocket(url);
    ws.onmessage = (m) => {
      let ev;
      try { ev = JSON.parse(m.data); } catch (e) { return; }   // 格式不對的訊息直接忽略
      if (!ev) return;
      if (ev.type === 'status') { report(ev.connected, ev.text); return; }
      if (!ev.user || !ev.user.id || !ev.user.name) return;
      if (ev.type === 'chat') hub.chat(ev.user, ev.text || '');
      else if (ev.type === 'gift') {
        const giftId = ev.giftId || (ev.tiktokGift && ML.mapTikTokGift(config, ev.tiktokGift));
        if (giftId) hub.gift(ev.user, giftId, ev.count);
      }
    };
    ws.onclose = () => { report(false, '連不到橋接程式，3 秒後重試（請確認電腦上的橋接程式有開著）'); setTimeout(connect, 3000); };
  }
  connect();
};
