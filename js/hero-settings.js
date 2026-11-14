// ============================================================
// 可選武將：這位實況主要開放哪些武將讓觀眾選。
// 每個人各設各的：存在自己的瀏覽器，並寫進自己的「直播用網址」。
//   &heroes=a,b,c   只開放這幾隻（開放的比較少時用）
//   &skip=a,b       排除這幾隻，其餘都開放（排除的比較少時用）
//   都沒有 = 全部開放
// 已經在場上的武將不受影響；只是之後沒人能再選到被關掉的武將。
// ============================================================
window.ML = window.ML || {};

ML.createHeroSettings = function (heroes, params) {
  const KEY = 'curryLive.heroSettings.v1';
  const all = heroes.map(h => h.heroId);
  const valid = new Set(all);
  let enabled = new Set(all);
  // 預設武將：還沒上場就送禮的觀眾會自動帶著它上場。'' = 不自動上場。沒設定過就用名單第一隻。
  const FALLBACK_DEF = all[0] || '';
  let def = FALLBACK_DEF;

  const clean = list => (list || []).map(s => s.trim()).filter(id => valid.has(id));
  function fromUrl() {
    if (params.has('def')) { const v = params.get('def'); def = valid.has(v) ? v : ''; }
    if (params.has('heroes')) { enabled = new Set(clean(params.get('heroes').split(','))); return true; }
    if (params.has('skip')) { const s = new Set(clean(params.get('skip').split(','))); enabled = new Set(all.filter(id => !s.has(id))); return true; }
    return params.has('def');
  }
  function fromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && Array.isArray(saved.enabled)) enabled = new Set(clean(saved.enabled));
      if (saved && typeof saved.def === 'string') def = valid.has(saved.def) ? saved.def : '';
    } catch (e) { /* 讀不到就全開 */ }
  }
  if (!fromUrl()) fromStorage();
  if (!enabled.size) enabled = new Set(all);   // 一隻都沒開的設定視為無效，退回全開

  let appliedAt = 0;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ enabled: [...enabled], def })); } catch (e) { /* 存不了不影響這次使用 */ } }
  return {
    all,
    get enabled() { return [...enabled]; },
    isOn: id => enabled.has(id),
    count: () => enabled.size,
    // 實際生效的預設武將：必須是開放的武將，否則改用開放的第一隻（網址裡 heroes= 沒包含它時會發生）；'' = 不自動上場
    get defaultId() { return !def ? '' : enabled.has(def) ? def : [...enabled][0]; },
    // 設定預設武將（它會自動被開放）；給 '' = 不自動上場
    setDefault(id) { if (id && !valid.has(id)) return false; def = id || ''; if (def) enabled.add(def); persist(); return true; },
    // 勾選／取消勾選；至少要留一隻；預設武將一定要開放，取消不掉，最後一隻不能取消。回傳是否成功
    set(id, on) {
      if (!valid.has(id)) return false;
      if (!on && id === def) return false;
      if (!on && enabled.size <= 1 && enabled.has(id)) return false;
      if (on) enabled.add(id); else enabled.delete(id);
      persist(); return true;
    },
    setMany(ids) { const s = new Set(clean(ids)); if (!s.size) return false; if (def) s.add(def); enabled = s; persist(); return true; },   // 預設武將一定留著
    // 雲端同步：面板改了會存到雲端，直播畫面定時讀回來套用（不用重貼網址）
    exportRemote() { return { enabled: [...enabled], def: this.defaultId, at: Date.now() }; },
    applyRemote(h) {
      if (!h || typeof h !== 'object' || !(Number(h.at) > appliedAt) || !Array.isArray(h.enabled)) return false;
      appliedAt = Number(h.at);
      const s = new Set(clean(h.enabled)); if (!s.size) return false;
      def = typeof h.def === 'string' && valid.has(h.def) ? h.def : '';
      if (def) s.add(def);
      enabled = s; persist(); return true;
    },
    // 要加進直播用網址的參數（全開時什麼都不加）
    urlParams() {
      const out = {};
      if (enabled.size !== all.length) {
        const off = all.filter(id => !enabled.has(id));
        if (off.length < enabled.size) out.skip = off.join(','); else out.heroes = [...enabled].join(',');
      }
      const d = this.defaultId;
      if (d !== FALLBACK_DEF) out.def = d || 'none';   // 跟預設值一樣就不寫進網址
      return out;
    },
  };
};
