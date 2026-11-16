// ============================================================
// 萌戰三國・直播亂鬥 —— 設定檔
// 想調整遊戲手感，改這個檔就好，不用動其他程式。
// 改完存檔，重新整理網頁（OBS 裡是「重新整理瀏覽器來源」）就生效。
// ============================================================
window.GAME_CONFIG = {

  // ---------- 武將專屬特效（js/hero-fx.js 有每種演出的說明）----------
  // 每隻武將的普攻（attack）和技能（skill）各挑一種演出；沒登記的魏蜀吳群照原本依兵種的演出，沒登記的萌國角色會自動配一組。
  // 新增角色時在這裡加一行；style 從 hero-fx.js 的 STYLES 挑，emoji／color／n 是可調參數。
  heroFx: {
    michelin: { attack: { style: 'bite', color: '#ffffff' }, skill: { style: 'emojiRain', emoji: '🦴', n: 12, color: '#ffe9c0' } },   // 米其林：咬一口、骨頭雨
    dabao:    { attack: { style: 'claw', color: '#ffb36b' }, skill: { style: 'windBlades', emoji: '🍃', color: '#8fffd0' } },          // 大寶：爪痕、風刃旋風
    pudding:  { attack: { style: 'emojiPop', emoji: '💖', color: '#ff8fb8' }, skill: { style: 'heartWave', emoji: '💖', color: '#ff8fb8' } },   // 布丁：愛心爆、暖心光波
    yuge:     { attack: { style: 'emojiPop', emoji: '🎃', color: '#ff9a3c' }, skill: { style: 'emojiRain', emoji: '🎃', n: 9, big: 0.7, color: '#ff9a3c' } },   // 魚哥：南瓜爆、南瓜雨
    hamster:  { attack: { style: 'projectile', emoji: '🧀', color: '#ffd35c' }, skill: { style: 'emojiStorm', emoji: '🧀', n: 18, color: '#ffd35c' } },   // 西當普利鼠：丟起司、起司旋風
    yam:      { attack: { style: 'claw', color: '#b06cff' }, skill: { style: 'tigerPounce', color: '#b06cff' } },                      // 蕃薯：紫色爪痕、猛虎撲殺
    joy:      { attack: { style: 'claw', color: '#ff5a4d' }, skill: { style: 'emojiRain', emoji: '🍗', n: 10, big: 0.6, color: '#ffb36b' } },   // Joy：紅色爪痕、大雞腿雨
    nekomeow: { attack: { style: 'claw', color: '#8f9bff' }, skill: { style: 'emojiStorm', emoji: '🐾', n: 16, color: '#8f9bff' } },   // 那隻喵：藍紫爪痕、肉球旋風
    xiaoni:   { attack: { style: 'shockSmash', color: '#ffd35c' }, skill: { style: 'stampSmash', text: '100T', color: '#ffd35c' } },   // 小妮：重擊震波、100T 大字砸下來
  },
  heroFxAuto: true,   // 沒登記的萌國角色自動配一組專屬特效（false＝不配，維持依兵種的演出）

  // ---------- 賽跑模式（主播按「開放報名」或留言「開放報名」才會用到）----------
  // 報名 3 分鐘 → 3、2、1 開跑 → 沿橢圓跑道跑一圈，每跑完一小段用機率決定要不要停下來休息；玫瑰＝助力（休息機率變低）、GG＝干擾（變高）；只有前三名拿經驗。
  // 只有萌國武將能參賽（三國武將沒有走路／待機動畫）。這些數字是 Claude 先抓的，沒經過真人試玩。
  race: {
    faction: 'Meng',                     // 只有這個陣營的武將能參賽
    signupSeconds: 180, minPlayers: 3, maxPlayers: 8,
    segments: 8, segmentSeconds: 6,      // 一圈分 8 小段，每段約跑 6 秒（不休息的話約 48 秒跑完）
    restChance: 0.4, restMin: 1, restMax: 3,   // 每段結束 40% 機率停下來休息 1～3 秒
    boostStep: 0.05, hinderStep: 0.05,   // 每個玫瑰讓休息機率 -5%，每個 GG +5%
    effectSeconds: 10,                   // 助力／干擾持續幾秒
    chanceMin: 0.05, chanceMax: 0.8,     // 休息機率的下限與上限
    maxGiftCombo: 20,                    // 一次連送最多算幾個
    maxSeconds: 300, resultSeconds: 15, countdown: 3,
    rewards: [2000, 1000, 500],          // 第 1、2、3 名的經驗值（其他人沒有）
    // 障礙賽（主播按「開放障礙賽」或留言「開放障礙賽」；跟一般賽跑各自開）：跑道上有 5 道關卡，跑到時擲骰決定過不過（各關機率不同，越後面越難）。
    // 沒過關＝在關卡前摔倒停 stumbleMin～stumbleMax 秒再繼續（不會淘汰、不會退回）；中途不會因為機率停下來休息。玫瑰每個讓過關率 +5%、GG 每個 -5%（持續秒數與疊加跟賽跑一樣），過關率限制在 chanceMin～chanceMax。
    hurdle: {
      lapSeconds: 36,                    // 完全不摔倒大約幾秒跑完一圈
      passChances: [0.85, 0.75, 0.65, 0.55, 0.45],   // 第 1～5 關的基本過關率
      stumbleMin: 2, stumbleMax: 3,
      chanceMin: 0.05, chanceMax: 0.95,
      obstacles: [{ icon: '🚧', name: '柵欄' }, { icon: '🪨', name: '落石' }, { icon: '🌊', name: '水坑' }, { icon: '🔥', name: '火圈' }, { icon: '🧱', name: '高牆' }],
    },
    // 障礙賽專用的 10 種賽道（形狀與外觀在 js/race-tracks.js，id 都以 h_ 開頭）：開放障礙賽時從這裡隨機挑，不會連續兩場同一種
    hurdleTracks: [
      { id: 'h_jungle', name: '叢林蜿蜒' }, { id: 'h_canyon', name: '峽谷之字' }, { id: 'h_snow', name: '雪山山脊' }, { id: 'h_castle', name: '古堡十字' },
      { id: 'h_candy', name: '糖果齒輪' }, { id: 'h_space', name: '隕石帶' }, { id: 'h_volcano', name: '火山月牙' }, { id: 'h_river', name: '蛇形水道' },
      { id: 'h_terrace', name: '梯田階梯' }, { id: 'h_circus', name: '馬戲六角' },
    ],
    // 賽道：每次開放報名時隨機挑一種（不會連續兩場同一種）。形狀與外觀畫在 js/race-tracks.js，這裡只列 id 和名字
    tracks: [
      { id: 'oval', name: '橢圓田徑場' }, { id: 'kart', name: '賽車場' }, { id: 'eight', name: '八字沙漠' }, { id: 'flower', name: '花瓣花園' },
      { id: 'triangle', name: '冰原三角' }, { id: 'dumbbell', name: '火山啞鈴' }, { id: 'wave', name: '海濱棧道' }, { id: 'star', name: '星空五角' },
      { id: 'heart', name: '愛心賽道' }, { id: 'lshape', name: '城市街道' },
    ],
    giftNames: { boost: ['玫瑰', 'Rose'], hinder: ['GG'] },   // TikTok 禮物名稱（賽跑時專用，跟亂鬥的禮物對照分開）
  },

  // ---------- 轉輪模式（主播按「開啟轉輪」，或有玩家累積滿鑽自動開；平常是亂鬥模式）----------
  // 每位玩家送的禮物鑽石數會累積（只算這場直播），每滿 threshold 鑽就能轉一次大轉輪；轉輪格數＝主播設定的結果有幾項。
  //   ・不管送什麼禮物，鑽石數都照實累積；招換 BOSS、開賽跑、單挑接受這些原本的規則完全不變。
  //   ・轉輪只在「亂鬥模式、場上沒有 BOSS、沒有單挑申請」時才會開；BOSS 在場／單挑／賽跑／陣營賽時，轉的次數先排隊，回到亂鬥再依序轉。
  //   ・每人最多排 maxPending 次，多出來的次數不算；零頭（例如累積 1500 鑽轉一次後剩的 500）會留著繼續累積。
  //   ・累積資料存在瀏覽器，閒置超過 idleHours 小時算新的一場，自動歸零（也可以按主播按鈕「新的一場」歸零）。
  // ⚠️ 這些數字是 Claude 先抓的，沒經過真人試玩。
  wheel: {
    enabled: true,                      // 總開關預設值（面板「轉輪設定」可以改；不需要轉輪的主播取消勾選）
    threshold: 1000,                    // 每累積幾鑽轉一次
    maxPending: 10,                     // 每人最多排幾次（超過的不算；咖哩 2026-11-16 從 3 改 10）
    boardRows: 10,                      // 右上角「轉輪結果」榜最多顯示幾筆（原本 5 筆，咖哩嫌太少）
    autoOpen: true,                     // 有人累積滿鑽時自動開轉輪（false＝只有主播手動開才會轉）
    items: ['再來一次', '唱一首歌', '謝謝參與', '加碼獎勵', '大笑三聲', '挑戰一次', '抽一張卡', '猜拳決勝'],   // 轉輪上的結果（面板「轉輪設定」可以改；2～12 項）
    maxItems: 12, itemMaxChars: 10,
    voiceEnabled: true, voice: 'assets/audio/wheel_voice.mp3', voiceText: '我要轉輪', voiceSeconds: 1.9, voiceVolume: 1,   // 開啟轉輪前先播這段語音（只有「開啟」時播，每次轉不播）；放不出來時照樣開啟
    openSeconds: 0.8, readySeconds: 2.6, spinSeconds: 6, resultSeconds: 8,   // 轉輪跳出動畫、轉之前待機動畫、旋轉、結果顯示各幾秒
    idleHours: 6, historyMax: 30,
    fakeDiamonds: { attack: 1, aoe: 20, skill: 200, heal: 5 },   // 面板測試用的禮物（沒有鑽石數）怎麼算
    colors: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#6c5ce7', '#e84393', '#ff7f50', '#00b894', '#0984e3', '#a29bfe'],
  },

  // ---------- 單挑賽（觀眾留言「@對方名字 單挑」發起；平常是亂鬥模式）----------
  // 流程：甲留言「@乙 單挑」→ 畫面中間跳出申請，乙在 inviteSeconds 秒內送玫瑰＝接受（或留言「接受」），送 GG／留言「拒絕」／沒反應＝拒絕
  //   → 接受後 3、2、1 開打：兩人面對面、其他人在四周圍觀；雙方血量一樣（hp），攻擊力看禮物的價值（鑽石數）。
  //   → 兩人都會每隔幾秒自動小攻擊（沒送禮的人也有動作）；送禮累積怒氣，滿了自動放技能；單挑中不能回血。
  //   → 圍觀的人先留言「@甲」或「@乙」再送禮，就是幫那一邊助攻（打對面）；傷害與怒氣打折（audienceFactor）。
  //   → 贏的人加經驗（連勝越多加成越多）；輸的人扣經驗（可能掉等級）；打倒連勝者拿大量經驗。結束後自動回亂鬥模式。
  // ⚠️ 這些數字是 Claude 先抓的，沒經過真人試玩。
  duel: {
    enabled: true,
    inviteSeconds: 60,                  // 乙幾秒內要回應，沒反應就當拒絕
    inviteCooldown: 300,                // 甲發出申請後，幾秒內不能再發（防刷屏）
    refuseBlock: 600,                   // 被拒絕（含沒反應）後，甲幾秒內不能再挑戰同一個人
    countdown: 3, maxSeconds: 180, resultSeconds: 15,   // 開打倒數、一場最長幾秒（時間到比剩餘血量，一樣多＝和局）、結果顯示幾秒
    hp: 5000,                           // 雙方血量（一樣，不吃等級加成）
    autoAtkEvery: 4, autoAtkDmg: 30, autoRage: 1.5,   // 自動小攻擊：每幾秒一下、每下傷害、每下增加的怒氣
    giftBase: 40, giftExp: 0.5,         // 每個禮物的傷害 = giftBase × 鑽石數^giftExp（0.5＝開根號：大禮比小禮強，但不會強幾百倍）
    giftCapPercent: 0.35,               // 單一份禮物最多打掉血量的幾成（防止一份大禮秒殺）
    maxGiftCombo: 20,                   // 一次連送最多算幾個
    audienceFactor: 0.5,                // 圍觀者助攻的傷害與怒氣打幾折
    rageMax: 100, rageGift: 6, rageHit: 80, skillDmg: 700, skillCooldown: 3, skillDelay: 1.5,   // 怒氣：每份禮物加 rageGift × 鑽石數^giftExp；被打也加（傷害佔血量的比例 × rageHit）；滿了整條怒氣彩色閃爍 skillDelay 秒後自動放技能（傷害 skillDmg），放完歸零，技能之間至少隔 skillCooldown 秒
    supportNoticeMin: 20,               // 圍觀者的助攻禮物至少幾鑽才在訊息區寫出來（免得洗版）
    fakeDiamonds: { attack: 1, aoe: 20, skill: 200 },   // 沒有鑽石數的禮物（面板測試、主播按鈕）怎麼算：動作 → 鑽石數；回血動作在單挑中無效
    giftNames: { accept: ['玫瑰', 'Rose'], refuse: ['GG'] },   // 乙回應用的 TikTok 禮物名稱（玫瑰＝接受、GG＝拒絕）
    // 經驗值：贏的人 =（winBase + winPerLevel × 對手等級）× 連勝加成；連勝加成 = 1 + streakStep ×（連勝數 − 1），最多 streakMaxMult 倍
    //   打倒連勝 breakMinStreak 場以上的人：再加 breakPerStreak × 對方連勝數（最多 breakMax）；
    //   以上全部再乘「等級差折扣」（跟擊倒一樣：比對方高很多級就打折）和「同一對人反覆單挑折扣」（pairWindow 秒內每多打一次少 pairPenalty，最少剩 pairMinFactor）
    //   輸的人 = （loseBase + losePerLevel × 自己等級）×（1 + loserStreakExtra × 自己的連勝數，最多多 loserStreakExtraMax）；扣到不夠會掉等級（1 級最低扣到 0 經驗）
    xp: { winBase: 100, winPerLevel: 20, streakStep: 0.25, streakMaxMult: 3, breakMinStreak: 2, breakPerStreak: 150, breakMax: 2000,
          loseBase: 40, losePerLevel: 8, loserStreakExtra: 0.1, loserStreakExtraMax: 1, pairWindow: 600, pairPenalty: 0.25, pairMinFactor: 0.1 },
  },

  // ---------- 陣營模式（主播按「切換陣營模式」才會用到；平常是亂鬥模式）----------
  // 場地由左到右：紅方主堡｜紅隊武將｜紅方防禦塔｜藍方防禦塔｜藍隊武將｜藍方主堡
  // 規則：只能打敵方（武將、防禦塔、主堡），不能打同隊；敵塔倒了、而且敵方場上武將全部倒地，才能打主堡；主堡倒了那隊輸。
  // 這些數字是 Claude 先抓的，沒經過真人試玩。
  team: {
    towerHp: 6000, towerDef: 40,        // 防禦塔
    towerAtk: 120, towerAttackEvery: 5, // 防禦塔會反擊：每幾秒打敵方一位武將
    baseHp: 12000, baseDef: 60,         // 主堡
    reviveSeconds: [60, 90, 120, 180],  // 陣營模式倒地後的復活冷卻：第 1 次倒地等 60 秒、第 2 次 90、第 3 次 120、第 4 次以後 180（每場重算）
    maxSwitches: 3,                     // 每場最多換隊幾次（第一次選隊不算）
    winXp: 3000, loseXp: 300,           // 贏的隊每人經驗、輸的隊每人經驗（平手兩隊都拿輸的）
    matchSeconds: 1800,                 // 一場最長幾秒；時間到比雙方主堡剩餘血量比例
    resultSeconds: 15,                  // 分出勝負後，顯示結果幾秒再自動開下一場
    colors: { red: '#ff5a4d', blue: '#4aa3ff' },
    names: { red: '紅隊', blue: '藍隊' },
  },

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

  // ---------- 全員同能力 ----------
  // 2026-11-14 咖哩要求：直播亂鬥不像真的遊戲需要搭配，所以所有武將的血量、攻擊、防禦都一樣（用下面這組數字，
  // 不看 data/heroes.js 裡每隻自己的數值——那份是自動從萌戰三國同步來的，改了會被蓋掉，所以統一在這裡覆蓋）。
  // 技能名稱、技能演出、陣營還是各自不同。想恢復每隻自己的數值：把 enabled 改成 false。
  // 數字取原本 41 隻平均（血 682／攻 50／防 31）附近的整數；等級成長照舊，BOSS 的數值不受影響。
  uniformHero: { enabled: true, hp: 1000, atk: 60, def: 35 },   // 2026-11-14 咖哩要求「再調高一點」：700/50/30 → 1000/60/35

  // ---------- 等級 ----------
  // 擊倒別人的武將拿經驗值，滿了就升級。等級跟著觀眾走，換武將、倒地、離場再回來都還在（有存檔，見下面「存檔」）。
  leveling: {
    maxLevel: 99,               // 等級上限
    xpPerKillBase: 50,          // 每擊倒一隻，固定拿到的經驗值
    xpPerKillPerVictimLevel: 10, // 再加上「對手等級 × 這個數字」（打倒高等的拿比較多）
    // 升到下一級需要的經驗值 = xpNeedBase + xpNeedPerLevel × 等級 + xpNeedQuad × 等級²（越高等越難升；2026-11-14 咖哩嫌一天就 54 級，加上平方項）
    //   例如 1 級升 2 級要 52；30 級升 31 級要 2,140；53 級升 54 級要 6,188；98 級升 99 級要 20,228
    xpNeedBase: 40,
    xpNeedPerLevel: 10,
    xpNeedQuad: 2,
    // 擊倒「比自己低很多級」的人，經驗值打折（咖哩 2026-11-14 要求，防止高等刷低等）：對方比自己低 levelGapFree 級以內不打折，
    // 超過的部分每多 1 級少 levelGapPenalty（0.1＝10%），最少剩 levelGapMinFactor（0.1＝10%）。**擊倒比自己高的人不打折**（低等打高等不吃虧）。
    levelGapFree: 5,
    levelGapPenalty: 0.1,
    levelGapMinFactor: 0.1,
    // 同一個人短時間內被反覆打倒，經驗值遞減（咖哩 2026-11-14 要求，防止一直打剛復活的人刷經驗）：
    // 過去 repeatKillWindow 秒（600＝10 分鐘）內已經被打倒過 n 次，這次只拿 (1 − n × repeatKillPenalty)，最少剩 repeatKillMinFactor。
    // 預設：第 1 次 100%、第 2 次 75%、第 3 次 50%、第 4 次 25%、之後 10%。不管是誰打倒的都一起算；設 repeatKillWindow: 0 = 關掉。
    repeatKillWindow: 600,
    repeatKillPenalty: 0.25,
    repeatKillMinFactor: 0.1,
    hpPerLevel: 0.015,          // 每升一級，血量多「基礎值的 1.5%」（99 級約 2.5 倍）
    atkPerLevel: 0.015,         // 每升一級，攻擊多「基礎值的 1.5%」（99 級約 2.5 倍）
    defPerLevel: 0.01,          // 每升一級，防禦多「基礎值的 1%」（99 級約 2 倍）
  },

  // ---------- 存檔 ----------
  // 每位觀眾的等級、經驗值、擊倒數會自動存起來，下次開播還在（詳細說明見 js/save.js）。
  save: {
    enabled: true,              // false = 不存檔，每次開播等級都從 1 開始
    intervalSeconds: 5,         // 每隔幾秒存一次（有變動才存）
    // 雲端存檔（主要 Supabase、備份 Firebase）：要在面板按「開啟雲端存檔」產生代號後才會真的使用，詳見 js/cloud-save.js
    cloud: {
      enabled: true,            // false = 完全不使用雲端存檔
      // 主要：Supabase（2026-11-16 起）。網址和公開金鑰本來就是給網頁用的，不是密碼；資料表權限由 supabase/schema.sql 鎖住。
      supabase: { url: 'https://tjrlpthprtrlmugrofpj.supabase.co', key: 'sb_publishable_u9lUyPB8fr2jmHji_ZVAJA_OtxLQuoS' },
      backup: true,             // true = 每次存進 Supabase 也在 Firebase 留一份備份，Supabase 連不上時自動改走 Firebase；false = 不寫 Firebase
      backupSeconds: 60,        // Firebase 備份最多每幾秒寫一次（省免費寫入額度；這段時間內存幾次，只寫最新的一份；0 = 每次都寫）。主要存檔（Supabase）不受影響
      primary: 'supabase',      // 想暫時退回只用 Firebase，改成 'firebase'
      // 備份：Firebase
      projectId: 'mengzhan-sanguo',
      apiKey: 'AIzaSyBzJytVzlJv2E6_6bSgs42WHG-2YFmhSuY',   // Firebase 網頁用金鑰，本來就是公開的，不是密碼
      baseUrl: 'https://firestore.googleapis.com',
      realtime: true,           // 主播按鈕用 Supabase Realtime 即時推送（約 0.1 秒內到）；false = 只靠下面的詢問
      cmdPollLiveSeconds: 5,    // 即時推送連著的時候，直播畫面改成每隔幾秒才看一次資料庫（只是保險，萬一推送漏了）；連線斷了自動回到下面每秒詢問
      cmdPollSeconds: 1,        // 主播按鈕：直播畫面平常每隔幾秒看一次有沒有新的按鈕指令（每次算 1 次讀取，直播 4 小時約 14,400 次；免費額度每天 5 萬次是所有實況主共用，大約夠 3 位同時直播；想省就調大）
      cmdBurstSeconds: 0.5,     // 剛收到按鈕指令後，改成每隔幾秒看一次（連按幾下反應更快）
      cmdBurstHold: 60,         // 這種「密集模式」維持幾秒
      pullSeconds: 90,          // （保險）直播畫面每隔幾秒重讀一次雲端；平常面板一存檔就會即時通知直播畫面馬上讀，這個只是萬一通知漏了。以前是唯一的同步方式：直播畫面每隔幾秒重讀一次雲端（讓主播在面板調整的等級、主播文字指令設定套用進來，不用重貼網址）。每次算 1 次讀取，一天約 960 次，免費額度每天 5 萬次，大約夠 50 位實況主
      intervalSeconds: 10,      // 每隔幾秒存一次雲端（有變動才存；2026-11-16 從 30 改 10：直播當機最多只掉 10 秒進度）。Supabase 不按次數算；Firebase 備份免費額度每天 2 萬次寫入，一場直播有變動才寫，夠用
    },
  },

  // ---------- 傷害 ----------
  // 防禦怎麼減傷：實際傷害 = 原本傷害 × defenseFactor ÷（defenseFactor + 對方防禦）
  //   對方防禦 50 → 傷害剩 67%；防禦 100 → 剩 50%；防禦 200 → 剩 33%
  defenseFactor: 100,
  damageVariance: 0.1,          // 傷害浮動幅度。0.1 = 每次傷害上下浮動 10%
  hostMaxCount: 1000,           // 主播文字指令「次數」的上限（一次留言最多算幾個禮物）。招換 BOSS 仍用 boss.maxSummonPerGift
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
    buff:   { label: '招換BUFF', summon: ['boss_blue', 'boss_red'] },   // 藍BUFF 或紅BUFF（隨機一隻）
    boss4:  { label: '招換藍BUFF', summon: 'boss_blue' },
    boss5:  { label: '招換紅BUFF', summon: 'boss_red' },
    // 開啟賽跑：這三個「動作」不是攻擊，是把賽跑／障礙賽開放報名（只有亂鬥模式時有效；比賽或陣營賽進行中送了不會生效）。openRace：normal＝一般賽跑、hurdle＝障礙賽、random＝隨機一種
    raceNormal: { label: '開放賽跑', openRace: 'normal' },
    raceHurdle: { label: '開放障礙賽', openRace: 'hurdle' },
    raceAny:    { label: '開放賽跑／障礙賽', openRace: 'random' },
  },

  // ---------- 禮物對應 ----------
  // id：程式內部代號。之後接真的 TikTok 時，會把 TikTok 的禮物對應到這裡的 id。
  // action：對應上面四種動作之一（attack / aoe / skill / heal）
  update: { checkSeconds: 60, quietSeconds: 10 },   // 自動更新：每幾秒去看一次有沒有新版本；要等場上「安靜」（沒 BOSS、最近幾秒沒人出招）才重新整理
  toastSeconds: 60,   // 排行榜下面的訊息文字停留幾秒（2026-11-14 咖哩要求從 5 秒改 60 秒；同時最多顯示 4 則，來了新的會擠掉最舊的）
  gifts: [
    { id: 'rose',     name: '玫瑰', icon: '🌹', action: 'attack' },
    { id: 'firework', name: '煙火', icon: '🎆', action: 'aoe' },
    { id: 'crown',    name: '皇冠', icon: '👑', action: 'skill' },
    { id: 'heart',    name: '愛心', icon: '💖', action: 'heal' },
    { id: 'boss1',    name: '招換深淵魔龍', icon: '🐉', action: 'boss1' },
    { id: 'boss2',    name: '招換深淵凱薩', icon: '👹', action: 'boss2' },
    { id: 'boss3',    name: '招換太古巨猿', icon: '🦍', action: 'boss3' },
    { id: 'buff',     name: '招換BUFF（藍紅隨機）', icon: '🎲', action: 'buff' },
    { id: 'boss4',    name: '招換藍BUFF', icon: '💧', action: 'boss4' },
    { id: 'boss5',    name: '招換紅BUFF', icon: '🔥', action: 'boss5' },
    { id: 'raceany',  name: '開放賽跑／障礙賽（隨機）', icon: '🎲', action: 'raceAny' },
    { id: 'raceg',    name: '開放賽跑', icon: '🏃', action: 'raceNormal' },
    { id: 'hurdleg',  name: '開放障礙賽', icon: '🚧', action: 'raceHurdle' },
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
      { atLeast: 200, gift: 'crown' },      // 200 鑽以上 → 技能（原本 100 鑽以上，100～199 鑽改成招換 BUFF）
      { atLeast: 199, gift: 'raceany' },    // 剛好 199 鑽 → 開放賽跑或障礙賽（隨機一種；想指定哪個禮物開哪一種，去面板「招換 BOSS／開賽跑的禮物」選）
      { atLeast: 100, gift: 'buff' },       // 100～199 鑽 → 招換藍BUFF／紅BUFF（隨機一隻）      // 100 鑽以上 → 技能
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
    attackEverySeconds: 60,     // 每幾秒隨機攻擊一位玩家（2026-11-13 咖哩嫌太快：10 → 60）
    aoeEverySeconds: 300,       // 每幾秒放一次全場攻擊（60 → 300）；剛好撞在同一秒時，那一下只放全場攻擊
    singleMultiplier: 1.5,      // 單體攻擊傷害 = BOSS 攻擊 × 這個數字（再被玩家防禦打折）（2026-11-14 咖哩嫌還是太痛：3 → 1.5）
    aoeMultiplier: 1,           // 全場攻擊傷害 = BOSS 攻擊 × 這個數字（打到每一位玩家）（3 → 1）
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
      // 藍BUFF／紅BUFF：等級 5 的小 BOSS。reward 是「最後一擊的玩家」獲得的效果（持續 seconds 秒，重複獲得會重新計時，不會疊加）：
      //   regenPerSecond 每秒回復多少血　atkMultiplier 攻擊力幾倍
      { id: 'boss_blue',   displayName: '藍BUFF',   level: 5,  hasArt: true,  hp: 2500,  atk: 45,  def: 20,  xp: 600,  lastHitBonus: 200,  skillName: '水晶震盪', aoeName: '藍光爆裂', accent: '#4db8ff',
        reward: { regenPerSecond: 10, seconds: 3600, label: '藍BUFF 效果：每秒回復 10 血' } },
      { id: 'boss_red',    displayName: '紅BUFF',   level: 5,  hasArt: true,  hp: 2500,  atk: 55,  def: 20,  xp: 600,  lastHitBonus: 200,  skillName: '烈焰荊棘', aoeName: '熔岩爆發', accent: '#ff5c4d',
        reward: { atkMultiplier: 2, seconds: 3600, label: '紅BUFF 效果：攻擊力加倍' } },
      { id: 'boss_ape',    displayName: '太古巨猿', level: 30, hasArt: true,  hp: 20000, atk: 190, def: 110, xp: 9000, lastHitBonus: 3000, skillName: '遠古重擊', aoeName: '地動山搖', accent: '#ffb04a' },
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

  // ---------- 逐格動畫 ----------
  // 某隻武將有連續圖時，在這裡登記（圖是一排橫放、每格一樣大，腳底對齊；做法見 tools/make_anim_sheet.py，它會印出這些數字）。
  //   eat：回血時播一次　idle：每次走到定點停下來時播一次（還沒有圖就先不寫）；有 idle2、idle3… 就每次停下來隨機挑一組播
  //   frames 幾格／cw ch 每格寬高（像素）／ground 腳底在第幾列／fps 每秒播幾格／repeat 連續播幾輪（預設 1）
  heroAnims: {
    michelin: {
      walk: { src: 'michelin_walk.png', frames: 8, cw: 512, ch: 397, ground: 394, fps: 9 },   // 走路循環（鬥牛犬搖擺步，8 格）
      eat: { src: 'michelin_eat.png', frames: 8, cw: 461, ch: 390, ground: 346, fps: 3 },
      idle: { src: 'michelin_eat.png', frames: 8, cw: 461, ch: 390, ground: 346, fps: 3, repeat: 3 },   // 待機（走到定點停下來）也先用同一組啃骨頭
      idle2: { src: 'michelin_snack.png', frames: 8, cw: 465, ch: 355, ground: 351, fps: 3, repeat: 3 },   // 第二組待機：吃漢堡喝奶茶。每次停下來隨機挑 idle（啃骨頭）或 idle2（吃漢堡喝奶茶），機率一樣（idle3、idle4 依此類推）
      // 攻擊：低頭衝撞頂飛（8 格，第 5 格撞擊；普攻約 0.6 秒、技能約 0.7 秒，撞到那一格對上命中時間）
      attack: { src: 'michelin_attack.png', frames: 8, cw: 581, ch: 361, ground: 358, fps: 13 },
      skill: { src: 'michelin_attack.png', frames: 8, cw: 581, ch: 361, ground: 358, fps: 11 },
    },
    // 魚哥：一組南瓜桶大揮擊。attack（普攻，約 0.67 秒，第 5 格打中配合衝撞）／skill（技能，衝撞那一刻播）／idle（停下來時播一次）
    yuge: {
      attack: { src: 'yuge_attack.png', frames: 8, cw: 504, ch: 422, ground: 418, fps: 12 },
      skill: { src: 'yuge_attack.png', frames: 8, cw: 504, ch: 422, ground: 418, fps: 10 },
      walk: { src: 'yuge_walk.png', frames: 8, cw: 236, ch: 417, ground: 413, fps: 10 },   // 走路循環（移動時一直播）
      idle: { src: 'yuge_attack.png', frames: 8, cw: 504, ch: 422, ground: 418, fps: 5 },
    },
    // 西當普利鼠：待機吃起司蛋糕（10 格，每秒 4 格，連播 2 輪）
    hamster: {
      idle: { src: 'hamster_cake.png', frames: 10, cw: 269, ch: 309, ground: 306, fps: 4, repeat: 2 },
      // 攻擊：換成大錘子跳起來往下重擊（8 格，第 6 格落地砸中；普攻約 0.5 秒、技能約 1 秒，打中的時間對上第 6 格）
      attack: { src: 'hamster_attack.png', frames: 8, cw: 318, ch: 543, ground: 460, fps: 16 },
      skill: { src: 'hamster_attack.png', frames: 8, cw: 318, ch: 543, ground: 460, fps: 8 },
      walk: { src: 'hamster_walk.png', frames: 7, cw: 271, ch: 324, ground: 320, fps: 9 },   // 走路循環（原圖 16 格有的有羽扇有的沒有，只挑有羽扇的 7 格）
    },
    // 蕃薯：待機＝吃薯條（8 格，每秒 3 格連播 2 輪）；攻擊／技能＝撲出去咬（8 格，第 5 格咬下去；普攻 13 格/秒、技能 11 格/秒）
    pudding: {
      walk: { src: 'pudding_walk.png', frames: 8, cw: 526, ch: 372, ground: 368, fps: 9 },   // 走路循環（黃金獵犬優雅小跑，8 格）
      idle: { src: 'pudding_idle.png', frames: 8, cw: 497, ch: 491, ground: 487, fps: 2.5, repeat: 2 },   // 待機：吃布丁（舀一口→吃→再舀→吃光→舔嘴），連播 2 輪
      eat: { src: 'pudding_idle.png', frames: 8, cw: 497, ch: 491, ground: 487, fps: 3 },                 // 回血：同一組，播一輪
      attack: { src: 'pudding_attack.png', frames: 8, cw: 535, ch: 412, ground: 408, fps: 12, hitFrame: 5 },   // 普攻：蓄力→躍起→前爪重拍（第 5 格打中）
      skill: { src: 'pudding_attack.png', frames: 8, cw: 535, ch: 412, ground: 408, fps: 9, hitFrame: 5 },
    },
    joy: {
      idle: { src: 'joy_idle.png', frames: 8, cw: 372, ch: 419, ground: 416, fps: 2.5, repeat: 2 },   // 待機：啃大雞腿→啃成骨頭→骨頭啃光，連播 2 輪
      eat: { src: 'joy_idle.png', frames: 8, cw: 372, ch: 419, ground: 416, fps: 3 },                 // 回血：同一組啃雞腿，播一輪
      attack: { src: 'joy_attack.png', frames: 8, cw: 409, ch: 367, ground: 363, fps: 12, hitFrame: 5 },   // 攻擊：撲咬（第 5 格咬下去）
      skill: { src: 'joy_attack.png', frames: 8, cw: 409, ch: 367, ground: 363, fps: 9, hitFrame: 5 },     // 技能：同一組，慢一點
      walk: { src: 'joy_walk.png', frames: 6, cw: 283, ch: 288, ground: 285, fps: 8 },                // 走路：6 格（原圖中間兩欄被一隻大狗擋住，只用乾淨的 6 格）
    },
    xiaoni: {
      idle: { src: 'xiaoni_idle.png', frames: 5, cw: 343, ch: 374, ground: 372, fps: 3, repeat: 2 },   // 待機：坐上沙發、躺著玩手機，旁邊對話泡泡裡的手機遊戲畫面會換（沒有跳起來的動作了）
      attack: { src: 'xiaoni_attack.png', frames: 8, cw: 318, ch: 603, ground: 600, fps: 3.5, hitFrame: 7 },   // 攻擊：100T 金色大錘子（2026-11-15 換成咖哩給的新圖）跳起來慢慢往下砸（第 7 格砸中地面；2026-11-15 咖哩嫌太快：8→5 格/秒，整段約 1.6 秒，傷害數字對在第 7 格約 1.3 秒時）
      skill: { src: 'xiaoni_attack.png', frames: 8, cw: 318, ch: 603, ground: 600, fps: 2.8, hitFrame: 7 },   // 技能：同一組，更慢更有份量（約 2 秒，第 7 格約 1.6 秒時打中）
      walk: { src: 'xiaoni_walk.png', frames: 8, cw: 252, ch: 394, ground: 391, fps: 9 },   // 走路循環：一手拿手機邊走（8 格，原圖本來就面向左）
    },
    yam: {
      idle: { src: 'yam_idle.png', frames: 8, cw: 298, ch: 423, ground: 420, fps: 3, repeat: 2 },
      attack: { src: 'yam_attack.png', frames: 8, cw: 701, ch: 458, ground: 406, fps: 13 },
      skill: { src: 'yam_attack.png', frames: 8, cw: 701, ch: 458, ground: 406, fps: 11 },
      walk: { src: 'yam_walk.png', frames: 12, cw: 373, ch: 392, ground: 388, fps: 10 },   // 走路循環（12 格，原圖第 10~12 格畫成面向右，已單獨翻面）
    },
    dabao: {
      walk: { src: 'dabao_walk.png', frames: 8, cw: 522, ch: 444, ground: 441, fps: 10 },   // 走路循環（柴犬輕快小跑，8 格）
      eat: { src: 'dabao_drumstick.png', frames: 8, cw: 379, ch: 360, ground: 350, fps: 3 },   // 回血：吃大雞腿（一輪）
      idle: { src: 'dabao_eat.png', frames: 8, cw: 384, ch: 387, ground: 383, fps: 3, repeat: 3 },   // 待機（走到定點停下來）也先用同一組啃骨頭，連播 3 輪（跟米其林一樣）
      idle2: { src: 'dabao_drumstick.png', frames: 8, cw: 379, ch: 360, ground: 350, fps: 3, repeat: 3 },   // 第二組待機：吃大雞腿。停下來時隨機挑 idle（啃骨頭）或 idle2（吃雞腿）
      // 攻擊：蓄力後嘴裡射出金色光球（原圖 9 格，其中兩格少了狗／被切掉，只用 7 格；第 4 格光球射出）
      attack: { src: 'dabao_attack.png', frames: 7, cw: 819, ch: 413, ground: 404, fps: 10 },
      skill: { src: 'dabao_attack.png', frames: 7, cw: 819, ch: 413, ground: 404, fps: 9 },
    },
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
    setLevel: ['等級', '設定等級'],   // 主播本人留言「等級 名字 30」→ 把那位觀眾調成 Lv.30（要先在面板「主播文字指令」設定主播）
    raceJoin: ['我要參賽'],             // 賽跑模式：報名參賽（整句剛好才算）
    hurdleOpen: ['開放障礙賽'],         // 障礙賽：主播留言這句＝開放障礙賽報名（只有主播有效）
    wheelOpen: ['轉輪模式'],             // 轉輪模式：主播留言這句＝開啟；玩家留言這句＝查自己累積了多少鑽／排到第幾次
    wheelClose: ['關閉轉輪'],           // 主播留言這句＝關閉常駐的轉輪
    duel: ['單挑'],                     // 單挑賽：留言「@對方名字 單挑」（或「單挑 @對方名字」）發起申請
    duelAccept: ['接受', '接受挑戰'],   // 被挑戰的人留言這些字（整句剛好）＝接受（不用送玫瑰）
    duelRefuse: ['拒絕'],               // 被挑戰的人留言這些字＝拒絕
    raceOpen: ['開放報名'],             // 賽跑模式：主播留言這句＝開放報名（只有主播有效）
    joinRed: ['加入紅隊', '紅隊'],      // 陣營模式：留言這些字（整句剛好）加入紅隊
    joinBlue: ['加入藍隊', '藍隊'],     // 陣營模式：加入藍隊
    leave: ['烙跑', '落跑'],    // 留言「整句剛好就是這些字」（後面加標點、空白沒關係）→ 自己的武將下場。可以多加幾種說法
  },

  // ---------- 武將別名 ----------
  // 觀眾留言這些字也算點名該武將。左邊是別名，右邊是武將英文 ID（照 data/heroes.js）。
  // 例如想讓簡體字「吕布」也有效： '吕布': 'lvbu'
  heroAliases: {
    'Joy': 'joy',   // 九億的舊名字，觀眾打 Joy 也認
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
