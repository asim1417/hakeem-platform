-- ═══════════════════════════════════════════════════════════════════════════
-- تحقّق أرضي: تغطية التضمين الفعلية + تشخيص الأحكام الفارغة النص. قراءة فقط.
-- الغرض: استبدال الاستنتاج من سجلّات الـbackfill بقياس مباشر من القاعدة.
-- ملاحظة: judicial_cases.judgmentText من نوع String (NOT NULL) — فالفراغ = '' لا NULL.
-- نصّ تضمين الحكم يُبنى من (court + judgmentTitle + judgmentText)، فالفراغ الحقيقي
-- للتضمين = الحقول الثلاثة كلها فارغة.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '--- (1) تغطية embeddings حسب النوع ---'
SELECT "owner_type", count(*) AS vectored
FROM "embeddings" GROUP BY "owner_type" ORDER BY "owner_type";

\echo '--- (2) إجمالي الأحكام وحالة نصّها ---'
SELECT
  count(*)                                                                              AS total_rulings,
  count(*) FILTER (WHERE btrim("judgmentText") = '')                                    AS empty_judgment_text,
  count(*) FILTER (WHERE btrim(coalesce("court",'') || coalesce("judgmentTitle",'') || "judgmentText") = '')
                                                                                        AS empty_all_embed_fields,
  count(*) FILTER (WHERE length(btrim("judgmentText")) BETWEEN 1 AND 20)                AS very_short_text,
  round(avg(length("judgmentText")))                                                    AS avg_len
FROM "judicial_cases";

\echo '--- (3) الأحكام بلا متجه: كم منها نصّه فارغ فعلًا؟ ---'
SELECT
  count(*)                                                              AS rulings_without_vector,
  count(*) FILTER (WHERE btrim(jc."judgmentText") = '')                 AS without_vector_empty_text,
  count(*) FILTER (WHERE btrim(jc."judgmentText") <> '')                AS without_vector_but_has_text
FROM "judicial_cases" jc
LEFT JOIN "embeddings" e ON e."owner_type" = 'ruling' AND e."owner_id" = jc."id"
WHERE e."owner_id" IS NULL;

\echo '--- (4) عيّنة (8) من أحكام بلا متجه ونصّها فارغ ---'
SELECT jc."id",
       length("judgmentText")            AS jt_len,
       left(coalesce("judgmentTitle",''),45) AS title,
       left(coalesce("court",''),30)     AS court,
       "reviewStatus"
FROM "judicial_cases" jc
LEFT JOIN "embeddings" e ON e."owner_type" = 'ruling' AND e."owner_id" = jc."id"
WHERE e."owner_id" IS NULL AND btrim("judgmentText") = ''
LIMIT 8;

\echo '--- (5) عيّنة (5) من أحكام بلا متجه لكن لها نصّ (لو وُجدت = فشل عابر لا فراغ) ---'
SELECT jc."id",
       length("judgmentText")            AS jt_len,
       left(coalesce("judgmentTitle",''),45) AS title
FROM "judicial_cases" jc
LEFT JOIN "embeddings" e ON e."owner_type" = 'ruling' AND e."owner_id" = jc."id"
WHERE e."owner_id" IS NULL AND btrim("judgmentText") <> ''
LIMIT 5;
