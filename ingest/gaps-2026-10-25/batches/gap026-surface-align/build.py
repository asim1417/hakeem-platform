#!/usr/bin/env python3
"""gap026 (HKM-052): مواءمة search_surface (أي إصدار يظهر في البحث في تاريخ معيّن) مع تاريخ نفاذ الإصدار الجديد الموثق.

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
BY = 'gap026-surface-align-2026-10-30'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
# (العمل، الصف الأصلي للإصدار الجديد، الإصدار الجديد، تاريخه في السطح، الإصدار السابق، نفاذ الجديد الموثق، الاسم)
ROWS = [
    ('we:cmpz5ragp00bjcwg2ugwrmnrc', 'ss34-8c63db75800a23fe986a03e0', 'cmpz5rgqf00c4cwg22mpjae0e', '2021-05-04', 'cmpz5ragp00bjcwg2ugwrmnrc', '2021-08-12', 'تنظيم إعانة البحث عن عمل'),
    ('we:cmpz5q292005rcwg2psbdluqz', 'ss34-c49e4a1f61d5889e8c212297', 'cmpz5q6bk006ccwg2i8hrah97', '2021-01-07', 'cmpz5q292005rcwg2psbdluqz', '2021-04-15', 'نظام صندوق التنمية العقارية'),
    ('we:cmpz5pw89004xcwg2mdbv957p', 'ss34-a96cbe0b3f1de711fa7f466f', 'cmpz5pzbz005ccwg2bo3zoxrz', '2023-02-14', 'cmpz5pw89004xcwg2mdbv957p', '2023-02-24', 'تنظيم مدينة الملك عبدالعزيز للعلوم والتقنية'),
    ('we:cmpz5q30z005vcwg2x4d1f0xs', 'ss34-2172c18d939e1eaab2c205a8', 'cmpz5q7vd006kcwg2uaelgo7l', '2020-02-26', 'cmpz5q30z005vcwg2x4d1f0xs', '2020-09-09', 'نظام ملكية الوحدات العقارية وفرزها وإدارتها'),
    ('we:cmpz5q46u0061cwg26dmscyu6', 'ss34-e2873e408d836ef067852b9a', 'cmpz5q6pi006ecwg2ucqkh1a3', '2021-08-13', 'cmpz5q46u0061cwg26dmscyu6', '2021-11-16', 'نظام إدارة النفايات'),
    ('we:cmpz5qcc80076cwg2b12ttz0m', 'ss34-346fc203b4d31f2fdf57dbef', 'cmpz5qhe2007wcwg2e9oyrkyh', '2021-03-23', 'cmpz5qcc80076cwg2b12ttz0m', '2021-07-01', 'نظام الزراعة (بدل الثروة الحيوانية)'),
    ('we:cmpz5qcj80077cwg2b3yc32or', 'ss34-6df7c8e55debe2d233693e02', 'cmpz5qhe2007wcwg2e9oyrkyh', '2021-03-23', 'cmpz5qcj80077cwg2b3yc32or', '2021-07-01', 'نظام الزراعة (بدل صيد الثروات المائية)'),
    ('we:cmpz5qehg007hcwg2jr47h1fg', 'ss34-b83e68339dbce140fb5477a6', 'cmpz5qhe2007wcwg2e9oyrkyh', '2021-03-23', 'cmpz5qehg007hcwg2jr47h1fg', '2021-07-01', 'نظام الزراعة (بدل الزراعة العضوية)'),
    ('we:cmpz5ph3r002scwg2jyxrxvot', 'ss26-d1b1f3c215a8fbeb701d742b', 'ed25-71b37d1ec31a497747ed643c', '2025-04-02', 'ed25-3c30143d0ec387695e66cce3', '2025-04-03', 'نظام السجل التجاري 1446'),
    ('we:cmpz5q37y005wcwg29m2vyweq', 'ss34-22daacee9ba2ac2126d81acb', 'cmpz5q73g006gcwg211uev9pu', '2022-04-20', 'cmpz5q37y005wcwg29m2vyweq', '2022-08-11', 'نظام التسجيل العيني للعقار'),
    ('we:cmpz5rlje00chcwg2afi55268', 'ss34-8eb2c4e77febe6dfbaa3ac68', 'cmpz5pp91003xcwg2wx5rgsnx', '2019-07-16', 'cmpz5rlje00chcwg2afi55268', '2019-12-01', 'نظام المنافسات والمشتريات الحكومية 1440'),
    ('we:cmpz5phhp002ucwg2v6b7zln6', 'ss26-18844cadbaf665c26b76b55f', 'ed25-fc1bd01b88ecdf6cbcf1e250', '2025-04-02', 'ed25-7010964d153608cdcaa68a48', '2025-04-03', 'نظام الأسماء التجارية 1446'),
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
    vals.append(f"({lit('ssg26a-' + h(BY, work, 'old'))}, {lit(work)}, {lit(old_sid)}, {lit(d1)}::date, "
                f"{lit(f'HKM-052 {BY}: يبقى الإصدار السابق ظاهرًا من {d1} إلى ما قبل نفاذ الجديد ({name}) في {d2}')}, {lit(orig)}, {lit(BY)}, now())")
    vals.append(f"({lit('ssg26a-' + h(BY, work, 'new'))}, {lit(work)}, {lit(new_sid)}, {lit(d2)}::date, "
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
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
