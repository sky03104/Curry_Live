// ============================================================
// 萌戰三國・直播亂鬥 —— 設定檔
// 想調整遊戲手感，改這個檔就好，不用動其他程式。
// 改完存檔，重新整理網頁（OBS 裡是「重新整理瀏覽器來源」）就生效。
// ============================================================
window.GAME_CONFIG = {

  // ---------- 血量與復活 ----------
  hpMultiplier: 1,              // 血量倍率。武將血量 = heroes 資料的 baseHp × 這個數字
  reviveSeconds: 60,            // 倒地後要等幾秒，送禮才能復活
  removeDownedAfterSeconds: 300, // 倒地超過幾秒都沒復活，就自動離場（把位置讓出來）
  leaveRejoinSeconds: 60,       // 留言「烙跑」下場後，要等幾秒才能再上場（不然血快沒了就烙跑、馬上回來又是滿血）。設 0 = 不用等
  idleRemoveSeconds: 3600,      // 超過幾秒沒留言也沒送禮，就自動離場（TikTok 不會通知誰離開直播間，只能這樣判斷）

  // ---------- 換武將 ----------
  // 已在場上的觀眾，留言「剛好只有武將名」就會換成那隻武將，血量照比例帶過去。
  switchCooldownSeconds: 5,     // 換過一次後，要等幾秒才能再換（避免有人狂換洗版）

  // ---------- 場地 ----------
  maxOnStage: 24,               // 場上最多幾隻武將
  leaderboardSize: 5,           // 排行榜顯示前幾名

  // ---------- 等級 ----------
  // 擊倒別人的武將拿經驗值，滿了就升級。等級跟著觀眾走，換武將、倒地、離場再回來都還在；
  // 但重新整理網頁會全部歸零（遊戲沒有存檔）。
  leveling: {
    maxLevel: 99,               // 等級上限
    xpPerKillBase: 50,          // 每擊倒一隻，固定拿到的經驗值
    xpPerKillPerVictimLevel: 10, // 再加上「對手等級 × 這個數字」（打倒高等的拿比較多）
    xpNeedBase: 40,             // 升到下一級需要的經驗值 = xpNeedBase + xpNeedPerLevel × 目前等級
    xpNeedPerLevel: 10,         //   例如 1 級升 2 級要 50；30 級升 31 級要 340
    hpPerLevel: 0.015,          // 每升一級，血量多「基礎值的 1.5%」（99 級約 2.5 倍）
    atkPerLevel: 0.015,         // 每升一級，攻擊多「基礎值的 1.5%」（99 級約 2.5 倍）
    defPerLevel: 0.01,          // 每升一級，防禦多「基礎值的 1%」（99 級約 2 倍）
  },

  // ---------- 存檔 ----------
  // 每位觀眾的等級、經驗值、擊倒數會自動存起來，下次開播還在（詳細說明見 js/save.js）。
  save: {
    enabled: true,              // false = 不存檔，每次開播等級都從 1 開始
    intervalSeconds: 5,         // 每隔幾秒存一次（有變動才存）
    // 雲端存檔（Firebase）：要在面板按「開啟雲端存檔」產生代號後才會真的使用，詳見 js/cloud-save.js
    cloud: {
      enabled: true,            // false = 完全不使用雲端存檔
      projectId: 'mengzhan-sanguo',
      apiKey: 'AIzaSyBzJytVzlJv2E6_6bSgs42WHG-2YFmhSuY',   // Firebase 網頁用金鑰，本來就是公開的，不是密碼
      baseUrl: 'https://firestore.googleapis.com',
      intervalSeconds: 30,      // 每隔幾秒存一次雲端（有變動才存）。Firebase 免費額度每天 2 萬次寫入，這個數字很夠用
    },
  },

  // ---------- 傷害 ----------
  // 防禦怎麼減傷：實際傷害 = 原本傷害 × defenseFactor ÷（defenseFactor + 對方防禦）
  //   對方防禦 50 → 傷害剩 67%；防禦 100 → 剩 50%；防禦 200 → 剩 33%
  defenseFactor: 100,
  damageVariance: 0.1,          // 傷害浮動幅度。0.1 = 每次傷害上下浮動 10%
  maxGiftCombo: 10,             // 一次連送很多個同樣禮物時，最多算幾個

  // ---------- 四種動作 ----------
  // 傷害 = 武將的攻擊（含等級加成）× atkMultiplier × 禮物數量，再被對方防禦打折
  // 回血 = 武將最大血量 × healPercent × 禮物數量
  actions: {
    attack: { label: '普攻',     atkMultiplier: 2.0 },   // 打一個對象
    aoe:    { label: '全場攻擊', atkMultiplier: 1.4 },   // 打場上所有其他人
    skill:  { label: '技能',     atkMultiplier: 5.5 },   // 打一個對象，很痛
    heal:   { label: '回血',     healPercent: 0.35 },    // 補自己；如果先 @ 鎖定了另一位玩家，就改補他
    // 招換 BOSS：這三個「動作」不是攻擊，是把 BOSS 叫到場上（BOSS 的數值在下面的 boss.list）
    boss1:  { label: '招換魔龍', summon: 'boss_dragon' },
    boss2:  { label: '招換凱薩', summon: 'boss_caesar' },
    boss3:  { label: '招換巨猿', summon: 'boss_ape' },
  },

  // ---------- 禮物對應 ----------
  // id：程式內部代號。之後接真的 TikTok 時，會把 TikTok 的禮物對應到這裡的 id。
  // action：對應上面四種動作之一（attack / aoe / skill / heal）
  gifts: [
    { id: 'rose',     name: '玫瑰', icon: '🌹', action: 'attack' },
    { id: 'firework', name: '煙火', icon: '🎆', action: 'aoe' },
    { id: 'crown',    name: '皇冠', icon: '👑', action: 'skill' },
    { id: 'heart',    name: '愛心', icon: '💖', action: 'heal' },
    { id: 'boss1',    name: '招換深淵魔龍', icon: '🐉', action: 'boss1' },
    { id: 'boss2',    name: '招換深淵凱薩', icon: '👹', action: 'boss2' },
    { id: 'boss3',    name: '招換太古巨猿', icon: '🦍', action: 'boss3' },
  ],

  // ---------- 真的 TikTok 禮物 → 遊戲裡的禮物 ----------
  // 右邊填的是上面 gifts 裡的 id（rose 普攻 / firework 全場攻擊 / crown 技能 / heart 回血）。
  siteUrl: 'https://sky03104.github.io/Curry_Live/',   // 線上網址（面板產生「直播用網址」時用）

  tiktok: {
    tikfinityUrl: 'ws://localhost:21213/',   // TikFinity 電腦版 Event API 的位址（照 TikFinity 的 Tools → Event API 頁面）

    // 一、指定禮物：哪個 TikTok 禮物對應哪個動作。
    //     ★ 建議直接在網頁面板的「TikTok 禮物設定」裡調整，不用改這裡。面板的設定會優先於這裡。
    //     這裡是「還沒在面板設定過」時的預設值。左邊是 TikTok 禮物的英文名稱，右邊是上面 gifts 的 id。
    giftByName: {
    },
    ignoreUnlisted: false,      // true = 沒被指定的禮物一律忽略；false = 照下面的價值分級處理
    // 面板下拉選單裡的「常見禮物」清單（名稱、值幾顆鑽石）。
    // ⚠️ 這份是憑印象整理的，TikTok 的禮物會因地區和時間不同，名稱或價格可能對不上。
    //    以「最近收到的禮物」和 TikFinity 的 Gift Browser 為準；有出入就改這裡，或在面板選「自己輸入名稱」。
    commonGifts: [
      { name: 'Rose', diamonds: 1 },
      { name: 'TikTok', diamonds: 1 },
      { name: 'Heart Me', diamonds: 1 },
      { name: 'GG', diamonds: 1 },
      { name: 'Ice Cream Cone', diamonds: 1 },
      { name: 'Finger Heart', diamonds: 5 },
      { name: 'Rosa', diamonds: 10 },
      { name: 'Perfume', diamonds: 20 },
      { name: 'Doughnut', diamonds: 30 },
      { name: 'Paper Crane', diamonds: 99 },
      { name: 'Little Crown', diamonds: 99 },
      { name: 'Cap', diamonds: 99 },
      { name: 'Hat and Mustache', diamonds: 99 },
      { name: 'Confetti', diamonds: 100 },
      { name: 'Hand Hearts', diamonds: 100 },
      { name: 'Sunglasses', diamonds: 199 },
      { name: 'Hearts', diamonds: 199 },
      { name: 'Corgi', diamonds: 299 },
      { name: 'Money Gun', diamonds: 500 },
      { name: 'Swan', diamonds: 699 },
      { name: 'Train', diamonds: 899 },
      { name: 'Galaxy', diamonds: 1000 },
      { name: 'Fireworks', diamonds: 1088 },
      { name: 'Drama Queen', diamonds: 5000 },
      { name: 'Sports Car', diamonds: 7000 },
      { name: 'Interstellar', diamonds: 10000 },
      { name: 'Rocket', diamonds: 20000 },
      { name: 'Lion', diamonds: 29999 },
      { name: 'Universe', diamonds: 34999 },
    ],

    // 二、照價值分級：沒被上面指定的禮物，看它值幾顆鑽石（TikTok 的禮物定價）。
    //     從最貴的往下比，第一個「大於等於 atLeast」的就採用。
    //     BOSS 預設：沒被指定的禮物，500 鑽招換深淵魔龍、1000 鑽招換深淵凱薩、1500 鑽招換太古巨猿
    //     （想改成指定某個禮物，去面板「招換 BOSS 的禮物」選；不想自動招換就把這三行刪掉）
    giftByDiamonds: [
      { atLeast: 1500, gift: 'boss3' },
      { atLeast: 1000, gift: 'boss2' },
      { atLeast: 500,  gift: 'boss1' },
      { atLeast: 100, gift: 'crown' },      // 100 鑽以上 → 技能
      { atLeast: 20,  gift: 'firework' },   // 20～99 鑽  → 全場攻擊
      { atLeast: 5,   gift: 'heart' },      // 5～19 鑽   → 回血
      { atLeast: 1,   gift: 'rose' },       // 1～4 鑽    → 普攻
    ],
  },

  // ---------- BOSS ----------
  // 觀眾丟「招換禮物」就會把 BOSS 叫到場上（玩家本身不能變成 BOSS，只能招換）。
  //   ・場上同時只會有一隻 BOSS；BOSS 還沒死又有人招換，新的會排隊，前一隻死掉就自動換上來。
  //   ・BOSS 在場上時：每 attackEverySeconds 秒隨機打一位玩家，每 aoeEverySeconds 秒放一次全場攻擊。
  //   ・BOSS 被打倒：經驗值（xp）平均分給「所有打過它的玩家」，最後一擊的人再額外多拿 lastHitBonus（尾刀獎勵）。
  //   ・玩家留言「@BOSS」或「@BOSS的名字」鎖定它。
  // ⚠️ 下面的血量、攻擊、經驗值都是 Claude 先抓的，沒經過真人試玩，開播後看手感再調。
  boss: {
    attackEverySeconds: 10,     // 每幾秒隨機攻擊一位玩家
    aoeEverySeconds: 60,        // 每幾秒放一次全場攻擊
    singleMultiplier: 3,        // 單體攻擊傷害 = BOSS 攻擊 × 這個數字（再被玩家防禦打折）
    aoeMultiplier: 3,           // 全場攻擊傷害 = BOSS 攻擊 × 這個數字（打到每一位玩家）
    autoTargetChance: 0.6,      // 玩家沒鎖定任何人時，有多少機率直接打 BOSS（其餘照原本的隨機對象）
    removeAfterSeconds: 3,      // BOSS 倒下後，過幾秒從場上消失（接著叫出排隊中的下一隻）
    maxQueue: 20,               // 排隊最多幾隻（超過的招換會被擋下）
    maxSummonPerGift: 3,        // 一次連送多個招換禮物，最多叫幾隻
    list: [
      // id：圖檔名（assets/heroes/<id>.png；還沒放圖時會先畫一隻示意用的怪獸）
      // level：顯示的等級　hp／atk／def：血量／攻擊／防禦
      // hasArt：assets/heroes/<id>.png 已經放好圖了就改成 true（false 時畫面先用示意用的怪獸，也不會去載入不存在的圖檔）
      // xp：被打倒時要分給參戰玩家的經驗值總量　lastHitBonus：最後一擊的人額外多拿的經驗值
      { id: 'boss_dragon', displayName: '深淵魔龍', level: 10, hasArt: true,  hp: 6000,  atk: 80,  def: 40,  xp: 1500, lastHitBonus: 500,  skillName: '深淵吐息', aoeName: '深淵風暴', accent: '#ff4fd8' },
      { id: 'boss_caesar', displayName: '深淵凱薩', level: 20, hasArt: true,  hp: 15000, atk: 130, def: 70,  xp: 4000, lastHitBonus: 1200, skillName: '凱薩裁決', aoeName: '王權崩落', accent: '#9aa8ff' },
      { id: 'boss_ape',    displayName: '太古巨猿', level: 30, hasArt: true,  hp: 36000, atk: 190, def: 110, xp: 9000, lastHitBonus: 3000, skillName: '遠古重擊', aoeName: '地動山搖', accent: '#ffb04a' },
    ],
  },

  // ---------- 技能演出 ----------
  // 每個兵種放技能時的演出方式（skillFx）：
  //   slam   衝過去重擊，地面裂開
  //   magic  對手腳下出現法陣，然後落雷
  //   ranged 射出光彈
  //   aura   自身光環爆發，對手被光柱擊中
  troops: {
    Vanguard:   { label: '猛將', skillFx: 'slam' },
    Strategist: { label: '謀士', skillFx: 'magic' },
    Ranger:     { label: '遊俠', skillFx: 'ranged' },
    Commander:  { label: '統帥', skillFx: 'aura' },
  },
  skillDim: 0.45,               // 放技能時畫面變暗的程度。0 = 不變暗，1 = 全黑

  // ---------- 待機走動 ----------
  wander: {
    enabled: true,              // true = 武將待機時在場上隨意走動；false = 固定站在格子上
    speed: 0.35,                // 走路速度（每秒走幾個「武將身高」的距離）
    stepMax: 4,                 // 一次最多走多遠（幾個武將身高）
    restMin: 1,                 // 走到定點後，最少停幾秒
    restMax: 4,                 // 最多停幾秒
  },

  // ---------- 武將圖原本面向哪邊 ----------
  // 程式假設每張全身圖原本都是「面向左邊」，往右走時會把圖左右翻面。
  // 如果發現某隻武將走路時是倒退著走（背對前進方向），代表牠的原圖其實面向右，
  // 把牠的英文 ID 加進下面這個清單就會修正。例如： ['taishici', 'sunquan']
  artFacesRight: ['taishici'],

  // ---------- 留言指令 ----------
  commands: {
    lockPrefix: '@',            // 「@對方名字」鎖定攻擊目標
    unlock: ['解除鎖定'],       // 留言這些字就解除鎖定（可以多加幾種說法）
    leave: ['烙跑', '落跑'],    // 留言「整句剛好就是這些字」（後面加標點、空白沒關係）→ 自己的武將下場。可以多加幾種說法
  },

  // ---------- 武將別名 ----------
  // 觀眾留言這些字也算點名該武將。左邊是別名，右邊是武將英文 ID（照 data/heroes.js）。
  // 例如想讓簡體字「吕布」也有效： '吕布': 'lvbu'
  heroAliases: {
  },

  // ---------- 陣營 ----------
  factions: {
    Wei: { label: '魏', color: '#4A7FA5' },
    Shu: { label: '蜀', color: '#5C9C89' },
    Wu:  { label: '吳', color: '#C0872E' },
    Qun: { label: '群', color: '#A5527E' },
    Boss: { label: 'BOSS', color: '#B45CFF' },   // BOSS 專用陣營（只能被招換，玩家不能變成 BOSS）
    Meng: { label: '萌', color: '#E0709A' },   // 萌國（直播亂鬥自己加的陣營，米其林）。畫面上顯示一個字，名冊圖叫「萌國」
  },
};
