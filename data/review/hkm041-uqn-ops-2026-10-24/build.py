#!/usr/bin/env python3
"""HKM-041 (البند 2): عمليات تعديل أم القرى التي بلا قرار (252) — دفعة المحسوم منها.

قرأ أربعة قراء كل عملية من لقطة أم القرى (`uqn_fix.source_snapshot`) وقارنوها بنص حكيم الساري (readings/*.jsonl).
تشمل الدفعة:
- apply: نسخة unit_version لكل مادة (تُجمع عمليات المادة الواحدة ذات التاريخ الواحد)، النص = النص الساري بعد
  الاستبدالات المحددة (old يرد مرة واحدة في النص الساري، وnew يرد حرفيًا في اللقطة) — يُتحقق داخل المعاملة.
- repeal: تحقق «ملغاة» بنص البند من اللقطة.
- قرار في uqn_fix.amendment_review لكل عملية من: apply (approved_with_edit)، reflected (approved)، reject (rejected)، repeal (approved).
خارج الدفعة (لورقة المالك): needs_owner، law_level، not_in_hakeem، والمستثناة في EXCLUDE.

    python3 data/review/hkm041-uqn-ops-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm041-uqn-ops-2026-10-24'
REVIEWER = 'Claude بتفويض المالك'
MANDATE = 'تفويض المالك 24/10/2026 («نفذ كل شي»، «نعم» على خطة القراء الأربعة)'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
EXCLUDE = {
    'OP-fdb5545b43': 'بلا مادة مستهدفة في حكيم',
    'OP-79ea09106a': 'للمادة نسخة لاحقة (2023-01-31) تحجب التعديل عن النص الساري؛ يلزم تركيب السلسلة',
    'OP-42406fa3e3': 'الأداة تأمر بإعادة ترقيم بقية المواد',
}
CUR_MD5 = json.loads((D / 'current_md5.json').read_text(encoding='utf-8'))


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def cur(aid):
    return (f"coalesce((SELECT v.body FROM unit_version v WHERE v.unit_id = {lit(aid)} AND v.valid_from <= now() "
            f"ORDER BY v.valid_from DESC, v.created_at DESC LIMIT 1), (SELECT content FROM legal_articles WHERE id = {lit(aid)}))")


def snap(url):
    return f"(SELECT body FROM uqn_fix.source_snapshot WHERE url = {lit(url)} LIMIT 1)"


def instr(op):
    return (f"(SELECT CASE o.instrument_kind WHEN 'royal_decree' THEN 'مرسوم ملكي رقم (' WHEN 'cabinet_decision' THEN 'قرار مجلس الوزراء رقم (' "
            f"WHEN 'royal_order' THEN 'أمر ملكي رقم (' ELSE o.instrument_kind || ' رقم (' END || o.instrument_no || ') وتاريخ ' || replace(o.instrument_date_hijri, '-', '/') || 'هـ' "
            f"FROM uqn_fix.amendment_op o WHERE o.op_id = {lit(op)})")


def review(op, decision, note, corrected=None):
    c = f"{lit(json.dumps(corrected, ensure_ascii=False))}::jsonb" if corrected is not None else 'NULL'
    return (f"INSERT INTO uqn_fix.amendment_review (op_id, decision, corrected, reviewer, note) "
            f"SELECT {lit(op)}, {lit(decision)}, {c}, {lit(REVIEWER)}, {lit((MANDATE + ': ' + note)[:2000])} "
            f"WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review WHERE op_id = {lit(op)}) "
            f"AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_decision WHERE op_id = {lit(op)})")


def build():
    rows = []
    for r in ('uq1', 'uq2', 'uq3', 'uq4'):
        rows += [json.loads(l) for l in (D / 'readings' / f'{r}.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    assert len(rows) == 252 and len({x['op_id'] for x in rows}) == 252
    ap = [x for x in rows if x['verdict'] == 'apply' and x['op_id'] not in EXCLUDE]
    rp = [x for x in rows if x['verdict'] == 'repeal' and x['op_id'] not in EXCLUDE]
    groups = {}
    for x in ap:
        groups.setdefault(x['article_id'], []).append(x)
    pre, body_st, post, revs = [], [], [], []
    rep = {'versions': 0, 'apply_ops': len(ap), 'repeal': len(rp), 'reviews': 0}
    vids = []
    for aid, ops in sorted(groups.items()):
        ops.sort(key=lambda x: x['op_id'])
        eff = {x['effective_gregorian'] for x in ops}
        assert len(eff) == 1, (aid, eff)
        eff = eff.pop()
        pre.append(f"md5({cur(aid)}) = {lit(CUR_MD5[aid])}")
        expr = cur(aid)
        news = []
        for x in ops:
            sn = snap(x['source_url'])
            pre.append(f"strpos({sn}, {lit(x['source_quote'])}) > 0")
            for e in x['edits']:
                if 'whole' in e:
                    assert len(ops) == 1 and len(x['edits']) == 1, aid
                    pre.append(f"strpos({sn}, {lit(e['whole'])}) > 0")
                    expr = lit(e['whole'])
                    news.append(e['whole'])
                else:
                    old, new = e['old'], e['new']
                    assert old, (x['op_id'], 'empty old')
                    pre.append(f"(length({cur(aid)}) - length(replace({cur(aid)}, {lit(old)}, ''))) / length({lit(old)}) = 1")
                    if new:
                        pre.append(f"strpos({sn}, {lit(new)}) > 0")
                        news.append(new)
                    expr = f"replace({expr}, {lit(old)}, {lit(new)})"
        vid = 'hk41u-' + hid(aid, eff, *[x['op_id'] for x in ops])
        vids.append(vid)
        quote = ' ‖ '.join(x['source_quote'] for x in ops)[:3000]
        url = ops[0]['source_url']
        body_st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(vid)}, {lit(aid)}, {expr}, {lit(eff)}::timestamptz, {instr(ops[0]['op_id'])}, {lit(url)}, {lit(quote)}, now()
WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})""")
        for n in news:
            post.append(f"strpos((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(n)}) > 0")
        rep['versions'] += 1
        for x in ops:
            revs.append(review(x['op_id'], 'approved_with_edit', f"طُبّق في النسخة {vid} سارية من {eff} ({x.get('effective_basis') or ''}). {x.get('notes') or ''}",
                               {'version_id': vid, 'effective_gregorian': eff, 'edits': x['edits']}))
    for x in rp:
        aid = x['article_id']
        vf = 'vf41-' + hid(aid, x['op_id'])
        sn = snap(x['source_url'])
        pre.append(f"strpos({sn}, {lit(x['source_quote'])}) > 0")
        pre.append(f"md5({cur(aid)}) = {lit(CUR_MD5[aid])}")
        body_st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vf)}, 'unit', {lit(aid)}, 'ملغاة', {instr(x['op_id'])}, {lit(x['source_url'])}, {lit(x['source_quote'])}, 'rule', {lit(BY)}, now(), NULL
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vf)})""")
        revs.append(review(x['op_id'], 'approved', f"سُجّلت المادة «ملغاة» ({vf})، النفاذ {x.get('effective_gregorian')}. {x.get('notes') or ''}"))
    for x in rows:
        if x['op_id'] in EXCLUDE:
            continue
        if x['verdict'] == 'reflected':
            revs.append(review(x['op_id'], 'approved', f"منعكس سابقًا في نص حكيم ({x.get('reflected_in')}). {x.get('notes') or ''}"))
        elif x['verdict'] == 'reject':
            revs.append(review(x['op_id'], 'rejected', f"الاستخراج الآلي خاطئ. {x.get('notes') or ''}"))
    rep['reviews'] = len(revs)
    st = [f"SELECT CASE WHEN {' AND '.join(pre)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk41u-%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
    st += body_st + revs
    st.append(f"SELECT CASE WHEN {' AND '.join(post)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk41u-%') = {rep['versions']} "
              f"AND (SELECT count(*) FROM verification WHERE verified_by = {lit(BY)}) = {rep['repeal']} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': rep, 'versions': vids, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, rep)


if __name__ == '__main__':
    build()
