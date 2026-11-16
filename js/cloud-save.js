// ============================================================
// 雲端存檔：把觀眾的等級、經驗值、擊倒數，還有主播的設定、主播按鈕指令存到雲端。
//
// 兩個地方：
//   ・主要：Supabase（資料庫裡的 live_docs 表，只能透過 live_get / live_put 兩個函式讀寫，建表 SQL 見 supabase/schema.sql）。
//   ・備份：Firebase（Firestore）。每次存進 Supabase 之後，順便在 Firebase 留一份；
//     Supabase 連不上時，讀寫自動改走 Firebase，恢復後把這段時間的進度合併回 Supabase。
//     第一次用 Supabase 時，如果裡面還沒有資料，會自動從 Firebase 的舊存檔搬過來。
//   ・兩邊都不用程式庫，直接用瀏覽器呼叫網路介面（REST），網頁維持純靜態。
//
// 「雲端代號」是一串隨機的長密碼（至少 24 個字），整份存檔就靠它保護：
//   知道代號的人才讀得到、寫得到；不能列出或刪除別人的存檔。所以代號不要外流（直播用網址裡有它）。
// 只有「直播畫面」（網址有 obs=1）會寫入雲端；面板那個視窗只讀取，
//   免得在面板按假按鈕測試的假觀眾，把等級寫進真的存檔。
// 兩邊進度衝突時，每位觀眾取「比較高的那份」，不會互相蓋掉。
// 只存真實觀眾（代號開頭是 tt:）；面板測試用的假觀眾不會進雲端。
//
// 設定在 js/config.js 的 save.cloud：supabase（網址＋公開金鑰）、backup（false = 不寫 Firebase 備份）、
//   primary（'firebase' = 暫時只用 Firebase，不用 Supabase）、realtime（false = 不用即時推送，只靠詢問）。
// ============================================================
window.ML = window.ML || {};

// ---------- 兩份進度合併：每位觀眾取比較高的那份 ----------
ML.normalizeProfile = function (p) {
  return {
    id: String(p.id), name: String(p.name || ''),
    level: Math.max(1, Math.floor(Number(p.level)) || 1),
    xp: Math.max(0, Math.floor(Number(p.xp)) || 0),
    kills: Math.max(0, Math.floor(Number(p.kills)) || 0),
    seen: Math.floor(Number(p.seen)) || 0,
    streak: Math.max(0, Math.floor(Number(p.streak)) || 0),   // 單挑連勝數
    adj: Math.floor(Number(p.adj)) || 0,   // 主播手動調整等級的時間（0 = 沒調整過）；調整過的以最後一次調整為準，不會被「取高的」蓋回去
  };
};
ML.mergeProfiles = function (listA, listB) {
  const map = new Map();
  for (const raw of [...(listA || []), ...(listB || [])]) {
    if (!raw || !raw.id) continue;
    const p = ML.normalizeProfile(raw), cur = map.get(p.id);
    if (!cur) { map.set(p.id, p); continue; }
    if (cur.adj !== p.adj) {   // 其中一份有手動調整過：最後一次調整的那份整個算數（可以調低）
      const w = cur.adj > p.adj ? cur : p;
      map.set(p.id, { id: p.id, name: w.name || cur.name || p.name, level: w.level, xp: w.xp, kills: Math.max(cur.kills, p.kills), seen: Math.max(cur.seen, p.seen), adj: w.adj, streak: w.streak });
      continue;
    }
    const hi = (cur.level !== p.level ? cur.level > p.level : cur.xp >= p.xp) ? cur : p;   // 等級高的贏；同等級比經驗值
    map.set(p.id, { id: p.id, name: (p.seen >= cur.seen ? p.name || cur.name : cur.name || p.name),
      level: hi.level, xp: hi.xp, kills: Math.max(cur.kills, p.kills), seen: Math.max(cur.seen, p.seen), adj: cur.adj, streak: hi.streak });
  }
  return [...map.values()];
};

ML.createCloudSave = function (config, params, slot, opts) {
  const cfg = config.save.cloud || {};
  const canWrite = !!(opts && opts.canWrite);
  const TOKEN_KEY = 'curryLive.cloudToken';
  const MAX_CHARS = 280000;          // 一份存檔的文字上限（雲端單份上限約 300KB，中文一字最多 3 位元組）
  const listeners = [];
  let token = '', busy = false, pending = null;
  // mode：這份 remote 是從哪邊讀來的（'sb' = Supabase 主要、'fb' = Firebase 備份）
  let remote = { profiles: [], settings: null, updateTime: null, version: 0, exists: false, known: false, mode: 'sb', needsPush: false };
  let status = { state: 'off', text: '雲端存檔：未開啟' };
  let fbAhead = false;       // 在 Supabase 連不上的時候，進度只存進了 Firebase：Supabase 恢復後要把它合併回來
  let sbDownUntil = 0;       // Supabase 剛連不上：這個時間之前先不要再試（直接走 Firebase），免得每次都白等逾時
  const BK_WARN = ' ⚠ Firebase 備份沒成功';

  const validToken = t => /^[A-Za-z0-9_-]{24,64}$/.test(t || '');
  function readToken() {
    const fromUrl = params.get('cloud');
    if (validToken(fromUrl)) return fromUrl;
    try { const s = localStorage.getItem(TOKEN_KEY); if (validToken(s)) return s; } catch (e) { /* 讀不到就當沒有 */ }
    return '';
  }
  token = cfg.enabled === false ? '' : readToken();

  function setStatus(state, text) {
    status = { state, text };
    listeners.forEach(fn => { try { fn(status); } catch (e) { /* 不讓畫面的錯誤影響存檔 */ } });
  }
  if (token) setStatus('idle', '雲端存檔：已設定，尚未連線');

  // ================= Firebase（備份）=================
  const root = `${cfg.baseUrl}/v1/projects/${cfg.projectId}/databases/(default)/documents`;
  const docUrl = name => `${root}/curryLiveSaves/${token}/slots/${encodeURIComponent(name)}`;
  const docName = name => `projects/${cfg.projectId}/databases/(default)/documents/curryLiveSaves/${token}/slots/${name}`;
  const keyQuery = () => cfg.apiKey ? `key=${encodeURIComponent(cfg.apiKey)}` : '';

  // 送出一個請求。回傳 { ok, status, body }；連不上網路時回傳 { ok:false, status:0, error }
  async function send(method, url, body, extra) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(url + (keyQuery() ? '?' + keyQuery() : ''), Object.assign({
        method, signal: ctl.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }, extra || {}));
      let json = null; try { json = await res.json(); } catch (e) { /* 沒有內容 */ }
      return { ok: res.ok, status: res.status, body: json };
    } catch (e) { return { ok: false, status: 0, error: e }; }
    finally { clearTimeout(timer); }
  }
  const read = (name, extra) => send('GET', docUrl(name), null, extra);
  // 寫入用 Firestore 的 commit：可以在請求內容裡指定「前提條件」——
  //   pre = { exists:false }（我要建立新的，已經有人建了就失敗）或 { updateTime }（我要更新我讀到的那一版，別人改過就失敗）。
  const write = (name, fields, pre, extra) => send('POST', `${root}:commit`, {
    writes: [Object.assign({ update: { name: docName(name), fields }, updateMask: { fieldPaths: ['v', 'data', 'savedAt'] } }, pre ? { currentDocument: pre } : {})],
  }, extra);

  // 把錯誤翻成看得懂的話
  function explain(r) {
    const err = (r.body && r.body.error) || {}, msg = String(err.message || '');
    if (r.status === 0) return r.error && r.error.name === 'AbortError' ? '連線逾時（15 秒沒回應）' : '連不到 Firebase（網路問題，或被擋住了）';
    if (r.status === 403 && err.status === 'PERMISSION_DENIED') return 'Firebase 拒絕存取：規則還沒發布，或發布的不是 firebase/firestore.rules 這份';
    if (r.status === 400 && /api key/i.test(msg)) return 'Firebase 的 API 金鑰無效或被限制';
    if (r.status === 429) return 'Firebase 免費額度用完了（今天不能再存，明天會恢復）';
    if (r.status === 404) return 'Firestore 資料庫還沒建立';
    return `Firebase 回報錯誤 ${r.status}：${msg || '不明原因'}`;
  }
  const conflict = r => r.status === 409 || r.status === 412 ||
    (r.body && r.body.error && ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(r.body.error.status));
  const fail = r => Object.assign(new Error(explain(r)), { friendly: explain(r) });

  // 一份存檔文件裡有兩樣東西：觀眾的進度（profiles），和主播的設定（settings，例如主播文字指令；沒有就是 null）
  function parseObj(data) {
    data = data || {};
    return { profiles: (data.profiles || []).map(ML.normalizeProfile), settings: data.settings && typeof data.settings === 'object' ? data.settings : null };
  }
  function parse(doc) {   // Firebase：內容是一個 JSON 字串
    const f = (doc && doc.fields) || {};
    const text = f.data && f.data.stringValue;
    if (!text) return { profiles: [], settings: null };
    return parseObj(JSON.parse(text));   // 壞掉會丟錯，由呼叫端處理
  }
  function encode(profiles, settings) {
    const data = settings ? { profiles, settings } : { profiles };
    return { v: { integerValue: '1' }, data: { stringValue: JSON.stringify(data) }, savedAt: { integerValue: String(Date.now()) } };
  }

  // ================= Supabase（主要）=================
  // 用資料庫裡的兩個函式 live_get / live_put（見 supabase/schema.sql）：公開金鑰只能透過它們、而且要知道完整的雲端代號才讀寫得到。
  const sbCfg = cfg.supabase || {};
  const sbOn = !!(sbCfg.url && sbCfg.key) && cfg.primary !== 'firebase';
  const sbUsable = () => sbOn && Date.now() >= sbDownUntil;
  async function sbSend(fn, args, extra) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(`${sbCfg.url}/rest/v1/rpc/${fn}`, Object.assign({
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', apikey: sbCfg.key },
        body: JSON.stringify(args),
      }, extra || {}));
      let json = null; try { json = await res.json(); } catch (e) { /* 沒有內容 */ }
      if (!res.ok) sbDownUntil = Date.now() + 30000;   // 沒回成功（連不上、金鑰不對、表還沒建…）：先改走 Firebase，30 秒後再試
      return { ok: res.ok, status: res.status, body: json };
    } catch (e) { sbDownUntil = Date.now() + 30000; return { ok: false, status: 0, error: e }; }
    finally { clearTimeout(timer); }
  }
  function sbExplain(r) {
    const b = r.body || {};
    if (r.status === 0) return r.error && r.error.name === 'AbortError' ? '連線逾時（15 秒沒回應）' : '連不到 Supabase（網路問題，或被擋住了）';
    if (r.ok && b.reason === 'too_big') return '存檔太大，Supabase 不收（上限約 300KB）';
    if (r.ok && b.reason === 'invalid') return '雲端代號格式不對';
    if (r.status === 401 || r.status === 403) return 'Supabase 拒絕存取（金鑰不對，或資料表權限沒設好）';
    if (r.status === 404 || b.code === 'PGRST202') return 'Supabase 還沒建立資料表和函式（要先執行 supabase/schema.sql）';
    if (r.status === 429) return 'Supabase 請求太頻繁，稍後再試';
    if (r.status >= 500) return 'Supabase 暫時不能用（可能是專案被暫停，或服務維護中）';
    return `Supabase 回報錯誤 ${r.status}：${b.message || '不明原因'}`;
  }
  async function sbGet(name, extra) {
    const r = await sbSend('live_get', { p_code: token, p_slot: name }, extra);
    if (!r.ok) return r;
    const row = Array.isArray(r.body) ? r.body[0] : null;
    return Object.assign(r, { exists: !!row, row });
  }
  const sbPut = (name, data, expected, extra) => sbSend('live_put', { p_code: token, p_slot: name, p_data: data, p_expected: expected == null ? null : expected }, extra);
  const sbWrote = r => r.ok && r.body && r.body.ok === true;

  // ================= 讀取 =================
  async function fbLoad(note) {
    const r = await read(slot);
    if (r.status === 404) { remote = { profiles: [], settings: null, updateTime: null, version: 0, exists: false, known: true, mode: 'fb', needsPush: false }; setStatus('ok', '雲端存檔：已連線（雲端還沒有資料）' + (note || '')); return []; }
    if (!r.ok) { const e = fail(r); setStatus('error', '雲端存檔：' + e.friendly + (note ? '；' + note.trim() : '')); throw e; }
    let profiles, settings;
    try { ({ profiles, settings } = parse(r.body)); } catch (e) {
      const err = Object.assign(new Error('雲端存檔的格式不對，為了安全不會覆蓋它'), { friendly: '雲端存檔的格式不對，為了安全不會覆蓋它' });
      setStatus('error', '雲端存檔：' + err.friendly); throw err;
    }
    remote = { profiles, settings, updateTime: r.body.updateTime, version: 0, exists: true, known: true, mode: 'fb', needsPush: false };
    setStatus('ok', `雲端存檔：已讀取 ${profiles.length} 位觀眾` + (note || ''));
    return profiles;
  }

  async function load() {
    if (!token) return [];
    setStatus('syncing', '雲端存檔：讀取中…');
    let note = '';
    if (sbUsable()) {
      const r = await sbGet(slot);
      if (r.ok) {
        if (r.exists) {
          let p;
          try { p = parseObj(r.row.data); } catch (e) { p = null; }
          if (!p) { const err = Object.assign(new Error('x'), { friendly: '雲端存檔的格式不對，為了安全不會覆蓋它' }); setStatus('error', '雲端存檔：' + err.friendly); throw err; }
          remote = { profiles: p.profiles, settings: p.settings, updateTime: null, version: Number(r.row.version) || 1, exists: true, known: true, mode: 'sb', needsPush: false };
          if (fbAhead) {   // Supabase 連不上的那段時間，進度只存在 Firebase：讀回來合併，並在下次存檔時一起推上 Supabase
            const f = await read(slot);
            if (f.ok) { try { const old = parse(f.body); remote.profiles = ML.mergeProfiles(remote.profiles, old.profiles); remote.settings = old.settings || remote.settings; remote.needsPush = true; } catch (e) { /* Firebase 那份壞了就不合併 */ } }
          }
          setStatus('ok', `雲端存檔：已讀取 ${remote.profiles.length} 位觀眾`);
          return remote.profiles;
        }
        // Supabase 還沒有這份存檔：看看 Firebase 有沒有舊的，有就搬過來（第一次存檔時會寫進 Supabase）
        let old = { profiles: [], settings: null };
        const f = cfg.backup === false ? { ok: false } : await read(slot);
        if (f.ok) { try { old = parse(f.body); } catch (e) { /* 舊的壞了就當沒有 */ } }
        remote = { profiles: old.profiles, settings: old.settings, updateTime: null, version: 0, exists: false, known: true, mode: 'sb', needsPush: old.profiles.length > 0 || !!old.settings };
        setStatus('ok', old.profiles.length ? `雲端存檔：已從 Firebase 備份讀到 ${old.profiles.length} 位觀眾，下次存檔會搬到 Supabase` : '雲端存檔：已連線（雲端還沒有資料）');
        return remote.profiles;
      }
      if (cfg.backup === false) { const e = Object.assign(new Error(sbExplain(r)), { friendly: sbExplain(r) }); setStatus('error', '雲端存檔：' + e.friendly); throw e; }   // 沒有備份可以退
      note = `（Supabase 連不上：${sbExplain(r)}；目前改用 Firebase 備份）`;
    } else if (sbOn) {
      if (cfg.backup === false) { const e = Object.assign(new Error('Supabase 剛連不上，稍後再試'), { friendly: 'Supabase 剛連不上，稍後再試' }); setStatus('error', '雲端存檔：' + e.friendly); throw e; }
      note = '（Supabase 剛連不上，目前改用 Firebase 備份）';
    }
    return fbLoad(note);
  }

  // 整理要寫上去的內容：有變動的觀眾蓋上時間；太大時丟掉最久沒變動的
  function finalize(merged, before) {
    const old = new Map(before.map(p => [p.id, p])), now = Date.now();
    let list = merged.map(p => { const o = old.get(p.id);
      return (o && o.level === p.level && o.xp === p.xp && o.kills === p.kills && o.adj === p.adj && o.streak === p.streak) ? p : Object.assign({}, p, { seen: now }); });
    list.sort((a, b) => b.seen - a.seen);
    while (list.length > 1 && JSON.stringify({ profiles: list }).length > MAX_CHARS) list.pop();
    return list;
  }
  const sameContent = (a, b) => a.length === b.length && (() => { const m = new Map(b.map(p => [p.id, p])); return a.every(p => { const o = m.get(p.id); return o && o.level === p.level && o.xp === p.xp && o.kills === p.kills && o.adj === p.adj && o.streak === p.streak; }); })();

  // 存進 Supabase 之後，順便在 Firebase 留一份備份（不等它、失敗也不影響主要存檔）
  function mirror(merged, settings, o) {
    if (cfg.backup === false || !cfg.apiKey) return;
    write(slot, encode(merged, settings), null, o && o.keepalive ? { keepalive: true } : null).then(r => {
      const had = status.text.endsWith(BK_WARN);
      if (!r.ok && !had) setStatus(status.state, status.text + BK_WARN);
      else if (r.ok && had) setStatus(status.state, status.text.slice(0, -BK_WARN.length));
    }).catch(() => { /* 備份失敗不影響遊戲 */ });
  }

  // ================= 寫入（會先跟雲端上的合併，衝突時重試）=================
  async function store(current, o) {
    if (!token || (!canWrite && !(o && o.force))) return null;   // force：使用者在面板明確按了「立即儲存」，這次允許寫
    if (busy) { pending = current; return null; }   // 上一次還沒存完：先記下最新的進度，等它存完馬上再存一次
    if (o && o.force) remote.known = false;           // 手動儲存：先重新讀一次雲端最新的，再合併（才會學到別的視窗剛存的等級）
    if (remote.known && ((remote.mode === 'sb') !== sbUsable())) remote.known = false;   // Supabase 掛了／恢復了：重新讀一次，換到對的那邊
    busy = true;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!remote.known) await load();
        const merged = finalize(ML.mergeProfiles(remote.profiles, current), remote.profiles);
        const settings = (o && o.settings) || remote.settings;   // 要存新的設定就用新的，否則保留雲端上原本的（不會因為存進度而把設定弄丟）
        if (remote.exists && !remote.needsPush && !(o && o.settings) && sameContent(merged, remote.profiles)) { setStatus('ok', `雲端存檔：已是最新（${merged.length} 位觀眾）`); return merged; }

        if (remote.mode === 'sb') {
          const data = settings ? { profiles: merged, settings } : { profiles: merged };
          const r = await sbPut(slot, data, remote.exists ? remote.version : 0, o && o.keepalive ? { keepalive: true } : null);
          if (sbWrote(r)) {
            remote = { profiles: merged, settings, updateTime: null, version: Number(r.body.version) || 1, exists: true, known: true, mode: 'sb', needsPush: false };
            fbAhead = false;
            setStatus('ok', `雲端存檔：已存到雲端（${merged.length} 位觀眾）`);
            mirror(merged, settings, o);
            return merged;
          }
          if (r.ok && r.body && r.body.reason === 'conflict' && !(o && o.keepalive)) { remote.known = false; continue; }   // 別的視窗剛寫過：重新讀一次再合併
          if (r.ok) throw Object.assign(new Error(sbExplain(r)), { friendly: sbExplain(r) });   // 內容被拒絕（太大、代號不對…）：退回 Firebase 也解不了
          remote.known = false; continue;   // Supabase 連不上：sbDownUntil 已設好，下一輪會自動改走 Firebase
        }

        // ---- Firebase（Supabase 連不上時的備援，做法跟以前一樣）----
        const r = await write(slot, encode(merged, settings), remote.exists ? { updateTime: remote.updateTime } : { exists: false }, o && o.keepalive ? { keepalive: true } : null);
        if (r.ok) {
          const wr = r.body && r.body.writeResults && r.body.writeResults[0];
          remote = { profiles: merged, settings, updateTime: wr && wr.updateTime, version: 0, exists: true, known: true, mode: 'fb', needsPush: false };
          if (sbOn) fbAhead = true;
          setStatus('ok', `雲端存檔：已存到雲端（${merged.length} 位觀眾）${sbOn ? '（Supabase 連不上，先存在 Firebase 備份，恢復後會自動合併回去）' : ''}`);
          return merged;
        }
        if (conflict(r) && !(o && o.keepalive)) { remote.known = false; continue; }   // 別的視窗剛寫過：重新讀一次再合併
        throw fail(r);
      }
      throw Object.assign(new Error('衝突'), { friendly: '雲端存檔一直衝突，稍後再試' });
    } catch (e) {
      setStatus('error', '雲端存檔：' + (e.friendly || '存不進去'));
      return null;
    } finally {
      busy = false;
      if (pending) { const next = pending; pending = null; store(next); }
    }
  }

  // ---------- 測試：兩邊各寫一份小資料再讀回來 ----------
  async function test() {
    if (!token) return { ok: false, text: '還沒有雲端代號，請先按「開啟雲端存檔」' };
    const stamp = String(Date.now());
    let sbOk = false, sbText = '';
    if (sbOn) {
      sbDownUntil = 0;   // 手動測試：不管剛才有沒有連不上，都再試一次
      const w = await sbPut('連線測試', { profiles: [], test: stamp }, null);
      if (!sbWrote(w)) sbText = '寫入失敗：' + sbExplain(w);
      else {
        const g = await sbGet('連線測試');
        if (!g.ok || !g.exists) sbText = '寫入成功，但讀回失敗：' + sbExplain(g);
        else if (g.row.data && g.row.data.test === stamp) sbOk = true;
        else sbText = '寫入後讀回的內容不一樣';
      }
    }
    let fbOk = false, fbText = '';
    if (!sbOn || cfg.backup !== false) {
      const w = await write('連線測試', { v: { integerValue: '1' }, data: { stringValue: JSON.stringify({ profiles: [], test: stamp }) }, savedAt: { integerValue: stamp } });
      if (!w.ok) fbText = '寫入失敗：' + explain(w);
      else {
        const g = await read('連線測試');
        let back = ''; try { back = JSON.parse(g.body.fields.data.stringValue).test; } catch (e) { /* 比對不到就算失敗 */ }
        if (!g.ok) fbText = '寫入成功，但讀回失敗：' + explain(g);
        else if (back === stamp) fbOk = true; else fbText = '寫入後讀回的內容不一樣';
      }
    }
    if (!sbOn) return fbOk ? { ok: true, text: '成功！寫入和讀回都正常，雲端存檔可以使用' } : { ok: false, text: fbText };
    if (sbOk) return { ok: true, text: `成功！Supabase（主要）寫入和讀回都正常；Firebase 備份${fbOk ? '也正常' : cfg.backup === false ? '已關閉' : '有問題：' + fbText}` };
    return { ok: false, text: `Supabase（主要）${sbText}。${fbOk ? 'Firebase 備份是正常的，遊戲會自動改用它，不會中斷。' : 'Firebase 備份也有問題：' + fbText}` };
  }

  // ---------- Realtime 即時推送（Supabase Broadcast）----------
  // 主播按鈕送出時，除了寫進資料庫（留紀錄、斷線補收），同時從一條一直開著的連線直接「推」給直播畫面，
  // 不用等直播畫面下一次詢問。直播畫面平常改成每幾秒才看一次資料庫（只是保險）；連線斷了就自動回到每秒詢問。
  // 做法：不用程式庫，直接用瀏覽器的 WebSocket 講 Supabase Realtime 的通訊協定（Phoenix）。頻道名稱由雲端代號組成，不知道代號的人進不來。
  const rtOn = () => sbOn && cfg.realtime !== false && typeof WebSocket !== 'undefined';
  const rt = { ws: null, state: 'off', joined: false, ref: 0, hb: null, retry: 0, timer: null, want: false, lastRx: 0, onCmd: null, onState: null };
  const rtTopic = () => 'realtime:cmd-' + token;
  const rtRaw = obj => { try { rt.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; } };
  function rtSet(state) { if (rt.state === state) return; rt.state = state; if (rt.onState) { try { rt.onState(state); } catch (e) { /* 不讓畫面的錯誤影響連線 */ } } }
  function rtRetry() {
    clearTimeout(rt.timer);
    if (!rt.want || !token) return;
    const base = cfg.realtimeRetryMs || 1000;
    rt.timer = setTimeout(rtConnect, Math.min(15000, base * Math.pow(2, Math.min(rt.retry++, 4))));
  }
  function rtConnect() {
    if (!token || !rtOn()) return;
    rt.want = true;
    if (rt.ws && rt.ws.readyState <= 1) return;   // 已經連著或正在連
    rtSet('connecting'); rt.joined = false;
    let ws;
    try { ws = new WebSocket(`${sbCfg.url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(sbCfg.key)}&vsn=1.0.0`); } catch (e) { rtSet('off'); rtRetry(); return; }
    rt.ws = ws; const topic = rtTopic();
    ws.onopen = () => {
      rt.lastRx = Date.now();
      rtRaw({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } }, ref: String(++rt.ref) });
      clearInterval(rt.hb);
      rt.hb = setInterval(() => {   // 每 25 秒打一次招呼；超過 70 秒沒收到任何東西就當斷線，重連
        if (Date.now() - rt.lastRx > 70000) { try { ws.close(); } catch (e) { /* 已經關了 */ } return; }
        rtRaw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++rt.ref) });
      }, 25000);
    };
    ws.onmessage = ev => {
      rt.lastRx = Date.now();
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && !rt.joined) { if (m.payload && m.payload.status === 'ok') { rt.joined = true; rt.retry = 0; rtSet('live'); } else { try { ws.close(); } catch (e) { /* 已經關了 */ } } return; }
      if (m.event === 'broadcast' && m.payload && m.payload.event === 'cmd') {
        const c = m.payload.payload;
        if (c && typeof c === 'object' && Number(c.seq) > 0 && rt.onCmd) { try { rt.onCmd(c); } catch (e) { /* 一個指令的錯誤不要弄斷連線 */ } }
      }
    };
    ws.onclose = () => { if (rt.ws !== ws) return; clearInterval(rt.hb); rt.joined = false; rt.ws = null; rtSet('off'); rtRetry(); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* 已經關了 */ } };
  }
  function rtStop() { rt.want = false; clearTimeout(rt.timer); clearInterval(rt.hb); const ws = rt.ws; rt.ws = null; rt.joined = false; if (ws) { try { ws.close(); } catch (e) { /* 已經關了 */ } } rtSet('off'); }
  // 直播畫面：開始接收即時推送。onCmd(指令)；onState('live' / 'connecting' / 'off') 連線狀態變化時通知（連上時主程式可順便補讀一次資料庫，避免漏掉斷線期間的指令）
  function listenCommands(onCmd, onState) { rt.onCmd = onCmd; rt.onState = onState || null; if (token) rtConnect(); }
  // 主播按鈕小視窗：先把連線開著，按下去才不用等連線
  function connectRealtime(onState) { if (onState) rt.onState = onState; if (token) rtConnect(); }

  // ---------- 主播按鈕的「指令」（面板點一下 → 直播畫面很快執行）----------
  // 用同一個雲端代號底下另一份文件 __cmd 傳話：面板寫一筆（有一個一直增加的序號），直播畫面每幾秒讀一次，序號變大就執行。
  // 主要走 Supabase；同時也寫一份到 Firebase，Supabase 連不上的時候直播畫面改讀 Firebase。
  const CMD_SLOT = '__cmd';
  async function sendCommand(cmd) {
    if (!token) return { ok: false, text: '還沒開啟雲端存檔' };
    const obj = Object.assign({}, cmd, { seq: Date.now() });
    // 先即時推送（最快）；連線還沒開好就順便開起來，這次靠下面的資料庫補送
    let pushed = false;
    if (rtOn()) { if (rt.joined) pushed = rtRaw({ topic: rtTopic(), event: 'broadcast', payload: { type: 'broadcast', event: 'cmd', payload: obj }, ref: String(++rt.ref) }); else rtConnect(); }
    const fbP = (!sbOn || cfg.backup !== false)
      ? write(CMD_SLOT, { v: { integerValue: '1' }, data: { stringValue: JSON.stringify(obj) }, savedAt: { integerValue: String(Date.now()) } }, null)
      : null;
    if (sbOn) {
      const r = await sbPut(CMD_SLOT, obj, null);
      if (sbWrote(r)) { if (fbP) fbP.catch(() => {}); return { ok: true, pushed }; }
      const f = fbP ? await fbP : null;
      if (pushed) return { ok: true, pushed };   // 資料庫寫不進去，但即時推送已經送出去了
      return f && f.ok ? { ok: true } : { ok: false, text: sbExplain(r) + (f ? '；Firebase 備份也失敗：' + explain(f) : '') };
    }
    const f = await fbP;
    return f.ok ? { ok: true } : { ok: false, text: explain(f) };
  }
  // 回傳 { seq, ... }；雲端還沒有這份文件回傳 { seq: 0 }；連不上或壞掉回傳 null（這次當沒看到，下次再試）
  async function fetchCommand() {
    if (!token) return null;
    if (sbUsable()) {
      const r = await sbGet(CMD_SLOT, { cache: 'no-store' });
      if (r.ok) {
        if (!r.exists) return { seq: 0 };
        const c = r.row.data;
        return c && Number(c.seq) > 0 ? c : { seq: 0 };
      }
      // Supabase 連不上：這次改讀 Firebase 備份
    }
    if (sbOn && cfg.backup === false) return null;
    const r = await read(CMD_SLOT, { cache: 'no-store' });
    if (r.status === 404) return { seq: 0 };
    if (!r.ok) return null;
    try { const c = JSON.parse(r.body.fields.data.stringValue); return c && Number(c.seq) > 0 ? c : { seq: 0 }; } catch (e) { return null; }
  }

  function newToken() {
    const bytes = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');   // 32 個字
  }
  function setToken(t) {
    t = String(t || '').trim();
    if (t && !validToken(t)) return false;
    token = t; remote = { profiles: [], settings: null, updateTime: null, version: 0, exists: false, known: false, mode: 'sb', needsPush: false }; fbAhead = false;
    if (rt.want || rt.ws) { rtStop(); if (t) rt.want = true, rtConnect(); }   // 換了代號：舊頻道斷開，用新的重連
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 存不了不影響這次使用 */ }
    setStatus(t ? 'idle' : 'off', t ? '雲端存檔：已設定，尚未連線' : '雲端存檔：未開啟');
    return true;
  }

  return {
    get enabled() { return !!token; }, get token() { return token; }, canWrite,
    get settings() { return remote.settings; },   // 雲端上目前的主播設定（讀過之後才有）
    get status() { return status; }, onStatus(fn) { listeners.push(fn); },
    load, store, test, newToken, setToken, sendCommand, fetchCommand,
    listenCommands, connectRealtime, stopRealtime: rtStop, get realtimeState() { return rt.state; }, get realtimeLive() { return rt.state === 'live'; },
  };
};
