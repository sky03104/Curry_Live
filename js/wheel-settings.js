// ============================================================
// 轉輪設定：轉輪上有哪些結果、每累積幾鑽轉一次、有玩家累積滿時要不要自動開、開啟前要不要播語音。
// 跟禮物、可選武將一樣：存在自己的瀏覽器，改了會自動同步到雲端（直播畫面讀回來套用），沒開雲端時寫進直播用網址 &wheel=。
// ============================================================
window.ML = window.ML || {};

ML.createWheelSettings = function (config, params) {
  const KEY = 'curryLive.wheelSettings.v1', wc = config.wheel || {};
  const MAXI = wc.maxItems || 12, MAXC = wc.itemMaxChars || 10;
  const defaults = () => ({ items: (wc.items || []).slice(), threshold: wc.threshold || 1000, autoOpen: wc.autoOpen !== false, voiceEnabled: wc.voiceEnabled !== false });
  let st = defaults(), appliedAt = 0;

  function clean(o) {
    const out = defaults();
    if (!o || typeof o !== 'object') return out;
    if (Array.isArray(o.items)) { const l = o.items.map(t => String(t).trim().slice(0, MAXC)).filter(Boolean).slice(0, MAXI); if (l.length >= 2) out.items = l; }
    const th = Math.floor(Number(o.threshold)); if (th >= 1 && th <= 10000000) out.threshold = th;
    if (typeof o.autoOpen === 'boolean') out.autoOpen = o.autoOpen;
    if (typeof o.voiceEnabled === 'boolean') out.voiceEnabled = o.voiceEnabled;
    return out;
  }
  function fromUrl() {
    if (!params.has('wheel')) return false;
    try { st = clean(JSON.parse(params.get('wheel'))); return true; } catch (e) { return false; }
  }
  function fromStorage() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) st = clean(s); } catch (e) { /* 讀不到就用預設 */ } }
  if (!fromUrl()) fromStorage();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 存不了不影響這次使用 */ } };

  return {
    maxItems: MAXI, maxChars: MAXC,
    get value() { return { items: st.items.slice(), threshold: st.threshold, autoOpen: st.autoOpen, voiceEnabled: st.voiceEnabled }; },
    // 面板改了：o 可以只給要改的欄位
    set(o) { st = clean({ ...st, ...o }); persist(); return this.value; },
    exportRemote() { return { ...this.value, at: Date.now() }; },
    applyRemote(h) {
      if (!h || typeof h !== 'object' || !(Number(h.at) > appliedAt)) return false;
      appliedAt = Number(h.at); st = clean(h); persist(); return true;
    },
    // 加進直播用網址的參數（跟預設值一樣就不加）
    urlParams() {
      return JSON.stringify(st) === JSON.stringify(defaults()) ? {} : { wheel: JSON.stringify(st) };
    },
  };
};
