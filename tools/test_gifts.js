// 禮物清單匯入的自動測試：node tools/test_gifts.js
//   1. bridge/gift-catalog.js：把 TikTok 的禮物原始資料（欄位寫法多種）整理成 [{name, diamonds, icon}]
//   2. js/gift-settings.js 的 ML.parseGiftCatalog：面板貼上 gifts.json 的解析與把關
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };

(async () => {
  const { mapGiftList, giftIcon } = await import(path.join(root, 'bridge/gift-catalog.js'));
  const raw = [
    { id: 5655, name: 'Rose', diamond_count: 1, image: { url_list: ['https://p16.example.com/rose.webp', 'https://p19.example.com/rose.webp'] } },
    { id: 5487, name: 'GG', diamond_count: 1, icon: { url_list: ['https://p16.example.com/gg.png'] } },
    { id: 1, name: 'Lion', diamond_count: 29999, image: { url_list: ['http://insecure.example.com/lion.png', 'https://p16.example.com/lion.png'] } },
    { id: 2, name: 'Rose', diamond_count: 99 },                       // 同名只留第一個
    { id: 3, name: '愛心', diamondCount: 5, imageUrl: 'https://p16.example.com/heart.png' },   // 另一種欄位寫法
    { id: 4, name: '煙火', diamond_count: 1088, gift_image: { url: 'https://p16.example.com/fw.png' } },
    { id: 5, name: '沒有圖', diamond_count: 10, avatar: { url_list: ['https://p16.example.com/avatar.png'] } },   // 頭像不算禮物圖
    { id: 6, name: '', diamond_count: 3 },                             // 沒名字：丟掉
    { id: 7, name: 'x'.repeat(61), diamond_count: 3 },                 // 名字太長：丟掉
    null, 'oops',
  ];
  const list = mapGiftList(raw), by = n => list.find(g => g.name === n);
  ok(list.length === 6, '有效禮物 6 個（同名、沒名字、名字太長、壞資料都被濾掉）：' + list.length);
  ok(by('Rose').diamonds === 1 && by('Rose').icon === 'https://p16.example.com/rose.webp', 'Rose：留第一筆、圖片取 image.url_list 第一個 https');
  ok(by('GG').icon.endsWith('/gg.png'), 'GG：圖片取 icon.url_list');
  ok(by('Lion').icon === 'https://p16.example.com/lion.png', 'Lion：http 開頭的圖片跳過，改取下一個 https');
  ok(by('愛心').diamonds === 5 && by('愛心').icon.endsWith('/heart.png'), '另一種欄位寫法（diamondCount、imageUrl）也認');
  ok(by('煙火').icon.endsWith('/fw.png'), 'gift_image.url 也認');
  ok(by('沒有圖').icon === '', '禮物只有頭像（avatar）時不當成禮物圖');
  ok(list.map(g => g.diamonds).every((d, i, a) => !i || a[i - 1] <= d), '依鑽石數由小排到大');
  ok(mapGiftList({ gifts: raw }).length === 6 && mapGiftList({ a: raw[0], b: raw[1] }).length === 2, '包在 { gifts } 裡、或是物件型態的清單也能讀');
  ok(mapGiftList(null).length === 0 && mapGiftList([]).length === 0 && giftIcon(null) === '', '空資料不會壞');

  // 面板這邊的解析
  const sb = { console, Math, Date, JSON, window: {} }; sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/gift-settings.js'), 'utf8'), sb);
  const P = sb.ML.parseGiftCatalog;
  ok(P('玫瑰 1\n愛心 5') === null && P('') === null && P('Rose') === null, '不是 JSON（一行一個名稱的舊寫法）回傳 null，交給舊的解析');
  const file = JSON.stringify({ from: '@x', gifts: list });
  const r = P(file); ok(r && r.list && r.list.length === 6 && r.list.find(g => g.name === 'Rose').icon.endsWith('rose.webp'), '貼上 gifts.json 的內容可以整份讀進來');
  ok(P(JSON.stringify(list)).list.length === 6, '直接貼陣列也行');
  ok(P('{"gifts": [').error && P('[1,2,').error, 'JSON 貼到一半：回傳友善的錯誤，不當機');
  ok(P('{"x":1}').error && P('[]').error && P('[{"name":""}]').error, '沒有有效禮物：回傳錯誤');
  const bad = P(JSON.stringify([{ name: 'A', diamonds: 1, icon: 'javascript:alert(1)' }, { name: 'B', icon: 'data:image/png;base64,xx' }, { name: 'C', icon: 'http://x/y.png' }, { name: 'D', icon: 'https://x/y.png' }, { name: 'D', icon: 'https://x/z.png' }]));
  ok(bad.list.length === 4 && bad.list.slice(0, 3).every(g => g.icon === '') && bad.list[3].icon === 'https://x/y.png', '只收 https 圖片網址（javascript:、data:、http: 都清掉），同名只留第一筆');
  const many = P(JSON.stringify(Array.from({ length: 1500 }, (_, i) => ({ name: 'g' + i, diamonds: i })))); ok(many.list.length === 1000, '最多收 1000 筆');
  ok(P(JSON.stringify([{ name: 'A', icon: 'https://x/' + 'a'.repeat(700) }])).list[0].icon === '', '圖片網址太長（超過 600 字）不收');

  console.log(`${pass} 項通過、${fail} 項失敗`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
