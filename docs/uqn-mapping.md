# خريطة مطابقة حزمة أم القرى ← نموذج قاعدة أنظمة حكيم (المرحلة ٠)

**الدفعة:** uqn-2026-09-25 · **الحزمة:** 668 عملًا · 11,723 وحدة · 762 أثرًا · 15 إحلالًا.
**قاعدة الفحص:** نُفِّذت المرحلة ١ على **PostgreSQL 16 محليّ (staging معزول)** — لا Neon ولا إنتاج.

## أ) حالة النموذج المستهدف (نتيجة الجرد — قراءة فقط)

| الطبقة | ما يطلبه الأمر (§1/§4) | الواقع في PR #631 / فرع `aman/legal-db-update` | الواقع على الإنتاج (Neon / `main`) |
|---|---|---|---|
| العمل/التعبير | `legal_work` + `legal_expression` | **غير موجودة** | **غير موجودة** |
| الأثر | `legal_effect` (بحالة تطبيق) | **غير موجود** (يوجد `DocumentRelation` فقط) | **غير موجود** |
| الوحدات | `document_units` | ✅ `DocumentUnit` (+ `LegalDocument`) | **غير موجودة** |
| العلاقات | IMPLEMENTS/REPLACES/AMENDS/CITES | ✅ `DocumentRelation.relationType` | **غير موجودة** |
| سجل التشغيل | `IngestRun` | ✅ `IngestRun` | **غير موجود** |

**خلاصة حاسمة:** النموذج المستهدف الذي يفترضه الأمر (`legal_work`/`legal_expression`/`legal_effect`)
**غير موجود لا في الإنتاج ولا في فرع #631**. المتوفّر في #631 هو نموذج `LegalDocument`+`DocumentUnit`
(وثيقة + شجرة وحدات) بلا فصل عمل/تعبير وبلا جدول أثر مستقل. وقواعد اختبارات القسم (ب) في
`tests/invariants.sql` تستعلم صراحةً من `legal_work`/`legal_expression` — أي أنها مكتوبة لنموذجٍ لم يُبنَ بعد.

## ب) خريطة الحقول (حزمة ← النموذج)

### العمل (laws/regulations)
| حقل الحزمة | النموذج المطلوب | البديل المتاح (#631) | ملاحظة |
|---|---|---|---|
| `source_id` (uqn:NNNN) | مُعرّف مصدر (لا دائم) | `LegalDocument.sourceDocumentId`/`sourceGuid` | لا يُستخدم معرّفًا دائمًا (§4) |
| المعرّف الدائم `sa/law/1448/m-96` | `legal_work.permanent_id` | **فجوة** — لا حقل | يلزم حقل جديد |
| `title` | `legal_work.title` | `LegalSystem.name` / `LegalDocument` | — |
| `work_type` / `category` | `legal_work.work_type` | `LegalDocument.docType` (enum محدود) | enum لا يغطي كل الأنواع |
| `published_hijri`/`_gregorian` | `legal_expression` نشر | `LegalDocument.hijriDate`/`publishedAt` | — |
| `issuance.*` (مرسوم/قرار/تواريخ) | سند الإصدار | `LegalDocument.number` + `docType` | جزئي (قرار مجلس الوزراء منفصل) |
| `effective_clause` → `effective_from` | `legal_expression.effective_from` | `DocumentUnit.validFrom` | يُحسب (+مدة النفاذ) |
| `supersedes_note` | `legal_effect(REPLACE)` | `DocumentRelation(REPLACES)` | — |
| `parent_law_hint` | علاقة IMPLEMENTS | `DocumentRelation(IMPLEMENTS)` | للّوائح |
| `units[]` | `document_units` | ✅ `DocumentUnit` | تطابق جيّد (انظر أدناه) |
| `provenance` (source/retrieved/raw_sha) | مصدر لكل نص | `LegalDocument.sourceUrl`/`contentSha256` + `DocumentUnit.sourceUrl` | ✅ |

### الوحدة (unit)
| حقل الحزمة | `DocumentUnit` |
|---|---|
| `seq` | `ordinal` ✅ |
| `unit_type` (enacting_instrument/approval_instrument/preamble/article/clause/unstructured_body) | `unitType` (`DocUnitType`) — **توسعة enum مطلوبة** لتغطية approval_instrument/clause/unstructured_body |
| `number` | `number` ✅ |
| `label`/`heading` | `labelAr` ✅ |
| `chapter`/`section` | `path` (يُبنى) ✅ |
| `text` | `textRaw` ✅ (بلا مساس — قاعدة عدم السقوط) |
| `text_sha` | `contentSha256` على مستوى الوثيقة / يُخزَّن للوحدة | جزئي |
| `source_url` | `sourceUrl` ✅ |

### الأثر (legal_effects) — **فجوة رئيسية**
| حقل الحزمة | المطلوب `legal_effect` | البديل `DocumentRelation` | ملاحظة |
|---|---|---|---|
| `effect_type` (amend/insert/delete/repeal/replace/enact) | `legal_effect.effect_type` | `relationType` (enum مختلف/أضيق) | لا يغطي insert/delete/enact بدقّة |
| `operative_text` | `legal_effect.operative_text` | `DocumentRelation.evidenceQuote` | دلالة مختلفة |
| `status` (pending_review/confirmed/applied) | `legal_effect.status` | `reviewStatus` (needs_review فقط) | **فجوة** حالة التطبيق |
| `resolved_work_id`/`resolved_unit_refs` | مفاتيح أجنبية للهدف | `targetUnitId`/`targetRef` | جزئي |
| `also_published_in[]` | مصفوفة أدوات | **فجوة** | — |

## ج) الفجوات والهجرة الإضافية المقترحة (بلا هدم — §1)

النموذج القائم (#631) **ناقص** عن متطلبات §4، فالمقترح هجرة إضافية صغيرة (اختيارية للمالك):

1. **`legal_work` / `legal_expression`** (فصل العمل عن التعبير) — أو توثيق قرار باعتماد
   `LegalDocument` تعبيرًا و`LegalSystem` عملًا (تبسيط) بدل جدولين جديدين.
2. **`legal_effect`** جدول مستقل: `effect_type` (enum يغطي enact/amend/insert/delete/repeal/replace)،
   `operative_text`، `status` (pending_review|confirmed|applied)، `resolved_work_id`،
   `resolved_unit_refs jsonb`، `instrument_*`، `also_published_in jsonb`، `source_url`، `content_sha`.
3. **حقل معرّف دائم** `permanent_id`/`eli` على العمل (`sa/law/1448/m-96`، `sa/org/1448/cm-278`).
4. **توسعة `DocUnitType`** لتشمل `approval_instrument` و`clause` و`unstructured_body`.
5. **زمنية على الوحدة**: `DocumentUnit.validFrom/validTo` موجودة ✅ — يلزم فقط قيد منع تداخل الفترات.

## د) قرار التوقّف (§8)
- PR #631 **غير مدموج** وهجرته **غير مطبَّقة على Neon**؛ ولا يوجد على الإنتاج أيّ من جداول النموذج.
- النموذج المستهدف (`legal_work`/`legal_expression`/`legal_effect`) **غير مبنيّ أصلًا** حتى في #631.
- لا أملك إنشاء **فرع Neon تجريبيّ** (القاعدة ٤). لذا تُنفَّذ المرحلة ١ على staging محليّ فقط.

⇒ **التوقّف قبل الترحيل (المرحلة ٢+)** حتى يقرّر المالك: (أ) دمج #631 + تطبيق هجرته، و(ب) اعتماد
الهجرة الإضافية أعلاه لسدّ فجوة `legal_effect`/`legal_work`، و(ج) تزويد فرع Neon تجريبيّ.
