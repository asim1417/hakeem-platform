#!/usr/bin/env python3
"""HKM-041ج (البند 2): العمليات التي كانت «يحتاج قرار المالك» (39) بعد تفويضه «سوِّ الأفضل».

لكل عملية مواصفة تعديل على النص الساري عند تاريخ سريانها، وكل مقطع جديد مكوّن من أجزاء:
src (حرفي من لقطة أم القرى) أو hk (حرفي من نص حكيم نفسه) أو tok (رمز ترقيم مركّب، مذكور في composed_tokens).
يتحقق الحارس داخل المعاملة من: ورود كل old مرة واحدة في النص الأساس، وورود كل src في اللقطة وكل hk في النص الأساس.
تُجمع تعديلات المادة الواحدة ذات التاريخ الواحد في نسخة واحدة؛ وإن وُجدت نسخة في اليوم نفسه تأتي الجديدة بعدها بثانية.
مستبقاة: OP-1d5260d0fb (الفقرة الأساس ناقصة في حكيم)، OP-10f910932e (نسخة تاريخية يحذفها م/208 ولا مصدر له)،
إعادة ترقيم مواد تنظيم المدن الاقتصادية (يُسجّل إلغاء م15 فقط). القرارات: apply/repeal → approved_with_edit/approved،
reflected → approved، reject → rejected، defer_no_source → بلا قرار.

    python3 data/review/hkm041c-uqn-owner-items-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm041c-uqn-owner-items-2026-10-24'
REVIEWER = 'Claude بتفويض المالك'
MANDATE = 'تفويض المالك 24/10/2026 («سوِّ الأفضل وتكون النتيجة 100%»)'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
HOLD = {'OP-1d5260d0fb': 'الفقرتان (6) و(7) ناقصتان من نص حكيم الأساس', 'OP-10f910932e': 'نسخة تاريخية حذفها م/208 لاحقًا ولا مصدر له في اللقطات'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def base(aid, eff):
    return (f"coalesce((SELECT v.body FROM unit_version v WHERE v.unit_id = {lit(aid)} AND v.valid_from::date <= {lit(eff)}::date "
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
            f"WHERE NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review WHERE op_id = {lit(op)}) AND NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_decision WHERE op_id = {lit(op)})")


rows = [json.loads(l) for l in (D / 'readings.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
assert len(rows) == 39
groups, pre, post, body_st, revs, repeals = {}, [], [], [], [], []
for x in rows:
    op, v = x['op_id'], x['verdict']
    if op in HOLD:
        continue
    if v == 'reflected':
        revs.append(review(op, 'approved', f"منعكس سابقًا ({x.get('reflected_in')}). {x.get('notes') or ''}"))
        continue
    if v == 'reject':
        revs.append(review(op, 'rejected', x.get('notes') or ''))
        continue
    if v != 'apply':
        continue
    eff, url = x['effective_gregorian'], x['source_url']
    if x['edits'] and x['edits'][0].get('repeal'):
        repeals.append(x)
        continue
    targets = x['edits'] if x['edits'] and 'article_id' in x['edits'][0] else [{'article_id': x['article_id'], 'edits': x['edits']}]
    for t in targets:
        groups.setdefault((t['article_id'], eff), []).append((x, t['edits']))
    for c in x.get('chain_specs') or []:
        groups.setdefault(('chain:' + c['chain_after'], x['article_id']), []).append((x, c['edits']))
vids = []
for key, items in sorted(groups.items()):
    if key[0].startswith('chain:'):
        later, aid = key[0][6:], key[1]
        b = f"(SELECT body FROM unit_version WHERE id = {lit(later)})"
        vf = f"(SELECT valid_from + interval '1 second' FROM unit_version WHERE id = {lit(later)})"
        tag = later
    else:
        aid, eff = key
        b = base(aid, eff)
        vf = (f"greatest({lit(eff)}::timestamptz, coalesce((SELECT max(valid_from) + interval '1 second' FROM unit_version WHERE unit_id = {lit(aid)} "
              f"AND valid_from::date = {lit(eff)}::date), {lit(eff)}::timestamptz))")
        tag = eff
    expr, news, ops = b, [], []
    for x, edits in items:
        ops.append(x['op_id'])
        sn = snap(x['source_url'])
        for e in edits:
            for p in e.get('new_parts') or []:
                if 'src' in p:
                    pre.append(f"strpos({sn}, {lit(p['src'])}) > 0")
                elif 'hk' in p:
                    pre.append(f"strpos({b}, {lit(p['hk'])}) > 0")
            if 'whole' in e:
                assert len(items) == 1 and len(edits) == 1, key
                expr = lit(e['whole'])
                news.append(e['whole'])
            else:
                pre.append(f"(length({b}) - length(replace({b}, {lit(e['old'])}, ''))) / length({lit(e['old'])}) = 1")
                expr = f"replace({expr}, {lit(e['old'])}, {lit(e['new'])})"
                if e['new']:
                    news.append(e['new'])
    vid = 'hk41c-' + hid(aid, tag, *ops)
    vids.append(vid)
    x0 = items[0][0]
    # الدليل: أجزاء النص الحرفية من اللقطة (يتحقق الحارس من كل منها)، لا الاقتباس المختصر
    srcs = [p['src'] for x, ed in items for e in ed for p in (e.get('new_parts') or []) if 'src' in p]
    quote = (' ‖ '.join(dict.fromkeys(srcs)) or ' ‖ '.join(dict.fromkeys(x['source_quote'] for x, _ in items)))[:3000]
    body_st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(vid)}, {lit(aid)}, {expr}, {vf}, {instr(x0['op_id'])}, {lit(x0['source_url'])}, {lit(quote)}, now()
WHERE NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})""")
    for n in news:
        post.append(f"strpos((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(n)}) > 0")
seen = set()
for (aid, tag), items in groups.items():
    for x, _ in items:
        if x['op_id'] in seen:
            continue
        seen.add(x['op_id'])
        revs.append(review(x['op_id'], 'approved_with_edit', f"طُبّق في دفعة {BY} سارية من {x['effective_gregorian']} ({x.get('effective_basis') or ''}). {x.get('notes') or ''}",
                           {'batch': BY, 'effective_gregorian': x['effective_gregorian'], 'edits': x['edits'], 'composed_tokens': x.get('composed_tokens')}))
for x in repeals:
    aid = x['article_id']
    vf = 'vf41c-' + hid(aid, x['op_id'])
    pre.append(f"strpos({snap(x['source_url'])}, {lit(x['source_quote'])}) > 0")
    body_st.append(f"""INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by, verified_at, supersedes_verification_id)
SELECT {lit(vf)}, 'unit', {lit(aid)}, 'ملغاة', {instr(x['op_id'])}, {lit(x['source_url'])}, {lit(x['source_quote'])}, 'rule', {lit(BY)}, now(), NULL
WHERE NOT EXISTS (SELECT 1 FROM verification WHERE id = {lit(vf)})""")
    revs.append(review(x['op_id'], 'approved', f"سُجّلت المادة «ملغاة» ({vf}) سارية من {x['effective_gregorian']}؛ إعادة ترقيم المواد اللاحقة مستبقاة. {x.get('notes') or ''}"))
st = [f"SELECT CASE WHEN {' AND '.join(pre)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk41c-%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"]
st += body_st + revs
st.append(f"SELECT CASE WHEN {' AND '.join(post)} AND (SELECT count(*) FROM unit_version WHERE id LIKE 'hk41c-%') = {len(vids)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
(D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'versions': vids, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(st), md5, 'versions', len(vids), 'reviews', len(revs), 'repeals', len(repeals))
