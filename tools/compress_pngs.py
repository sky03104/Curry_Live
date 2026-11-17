#!/usr/bin/env python3
"""壓縮 assets/heroes 的逐格動畫圖（檔名有底線的，例如 michelin_walk.png；不動 boss_ 與單張圖）。
用法：python3 tools/compress_pngs.py [檔案...]    不給檔案就壓縮全部動畫圖。
需要：pip install pyoxipng pngquant-cli pillow numpy
做法：pngquant 把顏色壓成 256 色（品質 65～95，保留半透明邊緣），再用 oxipng 無損再壓一次。
2026-11-17 第一次壓縮：46 個檔案 54.6 MB → 約 14.3 MB（省 74%），肉眼比對看不出差別。
新做的連續圖（make_anim_sheet.py 輸出）請順手跑一次這支。壓過的檔案再壓不會有害，但也省不了多少。"""
import glob, os, subprocess, sys
import oxipng

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sys.argv[1:] or sorted(f for f in glob.glob(os.path.join(ROOT, 'assets', 'heroes', '*_*.png')) if not os.path.basename(f).startswith('boss_'))
total_old = total_new = 0
for f in files:
    old = os.path.getsize(f)
    tmp = f + '.tmp.png'
    subprocess.run(['pngquant', '--quality=65-95', '--speed', '1', '--force', '--output', tmp, f], capture_output=True)
    src = tmp if os.path.exists(tmp) else f      # pngquant 達不到品質門檻時退回只做無損壓縮
    data = oxipng.optimize_from_memory(open(src, 'rb').read(), level=4)
    if os.path.exists(tmp): os.remove(tmp)
    if len(data) < old: open(f, 'wb').write(data)
    new = os.path.getsize(f); total_old += old; total_new += new
    print(f'{os.path.basename(f)}: {old // 1024} KB -> {new // 1024} KB')
print(f'合計 {total_old // 1024} KB -> {total_new // 1024} KB')
