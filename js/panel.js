// ============================================================
// 假事件面板（試玩用）：按按鈕模擬觀眾留言和送禮。
// 這裡送出的事件跟之後真的 TikTok 事件走同一條路（events.js 的 hub）。
// ============================================================
window.ML = window.ML || {};

ML.createPanel = function (root, hub, game, renderer, config, heroes) {
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

  hub.on(ev => {
    const line = document.createElement('div');
    line.textContent = ev.type === 'chat'
      ? `💬 ${ev.user.name}：${ev.text}`
      : `🎁 ${ev.user.name} 送出 ${(config.gifts.find(g => g.id === ev.giftId) || {}).name || ev.giftId} ×${ev.count}`;
    log.prepend(line);
    while (log.children.length > 30) log.lastChild.remove();
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
