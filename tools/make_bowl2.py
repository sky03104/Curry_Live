"""把咖哩給的「藍色寵物碗＋鬥牛犬」圖切成許願碗用的兩層圖（狗要保留）。
用法：python3 tools/make_bowl2.py [bowl2|bowl3]   （不給名稱＝bowl2；原圖放在 tools/bowl_src/<名稱>_original.png）
  bowl2＝鬥牛犬（米其林碗）、bowl3＝柴犬（大寶狗碗）；新增一個樣式就在下面 PRESETS 加一筆（碗口橢圓與碗外框要看圖量）
輸出：wishjar/bowl2_back.png（整張：狗＋碗，去掉白底，畫在禮物後面）
      wishjar/bowl2_front.png（只有碗口前緣以下的外壁，畫在禮物前面，把掉進碗裡的禮物下半截遮住）
做法：近白色的背景與地上陰影，從四周往裡洗掉（狗與碗的深色描邊擋住不會洗進去），再把洗不掉的邊緣羽化；
      前景層用手動框的碗外框＋碗口橢圓的前緣切出來。需要：pip install pillow numpy scipy"""
import os, math, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = sys.argv[1] if len(sys.argv) > 1 else 'bowl2'
SRC = os.path.join(ROOT, 'tools', 'bowl_src', NAME + '_original.png')
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
full.save(os.path.join(OUT, NAME + '_back.png'))

# 碗口橢圓（原圖座標：中心 x、中心 y、半寬、半高）與碗的外框（碗口橢圓上半圈之後，順時針接下去的點）
PRESETS = {
    'bowl2': ((322, 839, 276, 72), [(600, 850), (642, 955), (656, 1002), (652, 1040), (610, 1076), (480, 1106), (330, 1118), (180, 1110), (60, 1080), (12, 1052), (0, 1010), (10, 955), (45, 860)]),
    'bowl3': ((334, 794, 274, 63), [(608, 796), (630, 890), (656, 960), (662, 985), (640, 1020), (600, 1042), (480, 1072), (330, 1082), (180, 1072), (60, 1042), (12, 988), (5, 950), (25, 890), (60, 800)]),
}
(cx, cy, rx, ry), tail = PRESETS[NAME]
poly = []
for i in range(0, 181, 6):
    t = math.radians(180 + i); poly.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
poly += tail
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
inside = np.asarray(m) > 0
yy, xx = np.mgrid[0:H, 0:W]
edge = cy + ry * np.sqrt(np.clip(1 - ((xx - cx) / rx) ** 2, 0, 1)) + 4
front_ok = inside & (yy >= edge) & (alpha > 0)
fa = np.where(front_ok, alpha, 0)
fr = np.dstack([np.asarray(im), (fa * 255).astype(np.uint8)])
Image.fromarray(fr, 'RGBA').crop(bb).save(os.path.join(OUT, NAME + '_front.png'))
print('size', fw, fh, 'bbox', bb, 'rim center (cx,cy)=', cx - bb[0], cy - bb[1], 'rx', rx, 'ry', ry, 'floor y', fh)
