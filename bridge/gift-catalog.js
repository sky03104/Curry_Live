// 把 TikTok 的「禮物清單」整理成遊戲面板能匯入的格式：[{ name, diamonds, icon }]
// 單獨一個檔案、不連網路，方便用假資料測試（tools/test_gifts.js）。
// ⚠️ TikTok 回傳的欄位名稱沒有官方文件，這裡是依套件說明（id / name / diamond_count）和常見寫法（image.url_list、icon.url_list）盡量多認幾種；
//    第一次用真的資料跑時，如果圖片沒抓到，用 `node gifts.js <帳號> --raw` 看原始資料，再把欄位名稱補進來。
const firstUrl = v => {
  if (!v) return '';
  if (typeof v === 'string') return /^https:\/\//.test(v) ? v : '';
  if (Array.isArray(v)) { for (const x of v) { const u = firstUrl(x); if (u) return u; } return ''; }
  if (typeof v === 'object') {
    for (const k of ['url_list', 'urlList', 'url', 'uri_list']) { const u = firstUrl(v[k]); if (u) return u; }
  }
  return '';
};

export function giftIcon(g) {
  if (!g || typeof g !== 'object') return '';
  for (const k of ['image', 'icon', 'gift_image', 'giftImage', 'picture', 'image_url', 'imageUrl', 'icon_url', 'giftPictureUrl']) { const u = firstUrl(g[k]); if (u) return u; }
  for (const [k, v] of Object.entries(g)) if (/image|icon|picture/i.test(k) && !/avatar|badge|user/i.test(k)) { const u = firstUrl(v); if (u) return u; }   // 其他叫 image／icon／picture 的欄位
  return '';
}

export function mapGiftList(raw) {
  const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.gifts) ? raw.gifts : Object.values(raw || {}));
  const seen = new Set(), out = [];
  for (const g of arr) {
    if (!g || typeof g !== 'object') continue;
    const name = String(g.name ?? g.giftName ?? g.describe ?? '').trim();
    if (!name || name.length > 60) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const d = Number(g.diamond_count ?? g.diamondCount ?? g.diamonds ?? 0);
    out.push({ name, diamonds: Number.isFinite(d) && d > 0 ? Math.floor(d) : 0, icon: giftIcon(g) });
  }
  return out.sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name));
}
