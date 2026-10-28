#!/usr/bin/env python3
"""gap008 (HKM-048، الصنف M1): حالة سبع أدوات بلا أي حالة، بحكم قارئين مستقلين متفقين (readers/readings/round2).
لا يُكتب إلا ما اتفق عليه القارئان في الحالة؛ والتاريخ لا يُكتب («— من …») إلا إذا اتفقا عليه أيضًا.
الاقتباس من نص حكيم المخزن (يُثبت بـ strpos وبصمة المادة)، عدا M1-15 فنصها من أم القرى p=23821 كما قرأه القارئان حرفًا.
الباقي (10) لم يتفق فيه القارئان أو لم يجدا دليلًا رسميًا: يبقى بلا حالة ويُعرض على المالك.
"""
import hashlib, json
from pathlib import Path
OUT = Path(__file__).parent
BY = 'gap008-statuses-2026-10-28'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'
ITHBAT126 = ('cmpz635e803s1cwg2afbyx0qs', '2d419922ff12e054494e3c5fc4b96cf7', 'تنشر الضوابط والقواعد والأدلة الإجرائية المشار إليها في الفقرة (1) من هذه المادة في الجريدة الرسمية، ويعمل بها من تاريخ العمل بهذا النظام.')
ITEMS = [  # (item, system_id, name, status, instrument, url, (article_id, md5, quote) | literal, method)
 ('M1-06', 'cmr4rvkrh001d1j0u78q4z84m', 'اللائحة التنفيذية لإجراءات الاستئناف', 'مستبدل',
  'قرار وزير العدل رقم (512) وتاريخ 05/01/1445هـ — المادة (61) من اللائحة التنفيذية لطرق الاعتراض على الأحكام — من 2023-08-11', 'https://www.uqn.gov.sa/details?p=23463',
  ('cmr4rvl8300421j0u300xa063', '127707ce811bd447d8ef9cc1510938ab', None),
  'الحلول بالمادة (61) من اللائحة التنفيذية لطرق الاعتراض على الأحكام، ونفاذها من نشرها (المادة 62) في أم القرى 1445/01/24هـ = 2023-08-11 (قارئان مستقلان)'),
 ('M1-07', 'cmr4rvl67002d1j0ugcjemx5u', 'اللائحة التنفيذية لطرق الاعتراض على الأحكام', 'ساري',
  'قرار وزير العدل رقم (512) وتاريخ 05/01/1445هـ — من 2023-08-11', 'https://www.uqn.gov.sa/details?p=23463',
  ('cmr4rvl8300431j0ulb352f1o', '9bce13ec7a1a25d6301852127cce10a3', None),
  'النفاذ من النشر (المادة 62)، والنشر في أم القرى 1445/01/24هـ = 2023-08-11 (قارئان مستقلان)'),
 ('M1-17', 'cmr4qm6tq008q9vd1sm15xz4e', 'لائحة نظام الأحوال الشخصية', 'ساري',
  'برقية تعميمية رقم (59641) وتاريخ 1446/08/17هـ — من 2025-02-21', 'https://www.uqn.gov.sa/details?p=27013',
  ('cmr4qm6ud009v9vd1gzfwzeo8', 'bbf282cd994f8172f6c525a5e372c974', None),
  'النفاذ من النشر (المادة 41)، والنشر في أم القرى 1446/08/22هـ = 2025-02-21 (قارئان مستقلان)'),
 ('M1-08', 'cmr4qm6oo007u9vd117jm5enx', 'اللائحة التنفيذية لنظام التوثيق', 'ساري',
  'اللائحة التنفيذية لنظام التوثيق — المادة (30)', 'https://www.uqn.gov.sa/details?p=17181',
  ('cmr4qm6pb008o9vd1sb5ngper', 'dcc3447d3a2068f5b0f7958f8fd806b0', None),
  'نافذة من صدورها (المادة 30)، ونُشرت في أم القرى 1442/07/07هـ (2021-02-19)؛ تاريخ الصدور غير ظاهر فلا يُكتب تاريخ نفاذ (قارئان مستقلان)'),
 ('M1-02', 'cmr4rvlyy004t1j0ukew7yqg7', 'الأدلة الإجرائية لنظام الإثبات', 'ساري',
  'المادة (126) من نظام الإثبات', 'https://www.uqn.gov.sa/details?p=20767',
  ITHBAT126,
  'صادرة بالمادة (126/1/ج) من نظام الإثبات ومنشورة في أم القرى 1444/04/03هـ (2022-10-28)؛ القارئان اتفقا على السريان واختلفا في يومه (نفاذ النظام 2022-07-06 أم النشر)، فلا يُكتب تاريخ'),
 ('M1-14', 'cmr4rvlkz00441j0uj88pwjoe', 'ضوابط إجراءات الإثبات إلكترونياً', 'ساري',
  'المادة (126) من نظام الإثبات', 'https://www.uqn.gov.sa/details?p=20765',
  ITHBAT126,
  'صادرة بالمادة (126/1/أ) من نظام الإثبات ومنشورة في أم القرى 1444/04/03هـ (2022-10-28)؛ القارئان اتفقا على السريان واختلفا في يومه، فلا يُكتب تاريخ'),
 ('M1-15', 'cmpz5rdd200btcwg2g28ujbk1', 'لائحة عمال الخدمة المنزلية ومن في حكمهم', 'مستبدل',
  'قرار وزير الموارد البشرية والتنمية الاجتماعية رقم (40676) وتاريخ 17/03/1445هـ — البند (ثانياً)', 'https://www.uqn.gov.sa/details?p=23821',
  'ثانياً: تحل هذه اللائحة محل لائحة عمال الخدمة المنزلية ومن في حكمهم، الصادرة بقرار مجلس الوزراء رقم (310) وتاريخ 7 /9/ 1434هـ.',
  'حلت محلها لائحة العمالة المنزلية ومن في حكمها (أم القرى 1445/03/21هـ)، ويُعمل بها «بعد سنة من تاريخ إصدارها»؛ اليوم 2024-09-20 أو 21 بحسب العدّ فلا يُكتب تاريخ (قارئان مستقلان، والنص من صفحة أم القرى)'),
]
pre, ins = [], []
for item, sid, name, status, instr, url, q, method in ITEMS:
    pre += [f"(SELECT count(*) FROM legal_systems WHERE id={lit(sid)} AND name={lit(name)})=1",
            f"(SELECT count(*) FROM verification WHERE object_type='work' AND object_id={lit(sid)})=0"]
    if isinstance(q, tuple):
        aid, m, sub = q
        pre.append(f"(SELECT count(*) FROM legal_articles WHERE id={lit(aid)} AND md5(content)={lit(m)})=1")
        quote = (f"btrim(a.content)" if sub is None else
                 f"substr(a.content, strpos(a.content, {lit(sub)}), length({lit(sub)}))")
        if sub is not None:
            pre.append(f"(SELECT strpos(content, {lit(sub)}) FROM legal_articles WHERE id={lit(aid)})>0")
        src = f"FROM legal_articles a JOIN legal_systems s ON s.id=a.\"legalSystemId\" WHERE a.id={lit(aid)}"
        qexpr = f"'المادة ('||a.\"articleNumber\"||') من '||s.name||': «'||{quote}||'» [منهج HKM-048: '||{lit(method)}||']'"
    else:
        src = ""
        qexpr = f"{lit('«' + q + '» [منهج HKM-048: ' + method + ']')}"
    vid = 'vfg8-' + hashlib.sha256(f'{BY}|{sid}|{status}'.encode()).hexdigest()[:24]
    ins.append(f"INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id) "
               f"SELECT {lit(vid)}, 'work', {lit(sid)}, {lit(status)}, {lit(instr)}, {lit(url)}, {qexpr}, 'manual', {lit(BY)}, NULL {src}")
pre.append(f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0")
st = [f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {FAIL} END AS guard_before"] + ins
post = [f"(SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={len(ITEMS)}"] + [
    f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(sid)} ORDER BY verified_at DESC, id DESC LIMIT 1)={lit(status)}" for _, sid, _, status, *_ in ITEMS]
st.append(f"SELECT CASE WHEN {' AND '.join(post)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {}, 'runner': 'run_sql_transaction', 'items': [i[0] for i in ITEMS], 'statements': st},
          open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st))
