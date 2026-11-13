"""產生要貼進 Firebase 後台的「完整規則檔」：萌戰三國原本的規則 + 直播亂鬥的存檔規則。

為什麼要合併：Firebase 後台的規則是「整份取代」，不是「新增一段」。這兩個遊戲共用同一個 Firebase 專案
（mengzhan-sanguo），如果只貼直播亂鬥那一小段，萌戰三國原本的規則會被蓋掉。

用法：python3 tools/make_firestore_rules.py [Curry_Games 的路徑，預設 ../Curry_Games]
輸出：firebase/firestore.rules  （整份複製貼進 Firebase Console → Firestore Database → 規則 → 發布）
Curry_Games 只讀取，不會被改動。萌戰三國那邊的規則有改過，就要重跑這支再重貼一次。
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Curry_Games'))
ORIGINAL = os.path.join(SRC, 'firebase', 'firestore.rules')
OUT = os.path.join(ROOT, 'firebase', 'firestore.rules')

BLOCK = '''
    // ============================================================
    // 【萌戰三國・直播亂鬥 Curry_Live】等級存檔
    // 資料位置：curryLiveSaves/{雲端代號}/slots/{存檔名稱}
    //
    // 誰能做什麼：
    //   ・不用登入。靠「雲端代號」這串隨機長密碼保護 —— 知道代號才讀得到、寫得到那份存檔。
    //   ・只能讀一份（get）、建立、更新；不能列出清單（list），也不能刪除。所以沒辦法用掃描的方式找到別人的存檔。
    //   ・內容限制：只能有 v、data、savedAt 三個欄位，data 是字串且不超過 300000 字，避免被拿來塞垃圾。
    //
    // ⚠️ 已知風險：因為不用登入，任何人只要知道這個專案的公開金鑰，就能自己編一個代號、
    //    建立最多 300KB 的文件，消耗免費儲存空間。需要時再改成要求匿名登入或加上 App Check。
    // ============================================================
    match /curryLiveSaves/{token}/slots/{slot} {
      function validToken() { return token.size() >= 24 && token.size() <= 64; }
      function validSave() {
        return request.resource.data.keys().hasOnly(['v', 'data', 'savedAt'])
          && request.resource.data.v == 1
          && request.resource.data.data is string
          && request.resource.data.data.size() <= 300000
          && request.resource.data.savedAt is int
          && slot.size() <= 80;
      }
      allow get: if validToken();
      allow create, update: if validToken() && validSave();
      allow list, delete: if false;
    }
'''

BANNER = '''// ============================================================
// 這份檔案是自動產生的，請不要手動修改。產生方式：python3 tools/make_firestore_rules.py
// 內容 = 萌戰三國（Curry_Games）原本的 Firestore 規則  +  直播亂鬥（Curry_Live）的存檔規則
// 部署：整份複製，貼進 Firebase Console → Firestore Database → 規則 → 發布。
// ============================================================

'''

text = open(ORIGINAL, encoding='utf8').read()
marker = '    // 其他集合目前都不存在'          # 萌戰三國規則裡「其他集合預設全部拒絕」那段的開頭
if marker not in text:
    sys.exit('找不到插入位置（萌戰三國的規則檔結構變了），請手動檢查 ' + ORIGINAL)
if 'curryLiveSaves' in text:
    sys.exit('萌戰三國的規則裡已經有 curryLiveSaves，請先檢查是不是重複了')
merged = BANNER + text.replace(marker, BLOCK.lstrip('\n') + '\n' + marker, 1)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf8').write(merged)
print(f'已產生 {os.path.relpath(OUT, ROOT)}（{len(merged.splitlines())} 行）')
