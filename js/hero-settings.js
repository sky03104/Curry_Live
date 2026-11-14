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

  const clean = list => (list || []).map(s => s.trim()).filter(id => valid.has(id));
  function fromUrl() {
    if (params.has('heroes')) { enabled = new Set(clean(params.get('heroes').split(','))); return true; }
    if (params.has('skip')) { const s = new Set(clean(params.get('skip').split(','))); enabled = new Set(all.filter(id => !s.has(id))); return true; }
    return false;
  }
  function fromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && Array.isArray(saved.enabled)) enabled = new Set(clean(saved.enabled));
    } catch (e) { /* 讀不到就全開 */ }
  }
  if (!fromUrl()) fromStorage();
  if (!enabled.size) enabled = new Set(all);   // 一隻都沒開的設定視為無效，退回全開

  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ enabled: [...enabled] })); } catch (e) { /* 存不了不影響這次使用 */ } }
  return {
    all,
    get enabled() { return [...enabled]; },
    isOn: id => enabled.has(id),
    count: () => enabled.size,
    // 勾選／取消勾選；至少要留一隻，最後一隻不能取消。回傳是否成功
    set(id, on) {
      if (!valid.has(id)) return false;
      if (!on && enabled.size <= 1 && enabled.has(id)) return false;
      if (on) enabled.add(id); else enabled.delete(id);
      persist(); return true;
    },
    setMany(ids) { const s = new Set(clean(ids)); if (!s.size) return false; enabled = s; persist(); return true; },
    // 要加進直播用網址的參數（全開時什麼都不加）
    urlParams() {
      if (enabled.size === all.length) return {};
      const off = all.filter(id => !enabled.has(id));
      return off.length < enabled.size ? { skip: off.join(',') } : { heroes: [...enabled].join(',') };
    },
  };
};
