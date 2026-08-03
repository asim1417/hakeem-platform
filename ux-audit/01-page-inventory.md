# جرد الصفحات والمسارات

**المصدر:** فحص شجرة `app/` فعليًّا. **الإجمالي:** 94 صفحة · 158 مسار API · 10 layouts.
**الوصول:** 🌐 عامّة (اختُبِرت حيًّا) · 🔒 محميّة (تحليل مصدريّ فقط — محجوبة عن الاختبار الحيّ).

## عامّة 🌐 (اختُبِرت حيًّا — 200، صفر أخطاء Console)
| المسار | الحالة | ملاحظة |
|---|---|---|
| `/` الرئيسيّة | 🟢 200 | هيرو + صندوق سؤال + بطاقات + ثقة |
| `/login` | 🟢 200 | يعتمد كليًّا على Clerk (UX-001) |
| `/register` | 🟢 200 | يعتمد كليًّا على Clerk (UX-001) |
| `/pricing` | 🟢 200 | «أسعار معلنة — بلا غموض، ٢٠ استخدامًا مجانيًا» |
| `/privacy` | 🟢 200 | PDPL، 8 أقسام H2 |
| `/terms` | 🟢 200 | 8 أقسام H2 |
| `/sign-in/[[...]]`, `/sign-up/[[...]]`, `/sso-callback`, `/auth/continue` | 🔴 محجوب | مسارات Clerk — تحتاج اختبار حيّ |
| `/legal`, `/legal/[slug]`, `/legal/[slug]/[article]`, `/p/[slug]` | 🟡 | صفحات محتوى عامّة — لم تُلتقَط بعد |
| `/api-docs`, `/developers`, `/doc-tool`, `/documents*` | 🟡 | أسطح عامّة إضافيّة |

## محميّة 🔒 (تحتاج DB + مصادقة — تحليل مصدريّ فقط)

### لوحة العميل `/dashboard/*` (الجوهر)
`/dashboard` · `/ask` (+`/ask/c/[id]`) · `/review` (+`/[id]`) · `/judicial-assistant` (+`/cases`, `/cases/[id]`, `/cases/[id]/audit`) · `/judicial-simulation` · `/simulations` (+`[id]/appeal|cassation|reconsideration`) · `/legal-search` · `/legal-core` (+ 14 مسارًا فرعيًّا: articles، judgments، principles، citations، systems، search، quality…) · `/legal-chat` · `/legal-rag` · `/legal-agent` · `/case-analysis` · `/cases` · `/consultations` · `/knowledge-graph` · `/agents` (+`[agentId]`) · `/files` · `/attachments` · `/training` · `/library` · `/billing` · `/subscribe` · `/lab`

### الإدارة `/admin/*`
`/admin` · `ai` · `api-keys` · `audit` · `billing` · `governance` (جديد) · `inbox` · `jobs` · `owner` · `reports` · `roles` · `services` · `settings` · `site` · `usage` (+`[userId]`, `week`) · `users`

### أخرى محميّة
`/audit-logs` · `/onboarding` · `/settings` (→ redirect `/admin`) · `/judge` · `/internal/owner-gate` · `/consultations` · `/cases` · `/search` · `/simulation` · `/training` · `/library`

## ملاحظات بنيويّة (من الجرد)
1. **تكرار أسطح البحث/السؤال:** `/dashboard/ask`, `/legal-chat`, `/legal-rag`, `/legal-search`, `/legal-core/search`, `/search` — **ستّة مداخل** لمهمّة متقاربة (UX-009). يلزم توحيد/توضيح.
2. **`/settings` يعيد التوجيه إلى `/admin`** — قد يُربك مستخدمًا غير مدير يبحث عن إعداداته الشخصيّة.
3. **مسارات مكرّرة على مستويين:** `/library` و`/dashboard/library`، `/consultations` و`/dashboard/consultations`، `/training` و`/dashboard/training`، `/cases` و`/dashboard/cases` — يلزم توضيح أيّها الرسميّ.
4. **`/dashboard/lab`** سطح تجريبيّ — تأكّد من إخفائه عن الإنتاج العامّ.
