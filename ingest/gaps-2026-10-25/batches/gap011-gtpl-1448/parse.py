#!/usr/bin/env python3
"""gap011: تفكيك نظام المنافسات والمشتريات الحكومية (م/76 لعام 1448هـ) من صفحة أم القرى المحفوظة إلى مواد.

المصدر: source/uqn-4001762.md (صفحة https://www.uqn.gov.sa/decisions-and-regulations/4001762 كما جُلبت 28/10/2026).
القاعدة: كل مادة تبدأ بسطر «المادة <الترتيب>:»، والعناوين أسطر تبدأ بـ«الباب» أو «الفصل».
الفصل يرث الباب الذي فوقه: «الباب …: … › الفصل …: …». النص كما في الصفحة، مع قص المسافات في أطراف الأسطر وحذف الأسطر الفارغة.
المخرج: articles.json (رقم المادة، عنوانها، فصلها، نصها، بصمتها).
"""
import hashlib, json, re, sys
from pathlib import Path

D = Path(__file__).parent
sys.path.insert(0, str(D.parents[1] / 'scripts'))
from arabic import ordinal  # noqa: E402

t = (D / 'source' / 'uqn-4001762.md').read_text(encoding='utf-8')
start = t.index('الباب الأول: أحكام عامة')
end = t.rindex('\nنظام المنافسات والمشتريات الحكومية')  # ذيل الصفحة: الاسم ثم حقوق الجريدة
body = t[start:end]
lines = [l.strip() for l in body.split('\n')]
arts, bab, fasl, cur = [], None, None, None
ART = re.compile(r'^المادة\s+(.+?)\s*:\s*(.*)$')
for l in lines:
    if not l:
        continue
    m = ART.match(l)
    if re.match(r'^الباب\s', l) and not m:
        bab, fasl = l, None
        continue
    if re.match(r'^الفصل\s', l) and not m:
        fasl = l
        continue
    if m:
        n = ordinal(m.group(1))
        assert n, l
        cur = {'n': n, 'title': f'المادة {m.group(1).strip()}', 'chapter': bab + (f' › {fasl}' if fasl else ''), 'lines': []}
        if m.group(2):
            cur['lines'].append(m.group(2))
        arts.append(cur)
        continue
    assert cur, l
    cur['lines'].append(l)
out = []
for a in arts:
    content = '\n'.join(a['lines'])
    out.append({'n': a['n'], 'title': a['title'], 'chapter': a['chapter'], 'content': content, 'sha256': hashlib.sha256(content.encode()).hexdigest()})
nums = [a['n'] for a in out]
assert nums == list(range(1, len(nums) + 1)), nums
assert len(out) == 101
assert out[-1]['content'] == 'يعمل بالنظام بعد مضي (مائة وعشرين) يومًا من تاريخ نشره في الجريدة الرسمية.'
assert out[99]['content'].startswith('يحل النظام محل نظام المنافسات والمشتريات الحكومية، الصادر بالمرسوم الملكي رقم (م/128)')
(D / 'articles.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
chs = []
for a in out:
    if not chs or chs[-1][0] != a['chapter']:
        chs.append([a['chapter'], 0])
    chs[-1][1] += 1
print(len(out), 'articles;', len(chs), 'divisions')
for c, k in chs:
    print(f'  {k:3d}  {c}')
