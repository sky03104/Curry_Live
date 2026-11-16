#!/usr/bin/env python3
"""把特效素材（PVFX Foundry CC0 與 OpenGameArt「Hit animation」CC0）整理成遊戲用的連續圖。
用法：python3 tools/build_fx_sprites.py <PVFX 解壓縮資料夾> <命中火花 png>
輸出：assets/fx/*.png ＋ js/fx-sprites.js（每張圖的格子位置、基準點、每格時間）
素材授權：CC0（不用標示作者），見 assets/fx/LICENSE.txt。"""
import json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICK = [  # PVFX 裡的 <分類>/<名稱>
    'arcane/magic-circle', 'arcane/arcane-orb-projectile', 'lightning/lightning-strike', 'holy/divine-beam',
    'holy/holy-smite', 'holy/holy-heal', 'holy/resurrect', 'nature/fissure', 'explosions/fire-nova',
    'explosions/big-explosion', 'explosions/arcane-burst', 'melee/shadow-claw', 'melee/axe-smear',
    'melee/sword-combo', 'melee/hammer-smash', 'melee/spear-thrust', 'projectiles/magic-missile',
    'status/power-up-aura', 'ui/level-up', 'wind/wind-blade', 'fire/fireball-impact',
]

def main(pvfx, hit_png):
    out = {}
    for p in PICK:
        d = os.path.join(pvfx, 'effects', p, 'lit', 'grid')
        m = json.load(open(os.path.join(d, 'manifest.json')))
        name = p.replace('/', '_')
        shutil.copy(os.path.join(d, 'sprite-sheet.png'), os.path.join(ROOT, 'assets', 'fx', name + '.png'))
        sw, sh = m['source_size']; px, py = m['pivot']
        frames = []
        for f in m['frames']:
            s = f['sheet']; tp = f['trimmed_pivot']
            ms = f['duration']['numerator_ms'] / f['duration']['denominator']
            frames.append([s['x'], s['y'], s['width'], s['height'], tp[0], tp[1], round(ms, 1)])
        out[name] = {'src': name + '.png', 'w': sw, 'h': sh, 'pivot': [px, py], 'frames': frames, 'pixel': True}
    # 命中火花：4096x4096、4x4 格 → 縮成 1024x1024（每格 256）
    im = Image.open(hit_png).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
    im.save(os.path.join(ROOT, 'assets', 'fx', 'hit_spark.png'), optimize=True)
    fr = [[(i % 4) * 256, (i // 4) * 256, 256, 256, 128, 128, 40] for i in range(16)]
    out['hit_spark'] = {'src': 'hit_spark.png', 'w': 256, 'h': 256, 'pivot': [128, 128], 'frames': fr, 'pixel': False}
    js = '// 自動產生（tools/build_fx_sprites.py），不要手改。素材 CC0，見 assets/fx/LICENSE.txt\nwindow.ML = window.ML || {};\nML.FX_SPRITES = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'js', 'fx-sprites.js'), 'w', encoding='utf-8').write(js)
    open(os.path.join(ROOT, 'assets', 'fx', 'LICENSE.txt'), 'w', encoding='utf-8').write(
        'PVFX Foundry（nerijs, https://nerijs.itch.io/pvfx-foundry）— CC0 1.0\n'
        'Hit animation frame by frame（Sinestesia, https://opengameart.org/content/hit-animation-frame-by-frame）— CC0\n'
        '兩者都是 CC0，不需標示作者，可商用。hit_spark.png 已縮小為 1024x1024。\n')
    print('輸出', len(out), '種特效')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
