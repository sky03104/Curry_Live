// ============================================================
// 主播按鈕小視窗（pad.html）：從控制面板「🎮 開啟主播按鈕」開出來的獨立小視窗，只有大顆按鈕，給主播直播時快速點。
// 做法跟面板一樣：點一下 → 透過雲端存檔的 __cmd 文件傳給直播畫面（約 2～3 秒內執行）。
// 這個視窗跟面板在同一個瀏覽器，所以主播是誰、次數是多少、雲端代號，都直接讀面板存在這個瀏覽器裡的設定。
// ============================================================
(function () {
  const config = window.GAME_CONFIG;
  const $ = s => document.querySelector(s);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cloud = ML.createCloudSave(config, new URLSearchParams(), 'pad', { canWrite: false });
  const fresh = () => ML.createHostCommands(config, new URLSearchParams());   // 每次重新讀（面板改了主播、次數，這裡跟著變）
  let hc = fresh(), lastKey = '';

  function render() {
    hc = fresh();
    const cnt = a => hc.countOf(a) > 1 ? ` ×${hc.countOf(a)}` : '';
    const has = a => hc.actions.includes(a);
    const b = (cls, a, text, arg) => `<button class="${cls}" data-a="${a}" data-arg="${arg || ''}" data-text="${esc(text)}">${esc(text)}</button>`;
    const gen = ['attack', 'aoe', 'skill', 'heal'].filter(has).map(a => b('act', a, hc.label(a) + cnt(a)));
    gen.push(b('rv', 'healall', '全部回血'));
    const boss = hc.actions.filter(a => /^boss/.test(a)).map(a => b('boss', a, hc.label(a) + cnt(a)));
    const key = JSON.stringify([gen, boss, hc.hostId, cloud.enabled]);
    if (key !== lastKey) {   // 沒變就不重畫（免得點到一半按鈕被換掉）
      lastKey = key;
      $('#pad').innerHTML = `<div class="grp"><b>一般</b><div class="row">${gen.join('')}</div></div>
        <div class="grp"><b>復活</b><div class="row">${b('rv', 'revive', '復活自己')}${b('rv', 'revive', '復活全部', '全部')}</div></div>
        <div class="grp"><b>招換</b><div class="row">${boss.join('')}</div></div>`;
    }
    $('#who').textContent = hc.hostId ? `主播：${hc.hostName || hc.hostId.slice(0, 10)}` : '尚未設定主播';
    if (!cloud.enabled) say('⚠ 還沒開啟雲端存檔：回控制面板「存檔」卡片開啟後，再重新開這個視窗。', true);
    else if (!hc.hostId) say('⚠ 還沒設定主播：回控制面板「主播文字指令」選「我就是主播」。', true);
  }
  function say(t, bad) { const m = $('#msg'); m.textContent = t; m.className = bad ? 'bad' : ''; }

  $('#pad').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-a]'); if (!btn) return;
    hc = fresh();
    if (!cloud.enabled) { say('⚠ 還沒開啟雲端存檔，直播畫面收不到。', true); return; }
    if (!hc.hostId) { say('⚠ 還沒設定主播（控制面板「主播文字指令」選「我就是主播」）。', true); return; }
    const a = btn.dataset.a;
    btn.disabled = true;
    const r = await cloud.sendCommand({ action: a, count: hc.countOf(a), arg: btn.dataset.arg || '', host: { id: hc.hostId, name: hc.hostName } });
    setTimeout(() => { btn.disabled = false; }, 400);
    say(r.ok ? `✔ 已送出「${btn.dataset.text}」（${new Date().toLocaleTimeString()}）` : '⚠ 送出失敗：' + (r.text || '連不上'), !r.ok);
  });

  $('#ver').textContent = '版本 ' + (window.APP_VERSION || '');
  render();
  setInterval(render, 2000);
  window.addEventListener('storage', render);
})();
