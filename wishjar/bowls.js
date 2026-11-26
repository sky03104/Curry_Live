/* 許願碗清單：設定頁（setup.html）和許願碗畫面（index.html）都讀這一份。
   新增一個碗：把兩層圖放進 wishjar/（或資料夾），在下面加一筆。
   欄位：id 網址用的代號（&bowl=代號）、name 顯示名稱、back 禮物後面那層、front 禮物前面那層（半透明蓋上去）、
   U/cx/cy/openW 是「碗口中心與寬度」的位置（用同一把尺：U 是整張圖在這把尺上的邊長，cx、cy 是碗口中心，openW 是碗口寬）、depth/foot 是碗深、圈足高度佔碗口寬度的比例。 */
window.WJ_BOWLS = [
  { id: 'blue', name: '乞丐碗', back: 'bowl_back.png', front: 'bowl_front.png', U: 260, cx: 127, cy: 88, openW: 222, depth: 0.428, foot: 0.0405, widthFrac: 0.58, noseY: 8 },
  // 鬥牛犬藍碗：整張圖（狗＋碗）縮進畫面，碗在圖的左下；U／Uh 是圖寬高，cx／cy 碗口橢圓中心，openW 碗口內寬；front 不透明（碗壁把掉進碗裡的禮物下半截遮住）
  { id: 'dog', name: '米其林碗', back: 'bowl2_back.png', front: 'bowl2_front.png', fit: true, giftScale: 1.8, padLeft: 330, U: 1208, Uh: 922, cx: 318, cy: 634, openW: 500, depth: 0.15, foot: 0.408, floorGap: 9, noseY: 250 },
  // 大寶狗碗：同一個碗，旁邊趴的是柴犬（狗在右邊；地板取在碗底與狗掌之間）
  { id: 'shiba', name: '大寶狗碗', back: 'bowl3_back.png', front: 'bowl3_front.png', fit: true, giftScale: 1.8, padLeft: 330, U: 1206, Uh: 928, cx: 334, cy: 611, openW: 500, depth: 0.14, foot: 0.462, floorGap: 16, noseY: 337 },
  // 逐格動畫版：整隻狗是一排連續圖（make_dog_strip.py 做的），碗另外一張只有碗（make_bowl_only.py）；pad＝圖上方多留的空間（狗站起來比較高）。
  // anim：sheet 動畫條、n 格數、fw／fh 每格大小、k 縮放、ax／ay 每格右下角（屁股＋腳底）貼在圖上的位置、states 各階段用哪幾格（從 0 算）、mouth 每格嘴巴位置
  { id: 'dog_anim', name: '米其林碗(動畫版)', back: 'bowl2_bowl.png', front: 'bowl2_front.png', fit: true, giftScale: 1.8, padLeft: 330, U: 1208, Uh: 1002, pad: 80, cx: 318, cy: 714, openW: 500, depth: 0.15, foot: 0.408, floorGap: 9, noseY: 330,
    anim: { sheet: 'dogstrip_bowl2.png', n: 8, fw: 299, fh: 296, k: 3.2, ax: 1207, ay: 935, fps: 8, loopFps: 5, states: { rest: 7, up: [7, 1, 2], loop: [2, 3, 5, 6], down: [6, 1, 7] },
      mouth: [[106, 146], [95, 156], [106, 182], [99, 222], [98, 154], [97, 130], [84, 120], [89, 180]] } },
  { id: 'shiba_anim', name: '大寶狗碗(動畫版)', back: 'bowl3_bowl.png', front: 'bowl3_front.png', fit: true, giftScale: 1.8, padLeft: 330, U: 1206, Uh: 988, pad: 60, cx: 334, cy: 671, openW: 500, depth: 0.14, foot: 0.462, floorGap: 16, noseY: 397,
    anim: { sheet: 'dogstrip_bowl3.png', n: 8, fw: 288, fh: 390, k: 2.5, ax: 1205, ay: 965, fps: 8, loopFps: 5, states: { rest: 7, up: [7, 1, 2], loop: [2, 3, 5, 6], down: [6, 1, 7] },
      mouth: [[106, 184], [63, 170], [56, 218], [56, 288], [78, 161], [60, 121], [83, 104], [71, 172]] } }
];
