"""把版本號加一（同時改 js/version.js 和 version.json）。每次有更新要上線前跑一次。
用法：python3 tools/bump_version.py          （自動：今天日期.流水號，同一天再跑就 +1）
      python3 tools/bump_version.py 1.2.0   （自己指定）
"""
import datetime, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vj = os.path.join(ROOT, 'version.json'); vjs = os.path.join(ROOT, 'js', 'version.js')
old = json.load(open(vj))['version']
if len(sys.argv) > 1: new = sys.argv[1]
else:
    today = datetime.date.today().isoformat()
    m = re.fullmatch(r'(\d{4}-\d{2}-\d{2})\.(\d+)', old)
    new = f'{today}.{int(m.group(2)) + 1}' if m and m.group(1) == today else f'{today}.1'
json.dump({'version': new}, open(vj, 'w')); open(vj, 'a').write('\n')
s = open(vjs, encoding='utf-8').read()
open(vjs, 'w', encoding='utf-8').write(re.sub(r"APP_VERSION = '[^']*'", f"APP_VERSION = '{new}'", s))
print(f'版本號 {old} → {new}')
