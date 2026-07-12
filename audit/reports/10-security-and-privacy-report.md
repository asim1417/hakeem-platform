# 10 — تقرير الأمن والخصوصية

## الخلاصة: **أخطر مجال في التدقيق.** المصادقة معطّلة افتراضيًّا والزائر يُرفَع إلى `SYSTEM_ADMIN`، مع ثغرات IDOR
حقيقيّة على موارد المستخدمين وبلا نموذج تعدّد مستأجرين.

## النتائج الحرجة والعالية
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| SEC-001 | **Critical** | **المصادقة معطّلة افتراضيًّا:** `isAuthDisabled()` = true ما لم يُضبط `DISABLE_AUTH` صراحةً؛ والزائر يُنشأ بدور `SYSTEM_ADMIN`، و`canUser` يمرّر كل صلاحية للأدمن. `.env.example` يشحن `DISABLE_AUTH="true"` | `middleware.ts:5-8`; `auth/session.ts:19-38,110-111`; `rbac.ts:57`; `.env.example:16` |
| SEC-002 | **Critical** | **IDOR:** `GET /api/cases/[id]` بلا مصادقة وبلا فحص ملكيّة → قراءة أي ملفّ قضية (اسم/بريد المالك + مرفقات) | `app/api/cases/[id]/route.ts:6-22` |
| SEC-003 | **Critical** | **قائمة القضايا تُعيد قضايا الجميع** (لا فلتر `ownerId`) | `app/api/cases/route.ts:28-32` |
| SEC-006 | **Critical** | **كوكي جلسة قابل للتزوير:** سرّ HMAC احتياطي مكتوب حرفيًّا عند غياب `AUTH_SECRET` → أي شخص يزوّر جلسة لأي `userId/role` | `auth/session.ts:51-53,59-66` |
| SEC-004 | High | **IDOR:** `GET/PATCH /api/simulations/[id]` بلا فحص ملكيّة → قراءة/تعديل محاكاة مستخدم آخر | `app/api/simulations/[id]/route.ts:30-37,61-63` |
| SEC-005 | High | **IDOR:** مرفقات (قراءة/تنزيل/حذف) بلا فحص ملكيّة → تسريب وثائق عبر المستخدمين | `app/api/attachments/[id]/route.ts:13-16`; `download/route.ts:12-15` |
| SEC-007 | High | **PDPL:** `createConsultationDraft` يرسل `facts` الخام للمزوّد **بلا تعمية** — مسار الاستشارة/الوكيل يتجاوز `sanitizeForModel` | `ai/ai-gateway.ts:74`; `app/api/ai/consultation/route.ts:24-33`; `agent-search/route.ts:115` |

## المتوسّطة
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| SEC-008 | Medium | مزوّدو OpenAI/Gemini مُهيَّؤون → وقائع قضايا قد تخرج لهم (خرق «Claude حصريًّا» + PDPL) | `.env.example:19-32`; `ai/providers/*` |
| SEC-009 | Medium | **لا تشفير للبيانات الشخصية عند التخزين** (عدا `passwordHash` bcrypt-12): `name/email/facts/summary` نصّ صريح | schema؛ `admin/users/route.ts:38` |
| SEC-010 | Medium | **الوسيط (middleware) لا يحمي أي مسار API** — matcher يغطّي `/dashboard,/admin,/audit-logs` فقط؛ كل authz يعتمد حارس كل مسار | `middleware.ts:22-24` |
| SEC-011 | Low | `agent-search` بلا بوّابة صلاحية (getCurrentUser فقط) | `agent-search/route.ts:22-28` |

## مصفوفة صلاحيات (عيّنة)
| المسار | مصادقة؟ | فحص ملكيّة؟ | الدليل |
|---|---|---|---|
| GET /api/cases/[id] | **لا** | **لا** | cases/[id]:6-22 |
| GET /api/cases | صلاحية | **لا — يعيد الكل** | cases:28-32 |
| GET/PATCH /api/simulations/[id] | صلاحية | **لا** | simulations/[id]:30-63 |
| GET/DELETE /api/attachments/[id] | صلاحية | **لا** | attachments/[id]:13-37 |
| GET /api/folders | صلاحية | **نعم** `listFolders(user.id)` | folders:10-14 |
| GET /api/annotations | صلاحية | **نعم** `listAnnotations(user.id)` | annotations:10-18 |
| /api/legal/* (خارجي) | مفتاح **أو** جلسة حقيقيّة | بوّابة | gateway-auth:89-102 |
> كل صفوف «صلاحية» أعلاه يُشبعها زائر-الأدمن (SEC-001) في التهيئة الافتراضيّة.

## ضوابط سليمة (إيجابيّات)
- **بوّابة API الخارجيّة قويّة:** مفاتيح SHA-256 فقط، نطاقات، حدّ معدّل ذرّي، **ترفض صراحةً وضع «بلا تسجيل»** وتتطلّب جلسة موقّعة (`gateway-auth.ts:93-98`).
- **ترويسات أمنيّة جيّدة:** HSTS/‏nosniff/‏X-Frame/CSP (`next.config.mjs:31-42`) — لكن CSP `unsafe-inline/eval` (موقف XSS أضعف).
- **تعمية PDPL** تغطّي الهويّة/الآيبان/الجوّال (`redaction.ts:14-23`) — لكنها **غير مركزيّة** (SEC-007).

## تعدّد المستأجرين
**لا نموذج tenant/organization إطلاقًا؛** العزل يعتمد فلترة `userId` في كل استعلام — وهي **مفقودة** في المسارات
أعلاه (SEC-002..005). `DocWorkspace` يعتمد كوكي متصفّح مشترك بلا حساب.

## سجلّ التدقيق
يُسجَّل: تسجيل الدخول، إنشاء مستخدم/قضية، توليد/حظر استشارة، منع وصول، تنزيل/حذف مرفق. **لا يُسجَّل: القراءة/التعداد**
— أي **ثغرات IDOR القرائيّة لا تترك أثرًا**. وبعض استدعاءات `auditEvent` تبتلع الفشل بصمت.

## ما تعذّر فحصه
قيمة `DISABLE_AUTH`/`AUTH_SECRET` في بيئة الإنتاج (render/railway لم تُقرأ قيمها)؛ تشفير القاعدة (TDE) على مستوى Postgres.
> **هذا التقرير يوجب Go/No-Go = No-Go للإطلاق العام حتى إغلاق SEC-001..006.**
