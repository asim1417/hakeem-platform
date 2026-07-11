# 02 — مراجعة مخطّط قاعدة البيانات

المصدر: `prisma/schema.prisma` (947 سطرًا، 49 نموذجًا). `prisma validate` = **صالح** (بعد ضبط `DATABASE_URL` وهميًّا).

## الجداول الجوهرية — تحليل
### `legal_systems` (103-120)
PK `id` (cuid) · فريد: `name`, `code`, `eli_slug` · فهارس: `domain`, `sort_order`.
**مخاطر:** `name` نصّ فريد → تباين إملائي ينشئ نظامين لنفس القانون (انظر DATA duplicate). `classification`/`code`/`eli_slug`
كلّها اختيارية.

### `legal_articles` (122-151) — **الأهمّ**
PK `id` · **فريد `@@unique([lawName, articleNumber])`** · `legalSystemId` **اختياري** (nullable) · فهارس `lawName`, `legalSystemId`.
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| SCHEMA-001 | High | **هويّة المادة بالاسم النصّي + الرقم، لا بـsystemId.** الفريد على `(lawName, articleNumber)` يجعل تباين اسم النظام ينشئ ازدواجًا، ولا يربط الهويّة بالنظام | schema:147 |
| SCHEMA-002 | High | **`legalSystemId` nullable بلا onDelete صريح** → مواد يتيمة من نظام (لا نظام) ممكنة | schema:124-125 |
| SCHEMA-003 | High | **لا أعمدة مصدر/إسناد:** لا `source`, `source_url`, `content_hash`, `verified_at`, `verification_status` | schema:122-151 |
| SCHEMA-004 | Medium | **`status` نصّ حرّ** (افتراضي "سارية") لا enum → قيم غير منضبطة محتملة | schema:135 |
| SCHEMA-005 | Medium | **`embedding Json?` مصدر ثانٍ** (وإن `@deprecated`) بجانب جدول pgvector | schema:135-139 |

### `article_versions` (183-201) — النسخ الزمنية
PK · فهارس `(article_id, effective_from)`, `effective_to` · FK `article_id`, `superseded_by`.
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| VERSION-001 | **Critical** | **لا قيد فريد جزئي** `UNIQUE(article_id) WHERE effective_to IS NULL` ولا قيد استبعاد على التداخل → «نسختان نافذتان» ممكن على مستوى القاعدة | مهاجرة `20260625160000` (PK+فهرسان+FK فقط) |
| VERSION-002 | High | التعليق يزعم «نسخة نافذة واحدة» لكنه **يُفرَض بالسكربت لا بالقاعدة** | schema:182؛ `derive-article-versions.ts` |

### `judicial_cases` (203-235) — **نموذج مصدر جيّد (قدوة)**
`sourceId @unique`, `sourceLink`, `source`, تواريخ نصّية ومُحلّلة. فهارس وافية. **هذا ما ينقص `legal_articles`.**

### `legal_article_case_links` (237-257)
فريد `(articleId, caseId, citedText)` · **مخاطرة:** حين `citedText` يختلف/NULL يتكرّر (article,case) منطقيًّا.

### `legal_relations` (518-533) — Knowledge Graph متعدّد الأشكال
| الرمز | الخطورة | المشكلة | الدليل |
|---|---|---|---|
| SCHEMA-006 | High | **بلا مفاتيح أجنبية** (بالتصميم) → علاقات ليتيمة ممكنة (تشير لمادة/حكم محذوف)، ولا قيد فريد يمنع تكرار العلاقة | schema:514-533 |

### `embeddings` (538-549)
فريد `(ownerType, ownerId)` جيّد · `model` نصّ افتراضي · **لا `content_hash` ولا ربط بـ`updatedAt`** → لا كشف تقادم.

## القيود — ملخّص
| القيد | الحالة |
|---|---|
| Primary Keys | ✅ على كل الجداول (cuid/uuid) |
| Foreign Keys | ✅ عمومًا — **عدا** `legal_relations` (بالتصميم) و`fiqh_issue_links.article_id` (مرجع منطقي) |
| Unique / Composite Unique | ✅ حاضرة (`lawName+articleNumber`, `sourceId`, `ownerType+ownerId`…) |
| **Partial Unique (نسخة نافذة)** | ❌ **غائب (VERSION-001)** |
| Check Constraints | ❌ لا قيود تحقّق (status/strength/confidence بلا نطاق مفروض) |
| Not Null | ⚠️ `legalSystemId`, `effectiveFrom`, معظم حقول الإسناد اختيارية |
| Indexes | ✅ جيّدة عمومًا · **لكن فهرس ANN للمتجهات و`search_norm` GIN غائبان من المهاجرات** (سكربتات يدوية) |
| Cascade / onDelete | ⚠️ محدود: Cascade على `graph_edges`, `fiqh_issue_links`, `chat_messages` فقط |

## الحقول المفقودة (فجوات تصميم لا بيانات)
`legal_articles`: `source`, `source_url`, `content_hash`, `indexed_at`, `verification_status`, `version_number`,
`amending_instrument`, `issue_date`, `publish_date`. (استعلام رصدها: `audit/missing-required-fields.sql ②`.)

## ما تعذّر فحصه
مطابقة المخطّط للقاعدة الحيّة (drift)، وجود الفهارس اليدوية فعليًّا على Neon — انظر `audit/search-readiness.sql ⑤⑥`.
