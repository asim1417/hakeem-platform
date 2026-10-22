-- HKM-028 (18/10/2026): حكما «shifted» (نص الهيئة تحت رقم مجاور في حكيم) و«version_mismatch» (نسخة أخرى من النظام).
-- طُبّق على الإنتاج 18/10/2026. الصفوف القائمة لم تُغيَّر.
ALTER TABLE boe.diff DROP CONSTRAINT diff_verdict_check;
ALTER TABLE boe.diff ADD CONSTRAINT diff_verdict_check CHECK (verdict IN ('identical','whitespace_only','normalization_only','wording','missing_in_hakeem','missing_in_boe','unnumbered_unit','shifted','version_mismatch'));
