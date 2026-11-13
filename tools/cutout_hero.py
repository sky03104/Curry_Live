"""把一張角色圖去背，轉成遊戲用的全身圖（312x396 透明背景），放進 assets/heroes/。

用法：python3 tools/cutout_hero.py <原圖路徑> <heroId> [--no-ai]
範例：python3 tools/cutout_hero.py 米其林.webp michelin

需要：pip install rembg scipy pillow（rembg 第一次執行會自動下載約 180MB 的 AI 模型）
  --no-ai：不用 AI，改用「從邊界往內填」去背。只適用純色背景且角色身上沒有接近底色的部位；
           腳下的陰影會被留下來，通常效果比 AI 差，只在裝不了 rembg 時使用。

做的事：
  1. 去背（預設用 rembg 的 isnet 模型＋毛邊處理，會連腳下的陰影一起去掉）
  2. 清掉細碎的雜點（只留最大的那一塊主體）
  3. 裁到主體邊界，縮進 312x396 的畫布，水平置中、腳底貼齊底邊（跟其他 38 隻武將的圖一致）
新增角色還要：在 data/extra-heroes.js 加資料；陣營要是新的，在 js/config.js 的 factions 加顏色。
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = (312, 396)   # 跟 tools/sync_from_curry_games.py 縮出來的尺寸一樣


def cut_ai(img):
    from rembg import new_session, remove
    return remove(img, session=new_session('isnet-general-use'), alpha_matting=True,
                  alpha_matting_foreground_threshold=235, alpha_matting_background_threshold=15,
                  alpha_matting_erode_size=8).convert('RGBA')


def cut_flood(img):
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3)]), axis=0)
    lab, _ = ndimage.label(np.sqrt(((a - bg) ** 2).sum(axis=2)) < 14)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ndimage.binary_fill_holes(ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=1))
    return Image.fromarray(np.dstack([a.astype(np.uint8), (fg * 255).astype(np.uint8)]))


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    if len(args) != 2:
        sys.exit(__doc__)
    src, hero_id = args
    img = Image.open(src).convert('RGB')
    rgba = np.asarray(cut_flood(img) if '--no-ai' in sys.argv else cut_ai(img)).copy()
    alpha = rgba[..., 3]
    # 只留最大的一塊，清掉細碎雜點
    lab, n = ndimage.label(alpha > 128)
    if n > 1:
        sizes = ndimage.sum(alpha > 128, lab, range(1, n + 1))
        keep = lab == (1 + int(np.argmax(sizes)))
        alpha[~ndimage.binary_dilation(keep, iterations=3)] = 0
    ys, xs = np.where(alpha > 8)
    subject = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = min(SIZE[0] / subject.width, SIZE[1] / subject.height)
    subject = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', SIZE, (0, 0, 0, 0))
    canvas.paste(subject, ((SIZE[0] - subject.width) // 2, SIZE[1] - subject.height), subject)   # 水平置中、腳底貼齊底邊
    out = os.path.join(ROOT, 'assets', 'heroes', hero_id + '.png')
    canvas.save(out, optimize=True)
    print(f'已產生 {os.path.relpath(out, ROOT)}（主體 {subject.width}x{subject.height}，{os.path.getsize(out) // 1024}KB）')


main()
