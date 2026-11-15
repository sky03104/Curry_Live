// ============================================================
// 自動更新：直播畫面定時去讀 version.json，發現版本號跟自己載入時的不一樣，就在「安靜的時候」自動重新整理。
// 為什麼不用 PWA／Service Worker：直播軟體（TikTok LIVE Studio、OBS）的內建瀏覽器不會「安裝」網頁，
// Service Worker 還會多一層快取，反而容易卡在舊版；這個做法只靠一個小檔案，簡單、不會卡舊版。
// 只有直播畫面（obs=1）會自動更新；面板視窗只會提醒。本機雙擊開啟（file://）時不檢查。
// ============================================================
window.ML = window.ML || {};

ML.createUpdater = function (config, params, game, hooks) {
  const cfg = config.update || {};
  const KEY = 'curryLive.roster.v1';
  const current = window.APP_VERSION || '';
  const state = { current, latest: '', pending: false, warned: false };
  const auto = params.get('obs') === '1';
  const base = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');

  // 更新後：把更新前場上的武將放回來（3 分鐘內的記錄才算）
  function restore() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return 0;
      localStorage.removeItem(KEY);
      const r = JSON.parse(raw);
      if (!r || Date.now() - r.at > 3 * 60 * 1000) return 0;
      const n = game.restoreRoster(r.list);
      if (r.mode) game.importMode(r.mode);   // 陣營模式：隊伍、塔與主堡的血量一起放回來
      if (n) game.announce(`已自動更新到新版本（${current}），場上 ${n} 位武將已放回`);
      return n;
    } catch (e) { return 0; }
  }

  let lastAttack = -1e9;
  game.onFx(e => { if (e.type === 'attack') lastAttack = Date.now(); });
  // 「安靜」＝場上沒有 BOSS、也沒有 BOSS 在排隊、最近 10 秒沒人出招（避免在打到一半時重新整理）
  const quiet = () => !(game.raceBusy && game.raceBusy()) && !game.getPlayers().some(p => p.isBoss) && !(game.getBossQueue && game.getBossQueue().length) && Date.now() - lastAttack > (cfg.quietSeconds || 10) * 1000;

  async function check() {
    if (location.protocol === 'file:' || !current) return;
    try {
      const r = await fetch(base + 'version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const v = String((await r.json()).version || '');
      state.latest = v;
      if (v && v !== current) state.pending = true;
      else if (v === current) { try { localStorage.removeItem(KEY + '.tried'); } catch (e) { /* 清不掉就算了 */ } }   // 已經是最新版：把「試過了」的記號清掉，之後再有新版本才能再自動更新（直播軟體重開後拿到舊快取也能再更新一次）
    } catch (e) { /* 連不上就下次再試 */ }
  }
  async function tick() {
    await check();
    if (!state.pending || !auto) return;
    // 防「無限重新整理」：同一個新版本只自動更新一次（重新整理後瀏覽器還拿到舊檔的話，就等下次有更新再說，並提醒）
    let tried = ''; try { tried = localStorage.getItem(KEY + '.tried') || ''; } catch (e) { /* 讀不到就當沒試過 */ }
    if (tried === state.latest) { state.pending = false; if (!state.warned) { state.warned = true; game.announce(`新版本 ${state.latest} 沒能自動載入（瀏覽器還在用舊檔），請手動重新整理一次`); } return; }
    if (!quiet()) return;                       // 還在打，等下一輪（每 15 秒看一次）
    game.announce('發現新版本，3 秒後自動更新…');
    state.pending = false;
    setTimeout(() => {
      try { hooks.beforeReload && hooks.beforeReload(); localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), list: game.exportRoster(), mode: game.exportMode() })); } catch (e) { /* 存不了就算了，只是場上要重新留言 */ }
      try { localStorage.setItem(KEY + '.tried', state.latest); } catch (e) { /* 存不了就算了 */ }
      // 不是單純 reload：換成帶 &_v=新版本號 的網址，瀏覽器才會當成新網頁重抓所有檔案（見 index.html 的載入段），不會還在用快取的舊檔
      try { const u = new URL(location.href); u.searchParams.set('_v', state.latest); location.replace(u.toString()); } catch (e) { location.reload(); }
    }, 3000);
  }
  if (auto) restore();
  const every = (cfg.checkSeconds || 60) * 1000;
  setTimeout(tick, 5000);
  setInterval(() => { if (state.pending) tick(); }, 15000);   // 已經發現新版、只是在等安靜時機：很快重試，不用再去讀檔案
  setInterval(() => { if (!state.pending) tick(); }, every);
  return state;
};
