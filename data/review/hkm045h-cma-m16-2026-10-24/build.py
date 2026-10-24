#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045h): نظام السوق المالية بالمرسوم م/16 لعام 1441، وم5، والرهن التجاري م2 بالمرسوم م/19.

ملاحظات الهيئة على 20 مادة من نظام السوق المالية «عُدلت بموجب م/16» بلا نص، والنص الجديد صورة في الصيغة المرافقة
(boe26-2553fed2235bbaa1bf8c84e1 ص4–17). فرّغه قارئ من الصور (result.jsonl) وطابقه مراجع مستقل (verify.jsonl).
ومعها: م5 (الفقرتان ب وج من الوثيقة الأصلية boe26-89bb71b64a2c1cedaa2ecff2 ص9، والفقرة د من الملاحظة)، والرهن التجاري م2
(«ب- وصف المال المرهون» من صورة المرسوم م/19، boe26-0b239263ba1dc7e366d44e28).
- النسخة تقع بعد آخر نسخة قائمة للمادة إن كانت أحدث من تاريخ النفاذ، وتُبنى على نصها (يُذكر في الدليل).
- النص الذي يذكر «مؤسسة النقد العربي السعودي» (كما في الصورة) تتبعه نسخة بإحلال «البنك المركزي السعودي» بتاريخ 2020-12-11
  كالإحلال العام في بقية مواد النظام، ودليلها منسوخ داخل القاعدة من نسخة الإحلال hkm30u-37c3a58d… (المرسوم م/36 لعام 1442).

    python3 data/review/hkm045h-cma-m16-2026-10-24/build.py
"""
import hashlib, json, re
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045h-cma-m16-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
OLD_NAME, NEW_NAME = 'مؤسسة النقد العربي السعودي', 'البنك المركزي السعودي'
M36 = 'hkm30u-37c3a58d65a5219f10e9eac0'


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def jl(name):
    return [json.loads(l) for l in (D / name).read_text(encoding='utf-8').splitlines() if l.strip()]


def vfrom(aid, eff):
    return (f"greatest({lit(eff)}::timestamptz, coalesce((SELECT max(valid_from) + interval '1 second' FROM unit_version "
            f"WHERE unit_id = {lit(aid)} AND valid_from <= now()), {lit(eff)}::timestamptz))")


def build():
    rows = jl('result.jsonl')
    ver = {v['article_id']: v for v in jl('verify.jsonl')}
    st, post, n, skipped, subs = [], [], 0, [], 0
    for r in sorted(rows, key=lambda x: (x['article_id'], x['effective_gregorian'])):
        aid, eff = r['article_id'], r['effective_gregorian']
        v = ver.get(aid)
        if r['verdict'] != 'apply' or not v or v['status'] not in ('confirmed', 'corrected'):
            skipped.append((r['article'], v and v['status']))
            continue
        edits = v['final_edits'] if v['status'] == 'corrected' else (r.get('edits') or [{'whole': r['whole']}])
        vf = vfrom(aid, eff)
        base = (f"coalesce((SELECT x.body FROM unit_version x WHERE x.unit_id = {lit(aid)} AND x.valid_from <= {vf} "
                f"ORDER BY x.valid_from DESC, x.created_at DESC LIMIT 1), (SELECT content FROM legal_articles WHERE id = {lit(aid)}))")
        expr, conds, news, final_txt = base, [f"EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)})"], [], ''
        for e in edits:
            if 'whole' in e:
                expr, news = lit(e['whole']), [e['whole']]
            else:
                conds.append(f"(length({expr}) - length(replace({expr}, {lit(e['old'])}, ''))) / length({lit(e['old'])}) = 1")
                expr = f"replace({expr}, {lit(e['old'])}, {lit(e['new'])})"
                if e['new']:
                    news.append(e['new'])
            final_txt += json.dumps(e, ensure_ascii=False)
        later = r.get('later_version') not in (None, 'None', '') and 'version' in str(r.get('later_version'))
        vid = 'hk45h-' + hashlib.sha256(f"{aid}|{eff}|m".encode()).hexdigest()[:24]
        q = ((f"تاريخ تقريبي — تاريخ صدور الأداة (النشر غير معروف). " if r.get('effective_status') == 'تقريبي' else '')
             + (f"نافذ من {eff}؛ رُكّب بعد نسخة لاحقة قائمة بُنيت دونه. " if later else '')
             + f"المصدر: {r.get('source')}. " + (r.get('effective_basis') or ''))[:1800]
        st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(vid)}, {lit(aid)}, {expr}, {vf}, {lit(f"{r.get('instrument')} وتاريخ {r.get('instrument_date_hijri')}هـ")}, {lit('boe.attachment:' + re.search(r'boe26-[0-9a-f]{24}', str(r.get('source'))).group())}, {lit(q)}, now()
WHERE {' AND '.join(conds)} AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})""")
        post.append(f"EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(vid)})")
        post += [f"strpos((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(x)}) > 0" for x in news]
        n += 1
        if OLD_NAME in final_txt:
            sid = 'hk45h-' + hashlib.sha256(f"{aid}|m36".encode()).hexdigest()[:24]
            st.append(f"""INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument, evidence_url, evidence_quote, created_at)
SELECT {lit(sid)}, {lit(aid)}, replace((SELECT body FROM unit_version WHERE id = {lit(vid)}), {lit(OLD_NAME)}, {lit(NEW_NAME)}), {vfrom(aid, '2020-12-11')}, m.evidence_instrument, m.evidence_url, m.evidence_quote, now()
FROM unit_version m WHERE m.id = {lit(M36)} AND strpos(m.body, {lit(NEW_NAME)}) > 0 AND NOT EXISTS (SELECT 1 FROM unit_version WHERE id = {lit(sid)})""")
            post.append(f"strpos((SELECT body FROM unit_version WHERE id = {lit(sid)}), {lit(OLD_NAME)}) = 0")
            n += 1
            subs += 1
    st = [f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45h-%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"] + st
    st.append(f"SELECT CASE WHEN (SELECT count(*) FROM unit_version WHERE id LIKE 'hk45h-%') = {n} AND {' AND '.join(post)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    rep = {'versions': n, 'name_substitution_versions': subs, 'skipped': skipped}
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': rep, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, n, subs, skipped)


if __name__ == '__main__':
    build()
