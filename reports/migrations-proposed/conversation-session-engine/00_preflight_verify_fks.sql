-- ============================================================================
-- فحص ما قبل إنشاء المفاتيح الأجنبية — تشغيل قراءة فقط.
-- لا يغيّر بيانات. يجب نجاح الفحص قبل 04_constraints_and_not_null.sql
-- ============================================================================

-- 1) وجود الجداول المستهدفة
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'chat_conversations',
    'chat_messages',
    'cases',
    'judicial_work_cases',
    'generation_jobs'
  )
ORDER BY 1;

-- 2) نوع معرّف CaseFile الفعلي (= جدول cases)
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'cases'
  AND column_name = 'id';
-- المتوقع من المخطط/الشيفرة: data_type = 'text' أو 'character varying'

-- 3) نوع معرّف JudicialWorkCase الفعلي
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'judicial_work_cases'
  AND column_name = 'id';
-- المتوقع من schema-ensure + Prisma: udt_name = 'uuid'

-- 4) نوع chat_conversations.id (للمقارنة مع generation_jobs.conversation_id)
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chat_conversations'
  AND column_name = 'id';

-- 5) أعمدة generation_jobs الحالية
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generation_jobs'
ORDER BY ordinal_position;

-- قواعد القرار:
-- - إن كان cases.id نصًا و judicial_work_cases.id UUID وطابقت أعمدة الربط المقترحة:
--     اسمح بـ FKs في الخطوة 4.
-- - إن اختلف النوع أو غاب الجدول: لا تُنشأ FK لذلك الجدول؛ أبقِ العمود بدون قيد
--   حتى تُصحَّح البيئة.
