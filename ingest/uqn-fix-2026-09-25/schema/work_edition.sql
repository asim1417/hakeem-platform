-- فرع تجريبي فقط. لا يُشغَّل على الإنتاج قبل موافقة المالك.
-- يوسّع قيد حالة التحقق ليسمح بوسم السجل المخلوط، ويضيف جدول النوافذ الزمنية.
-- لا UPDATE ولا DELETE على صفوف المواد أو الأنظمة.

ALTER TABLE verification DROP CONSTRAINT IF EXISTS verification_verified_status_check;
ALTER TABLE verification ADD CONSTRAINT verification_verified_status_check CHECK ("verified_status" IN (
  'ساري',
  'صادر لم يسرِ بعد',
  'ملغى',
  'مستبدل',
  'ملغى مع بقاء أحكام محددة مؤقتًا',
  'إلغاء جزئي معلّق على شرط',
  'ملغاة',
  'مضافة',
  'سجل مخلوط — لا يُعرض'
));

CREATE TABLE IF NOT EXISTS work_edition (
  id text PRIMARY KEY,
  mixed_system_id text NOT NULL,
  edition_system_id text NOT NULL,
  instrument text,
  role text NOT NULL CHECK (role IN ('old', 'new')),
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS work_edition_pair ON work_edition (mixed_system_id, edition_system_id);
