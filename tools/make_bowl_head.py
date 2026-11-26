"""把「狗＋碗」圖（wishjar/bowl2_back.png、bowl3_back.png）切成「頭」和「身體」兩層，給許願碗動畫版用（程式動畫：頭低下去、點頭、嚼）。
用法：python3 tools/make_bowl_head.py        （產生 wishjar/bowl2_body.png、bowl2_head.png、bowl3_body.png、bowl3_head.png，並印出給 bowls.js 的座標）
做法：手動框出頭的外框（座標是看圖量的，在 PRESETS）；頭那一塊從身體層挖掉；後面其實是身體（脖子、肩膀、胸口的毛）的地方不挖，
      頭動起來時才不會露出洞；頭的邊緣羽化，靜止時跟身體接得起來。
需要：pip install pillow numpy scipy opencv-python-headless"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, 'wishjar')
# poly：頭的外框；pivot：頭轉動的支點（脖子根）；mouth：嘴巴位置；keep：頭後面其實是身體的地方（方框 x0,y0,x1,y1），身體層原樣保留不挖
PRESETS = {
    'bowl2': dict(
        poly=[(285, 330), (295, 230), (320, 150), (318, 72), (345, 48), (400, 52), (430, 38), (500, 20), (560, 15), (600, 5), (650, -5), (720, 40), (735, 110), (740, 230), (735, 330), (710, 420), (680, 470), (620, 505), (540, 548), (440, 548), (380, 520), (330, 470), (290, 400)],
        pivot=(640, 500), mouth=(510, 470), keep=[(660, 120, 3000, 3000), (0, 480, 3000, 3000)]),
    'bowl3': dict(
        poly=[(575, 45), (580, 150), (585, 250), (600, 330), (620, 380), (645, 430), (690, 475), (750, 492), (820, 487), (870, 452), (905, 400), (915, 300), (920, 200), (905, 130), (890, 60), (860, 0), (820, -5), (760, 60), (700, 95), (650, 80), (600, 42)],
        pivot=(760, 490), mouth=(750, 420), keep=[(840, 215, 3000, 3000), (0, 440, 3000, 3000)]),
}
NAMES = sys.argv[1:] or list(PRESETS)
for name in NAMES:
    P = PRESETS[name]
    im = Image.open(os.path.join(W, name + '_back.png')).convert('RGBA')
    w, h = im.size
    a = np.asarray(im).copy()
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon(P['poly'], fill=255)
    poly = ndimage.binary_dilation(np.asarray(m) > 0, iterations=10)      # 外框往外多放 10 像素，才把頭外圍的深色描邊一起帶走
    alpha = a[..., 3] > 0
    head_zone = poly & alpha
    # 頭的圖：外框羽化
    soft = ndimage.gaussian_filter(poly.astype(float), 3.0)
    head = a.copy(); head[..., 3] = (a[..., 3] * soft).astype(np.uint8)
    xs = np.where(poly.any(axis=0))[0]; ys = np.where(poly.any(axis=1))[0]
    pad = 6
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(w, xs.max() + pad), max(0, ys.min() - pad), min(h, ys.max() + pad)
    Image.fromarray(head).crop((x0, y0, x1, y1)).save(os.path.join(W, name + '_head.png'))
    # 身體層：頭那一塊挖掉，但「頭後面其實是身體」的地方（keep 方框，右邊肩膀／下面胸口）原樣留著，
    # 這樣頭動起來時不會露出洞；頭的圖蓋在上面，靜止時看不出來。留 3 像素邊，頭的邊緣才接得起來。
    yy, xx = np.mgrid[0:h, 0:w]
    keepzone = np.zeros((h, w), bool)
    for (kx0, ky0, kx1, ky1) in P['keep']:
        keepzone |= (xx >= kx0) & (xx < kx1) & (yy >= ky0) & (yy < ky1)
    hole = ndimage.binary_erosion(poly & ~keepzone, iterations=3) & alpha
    body = a.copy()
    body[..., 3] = np.where(hole, 0, body[..., 3])
    Image.fromarray(body).save(os.path.join(W, name + '_body.png'))
    print(name, 'head sprite at', (int(x0), int(y0)), 'size', (int(x1 - x0), int(y1 - y0)), 'pivot', P['pivot'], 'mouth', P['mouth'])
