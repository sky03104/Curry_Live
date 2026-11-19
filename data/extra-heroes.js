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
  // 蕃薯：萌國的杜賓犬猛將（黑虎戰甲、紫金披風）。能力值取猛將中間檔（跟米其林同一檔），技能「黑虎撲殺」，演出＝衝撞地裂。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'yam', displayName: '蕃薯', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '黑虎撲殺', extra: true },
  // 小妮：萌國的長髮女孩猛將（灰色棒球帽＋墨鏡、灰色短背心與運動長褲、白拖鞋），武器是 100T 黑色大錘子。能力值取猛將中間檔（同米其林），技能「百噸重錘」，演出＝衝撞地裂。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'xiaoni', displayName: '小妮', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '百噸重錘', extra: true },
  // 九億（原名 Joy，2026-11-15 咖哩改名；heroId 仍是 joy）：萌國的約克夏小狗遊俠（紅纓頭盔、金紅鎧甲、背著劍鞘）。能力值取遊俠平均（同大寶），技能「紅纓突襲」。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'joy', displayName: '九億', faction: 'Meng', troop: 'Ranger', baseHp: 540, baseAtk: 72, baseArmor: 25, skillName: '紅纓突襲', extra: true },
  // 那隻喵（2026-11-16 咖哩第九隻）：萌國的布偶貓謀士（藍紫金披風、肉球徽章、小金冠；設定稿標「貓將・智謀・輔佐・謀略」）。能力值取謀士水準（同西當普利鼠：血少、攻中、防低），技能「雲爪妙計」，演出＝法陣落雷。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'nekomeow', displayName: '那隻喵', faction: 'Meng', troop: 'Strategist', baseHp: 600, baseAtk: 68, baseArmor: 28, skillName: '雲爪妙計', extra: true },
  // 學姊（2026-11-16 咖哩第十隻）：萌國的長髮眼鏡女孩統帥（灰色連帽、牛仔外套、黑色上衣短褲、光腳，手拿冰抹茶拿鐵）。能力值取統帥平均（同布丁），技能「學姊罩你」，演出＝光環＋光柱。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。原圖的杯子上有星巴克的商標，已在圖上把商標塗成素色綠色圓形貼紙（見 CLAUDE.md）。
  { heroId: 'xuejie', displayName: '學姊', faction: 'Meng', troop: 'Commander', baseHp: 746, baseAtk: 55, baseArmor: 34, skillName: '學姊罩你', extra: true },
  // 饅頭（2026-11-17 咖哩第十一隻）：萌國的灰虎斑胖貓猛將（紅纓頭盔、紅金鎧甲、紅披風、腰間佩劍，圓滾滾的白肚子）。能力值取猛將中間檔（同米其林），技能「肉球鎮營」，演出＝衝撞地裂。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'mantou', displayName: '饅頭', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '肉球鎮營', extra: true },
  // ❤️（2026-11-18 咖哩第十二隻，heroId: heart）：萌國的棕髮瀏海女孩猛將（粉色毛衣、白色小裙、白球鞋，從上往下看的角度，手拿超大彩虹旋渦棒棒糖，糖上綁紅色蝴蝶結）。**2026-11-18 咖哩改名成「EN」**（heroId 仍是 heart）；召喚方式仍是整句愛心（別名，見 config.js 的 heroAliases），整句留言剛好是 EN 也行；因為愛心太常出現在聊天裡，**只有整句留言剛好是愛心（❤️、❤️❤️…最多 6 顆）才會召喚她**，聊天裡夾著愛心不算，也不能靠留言愛心換成她（exactOnly，見 game.js）。能力值取猛將中間檔（同米其林），技能「甜蜜重擊」（用超大棒棒糖打人）。名字以外的設定（兵種、數值、技能名）是 Claude 先定的。
  { heroId: 'heart', displayName: 'EN', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '甜蜜重擊', extra: true, exactOnly: true },
  // 鯊魚煙（2026-11-19 咖哩第十三隻）：萌國的黑道大哥鯊魚猛將（直條紋西裝、黑色毛領披風、金鍊子、金錶、胸口紅玫瑰、嘴叼雪茄）。名字以外的設定（兵種、數值、技能名）是 Claude 先定的：猛將中間檔（同米其林），技能「煙霧瀰漫」（吸一口雪茄吐出大片煙霧）。
  { heroId: 'sharksmoke', displayName: '鯊魚煙', faction: 'Meng', troop: 'Vanguard', baseHp: 928, baseAtk: 52, baseArmor: 47, skillName: '煙霧瀰漫', extra: true },
]);
