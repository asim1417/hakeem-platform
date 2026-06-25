# المرحلة ٦ (تصميم فقط) — نموذج ArticleVersion للنسخ الزمنية للتشريع

> **حالة:** تصميم + طلب موافقة فقط. **لا migration ولا تعديل مخطط** قبل إقرارك.
> هذا المستند يعرض النموذج المقترح وقراره ليُعتمد لاحقًا في جولة منفصلة.

## المشكلة

اليوم لا يمكن استرجاع «نصّ المادة كما كان نافذًا في تاريخ معيّن» — وهو مطلب
قانوني جوهري (الاحتجاج بالنصّ الساري وقت الواقعة). لدينا `ArticleAmendment`
كبذرة لتتبّع وقائع التعديل، و`LegalArticle.effectiveFrom`، لكن لا نموذج «نسخة»
كامل يحمل **نصّ كل إصدار** بمدى زمني صريح (من/إلى).

معيار Akoma Ntoso/LegalDocML يميّز:
- **Work** (العمل التشريعي عبر الزمن) = `LegalSystem` + `LegalArticle` (الهوية الثابتة).
- **Expression** (التعبير في لحظة/نسخة) = ما يمثّله `ArticleVersion` المقترح.
- **Manifestation** (التجسيد/الصياغة) = النصّ المخزّن.

## الفرق عن ArticleAmendment القائم

| | `ArticleAmendment` (قائم) | `ArticleVersion` (مقترح) |
|---|---|---|
| يمثّل | **واقعة** تعديل (حدث) | **حالة** النصّ في مدى زمني (نسخة) |
| النصّ | previousText/newText (لقطة الحدث) | versionText (النصّ النافذ الكامل لتلك النسخة) |
| الزمن | effectiveFrom (نقطة) | effectiveFrom **+** effectiveTo (مدى) |
| الاستعلام | «ما الذي تغيّر؟» | «ما النصّ الساري بتاريخ X؟» |

النموذجان متكاملان لا متعارضان: التعديل يصف الحدث، والنسخة تصف ما يُحتجّ به.

## النموذج المقترح (Prisma — للعرض، غير مُطبَّق)

```prisma
model ArticleVersion {
  id            String        @id @default(cuid())
  articleId     String        @map("article_id")
  article       LegalArticle  @relation("ArticleVersions", fields: [articleId], references: [id])

  versionText   String        @map("version_text")   // النصّ الكامل النافذ في هذه النسخة (لا يُعدّل بعد الإنشاء)
  effectiveFrom DateTime?     @map("effective_from")  // بداية سريان النسخة
  effectiveTo   DateTime?     @map("effective_to")    // نهاية سريانها (null = النسخة الحالية النافذة)
  royalDecree   String?       @map("royal_decree")    // أداة الإصدار/التعديل المُنشئة لهذه النسخة
  hijriDate     String?       @map("hijri_date")      // التاريخ الهجري كما ورد
  supersededById String?      @map("superseded_by")   // النسخة التي ألغت هذه (سلسلة الخلافة)
  supersededBy  ArticleVersion?  @relation("VersionChain", fields: [supersededById], references: [id])
  supersedes    ArticleVersion[] @relation("VersionChain")
  source        String        @default("manual")      // manual | extractor | import
  createdAt     DateTime      @default(now()) @map("created_at")

  @@index([articleId, effectiveFrom])
  @@index([effectiveTo])     // تسريع «النسخة النافذة حاليًا» (effectiveTo IS NULL)
  @@map("article_versions")
}

// على LegalArticle يُضاف لاحقًا (عند الإقرار):
//   versions ArticleVersion[] @relation("ArticleVersions")
```

## قواعد السلامة الزمنية (تُطبَّق وقت الإقرار)

1. **عدم التداخل:** لا تتقاطع مدد النسخ لنفس المادة (effectiveFrom..effectiveTo متتالية).
2. **نسخة نافذة واحدة:** صفّ واحد كحدّ أقصى لكل مادة بـ`effectiveTo = NULL`.
3. **عدم التعديل:** `versionText` ثابت بعد الإنشاء (تصحيح = نسخة جديدة، لا تحرير).
4. **اشتقاق لا إزاحة:** النسخة الأولى تُشتقّ من `LegalArticle.content` الحالي
   (effectiveFrom = effectiveFrom للمادة، effectiveTo = null) دون لمس عمود content.

## استعلام «النصّ الساري بتاريخ X» (مرجعي)

```sql
SELECT version_text
FROM article_versions
WHERE article_id = $1
  AND (effective_from IS NULL OR effective_from <= $2)
  AND (effective_to   IS NULL OR effective_to   >  $2)
ORDER BY effective_from DESC NULLS LAST
LIMIT 1;
```

## خطة الترحيل (عند الإقرار — جولة لاحقة)

1. migration إضافية (ADD TABLE فقط، IF NOT EXISTS) — لا حذف، rollback = DROP TABLE.
2. سكربت اشتقاق idempotent: لكل مادة أنشئ نسخة أولى من `content` الحالي
   (effectiveTo=null) إن لم توجد لها نسخ.
3. ربط `ArticleAmendment` ⇄ `ArticleVersion` (كل واقعة تعديل تُنشئ نسخة وتُغلق السابقة).
4. لا تغيير على قراءة `LegalArticle.content` (يبقى يمثّل النسخة النافذة) — توافق خلفي.

## القرار المطلوب منك

- [ ] الموافقة على النموذج كما هو، أو تعديله (أسماء الحقول/القواعد).
- [ ] إقرار تنفيذه في **جولة منفصلة** (migration + اشتقاق) — لا يُنفَّذ الآن.
