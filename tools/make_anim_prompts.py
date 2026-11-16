#!/usr/bin/env python3
"""替 38 隻三國武將各產生一份「走路／攻擊／技能／待機」逐格動畫提示詞（給 Gemini 生圖用）。
輸出：tools/anim_prompts/sanguo/<heroId>.md ＋ tools/anim_prompts/sanguo/隊列.md（每天生哪幾隻）。
改了下面的表（武器、技能動作、兵種動作）就重跑：python3 tools/make_anim_prompts.py"""
import json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'anim_prompts', 'sanguo')
RAW = 'https://raw.githubusercontent.com/sky03104/Curry_Live/main'
txt = open(os.path.join(ROOT, 'data', 'heroes.js'), encoding='utf-8').read()
HEROES = json.loads(txt[txt.index('['):txt.rindex(']') + 1])
FACING_RIGHT = {'taishici'}     # 單張圖本來就面向右的（config.js 的 artFacesRight）；其他都面向左

FACTION = {'Shu': '蜀', 'Wei': '魏', 'Wu': '吳', 'Qun': '群'}
TROOP = {'Vanguard': '猛將', 'Strategist': '謀士', 'Commander': '統帥', 'Ranger': '遊俠'}
# 武器：(名稱, 類型)。類型：polearm 長柄／sword 劍刀／heavy 重武器／bow 弓／caster 法器／bare 空手施法
WEAPON = {
 'liubei': ('雙股劍', 'sword'), 'guanyu': ('青龍偃月刀', 'polearm'), 'zhangfei': ('丈八蛇矛', 'polearm'), 'zhaoyun': ('龍膽亮銀槍', 'polearm'),
 'machao': ('虎頭湛金槍', 'polearm'), 'huangzhong': ('長弓', 'bow'), 'zhugeliang': ('鵝毛羽扇', 'caster'), 'pangtong': ('彩羽扇', 'caster'),
 'jiangwei': ('亮銀纓槍', 'polearm'), 'weiyan': ('寒鋩大刀', 'polearm'), 'guanping': ('捲雲刀', 'sword'), 'caocao': ('倚天劍', 'sword'),
 'xiahoudun': ('虎頭闊刀', 'polearm'), 'xuchu': ('巨槌', 'heavy'), 'zhangliao': ('雁翎戟', 'polearm'), 'simayi': ('', 'bare'),
 'guojia': ('', 'bare'), 'dianwei': ('護心雙戟', 'heavy'), 'xunyu': ('', 'bare'), 'caopi': ('龍雀劍', 'sword'), 'sunquan': ('權杖', 'caster'),
 'zhouyu': ('朱雀羽扇', 'caster'), 'daqiao': ('牡丹團扇', 'caster'), 'xiaoqiao': ('琵琶', 'caster'), 'ganning': ('彎刀', 'sword'),
 'luxun': ('', 'bare'), 'taishici': ('流星雙戟', 'polearm'), 'lusu': ('溫玉劍', 'sword'), 'sunce': ('霸王劍', 'sword'),
 'lvbu': ('方天畫戟', 'polearm'), 'diaochan': ('羽扇', 'caster'), 'dongzhuo': ('西涼巨劍', 'heavy'), 'huaxiong': ('赤焰大刀', 'polearm'),
 'wangyun': ('螭紋玉笏', 'caster'), 'yuji': ('虯龍木杖', 'caster'), 'zhangjiao': ('雷紋法杖', 'caster'), 'yanliang': ('寒鋒大刀', 'polearm'),
 'wenchou': ('烈風戟', 'polearm'),
}
# 技能動作（技能名的意境，只畫「姿勢」，特效由遊戲處理）
SKILL = {
 'liubei': '雙劍收回腰間，雙臂向兩側大大張開，仁厚地向前鼓舞士氣',
 'guanyu': '青龍偃月刀倒拖在地，另一手捋長鬚，緩步上前後猛然橫掃一刀',
 'zhangfei': '丈八蛇矛高舉，張開大口對天怒吼，上身先後仰再猛然前傾',
 'zhaoyun': '長槍連續向前突刺，身形旋轉突進，動作迅捷如游龍',
 'machao': '長槍直指前方，身體壓低向前猛衝，披風向後飛揚',
 'huangzhong': '拉滿長弓，瞄準遠方，最後鬆手放箭',
 'zhugeliang': '羽扇高舉，另一手結劍指，最後羽扇向前輕輕一揮，神態從容',
 'pangtong': '羽扇指向前方，另一手在身前畫圓，最後羽扇向前一指',
 'jiangwei': '長槍杵地，昂首發誓，隨後把槍高高舉起再指向前方',
 'weiyan': '側身蓄力，持刀猛然斜向突進一劈，帶點奇襲的狡猾感',
 'guanping': '大刀橫擋在身前護住，再猛地向前砍出',
 'caocao': '倚天劍指向前方，另一手向前一揮下令，氣勢睥睨',
 'xiahoudun': '一手拔出臉上的箭、張口吞下，怒目圓睜，隨後揮動闊刀猛劈',
 'xuchu': '扯開上衣露出身體，雙手高舉巨槌，猛力向前砸下',
 'zhangliao': '雁翎戟前指怒喝，突進一步直刺而出',
 'simayi': '緩緩回頭，眼神銳利如鷹狼，雙手結印，最後向前一推',
 'guojia': '攤開手掌掐指盤算，最後自信地指向前方',
 'dianwei': '雙戟交叉在胸前，怒吼後猛力向前交叉劈出',
 'xunyu': '雙手背在身後，微微一笑，一手向前輕揮下令',
 'caopi': '龍雀劍指天，停頓後帶著野心重重向前斬下',
 'sunquan': '權杖高舉，最後重重頓向地面，沉穩有威嚴',
 'zhouyu': '羽扇輕搖，嘴角帶笑，談笑間羽扇向前一指',
 'daqiao': '團扇輕舞，身姿優雅旋轉，最後雙手向前撒出',
 'xiaoqiao': '抱起琵琶，手指在弦上連續撥動，最後向前一掃弦',
 'ganning': '彎刀橫斬，身體向前躍進，氣勢豪邁',
 'luxun': '雙手在身前合攏蓄力，最後雙掌向前猛然一推',
 'taishici': '雙戟舉起旋轉，向前衝刺，雙戟前後交錯劈出',
 'lusu': '劍收回腰間，雙手向兩側平伸，沉穩地向前鼓舞',
 'sunce': '霸王劍直指前方，身體躍起向前突刺，氣勢如猛虎',
 'lvbu': '方天畫戟旋轉揮舞一整圈，最後重重向前劈下，狂傲霸氣',
 'diaochan': '羽扇半遮臉，眼波流轉，最後羽扇向前輕輕一揮',
 'dongzhuo': '雙手舉起西涼巨劍，用整個身體的重量重重砸向地面',
 'huaxiong': '赤焰大刀高舉過頭，張口大吼，隨後猛力劈下',
 'wangyun': '雙手持玉笏，在身前連續點三下，最後指向前方',
 'yuji': '木杖在空中畫符，另一手掌向前一推，帶點神祕感',
 'zhangjiao': '法杖高舉向天，另一手攤開，最後法杖指向前方',
 'yanliang': '大刀橫向猛力掃過，氣勢威猛',
 'wenchou': '烈風戟向前猛刺，身體跟著前傾',
}
ATTACK = {   # 普攻：依武器類型
 'polearm': ['雙手握住長柄武器，擺出準備姿勢', '武器向後拉開，身體微微後仰', '腰部扭轉，蓄力到最大', '武器開始向前揮出，身體前傾', '武器揮到最前方，擊中前方目標（命中瞬間）', '揮擊的餘勢，武器劃過身體另一側', '收回武器，身體回正', '回到準備姿勢（要能接回第 1 格）'],
 'sword': ['單手持武器，擺出準備姿勢', '武器向後拉開', '身體扭轉蓄力，武器舉到肩後', '向前踏步，武器開始揮出', '武器斬到最前方（命中瞬間）', '揮擊的餘勢，武器劃過身體另一側', '收回武器，身體回正', '回到準備姿勢（要能接回第 1 格）'],
 'heavy': ['雙手握住重武器，擺出準備姿勢', '重武器向後拉到身後，身體後仰', '重武器高舉過頭，蓄力到最大', '用力向前下方砸出', '重武器砸到最前方地面附近（命中瞬間）', '武器沉在地面，身體前傾', '吃力地把武器提起，身體回正', '回到準備姿勢（要能接回第 1 格）'],
 'bow': ['拿著弓，擺出準備姿勢', '從身後抽出一支箭搭上弓弦', '舉弓，開始拉弦', '弓拉到滿，瞄準前方', '鬆手，箭射出（命中瞬間，不要畫出箭或殘影）', '弓弦震動，手臂維持前伸姿勢', '放下弓，身體回正', '回到準備姿勢（要能接回第 1 格）'],
 'caster': ['拿著法器，擺出準備姿勢', '法器收到胸前，另一手抬起', '法器舉高，身體微微後仰蓄力', '法器向前揮出', '法器指向前方，施放出去（命中瞬間，不要畫任何光或特效）', '手臂維持前伸，衣袖飄動', '收回手臂，身體回正', '回到準備姿勢（要能接回第 1 格）'],
 'bare': ['雙手空手，擺出準備姿勢', '一手抬到胸前', '雙手在身前合攏蓄力', '雙手向前推出', '雙掌推到最前方，施放出去（命中瞬間，不要畫任何光或特效）', '手臂維持前伸，衣袖飄動', '收回雙手，身體回正', '回到準備姿勢（要能接回第 1 格）'],
}
WALK = {
 'Vanguard': '沉穩有力的大步行進，身體微微前傾，手臂與腿大幅度擺動，武器握在手中隨步伐輕晃',
 'Strategist': '從容優雅的緩步，上身挺直，衣袖與衣襬隨步伐飄動，一手拿著法器',
 'Commander': '昂首闊步，胸膛挺起，步伐穩健有威儀，披風隨步伐擺動',
 'Ranger': '輕快敏捷的快步，身體略前傾，步伐輕盈',
}
IDLE = {
 'Vanguard': '站姿待機，呼吸起伏，重心在兩腳間輕微轉換，偶爾抬眼看向前方，武器握在手中輕輕晃動',
 'Strategist': '站姿待機，呼吸起伏，衣袖輕輕飄動，一手把玩法器，偶爾微微歪頭沉思',
 'Commander': '站姿待機，呼吸起伏，挺胸站立，披風輕輕擺動，偶爾環顧四周',
 'Ranger': '站姿待機，呼吸起伏，輕輕踮腳換重心，警覺地左右看了看',
}
def spec(h, facing_right):
    w, _ = WEAPON[h['heroId']]
    wtxt = f'手持「{w}」' if w else '空手（沒有武器）'
    side = '右' if facing_right else '左'
    return f"""角色：附圖裡的三國武將「{h['displayName']}」（{FACTION[h['faction']]}陣營・{TROOP[h['troop']]}），{wtxt}。每一格的臉、髮型、服裝、盔甲、顏色、武器都必須跟附圖**一模一樣**，用跟附圖同樣精緻的Q版可愛插畫風。

背景：純綠色 #00FF00，整張圖只有這一種綠色，不要地面、不要陰影、不要漸層。（角色身上不要出現鮮豔的純綠色。）

排版：圖片橫式 3:2；8 格，4 欄 × 2 列，每格一樣大、等距排列，格與格之間留綠色空白；不要格線、邊框、文字、編號。閱讀順序由左到右、由上到下。

每一格：角色全身完整入鏡（含頭髮、帽子／頭盔、腳、武器，不被切到邊）；**角色要畫小一點，每格上下左右都留至少 10% 的綠色空白，絕對不能超出格子**；角色大小每格一致；腳底站的高度每格一致（跳起來的格除外）。

方向：角色面向畫面{side}邊（跟附圖一樣，側面或 3/4 側面），每格鏡頭角度一致。
特效：什麼特效都不要畫（不要光、不要線條、不要殘影、不要文字），特效由遊戲自己處理。"""

def build(h):
    hid = h['heroId']; w, wt = WEAPON[hid]; fr = hid in FACING_RIGHT
    sp = spec(h, fr)
    atk = ATTACK[wt]
    def lst(a): return '\n'.join(f'{i + 1}. {t}' for i, t in enumerate(a))
    wk = f'{WALK[h["troop"]]}。8 格由左到右、由上到下：\n' + '\n'.join(f'{i}. {t}' for i, t in enumerate(['左腳在前著地，身體微微下沉', '重心移到左腳，身體升起，右腳離地', '右腳向前擺出', '右腳在前著地，身體微微下沉', '重心移到右腳，身體升起，左腳離地', '左腳向前擺出', '左腳繼續向前，接近第 1 格的姿勢', '回到第 1 格前一刻的姿勢（循環不跳）'], 1))
    skl = [f'技能「{h["skillName"]}」：{SKILL[hid]}。8 格由左到右、由上到下：', '準備姿勢', '開始蓄力，身體動作預備', '蓄力到最大，姿勢最張揚', '動作開始發出', '動作到最高點／最猛烈', '技能施放出去（命中瞬間，不要畫任何光或特效）', '餘勢，姿勢維持並緩緩收尾', '回到準備姿勢（要能接回第 1 格）']
    sk = skl[0] + '\n' + '\n'.join(f'{i}. {t}' for i, t in enumerate(skl[1:], 1))
    idl = f'{IDLE[h["troop"]]}。8 格循環：\n' + '\n'.join(f'{i}. {t}' for i, t in enumerate(['站定，吸氣', '胸口微微升起', '吸氣到最高，頭微微抬起', '開始吐氣', '胸口下沉', '重心微微換到另一腳', '眼神或頭輕輕轉動', '回到第 1 格的姿勢（循環不跳）'], 1))
    name = f"{h['displayName']}（{hid}）"
    ref = f'{RAW}/assets/heroes/{hid}.png'
    md = f"""# {name} 逐格動畫提示詞（{FACTION[h['faction']]}・{TROOP[h['troop']]}・技能「{h['skillName']}」）

**參考圖（每次都要附上）**：{ref}
（repo 內路徑：`assets/heroes/{hid}.png`）

用法：每個動畫各生一張圖。把「共用規格」＋該動畫的內容一起貼給 Gemini，並附上參考圖。生好的圖用 `{hid}_動作.png` 命名（動作＝walk／attack／skill／idle），丟給 Claude 處理。
建議命中格：普攻第 5 格、技能第 6 格。若 Gemini 一次畫不好 8 格，改成一格一格畫（每次都附上參考圖＋前一格）。

## 共用規格（四個動畫都要貼）
```
{sp}
```

## 1. 走路（walk）
```
動畫：走路循環，8 格。{wk}
```

## 2. 攻擊（attack）
```
動畫：普攻，8 格。{('用「' + w + '」') if w else '空手'}攻擊。8 格由左到右、由上到下：
{lst(atk)}
```

## 3. 技能（skill）
```
動畫：{sk}
```

## 4. 待機（idle）
```
動畫：待機，8 格循環播放。{idl}
```
"""
    return md

os.makedirs(OUT, exist_ok=True)
order = []
for h in HEROES:
    open(os.path.join(OUT, f"{h['heroId']}.md"), 'w', encoding='utf-8').write(build(h)); order.append(h)
# 隊列：一天兩隻，先做辨識度高的主力，再依陣營
PRIORITY = ['guanyu', 'lvbu', 'zhugeliang', 'caocao', 'zhaoyun', 'zhangfei', 'liubei', 'zhouyu', 'diaochan', 'sunquan', 'machao', 'huangzhong']
byid = {h['heroId']: h for h in HEROES}
queue = [byid[i] for i in PRIORITY] + [h for h in HEROES if h['heroId'] not in PRIORITY]
lines = ['# 三國武將動畫生圖隊列（一天兩隻，約 19 天做完）', '', '做完一隻就把 `[ ]` 改成 `[x]`。每隻 4 張圖（走路、攻擊、技能、待機）。', '', '| 日 | 武將 | 提示詞 | 狀態 |', '|---|---|---|---|']
for i in range(0, len(queue), 2):
    for h in queue[i:i + 2]:
        lines.append(f"| 第{i // 2 + 1}天 | {h['displayName']} | [{h['heroId']}.md]({h['heroId']}.md) | [ ] |")
open(os.path.join(OUT, '隊列.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
open(os.path.join(OUT, '隊列.txt'), 'w', encoding='utf-8').write('\n'.join(h['heroId'] for h in queue) + '\n')   # 給 Gemini／排程讀的純名單（一行一個 heroId，照順序）
print('產生', len(order), '份提示詞')
