# مهاجرة محرك الجلسات — مقترح مقسّم (لم يُنفَّذ)

الترتيب الإلزامي:

1. `01_add_nullable_columns.sql` — إضافة أعمدة nullable فقط
2. `02_backfill.sql` — ترحيل البيانات القديمة
3. *(تحديث التطبيق — خارج SQL؛ مراحل لاحقة بعد إذن التنفيذ)*
4. `04_constraints_and_not_null.sql` — القيود وNOT NULL وإزالة DEFAULT

قبل الخطوة 4: تشغيل `00_preflight_verify_fks.sql` والتحقق من النتائج.
