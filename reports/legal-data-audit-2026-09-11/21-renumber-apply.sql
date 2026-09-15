-- ═══════════════════════════════════════════════════════════════════
-- 21-renumber-apply.sql — تنفيذ المواصفة MADANI-RENUM-001
-- نظام المعاملات المدنية: حذف المكرّرة ٧٢١ → إعادة ترقيم ٢٣٧–٧٢٠ (+1)
--                          → إدراج المادة ٢٣٧ → مواءمة المراجع المخزَّنة.
--
-- ⛔ لا يُشغَّل إلا بموافقة صريحة، وبعد 10-dry-run.sql.
--
-- لماذا هذا الملف بدل 11-apply.sql:
--   11-apply.sql كان يستبدل العنوان والنصّ من بيان رسميّ كامل (٧٢١ مادة).
--   لكن التشخيص أثبت أن **النصوص صحيحة؛ الخطأ في الترقيم وحده**. لذا إعادة
--   الترقيم أقلّ تدخّلًا وأدقّ: تُبقي اقتران id↔النصّ سليمًا، فلا تُبطِل
--   التضمينات (النصّ لم يتغيّر)، وتجعل الرقم يطابق العنوان الترتيبي تلقائيًّا.
--   يبقى 11-apply.sql خيارًا احتياطيًّا إن توفّر بيان رسميّ كامل لاحقًا.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ① بوابة الهدف والحالة الابتدائية.
DO $$
DECLARE db text; n int; t236 text; t237 text; t720 text; t721 text;
BEGIN
  SELECT current_database() INTO db;
  IF db <> 'neondb' THEN
    RAISE EXCEPTION 'الهدف غير مطابق: current_database()=% — التنفيذ على neondb فقط', db;
  END IF;

  SELECT count(*) INTO n FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber" > 0;
  IF n <> 721 THEN
    RAISE EXCEPTION 'الحالة الابتدائية غير متوقعة: % مادة (المتوقع 721)', n;
  END IF;

  -- مراسي التحقق من المواصفة: يجب أن تكون الإزاحة قائمة فعلًا قبل الإصلاح.
  SELECT left(content,40) INTO t236 FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=236;
  SELECT left(content,40) INTO t237 FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=237;
  SELECT md5(content) INTO t720 FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=720;
  SELECT md5(content) INTO t721 FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=721;

  IF t236 NOT LIKE 'إذا تعدد المدينون%' THEN
    RAISE EXCEPTION 'المرساة 236 غير مطابقة — أُلغي التنفيذ (قد تكون القاعدة صُحِّحت سلفًا)';
  END IF;
  IF t237 NOT LIKE 'للدائن أن يحيل حقه%' THEN
    RAISE EXCEPTION 'المرساة 237 غير مطابقة — أُلغي التنفيذ';
  END IF;
  IF t720 IS DISTINCT FROM t721 THEN
    RAISE EXCEPTION 'الصفّان 720 و721 غير متطابقين — الحالة تغيّرت، أُلغي التنفيذ';
  END IF;
END $$;

-- ② نسخة احتياطية كاملة.
DROP TABLE IF EXISTS legal_articles_backup_renum_20260915;
CREATE TABLE legal_articles_backup_renum_20260915 AS
  SELECT * FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية';

-- ③ نقل مراجع الصفّ المكرّر (721) إلى الصفّ 720 قبل حذفه — لا يُفقد أي ارتباط.
--    (بعد إعادة الترقيم سيصير الصفّ 720 هو المادة 721 الرسمية، وهو الهدف الصحيح.)
UPDATE legal_article_case_links SET "articleId" =
  (SELECT id FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=720)
 WHERE "articleId" = 'cmpzcv2tg093uvtrkk8bcr0qx';
UPDATE consultation_citations SET "articleId" =
  (SELECT id FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=720)
 WHERE "articleId" = 'cmpzcv2tg093uvtrkk8bcr0qx';
UPDATE fiqh_issue_links SET "article_id" =
  (SELECT id FROM legal_articles WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=720)
 WHERE "article_id" = 'cmpzcv2tg093uvtrkk8bcr0qx';
DELETE FROM embeddings
 WHERE "ownerType"='legal_article' AND "ownerId"='cmpzcv2tg093uvtrkk8bcr0qx';
DELETE FROM article_versions   WHERE "articleId"='cmpzcv2tg093uvtrkk8bcr0qx';
DELETE FROM article_amendments WHERE "articleId"='cmpzcv2tg093uvtrkk8bcr0qx';
DELETE FROM legal_graph_nodes  WHERE "articleId"='cmpzcv2tg093uvtrkk8bcr0qx';

-- ④ حذف الصفّ المكرّر (الحالة الوحيدة المسموح فيها بالحذف: نسخة حرفية بلا نصّ فريد).
DELETE FROM legal_articles WHERE id = 'cmpzcv2tg093uvtrkk8bcr0qx';

-- ⑤ إعادة الترقيم ٢٣٧–٧٢٠ ← +1، على مرحلتين لتفادي تصادم قيد التفرّد.
--    ⚠️ UPDATE واحد بـ+1 يفشل: @@unique([lawName, articleNumber]) غير قابل للتأجيل،
--    ويُفحص صفًّا صفًّا، فيصطدم الصفّ 237 بالصفّ 238 القائم. الإزاحة المؤقتة تحلّها.
UPDATE legal_articles SET "articleNumber" = "articleNumber" + 10000, "updatedAt" = now()
 WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber" BETWEEN 237 AND 720;

UPDATE legal_articles SET "articleNumber" = "articleNumber" - 9999, "updatedAt" = now()
 WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber" BETWEEN 10237 AND 10720;

-- ⑥ إدراج المادة ٢٣٧ الرسمية (المادة الوحيدة التي يلزم نصّها من الخارج).
--    العنوان الترتيبي إلزاميّ: بوابة الجودة تقارنه بالرقم.
INSERT INTO legal_articles
  (id, "legalSystemId", "lawName", "articleNumber", title, content, status, "createdAt", "updatedAt")
SELECT
  'cmadanirenum001art237'::text,
  (SELECT id FROM legal_systems WHERE name='نظام المعاملات المدنية'),
  'نظام المعاملات المدنية',
  237,
  'المادة السابعة والثلاثون بعد المائتين',
  'إذا تعدد الدائنون أو ورثة الدائن في التزام غير قابل للانقسام، جاز لكل منهم أن يطالب بأدائه كاملاً، وإذا اعترض أحدهم كان المدين ملزماً بأداء الالتزام لهم مجتمعين أو إيداع الشيء محل الالتزام لدى الجهة التي يحددها وزير العدل، وللبقية حق الرجوع على الدائن الذي استوفى الالتزام كل بقدر حصته.',
  'سارية', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM legal_articles
   WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=237
);

-- ⑦ مواءمة المراجع التي تخزّن **رقم المادة** لا معرّفها.
--    (المراجع بالـid تصحّ تلقائيًّا لأن اقتران id↔النصّ لم يتغيّر.)

-- ٧-أ: consultation_citations تخزّن articleNumber مُفكَّكًا ⇒ يُعاد مزامنته من المادة.
UPDATE consultation_citations c
   SET "articleNumber" = a."articleNumber"
  FROM legal_articles a
 WHERE a.id = c."articleId"
   AND c."lawName" = 'نظام المعاملات المدنية'
   AND c."articleNumber" IS DISTINCT FROM a."articleNumber";

-- ٧-ب: fiqh_issue_links يربط منطقيًّا بـ(law_name, article_number) ⇒ يُزاح +1.
--     على مرحلتين أيضًا: @@unique([issueId, lawName, articleNumber]).
UPDATE fiqh_issue_links SET article_number = article_number + 10000
 WHERE law_name='نظام المعاملات المدنية' AND article_number BETWEEN 237 AND 720;
UPDATE fiqh_issue_links SET article_number = article_number - 9999
 WHERE law_name='نظام المعاملات المدنية' AND article_number BETWEEN 10237 AND 10720;
-- أي رابط كان يستهدف 721 (المكرّرة) يُعلَّم للمراجعة البشرية بدل تخمين هدفه.
UPDATE fiqh_issue_links SET citation = citation || ' [يحتاج مراجعة: كان يستهدف المادة 721 المكرّرة]'
 WHERE law_name='نظام المعاملات المدنية' AND article_number = 721
   AND citation NOT LIKE '%يحتاج مراجعة%';

-- ⑧ تحديث العدّاد وتسجيل الواقعة تصحيحَ بيانات لا تعديلًا تشريعيًّا.
UPDATE legal_systems s
   SET "articleCount" = (SELECT count(*) FROM legal_articles a
                          WHERE a."legalSystemId"=s.id AND a."articleNumber" > 0),
       "updatedAt" = now()
 WHERE s.name='نظام المعاملات المدنية';

INSERT INTO audit_logs (id, "userId", action, "entityType", "entityId", metadata, "createdAt")
VALUES (gen_random_uuid()::text, NULL, 'LEGAL_DATA_CORRECTION', 'legal_system',
        (SELECT id FROM legal_systems WHERE name='نظام المعاملات المدنية'),
        jsonb_build_object(
          'kind','data_error_correction','not_a_legislative_amendment', true,
          'fix_id','MADANI-RENUM-001',
          'defect','off_by_one_237_720 + duplicate_721 + missing_237',
          'number_map','1-236: unchanged | 237-720: +1 | old 721: deleted (duplicate) | new 237: inserted',
          'backup_table','legal_articles_backup_renum_20260915',
          'report','reports/legal-data-audit-2026-09-11/'),
        now());

-- ⑨ تأكيدات ما بعد الإصلاح (من المواصفة). يجب أن تعود كلها true.
SELECT
  (SELECT count(*) FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber">0) = 721            AS count_is_721,
  (SELECT count(*) FROM (SELECT "articleNumber" FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' GROUP BY "articleNumber"
    HAVING count(*)>1) d) = 0                                                         AS no_duplicate_numbers,
  (SELECT count(*) FROM (SELECT md5(content) FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' GROUP BY md5(content)
    HAVING count(*)>1) d) = 0                                                         AS no_duplicate_text,
  (SELECT content LIKE 'إذا تعدد المدينون%' FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=236)                AS a236_ok,
  (SELECT content LIKE 'إذا تعدد الدائنون%' FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=237)                AS a237_ok,
  (SELECT content LIKE 'للدائن أن يحيل حقه%' FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=238)                AS a238_ok,
  (SELECT content LIKE 'إذا أخل المقاول%' FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=466)                AS a466_ok,
  (SELECT content LIKE 'يُعمل بهذا النظام%' FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=721)                AS a721_ok,
  NOT EXISTS (SELECT 1 FROM legal_articles
    WHERE "lawName"='نظام المعاملات المدنية' AND "articleNumber"=722)                AS no_722;

-- راجع: يجب أن تكون التسعة كلها true. ثم شغّل:
--   npx tsx scripts/audit/verify-civil-renumber.ts   (فحص الرقم مقابل العنوان لكل 721 مادة)
-- COMMIT;
ROLLBACK; -- الافتراضي آمن. بدّله إلى COMMIT بعد التحقق والموافقة.
