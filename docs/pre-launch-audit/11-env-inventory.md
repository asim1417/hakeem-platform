# جرد متغيرات البيئة | PRE-LAUNCH-AUDIT-001

> الأسماء فقط — لا قيم.

## ضرورية للبناء

| المتغير | ملاحظة |
|---|---|
| (لا أسرار إلزامية للبناء المحلي) | `prisma generate` + Next build نجحا بلا مفاتيح |
| `NEXT_PUBLIC_SITE_URL` | يُحسم وقت البناء للـ canonical |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | إن استُخدم Clerk في البناء/التضمين |

## ضرورية للتشغيل (إنتاج)

| المتغير | ملاحظة |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `AUTH_SECRET` أو `NEXTAUTH_SECRET` | إلزامي في الإنتاج بعد الإصلاح |
| `CLERK_SECRET_KEY` + publishable | إن Clerk هو المدخل |
| `ANTHROPIC_API_KEY` | توليد قانوني |
| `AI_PROVIDER` | يُفضّل `anthropic` |

## خاصة بالإنتاج / الإطلاق

| المتغير | ملاحظة |
|---|---|
| `REQUIRE_AUTH` | مفروض أصلًا في الإنتاج؛ يُفضّل `true` صراحة |
| `ALLOW_UNAUTHENTICATED_GUEST` | يجب أن يبقى فارغًا/false |
| `OAUTH_ADMIN_EMAILS` | تفويض أدمن |
| `OWNER_BOOTSTRAP_PASSWORD` | إنشاء أول مرة فقط |
| `OWNER_FORCE_PASSWORD_RESET` | طوارئ فقط |
| `OWNER_EMERGENCY_*` | مغلق افتراضيًا |
| `MOYASAR_*` | إن فُعّل الدفع — السر الثلاثي مطلوب |
| `CLERK_WEBHOOK_SECRET` | مزامنة مستخدمين |
| `FREE_QUOTA` / `WARN_AT` | الحصّة |

## اختيارية

| المتغير | ملاحظة |
|---|---|
| `GOOGLE_CLIENT_ID/SECRET` | OAuth أول طرف / Drive |
| `AZURE_AD_*` | Microsoft SSO |
| `AZURE_STORAGE_*` / SharePoint | مرفقات |
| `OPENSEARCH_*` | بحث لاحق |
| `RESEND_*` / `TWILIO_*` | بريد/OTP |
| `GEMINI_API_KEY` | OCR اختياري |
| `EMBEDDING_*` | بحث دلالي |
| `DOC_TOOL_*` | أداة وثائق |
| `ATTACHMENT_MAX_BYTES` | حد الرفع |
| `DOCUMENT_DIRECT_URL_*` | استيراد URL (معطّل افتراضيًا) |

## مفقودة / يجب التحقق على Vercel قبل الإطلاق

- إثبات وجود `AUTH_SECRET` قوي
- إثبات `ANTHROPIC_API_KEY` (health لا يكشف المفتاح)
- إثبات عدم `ALLOW_UNAUTHENTICATED_GUEST`
- إن Moyasar سيُفعّل: الثلاثة معًا

## قديمة / غير مستخدمة في الشيفرة

| المتغير | ملاحظة |
|---|---|
| `DISABLE_AUTH` | موثّق قديمًا — **لا يُقرأ** في التطبيق |

## تصنيف تعارض توثيقي أُصلح

- `.env.example` كان يدّعي Clerk فقط وأن الزائر TRAINEE وأن DISABLE_AUTH يُتجاهل في الإنتاج — حُدّث ليعكس السلوك الفعلي بعد الإصلاح.
