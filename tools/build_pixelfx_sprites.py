#!/usr/bin/env python3
"""把 pixelfx（https://github.com/patch-gg/pixelfx ，MIT，Hugo Duprez／Patch）輸出的連續圖整理成遊戲用的資料。
用法：
  1. 在 pixelfx 資料夾跑  node tools/sheets.mjs <分類/名稱>  （例如 melee/double-slash），會產生 sheets/<分類>/<名稱>.png 和 .json
  2. python3 tools/build_pixelfx_sprites.py <pixelfx 的 sheets 資料夾>
輸出：assets/fx/px_<分類>_<名稱>.png（pngquant 壓縮）＋ js/fx-sprites-pixelfx.js（接在 ML.FX_SPRITES 後面）＋ assets/fx/PIXELFX_LICENSE.txt
想多用別的特效：把名稱加進 PICK、重新輸出再跑一次。"""
import json, os, subprocess, sys
PICK = ['melee/double-slash', 'melee/spin-slash', 'melee/dagger-flurry', 'melee/claw-swipe', 'impacts/crit-hit',
        'lightning/zap-hit', 'fire/fire-ring', 'fire/fire-tornado', 'holy/heal-aoe', 'explosions/plasma-explosion',
        # 2026-11-18 武將專屬特效（每隻三國武將一組普攻＋技能）
        'melee/heavy-cleave', 'melee/spear-sweep', 'melee/scythe-reap', 'melee/hammer-smash', 'projectiles/arrow', 'fire/fireball',
        'fire/meteor', 'fire/flame-pillar', 'ice/frost-nova', 'ice/ice-spikes', 'shadow/dark-explosion', 'shadow/curse',
        'nature/earth-spike', 'nature/quake', 'holy/smite', 'holy/holy-pillar', 'arcane/star-fall', 'arcane/arcane-missiles', 'water/wave-crash']
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
        if len(frames) > 60:   # 超過 60 格：隔一格取一格、每格時間加倍（檔案小一半，看起來差不多），重新排成新圖
            from PIL import Image
            keep = frames[::2]; im = Image.open(dst).convert('RGBA'); cols = 10
            sheet = Image.new('RGBA', (cols * fw, ((len(keep) + cols - 1) // cols) * fh), (0, 0, 0, 0)); nf = []
            for n, f in enumerate(keep):
                sheet.paste(im.crop((f[0], f[1], f[0] + fw, f[1] + fh)), ((n % cols) * fw, (n // cols) * fh))
                nf.append([(n % cols) * fw, (n // cols) * fh, fw, fh, px, py, f[6] * 2])
            sheet.save(dst, optimize=True); subprocess.run(['pngquant', '--quality=65-95', '--speed', '1', '--force', '--output', dst, dst], capture_output=True)
            frames = nf
        out[key] = {'src': key + '.png', 'w': fw, 'h': fh, 'pivot': [px, py], 'frames': frames, 'pixel': True}
        print(key, len(frames), '格', os.path.getsize(dst) // 1024, 'KB')
    js = ('// 自動產生（tools/build_pixelfx_sprites.py），不要手改。pixelfx 特效，MIT，見 assets/fx/PIXELFX_LICENSE.txt\n'
          'window.ML = window.ML || {};\nML.FX_SPRITES = ML.FX_SPRITES || {};\nObject.assign(ML.FX_SPRITES, '
          + json.dumps(out, separators=(',', ':')) + ');\n')
    open(os.path.join(ROOT, 'js', 'fx-sprites-pixelfx.js'), 'w', encoding='utf-8').write(js)

if __name__ == '__main__':
    main(sys.argv[1])
