"""許願碗動畫版：把 Gemini 生的「狗 8 格連續動作」綠底圖，轉成一排橫放的動畫條（去掉綠底、每格對齊右下角）。
用法：python3 tools/make_dog_strip.py <原圖> <輸出名稱>     例：python3 tools/make_dog_strip.py bulldog.jpg dogstrip_bowl2
輸出：wishjar/<輸出名稱>.png（8 格一排，每格一樣大，狗的右下角（屁股＋腳底）貼齊格子右下角）；並印出每格大小與每格狗的範圍，貼進 bowls.js。
做法：4 欄 × 2 列平均切格；綠色去背（含邊緣去綠）；每格只留最大一塊；每格依「右邊（屁股）」「下面（腳底）」對齊。
需要：pip install pillow numpy scipy"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, name = sys.argv[1], sys.argv[2]
COLS, ROWS = 4, 2
im = Image.open(src).convert('RGB'); W, H = im.size
a = np.asarray(im).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
gd = g - np.maximum(r, b)                                   # 越綠越大
alpha = np.clip((62 - gd) / 32.0, 0, 1)                      # gd>=62 全透明，<=30 不透明
spill = np.minimum(g, np.maximum(r, b) + 8)                  # 邊緣去綠
solid = alpha > 0.98
edge = ~ndimage.binary_erosion(solid, iterations=3)                  # 邊緣 3 像素內：把綠色壓到不比紅藍高，去掉綠邊
g2 = np.where(edge | (gd > 20), np.minimum(g, np.maximum(r, b)), g)
alpha = np.where(edge, alpha * ndimage.gaussian_filter(solid.astype(float), 1.0).clip(0, 1) ** 0.5, alpha)
out = np.dstack([r, g2, b, (alpha * 255)]).astype(np.uint8)
cw, ch = W // COLS, H // ROWS
frames = []
for i in range(COLS * ROWS):
    cx, cy = (i % COLS) * cw, (i // COLS) * ch
    cell = out[cy:cy + ch, cx:cx + cw].copy()
    m = cell[..., 3] > 40
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1)); keep = lab == (1 + int(np.argmax(sizes)))
        keep = ndimage.binary_dilation(keep, iterations=6) & (cell[..., 3] > 0)
        cell[..., 3] = np.where(keep, cell[..., 3], 0)
    ys, xs = np.where(cell[..., 3] > 40)
    frames.append((cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1))))
FW = max(f[1][0] for f in frames) + 8; FH = max(f[1][1] for f in frames) + 8
strip = np.zeros((FH, FW * len(frames), 4), np.uint8)
for i, (f, (w, h)) in enumerate(frames):
    x0 = i * FW + FW - 4 - w; y0 = FH - 4 - h                     # 右下角貼齊（屁股、腳底不動）
    strip[y0:y0 + h, x0:x0 + w] = f
Image.fromarray(strip, 'RGBA').save(os.path.join(ROOT, 'wishjar', name + '.png'))
print('frame size', FW, FH, 'frames', len(frames), 'each dog size', [f[1] for f in frames])
