/* 許願碗清單：設定頁（setup.html）和許願碗畫面（index.html）都讀這一份。
   新增一個碗：把兩層圖放進 wishjar/（或資料夾），在下面加一筆。
   欄位：id 網址用的代號（&bowl=代號）、name 顯示名稱、back 禮物後面那層、front 禮物前面那層（半透明蓋上去）、
   U/cx/cy/openW 是「碗口中心與寬度」的位置（用同一把尺：U 是整張圖在這把尺上的邊長，cx、cy 是碗口中心，openW 是碗口寬）、depth/foot 是碗深、圈足高度佔碗口寬度的比例。 */
window.WJ_BOWLS = [
  { id: 'blue', name: '乞丐碗', back: 'bowl_back.png', front: 'bowl_front.png', U: 260, cx: 127, cy: 88, openW: 222, depth: 0.428, foot: 0.0405 },
  // 鬥牛犬藍碗：整張圖（狗＋碗）縮進畫面，碗在圖的左下；U／Uh 是圖寬高，cx／cy 碗口橢圓中心，openW 碗口內寬；front 不透明（碗壁把掉進碗裡的禮物下半截遮住）
  { id: 'dog', name: '米其林碗', back: 'bowl2_back.png', front: 'bowl2_front.png', fit: true, U: 1208, Uh: 922, cx: 318, cy: 634, openW: 500, depth: 0.15, foot: 0.408, floorGap: 9, noseY: 250 },
  // 大寶狗碗：同一個碗，旁邊趴的是柴犬（狗在右邊；地板取在碗底與狗掌之間）
  { id: 'shiba', name: '大寶狗碗', back: 'bowl3_back.png', front: 'bowl3_front.png', fit: true, U: 1206, Uh: 928, cx: 334, cy: 611, openW: 500, depth: 0.14, foot: 0.462, floorGap: 16, noseY: 337 },
  // 動畫版：同一張圖，狗頭另外一層會動；掉進碗（或地板）3 秒後，狗一個個把禮物吃掉。anim：head 狗頭圖、hx／hy 狗頭圖左上角在整張圖的位置、px／py 轉動支點（脖子）、mx／my 嘴巴位置
  { id: 'dog_anim', name: '米其林碗(動畫版)', back: 'bowl2_body.png', front: 'bowl2_front.png', fit: true, U: 1208, Uh: 922, cx: 318, cy: 634, openW: 500, depth: 0.15, foot: 0.408, floorGap: 9, noseY: 250, anim: { head: 'bowl2_head.png', hx: 269, hy: 0, px: 640, py: 500, mx: 510, my: 470 } },
  { id: 'shiba_anim', name: '大寶狗碗(動畫版)', back: 'bowl3_body.png', front: 'bowl3_front.png', fit: true, U: 1206, Uh: 928, cx: 334, cy: 611, openW: 500, depth: 0.14, foot: 0.462, floorGap: 16, noseY: 337, anim: { head: 'bowl3_head.png', hx: 559, hy: 0, px: 760, py: 490, mx: 750, my: 420 } }
];
