# تفعيل البحث الدلالي (التضمين) — دليل تشغيل + تصحيح سِجل

**التاريخ:** 2026-07-12 · **الفرع:** `claude/legal-platform-audit-ii0r3u`
**الحالة:** تعديل برمجي صغير مُنفَّذ (سكربت npm + افتراضي workflow) + دليل تشغيل. **لا تشغيل حيّ من هذه البيئة** (بلا DB/مفتاح).

---

## ⚠️ تصحيح سِجل (شفافية)
في `reports/global-audit-2026-07-12.md` وردت الفجوة **G20** بصياغة توحي أن سكربت الـbackfill «يملأ `owner_type='article'` فقط». **هذا غير دقيق** بعد مراجعة الكود الفعلي:

- **سكربت التوليد `scripts/backfill-embeddings.ts` يدعم الأنواع الثلاثة أصلًا** عبر `--target articles|rulings|principles|all` (الأسطر 120-164)، مع مواصفات صفحنة جاهزة للأحكام (`judicialCase`) والمبادئ (`judicialPrinciple`).
- **الـworkflow `.github/workflows/backfill-embeddings.yml` يمرّر `--target ${{ inputs.target }}`** (السطر 84).
- الالتباس السابق نشأ من السكربت **الآخر** `backfill-embeddings-table.ts` الذي ينسخ متجهات موجودة للمواد فقط (`owner_type='article'` مُثبَّت، السطر 39) — وهو سكربت نسخ لا توليد.

**الخلاصة المصحّحة:** تغطية الأحكام/المبادئ = 0% ليست فجوة **برمجية** بل **تشغيلية** — لم يُشغَّل الـbackfill بـ`--target all` قط (الافتراضي كان `articles`).

---

## ما نُفِّذ الآن (تعديل آمن)
| التغيير | الملف | الأثر |
|---|---|---|
| إضافة سكربت npm `backfill:embeddings` و`backfill:embeddings:all` | `package.json:66-67` | مدخل تشغيل موثّق (كان مفقودًا) |
| تغيير افتراضي الـworkflow `target: articles → all` | `.github/workflows/backfill-embeddings.yml:20` | «تشغيل» واحد يغطّي الأنواع الثلاثة؛ مع `scope: missing` الافتراضي = «املأ الناقص فقط» (تزايُدي وآمن) |

**لا تغيير على منطق التوليد نفسه** (كان صحيحًا)، ولا هجرة قاعدة بيانات.

---

## دليل التشغيل (تُطلقه أنت — يحتاج أسرارك)

### الطريق الأول — GitHub Actions (المُوصى، لأنه يستهدف Neon بأمان)
1. GitHub → Actions → **Backfill Embeddings (تضمين دلالي pgvector)** → Run workflow.
2. اختر الفرع، ثم المُدخلات:
   - `CONFIRM_RUNTIME_DB_ALIGNMENT` = `NEON_RUNTIME_CONFIRMED` (إلزامي — بوّابة أمان ضد الكتابة على قاعدة خطأ).
   - `target` = `all` (صار الافتراضي).
   - `scope` = `missing` (يملأ الناقص فقط) أو `all` (يعيد توليد الكل).
   - `limit` = فارغ (الكل) أو رقم للتجربة أولًا (مثلًا 500).
3. المتطلبات المضبوطة كأسرار Actions: `NEON_DATABASE_URL` + (`EMBEDDING_API_KEY` أو `OPENAI_API_KEY`).

### الطريق الثاني — محليًا (إن كان `DATABASE_URL` يشير لـ Neon عمدًا)
```bash
export EMBEDDING_API_KEY="sk-..."                       # أو OPENAI_API_KEY
export CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
npm run backfill:embeddings -- --target all --limit 500   # تجربة أولًا
npm run backfill:embeddings:all                            # ثم الكل (missing فقط)
```

### التحقّق بعد التشغيل
```bash
curl -s https://<نطاقك>/api/embeddings/status | jq
# المتوقّع: coverage.articles≈100 · rulings≈100 · principles≈100
```

### التكلفة التقديرية (text-embedding-3-small)
~51,105 حكمًا + 3,433 مبدأ + 1,421 مادة ناقصة ≈ 56 ألف عنصر × ~حتى 2000 توكن ≈ **~100M توكن ≈ ~2$** (تقدير؛ الأحكام مبتورة عند 8000 حرف في `backfill-embeddings.ts:140`).

---

## كشف التقادم (`content_hash`) — ✅ نُفِّذ الآن
كان جدول `embeddings` بلا عمود hash، فتعديل نصّ مادة لا يُعيد تضمينها (متجه قديم صامت). أُنجز:
1. **هجرة** `prisma/migrations/20260712130000_embeddings_content_hash/migration.sql` — `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "content_hash" text;` (idempotent). عمود `model` موجود مسبقًا فيغطّي تغيّر النموذج.
2. **schema** `prisma/schema.prisma` — إضافة `contentHash String? @map("content_hash")` لنموذج `Embedding`.
3. **منطق** `scripts/backfill-embeddings.ts` — يحسب `sha256` لنصّ المصدر، ويعيد التضمين في الوضع التزايُدي **فقط** إذا: لا متجه، أو `content_hash` مختلف (تغيّر النص)، أو `model` مختلف (تغيّر النموذج) — بدل التخطّي الأعمى. يكتب البصمة عبر SQL خام (لا يعتمد على إعادة توليد عميل Prisma).

**ترتيب التشغيل المهم:** طبّق الهجرة **قبل** الـbackfill (السكربت يُدرج عمود `content_hash`؛ لو غاب العمود يفشل الإدراج ويُحسب failed). طبّق الهجرة عبر الـworkflow المُقفل المعتاد على Neon، ثم شغّل `backfill:embeddings:all`.

### الفجوة المتبقّية (خارج نطاق هذا التنفيذ)
**التقطيع (chunking) + بتر 8000 حرف** — تغيير أكبر (تقطيع فقرات + صفوف متعدّدة لكل مادة). موثّق كـ**RAG-CHUNK** في `global-audit`. أخبرني إن أردته لاحقًا.

---

## نتائج التنفيذ الفعلي على Neon (2026-07-14) — مُثبتة من سجلّات الـworkflows
طُبِّقت الهجرة وشُغِّل الـbackfill فعليًا عبر GitHub Actions على Neon (`ep-icy-rice-...neon.tech`، 17,323 مادة):

| النوع | الكوربوس | لها متجه | التغطية |
|---|---|---|---|
| المواد | 17,323 | 17,323 | **100%** ✅ |
| المبادئ | 4,066 | 4,066 | **100%** ✅ |
| الأحكام | 51,105 | ~23,853 | **~47%** |

**تصحيحان مهمّان ظهرا أثناء التنفيذ:**
1. أرقام تدقيق 2026-07-12 (أحكام/مبادئ 0%، مواد 91.8%) كانت **متقادمة**؛ الواقع الحيّ: مواد/مبادئ 100%.
2. **عيب في `embedBatch`** (`embeddings.ts`): إدخال فارغ واحد كان يُفشل دفعة كاملة (64) عبر رفض OpenAI (400). أُصلح باستبعاد الفراغات قبل النداء وإعادة الربط بالفهرس. أعادت إعادة التشغيل استرداد **2,816** حكمًا صالحًا.

**الفجوة الحقيقية المتبقّية للأحكام (بيانات لا كود):** **26,752 حكمًا (~52%) نصّها فارغ فعلًا** في `judicial_cases` — لا يمكن تضمينها حتى يُعاد استيراد/تنظيف نصوص الأحكام. يرتبط بفجوة «جودة نصوص الأحكام» و«100% needs_review» في `global-audit`.

**بنية التشغيل الجاهزة للمستقبل:** آلية `content_hash` تعيد تضمين أي نصّ يتغيّر تلقائيًا؛ فبمجرد إصلاح نصوص الأحكام، تشغيلٌ واحد لـ`backfill:embeddings --target rulings` يرفع التغطية دون مساس بالباقي.

---

## بتر 8000 حرف (سياق)
مرتبط بفجوة «لا تقطيع (chunking)» في التقرير الأصلي: نصّ الحكم/المادة يُبتَر عند 8000 حرف قبل التضمين (`embeddings.ts:37`, `backfill-embeddings.ts:140`)، فذيول المواد الطويلة (استثناءات/عقوبات) خارج المتجه. حلّها (تقطيع فقرات + صفوف متعدّدة لكل مادة) تغيير أكبر موثّق كـ**RAG-CHUNK** في `global-audit`.
