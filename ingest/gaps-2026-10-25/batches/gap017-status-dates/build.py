#!/usr/bin/env python3
"""gap017 (HKM-052، الصنفان M1 وM2): حالة النفاذ وتاريخه لصكوك ينقصها أحدهما، مما اتفق عليه قارئان مستقلان (p، q).

الحالة: صف verification للعمل (إضافة). التاريخ: preamble_effective_from حيث هو NULL (التحديث المحروس الوحيد المقبول)،
مع صف legal_text_provenance يوثق الأداة وعبارة النفاذ.
لا يُكتب ما اختلف فيه القارئان أو تردد فيه أحدهما:
  - SD-07 (لائحة الأراضي البيضاء 1437): p «مستبدل»، q «غير محسوم» — لا نص إحلال صريح؛
  - SD-11 (قسمة الأموال المشتركة): كلاهما «ساري» بثقة دنيا، مع خبر 2026 عن تشريع جديد لم توجد أداته؛
  - تاريخ SD-03 وSD-13 وSD-17 (القرار 921: «يعمل بها من تاريخ العمل بالنظام» وصدرت بعد نفاذه): ينتظر قرار المالك؛
  - تاريخ SD-18 (اللوائح الاقتصادية للطيران): «يبدأ العمل بها وفق الجدول الزمني المرفق» ولم يُقرأ الجدول؛
  - تاريخ SD-02 وSD-11: لم يُنشرا ونصهما ساكت (البند 4 من HKM-024).
SD-08 (اللوائح التنفيذية لنظام المرافعات الشرعية): اتفق القارئان على أنها «ملغاة جزئيًا» بالمادة (61) من اللائحة التنفيذية لطرق الاعتراض
من 2023-08-11 (لوائح الباب الحادي عشر)؛ فحالة العمل «ساري» ويُذكر الجزء الملغى في الدليل، وحالات موادها دفعة لاحقة.

    python3 batches/gap017-status-dates/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
R = D.parents[1] / 'readers' / 'readings' / 'status_dates'
BY = 'gap017-status-dates-2026-10-29'
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
P = {json.loads(l)['item']: json.loads(l) for l in open(R / 'reader_p.jsonl', encoding='utf-8') if l.strip()}
Q = {json.loads(l)['item']: json.loads(l) for l in open(R / 'reader_q.jsonl', encoding='utf-8') if l.strip()}
PK = {x['item']: x for x in json.load(open(D / 'packets.json', encoding='utf-8'))['items']}


def lit(s):
    s = str(s)
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def h(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def url1(x):
    for k in ('status_source', 'pub_source'):
        for u in (x.get(k) or '').replace(' ؛ ', ' ; ').split(' ; '):
            u = u.strip().split(' ')[0]
            if u.startswith('http'):
                return u
    return ''


NOTE = ' [قارئان مستقلان متفقان (p، q)، HKM-052]'
# الحالات: (البند، الحالة، الأداة، تاريخ الحالة أو None، الاقتباس)
STATUS = []
for k in ('SD-01', 'SD-02', 'SD-03', 'SD-04', 'SD-05', 'SD-06', 'SD-08', 'SD-09', 'SD-10'):
    a, b = P[k], Q[k]
    assert PK[k]['current_status'] is None, k
    if k == 'SD-08':
        assert a['status'] == b['status'] == 'ملغى جزئيًا' and a['status_from'] == b['status_from'] == '2023-08-11'
        STATUS.append((k, 'ساري', f"{a['issue_instrument']} — ساري، وأُلغي منه جزئيًا من 2023-08-11 بالمادة (61) من اللائحة التنفيذية لطرق الاعتراض على الأحكام (قرار وزير العدل رقم (512) وتاريخ 1445/01/05هـ)",
                       None, f"م61 من اللائحة التنفيذية لطرق الاعتراض على الأحكام: {a['status_quote']} — الجزء الملغى: لوائح مواد الباب الحادي عشر (طرق الاعتراض على الأحكام)، والباقي ساري" + NOTE, url1(a)))
        continue
    assert a['status'] == b['status'] and a['status'] in ('ساري', 'مستبدل', 'ملغى'), (k, a['status'], b['status'])
    st = a['status']
    if st == 'ساري':
        ins = f"{a['issue_instrument']} — لا أداة إلغاء أو إحلال حتى 2026-10-29"
        frm = None
    else:
        frm = a['status_from'] if a['status_from'] == b['status_from'] else None
        ins = (a['status_instrument'] if a['status_instrument'] and frm else (b['status_instrument'] or a['status_instrument']))
        ins = ins + (f" — من {frm}" if frm else '')
    q = f"القارئ الأول: {a['status_quote']} | القارئ الثاني: {b['status_quote']}" + NOTE
    STATUS.append((k, st, ins, frm, q, url1(a) or url1(b)))

DATES = []
for k in ('SD-04', 'SD-05', 'SD-06', 'SD-08', 'SD-12', 'SD-14', 'SD-15', 'SD-16'):
    a, b = P[k], Q[k]
    assert a['effective_from'] and a['effective_from'] == b['effective_from'], k
    assert PK[k]['stored_effective_from'] is None, k
    DATES.append((k, a['effective_from'], a['issue_instrument'], a['effective_rule'], a.get('published_hijri'), url1({'pub_source': a.get('pub_source')}) or url1(b)))

ids_s = [PK[k]['system_id'] for k, *_ in STATUS]
ids_d = [PK[k]['system_id'] for k, *_ in DATES]
st = [f"SELECT CASE WHEN (SELECT count(*) FROM verification WHERE object_type='work' AND object_id IN ({','.join(lit(i) for i in ids_s)}))=0"
      f" AND (SELECT count(*) FROM legal_systems WHERE id IN ({','.join(lit(i) for i in ids_s)}))={len(ids_s)}"
      f" AND (SELECT count(*) FROM legal_systems WHERE id IN ({','.join(lit(i) for i in ids_d)}) AND preamble_effective_from IS NULL)={len(ids_d)}"
      f" AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})=0 AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g17p-%')=0 THEN 'ok' ELSE {FAIL} END AS guard_before"]
st.append("INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, supersedes_verification_id) VALUES\n" + ',\n'.join(
    f"({lit('vfg17-' + h(BY, PK[k]['system_id']))}, 'work', {lit(PK[k]['system_id'])}, {lit(s_)}, {lit(ins)}, {lit(u)}, {lit(q)}, 'manual', {lit(BY)}, NULL)"
    for k, s_, ins, frm, q, u in STATUS))
for k, eff, ins, rule, pubh, u in DATES:
    sid, name = PK[k]['system_id'], PK[k]['name']
    note = f"HKM-052 {BY}: {ins} — عبارة النفاذ: {rule} — النشر {pubh or '—'}هـ ← {eff}" + NOTE
    pid = 'g17p-' + h(BY, sid)
    st.append("INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text) "
              f"SELECT {lit(pid)}, 'system', {lit(sid)}, {lit(name)}, NULL, 'uqn', {lit(BY)}, {lit(u)}, {lit(hashlib.md5(note.encode()).hexdigest())}, DATE '2026-10-29', {lit('effective_from_set:' + eff)}, {lit(note)} "
              f"WHERE NOT EXISTS (SELECT 1 FROM legal_text_provenance WHERE id = {lit(pid)})")
for k, eff, *_ in DATES:
    st.append(f"UPDATE legal_systems SET preamble_effective_from = {lit(eff)}::timestamptz WHERE id = {lit(PK[k]['system_id'])} AND preamble_effective_from IS NULL")
chk = ' AND '.join(f"(SELECT preamble_effective_from::date FROM legal_systems WHERE id={lit(PK[k]['system_id'])})={lit(eff)}::date" for k, eff, *_ in DATES)
chk2 = ' AND '.join(f"(SELECT verified_status FROM verification WHERE object_type='work' AND object_id={lit(PK[k]['system_id'])} ORDER BY verified_at DESC, id DESC LIMIT 1)={lit(s_)}" for k, s_, *_ in STATUS)
st.append(f"SELECT CASE WHEN {chk} AND {chk2} AND (SELECT count(*) FROM verification WHERE verified_by={lit(BY)})={len(STATUS)} AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'g17p-%')={len(DATES)} THEN 'ok' ELSE {FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
plan = {'statuses': [dict(item=k, name=PK[k]['name'], status=s_, instrument=ins) for k, s_, ins, *_ in STATUS],
        'dates': [dict(item=k, name=PK[k]['name'], effective_from=eff) for k, eff, *_ in DATES],
        'deferred': {'SD-07': 'الحالة: خلاف القارئين', 'SD-11': 'الحالة: ثقة دنيا وتشريع جديد محتمل', 'SD-03/SD-13/SD-17': 'التاريخ: قرار المالك',
                     'SD-18': 'التاريخ: نفاذ متدرج بجدول لم يُقرأ', 'SD-02/SD-11': 'التاريخ: لم يُنشرا', 'SD-08': 'حالات المواد: دفعة لاحقة'}}
json.dump({'by': BY, 'md5': md5, 'count': len(st), 'expect_delta': {},
           'report': {'statuses': len(STATUS), 'dates': len(DATES), 'new_articles': 0, 'changed_text': 0, 'plan': plan}, 'statements': st},
          open(D / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(st), 'statuses', len(STATUS), 'dates', len(DATES))
for x in plan['statuses']: print(x['item'], x['status'], '|', x['instrument'][:150])
for x in plan['dates']: print(x['item'], x['effective_from'], x['name'][:50])
