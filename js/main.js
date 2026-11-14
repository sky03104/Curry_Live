// 把各層接起來：事件來源 → 遊戲規則 → 畫面
(function () {
  const params = new URLSearchParams(location.search);
  const config = window.GAME_CONFIG;
  const heroes = window.HEROES_DATA;

  // 禮物設定要最先載入：它會把「哪個 TikTok 禮物對應哪個動作」套進 config
  const giftSettings = ML.createGiftSettings(config, params);

  const hub = ML.createEventHub();
  const game = ML.createGame(config, heroes);
  // 可選武將：這位實況主開放哪些武將（網址 &heroes= / &skip=，沒有就用這個瀏覽器記住的）
  const heroSettings = ML.createHeroSettings(heroes, params);
  game.setHeroPool(heroSettings.enabled);
  const sprite = ML.createHeroSprite(heroes.concat(game.bossHeroes()), config, 'assets/heroes');   // BOSS 的圖也要載入
  // 場地：直播畫面讀網址的 &arena=；面板視窗讀這個瀏覽器記住的選擇（方便預覽）
  const arenas = ML.createArenas();
  let savedArena = ''; try { savedArena = localStorage.getItem('curryLive.arena') || ''; } catch (e) { /* 讀不到就用預設 */ }
  arenas.set(params.get('arena') || (params.get('obs') === '1' ? 'none' : savedArena));
  const renderer = ML.createRenderer(document.getElementById('stage'), game, config, sprite, ML.createEffects(), () => giftSettings.legend(), arenas);

  // ---------- 存檔：觀眾的等級、經驗值、擊倒數 ----------
  const save = ML.createSave(config, params);
  const saved = config.save.enabled ? save.load() : [];
  game.importProfiles(saved);
  let dirty = false;                 // 有沒有還沒存的變動
  const active = new Set();          // 這段時間有出現過的觀眾
  hub.on(ev => { if (ev.user && ev.user.id) active.add(ev.user.id); });
  game.onFx(e => { if (e.type === 'attack' || e.type === 'levelup' || e.type === 'bossDefeated') dirty = true; });   // 擊倒、升級都發生在攻擊之後；打倒 BOSS 分到經驗值也要存
  function flushSave() {
    if (!config.save.enabled || !dirty) return;
    if (save.store(game.exportProfiles(), [...active])) { dirty = false; active.clear(); }
  }
  setInterval(flushSave, config.save.intervalSeconds * 1000);
  window.addEventListener('pagehide', flushSave);       // 關掉或重新整理網頁前再存一次
  window.addEventListener('beforeunload', flushSave);

  // ---------- 雲端存檔（Firebase）：只有直播畫面（obs=1）會寫入，面板視窗只讀取 ----------
  const cloud = ML.createCloudSave(config, params, save.slot, { canWrite: params.get('obs') === '1' });
  // 只存真實觀眾（面板測試用的假觀眾 fake: 不進雲端），而且只存有進度的（1 級、0 經驗、沒擊倒過人的不用存）
  const realProfiles = () => game.exportProfiles().filter(p => p.id.startsWith('tt:') && (p.level > 1 || p.xp > 0 || p.kills > 0));
  let cloudDirty = false, lastCloudState = '';
  cloud.onStatus(st => {
    // 狀態變成「出錯」或「從出錯恢復」時，在畫面訊息區提醒一次（不要一直洗版）
    if (st.state === 'error' && lastCloudState !== 'error') game.announce('⚠ ' + st.text + '（等級先存在本機）');
    else if (st.state === 'ok' && lastCloudState === 'error') game.announce('雲端存檔恢復正常');
    lastCloudState = st.state;
  });
  // 讀雲端 → 跟本機目前的進度合併 → 套用到遊戲；有本機的進度雲端沒有時，也一併存上去
  async function syncCloud() {
    if (!cloud.enabled || !config.save.enabled) return 0;
    try {
      const remote = await cloud.load();
      game.importProfiles(remote, true);
      if (remote.length) game.announce(`已讀取雲端存檔：${remote.length} 位觀眾的等級`);
      if (cloud.canWrite && realProfiles().length) cloudDirty = true;
      await flushCloud();
      return remote.length;
    } catch (e) { return -1; }
  }
  async function flushCloud(leaving) {
    if (!cloud.enabled || !cloud.canWrite || !cloudDirty) return;
    const merged = await cloud.store(realProfiles(), { keepalive: !!leaving });
    if (merged) { game.importProfiles(merged, true); cloudDirty = false; }   // 別的視窗賺到的等級也套進來
  }
  // ---------- 手動儲存（面板的「立即儲存」按鈕）----------
  // 不用等定時存檔，馬上把「這個視窗目前有的進度」存到本機，雲端有開的話也存到雲端。
  // 注意：只存這個視窗自己的進度。直播軟體裡的畫面是另一個獨立的視窗，它自己每 30 秒會自動存。
  async function saveNow() {
    const res = { time: new Date(), local: null, cloud: null };
    const withProgress = game.exportProfiles().filter(p => p.level > 1 || p.xp > 0 || p.kills > 0);
    res.local = { ok: config.save.enabled && save.store(game.exportProfiles(), [...active]), count: withProgress.length, enabled: config.save.enabled };
    if (res.local.ok) { dirty = false; active.clear(); }
    if (cloud.enabled) {
      const list = realProfiles();
      if (!list.length) res.cloud = { state: 'empty' };
      else {
        const merged = await cloud.store(list, { force: true });
        if (merged) { game.importProfiles(merged, true); cloudDirty = false; res.cloud = { state: 'ok', total: merged.length, count: list.length }; }
        else res.cloud = { state: cloud.status.state === 'error' ? 'fail' : 'busy', text: cloud.status.text };
      }
    }
    return res;
  }
  setInterval(() => flushCloud(), config.save.cloud.intervalSeconds * 1000);
  window.addEventListener('pagehide', () => flushCloud(true));    // 關掉網頁前盡力再存一次（存不到也沒關係，下次開會從本機補上去）
  game.onFx(e => { if (e.type === 'attack' || e.type === 'levelup' || e.type === 'bossDefeated') cloudDirty = true; });
  syncCloud();

  hub.on(ev => game.handleEvent(ev));
  // 收到真的 TikTok 禮物時，順便記住它的圖片（禮物提示列要用）
  hub.on(ev => { if (ev.type === 'tiktokGift') giftSettings.rememberIcon(ev.gift.name || ('#' + ev.gift.id), ev.gift.icon); });

  // 網址加 ?obs=1 → 只有透明遊戲畫面（給 OBS）；沒加 → 顯示假事件面板
  if (params.get('obs') === '1') {
    document.body.classList.add('obs');
  } else {
    ML.createPanel(document.getElementById('panel'), hub, game, renderer, config, heroes, giftSettings, { heroSettings, save, flushSave, count: saved.length, cloud, syncCloud, saveNow });
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

  ML.hub = hub; ML.game = game; ML.renderer = renderer; ML.giftSettings = giftSettings; ML.flushSave = () => { dirty = true; flushSave(); }; ML.cloud = cloud; ML.flushCloud = () => { cloudDirty = true; return flushCloud(); };   // 方便除錯與自動測試
})();
