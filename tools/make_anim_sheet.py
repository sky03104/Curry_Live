"""把「綠底、多格排在一張圖上」的連續動作圖，轉成遊戲用的逐格動畫條（透明背景、一排橫放）。

用法：python3 tools/make_anim_sheet.py <原圖> <輸出檔名> [--grid 4x2] [--faces right|left] [--match-height 328] [--equalize area]
範例：python3 tools/make_anim_sheet.py 米其林吃骨頭.jpg assets/heroes/michelin_eat.png --grid 4x2 --faces right

做的事：
  1. 去掉純綠背景（綠色明顯高過紅、藍就當背景），並壓掉邊緣的綠色反光。
  2. 不是按格線切，而是「找連在一起的像素」（骨頭會跨進隔壁格，按格線切會切到）。
     每個連通塊依重心歸到哪一格；每格最大的那塊是狗，其他（骨頭、碎屑）跟著那一格。
  3. 每格以「狗的腳底」對齊、「狗的中心」對齊；原圖面向右的會左右翻成面向左（遊戲預設面向左）。
  4. （選用 --equalize area）每格狗的畫面大小常常不一樣（例如第二排比第一排大一圈），加這個選項會讓每格狗的「面積」拉到一樣大，播放時就不會忽大忽小。
  5. 全部格子用同一個縮放比例（讓站著的狗跟 assets/heroes/ 的單張圖一樣大），排成一排。
輸出後會印出要貼進 js/config.js 的 heroAnims 設定（格寬、格高、腳底在哪一列）。
需要：pip install pillow numpy
"""
import sys, json, collections
import numpy as np
from PIL import Image

def parse():
    a = sys.argv[1:]
    if len(a) < 2: print(__doc__); sys.exit(1)
    opt = {'grid': '4x2', 'faces': 'right', 'match-height': '328', 'equalize': ''}
    pos = []
    i = 0
    while i < len(a):
        if a[i].startswith('--'): opt[a[i][2:]] = a[i + 1]; i += 2
        else: pos.append(a[i]); i += 1
    return pos[0], pos[1], opt

def key_green(im):
    a = np.array(im.convert('RGB')).astype(int)
    g = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    alpha = np.clip((70 - g) * 255 / 50, 0, 255)
    alpha[g >= 70] = 0
    rgb = a.copy()
    spill = g > 0
    rgb[..., 1] = np.where(spill, np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2])), a[..., 1])
    return np.dstack([rgb, alpha]).astype('uint8')

def components(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32); n = 0; comps = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; q = collections.deque([(y0, x0)]); pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
        p = np.array(pts)
        comps.append({'id': n, 'size': len(p), 'cy': p[:, 0].mean(), 'cx': p[:, 1].mean(),
                      'y0': p[:, 0].min(), 'y1': p[:, 0].max(), 'x0': p[:, 1].min(), 'x1': p[:, 1].max()})
    return lab, comps

def main():
    src, out, opt = parse()
    cols, rows = map(int, opt['grid'].split('x'))
    im = Image.open(src); W, H = im.size
    rgba = key_green(im)
    lab, comps = components(rgba[..., 3] > 40)
    comps = [c for c in comps if c['size'] >= 20]
    cw, ch = W / cols, H / rows
    frames = [[] for _ in range(cols * rows)]
    for c in comps:
        k = min(rows - 1, int(c['cy'] // ch)) * cols + min(cols - 1, int(c['cx'] // cw))
        frames[k].append(c)
    parts = []
    for k, cs in enumerate(frames):
        if not cs: sys.exit(f'第 {k + 1} 格找不到角色')
        dog = max(cs, key=lambda c: c['size'])
        x0 = min(c['x0'] for c in cs); x1 = max(c['x1'] for c in cs); y0 = min(c['y0'] for c in cs); y1 = max(c['y1'] for c in cs)
        keep = np.isin(lab[y0:y1 + 1, x0:x1 + 1], [c['id'] for c in cs])
        crop = rgba[y0:y1 + 1, x0:x1 + 1].copy(); crop[..., 3] = np.where(keep, crop[..., 3], 0)
        img = Image.fromarray(crop, 'RGBA')
        dcx = (dog['x0'] + dog['x1']) / 2 - x0; ground = dog['y1'] - y0
        if opt['faces'] == 'right': img = img.transpose(Image.FLIP_LEFT_RIGHT); dcx = img.width - dcx
        parts.append({'img': img, 'dcx': dcx, 'ground': ground, 'dogh': dog['y1'] - dog['y0'], 'area': dog['size']})
    if opt['equalize'] == 'area':   # 每格先縮放到「狗的面積」一樣大（限制在 0.8～1.25 倍，避免姿勢差太多時縮過頭）
        med = sorted(p['area'] for p in parts)[len(parts) // 2]
        for p in parts:
            f = max(0.8, min(1.25, (med / p['area']) ** 0.5))
            p['img'] = p['img'].resize((round(p['img'].width * f), round(p['img'].height * f)), Image.LANCZOS)
            p['dcx'] *= f; p['ground'] *= f; p['dogh'] *= f
    stand = sorted(p['dogh'] for p in parts)[len(parts) // 2]       # 用中間值當「站著的狗」的高度
    s = float(opt['match-height']) / stand
    for p in parts:
        p['img'] = p['img'].resize((round(p['img'].width * s), round(p['img'].height * s)), Image.LANCZOS)
        p['dcx'] *= s; p['ground'] *= s
    left = max(p['dcx'] for p in parts); right = max(p['img'].width - p['dcx'] for p in parts)
    up = max(p['ground'] for p in parts); down = max(p['img'].height - p['ground'] for p in parts)
    CW = int(round(max(left, right) * 2)) + 4; CH = int(round(up + down)) + 4; G = int(round(up)) + 2
    sheet = Image.new('RGBA', (CW * len(parts), CH), (0, 0, 0, 0))
    for i, p in enumerate(parts):
        sheet.alpha_composite(p['img'], (i * CW + int(round(CW / 2 - p['dcx'])), G - int(round(p['ground']))))
    sheet.save(out, optimize=True)
    print(json.dumps({'src': out.split('/')[-1], 'frames': len(parts), 'cw': CW, 'ch': CH, 'ground': G}, ensure_ascii=False))

main()
