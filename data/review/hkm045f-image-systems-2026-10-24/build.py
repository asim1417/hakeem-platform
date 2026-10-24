#!/usr/bin/env python3
"""HKM-045 (دفعة hkm045f، البند 7): مواد نظامين فارغين من صور أصل الوثيقة بعد مطابقة مستقلة.

قارئ فرّغ النص من صور المرفقات (../hkm045c-empty-systems-2026-10-24/articles.jsonl)، ومراجع مستقل طابق كل وحدة
بصورتها كلمة كلمة وتحقق من بصمة كل صورة مع boe.attachment_page.image_sha256 (verify.jsonl): المصحح يؤخذ نصه
final_body من المراجع، والمرجع ما في الصورة ولو كان خطأ في الأصل (السنابيك ثانيًا البند ٢: «للبند(٣)» كما في الصورة).
- قواعد ترشيح رواد العمل التطوعي واختيارهم وتكريمهم: 6 وحدات (كلها مطابقة).
- لائحة ضوابط دخول القوارب (السنابيك): 3 وحدات (واحدة مصححة).
خارج الدفعة: نظام رسوم وأجور خدمات الموانئ (صوره تثبت ثلاث أدوات لاحقة غيرت الرسوم، وحاشية جازان، وقراءة «للوحده»
تحتاج معاينة المالك)، وتنظيم المجلس الأعلى لشؤون البترول والمعادن (petroleum.json).

    python3 data/review/hkm045f-image-systems-2026-10-24/build.py
"""
import hashlib, json
from pathlib import Path

D = Path(__file__).parent
SRC = D.parent / 'hkm045c-empty-systems-2026-10-24' / 'articles.jsonl'
BY = 'hkm045f-image-systems-2026-10-24'
GUARD_FAIL = "(1/(SELECT count(*) FROM legal_systems WHERE false))::text"
TAKE = {'cmpz5r7vl00bdcwg2so6kjq51', 'cmpz5rwtp00decwg205jpy10g'}


def lit(s):
    assert '$hk$' not in s
    return f'$hk${s}$hk$'


def build():
    arts = [json.loads(l) for l in SRC.read_text(encoding='utf-8').splitlines() if l.strip()]
    ver = {(v['system_id'], str(v['article_number'])): v for v in (json.loads(l) for l in (D / 'verify.jsonl').read_text(encoding='utf-8').splitlines() if l.strip())}
    st, pre, post, n = [], [], [], {}
    for sid in sorted(TAKE):
        pre.append(f"(SELECT count(*) FROM legal_systems WHERE id = {lit(sid)} AND \"articleCount\" = 0) = 1")
        pre.append(f"(SELECT count(*) FROM legal_articles WHERE \"legalSystemId\" = {lit(sid)}) = 0")
    for a in arts:
        sid = a['system_id']
        if sid not in TAKE:
            continue
        v = ver[(sid, str(a['article_number']))]
        assert v['status'] in ('confirmed', 'corrected') and v['image_sha_ok'] is True, (sid, a['article_number'])
        body = (v['final_body'] if v['status'] == 'corrected' else a['body']).strip()
        num = int(a['article_number'])
        aid = 'hk45f-' + hashlib.sha256(f'{sid}|{num}'.encode()).hexdigest()[:24]
        title = f'البند {num}'
        pre.append(f"(SELECT count(*) FROM boe.attachment_page WHERE attachment_id = {lit(a['attachment_id'])}) > 0")
        st.append(f"""INSERT INTO legal_articles (id, "legalSystemId", "lawName", classification, "articleNumber", "articleBis", title, content, "royalDecree", "effectiveFrom", status, "createdAt", "updatedAt", search_norm)
SELECT {lit(aid)}, s.id, s.name, s.classification, {num}, 0, {lit(title)}, {lit(body)}, NULL, NULL, 'سارية', now(), now(),
  uqn_fix.hkm30_search_norm(s.name, {lit(title)}, {lit(body)}, ARRAY[]::text[], s.classification, NULL)
FROM legal_systems s WHERE s.id = {lit(sid)} AND NOT EXISTS (SELECT 1 FROM legal_articles WHERE id = {lit(aid)})""")
        st.append(f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at)
SELECT {lit('hk45fp-' + aid[6:])}, 'article', a.id, a."lawName", a."articleNumber", 'boe_attachment_image', {lit(a['attachment_id'] + ':' + str(a['page']))},
  coalesce((SELECT href FROM boe.attachment WHERE id = {lit(a['attachment_id'])}), {lit('boe.attachment:' + a['attachment_id'])}), left(encode(sha256(convert_to(a.content, 'UTF8')), 'hex'), 16),
  '2026-10-24'::date, {lit('insert:image_reading_verified (' + v['status'] + ')')}, NULL, now()
FROM legal_articles a WHERE a.id = {lit(aid)}""")
        post.append(f"md5((SELECT content FROM legal_articles WHERE id = {lit(aid)})) = {lit(hashlib.md5(body.encode()).hexdigest())}")
        n[sid] = n.get(sid, 0) + 1
    for sid in sorted(TAKE):
        st.append(f'UPDATE legal_systems SET "articleCount" = (SELECT count(*) FROM legal_articles WHERE "legalSystemId" = {lit(sid)} AND "articleBis" < 100) WHERE id = {lit(sid)} AND "articleCount" = 0')
        post.append(f"(SELECT \"articleCount\" FROM legal_systems WHERE id = {lit(sid)}) = {n[sid]}")
    total = sum(n.values())
    st = [f"SELECT CASE WHEN {' AND '.join(pre)} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_before"] + st
    st.append(f"SELECT CASE WHEN {' AND '.join(post)} AND (SELECT count(*) FROM legal_articles WHERE id LIKE 'hk45f-%') = {total} THEN 'ok' ELSE {GUARD_FAIL} END AS guard_after")
    md5 = hashlib.md5('\n'.join(st).encode()).hexdigest()
    (D / 'statements.json').write_text(json.dumps({'by': BY, 'md5': md5, 'count': len(st), 'report': {'systems': len(n), 'articles': total},
                                                   'expect_delta': {'public.legal_articles': total}, 'statements': st}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(st), md5, n)


if __name__ == '__main__':
    build()
