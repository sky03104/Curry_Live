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
  idleRemoveSeconds: 180,       // 超過幾秒沒留言也沒送禮，就自動離場（TikTok 不會通知誰離開直播間，只能這樣判斷）

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
    hpPerLevel: 0.04,           // 每升一級，血量多「基礎值的 4%」（99 級約 4.9 倍）
    atkPerLevel: 0.04,          // 每升一級，攻擊多「基礎值的 4%」
    defPerLevel: 0.03,          // 每升一級，防禦多「基礎值的 3%」
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
    heal:   { label: '回血',     healPercent: 0.35 },    // 補自己
  },

  // ---------- 禮物對應 ----------
  // id：程式內部代號。之後接真的 TikTok 時，會把 TikTok 的禮物對應到這裡的 id。
  // action：對應上面四種動作之一（attack / aoe / skill / heal）
  gifts: [
    { id: 'rose',     name: '玫瑰', icon: '🌹', action: 'attack' },
    { id: 'firework', name: '煙火', icon: '🎆', action: 'aoe' },
    { id: 'crown',    name: '皇冠', icon: '👑', action: 'skill' },
    { id: 'heart',    name: '愛心', icon: '💖', action: 'heal' },
  ],

  // ---------- 真的 TikTok 禮物 → 遊戲裡的禮物 ----------
  // 右邊填的是上面 gifts 裡的 id（rose 普攻 / firework 全場攻擊 / crown 技能 / heart 回血）。
  tiktok: {
    tikfinityUrl: 'ws://localhost:21213/',   // TikFinity 電腦版 Event API 的位址（照 TikFinity 的 Tools → Event API 頁面）

    // 一、指定名稱：TikTok 禮物的英文名稱剛好等於左邊時，就用右邊的動作（優先於下面的價值分級）。
    //     名稱會顯示在橋接程式的視窗裡（🎁 某某 送出 Rose…），照抄即可。例如： 'Rose': 'rose'
    giftByName: {
    },
    // 二、照價值分級：沒被上面指定的禮物，看它值幾顆鑽石（TikTok 的禮物定價）。
    //     從最貴的往下比，第一個「大於等於 atLeast」的就採用。
    giftByDiamonds: [
      { atLeast: 100, gift: 'crown' },      // 100 鑽以上 → 技能
      { atLeast: 20,  gift: 'firework' },   // 20～99 鑽  → 全場攻擊
      { atLeast: 5,   gift: 'heart' },      // 5～19 鑽   → 回血
      { atLeast: 1,   gift: 'rose' },       // 1～4 鑽    → 普攻
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
  },
};
