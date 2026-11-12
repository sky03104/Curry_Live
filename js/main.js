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
  // 網址加 ?ws=ws://localhost:8081 → 接本機程式傳來的真實事件（之後接 TikTok 用）
  if (params.get('ws')) ML.connectWebSocket(hub, params.get('ws'));

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
