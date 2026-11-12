// 從「萌戰三國」(Curry_Games) 同步武將資料與頭像到本專案。只讀取 Curry_Games，不會改動它。
// 用法：node tools/sync-from-curry-games.js [Curry_Games 的路徑，預設 ../Curry_Games]
const fs = require('fs');
const path = require('path');

const src = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Curry_Games'));
const root = path.join(__dirname, '..');
const heroesJson = path.join(src, 'UnityProject/Assets/_Project/Data/heroes.json');
const portraitDir = path.join(src, 'UnityProject/Assets/_Project/Resources/HeroPortraits');

const all = JSON.parse(fs.readFileSync(heroesJson, 'utf8')).heroes;
const keep = ['heroId', 'displayName', 'faction', 'troop', 'baseHp', 'baseAtk', 'skillName'];
const heroes = all.map(h => Object.fromEntries(keep.map(k => [k, h[k]])));

for (const h of heroes) {
  const from = path.join(portraitDir, h.heroId + '.png');
  const size = fs.statSync(from).size;
  if (size < 1000) {
    throw new Error(`${h.heroId}.png 只有 ${size} bytes，是 Git LFS 佔位檔。請先在 Curry_Games 執行：\n` +
      'git lfs pull --include="UnityProject/Assets/_Project/Resources/HeroPortraits/*.png"');
  }
  fs.copyFileSync(from, path.join(root, 'assets/heroes', h.heroId + '.png'));
}

fs.writeFileSync(path.join(root, 'data/heroes.js'),
  '// 這個檔是由 tools/sync-from-curry-games.js 自動產生的，請不要手動修改。\n' +
  '// 資料來源：Curry_Games/UnityProject/Assets/_Project/Data/heroes.json\n' +
  'window.HEROES_DATA = ' + JSON.stringify(heroes, null, 1).replace(/\n\s+"/g, ' "').replace(/\n\s+}/g, ' }') + ';\n');
console.log(`完成：${heroes.length} 隻武將資料 + 頭像`);
