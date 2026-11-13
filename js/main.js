// 把各層接起來：事件來源 → 遊戲規則 → 畫面
(function () {
  const params = new URLSearchParams(location.search);
  const config = window.GAME_CONFIG;
  const heroes = window.HEROES_DATA;

  // 禮物設定要最先載入：它會把「哪個 TikTok 禮物對應哪個動作」套進 config
  const giftSettings = ML.createGiftSettings(config, params);

  const hub = ML.createEventHub();
  const game = ML.createGame(config, heroes);
  const sprite = ML.createHeroSprite(heroes, config, 'assets/heroes');
  const renderer = ML.createRenderer(document.getElementById('stage'), game, config, sprite, ML.createEffects(), () => giftSettings.legend());

  // ---------- 存檔：觀眾的等級、經驗值、擊倒數 ----------
  const save = ML.createSave(config, params);
  const saved = config.save.enabled ? save.load() : [];
  game.importProfiles(saved);
  let dirty = false;                 // 有沒有還沒存的變動
  const active = new Set();          // 這段時間有出現過的觀眾
  hub.on(ev => { if (ev.user && ev.user.id) active.add(ev.user.id); });
  game.onFx(e => { if (e.type === 'attack' || e.type === 'levelup') dirty = true; });   // 擊倒、升級都發生在攻擊之後
  function flushSave() {
    if (!config.save.enabled || !dirty) return;
    if (save.store(game.exportProfiles(), [...active])) { dirty = false; active.clear(); }
  }
  setInterval(flushSave, config.save.intervalSeconds * 1000);
  window.addEventListener('pagehide', flushSave);       // 關掉或重新整理網頁前再存一次
  window.addEventListener('beforeunload', flushSave);

  hub.on(ev => game.handleEvent(ev));
  // 收到真的 TikTok 禮物時，順便記住它的圖片（禮物提示列要用）
  hub.on(ev => { if (ev.type === 'tiktokGift') giftSettings.rememberIcon(ev.gift.name || ('#' + ev.gift.id), ev.gift.icon); });

  // 網址加 ?obs=1 → 只有透明遊戲畫面（給 OBS）；沒加 → 顯示假事件面板
  if (params.get('obs') === '1') {
    document.body.classList.add('obs');
  } else {
    ML.createPanel(document.getElementById('panel'), hub, game, renderer, config, heroes, giftSettings, { save, flushSave, count: saved.length });
  }
  // 接真的 TikTok，兩種方式擇一：
  //   A. TikFinity 電腦版（建議）：網址加 ?tikfinity=1
  //   B. 本專案的橋接程式：從它提供的 http://localhost:8081/ 開會自動連；或網址加 ?ws=ws://localhost:8081
  const local = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
  const useTikFinity = params.has('tikfinity');
  const wsUrl = useTikFinity ? config.tiktok.tikfinityUrl : (params.get('ws') || (local ? `ws://${location.host}` : null));
  if (wsUrl) {
    const badge = document.getElementById('link-status');
    ML.connectWebSocket(hub, wsUrl, config, st => {
      badge.textContent = (st.connected ? '🟢 ' : '🔴 ') + st.text;
      // OBS 模式下，連線正常就不顯示任何字；只有出問題時才顯示，提醒主播
      badge.style.display = document.body.classList.contains('obs') && st.connected ? 'none' : 'block';
    }, useTikFinity ? ' TikFinity ' : ' 橋接程式 ');
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.frame(dt);
    requestAnimationFrame(loop);
  }
  sprite.ready.then(() => {
    requestAnimationFrame(loop);
    // 開場提示讀到了幾位觀眾的存檔（幾秒後自動消失），方便確認存檔有沒有生效
    if (saved.length) game.announce(`已讀取存檔：${saved.length} 位觀眾的等級`);
  });

  ML.hub = hub; ML.game = game; ML.renderer = renderer; ML.giftSettings = giftSettings; ML.flushSave = () => { dirty = true; flushSave(); };   // 方便除錯與自動測試
})();
