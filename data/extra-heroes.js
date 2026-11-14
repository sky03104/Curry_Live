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
  // 大寶：萌國的柴犬遊俠。能力值取遊俠平均（血少、攻高、防低），技能演出是射出光彈。
  { heroId: 'dabao', displayName: '大寶', faction: 'Meng', troop: 'Ranger', baseHp: 540, baseAtk: 72, baseArmor: 25, skillName: '疾風撲擊', extra: true },
  // 布丁：萌國的黃金獵犬統帥。能力值取統帥平均（血、攻、防都在中間），技能演出是光環＋光柱。
  { heroId: 'pudding', displayName: '布丁', faction: 'Meng', troop: 'Commander', baseHp: 746, baseAtk: 55, baseArmor: 34, skillName: '暖心號令', extra: true },
  // 魚哥：萌國的南瓜裝小女孩猛將（拿南瓜桶揮擊）。能力值取猛將中間檔（跟米其林同一檔），技能「南瓜重擊」，演出＝衝撞地裂。名字以外的設定是 Claude 先定的。
  { heroId: 'yuge', displayName: '魚哥', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '南瓜重擊', extra: true },
  // 西當普利鼠：萌國的倉鼠謀士（拿羽扇、穿綠金鎧甲）。能力值取謀士水準（血少、攻中、防低），技能演出＝法陣落雷。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'hamster', displayName: '西當普利鼠', faction: 'Meng', troop: 'Strategist', baseHp: 600, baseAtk: 68, baseArmor: 28, skillName: '起司風暴', extra: true },
]);
