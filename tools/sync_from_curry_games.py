"""從「萌戰三國」(Curry_Games) 同步武將資料與全身圖到本專案。只讀取 Curry_Games，不會改動它。

用法：python3 tools/sync_from_curry_games.py [Curry_Games 的路徑，預設 ../Curry_Games]
需要 Pillow（pip install pillow）。

全身圖是 Git LFS 檔，剛下載只是約 130 bytes 的佔位檔，要先在 Curry_Games 目錄執行：
  git lfs pull --include="UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D/*.png"
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Curry_Games'))
HEROES_JSON = os.path.join(SRC, 'UnityProject/Assets/_Project/Data/heroes.json')
ART_DIR = os.path.join(SRC, 'UnityProject/Assets/_Project/Resources/HeroPortraitsFullBody2D')
OUT_DIR = os.path.join(ROOT, 'assets/heroes')
OUT_SIZE = (312, 396)   # 原圖 520x660，縮到六成：畫面上夠清楚，檔案小很多
KEEP = ['heroId', 'displayName', 'faction', 'troop', 'baseHp', 'baseAtk', 'skillName']

with open(HEROES_JSON, encoding='utf8') as f:
    heroes = [{k: h[k] for k in KEEP} for h in json.load(f)['heroes']]

os.makedirs(OUT_DIR, exist_ok=True)
for h in heroes:
    src = os.path.join(ART_DIR, h['heroId'] + '.png')
    if os.path.getsize(src) < 1000:
        sys.exit(f"{h['heroId']}.png 是 Git LFS 佔位檔，請先照本檔開頭的說明執行 git lfs pull")
    Image.open(src).convert('RGBA').resize(OUT_SIZE, Image.LANCZOS).save(
        os.path.join(OUT_DIR, h['heroId'] + '.png'), optimize=True)

with open(os.path.join(ROOT, 'data/heroes.js'), 'w', encoding='utf8') as f:
    f.write('// 這個檔是由 tools/sync_from_curry_games.py 自動產生的，請不要手動修改。\n'
            '// 資料來源：Curry_Games/UnityProject/Assets/_Project/Data/heroes.json\n'
            'window.HEROES_DATA = [\n' +
            ',\n'.join(' ' + json.dumps(h, ensure_ascii=False) for h in heroes) + '\n];\n')
print(f'完成：{len(heroes)} 隻武將資料 + 全身圖')
