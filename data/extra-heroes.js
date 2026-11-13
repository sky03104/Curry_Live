// 直播亂鬥自己新增的角色（不在萌戰三國的 heroes.json 裡）。
// 這個檔是手寫的，不會被 tools/sync_from_curry_games.py 蓋掉（它只會重新產生 data/heroes.js）。
// 新增角色的步驟：
//   1. 圖：python3 tools/cutout_hero.py <原圖> <heroId>   → 產生 assets/heroes/<heroId>.png（去背＋縮成遊戲用的尺寸）
//   2. 在下面加一筆資料（欄位意思跟 data/heroes.js 一樣；extra: true 代表這隻是自己加的）
//   3. 陣營如果是新的，到 js/config.js 的 factions 加上名稱與顏色
//   4. 重新產生武將名冊圖：node tools/make_roster.js
// troop 決定技能演出：Vanguard 猛將＝衝撞地裂、Strategist 謀士＝法陣落雷、Ranger 遊俠＝光彈、Commander 統帥＝光環光柱。
window.HEROES_DATA = window.HEROES_DATA.concat([
  // 米其林：萌國的鬥牛犬猛將。能力值取猛將中間檔（跟關羽、張飛、趙雲同一檔）。
  { heroId: 'michelin', displayName: '米其林', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '汪汪衝鋒', extra: true },
]);
