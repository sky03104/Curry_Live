#!/usr/bin/env python3
"""把許願碗的米其林（鬥牛犬）白毛調白一點（去掉米黃色）。
用法：python3 tools/whiten_dog.py [--strength 0.6] 檔案.png [檔案2.png ...]（直接覆蓋原檔，原圖請先用 git 保留）
只動「偏黃的淺色毛」：棕色斑塊、黃色胸背帶、粉紅舌頭、藍色碗不會被動到。"""
import sys, argparse
import numpy as np
from PIL import Image

def whiten(path, strength):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255.0
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = a[..., :3].max(-1); mn = a[..., :3].min(-1)
    v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    warm = (r >= g) & (g >= b)                                   # 偏黃／偏橘（紅>綠>藍），藍色碗、粉紅舌頭不會中
    # 毛色：亮、飽和度低～中。棕斑（暗、飽和高）與黃色背帶（飽和很高）排除
    w_v = np.clip((v - 0.50) / 0.25, 0, 1)
    w_s = np.clip((0.55 - s) / 0.20, 0, 1)
    w = (w_v * w_s * warm).astype(np.float32)
    w = w * strength
    s2 = s * (1 - 0.75 * w)                                      # 去掉黃味
    v2 = np.minimum(1.0, v + (1 - v) * 0.45 * w)                # 稍微提亮
    # 用新的 s、v 還原 RGB（保持原本的色相比例）
    scale = np.where(mx > 0, v2 / np.maximum(mx, 1e-6), 1)
    out = np.empty_like(a)
    for i in range(3):
        c = a[..., i] * scale
        # 向灰色靠攏：新的飽和度
        gray = v2
        c = gray - (gray - c) * np.where(s > 1e-6, s2 / np.maximum(s, 1e-6), 1)
        out[..., i] = np.clip(c, 0, 1)
    out[..., 3] = al
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA').save(path)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--strength', type=float, default=0.6)
    A = ap.parse_args()
    for f in A.files: whiten(f, A.strength); print('ok', f)
