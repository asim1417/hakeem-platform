#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045g، البند 12): إصلاحات نصوص ملاحظات المراقب المعتمدة.

قرأ قارئ كل ملاحظة تعديل في الملاحظات المعتمدة (text.jsonl: 114 ملاحظة والمادتان 20 مكرر و79 مكرر)، وطابقها مراجع
مستقل (verify.jsonl). تُبنى الدفعة من:
- apply (المؤكد والمصحح عند المراجع): نسخة unit_version. old/new استبدال داخل القاعدة بشرط تفرّد old في النص الأساس
  (شرط WHERE)، وwhole نص كامل. النسخة تقع بعد آخر نسخة قائمة للمادة إن كانت أحدث من تاريخ النفاذ، ويُذكر ذلك في الدليل.
  التاريخ التقريبي (تاريخ صدور الأداة لعدم معرفة النشر) موسوم في الدليل.
- إلغاء مادة كاملة (no_change مع repeal_quote): تحقق «ملغاة» باقتباس الحذف.
خارج الدفعة: reflected (منعكس)، وno_change بلا إلغاء، وneeds_owner (منها 20 في نظام السوق المالية تحتاج تفريغ الصيغة المرافقة
للمرسوم م/16 من الصور)، وما رفضه المراجع.

    python3 data/review/hkm045g-item12-text-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045g-item12-text-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def jl(name):
    return [json.loads(l) for l in (D / name).read_text(encoding='utf-8').splitlines() if l.strip()]


def build():
    rows = jl('text.jsonl')
    ver = {(v['note_id'], v['article_id']): v for v in jl('verify.jsonl')}
    items, repeals, skipped = [], [], []
    for r in rows:
        v = ver.get((r.get('note_id'), r['article_id']))
        if r['verdict'] == 'apply':
            if not v or v['status'] not in ('confirmed', 'corrected'):
                skipped.append((r.get('note_id'), r['article_id'], v and v['status']))
                continue
            edits = v['final_edits'] if v['status'] == 'corrected' else (r.get('edits') or ([{'whole': r['whole']}] if r.get('whole') else []))
            assert edits, r['article_id']
            eff = (v.get('final_effective_gregorian') or r['effective_gregorian'])
            items.append({'aid': r['article_id'], 'eff': eff, 'note': r.get('note_id') or r.get('finding_id'), 'edits': edits,
                          'approx': r.get('effective_status') == 'تقريبي', 'later': r.get('later_version') not in (None, 'None', ''),
                          'instr': f"{r.get('instrument')} وتاريخ {r.get('instrument_date_hijri')}هـ", 'basis': r.get('effective_basis') or ''})
        elif r['verdict'] == 'no_change' and r.get('repeal_quote'):
            if v and v['status'] == 'reject':
                skipped.append((r.get('note_id'), r['article_id'], 'reject'))
                continue
            repeals.append(r)
    items.sort(key=lambda x: (x['aid'], x['eff'], x['note']))
    st, post = [], []
    for it in items:
        aid, eff = it['aid'], it['eff']
        vf = (f"greatest({lit(eff)}::timestamptz, coalesce((SELECT max(valid_from) + interval '1 second' FROM unit_version "
              f"WHERE unit_id = {lit(aid)} AND valid_from <= now()), {lit(eff)}::timestamptz))")
        base = (f"coalesce((SELECT v.body FROM unit_version v WHERE v.unit_id = {lit(aid)} AND v.valid_from <= {vf} "
                f"ORDER BY v.valid_from DESC, v.created_at DESC LIMIT 1), (SELECT content FROM legal_articles WHERE id = {lit(aid)}))")
        expr, conds, news = base, [f"EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)})"], []
        for e in it['edits']:
            if 'whole' in e:
                expr, news = lit(e['whole']), [e['whole']]
            else:
                conds.append(f"(length({expr}) - length(replace({expr}, {lit(e['old'])}, ''))) / length({lit(e['old'])}) = 1")
                expr = f"replace({expr}, {lit(e['old'])}, {lit(e['new'])})"
                news = [x for x in news if x != e.get('old')]
                if e['new']:
                    news.append(e['new'])
        vid = 'hk45g-' + hashlib.sha256(f"{aid}|{eff}|{it['note']}".encode()).hexdigest()[:24]
        q = (('تاريخ تقريبي — تاريخ صدور الأداة (النشر غير معروف). ' if it['approx'] else '')
             + (f"نافذ من {eff}؛ رُكّب بعد نسخة لاحقة قائمة بُنيت دونه، فتاريخ النسخة تاريخ تلك النسخة + ثانية. " if it['later'] else '')
             + it['basis'])[:1800]
        st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(vid)}, {lit(aid)}, {expr}, {vf}, {lit(it['instr'])}, {lit(it['note'].replace('boe.amendment_note ', 'boe.amendment_note:'))}, {lit(q)}, now()
WHERE {' AND '.join(conds)} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})""")
        post.append(f"EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})")
        for nw in news:
            post.append(f"strpos((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(nw)}) > 0")
    for r in repeals:
        aid = r['article_id']
        vf_id = 'vf45g-' + hashlib.sha256(f"{aid}|{r.get('note_id')}".encode()).hexdigest()[:24]
        quote = (r['repeal_quote'] + (f" — النفاذ {r['effective_gregorian']} ({r.get('effective_basis') or ''})" if r.get('effective_gregorian') else ''))[:1800]
        st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vf_id)}, 'unit', {lit(aid)}, 'ملغاة', {lit(f"{r.get('instrument')} وتاريخ {r.get('instrument_date_hijri')}هـ")}, {lit((r.get('note_id') or '').replace('boe.amendment_note ', 'boe.amendment_note:'))}, {lit(quote)}, 'rule', {lit(BY)}, now(), NULL
WHERE EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)}) AND NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vf_id)})""")
    n_rep = len({r['article_id'] + '|' + str(r.get('note_id')) for r in repeals})
    st = [f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45g-%') = 0 AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"] + st
    st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45g-%') = {len(items)} AND {' AND '.join(post)} "
              f"AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = {n_rep} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    rep = {'versions': len(items), 'articles': len({i['aid'] for i in items}), 'approx_dates': sum(i['approx'] for i in items),
           'rebased_after_later': sum(i['later'] for i in items), 'repeals': n_rep, 'skipped': skipped}
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': rep, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, {k: v for k, v in rep.items() if k != 'skipped'}, len(skipped))


if __name__ == '__main__':
    build()
