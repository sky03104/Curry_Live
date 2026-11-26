/* 許願碗清單：設定頁（setup.html）和許願碗畫面（index.html）都讀這一份。
   新增一個碗：把兩層圖放進 wishjar/（或資料夾），在下面加一筆。
   欄位：id 網址用的代號（&bowl=代號）、name 顯示名稱、back 禮物後面那層、front 禮物前面那層（半透明蓋上去）、
   U/cx/cy/openW 是「碗口中心與寬度」的位置（用同一把尺：U 是整張圖在這把尺上的邊長，cx、cy 是碗口中心，openW 是碗口寬）、depth/foot 是碗深、圈足高度佔碗口寬度的比例。 */
window.WJ_BOWLS = [
  { id: 'blue', name: '淺藍瓷碗', back: 'bowl_back.png', front: 'bowl_front.png', U: 260, cx: 127, cy: 88, openW: 222, depth: 0.428, foot: 0.0405 }
];
