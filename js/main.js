// 把各層接起來：事件來源 → 遊戲規則 → 畫面
(function () {
  const params = new URLSearchParams(location.search);
  const config = window.GAME_CONFIG;
  const heroes = window.HEROES_DATA;

  const hub = ML.createEventHub();
  const game = ML.createGame(config, heroes);
  const sprite = ML.createHeroSprite(heroes, config, 'assets/heroes');
  const renderer = ML.createRenderer(document.getElementById('stage'), game, config, sprite, ML.createEffects());

  hub.on(ev => game.handleEvent(ev));

  // 網址加 ?obs=1 → 只有透明遊戲畫面（給 OBS）；沒加 → 顯示假事件面板
  if (params.get('obs') === '1') {
    document.body.classList.add('obs');
  } else {
    ML.createPanel(document.getElementById('panel'), hub, game, renderer, config, heroes);
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

  ML.hub = hub; ML.game = game; ML.renderer = renderer;   // 方便除錯與自動測試
})();
