// ============================================================
// 雲端存檔：把觀眾的等級、經驗值、擊倒數存到 Firebase（Firestore 資料庫）。
//
// 怎麼運作：
//   ・不用 Firebase 的程式庫，直接用瀏覽器呼叫 Firestore 的網路介面（REST），網頁維持純靜態。
//   ・資料存在  curryLiveSaves / {雲端代號} / slots / {存檔名稱}  這一份文件裡。
//   ・「雲端代號」是一串隨機的長密碼（至少 24 個字），整份存檔就靠它保護：
//     知道代號的人才讀得到、寫得到；Firebase 規則不允許列出或刪除別人的存檔。
//     所以代號不要外流（直播用網址裡有它）。
//   ・只有「直播畫面」（網址有 obs=1）會寫入雲端；面板那個視窗只讀取，
//     免得在面板按假按鈕測試的假觀眾，把等級寫進真的存檔。
//   ・兩邊進度衝突時，每位觀眾取「比較高的那份」，不會互相蓋掉。
//   ・只存真實觀眾（代號開頭是 tt:）；面板測試用的假觀眾不會進雲端。
//
// 需要先在 Firebase 後台發布規則（firebase/firestore.rules，做法見 README）。
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
      map.set(p.id, { id: p.id, name: w.name || cur.name || p.name, level: w.level, xp: w.xp, kills: Math.max(cur.kills, p.kills), seen: Math.max(cur.seen, p.seen), adj: w.adj });
      continue;
    }
    const hi = (cur.level !== p.level ? cur.level > p.level : cur.xp >= p.xp) ? cur : p;   // 等級高的贏；同等級比經驗值
    map.set(p.id, { id: p.id, name: (p.seen >= cur.seen ? p.name || cur.name : cur.name || p.name),
      level: hi.level, xp: hi.xp, kills: Math.max(cur.kills, p.kills), seen: Math.max(cur.seen, p.seen), adj: cur.adj });
  }
  return [...map.values()];
};

ML.createCloudSave = function (config, params, slot, opts) {
  const cfg = config.save.cloud || {};
  const canWrite = !!(opts && opts.canWrite);
  const TOKEN_KEY = 'curryLive.cloudToken';
  const MAX_CHARS = 280000;          // 一份存檔的文字上限（Firebase 單份文件上限約 1MB，中文一字最多 3 位元組）
  const listeners = [];
  let token = '', busy = false, pending = null;
  let remote = { profiles: [], updateTime: null, exists: false, known: false };
  let status = { state: 'off', text: '雲端存檔：未開啟' };

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
  const read = name => send('GET', docUrl(name));
  // 寫入用 Firestore 的 commit：可以在請求內容裡指定「前提條件」——
  //   pre = { exists:false }（我要建立新的，已經有人建了就失敗）或 { updateTime }（我要更新我讀到的那一版，別人改過就失敗）。
  //   這樣兩個畫面同時寫的時候，後寫的那個會被擋下來、重讀、合併再寫，不會把對方的進度蓋掉。
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

  function decode(doc) {
    const f = (doc && doc.fields) || {};
    const text = f.data && f.data.stringValue;
    if (!text) return [];
    const data = JSON.parse(text);   // 壞掉會丟錯，由呼叫端處理
    return (data.profiles || []).map(ML.normalizeProfile);
  }
  function encode(profiles) {
    return { v: { integerValue: '1' }, data: { stringValue: JSON.stringify({ profiles }) }, savedAt: { integerValue: String(Date.now()) } };
  }

  // ---------- 讀取 ----------
  async function load() {
    if (!token) return [];
    setStatus('syncing', '雲端存檔：讀取中…');
    const r = await read(slot);
    if (r.status === 404) { remote = { profiles: [], updateTime: null, exists: false, known: true }; setStatus('ok', '雲端存檔：已連線（雲端還沒有資料）'); return []; }
    if (!r.ok) { const e = fail(r); setStatus('error', '雲端存檔：' + e.friendly); throw e; }
    let profiles;
    try { profiles = decode(r.body); } catch (e) {
      const err = Object.assign(new Error('雲端存檔的格式不對，為了安全不會覆蓋它'), { friendly: '雲端存檔的格式不對，為了安全不會覆蓋它' });
      setStatus('error', '雲端存檔：' + err.friendly); throw err;
    }
    remote = { profiles, updateTime: r.body.updateTime, exists: true, known: true };
    setStatus('ok', `雲端存檔：已讀取 ${profiles.length} 位觀眾`);
    return profiles;
  }

  // 整理要寫上去的內容：有變動的觀眾蓋上時間；太大時丟掉最久沒變動的
  function finalize(merged, before) {
    const old = new Map(before.map(p => [p.id, p])), now = Date.now();
    let list = merged.map(p => { const o = old.get(p.id);
      return (o && o.level === p.level && o.xp === p.xp && o.kills === p.kills && o.adj === p.adj) ? p : Object.assign({}, p, { seen: now }); });
    list.sort((a, b) => b.seen - a.seen);
    while (list.length > 1 && JSON.stringify({ profiles: list }).length > MAX_CHARS) list.pop();
    return list;
  }
  const sameContent = (a, b) => a.length === b.length && (() => { const m = new Map(b.map(p => [p.id, p])); return a.every(p => { const o = m.get(p.id); return o && o.level === p.level && o.xp === p.xp && o.kills === p.kills && o.adj === p.adj; }); })();

  // ---------- 寫入（會先跟雲端上的合併，衝突時重試）----------
  async function store(current, o) {
    if (!token || (!canWrite && !(o && o.force))) return null;   // force：使用者在面板明確按了「立即儲存」，這次允許寫
    if (busy) { pending = current; return null; }   // 上一次還沒存完：先記下最新的進度，等它存完馬上再存一次
    if (o && o.force) remote.known = false;           // 手動儲存：先重新讀一次雲端最新的，再合併（才會學到別的視窗剛存的等級）
    busy = true;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!remote.known) await load();
        const merged = finalize(ML.mergeProfiles(remote.profiles, current), remote.profiles);
        if (remote.exists && sameContent(merged, remote.profiles)) { setStatus('ok', `雲端存檔：已是最新（${merged.length} 位觀眾）`); return merged; }
        const r = await write(slot, encode(merged), remote.exists ? { updateTime: remote.updateTime } : { exists: false }, o && o.keepalive ? { keepalive: true } : null);
        if (r.ok) {
          const wr = r.body && r.body.writeResults && r.body.writeResults[0];
          remote = { profiles: merged, updateTime: wr && wr.updateTime, exists: true, known: true };
          setStatus('ok', `雲端存檔：已存到雲端（${merged.length} 位觀眾）`);
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

  // ---------- 測試：寫一份小資料再讀回來 ----------
  async function test() {
    if (!token) return { ok: false, text: '還沒有雲端代號，請先按「開啟雲端存檔」' };
    const stamp = String(Date.now());
    const w = await write('連線測試', { v: { integerValue: '1' }, data: { stringValue: JSON.stringify({ profiles: [], test: stamp }) }, savedAt: { integerValue: stamp } });
    if (!w.ok) return { ok: false, text: '寫入失敗：' + explain(w) };
    const g = await read('連線測試');
    if (!g.ok) return { ok: false, text: '寫入成功，但讀回失敗：' + explain(g) };
    let back = ''; try { back = JSON.parse(g.body.fields.data.stringValue).test; } catch (e) { /* 比對不到就算失敗 */ }
    return back === stamp ? { ok: true, text: '成功！寫入和讀回都正常，雲端存檔可以使用' } : { ok: false, text: '寫入後讀回的內容不一樣' };
  }

  function newToken() {
    const bytes = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');   // 32 個字
  }
  function setToken(t) {
    t = String(t || '').trim();
    if (t && !validToken(t)) return false;
    token = t; remote = { profiles: [], updateTime: null, exists: false, known: false };
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 存不了不影響這次使用 */ }
    setStatus(t ? 'idle' : 'off', t ? '雲端存檔：已設定，尚未連線' : '雲端存檔：未開啟');
    return true;
  }

  return {
    get enabled() { return !!token; }, get token() { return token; }, canWrite,
    get status() { return status; }, onStatus(fn) { listeners.push(fn); },
    load, store, test, newToken, setToken,
  };
};
