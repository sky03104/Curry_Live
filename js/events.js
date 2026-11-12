// ============================================================
// 事件來源層
// 遊戲只認下面兩種統一格式的事件，不管是誰送來的：
//
//   留言： { type: 'chat', user: { id: '觀眾唯一代號', name: '顯示名字' }, text: '留言內容' }
//   送禮： { type: 'gift', user: { id, name }, giftId: 'rose', count: 1 }
//
// 現在的來源：假事件面板（js/panel.js 呼叫 hub.chat / hub.gift）
// 之後的來源：本機 Node 程式（TikTok-Live-Connector）透過 WebSocket 傳同樣格式進來，
//             用 connectWebSocket 接上即可，遊戲邏輯不用改。
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

// 預留：接本機 Node 程式用（網址加 ?ws=ws://localhost:8081 啟用）。
// 本機程式只要把上面格式的事件用 JSON 文字傳過來即可。
// ⚠️ 這段從未用真的 TikTok 實測過。
ML.connectWebSocket = function (hub, url) {
  function connect() {
    const ws = new WebSocket(url);
    ws.onmessage = (m) => {
      try {
        const ev = JSON.parse(m.data);
        if (ev && ev.user && (ev.type === 'chat' || ev.type === 'gift')) hub.emit(ev);
      } catch (e) { /* 格式不對的訊息直接忽略 */ }
    };
    ws.onclose = () => setTimeout(connect, 3000); // 斷線 3 秒後自動重連
  }
  connect();
};
