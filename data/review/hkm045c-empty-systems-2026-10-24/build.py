#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045c، البند 7): مواد الأنظمة الفارغة من نص أم القرى المخزن.

قرأ قارئ الأنظمة الفارغة الـ83 (result.jsonl): source_units 73، image_text 3، duplicate_of 2، no_source 5.
هذه الدفعة للمكتمل من source_units بمصدر أم القرى (59 نظامًا)؛ والحدود من segment.py (segments.json).
كل نص يُقطع داخل القاعدة من uqn_stage.unit بـ substr بعد التحقق من بصمة الجسم، ثم يُتحقق من بصمة كل وحدة.
خارج الدفعة (segments.json → skipped): النصوص الجزئية (13)، والمكرران، وما لا مصدر له، ونصوص الصور (تحتاج
مراجعًا مستقلًا)، وتنظيم المجلس الأعلى لشؤون البترول والمعادن (نص الهيئة يخالف الصورة في رقم الأمر).

    python3 data/review/hkm045c-empty-systems-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
BY = 'hkm045c-empty-systems-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def hid(*p):
    return hashlib.sha256('|'.join(p).encode()).hexdigest()[:24]


def build():
    seg = json.loads((D / 'segments.json').read_text(encoding='utf-8'))
    systems = seg['systems']
    st, pre, post = [], [], []
    n_art = 0
    for x in systems:
        sid = x['system_id']
        unit = (f"(SELECT body FROM uqn_stage.unit WHERE batch_id = {lit(x['batch_id'])} AND source_id = {lit(x['source_id'])} "
                f"AND seq = {int(x['seq'])})")
        pre.append(f"(SELECT count(*) FROM legal_systems WHERE id = {lit(sid)} AND name = {lit(x['name'])} AND \"articleCount\" = 0) = 1")
        pre.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\" = {lit(sid)}) = 0")
        pre.append(f"md5({unit}) = {lit(x['md5'])}")
        for s, m in zip(x['segments'], x['seg_md5']):
            aid = 'hk45c-' + hid(sid, str(s['n']), str(s['bis']))
            body = f"btrim(replace(substr({unit}, {s['start'] + 1}, {s['end'] - s['start']}), '**', ''), E' \\n\\t\\r')"
            st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT {lit(aid)}, s.id, s.name, s.classification, {s['n']}, {s['bis']}, {lit(s['title'])}, t.body, NULL, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, {lit(s['title'])}, t.body, ARRAY[]::text[], s.classification, NULL)
FROM legal_systems s, (SELECT {body} AS body) t WHERE s.id = {lit(sid)} AND md5(t.body) = {lit(m)} AND NOT EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)})""")
            st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT {lit('hk45cp-' + hid(aid))}, 'article', a.id, a."lawName", a."articleNumber", 'uqn', {lit(x['source_id'])}, {lit(x['source_url'])}, left(encode(sha256(convert_to(a.content, 'UTF8')), 'hex'), 16), '2026-09-25'::date, 'insert', NULL, now()
FROM legal_articles a WHERE a.id = {lit(aid)}""")
            post.append(f"md5((SELECT content FROM legal_articles WHERE id = {lit(aid)})) = {lit(m)}")
            n_art += 1
        st.append(f'UPDATE legal_systems SET "articleCount" = (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = {lit(sid)} AND "articleBis" < 100) WHERE id = {lit(sid)} AND "articleCount" = 0')
        n_main = sum(1 for s in x['segments'] if s['bis'] < 100)
        post.append(f"(SELECT \"articleCount\" FROM legal_systems WHERE id = {lit(sid)}) = {n_main}")
    head = f"SELECT CASE WHEN {' AND '.join(pre)} AND (SELECT count(*) FROM legal_articles WHERE id LIKE 'hk45c-%') = 0 THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"
    tail = (f"SELECT CASE WHEN {' AND '.join(post)} AND (SELECT count(*) FROM legal_articles WHERE id LIKE 'hk45c-%' AND search_norm <> '') = {n_art} "
            f"AND (SELECT count(*) FROM legal_text_provenance WHERE id LIKE 'hk45cp-%') = {n_art} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    st = [head] + st + [tail]
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    rep = {'systems': len(systems), 'articles': n_art, 'preambles': sum(1 for x in systems for s in x['segments'] if s['bis'] >= 100),
           'split_by_article': sum(1 for x in systems if x['kind'] == 'articles'), 'single_unit': sum(1 for x in systems if x['kind'] == 'single'),
           'skipped': len(seg['skipped'])}
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': rep, 'expect_delta': {'public.legal_articles': n_art},
                                                   'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, rep)


if __name__ == '__main__':
    build()
