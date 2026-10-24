#!/usr/bin/env python3
"""HKM-040: تصحيح تاريخ نفاذ نسخ البند 1 (22 نسخة محسومة بالدليل).

البند 1 (HKM-037) سجّل valid_from بتاريخ صدور الأداة. قرأ ثلاثة قراء عبارة النفاذ من صورة كل أداة وتاريخ نشرها
(readings/*.jsonl)، وهذه الدفعة للنسخ المحسومة فقط. unit_version للإضافة فقط، فالتصحيح بإضافة:
- النفاذ بعد تاريخ الصدور: نسخة «النص السابق» عند تاريخ الصدور + ثانية (تتقدم على النسخة المبكرة ذات التاريخ نفسه)،
  ثم نسخة بالنص المعدّل نفسه عند تاريخ النفاذ.
- النفاذ قبل تاريخ الصدور (أثر رجعي بنص الأداة): نسخة بالنص المعدّل نفسه عند تاريخ النفاذ.
- مادتان لهما نسخة سابقة صحيحة التاريخ من HKM-030 (خدمة الأفراد م4، الهيئة العامة للعقار م4): نسخة «النص السابق» فقط.
كل نص يُنسخ داخل القاعدة من نسخة قائمة أو من legal_articles.content؛ لا نص قانوني في هذا الملف.
النص الساري اليوم للمواد الـ22 لا يتغير (حارس ببصمة).

    python3 data/review/hkm040-effective-dates-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm040-effective-dates-2026-10-24'
NOW_FP = 'ff17c067f386ba0d7f8811dc1b32d799'  # بصمة النص الساري اليوم للمواد الـ22 قبل الدفعة
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
# نسخ لها نسخة HKM-030 بالتاريخ الصحيح: لا تُضاف نسخة جديدة
HAS_CORRECT = {'hk37wu-aece770514af9b07827f347b': 'hkm30u-22c0f6efdcb3babd1709bb91',
               'hk37wu-f0b80c77264fd40e63062842': 'hkm30u-94cd8ad0e157b4f0edd3aff9'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def build():
    rows = []
    for r in ('readerA', 'readerB', 'readerC'):
        for line in (D / 'readings' / f'{r}.jsonl').read_text(encoding='utf-8').splitlines():
            if line.strip():
                rows.append(json.loads(line))
    res = [x for x in rows if x['status'] == 'resolved']
    assert len(res) == 22, len(res)
    vids = ','.join(lit(x['vid']) for x in res)
    units = f"(SELECT DISTINCT unit_id FROM unit_version WHERE id IN ({vids}))"
    now_fp = (f"(SELECT md5(string_agg(u.unit_id || ':' || md5(coalesce((SELECT v.body FROM unit_version v WHERE v.unit_id = u.unit_id AND v.valid_from <= now() "
              f"ORDER BY v.valid_from DESC, v.created_at DESC LIMIT 1), (SELECT content FROM legal_articles WHERE id = u.unit_id))), ',' ORDER BY u.unit_id)) FROM {units} u)")
    st = [f"SELECT CASE WHEN {now_fp} = {lit(NOW_FP)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk40%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
    rep = {'restore': 0, 'effective': 0, 'retroactive': 0, 'kept_hkm030': 0}
    for x in res:
        vid, eff = x['vid'], x['effective_gregorian']
        cur = x['current_valid_from']
        src = f"(SELECT unit_id, body, valid_from, evidence_instrument, evidence_url FROM unit_version WHERE id = {lit(vid)})"
        quote = (x.get('effect_clause') or '') + ' — ' + x['rule']
        if eff > cur:
            rid = 'hk40r-' + hid('r', vid)
            prior = ("coalesce((SELECT p.body FROM unit_version p WHERE p.unit_id = s.unit_id AND p.valid_from < s.valid_from ORDER BY p.valid_from DESC LIMIT 1), "
                     "(SELECT content FROM legal_articles WHERE id = s.unit_id))")
            st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(rid)}, s.unit_id, {prior}, s.valid_from + interval '1 second', s.evidence_instrument, s.evidence_url, {lit('النص السابق للمدة بين صدور الأداة ونفاذها (' + eff + ')؛ تصحيح تاريخ النسخة ' + vid + ' — ' + x['rule'])}, now()
FROM {src} s WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(rid)})""")
            rep['restore'] += 1
        if vid in HAS_CORRECT:
            rep['kept_hkm030'] += 1
            continue
        eid = 'hk40e-' + hid('e', vid, eff)
        st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(eid)}, s.unit_id, s.body, {lit(eff)}::timestamptz, s.evidence_instrument, s.evidence_url, {lit(quote[:1500])}, now()
FROM {src} s WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(eid)})""")
        rep['effective' if eff > cur else 'retroactive'] += 1
    n_new = rep['restore'] + rep['effective'] + rep['retroactive']
    st.append(f"SELECT CASE WHEN {now_fp} = {lit(NOW_FP)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk40%') = {n_new} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': rep, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, rep)


if __name__ == '__main__':
    build()
