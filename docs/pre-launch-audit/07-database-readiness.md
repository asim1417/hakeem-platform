# 07 — جاهزية قاعدة البيانات | PRE-LAUNCH-AUDIT-001

## الحالة المرصودة

| بند | الدليل |
|---|---|
| Prisma schema | `prisma/schema.prisma` موجود |
| Migrations | مجلد `prisma/migrations/` (~22) — **لا** `migration_lock.toml` |
| إنتاج حي | `/api/health` → `database: up` |
| محرك الجلسات | `conversationSession: ready` |
| أعمدة الحصّة | خارج Prisma User عمدًا؛ migrations SQL منفصلة للحصّة/النقاط |

## الفهارس والعلاقات

- علاقات القضايا/المرفقات/المستخدمين مع فلاتر ملكية في `lib/modules/auth/ownership.ts`.
- اختبار عزل: `scripts/test-ownership.ts` → 42 نجاح.

## النسخ الاحتياطي والاستعادة

| بند | الحالة |
|---|---|
| وجود سياسة نسخ Neon/مزود | **لم يُثبت من هذه البيئة** |
| اختبار استعادة فعلي | **لم يُنفَّذ** — يحتاج Ops |
| Rollback migrations | يتطلب خطة يدوية (انظر `09-rollback-plan.md`) |

## مخاطر

| ID | الوصف | الخطورة | الحالة |
|---|---|---|---|
| DB-01 | غياب migration_lock.toml | P2 | مؤجلة / قرار هندسي |
| DB-02 | أعمدة حصّة خارج Prisma | P1 إن نُسيت على بيئة جديدة | شرط إطلاق: تطبيق SQL |
| DB-03 | لا إثبات backup/restore | P0 تشغيلي | يحتاج قرار Ops قبل GO المطلق |
| DB-04 | attach بلا userId عمود | P2 | ملكية عبر metadata/case |

## عزل المستخدمين

بعد الإصلاحات: لا guest SYSTEM_ADMIN في الإنتاج. مسارات الحالات/المرفقات/المحاكاة تفحص `ownerId`/`uploadedBy` مع تجاوز أدمن صريح فقط.
