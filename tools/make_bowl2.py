"""把咖哩給的「藍色寵物碗＋鬥牛犬」圖切成許願碗用的兩層圖（狗要保留）。
用法：python3 tools/make_bowl2.py   （原圖放在 tools/bowl_src/bowl2_original.png）
輸出：wishjar/bowl2_back.png（整張：狗＋碗，去掉白底，畫在禮物後面）
      wishjar/bowl2_front.png（只有碗口前緣以下的外壁，畫在禮物前面，把掉進碗裡的禮物下半截遮住）
做法：近白色的背景與地上陰影，從四周往裡洗掉（狗與碗的深色描邊擋住不會洗進去），再把洗不掉的邊緣羽化；
      前景層用手動框的碗外框＋碗口橢圓的前緣切出來。需要：pip install pillow numpy scipy"""
import os, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'bowl_src', 'bowl2_original.png')
OUT = os.path.join(ROOT, 'wishjar')
im = Image.open(SRC).convert('RGB'); W, H = im.size
a = np.asarray(im).astype(np.int32)
mx = a.max(axis=2); mn = a.min(axis=2)
light = (mn > 214) & ((mx - mn) < 26)                      # 近白色（背景、地上淡淡的陰影）
lab, n = ndimage.label(light)
border = np.zeros((H, W), bool); border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
ids = np.unique(lab[border & light]); ids = ids[ids > 0]
bg = np.isin(lab, ids)
fg = ~bg
fg = ndimage.binary_fill_holes(fg)
lab, n = ndimage.label(fg)
sizes = ndimage.sum(fg, lab, range(1, n + 1)); fg = lab == (1 + int(np.argmax(sizes)))
fg = ndimage.binary_opening(fg, iterations=1)
alpha = np.clip((ndimage.gaussian_filter(fg.astype(float), 0.9) - 0.3) / 0.5, 0, 1)
full = Image.fromarray(np.dstack([np.asarray(im), (alpha * 255).astype(np.uint8)]), 'RGBA')
bb = full.getbbox(); full = full.crop(bb); fw, fh = full.size
full.save(os.path.join(OUT, 'bowl2_back.png'))

# 碗口橢圓（原圖座標）與碗的外框
cx, cy, rx, ry = 322, 839, 276, 72
poly = []
for i in range(0, 181, 6):
    t = math.radians(180 + i); poly.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
poly += [(600, 850), (642, 955), (656, 1002), (652, 1040), (610, 1076), (480, 1106), (330, 1118), (180, 1110), (60, 1080), (12, 1052), (0, 1010), (10, 955), (45, 860)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
inside = np.asarray(m) > 0
yy, xx = np.mgrid[0:H, 0:W]
edge = cy + ry * np.sqrt(np.clip(1 - ((xx - cx) / rx) ** 2, 0, 1)) + 4
front_ok = inside & (yy >= edge) & (alpha > 0)
fa = np.where(front_ok, alpha, 0)
fr = np.dstack([np.asarray(im), (fa * 255).astype(np.uint8)])
Image.fromarray(fr, 'RGBA').crop(bb).save(os.path.join(OUT, 'bowl2_front.png'))
print('size', fw, fh, 'bbox', bb, 'rim center (cx,cy)=', cx - bb[0], cy - bb[1], 'rx', rx, 'ry', ry, 'floor y', fh)
