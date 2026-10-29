#!/usr/bin/env python3
"""gap002a (HKM-048، الصنف P2u): عناوين الأبواب والفصول من لقطة أم القرى إلى legal_articles.chapter.

النمط نفسه الذي اعتمده المالك في HKM-030 (23/10: «ابني الآلية والطريقة بشكل صحيح بحيث لا تضيف شي غير صحيح»):
تعبئة عمود فارغ فقط، وصف legal_text_provenance لكل كتابة، وsearch_norm لما لا نسخة سارية له.

الدليل: وحدة المادة في أم القرى (uqn_stage.unit) تحمل عنوان بابها أو فصلها (chapter/section)، والنظام في حكيم أُدخل من العمل نفسه.
لا يُكتب عنوان إلا إذا اجتمعت الشروط كلها:
  1. النظام أُدخل من عمل واحد في أم القرى، وليس في أي مادة منه عنوان اليوم.
  2. لا تحمل أي مادة في ذلك العمل عنوانًا ملتصقًا في متنها (سطر يبدأ بباب/فصل/قسم/جزء/فرع)، وإلا فالمحلل أخطأ حدود الأبواب فيُستبعد النظام كله.
  3. المادة في حكيم برقمها نفسه، ورقمها لا يتكرر في العمل، ونصها = نص أم القرى بعد التطبيع (أو تشابه ≥ 0.9).
  4. العنوان يبدأ بباب/فصل/قسم/جزء/فرع، طوله 3–200، بلا «المادة» ولا رموز تنسيق (* # _ | < >)، وأقواسه متوازنة.
  5. تسلسل الأبواب أو الفصول في النظام يبدأ بالأول ولا يقفز؛ ما خالف ذلك يُستبعد (ضوابط المنشآت الواقعة بأسواق النفع العام: أول مادة موسومة بالفصل الثاني).
  6. أنظمة HKM-046 المفتوحة لا تُمس.
  python3 build.py            → statements.json وsample.md
  python3 build.py --measure  → SELECT للقياس بقراءة فقط (العدد والبصمة)
"""
import hashlib, json, sys
from pathlib import Path

OUT = Path(__file__).parent
SRC_ID = 'gap002a-uqn-chapters-2026-10-28'
EXPECTED_N, EXPECTED_FP = int(sys.argv[2]) if len(sys.argv) > 2 else 0, (sys.argv[3] if len(sys.argv) > 3 else '')
FAIL = '(1/(SELECT count(*) FROM legal_systems WHERE false))::text'
HEAD_RX = r'(^|\n)\s*(الباب|الفصل|القسم|الجزء|الفرع)\s+\S+'
FOOTER = r'(\s*(تنزيل الملف|تم نسخ الرابط))*\s*جميع الحقوق محفوظة لجريدة أم القرى © \d{4}\s*$'
EXCLUDE_NAMES = ['ضوابط المنشآت الواقعة بأسواق النفع العام للخضار والفواكه واللحوم والبيض والأسماك']
HKM046 = '(حقوق المؤلف|الإحصاء|الخطوط الحديدية|الأسماء التجارية|السجل التجاري|الاستثمار الأجنبي)'

SELECT = f"""
WITH us AS (SELECT DISTINCT p.entity_id sid, p.source_id FROM legal_text_provenance p WHERE p.source='uqn' AND p.entity_type='system'),
t AS (SELECT us.*, s.name FROM us JOIN legal_systems s ON s.id=us.sid
  WHERE NOT EXISTS (SELECT 1 FROM legal_articles z WHERE z."legalSystemId"=us.sid AND coalesce(z.chapter,'')<>'')
    AND (SELECT count(*) FROM us u2 WHERE u2.sid=us.sid)=1
    AND s.name !~ '{HKM046}' AND s.name <> ALL (ARRAY[{','.join("$hk$"+n+"$hk$" for n in EXCLUDE_NAMES)}])
    AND NOT EXISTS (SELECT 1 FROM uqn_stage.unit u WHERE u.source_id=us.source_id AND u.unit_type='article' AND u.body ~ '{HEAD_RX}')),
un AS (SELECT u.source_id, u.number, count(*) c FROM uqn_stage.unit u JOIN t ON t.source_id=u.source_id WHERE u.unit_type='article' AND u.number IS NOT NULL GROUP BY 1,2),
c AS (SELECT a.id tid, t.sid, t.source_id, u.seq,
   btrim(regexp_replace(regexp_replace(CASE WHEN coalesce(u.chapter,'')<>'' AND coalesce(u.section,'')<>'' THEN u.chapter||' › '||u.section ELSE coalesce(nullif(u.chapter,''),u.section,'') END, '\\s*\\n\\s*', ' — ', 'g'), '\\s+', ' ', 'g')) heading,
   uqn_fix.hkm30_norm(regexp_replace(u.body, '{FOOTER}', '')) ub, uqn_fix.hkm30_norm(a.content) ac, uqn_fix.hkm30_norm(coalesce(a.title||' ','')||a.content) atc
 FROM t JOIN legal_articles a ON a."legalSystemId"=t.sid AND a."articleBis"=0 AND coalesce(a.chapter,'')=''
 JOIN uqn_stage.unit u ON u.source_id=t.source_id AND u.unit_type='article' AND u.number=a."articleNumber"
 JOIN un ON un.source_id=u.source_id AND un.number=u.number AND un.c=1)
SELECT tid, sid, source_id, seq, heading FROM c
WHERE (ub=ac OR ub=atc OR greatest(similarity(ub,ac),similarity(ub,atc))>=0.9)
  AND heading ~ '^(الباب|الفصل|القسم|الجزء|الفرع)\\s' AND length(heading) BETWEEN 3 AND 200 AND heading !~ 'المادة' AND heading !~ '[*#_|<>]'
  AND length(regexp_replace(heading,'[^(]','','g'))=length(regexp_replace(heading,'[^)]','','g'))""".strip()

if '--measure' in sys.argv[1:2]:
    print(f"SELECT count(*) n, count(DISTINCT sid) systems, count(DISTINCT heading) headings, md5(string_agg(tid||'|'||heading, '|' ORDER BY tid)) fp FROM ({SELECT}) x")
    sys.exit(0)

stmts = [
    f"CREATE TEMP TABLE g2a ON COMMIT DROP AS {SELECT}",
    f"""SELECT CASE WHEN (SELECT count(*) FROM g2a)={EXPECTED_N} AND (SELECT md5(string_agg(tid||'|'||heading, '|' ORDER BY tid)) FROM g2a)='{EXPECTED_FP}' AND (SELECT count(*) FROM g2a h JOIN legal_articles a ON a.id=h.tid WHERE coalesce(a.chapter,'')<>'')=0 AND (SELECT count(*) FROM legal_text_provenance WHERE source_id='{SRC_ID}')=0 THEN 'ok' ELSE {FAIL} END AS guard_before""",
    f"""INSERT INTO legal_text_provenance (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url, text_sha, retrieved_on, action, previous_text, created_at) SELECT 'g2ap-'||left(encode(sha256(convert_to('{SRC_ID}|'||h.tid,'UTF8')),'hex'),24), 'article', h.tid, a."lawName", a."articleNumber", 'uqn', '{SRC_ID}', 'https://www.uqn.gov.sa/details?p='||replace(h.source_id,'uqn:','')||'#unit-'||h.seq, encode(sha256(convert_to(h.heading,'UTF8')),'hex'), '2026-10-28'::date, 'chapter_set:uqn_unit', coalesce(a.chapter,''), now() FROM g2a h JOIN legal_articles a ON a.id=h.tid""",
    """UPDATE legal_articles a SET chapter = h.heading, "updatedAt" = now() FROM g2a h WHERE a.id = h.tid AND coalesce(a.chapter,'')=''""",
    """UPDATE legal_articles a SET search_norm = uqn_fix.hkm30_search_norm(a."lawName", a.title, a.content, a.keywords, a.classification, a.chapter) FROM g2a h WHERE a.id = h.tid AND NOT EXISTS (SELECT 1 FROM unit_version v WHERE v.unit_id = a.id AND v.valid_from <= now())""",
    f"""SELECT CASE WHEN (SELECT count(*) FROM legal_articles a JOIN g2a h ON h.tid=a.id WHERE a.chapter=h.heading)={EXPECTED_N} AND (SELECT count(*) FROM legal_text_provenance WHERE source_id='{SRC_ID}')={EXPECTED_N} THEN 'ok' ELSE {FAIL} END AS guard_after""",
]
md5 = hashlib.md5('\n'.join(stmts).encode()).hexdigest()
json.dump({'by': SRC_ID, 'md5': md5, 'count': len(stmts), 'expect': {'articles_chapter_set': EXPECTED_N, 'fingerprint': EXPECTED_FP}, 'runner': 'run_sql_transaction (نمط HKM-030؛ apply-statements لا يقبل UPDATE العنوان)', 'statements': stmts},
          open(OUT / 'statements.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(md5, len(stmts))
