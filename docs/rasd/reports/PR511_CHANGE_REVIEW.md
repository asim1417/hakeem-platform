# جدول مراجعة ملفات PR #511 — تحقق تشغيلي

| الملف | سبب التعديل | ضروري؟ | يؤثر على وظائف حكيم الحالية؟ | الخطورة | نتيجة المراجعة |
|---|---|---|---|---|---|
| `lib/modules/rasd/**` | محرك الرصد كاملًا | نعم | لا مباشرة (خلف `RASD_ENABLED`) | متوسطة | مقبول مع فجوات SSRF/صلاحيات |
| `prisma/schema.prisma` | نماذج رصد + `AuditSubject.RASD` + علاقات اختيارية | نعم | عند تطبيق الهجرة فقط | متوسطة | إضافي؛ لا يحذف legal_* |
| `prisma/migrations/20260727120000_add_rasd_monitoring/migration.sql` | إنشاء جداول staging | نعم | عند deploy | متوسطة | مراجعة: IF NOT EXISTS / additive |
| `app/admin/rasd/**` | واجهة عربية | نعم | لا | منخفضة | gated بـ ADMIN_REPORTS_VIEW |
| `app/api/admin/rasd/**` | API إدارة | نعم | لا | متوسطة | auth موجود؛ مفاتيح RASD غير مستخدمة |
| `app/api/cron/rasd-weekly/route.ts` | نقطة cron | نعم | لا إن معطل | متوسطة | سر إلزامي؛ لا vercel cron مسجّل |
| `scripts/rasd/cli.ts` + tests | تشغيل/اختبار | نعم | لا | منخفضة | يعمل |
| `scripts/rasd/verify-apply-rollback-isolated.ts` | تحقق اعتماد/تراجع معزول | نعم للتحقق | لا | منخفضة | أُضيف في جولة التحقق |
| `components/admin/AdminNav.tsx` | رابط «رصد» | نعم | تنقّل إداري | منخفضة | OK |
| `components/AdminUsersManager.tsx` | تسميات RASD + تحويل نهايات أسطر | جزئيًا | عرض فقط | منخفضة | ليس تغيير منطق جوهري |
| `lib/modules/auth/role-permissions.ts` | إضافة RASD_* | نعم | يوسع المصفوفة | منخفضة | غير موصول للبوابات |
| `lib/modules/auth/role-admin.ts` | كتالوج التسميات | نعم | لا | منخفضة | OK |
| `.env.example` | توثيق أعلام | نعم | لا | منخفضة | OK |
| `.gitignore` | snapshots/reports | نعم | لا | منخفضة | OK (+ CRLF) |
| `package.json` | سكربتات npm | نعم | لا | منخفضة | OK |
| `data/rasd/fixtures/**` | عينات اختبار | نعم | لا | منخفضة | OK |
| `docs/rasd/**` | أدلة وتقارير تحقق | نعم | لا | منخفضة | OK |
| `rasd-recon-report.md` | استكشاف | نعم | لا | منخفضة | OK |

لا توجد تعديلات جوهرية خارج نطاق رصد سوى تسميات الصلاحيات في إدارة المستخدمين وتحويل نهايات الأسطر.
