// ============================================================
// 假事件面板（試玩用）：按按鈕模擬觀眾留言和送禮。
// 這裡送出的事件跟之後真的 TikTok 事件走同一條路（events.js 的 hub）。
// ============================================================
window.ML = window.ML || {};

ML.createPanel = function (root, hub, game, renderer, config, heroes, giftSettings) {
  const fakeNames = ['小明', '阿華', '美玲', '大雄', '志豪', '雅婷', '咖哩', '阿土伯'];
  const $ = sel => root.querySelector(sel);

  root.innerHTML = `
    <h1>假事件面板 <small>試玩用，觀眾看不到</small></h1>

    <section>
      <h2>① 現在扮演哪位觀眾</h2>
      <div class="row"><select id="p-user"></select></div>
      <div class="row"><input id="p-newname" placeholder="新觀眾名字"><button id="p-adduser">新增觀眾</button></div>
    </section>

    <section>
      <h2>② 留言</h2>
      <div class="row"><select id="p-hero"></select><button id="p-join" class="main">留言武將名（上場）</button></div>
      <div class="row"><select id="p-target"></select><button id="p-lock">留言 @名字（鎖定）</button></div>
      <div class="row"><button id="p-unlock">留言「解除鎖定」</button></div>
      <div class="row"><input id="p-text" placeholder="自己打留言內容"><button id="p-say">送出留言</button></div>
    </section>

    <section>
      <h2>③ 送禮</h2>
      <div class="row">數量 <input id="p-count" type="number" min="1" value="1" style="width:60px;flex:none"></div>
      <div class="gifts" id="p-gifts"></div>
    </section>

    <section>
      <h2>TikTok 禮物設定</h2>
      <div class="hint">指定「哪個 TikTok 禮物」觸發「哪個動作」。禮物名稱請照 TikFinity 的 Gift Browser 抄英文名稱。</div>
      <div id="gs-actions"></div>
      <div class="row"><input id="gs-name" placeholder="禮物英文名稱，例如 Rose"><select id="gs-action" style="flex:none;width:96px"></select></div>
      <div class="row"><button id="gs-add">加入</button></div>
      <h2 style="margin-top:10px">最近收到的 TikTok 禮物</h2>
      <div class="hint">連上直播後，觀眾送的禮物會出現在這裡，可以直接選它要對應哪個動作。</div>
      <div id="gs-seen"><div class="hint">（還沒收到任何禮物）</div></div>
      <h2 style="margin-top:10px">沒被指定的禮物</h2>
      <label class="opt"><input type="radio" name="gs-other" value="tier">照價值分級（1 鑽以上普攻、5 回血、20 全場、100 技能）</label>
      <label class="opt"><input type="radio" name="gs-other" value="ignore">忽略（送了沒反應）</label>
      <h2 style="margin-top:10px">直播用網址</h2>
      <div class="hint">設定改完後，按「複製」，貼到直播軟體的「連結／瀏覽器來源」。<b>每次改設定都要重貼一次</b>，直播畫面才會照新設定。</div>
      <div class="row"><input id="gs-url" readonly><button id="gs-copy" style="flex:none">複製</button></div>
    </section>

    <section>
      <h2>測試工具</h2>
      <div class="row"><button id="p-crowd">一次讓 6 位假觀眾上場</button></div>
      <div class="row"><button id="p-skip">時間快轉 60 秒</button><button id="p-reset">清空重來</button></div>
    </section>

    <section>
      <h2>事件紀錄</h2>
      <div id="p-log"></div>
    </section>`;

  const userSel = $('#p-user'), heroSel = $('#p-hero'), targetSel = $('#p-target'), log = $('#p-log');

  function fillUsers(selected) {
    userSel.innerHTML = fakeNames.map(n => `<option>${n}</option>`).join('');
    if (selected) userSel.value = selected;
  }
  fillUsers();

  // 武將下拉選單，照陣營分組
  heroSel.innerHTML = Object.entries(config.factions).map(([key, f]) =>
    `<optgroup label="${f.label}">` +
    heroes.filter(h => h.faction === key).map(h => `<option>${h.displayName}</option>`).join('') +
    '</optgroup>').join('');
  heroSel.value = '呂布';

  $('#p-gifts').innerHTML = config.gifts.map(g =>
    `<button data-gift="${g.id}">${g.icon} ${g.name}<small>${config.actions[g.action].label}</small></button>`).join('');

  // 假觀眾的代號就用名字本身
  const me = () => ({ id: 'fake:' + userSel.value, name: userSel.value });

  function refreshTargets() {
    const names = game.getPlayers().map(p => p.name);
    const current = targetSel.value;
    const html = names.map(n => `<option>${n}</option>`).join('') || '<option value="">（場上還沒有人）</option>';
    if (targetSel.dataset.html !== html) {
      targetSel.innerHTML = html; targetSel.dataset.html = html;
      if (names.includes(current)) targetSel.value = current;
    }
  }
  setInterval(refreshTargets, 500);

  // ---------- TikTok 禮物設定 ----------
  const actionLabel = a => config.actions[a].label;
  const seen = new Map();   // 最近收到的 TikTok 禮物：名稱（或 #編號）→ { 顯示名稱, 鑽石數 }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const options = current => '<option value="">不指定</option>' +
    giftSettings.actions.map(a => `<option value="${a}"${a === current ? ' selected' : ''}>${actionLabel(a)}</option>`).join('');

  function renderGiftSettings() {
    $('#gs-actions').innerHTML = giftSettings.actions.map(a => {
      const names = Object.keys(giftSettings.map).filter(n => giftSettings.map[n] === a);
      return `<div class="gs-row"><b>${actionLabel(a)}</b><div class="chips">` +
        (names.map(n => `<span class="chip">${esc(n)}<button data-remove="${esc(n)}" title="取消指定">✕</button></span>`).join('') ||
          '<span class="none">尚未指定</span>') + '</div></div>';
    }).join('');
    if (seen.size) $('#gs-seen').innerHTML = [...seen.entries()].reverse().map(([key, g]) =>
      `<div class="seen"><span title="${esc(g.label)}">${esc(g.label)}</span><select data-seen="${esc(key)}">${options(giftSettings.actionOf(key))}</select></div>`).join('');
    root.querySelector(`input[name="gs-other"][value="${giftSettings.ignoreUnlisted ? 'ignore' : 'tier'}"]`).checked = true;
    $('#gs-url').value = giftSettings.liveUrl();
  }
  $('#gs-action').innerHTML = giftSettings.actions.map(a => `<option value="${a}">${actionLabel(a)}</option>`).join('');
  $('#gs-add').onclick = () => { giftSettings.set($('#gs-name').value, $('#gs-action').value); $('#gs-name').value = ''; renderGiftSettings(); };
  $('#gs-name').onkeydown = e => { if (e.key === 'Enter') $('#gs-add').click(); };
  $('#gs-actions').onclick = e => { const b = e.target.closest('[data-remove]'); if (b) { giftSettings.set(b.dataset.remove, ''); renderGiftSettings(); } };
  $('#gs-seen').onchange = e => { const sel = e.target.closest('[data-seen]'); if (sel) { giftSettings.set(sel.dataset.seen, sel.value); renderGiftSettings(); } };
  root.querySelectorAll('input[name="gs-other"]').forEach(r => { r.onchange = () => { giftSettings.setIgnoreUnlisted(r.value === 'ignore'); renderGiftSettings(); }; });
  $('#gs-copy').onclick = () => {
    const box = $('#gs-url'); box.select();
    const done = () => { $('#gs-copy').textContent = '已複製'; setTimeout(() => { $('#gs-copy').textContent = '複製'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  };
  renderGiftSettings();

  // ---------- 事件紀錄 ----------
  function addLog(text) {
    const line = document.createElement('div');
    line.textContent = text;
    log.prepend(line);
    while (log.children.length > 40) log.lastChild.remove();
  }
  hub.on(ev => {
    if (ev.type === 'chat') addLog(`💬 ${ev.user.name}：${ev.text}`);
    else if (ev.type === 'gift') addLog(`🎁 ${ev.user.name} 送出 ${(config.gifts.find(g => g.id === ev.giftId) || {}).name || ev.giftId} ×${ev.count}`);
    else if (ev.type === 'tiktokGift') {
      // 真的 TikTok 禮物：記進「最近收到」，並寫明它對應到哪個動作（或為什麼沒反應）
      const g = ev.gift, key = g.name || ('#' + g.id);
      seen.delete(key); seen.set(key, { label: `${g.name || '（沒有名稱）編號 ' + g.id}（${g.diamonds} 鑽）` });
      while (seen.size > 12) seen.delete(seen.keys().next().value);
      const to = ev.mapped ? actionLabel((config.gifts.find(x => x.id === ev.mapped) || {}).action) : '沒有對應，已忽略';
      addLog(`📦 TikTok 禮物：${seen.get(key).label} ×${ev.count} → ${to}` + (g.raw ? `　原始資料：${g.raw}` : ''));
      renderGiftSettings();
    }
  });

  $('#p-adduser').onclick = () => {
    const name = $('#p-newname').value.trim();
    if (!name) return;
    if (!fakeNames.includes(name)) fakeNames.push(name);
    fillUsers(name);
    $('#p-newname').value = '';
  };
  $('#p-join').onclick = () => hub.chat(me(), heroSel.value);
  $('#p-lock').onclick = () => { if (targetSel.value) hub.chat(me(), '@' + targetSel.value); };
  $('#p-unlock').onclick = () => hub.chat(me(), config.commands.unlock[0]);
  $('#p-say').onclick = () => { const t = $('#p-text').value; if (t.trim()) { hub.chat(me(), t); $('#p-text').value = ''; } };
  $('#p-text').onkeydown = e => { if (e.key === 'Enter') $('#p-say').click(); };
  $('#p-gifts').onclick = e => {
    const b = e.target.closest('button');
    if (b) hub.gift(me(), b.dataset.gift, Number($('#p-count').value) || 1);
  };
  $('#p-crowd').onclick = () => {
    const picks = [...heroes].sort(() => Math.random() - 0.5);
    fakeNames.slice(0, 6).forEach((n, i) => hub.chat({ id: 'fake:' + n, name: n }, picks[i].displayName));
  };
  $('#p-skip').onclick = () => game.update(60);
  $('#p-reset').onclick = () => { game.reset(); renderer.reset(); log.innerHTML = ''; };
};
