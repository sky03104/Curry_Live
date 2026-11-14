// ============================================================
// 假事件面板（試玩用）：按按鈕模擬觀眾留言和送禮。
// 這裡送出的事件跟之後真的 TikTok 事件走同一條路（events.js 的 hub）。
// ============================================================
window.ML = window.ML || {};

ML.createPanel = function (root, hub, game, renderer, config, heroes, giftSettings, saving) {
  const fakeNames = ['小明', '阿華', '美玲', '大雄', '志豪', '雅婷', '咖哩', '阿土伯'];
  const $ = sel => root.querySelector(sel);

  root.innerHTML = `
    <div class="topbar">
      <h1>直播亂鬥 控制面板 <small>觀眾看不到</small></h1>
      <div class="topbtns"><button id="p-openall">全部展開</button><button id="p-closeall">全部收合</button></div>
    </div>

    <details class="card pinned" data-k="url" open>
      <summary><span class="ico">📋</span>直播用網址<em>每次改設定都要重貼</em></summary>
      <div class="body">
        <div class="hint">設定改完後，按「複製」，貼到直播軟體的「連結／瀏覽器來源」。<b>每次改設定都要重貼一次</b>，直播畫面才會照新設定。</div>
        <div class="row"><input id="gs-url" readonly><button id="gs-copy" class="main" style="flex:none">複製</button></div>
        <div class="hint">有指定禮物的動作，會在直播畫面的排行榜旁邊顯示「禮物圖片＋動作名稱」。禮物圖片要等有人送過那個禮物才會出現。</div>
      </div>
    </details>

    <div class="group">直播設定</div>

    <details class="card" data-k="arena">
      <summary><span class="ico">🏟️</span>場地<em id="p-arena-now"></em></summary>
      <div class="body">
        <div class="hint">武將腳下的地面。「全場透明」就是直接疊在直播畫面上；選別的場地會鋪一張地面。</div>
        <div class="row"><select id="p-arena"></select></div>
        <div class="hint" id="p-arena-hint"></div>
      </div>
    </details>

    <details class="card" data-k="heroes">
      <summary><span class="ico">🧙</span>可選武將<em id="hs-count"></em></summary>
      <div class="body">
        <div class="hint">勾選要讓觀眾選的武將，沒勾的觀眾留言也上不了場（已經在場上的不受影響）。每個人各設各的，設定會寫進你自己的直播用網址。至少要留一隻。</div>
        <div class="row"><button id="hs-all">全選</button><button id="hs-none">只留一隻</button></div>
        <div id="hs-list"></div>
        <div class="hint">⚠ 直播畫面要重貼網址才會生效。</div>
      </div>
    </details>

    <details class="card" data-k="gifts">
      <summary><span class="ico">🎁</span>禮物對應<em>普攻／全場／技能／回血</em></summary>
      <div class="body">
        <div class="hint">每個動作右邊選一個 TikTok 禮物。清單裡沒有的，選最下面的「自己輸入名稱…」，照 TikFinity 的 Gift Browser 抄英文名稱。</div>
        <div id="gs-actions"></div>
        <div class="sub">最近收到的 TikTok 禮物</div>
        <div class="hint">連上直播後，觀眾送的禮物會出現在這裡，可以直接選它要對應哪個動作。</div>
        <div id="gs-seen"><div class="hint">（還沒收到任何禮物）</div></div>
        <div class="sub">沒被指定的禮物</div>
        <label class="opt"><input type="radio" name="gs-other" value="tier">照價值分級（1 鑽普攻、5 鑽回血、20 鑽全場、100 鑽招換藍紅BUFF、200 鑽技能，500／1000／1500 鑽招換大 BOSS）</label>
        <label class="opt"><input type="radio" name="gs-other" value="ignore">忽略（送了沒反應）</label>
        <div class="hint">回血小技巧：先留言「@某位玩家」，再送回血禮物，就會補給他，不是補自己。</div>
      </div>
    </details>

    <details class="card" data-k="boss">
      <summary><span class="ico">🐉</span>招換 BOSS 的禮物<em>100／500／1000／1500 鑽</em></summary>
      <div class="body">
        <div class="hint">指定哪個禮物招換哪隻 BOSS。<b>沒指定的話</b>，沒被其他動作用掉的禮物會照價值：100～199 鑽招換藍BUFF 或紅BUFF（隨機一隻）、500 鑽以上深淵魔龍、1000 鑽以上深淵凱薩、1500 鑽以上太古巨猿。場上同時只有一隻 BOSS，後來招換的會排隊。</div>
        <div class="hint">藍BUFF／紅BUFF（Lv.5）：<b>最後一擊的玩家</b>獲得效果，持續 1 小時——藍BUFF 每秒回復 10 血、紅BUFF 攻擊力加倍（血條旁會出現「回」「攻」的小圓章）。</div>
        <div id="gs-boss"></div>
        <div class="hint">玩家留言「@BOSS」或「@BOSS的名字」就能鎖定它。BOSS 每 60 秒隨機打一人，每 300 秒全場攻擊；打倒後經驗值平分給所有打過的玩家，最後一擊的人額外多拿。數值在 js/config.js 的 boss。</div>
      </div>
    </details>

    <div class="group">存檔</div>

    <details class="card" data-k="save">
      <summary><span class="ico">💾</span>存檔（等級）</summary>
      <div class="body">
        <div class="hint">觀眾的等級、經驗值會自動存在「跑直播畫面的那個軟體」裡，下次開播還在。傷害排行榜每次開播重新計算。</div>
        <div class="row"><button id="sv-now" class="main">立即儲存</button></div>
        <div class="hint" id="sv-now-result"></div>
        <div class="hint">按了會馬上把<b>這個視窗</b>目前的等級存起來（存在這個瀏覽器；雲端存檔有開的話也存到雲端）。直播軟體裡的畫面是另一個視窗，它每 30 秒會自己存，這顆按鈕管不到它。</div>
        <div class="row">存檔名稱 <input id="sv-slot" placeholder="不填＝預設那一份"></div>
        <div class="hint">想讓大家的等級全部重來：填一個新名稱（例如「第二季」），再重貼直播用網址。舊的存檔不會消失，把名稱改回來就回來了。</div>
      </div>
    </details>

    <details class="card" data-k="cloud">
      <summary><span class="ico">☁️</span>雲端存檔（Firebase）<em id="cl-badge"></em></summary>
      <div class="body">
        <div class="hint">把等級備份到 Firebase：換電腦、重灌、換直播軟體都還在。<b>只有直播畫面會寫入雲端</b>，這個面板視窗只讀取（免得測試用的假觀眾污染真的存檔）。</div>
        <div class="hint" id="cl-status"></div>
        <div class="row"><input id="cl-token" placeholder="雲端代號（按「開啟」自動產生）"><button id="cl-copy" style="flex:none">複製</button></div>
        <div class="row"><button id="cl-on">開啟雲端存檔</button><button id="cl-test">測試連線</button></div>
        <div class="row"><button id="cl-off">關閉雲端存檔</button></div>
        <div class="hint" id="cl-result"></div>
        <div class="hint">⚠ <b>雲端代號就是鑰匙</b>：知道它的人可以讀寫你的存檔。直播用網址裡有它，不要把網址貼到公開的地方。想在另一台電腦用同一份存檔：把代號貼進上面的欄位，按「開啟」。</div>
      </div>
    </details>

    <div class="group">試玩模擬</div>

    <details class="card" data-k="play">
      <summary><span class="ico">🎮</span>扮演觀眾<em>留言、鎖定、烙跑</em></summary>
      <div class="body">
        <div class="sub first">現在扮演哪位觀眾</div>
        <div class="row"><select id="p-user"></select></div>
        <div class="row"><input id="p-newname" placeholder="新觀眾名字"><button id="p-adduser">新增觀眾</button></div>
        <div class="sub">留言</div>
        <div class="row"><select id="p-hero"></select><button id="p-join" class="main">留言武將名（上場）</button></div>
        <div class="row"><select id="p-target"></select><button id="p-lock">留言 @名字（鎖定）</button></div>
        <div class="row"><button id="p-unlock">留言「解除鎖定」</button><button id="p-leave">留言「烙跑」</button></div>
        <div class="row"><input id="p-text" placeholder="自己打留言內容"><button id="p-say">送出留言</button></div>
        <div class="sub">送禮</div>
        <div class="row">數量 <input id="p-count" type="number" min="1" value="1" style="width:60px;flex:none"></div>
        <div class="gifts" id="p-gifts"></div>
      </div>
    </details>

    <details class="card" data-k="bosstest">
      <summary><span class="ico">👹</span>BOSS 測試<em id="p-boss-badge"></em></summary>
      <div class="body">
        <div class="hint">用目前扮演的觀眾招換 BOSS（等於丟招換禮物）。</div>
        <div class="gifts" id="p-bosses"></div>
        <div class="hint" id="p-boss-status">場上沒有 BOSS</div>
        <div class="row"><button id="p-boss-hp">BOSS 剩 1% 血（測尾刀）</button><button id="p-boss-clear">清掉 BOSS 與排隊</button></div>
      </div>
    </details>

    <details class="card" data-k="tools">
      <summary><span class="ico">🧰</span>測試工具</summary>
      <div class="body">
        <div class="row"><button id="p-crowd">一次讓 6 位假觀眾上場</button></div>
        <div class="row"><button id="p-skip">時間快轉 60 秒</button><button id="p-reset">清空場上</button></div>
        <div class="row"><button id="p-wipe">清除這個瀏覽器的等級存檔</button></div>
        <div class="hint" id="sv-info"></div>
      </div>
    </details>

    <details class="card" data-k="log">
      <summary><span class="ico">📜</span>事件紀錄</summary>
      <div class="body">
        <div class="row"><button id="p-copyraw">複製最後一份禮物的原始資料（除錯用）</button></div>
        <div id="p-log"></div>
      </div>
    </details>`;

  const userSel = $('#p-user'), heroSel = $('#p-hero'), targetSel = $('#p-target'), log = $('#p-log');

  function fillUsers(selected) {
    userSel.innerHTML = fakeNames.map(n => `<option>${n}</option>`).join('');
    if (selected) userSel.value = selected;
  }
  fillUsers();

  // 武將下拉選單，照陣營分組
  heroSel.innerHTML = Object.entries(config.factions).filter(([key]) => heroes.some(h => h.faction === key)).map(([key, f]) =>   // 沒有武將的陣營（BOSS）不列
    `<optgroup label="${f.label}">` +
    heroes.filter(h => h.faction === key).map(h => `<option>${h.displayName}</option>`).join('') +
    '</optgroup>').join('');
  heroSel.value = '呂布';

  const isBoss = a => !!(config.actions[a] || {}).summon;
  const giftBtn = g => `<button data-gift="${g.id}">${g.icon} ${g.name}<small>${config.actions[g.action].label}</small></button>`;
  $('#p-gifts').innerHTML = config.gifts.filter(g => !isBoss(g.action)).map(giftBtn).join('');
  $('#p-bosses').innerHTML = config.gifts.filter(g => isBoss(g.action)).map(giftBtn).join('');

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

  const CUSTOM = '__custom__';
  // 每個動作一個下拉選單。選項依序是：不指定 → 最近收到的禮物 → 常見禮物 → 自己輸入名稱
  function giftOptions(current) {
    const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const recent = [...seen.entries()].reverse().map(([key, g]) => ({ name: key, label: g.label }));
    const common = (config.tiktok.commonGifts || []).filter(c => !recent.some(r => same(r.name, c.name)))
      .map(c => ({ name: c.name, label: `${c.name}（${c.diamonds} 鑽）` }));
    const known = [...recent, ...common];
    const opt = o => `<option value="${esc(o.name)}"${current && same(o.name, current) ? ' selected' : ''}>${esc(o.label)}</option>`;
    return `<option value="">不指定</option>` +
      (current && !known.some(o => same(o.name, current)) ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : '') +
      (recent.length ? `<optgroup label="最近收到的禮物">${recent.map(opt).join('')}</optgroup>` : '') +
      `<optgroup label="常見禮物">${common.map(opt).join('')}</optgroup>` +
      `<option value="${CUSTOM}">自己輸入名稱…</option>`;
  }
  const giftOf = action => Object.keys(giftSettings.map).find(n => giftSettings.map[n] === action) || '';

  function renderGiftSettings() {
    const row = a => `<div class="gs-row"><b>${actionLabel(a)}</b><select data-action="${a}">${giftOptions(giftOf(a))}</select></div>`;
    $('#gs-actions').innerHTML = giftSettings.actions.filter(a => !isBoss(a)).map(row).join('');
    $('#gs-boss').innerHTML = giftSettings.actions.filter(isBoss).map(row).join('');
    $('#p-arena-now').textContent = (renderer.arenas.list.find(x => x.key === renderer.arenas.get()) || {}).label || '';
    if (seen.size) $('#gs-seen').innerHTML = [...seen.entries()].reverse().map(([key, g]) =>
      `<div class="seen"><span title="${esc(g.label)}">${esc(g.label)}</span><select data-seen="${esc(key)}">${options(giftSettings.actionOf(key))}</select></div>`).join('');
    root.querySelector(`input[name="gs-other"][value="${giftSettings.ignoreUnlisted ? 'ignore' : 'tier'}"]`).checked = true;
    $('#gs-url').value = giftSettings.liveUrl({ save: $('#sv-slot').value.trim(), cloud: saving.cloud.enabled ? saving.cloud.token : '', arena: renderer.arenas.get() === 'none' ? '' : renderer.arenas.get(), ...saving.heroSettings.urlParams() });
  }
  // 一個動作只對應一個禮物：選了新的，就取代這個動作原本的
  function setActionGift(action, name) {
    Object.keys(giftSettings.map).filter(n => giftSettings.map[n] === action).forEach(n => giftSettings.set(n, ''));
    if (name) giftSettings.set(name, action);
  }
  const onActionChange = e => {
    const sel = e.target.closest('[data-action]');
    if (!sel) return;
    let name = sel.value;
    if (name === CUSTOM) {
      name = (window.prompt('請輸入 TikTok 禮物的英文名稱（照 TikFinity 的 Gift Browser 抄）：') || '').trim();
      if (!name) { renderGiftSettings(); return; }   // 取消輸入：選單回到原本的選擇
    }
    setActionGift(sel.dataset.action, name);
    renderGiftSettings();
  };
  $('#gs-actions').onchange = onActionChange;
  $('#gs-boss').onchange = onActionChange;
  $('#gs-seen').onchange = e => {
    const sel = e.target.closest('[data-seen]');
    if (!sel) return;
    if (sel.value) setActionGift(sel.value, sel.dataset.seen); else giftSettings.set(sel.dataset.seen, '');
    renderGiftSettings();
  };
  root.querySelectorAll('input[name="gs-other"]').forEach(r => { r.onchange = () => { giftSettings.setIgnoreUnlisted(r.value === 'ignore'); renderGiftSettings(); }; });
  $('#gs-copy').onclick = () => {
    const box = $('#gs-url'); box.select();
    const done = () => { $('#gs-copy').textContent = '已複製'; setTimeout(() => { $('#gs-copy').textContent = '複製'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(done, () => { document.execCommand('copy'); done(); });
    else { document.execCommand('copy'); done(); }
  };
  // 存檔名稱：記在這個瀏覽器裡，並寫進直播用網址
  try { $('#sv-slot').value = localStorage.getItem('curryLive.liveSlot') || (saving.save.slot === 'default' ? '' : saving.save.slot); } catch (e) { /* 讀不到就留空 */ }
  $('#sv-slot').oninput = () => { try { localStorage.setItem('curryLive.liveSlot', $('#sv-slot').value.trim()); } catch (e) { /* 存不了不影響 */ } renderGiftSettings(); };
  // 場地下拉選單：選了馬上在面板的預覽畫面換，並記在這個瀏覽器、寫進直播用網址
  const arenaSel = $('#p-arena');
  arenaSel.innerHTML = renderer.arenas.list.map(a => `<option value="${a.key}">${a.label}</option>`).join('');
  arenaSel.value = renderer.arenas.get();
  const arenaHint = () => { $('#p-arena-hint').textContent = renderer.arenas.get() === 'none' ? '' : '⚠ 直播畫面要重貼網址才會換場地。'; };
  arenaSel.onchange = () => {
    renderer.arenas.set(arenaSel.value);
    try { localStorage.setItem('curryLive.arena', renderer.arenas.get()); } catch (e) { /* 存不了不影響 */ }
    arenaHint(); renderGiftSettings();
  };
  arenaHint();

  // 可選武將：依陣營分組的勾選清單
  const hsel = saving.heroSettings;
  const facOrder = Object.keys(config.factions).filter(f => heroes.some(h => h.faction === f));
  function renderHeroPool() {
    $('#hs-count').textContent = hsel.count() + '/' + heroes.length;
    $('#hs-list').innerHTML = facOrder.map(f => `<div class="hs-fac" style="color:${config.factions[f].color}">${esc(config.factions[f].label)}</div><div class="hs-grid">` +
      heroes.filter(h => h.faction === f).map(h => `<label><input type="checkbox" data-hero="${h.heroId}"${hsel.isOn(h.heroId) ? ' checked' : ''}> ${esc(h.displayName)}</label>`).join('') + '</div>').join('');
    root.querySelectorAll('#hs-list input[data-hero]').forEach(c => { c.onchange = () => { if (!hsel.set(c.dataset.hero, c.checked)) c.checked = true; game.setHeroPool(hsel.enabled); renderHeroPool(); renderGiftSettings(); }; });
  }
  $('#hs-all').onclick = () => { hsel.setMany(hsel.all); game.setHeroPool(hsel.enabled); renderHeroPool(); renderGiftSettings(); };
  $('#hs-none').onclick = () => { hsel.setMany([hsel.enabled[0]]); game.setHeroPool(hsel.enabled); renderHeroPool(); renderGiftSettings(); };
  renderHeroPool();
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
      addLog(`📦 TikTok 禮物：${seen.get(key).label} ×${ev.count} → ${to}（${g.icon ? '有讀到圖片' : '沒讀到圖片'}）` + (g.raw ? `　原始資料：${g.raw}` : ''));
      renderGiftSettings();
    }
  });

  // 除錯用：把最後收到的那份 TikTok 禮物資料原封不動複製出來，貼給工程人員看
  $('#p-copyraw').onclick = () => {
    const btn = $('#p-copyraw'), reset = () => setTimeout(() => { btn.textContent = '複製最後一份禮物的原始資料（除錯用）'; }, 2000);
    if (!ML.lastGiftRaw) { btn.textContent = '還沒收到任何 TikTok 禮物'; reset(); return; }
    const done = () => { btn.textContent = '已複製，可以貼上了'; reset(); };
    const fallback = () => { const t = document.createElement('textarea'); t.value = ML.lastGiftRaw; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ML.lastGiftRaw).then(done, fallback); else fallback();
  };

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
  $('#p-leave').onclick = () => hub.chat(me(), config.commands.leave[0]);
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
  // BOSS 測試：招換（等於丟招換禮物）、狀態、尾刀測試、清除
  $('#p-bosses').onclick = e => { const b = e.target.closest('button'); if (b) hub.gift(me(), b.dataset.gift, 1); };
  $('#p-boss-hp').onclick = () => game.debugBossHp(0.01);
  $('#p-boss-clear').onclick = () => game.clearBosses();
  setInterval(() => {
    const b = game.getBoss(), q = game.getBossQueue();
    $('#p-boss-status').textContent = b
      ? `場上：Lv.${b.level} ${b.name}　血量 ${Math.max(0, Math.ceil(b.hp))}/${b.maxHp}${b.down ? '（倒下中）' : ''}　招換者：${b.summoner}` + (q.length ? `　排隊 ${q.length} 隻：` + q.map(e => e.name).join('、') : '')
      : '場上沒有 BOSS';
    $('#p-boss-badge').textContent = b ? `${b.name} ${Math.round(b.hp / b.maxHp * 100)}%` : '';
  }, 500);
  // 卡片的展開／收合：記在這個瀏覽器，下次開面板維持原樣
  const OPEN_KEY = 'curryLive.panelOpen';
  let openState = {};
  try { openState = JSON.parse(localStorage.getItem(OPEN_KEY)) || {}; } catch (e) { /* 讀不到就用預設 */ }
  const cards = [...root.querySelectorAll('details.card')];
  cards.forEach(d => {
    if (d.dataset.k in openState) d.open = !!openState[d.dataset.k];
    d.ontoggle = () => { openState[d.dataset.k] = d.open; try { localStorage.setItem(OPEN_KEY, JSON.stringify(openState)); } catch (e) { /* 存不了不影響 */ } };
  });
  $('#p-openall').onclick = () => cards.forEach(d => { d.open = true; });
  $('#p-closeall').onclick = () => cards.forEach(d => { d.open = d.classList.contains('pinned'); });
  // ---------- 雲端存檔 ----------
  const cl = saving.cloud;
  const renderCloud = () => {
    const st = cl.status;
    $('#cl-status').textContent = (st.state === 'ok' ? '🟢 ' : st.state === 'error' ? '🔴 ' : st.state === 'syncing' ? '🟡 ' : '⚪ ') + st.text;
    $('#cl-token').value = cl.token;
    $('#cl-on').textContent = cl.enabled ? '重新連線並讀取' : '開啟雲端存檔';
    $('#cl-badge').textContent = cl.enabled ? (st.state === 'ok' ? '已連線' : st.state === 'error' ? '出錯了' : '已開啟') : '未開啟';
  };
  cl.onStatus(renderCloud);
  const say = (text, good) => { $('#cl-result').textContent = text; $('#cl-result').style.color = good === undefined ? '' : good ? '#2e7d4f' : '#B23F2B'; };
  $('#cl-on').onclick = async () => {
    const typed = $('#cl-token').value.trim();
    if (typed && typed !== cl.token && !cl.setToken(typed)) { say('這個代號格式不對（要 24～64 個英文字母、數字、- 或 _）', false); return; }
    if (!cl.enabled) cl.setToken(cl.newToken());
    renderGiftSettings(); renderCloud();
    say('測試連線中…');
    const r = await cl.test();
    say(r.text, r.ok);
    if (r.ok) { const n = await saving.syncCloud(); if (n >= 0) say(`${r.text}。雲端目前有 ${n} 位觀眾的等級。記得把新的「直播用網址」重貼進直播軟體。`, true); }
  };
  $('#cl-test').onclick = async () => { say('測試連線中…'); const r = await cl.test(); say(r.text, r.ok); };
  $('#cl-copy').onclick = () => { if (!cl.token) return; const b = $('#cl-token'); b.select(); try { navigator.clipboard.writeText(cl.token); } catch (e) { document.execCommand('copy'); } say('代號已複製', true); };
  $('#cl-off').onclick = () => { if (cl.enabled && !window.confirm('關閉雲端存檔？\n（雲端上的資料不會被刪除，之後貼回同一組代號就能接回來——請先把代號複製存好）')) return; cl.setToken(''); renderGiftSettings(); renderCloud(); say('已關閉。直播用網址不再帶雲端代號，記得重貼。'); };
  renderCloud();

  // 立即儲存：存本機＋（有開雲端的話）存雲端，並用白話說明存了什麼、沒存什麼
  $('#sv-now').onclick = async () => {
    const btn = $('#sv-now'), out = $('#sv-now-result');
    btn.disabled = true; btn.textContent = '儲存中…'; out.style.color = ''; out.textContent = '';
    let res;
    try { res = await saving.saveNow(); } catch (e) { res = null; }
    btn.disabled = false; btn.textContent = '立即儲存';
    if (!res) { out.style.color = '#B23F2B'; out.textContent = '❌ 儲存時發生錯誤，請再按一次'; return; }
    const lines = []; let bad = false;
    const t = res.time.toTimeString().slice(0, 8);
    if (!res.local.enabled) lines.push('本機：存檔功能已關閉（js/config.js 的 save.enabled）');
    else if (!res.local.ok) { bad = true; lines.push('❌ 本機：存不進這個瀏覽器（可能被瀏覽器擋住了）'); }
    else lines.push(res.local.count ? `✅ 本機：已存（${res.local.count} 位觀眾有進度）` : '✅ 本機：已存。目前沒有人有進度（等級 1、沒擊倒過人），所以沒有東西要記');
    const c = res.cloud;
    if (c) {
      if (c.state === 'ok') lines.push(`✅ 雲端：已存（這次 ${c.count} 位，雲端現在共 ${c.total} 位）`);
      else if (c.state === 'empty') lines.push('雲端：這個視窗沒有真實觀眾的進度可存（面板測試用的假觀眾不會存到雲端）。直播畫面的進度會自動存到雲端');
      else if (c.state === 'busy') lines.push('雲端：剛好在存檔中，幾秒後再按一次');
      else { bad = true; lines.push('❌ ' + c.text.replace(/^雲端存檔：/, '雲端：')); }
    } else lines.push('雲端：未開啟');
    out.style.color = bad ? '#B23F2B' : '#2e7d4f';
    out.innerHTML = `<b>${t}</b><br>` + lines.map(l => l.replace(/</g, '&lt;')).join('<br>');
  };

  // 清空場上：武將和排行榜清掉，但等級保留
  $('#p-reset').onclick = () => { game.reset(true); renderer.reset(); log.innerHTML = ''; };
  // 清除存檔：只清「這個瀏覽器」的這一份，不會動到直播軟體裡的存檔
  $('#p-wipe').onclick = () => {
    if (!window.confirm('確定要清除這個瀏覽器裡的等級存檔嗎？\n（只清這個瀏覽器的，直播軟體裡的存檔不受影響）')) return;
    saving.save.clear(); game.reset(); renderer.reset(); log.innerHTML = '';
    $('#sv-info').textContent = '已清除。';
  };
  $('#sv-info').textContent = `這個瀏覽器目前用的存檔：「${saving.save.slot === 'default' ? '預設' : saving.save.slot}」，開啟時讀到 ${saving.count} 位觀眾的等級。`;
};
