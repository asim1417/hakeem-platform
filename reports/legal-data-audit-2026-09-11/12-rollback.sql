-- ═══════════════════════════════════════════════════════════════════
-- 12-rollback.sql — الرجوع عن الإصلاح.
-- شرط لازم: أن يكون 11-apply.sql قد أنشأ نسخة legal_articles_backup_20260911
-- قبل أي كتابة. لا تشغّل هذا الملف قبل التحقق من وجود النسخة.
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

-- ① تأكّد من وجود النسخة الاحتياطية وأنها مكتملة، وإلا أوقف كل شيء.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM legal_articles_backup_20260911;
  IF n < 700 THEN
    RAISE EXCEPTION 'النسخة الاحتياطية ناقصة أو غير موجودة (% صفًّا) — أُلغي الرجوع', n;
  END IF;
END $$;

-- ② أعد العنوان والنص والباب والحالة إلى ما كانت عليه قبل الإصلاح.
UPDATE legal_articles a
SET title   = b.title,
    content = b.content,
    chapter = b.chapter,
    status  = b.status,
    "updatedAt" = now()
FROM legal_articles_backup_20260911 b
WHERE a.id = b.id
  AND (a.title IS DISTINCT FROM b.title OR a.content IS DISTINCT FROM b.content);

-- ③ احذف أي صفوف أُضيفت بعد النسخة (مثل المادة 237 المستعادة).
DELETE FROM legal_articles a
WHERE a."lawName" = 'نظام المعاملات المدنية'
  AND NOT EXISTS (SELECT 1 FROM legal_articles_backup_20260911 b WHERE b.id = a.id);

-- ④ تحقّق قبل الاعتماد.
SELECT count(*) AS rows_after_rollback FROM legal_articles WHERE "lawName" = 'نظام المعاملات المدنية';

-- راجع الناتج، ثم COMMIT أو ROLLBACK يدويًا.
-- COMMIT;
ROLLBACK; -- الوضع الافتراضي: آمن. غيّره إلى COMMIT بعد التحقق.
