# 03 — الاختبار الوظيفي | PRE-LAUNCH-AUDIT-001

## ملخص النتائج

| الرحلة | النتيجة | أدلة |
|---|---|---|
| زائر جديد — صفحات عامة | نجاح جزئي (حي) | curl 200 على /, pricing, privacy, terms, sign-in |
| تسجيل Google OAuth | لم يُنفَّذ حيًا | يحتاج متصفح + حساب اختبار؛ فُحصت الشيفرة (safe next + callbacks) |
| مستخدم عائد / جلسات | شيفرة + اختبارات محرك | schema ensure + ownership tests |
| غير مخوّل → admin | شيفرة | admin layout + requirePagePermission |
| فشل / انقطاع | شيفرة | رسائل عربية في مسارات AI؛ 402 عند نفاد الحصّة |

## تفاصيل

### رحلة 1 — زائر جديد

| الخطوة | متوقع | فعلي | الحالة |
|---|---|---|---|
| فتح الرئيسية | 200 + هوية حكيم | 200 على hakeemsa.com | نجح |
| التسعير | وضوح الأسعار/التجربة | 200؛ CTA «قريبًا» بلا Moyasar | نجح بشروط |
| إنشاء حساب | Clerk/Google | صفحة sign-up/sign-in 200 | لم يُنشأ حساب اختبار من الوكيل |
| لوحة التحكم | حماية | middleware يحمي `/dashboard` | شيفرة |
| سياسة/شروط | موجودة | 200 | نجح |

### رحلة 2 — Google

| الفحص | النتيجة |
|---|---|
| `/api/auth/google` + callback موجودان | نعم |
| `safeDashboardNext` يمنع open redirect | اختبار `test-pre-launch-security` |
| health: `googleOAuth: configured` | نعم على الإنتاج |
| وميض فشل بين Google واللوحة | لم يُشاهد حيًا في هذه الجلسة |

### رحلة 3 — عائد

| الفحص | النتيجة |
|---|---|
| محرك الجلسات / conversations schema | health: `conversationSession: ready` |
| عزل ملكية الجلسات/القضايا/المرفقات | `test-ownership` 42/42 |

### رحلة 4 — غير مخوّل

| الفحص | النتيجة |
|---|---|
| middleware يحمي `/admin` | نعم |
| layout admin يرفض غير الأدمن | أُضيف في الفرع |
| APIs admin عبر `requireApiPermission` | نعم |
| guest SYSTEM_ADMIN | **أُغلق** → TRAINEE + إنتاج يفرض auth |

### رحلة 5 — فشل

| السيناريو | السلوك المتوقع في الشيفرة |
|---|---|
| نفاد الحصّة | 402 + رسالة عربية |
| فشل مزود AI | رسائل offline/تعذّر؛ لا خصم إن لم يكتمل النجاح |
| مرفق كبير | رفض > ATTACHMENT_MAX_BYTES |
| webhook مزيف مع دفع حي | 401 إن نقص السر |

## اختبارات آلية منفَّذة

| أمر | النتيجة |
|---|---|
| `npm run typecheck` | نجاح |
| `npm run build` | نجاح |
| `npm run lint` | تحذيرات a11y/hooks فقط |
| `npx tsx scripts/test-pre-launch-security.ts` | OK |
| `npx tsx scripts/test-admin-ops-musthaves.ts` | OK |
| `npx tsx scripts/test-quota.ts` | 5/5 |
| `npx tsx scripts/test-ownership.ts` | 42/42 |
| `npm run qa:security` | نجاح |
| `npx tsx scripts/test-pdpl-redaction.ts` | 7/7 |
| `test-oauth-only-signin` / `test-auth-continue` / `test-ux-postlogin-p0` / `test-owner-emergency` | OK |

## ما تعذّر

- تسجيل دخول تفاعلي Google من بيئة الوكيل (لا متصفح مستخدم).
- رفع ملف فعلي ضد التخزين السحابي.
- استعادة نسخة احتياطية Neon.
