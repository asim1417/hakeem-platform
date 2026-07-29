# 04 — المراجعة الأمنية | PRE-LAUNCH-AUDIT-001

> لا أسرار أو قيم بيئة في هذا الملف.

## جدول المشكلات

| ID | الصفحة/الخدمة | وصف المشكلة | السبب الجذري | الخطورة | أثرها | الإصلاح | الاختبار | الحالة |
|---|---|---|---|---|---|---|---|---|
| SEC-001 | auth/session | زائر بلا دخول بدور SYSTEM_ADMIN | `REQUIRE_AUTH` فارغ + `getGuestUser` admin | P0 | سيطرة كاملة على APIs | فرض auth في الإنتاج؛ زائر TRAINEE | test-pre-launch-security | تم الاختبار |
| SEC-002 | ensure-owner | إعادة ضبط كلمة المالك لكل إقلاع | upsert يكتب passwordHash دائمًا | P0 | كلمة معروفة في المستودع تُفرض | لا reset إلا بـ FORCE + bootstrap | static + owner-emergency | تم الاختبار |
| SEC-003 | owner-login | سقوط لكلمة ثابتة | مقارنة نصية مع OWNER_DEFAULT | P0 | دخول بلا hash | حذف fallback | static assert | تم الاختبار |
| SEC-004 | LoginForm | تعبئة كلمة المرور في الواجهة | setPassword ثابت | P1 | تسريب معرفة كلمة | إزالة التعبئة | static assert | تم الاختبار |
| SEC-005 | middleware | أي قيمة `hakeem_session` تتجاوز Clerk protect | فحص الوجود فقط | P1 | وصول صفحات محمية بلا جلسة صالحة (حتى redirect لاحقًا) | تحقق HMAC في edge | test-pre-launch-security | تم الاختبار |
| SEC-006 | billing webhook | تفعيل اشتراك بلا سر عند غياب webhook secret | soft-auth | P0 | اشتراك مجاني مزيف | رفض إن Moyasar حي بلا سر | test-admin-ops-musthaves | تم الاختبار |
| SEC-007 | quota | سقوط مفتوح عند غياب الأعمدة | catch → allowed | P0 | استخدام بلا حد | fail-closed في الإنتاج + حد ذري | test-quota + مراجعة | تم الاختبار |
| SEC-008 | legal-chat / JA ask | بلا بوابة حصّة | لم تُربط gateAdvancedUse | P1 | تكلفة AI بلا قيد | ربط gate/settle | static assert | تم الاختبار |
| SEC-009 | attachments | بلا حد حجم | POST بلا max | P1 | DoS تخزين | ATTACHMENT_MAX_BYTES | مراجعة شيفرة | تم الإصلاح |
| SEC-010 | admin layout | لا تحقق دور على المستوى | ClerkRoot فقط | P1 | اعتماد على الصفحات | requireUser + صلاحية | مراجعة | تم الإصلاح |
| SEC-011 | PDPL AI | بعض المسارات ترسل نصًا خامًا | sanitize غير مركزي | P1 | تسريب PII للمزوّد | sanitize في callCentralProvider + JA | test-pdpl | تم الإصلاح جزئيًا |
| SEC-012 | AUTH_SECRET | سر ثابت عند تعطيل auth | fallback تطوير | P0→مخفَّف | تزوير جلسة | رمي خطأ في الإنتاج دائمًا | مراجعة | تم الإصلاح |
| SEC-013 | docs/.env.example | توثيق يناقض الشيفرة | DISABLE_AUTH/Clerk-only | P2 | إعداد خاطئ | تحديث المثال | مراجعة | تم الإصلاح |
| SEC-014 | Team pricing | ادعاء مقاعد/مساحة غير موجودة | copy تسويقي | P1 | ادعاء كاذب | تخفيف الميزات | static assert | تم الإصلاح |
| SEC-015 | CSP unsafe-inline/eval | مرونة XSS | حاجة Next/Clerk/WASM | P2 | سطح هجوم أوسع | مؤجّل (nonces لاحقًا) | headers حية | مؤجلة بقرار |

## ترويسات الأمان (حي على vercel.app)

موجودة: CSP، HSTS، X-Content-Type-Options، Referrer-Policy، Permissions-Policy، X-Frame-Options.

## مصفوفة صلاحيات (مختصرة)

| العملية | زائر | مستخدم | مشرف SYSTEM_ADMIN | سوبر |
|---|---:|---:|---:|---:|
| محتوى عام | ✓ | ✓ | ✓ | ✓ |
| إنشاء جلسة Ask | ✗* | ✓+حصّة | ✓ | ✓ |
| قراءة جلساته | ✗ | ✓ | ✓ | ✓ |
| قراءة جلسات الغير | ✗ | ✗ | ✓ | ✓ |
| إدارة مستخدمين | ✗ | ✗ | ✓ | ✓ |
| لوحة سوبر (jobs/billing/ai) | ✗ | ✗ | ✗ | ✓ |
| تعديل محتوى قانوني إداري | ✗ | بحسب صلاحية | ✓ | ✓ |

\* في الإنتاج بعد الإصلاح: لا زائر مخوّل. في التطوير المحلي فقط مع guest TRAINEE.

## مخاطر متبقية

- تنقية PDPL ليست على كل استدعاء `streamWithConfig`/`completeWithConfig` المباشر.
- `/documents/app` مساحة عمل منفصلة بجلسة مجهولة — راجع سياسة المنتج.
- أسرار في لوحة settings DB يجب ألا تُسرب للعميل (مسار موجود للتشفير — راقب).
