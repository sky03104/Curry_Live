"""許願碗動畫版：從「狗＋碗」圖（wishjar/bowl2_back.png、bowl3_back.png）裡只取出碗（含碗口內側），存成 wishjar/bowl2_bowl.png、bowl3_bowl.png。
狗改用逐格動畫（make_dog_strip.py 做的 dogstrip_*.png），畫在這張碗的後面。
也印出原圖裡「狗」的範圍（碗以外的部分），拿來決定動畫條要縮放到多大、貼在哪。
用法：python3 tools/make_bowl_only.py       需要：pip install pillow numpy scipy"""
import os, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, 'wishjar')
# 跟 make_bowl2.py 的 PRESETS 一樣（原圖座標），bbox 是 make_bowl2.py 印出的裁邊位置（原圖座標 → 裁邊後座標要減掉它）
PRESETS = {
    'bowl2': dict(bb=(4, 205), ell=(322, 839, 276, 72), tail=[(600, 850), (642, 955), (656, 1002), (652, 1040), (610, 1076), (480, 1106), (330, 1118), (180, 1110), (60, 1080), (12, 1052), (0, 1010), (10, 955), (45, 860)]),
    'bowl3': dict(bb=(0, 183), ell=(334, 794, 274, 63), tail=[(608, 796), (630, 890), (656, 960), (662, 985), (640, 1020), (600, 1042), (480, 1072), (330, 1082), (180, 1072), (60, 1042), (12, 988), (5, 950), (25, 890), (60, 800)]),
}
for name, P in PRESETS.items():
    im = Image.open(os.path.join(W, name + '_back.png')).convert('RGBA'); w, h = im.size
    a = np.asarray(im).copy()
    cx, cy, rx, ry = P['ell']; ox, oy = P['bb']
    poly = []
    for i in range(0, 181, 6):
        t = math.radians(180 + i); poly.append((cx + rx * math.cos(t) - ox, cy + ry * math.sin(t) - oy))
    poly += [(x - ox, y - oy) for x, y in P['tail']]
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    pm = ndimage.binary_dilation(np.asarray(m) > 0, iterations=2)
    bowl = a.copy(); bowl[..., 3] = np.where(pm, a[..., 3], 0)
    Image.fromarray(bowl).save(os.path.join(W, name + '_bowl.png'))
    dog = (a[..., 3] > 40) & ~pm
    lab, n = ndimage.label(dog); sizes = ndimage.sum(dog, lab, range(1, n + 1)); dog = lab == (1 + int(np.argmax(sizes)))
    ys, xs = np.where(dog)
    print(name, 'image', (w, h), '原本的狗範圍 x', int(xs.min()), int(xs.max()), 'y', int(ys.min()), int(ys.max()))
