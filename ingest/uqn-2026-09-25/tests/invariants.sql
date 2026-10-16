-- =====================================================================
-- اختبارات الثوابت — تُشغَّل بعد كل تحميل أو ترحيل
-- كل استعلام يجب أن يعيد صفر صفوف (أو يتوافق مع "المتوقع" المكتوب في تعليقه).
-- الجزء (أ) على المنطقة الوسيطة uqn_stage — جاهز للتشغيل الآن.
-- الجزء (ب) على الجداول الرئيسية — قوالب يطابقها الوكيل مع أسماء جداول المستودع.
-- الاستخدام: psql "$DATABASE_URL" -v batch='uqn-2026-09-25' -f tests/invariants.sql
-- =====================================================================
\set ON_ERROR_STOP off
\echo '== (أ) المنطقة الوسيطة =='

\echo 'A1 وحدات يتيمة بلا عمل'
SELECT u.source_id, u.seq FROM uqn_stage.unit u
LEFT JOIN uqn_stage.work w USING (batch_id, source_id)
WHERE u.batch_id = :'batch' AND w.source_id IS NULL;

\echo 'A2 أعمال مكتملة بلا أي وحدة'
SELECT source_id, title FROM uqn_stage.work w
WHERE batch_id = :'batch' AND parse_status IN ('complete') AND NOT EXISTS
  (SELECT 1 FROM uqn_stage.unit u WHERE u.batch_id=w.batch_id AND u.source_id=w.source_id);

\echo 'A3 تسلسل المواد غير متصل في أعمال موسومة مكتملة'
WITH n AS (
  SELECT source_id, array_agg(number ORDER BY seq) nums, count(*) c
  FROM uqn_stage.unit WHERE batch_id = :'batch' AND unit_type IN ('article','clause') GROUP BY source_id)
SELECT w.source_id, w.title, n.c FROM uqn_stage.work w JOIN n USING (source_id)
WHERE w.batch_id = :'batch' AND w.parse_status='complete'
  AND n.nums <> ARRAY(SELECT generate_series(1, n.c::int));

\echo 'A4 عدد المواد المعلن لا يطابق الوحدات'
SELECT w.source_id, w.article_count, count(u.*) FROM uqn_stage.work w
LEFT JOIN uqn_stage.unit u ON u.batch_id=w.batch_id AND u.source_id=w.source_id AND u.unit_type IN ('article','clause')
WHERE w.batch_id = :'batch' GROUP BY 1,2 HAVING w.article_count <> count(u.*);

\echo 'A5 أنظمة (dataset=laws) بلا أداة إصدار ولا علامة نقص — المتوقع 0'
SELECT source_id, title FROM uqn_stage.work w
WHERE batch_id = :'batch' AND dataset='laws'
  AND NOT EXISTS (SELECT 1 FROM uqn_stage.unit u WHERE u.batch_id=w.batch_id AND u.source_id=w.source_id AND u.unit_type IN ('enacting_instrument','approval_instrument'))
  AND NOT ('missing_issuance_instrument' = ANY(flags));

\echo 'A6 وحدة أداة إصدار تأتي بعد مادة (يجب أن تسبق المادة الأولى)'
SELECT i.source_id FROM uqn_stage.unit i JOIN uqn_stage.unit a
  ON a.batch_id=i.batch_id AND a.source_id=i.source_id AND a.unit_type IN ('article','clause')
WHERE i.batch_id = :'batch' AND i.unit_type IN ('enacting_instrument','approval_instrument','preamble') AND i.seq > a.seq
GROUP BY 1;

\echo 'A7 نص فارغ أو قصير جدًا في مادة (< 15 حرفًا) — للمراجعة'
SELECT source_id, number, body FROM uqn_stage.unit
WHERE batch_id = :'batch' AND unit_type IN ('article','clause') AND length(btrim(body)) < 15;

\echo 'A8 تكرار بصمة نص المادة نفسها داخل العمل الواحد (تكرار استخراج)'
SELECT source_id, text_sha, count(*) FROM uqn_stage.unit
WHERE batch_id = :'batch' AND unit_type IN ('article','clause')
GROUP BY 1,2 HAVING count(*) > 1;

\echo 'A9 تواريخ هجرية غير صالحة الصيغة'
SELECT source_id, royal_decree_date_hijri, approval_date_hijri FROM uqn_stage.work
WHERE batch_id = :'batch' AND (
  (royal_decree_date_hijri IS NOT NULL AND royal_decree_date_hijri !~ '^\d{4}-\d{2}-\d{2}$') OR
  (approval_date_hijri IS NOT NULL AND approval_date_hijri !~ '^\d{4}-\d{2}-\d{2}$'));

\echo 'A10 مرسوم مذكور رقمه بلا تاريخ أو العكس'
SELECT source_id, royal_decree_no, royal_decree_date_hijri FROM uqn_stage.work
WHERE batch_id = :'batch' AND ((royal_decree_no IS NULL) <> (royal_decree_date_hijri IS NULL));

\echo 'A11 أثر تشريعي بلا نص تنفيذي أو بلا رابط'
SELECT effect_id FROM uqn_stage.effect
WHERE batch_id = :'batch' AND (length(btrim(operative_text)) < 20 OR source_url IS NULL);

\echo 'A12 أثر مؤكد (confirmed/applied) دون ربطه بعمل في حكيم'
SELECT effect_id FROM uqn_stage.effect
WHERE batch_id = :'batch' AND status IN ('confirmed','applied') AND resolved_work_id IS NULL;

\echo 'A13 مؤشرات (للعرض لا للرفض)'
SELECT dataset, parse_status, count(*) works,
       sum(article_count) articles,
       round(100.0*avg((sequence_contiguous)::int),1) pct_contiguous
FROM uqn_stage.work WHERE batch_id = :'batch' GROUP BY 1,2 ORDER BY 1,2;
SELECT effect_type, target_match_status, count(*) FROM uqn_stage.effect
WHERE batch_id = :'batch' GROUP BY 1,2 ORDER BY 1,3 DESC;

-- =====================================================================
\echo '== (ب) الجداول الرئيسية — قوالب؛ عدّل أسماء الجداول/الأعمدة لتطابق Prisma schema =='
-- B1 كل عمل له تعبير (نسخة) واحد على الأقل
-- SELECT w.id FROM legal_work w WHERE NOT EXISTS (SELECT 1 FROM legal_expression e WHERE e.work_id=w.id);
-- B2 لا تداخل زمني بين نسختين للوحدة نفسها (يُفضّل قيد EXCLUDE):
-- ALTER TABLE unit_version ADD CONSTRAINT no_overlap EXCLUDE USING gist (unit_key WITH =, valid_range WITH &&);
-- B3 لا عمل «نافذ» و«ملغى» في التاريخ نفسه
-- SELECT id FROM legal_work WHERE status='in_force' AND repealed_on IS NOT NULL AND repealed_on <= current_date;
-- B4 كل إحلال/إلغاء له خلف أو أداة إلغاء مرتبطة
-- SELECT id FROM legal_work WHERE status='repealed' AND NOT EXISTS (SELECT 1 FROM legal_effect f WHERE f.target_work_id=legal_work.id AND f.effect_type IN ('repeal','replace'));
-- B5 كل legal_effect يشير لعمل ووحدة موجودين
-- SELECT f.id FROM legal_effect f LEFT JOIN legal_work w ON w.id=f.target_work_id WHERE w.id IS NULL;
-- B6 استعلام «كما في تاريخ» يعيد نسخة واحدة بالضبط لكل مادة
-- SELECT unit_key, count(*) FROM unit_version WHERE valid_range @> DATE '2025-01-01' GROUP BY 1 HAVING count(*) <> 1;
-- B7 كل لائحة تنفيذية مربوطة بنظامها الأم (IMPLEMENTS)
-- SELECT id FROM legal_work WHERE work_type='executive_regulation' AND NOT EXISTS (SELECT 1 FROM document_relation r WHERE r.from_work_id=legal_work.id AND r.kind='IMPLEMENTS');
-- B8 لكل نص في الجداول الرئيسية مصدر (رابط + بصمة + تاريخ جلب)
-- SELECT id FROM legal_expression WHERE source_url IS NULL OR content_sha IS NULL;
