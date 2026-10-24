#!/usr/bin/env python3
"""HKM-045: البند 5 (ملاحظات تعديل لم تُطبّق) وبقايا البند 1 (المؤجلة 18 والورقة هـ 28).

قرأ قارئ كل ملاحظة وأداتها (item5.jsonl، item1rest.jsonl)، ثم طابق مراجع مستقل كل نص مقروء من صورة بالصورة
كلمة كلمة (verify.jsonl: 38 مؤكد و4 مصحح). تُبنى النسخ من final_edits للمراجع:
- old/new: استبدال داخل القاعدة بشرط أن يرد old مرة واحدة في النص الأساس عند التنفيذ (شرط WHERE للإدراج).
- whole: النص الكامل كما في الصورة أو المصدر. whole_ref: يُنسخ داخل القاعدة من boe.unit.
- الملاحظة المنسوبة لمادة أخرى (misfiled): يُطبق على target_article.
التاريخ: تاريخ النفاذ المحسوب إن وُجد، وإلا تاريخ صدور الأداة مع وسم «تقريبي — تاريخ الصدور» في الدليل.
تُرتب نسخ المادة الواحدة زمنيًا، وكل نسخة تُبنى على النص الساري عند تاريخها (بما فيها نسخ هذه الدفعة).
خارج الدفعة: إنشاء مادتين جديدتين (54 مكرر في خدمة الضباط، ووحدة م/5 لعام 1389) لأنها تزيد عدد المواد.

    python3 data/review/hkm045-item5-item1rest-2026-10-24/build.py
"""
import hashlib, json, re
from pathlib import Path
from hijri_converter import Hijri

D = Path(__file__).parent
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hdate(s):
    n = [int(x) for x in re.findall(r'\d+', s or '')]
    if len(n) < 3:
        return None
    y = next(v for v in n if v > 1300)
    rest = [v for v in n if v is not y][:2]
    if n.index(y) == 0:
        m, d = rest[0], rest[1]
    else:
        d, m = rest[0], rest[1]
    return Hijri(y, m, d).to_gregorian().isoformat()


src = {}
for f in ('item5.jsonl', 'item1rest.jsonl'):
    for l in (D / f).read_text(encoding='utf-8').splitlines():
        if l.strip():
            x = json.loads(l)
            src[(x['note_id'], x['article_id'])] = x
items, skipped = [], []
for l in (D / 'verify.jsonl').read_text(encoding='utf-8').splitlines():
    if not l.strip():
        continue
    v = json.loads(l)
    s = src[(v['note_id'], v['article_id'])]
    eds = v.get('final_edits') or []
    if v['status'] == 'reject' or any('new_unit' in e for e in eds):
        skipped.append(v['note_id'])
        continue
    target = next((e['target_article'].split()[0] for e in eds if e.get('target_article')), None) or v['article_id']
    eff = s.get('effective_gregorian')
    approx = False
    if not eff:
        eff = hdate(v.get('instrument_date_hijri'))
        approx = True
    assert eff, v['note_id']
    items.append({'note': v['note_id'], 'aid': target, 'eff': eff, 'approx': approx, 'edits': eds, 'instr': f"{v.get('instrument')} وتاريخ {v.get('instrument_date_hijri')}",
                  'quote': (s.get('quote') or '')[:1500], 'basis': s.get('effective_basis') or ''})
items.sort(key=lambda x: (x['aid'], x['eff'], x['note']))
st, post, n = [], [], 0
# مواد لها نسخة قائمة أحدث من تاريخ نفاذ التعديل (فحص 24/10/2026)
LATER = {'2016-11-14': {'cmpz6ba8f06hvcwg2p6drnuym'}, '2021-06-25': {'cmpz6h21908hhcwg273u052m7'}, '2021-06-11': {'cmpzcv9t70b5zvtrkz3d9iw1t'}}
for it in items:
    aid, eff = it['aid'], it['eff']
    # النسخة تقع بعد آخر نسخة قائمة للمادة (حتى الآن) إن كانت تلك أحدث من تاريخ النفاذ، وتُبنى على نصها.
    vf = (f"greatest({lit(eff)}::timestamptz, coalesce((SELECT max(valid_from) + interval '1 second' FROM unit_version "
          f"WHERE unit_id = {lit(aid)} AND valid_from <= now()), {lit(eff)}::timestamptz))")
    base = (f"coalesce((SELECT v.body FROM unit_version v WHERE v.unit_id = {lit(aid)} AND v.valid_from <= {vf} "
            f"ORDER BY v.valid_from DESC, v.created_at DESC LIMIT 1), (SELECT content FROM legal_articles WHERE id = {lit(aid)}))")
    expr, conds, news = base, [f"EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)})"], []
    it_wholes = [e['whole'] for e in it['edits'] if 'whole' in e]
    for e in it['edits']:
        if 'whole_ref' in e:
            r = e['whole_ref']
            expr = f"(SELECT body FROM boe.unit WHERE law_id = {lit(r['law_id'])} AND seq = {int(r['seq'])})"
        elif 'whole' in e:
            expr = lit(e['whole'])
            news = [e['whole']]
        elif 'old' in e:
            conds.append(f"(length({expr}) - length(replace({expr}, {lit(e['old'])}, ''))) / length({lit(e['old'])}) = 1")
            expr = f"replace({expr}, {lit(e['old'])}, {lit(e['new'])})"
            news = [x for x in news if x not in it_wholes]
            if e['new']:
                news.append(e['new'])
    vid = 'hk45u-' + hashlib.sha256(f"{aid}|{eff}|{it['note']}".encode()).hexdigest()[:24]
    q = (('تاريخ تقريبي — تاريخ صدور الأداة (النشر غير معروف). ' if it['approx'] else '')
         + (f"نافذ من {eff}؛ رُكّب بعد نسخة لاحقة قائمة بُنيت دونه، فتاريخ النسخة تاريخ تلك النسخة + ثانية. " if aid in LATER.get(eff, ()) else '')
         + it['quote'])
    st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(vid)}, {lit(aid)}, {expr}, {vf}, {lit(it['instr'])}, {lit('boe.amendment_note:' + it['note'])}, {lit(q[:1800])}, now()
WHERE {' AND '.join(conds)} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})""")
    for nw in news:
        post.append(f"strpos((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(nw)}) > 0")
    n += 1
st = [f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45u-%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"] + st
st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45u-%') = {n} AND {' AND '.join(post)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': 'hkm045-item5-item1rest-2026-10-24', 'md5': md5, 'count': len(st), 'report': {'versions': n, 'approx_dates': sum(i['approx'] for i in items), 'skipped_new_units': skipped}, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(st), md5, n, sum(i['approx'] for i in items), skipped)
