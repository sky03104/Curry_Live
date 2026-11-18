#!/usr/bin/env python3
"""把 pixelfx（https://github.com/patch-gg/pixelfx ，MIT，Hugo Duprez／Patch）輸出的連續圖整理成遊戲用的資料。
用法：
  1. 在 pixelfx 資料夾跑  node tools/sheets.mjs <分類/名稱>  （例如 melee/double-slash），會產生 sheets/<分類>/<名稱>.png 和 .json
  2. python3 tools/build_pixelfx_sprites.py <pixelfx 的 sheets 資料夾>
輸出：assets/fx/px_<分類>_<名稱>.png（pngquant 壓縮）＋ js/fx-sprites-pixelfx.js（接在 ML.FX_SPRITES 後面）＋ assets/fx/PIXELFX_LICENSE.txt
想多用別的特效：把名稱加進 PICK、重新輸出再跑一次。"""
import json, os, subprocess, sys
PICK = ['melee/double-slash', 'melee/spin-slash', 'melee/dagger-flurry', 'melee/claw-swipe', 'impacts/crit-hit',
        'lightning/zap-hit', 'fire/fire-ring', 'fire/fire-tornado', 'holy/heal-aoe', 'explosions/plasma-explosion']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main(sheets):
    out = {}
    for p in PICK:
        cat, nm = p.split('/')
        j = json.load(open(os.path.join(sheets, cat, nm + '.json')))
        meta = j['meta']['pixelfx']; fw, fh = meta['frameSize']; px, py = meta['pivot']
        key = 'px_%s_%s' % (cat, nm)
        dst = os.path.join(ROOT, 'assets', 'fx', key + '.png')
        src = os.path.join(sheets, cat, nm + '.png')
        subprocess.run(['pngquant', '--quality=65-95', '--speed', '1', '--force', '--output', dst, src], capture_output=True)
        if not os.path.exists(dst): open(dst, 'wb').write(open(src, 'rb').read())
        frames = [[f['frame']['x'], f['frame']['y'], f['frame']['w'], f['frame']['h'], px, py, f['duration']] for f in j['frames']]
        out[key] = {'src': key + '.png', 'w': fw, 'h': fh, 'pivot': [px, py], 'frames': frames, 'pixel': True}
        print(key, len(frames), '格', os.path.getsize(dst) // 1024, 'KB')
    js = ('// 自動產生（tools/build_pixelfx_sprites.py），不要手改。pixelfx 特效，MIT，見 assets/fx/PIXELFX_LICENSE.txt\n'
          'window.ML = window.ML || {};\nML.FX_SPRITES = ML.FX_SPRITES || {};\nObject.assign(ML.FX_SPRITES, '
          + json.dumps(out, separators=(',', ':')) + ');\n')
    open(os.path.join(ROOT, 'js', 'fx-sprites-pixelfx.js'), 'w', encoding='utf-8').write(js)

if __name__ == '__main__':
    main(sys.argv[1])
