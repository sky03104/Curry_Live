#!/usr/bin/env python3
"""把萌戰三國的 3D 武將動作（Meshy 的 fbx）逐格拍成 2D 連續圖，給直播亂鬥用。
用法（需要 bpy：python3 -m venv v && v/bin/pip install bpy pillow numpy）：
  v/bin/python tools/render_hero_sprites.py -- <武將資料夾> <heroId> [--out assets/heroes] [--frames 8] [--yaw 45]
武將資料夾裡要有 <名字>_待機.fbx／_攻擊.fbx／_技能.fbx／_走路.fbx（沒有的動作略過）。
輸出：assets/heroes/<heroId>_<動作>.png（一排橫放、每格一樣大、腳底對齊）＋印出要貼進 js/config.js 的 heroAnims 設定。
畫面比例：站著的角色高度＝198 像素（單張圖 396 的一半，設定裡 res:2），所以所有動作跟單張圖等比例。"""
import bpy, sys, os, math, json, glob
from mathutils import Vector
from PIL import Image

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
folder, hero = args[0], args[1]
opt = dict(zip(args[2::2], args[3::2]))
OUT = opt.get('--out', 'assets/heroes'); NF = int(opt.get('--frames', 8)); YAW = float(opt.get('--yaw', 45))
RES = 2.0; STAND_PX = 396 / RES
CLIPS = {'idle': '待機', 'attack': '攻擊', 'skill': '技能', 'walk': '走路'}

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    sc = bpy.context.scene
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    return sc, arm, meshes

def bounds(meshes):
    pts = [m.matrix_world @ Vector(c) for m in meshes for c in m.bound_box]
    return min(p.z for p in pts), max(p.z for p in pts)

def setup(sc, size_px, ppu):
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
    sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = size_px
    sc.render.resolution_percentage = 100
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = size_px / ppu
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
    sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3.2
    so = bpy.data.objects.new('s', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    return co

# 站著的高度（用待機第一格）決定整個武將的縮放與地面
idle = glob.glob(os.path.join(folder, '*_待機.fbx'))
if not idle: sys.exit('找不到待機.fbx')
sc, arm, meshes = load(idle[0]); sc.frame_set(1)
z0, z1 = bounds(meshes); H = z1 - z0
PPU = STAND_PX / H
SIZE = int(2.6 * STAND_PX)
GROUND_A = 0.42 * SIZE / PPU          # 相機中心比地面高多少（單位）→ 地面在畫面約 92% 的位置
print(f'站高 {H:.3f}，每單位 {PPU:.1f} 像素，畫布 {SIZE}')

result = {}
for key, zh in CLIPS.items():
    fs = glob.glob(os.path.join(folder, f'*_{zh}.fbx'))
    if not fs: continue
    sc, arm, meshes = load(fs[0])
    act = bpy.data.actions[0]; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    co = setup(sc, SIZE, PPU)
    hips = arm.pose.bones.get('Hips') or arm.pose.bones[0]
    n = NF; frames = []
    a = math.radians(YAW)
    for i in range(n):
        f = f0 + round(i * (f1 - f0) / n)         # 不含最後一格（循環動作才接得上）
        sc.frame_set(f)
        hp = arm.matrix_world @ hips.head
        tgt = Vector((hp.x, hp.y, z0 + GROUND_A))
        co.location = tgt + Vector((math.sin(a), -math.cos(a), 0)) * 20
        co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
        p = f'/tmp/_hs_{hero}_{key}_{i}.png'; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        frames.append(Image.open(p).convert('RGBA'))
    # 每一格切成同樣大小：以畫面水平中心對稱，高度取所有格的聯集
    bbs = [im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox() for im in frames]
    bbs = [b for b in bbs if b]
    half = max(max(SIZE / 2 - b[0], b[2] - SIZE / 2) for b in bbs) + 3
    top = max(0, min(b[1] for b in bbs) - 3); bot = min(SIZE, max(b[3] for b in bbs) + 3)
    cw = int(math.ceil(half * 2)); ch = bot - top
    gy = SIZE / 2 + GROUND_A * PPU       # 地面在畫面中的 y（相機中心往下 GROUND_A）
    ground = int(round(gy - top))
    sheet = Image.new('RGBA', (cw * n, ch), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        cell = im.crop((int(SIZE / 2 - cw / 2), top, int(SIZE / 2 - cw / 2) + cw, bot)); sheet.paste(cell, (i * cw, 0))
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f'{hero}_{key}.png'), optimize=True)
    dur = (f1 - f0 + 1) / sc.render.fps
    fps = round(n / dur, 1)
    result[key] = {'src': f'{hero}_{key}.png', 'frames': n, 'cw': cw, 'ch': ch, 'ground': ground, 'fps': fps, 'res': RES}
    print(key, 'cell', cw, ch, 'ground', ground, 'fps', fps, 'size', os.path.getsize(os.path.join(OUT, f'{hero}_{key}.png')) // 1024, 'KB')
print('HEROANIMS ' + json.dumps({hero: result}, ensure_ascii=False))
