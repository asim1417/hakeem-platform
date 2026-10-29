#!/usr/bin/env python3
"""gap026c (HKM-052): الدور الثالث بعد تصحيح gap028 لنفاذ تنظيم وكالة الأنباء السعودية 1444 إلى 2023-06-16 (نشره في أم القرى 1444/11/27).

gap026 (HKM-052): مواءمة search_surface (أي إصدار يظهر في البحث في تاريخ معيّن) مع تاريخ نفاذ الإصدار الجديد الموثق.

وجده القياس المستقل 29/10 (ملاحظة 2 على #961): في 12 عملًا يبدأ ظهور الإصدار الجديد في search_surface قبل تاريخ نفاذه الموثق
(legal_systems.preamble_effective_from بصف legal_text_provenance)، فيظهر الإصدار الجديد ويُخفى السابق وهو ما زال نافذًا.
الجدول إضافة فقط (مشغّل hakeem_append_only)، والقراءة في lib/modules/legal-core/search-surface.ts (computeSurface): لكل عمل يُختار
الصف الأحدث valid_on ≤ التاريخ، وعند التساوي الأحدث إنشاءً. فالتصحيح بصفّين جديدين لكل عمل:
  (1) الإصدار السابق في التاريخ القديم نفسه (أحدث إنشاءً فيغلب الصف القديم عند التساوي)، فيبقى ظاهرًا إلى ما قبل النفاذ؛
  (2) الإصدار الجديد من تاريخ نفاذه الموثق.
الحارس بعد التثبيت يحاكي computeSurface: قبل النفاذ بيوم يظهر السابق، ويوم النفاذ يظهر الجديد.
تفويض المالك 29/10 23:58 «اكمل شي».
"""
import datetime, hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'gap026c-surface-align-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
# (العمل، الصف الأصلي للإصدار الجديد، الإصدار الجديد، تاريخه في السطح، الإصدار السابق، نفاذ الجديد الموثق، الاسم)
ROWS = [
    ('we:cmpz5p16y000jcwg2anizr5s9', 'ss34-ebe9d46797531576c15d4ec1', 'cmpz5p2xv000scwg2nhz32vnx', '2023-02-14', 'cmpz5p16y000jcwg2anizr5s9', '2023-06-16', 'تنظيم وكالة الأنباء السعودية 1444 (بدل تنظيم 1433)'),
]


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def surf(work, d):
    return (f"(SELECT surface_system_id FROM search_surface WHERE work_key={lit(work)} AND valid_on <= {lit(d)}::date "
            f"ORDER BY valid_on DESC, created_at DESC, id DESC LIMIT 1)")


before = [f"(SELECT count(*) FROM search_surface WHERE id={lit(r[1])} AND surface_system_id={lit(r[2])} AND valid_on={lit(r[3])}::date)=1" for r in ROWS]
before += [f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(r[2])})={lit(r[5])}::date" for r in ROWS]
st = [f"SELECT CASE WHEN {' AND '.join(before)} AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
vals = []
for work, orig, new_sid, d1, old_sid, d2, name in ROWS:
    vals.append(f"({lit('ssg26c-' + h(BY, work, 'old'))}, {lit(work)}, {lit(old_sid)}, {lit(d1)}::date, "
                f"{lit(f'HKM-052 {BY}: يبقى الإصدار السابق ظاهرًا من {d1} إلى ما قبل نفاذ الجديد ({name}) في {d2}')}, {lit(orig)}, {lit(BY)}, now())")
    vals.append(f"({lit('ssg26c-' + h(BY, work, 'new'))}, {lit(work)}, {lit(new_sid)}, {lit(d2)}::date, "
                f"{lit(f'HKM-052 {BY}: الإصدار الجديد ({name}) يظهر من تاريخ نفاذه الموثق {d2} (legal_systems + legal_text_provenance) بدل {d1}')}, {lit(orig)}, {lit(BY)}, now())")
st.append("INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by, created_at) VALUES\n" + ',\n'.join(vals))
after = []
for work, orig, new_sid, d1, old_sid, d2, name in ROWS:
    prev = (datetime.date.fromisoformat(d2) - datetime.timedelta(days=1)).isoformat()
    after.append(f"{surf(work, prev)}={lit(old_sid)}")
    after.append(f"{surf(work, d2)}={lit(new_sid)}")
st.append(f"SELECT CASE WHEN {' AND '.join(after)} AND (SELECT count(*) FROM search_surface WHERE created_by={lit(BY)})={2 * len(ROWS)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'report': {'works': len(ROWS), 'surface_rows': 2 * len(ROWS), 'new_articles': 0, 'changed_text': 0,
           'plan': [dict(work=r[0], name=r[6], shown_from_before=r[3], shown_from_after=r[5]) for r in ROWS]}, 'statements': st},
          open(D / 'statements_c.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
