#!/usr/bin/env python3
"""把咖哩給的碗圖（tools/bowl_src/bowl_original.jpg，260x260，假透明的棋盤格背景）處理成許願碗用的兩張圖：
   wishjar/bowl_back.png（碗口內側＋碗身，畫在銅錢後面）、wishjar/bowl_front.png（碗身前面一層，半透明蓋在銅錢上）。
   用法：python3 tools/make_bowl.py [--line 1] [--edge 2]    （需要 pillow numpy scipy）
   --line  邊線與裂痕往外加粗幾個像素（原圖像素，預設 1）　--edge 碗外緣再描粗幾個像素（預設 2）"""
import argparse, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument('--src', default=os.path.join(os.path.dirname(__file__), 'bowl_src', 'bowl_original.jpg'))
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'wishjar'))
ap.add_argument('--line', type=int, default=1)
ap.add_argument('--edge', type=int, default=2)
args = ap.parse_args()

src = Image.open(args.src).convert('RGB')
a = np.array(src).astype(int)
# 1) 去背：從四邊開始，把「灰白的棋盤格」連通區域視為背景（碗的藍色外框會擋住，不會洗進碗裡）
neutral = ((a.max(axis=2) - a.min(axis=2)) < 14) & (a.min(axis=2) >= 215)
lab, _ = ndi.label(neutral)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ndi.binary_opening(~bg, iterations=1)
# 2) 碗口內側（原圖是棋盤格）：種子點在碗口橢圓裡
seed = next(lab[y, x] for (x, y) in [(130, 88), (130, 92), (120, 90), (140, 90), (130, 85)] if lab[y, x] and lab[y, x] not in border)
inter = lab == seed
# 3) 邊框與裂痕加粗加深：深色像素（邊線、裂痕）往外長粗，再把碗的外緣描一圈
lum = a.mean(axis=2)
line = fg & (lum < 135)
thick = ndi.binary_dilation(line, structure=ndi.generate_binary_structure(2, 1), iterations=args.line) & fg
edge = fg & ~ndi.binary_erosion(fg, iterations=args.edge)
dark = thick | edge
a = a.astype(float)
a[dark] = np.array([30, 62, 88])
# 4) 碗口內側改成淡淡的瓷白→淺藍漸層
ys, xs = np.where(inter); y0, y1 = ys.min(), ys.max()
for y in range(a.shape[0]):
    t = min(1, max(0, (y - y0) / max(1, (y1 - y0))))
    a[y][inter[y] & ~dark[y]] = np.array([240, 248, 252]) * (1 - t) + np.array([196, 222, 236]) * t
filled = Image.fromarray(a.astype('uint8'))
srcdark = a.copy(); srcdark[inter & ~dark] = a[inter & ~dark]   # 前層用同一張（內側之後會挖掉）

def mk(img, mask):
    al = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    o = img.convert('RGBA'); o.putalpha(al); return o
back = mk(filled, fg)
front = mk(filled, fg & (~inter | dark))      # 前層：碗口內側挖空，但內側的深色邊線留著
for name, im in (('back', back), ('front', front)):
    im.resize((780, 780), Image.LANCZOS).save(os.path.join(args.out, 'bowl_%s.png' % name), optimize=True)
print('done')
