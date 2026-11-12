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

  hub.on(ev => game.handleEvent(ev));
  // 收到真的 TikTok 禮物時，順便記住它的圖片（禮物提示列要用）
  hub.on(ev => { if (ev.type === 'tiktokGift') giftSettings.rememberIcon(ev.gift.name || ('#' + ev.gift.id), ev.gift.icon); });

  // 網址加 ?obs=1 → 只有透明遊戲畫面（給 OBS）；沒加 → 顯示假事件面板
  if (params.get('obs') === '1') {
    document.body.classList.add('obs');
  } else {
    ML.createPanel(document.getElementById('panel'), hub, game, renderer, config, heroes, giftSettings);
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
  sprite.ready.then(() => requestAnimationFrame(loop));

  ML.hub = hub; ML.game = game; ML.renderer = renderer; ML.giftSettings = giftSettings;   // 方便除錯與自動測試
})();
