# Production DB — Source of Truth (إغلاق التشخيص)

> وثيقة تشغيل رسمية. لا تُجرى أي **كتابة** على أي قاعدة بيانات حتى اكتمال **Runtime DB Alignment**.

## الإثبات (من Vercel Runtime endpoint)
- **Runtime provider:** Neon PostgreSQL — **dbName:** `neondb` — **region:** `us-east-1`
- `legal_systems = 489` · `legal_articles = 15,902` · `judicial_cases = 51,105`
- `legal_article_case_links = 29,705` · `legalArticleEmbeddingCount = 15,902`
- `users = 4` · `cases = 2` · `simulation_sessions = 3` · `simulation_judgments = 6` · `consultations = 3` · `attachments = 1`
- جدول `legal_relations` **مفقود** · جدول `embeddings` **مفقود**

## القرار (مصدر الحقيقة)
- **مصدر الحقيقة للإنتاج = Neon (`neondb`).** هي قاعدة الموقع الحيّ على Vercel.
- **Supabase `bnzicgymocelefeqiwig` ليست قاعدة الإنتاج.** كانت GitHub Actions تعمل عليها، وتحتوي:
  `legal_systems = 9` · `legal_articles = 1,981` · `judicial_cases = 0`.
- إذن **Vercel Runtime ≠ GitHub Actions DATABASE_URL** — قاعدتان مختلفتان.

## أين تُخزَّن البيانات (في Neon)
| المحتوى | الجدول في Neon |
|---|---|
| الأنظمة | `legal_systems` |
| المواد | `legal_articles` |
| الأحكام | `judicial_cases` |
| روابط الأحكام بالمواد | `legal_article_case_links` |

## المخاطر
- أي workflow/script كاتب يعمل على `DATABASE_URL` (سرّ GitHub) **يكتب في Supabase الصغيرة لا في Neon** — فيُفسد الاتساق أو يُنشئ بيانات في القاعدة الخطأ.
- البذر/الترحيل/التضمين/الرسم المعرفي التي شُغّلت سابقاً أصابت Supabase (B)، لا الإنتاج (Neon).
- فهرس BM25 و`LegalArticle.embedding` بُنيا على القاعدة الصغيرة (1,981)، فلا يطابقان Neon (15,902).

## القفل التشغيلي (مطبَّق)
- كل workflow كاتب صار يتطلّب input صريحاً:
  `CONFIRM_RUNTIME_DB_ALIGNMENT = NEON_RUNTIME_CONFIRMED` — وإلا يفشل مبكراً.
- الـworkflows المقفولة: `analyze-judgments`, `backfill-embeddings`, `migrate-judgments`, `seed-knowledge-graph`, `seed-legal-library`.
- **ممنوع أي كتابة DB حتى مواءمة `DATABASE_URL` (GitHub) مع قاعدة Runtime (Neon) عمداً.**

## الخطوة التالية (دون تنفيذ الآن)
1. حسم: هل توحَّد GitHub Actions على Neon (مصدر الحقيقة)؟
2. عند المواءمة: إعادة بناء BM25 + embeddings من **Neon** (15,902)، ثم رفع القفل بوعي.
