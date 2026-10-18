-- ============================================================================
-- الخطوة 2/4 — ترحيل البيانات القديمة (backfill)
-- مقترح — لا يُنفَّذ دون إذن صريح.
-- لا يفرض NOT NULL هنا. لا يضع DEFAULT دائمًا على service_key.
-- ============================================================================

-- 1) الصفوف التراثية → legal-chat (مرة واحدة)
UPDATE "chat_conversations"
SET "service_key" = 'legal-chat'
WHERE "service_key" IS NULL;

-- 2) العنوان التلقائي الأصلي = العنوان الحالي عند غياب generated_title
UPDATE "chat_conversations"
SET "generated_title" = "title"
WHERE "generated_title" IS NULL
  AND "title" IS NOT NULL
  AND btrim("title") <> '';

-- 3) حالة تشغيلية افتراضية للمحادثات القائمة
UPDATE "chat_conversations"
SET "status" = 'active'
WHERE "status" IS NULL;

-- 4) ترقيم الرسائل القديمة
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "conversation_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "chat_messages"
  WHERE "sequence" IS NULL
)
UPDATE "chat_messages" AS m
SET "sequence" = ordered.rn
FROM ordered
WHERE m."id" = ordered."id";

-- 5) حالة الرسائل القديمة المكتملة
UPDATE "chat_messages"
SET "status" = 'completed'
WHERE "status" IS NULL;

-- 6) (اختياري) لا نخمّن conversation_id لمهام generation_jobs القديمة من meta
--    إلا إذا وُجد مفتاح صريح لاحقًا. تُترك NULL عمدًا.
