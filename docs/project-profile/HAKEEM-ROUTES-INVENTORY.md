# جرد صفحات ومسارات منصة حكيم

**المرجع:** `main@56c7a0e` — 31 يوليو 2026م.

## منهج العد

- جرى البحث عن ملفات الصفحات ومسارات Route في الكود الحالي عبر GitHub.
- تم توثيق **68 ملف صفحة** ظاهرًا في نتائج البحث.
- تم توثيق **145 ملف Route متميزًا على الأقل** من اتحاد الملفات التي تصدّر `GET` أو `POST` أو `PATCH`.
- الرقم 145 حد أدنى، لا رقم نهائي للنظام؛ قد توجد مسارات لا تستخدم هذه الصيغ أو لم تظهر ضمن حد نتائج البحث.
- لم يُختبر كل رابط في متصفح أو بيئة إنتاج في هذه الجولة.

## أولًا: الصفحات

### الدخول والهوية (6)

`/auth/continue` · `/internal/owner-gate` · `/login` · `/register` · `/sign-in/[[...sign-in]]` · `/sign-up/[[...sign-up]]`

**الحالة العامة:** صفحات عامة/توافقية، ثم تحويل إلى لوحة المستخدم. Clerk ومسار جلسة حكيم كلاهما موجودان.  
**الدليل:** `middleware.ts`، `app/sign-in/*`، `app/sign-up/*`، `app/auth/continue/page.tsx`.

### المكتبة العامة (5)

`/legal` · `/legal/[slug]` · `/legal/[slug]/[article]` · `/library` · `/search`

**الحالة العامة:** واجهات عامة أو قديمة لعرض الأنظمة والمواد والبحث. يجب فحص تفعيلها من بوابة صفحات الموقع قبل تسويقها.  
**الدليل:** `app/legal/*`، `app/library/page.tsx`، `app/search/page.tsx`.

### صفحات الإدارة (17)

`/admin` · `/admin/ai` · `/admin/api-keys` · `/admin/audit` · `/admin/billing` · `/admin/inbox` · `/admin/jobs` · `/admin/owner` · `/admin/reports` · `/admin/roles` · `/admin/services` · `/admin/settings` · `/admin/site` · `/admin/usage` · `/admin/usage/[userId]` · `/admin/usage/week` · `/admin/users`

**الحالة العامة:** [مثبت] مرتبطة بوحدات الإدارة وRBAC، مع ضرورة التحقق من صلاحية كل صفحة على الإنتاج.

### صفحات المستخدم (21)

`/dashboard` · `/dashboard/agents` · `/dashboard/agents/[agentId]` · `/dashboard/ask` · `/dashboard/attachments` · `/dashboard/billing` · `/dashboard/case-analysis` · `/dashboard/cases` · `/dashboard/consultations` · `/dashboard/files` · `/dashboard/knowledge-graph` · `/dashboard/lab` · `/dashboard/legal-agent` · `/dashboard/legal-chat` · `/dashboard/legal-core` · `/dashboard/legal-core/admin` · `/dashboard/legal-rag` · `/dashboard/library` · `/dashboard/simulations` · `/dashboard/subscribe` · `/dashboard/training`

**الحالة العامة:** محمية بالمصادقة وفق middleware، وتختلف الصلاحيات داخل الصفحات. بعض الصفحات أسطح متوازية أو قديمة مقارنة بتجربة Ask-first.

### صفحات عامة أو توافقية (16)

`/` · `/api-docs` · `/audit-logs` · `/cases` · `/consultations` · `/developers` · `/doc-tool` · `/judge` · `/onboarding` · `/p/[slug]` · `/pricing` · `/privacy` · `/settings` · `/simulation` · `/terms` · `/training`

**ملاحظات:**

- `/pricing` و`/privacy` و`/terms` صفحات عامة قابلة للتعطيل عبر إدارة الموقع.
- `/cases` و`/consultations` و`/judge` و`/simulation` و`/training` قد تكون مسارات توافقية أو سطوحًا أقدم؛ الوجهة الحديثة داخل `/dashboard`.
- `/audit-logs` و`/onboarding` محميان في middleware.
- `/p/[slug]` صفحة ديناميكية للمحتوى المدار.

### منصة الوثائق (3)

`/documents` · `/documents/app` · `/documents/tool`

**الحالة:** [مثبت] صفحة تعريف ومحطة فحص متقدمة وبحث سريع.

## ثانيًا: مسارات API وRoute

> طرق HTTP التفصيلية يجب أخذها من كل ملف `route.ts`. القائمة التالية تثبت وجود ملف المسار، لا نجاحه التشغيلي ولا إتاحته العامة.

### الإدارة (27)

- `/api/admin/ai-settings`
- `/api/admin/api-keys`
- `/api/admin/api-keys/[id]`
- `/api/admin/billing`
- `/api/admin/billing/subscription`
- `/api/admin/feature-toggles`
- `/api/admin/jobs`
- `/api/admin/jobs/[id]/cancel`
- `/api/admin/jobs/[id]/retry`
- `/api/admin/jobs/reap-stale`
- `/api/admin/legal-core/preambles`
- `/api/admin/legal-core/reindex`
- `/api/admin/overview`
- `/api/admin/roles`
- `/api/admin/settings`
- `/api/admin/site`
- `/api/admin/site/pages`
- `/api/admin/site/pages/[id]`
- `/api/admin/support`
- `/api/admin/support/[threadId]`
- `/api/admin/usage`
- `/api/admin/usage-credits`
- `/api/admin/usage/[userId]`
- `/api/admin/usage/export`
- `/api/admin/usage/week/export`
- `/api/admin/users`
- `/api/admin/users/[id]`

### الجلسات (3)

- `/api/conversations`
- `/api/conversations/[id]`
- `/api/conversations/[id]/messages`

### الذكاء والمحادثة (10)

- `/api/agents/[agentId]/chat`
- `/api/ai/agent-search`
- `/api/ai/consultation`
- `/api/case-analysis`
- `/api/legal-agent`
- `/api/legal-chat`
- `/api/legal-chat/conversations`
- `/api/legal-rag`
- `/api/mcp/[agentId]`
- `/api/original-hakeem/ai`

### الفوترة والحصص والإحالات (7)

- `/api/billing/checkout`
- `/api/billing/status`
- `/api/billing/webhook`
- `/api/credits`
- `/api/credits/engage`
- `/api/credits/spend`
- `/api/referrals`

### القضايا (2)

- `/api/cases`
- `/api/cases/[id]`

### المحاكاة (15)

- `/api/judicial-simulation`
- `/api/simulations`
- `/api/simulations/[id]`
- `/api/simulations/[id]/appeal`
- `/api/simulations/[id]/decisions`
- `/api/simulations/[id]/evidence`
- `/api/simulations/[id]/export`
- `/api/simulations/[id]/hearing-record`
- `/api/simulations/[id]/judge-turn`
- `/api/simulations/[id]/judgment`
- `/api/simulations/[id]/legal-basis`
- `/api/simulations/[id]/messages`
- `/api/simulations/[id]/settlement`
- `/api/simulations/[id]/strength-score`
- `/api/simulations/provider-status`

### المستخدم والدعم والتدريب (5)

- `/api/onboarding`
- `/api/profile/avatar`
- `/api/profile/essentials`
- `/api/support/thread`
- `/api/training/attempts`

### المصادقة والهوية (18)

- `/api/auth/callback/google`
- `/api/auth/callback/microsoft`
- `/api/auth/claim-clerk-return`
- `/api/auth/ensure-owner`
- `/api/auth/google`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/magic`
- `/api/auth/magic/consume`
- `/api/auth/me`
- `/api/auth/microsoft`
- `/api/auth/oauth/start`
- `/api/auth/owner-login`
- `/api/auth/owner-logout`
- `/api/auth/providers`
- `/api/auth/register`
- `/api/otp/phone`
- `/api/webhooks/clerk`

### المعاون القضائي (14)

- `/api/judicial-assistant/action`
- `/api/judicial-assistant/approve`
- `/api/judicial-assistant/ask`
- `/api/judicial-assistant/ask/stream`
- `/api/judicial-assistant/cases`
- `/api/judicial-assistant/cases/[caseId]`
- `/api/judicial-assistant/cases/[caseId]/attachments`
- `/api/judicial-assistant/cases/[caseId]/export`
- `/api/judicial-assistant/cases/[caseId]/extract-map`
- `/api/judicial-assistant/cases/[caseId]/run`
- `/api/judicial-assistant/cases/[caseId]/run/stream`
- `/api/judicial-assistant/draft`
- `/api/judicial-assistant/study`
- `/api/judicial-assistant/summary`

### النواة والبحث وواجهات القانون (21)

- `/api/embeddings/status`
- `/api/legal-core/article/[articleId]/intelligence`
- `/api/legal-core/bm25-search`
- `/api/legal-core/citations/analyze`
- `/api/legal-core/intelligence-summary`
- `/api/legal-core/principles/[id]`
- `/api/legal-core/search`
- `/api/legal-relations`
- `/api/legal-relations/article/[articleId]`
- `/api/legal-search`
- `/api/legal-search/suggest`
- `/api/legal/articles`
- `/api/legal/articles/[id]`
- `/api/legal/articles/[id]/fiqh`
- `/api/legal/articles/[id]/related`
- `/api/legal/search`
- `/api/legal/systems`
- `/api/legal/systems/[id]`
- `/api/turath/search`
- `/eli/[...slug]`
- `/llms.txt`

### الوثائق والملفات (17)

- `/api/annotations`
- `/api/attachments`
- `/api/attachments/[id]`
- `/api/attachments/[id]/download`
- `/api/attachments/import-url`
- `/api/attachments/inspect-url`
- `/api/doc-platform/cases`
- `/api/doc-platform/cases/[id]`
- `/api/doc-platform/drive/callback`
- `/api/doc-platform/drive/files`
- `/api/doc-platform/drive/import`
- `/api/doc-platform/drive/status`
- `/api/doc-tool`
- `/api/doc-tool/ocr`
- `/api/doc-tool/ocr/available`
- `/api/doc-tool/ocr/settings`
- `/api/folders`

### عامة وتشغيل (6)

- `/api/audit`
- `/api/health`
- `/api/jobs/[jobId]`
- `/api/openapi`
- `/api/original-hakeem/bug-report`
- `/api/original-hakeem/legal-search`

## ثالثًا: تصنيف الوصول

| الفئة | القاعدة العامة | ملاحظات |
|---|---|---|
| صفحات عامة | الصفحة الرئيسية والتسعير والسياسات والدخول | بعض الصفحات تخضع لبوابة إدارة الموقع |
| صفحات المستخدم | `/dashboard/*` | محمية في middleware ثم صلاحيات داخلية |
| صفحات الإدارة | `/admin/*` | تتطلب أدوار وصلاحيات إدارة |
| API داخلية | أغلب `/api/*` | `requireApiPermission` أو جلسة مستخدم أو كوكي مساحة عمل |
| API للمطورين | `/api/legal/*` | مفتاح `hk_` ونطاق وحد معدل |
| API عامة محدودة | health/openapi/llms/ELI وبعض المصادقة | لا يعني أنها بلا تحقق داخلي |

## رابعًا: مسارات تحتاج مراجعة قرار المنتج

1. الأسطح المتوازية: `/dashboard/ask`، `/dashboard/legal-chat`، `/dashboard/legal-rag`، `/dashboard/case-analysis`، `/dashboard/legal-agent`.
2. المسارات العامة/القديمة: `/judge`، `/simulation`، `/cases`، `/consultations`، `/training`، `/doc-tool`.
3. الفرق بين `/documents/*` ومنظومة `/api/attachments`.
4. الفرق بين `CaseFile` و`JudicialWorkCase`.
5. تحديد ما يجب أن يظهر للمستخدم العام وما يبقى مختبرًا أو إداريًا.

## خامسًا: المطلوب لإغلاق الجرد بنسبة 100%

- تشغيل أمر filesystem محلي مثل `find app -name page.tsx` و`find app -name route.ts` على checkout كامل.
- استخراج طرق HTTP آليًا من كل route.
- مطابقة كل صفحة بالقائمة الجانبية وFeature Flags وبوابة الموقع.
- اختبار جميع الروابط والطرق في بيئة Preview مصادق عليها.
- إخراج CSV آلي يحتوي: route، methods، permission، model، owner constraint، status code، test coverage.
