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

  // ---------- 場地 ----------
  maxOnStage: 24,               // 場上最多幾隻武將
  leaderboardSize: 5,           // 排行榜顯示前幾名

  // ---------- 傷害 ----------
  damageVariance: 0.1,          // 傷害浮動幅度。0.1 = 每次傷害上下浮動 10%
  maxGiftCombo: 10,             // 一次連送很多個同樣禮物時，最多算幾個

  // ---------- 四種動作 ----------
  // 傷害 = 武將的 baseAtk × atkMultiplier × 禮物數量
  // 回血 = 武將最大血量 × healPercent × 禮物數量
  actions: {
    attack: { label: '普攻',     atkMultiplier: 1.5 },   // 打一個對象
    aoe:    { label: '全場攻擊', atkMultiplier: 1.0 },   // 打場上所有其他人
    skill:  { label: '技能',     atkMultiplier: 4.0 },   // 打一個對象，很痛
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
