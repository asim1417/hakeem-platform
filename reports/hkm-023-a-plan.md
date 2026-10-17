# خطة HKM-023-A — المراحل م٢ إلى م٨ (جاهزة لجلسة تنفيذ)

> مبنية على أساس **#727** عند `6bad89d` كما هو مكتوب فعلًا: `lib/modules/editorial/` (`service.ts`، `core.ts`، `policy.ts`، `intake.ts`، `intake-apply.ts`، `integrity.ts`) والترحيل `prisma/migrations/20261017090000_editorial_desk_phase0/`.
> وعلى خدمة العدّ `lib/modules/legal-core/metrics.ts` من م١. الأعداد من قراءة الإنتاج للقراءة فقط في 17/10/2026.
> كل مرحلة: أنواع التغيير (الاسم، الحمولة، الفحوص، النشر، التراجع)، والجداول وسبب عدم كفاية الموجود، والشاشات، والاختبارات المسمّاة، والتقدير، والتبعيات.

## ٠. ما في الأساس وما ينقصه (يحكم كل المراحل)

**القائم في #727:**
- `change_set` (الدفعة) بأنواع `manual | agent_review | agent_review_bulk | revert | emergency_revert` (قيد CHECK)، وبصمة حمولة تُجمَّد عند الإرسال، ومشغّل يمنع تغيير المحتوى.
- `editorial_change` (التغيير) بـ `target_type` مقيّد بـ `work | unit | ruling | relation | principle | amendment_op`، و`op` نص حر، و`before`/`after` JSONB، والسند (`evidence_*`، `source_rank` يُشتق من الرابط)، و`read_at` لكشف التعارض، و`applied_ref` يُضبط مرة، وقفل هدف مفتوح واحد (`editorial_change_open_target_uq`)، وعدم تكرار المقترح (`source_ref`).
- `review_decision` (قرار لكل معتمِد، والاعتماد الذاتي بسبب مكتوب)، و`audit_event` إلحاقي بمشغّلات، و`index_sync` (outbox)، و`editorial_config` (تكليفات وسياسة لكل نوع عنصر).
- `ITEM_KINDS = set_work_status | review_amendment_op | review_principle | revert`، وسياسة لكل نوع بمخطط zod **صارم** المفاتيح (`policy.ts`).
- **النشر والفحص والتراجع مكتوبة لفعل واحد:** `checkChange` و`publishChangeSet` (`if (change.op !== "set_work_status") throw`) و`assertStillApplied`/`revertChangeSet` كلها لـ `set_work_status`.
- قرار المبدأ القائم يكتب `UPDATE judicial_principles SET "reviewStatus"` (`intake-apply.ts:109`) — تحديث حالة على جدول قانوني.

**الأساس المشترك الذي يُبنى أولًا (م٢-أ، قبل أي فعل جديد):**

1. **سجل الأفعال (op registry)** في `lib/modules/editorial/ops/`: لكل فعل معالج واحد `{ op, itemKind, targetType, parse(after), check(tx, change), apply(tx, actor, change) → appliedRef, stillApplied(tx, change), revert(tx, change) }`. ينقل `set_work_status` إليه كما هو، ويستبدل الشروط الثابتة في `checkChange` و`publishChangeSet` و`revertChangeSet` بالإحالة إلى المعالج. **القبول:** اختبارات المكتب الحالية (328 على القاعدة) تبقى ناجحة دون تعديل.
2. **توسيع القيود:** `editorial_change.target_type` يضاف إليه `citation | judgment | article | system | issue | fiqh_source | fiqh_text | fiqh_alignment | bulk_rule`، و`change_set.kind` يضاف إليه `bulk_rule`. **القرار (لـ `aman-database` والمالك):** الترحيل الأول لم يُطبَّق على الإنتاج بعد، فالأنظف تعديل قائمتي CHECK فيه قبل أول تطبيق؛ والبديل ترحيل لاحق يستبدل القيد (`DROP CONSTRAINT` ثم `ADD CONSTRAINT … NOT VALID` ثم `VALIDATE`) على جداول المكتب وحدها، لا على جدول قانوني.
3. **أنواع العناصر والسياسات:** تُضاف أنواع عناصر **بالعائلة لا بالفعل**، لئلا تنفجر الإعدادات: `citation`، `judgment`، `article`، `system`، `principle_edit`، `issue`، `fiqh`، `bulk_rule`. `policySchema` يُوسَّع، و`loadEditorialConfig` يملأ المفتاح الغائب من نسخة محفوظة قديمة بسياسة **معطّلة** (`enabled: false`) حتى يفعّلها المالك — لا تفعيل ضمني.
4. **حارس السلامة:** `checkDeskIntegrity` يضيف مشغّلات الجداول الجديدة وفهارسها إلى ما يفحصه؛ غياب أحدها يقفل الكتابة كما اليوم.
5. **قاعدة العرض (المبدأ ٢):** لكل جدول إلحاقي جديد دالة قراءة «آخر صف يغلب» في `lib/modules/legal-core/` على نمط `verification-read.ts`، والصفحات العامة تقرأ منها وحدها. وتعريفات `legalMetricsService` المتأثرة تُحدَّث في `metrics.ts` في الالتزام نفسه (مكان واحد).
6. **الجماعي بقاعدة (يُعاد استعماله في م٢ وم٣ وم٥ وم٦):** دفعة `kind = bulk_rule` + صف `bulk_rule` (أدناه). تغيير لكل هدف (ليبقى قفل الهدف وعدم التكرار صحيحين)، بسقف 2,000 هدف للدفعة؛ القاعدة الأكبر تُقسَّم دفعات بالقاعدة نفسها.

**جداول مشتركة تُنشأ في م٢:**

| الجدول | الغرض | لماذا لا يكفي الموجود |
| --- | --- | --- |
| `bulk_rule` | نص القاعدة ومعاملاتها، والأهداف المطابقة (بصمة قائمتها وعددها)، وبذرة العيّنة و**العيّنة العشوائية** (30 افتراضيًا)، ونتيجة مراجعة العيّنة ونسبة الخطأ والحد (5٪ افتراضيًا من `editorial_config`) | `change_set` لا يحمل قاعدة ولا عيّنة؛ و`editorial_change.checks` نتيجة فحص آلي لا مراجعة بشرية لعيّنة. المحتوى ثابت بعد الإنشاء، ونتيجة العيّنة تُضبط مرة واحدة (مشغّل كـ `payload_hash`). |
| `review_assignment` | إسناد عنصر أو دفعة لمراجع بعينه (ل١٢-٥)، ومصدر «ما أُسند إليّ» في «عملي اليوم» (ل٠-٣) | التكليف في `editorial_config` يحدد **من يحق له**، لا **من عليه** هذا العنصر. إلحاقي: الإسناد الجديد صف جديد، والإلغاء صف بحالة. |
| `saved_view` | المرشحات المحفوظة لكل مستخدم (ل١٢-٣) | لا جدول تفضيلات مرشحات. **ليس محتوى قانونيًا**، فيُكتب مباشرة بمسار مستخدم عادي خارج دورة المكتب (استثناء مكتوب). |

## م٢ — طابور الاستشهادات (ل٤) وبطاقة الحكم الإدارية (ل٣-١)

**الحجم:** 29,705 رابطًا كلها `needs_review` (أساس الحكم 18,346، إحالة إجرائية 7,424، استشهاد 2,582، مرجع مؤيد 1,353)، على 1,231 مادة و11,469 حكمًا.

**أنواع التغيير:**

| الفعل (`op`) | العائلة | الهدف | الحمولة (`after`) | `before` | الفحوص | النشر | التراجع |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `review_citation` | `citation` | `citation` = معرّف الرابط | `{ decision: approve \| reject \| retype \| reassign, reason_code?, reason_note?, relation_type?, article_id?, quote }` | آخر قرار للرابط (أو لا قرار) وحالته ونوعه ومادته | الرابط موجود؛ الرفض بسبب من القائمة (ليس استشهادًا، مادة خاطئة، نوع خاطئ، تكرار، أخرى + نص)؛ `retype` بنوع من القائمة المعروفة ومختلف؛ `reassign` بمادة موجودة مختلفة؛ **الاعتماد يشترط اقتباسًا موجودًا حرفيًا في نص الحكم** (المبدأ ٢)؛ لا قرار أحدث بعد `read_at` | صف `citation_review` | صف `citation_review` بقرار `withdrawn` يعيد آخر قرار سابق؛ بلا سابق = `NO_PRIOR_STATUS` |
| `add_citation` | `citation` | `judgment` | `{ article_id, relation_type, quote }` | لا رابط بالمادة والاقتباس نفسيهما | المادة موجودة؛ الاقتباس جزء حرفي من نص الحكم؛ لا تكرار لـ `(articleId, caseId, citedText)` | `INSERT` صف جديد في `legal_article_case_links` (إضافة لا تعديل) + `citation_review` اعتماد | `citation_review` بقرار `withdrawn` (الرابط لا يُحذف ولا يظهر) |
| `edit_judgment_meta` | `judgment` | `judgment` | أي من: المحكمة، المدينة، رقم القضية، رقم القرار، التاريخ الهجري، الدرجة، النهائية | قيم آخر نسخة (أو أعمدة `judicial_cases`/`ruling_meta`) | حقول من القائمة فقط؛ التاريخ الهجري صحيح؛ لا نسخة أحدث بعد `read_at` | صف `metadata_version` | نسخة جديدة بالقيم السابقة |
| `set_judgment_visibility` | `judgment` | `judgment` | `{ visible: boolean, reason }` | آخر علَم | السبب إلزامي (5 أحرف فأكثر) | صف `judgment_visibility` | صف بالعلَم السابق |

- **الجماعي بقاعدة (ل٤-٣):** دفعة `bulk_rule` من تغييرات `review_citation`، والقاعدة مكتوبة (مثل: «ذكر صريح لرقم المادة واسم النظام في نص الحكم»). **فحص الإرسال يرفض الدفعة** إن لم تُراجَع العيّنة كلها (`L4-3`)، أو إن تجاوزت نسبة الخطأ الحد (`L4-4`: الدفعة كلها مرفوضة، لا جزء).
- **ل٤-٥:** نتيجة «التقاط الاستشهاد» في `/dashboard/legal-core/citations` تُرسل مسودات `add_citation` (مؤلفها البشري)، بدل أن تضيع.
- **ل٤-٦:** الترتيب الافتراضي بعدد استشهادات المادة تنازليًا (استعلام قراءة، بلا جدول).

**الجداول:**

| الجدول | لماذا لا يكفي الموجود |
| --- | --- |
| `citation_review` (إلحاقي: `link_id`، القرار، السبب، النوع/المادة المصحّحان، الاقتباس، `change_id`، `decided_at`) | `legal_article_case_links.reviewStatus` عمود قابل للتحديث، وتحديثه يخالف المبدأ ١؛ و`verification` بنوع `relation` قيده يقبل حالات النفاذ (ساري، ملغى…) لا قرارات المراجعة. |
| `metadata_version` (إلحاقي: `object_type`، `object_id`، `fields` JSONB، `change_id`) | **مقترح بدل `judgment_metadata_version` وحده:** م٣ (المادة) وم٤ (النظام، ل١-٣) يحتاجان الشيء نفسه؛ ترحيل #723 الذي فيه إصدارات البيانات الوصفية لم يُنقل إلى #727. جدول واحد بنوع الكائن أقل من ثلاثة. **قرار لـ `aman-database`.** |
| `judgment_visibility` (إلحاقي: `judgment_id`، `visible`، `reason`، `change_id`) | لا علَم ظهور للأحكام؛ الحجب الحالي (HKM-012) حجب نص لا إخفاء حكم. |

**العرض والعدّ:** صفحة الحكم والمادة العامتان تعرضان «معتمد» للروابط المعتمدة وحدها، والباقي «مقترح آلي غير معتمد»؛ والحكم المخفي خارج البحث. تعريفات `citations.pending/verified/rejected` في `metrics.ts` تنتقل إلى «آخر قرار في `citation_review` وإلا العمود القديم» — في الالتزام نفسه، مع اختبار.

**الشاشات:** `/admin/legal/citations` (قائمة: المادة، الحكم، النوع، مقتطف الموضع، الثقة؛ مرشحات النوع والحالة والنظام؛ تحديد متعدد؛ اعتماد/رفض بسبب/تصحيح النوع/تصحيح المادة؛ لوحة «دفعة بقاعدة» تعرض العيّنة الثلاثين قبل الإرسال؛ تعمل بعرض 390). و`/admin/legal/judgments/[id]` (لوحة جانبية: البيانات، والروابط بحالاتها وأفعالها، وإضافة رابط: بحث مادة ← نوع ← تظليل الاقتباس من النص، والمبادئ المستخرجة وحالتها، وعلَم الظهور). كل الحالات (تحميل، فارغ، خطأ، بلا صلاحية، جزئي) بهوية حكيم. **قبل الكود:** رحلة من `aman-ux` ومواصفة من `aman-ui-designer`.

**الاختبارات المسمّاة:** `L4-1 queue lists every link with article, judgment, type, excerpt, confidence` · `L4-2 approve/reject-with-reason/retype/reassign go through the cycle` · `L4-2 reject without listed reason is rejected` · `L4-2 approve without verbatim quote is rejected` · `L4-3 rejects bulk without sample` · `L4-3 rule text is stored with the change set` · `L4-4 batch over error threshold is rejected whole` · `L4-5 captured analysis becomes draft proposals` · `L4-6 default order by article citation weight` · `L3-1 manual link via cycle appears on the article page after publish` · `L3-1 visibility needs written reason` · `L3-1 metadata edit appends a version and the previous stays readable` · `L0-1 citations counters read citation_review` · `L0-2 citation queue count equals counter` · وحراس المكتب لكل فعل جديد: `UPDATE/DELETE on citation_review fails` · `approver equal to author is rejected` · `agent cannot approve or publish` · `EDITORIAL_DESK_WRITE unset writes nothing` · `L12-6 queue actions at 390px` · `L12-7 every action in audit with before/after`.

**التقدير:** 4–5 أيام عمل (يوم للأساس المشترك م٢-أ، ويومان للخلفية والاختبارات، ويومان للواجهتين والفحص البصري)، ثم مراجعة جودة.
**التبعيات:** اكتمال واجهة المكتب الموحدة على #727؛ قرار §٢ أعلاه (القيود)؛ قرارات المالك: حد الخطأ وحجم العيّنة، ومن يعتمد الاستشهادات، والسماح بالجماعي لـ«أساس الحكم» أولًا.

## م٣ — تحرير المادة (ل٢-١ إلى ل٢-٣) وورشة الإثراء (ل٢-٤)

**الحجم:** 28,622 مادة؛ تحتاج مراجعة 27,350 (بلا تصنيف 11,281، بلا كلمات 14,706، بلا باب 25,152)؛ بلا علاقات 23,204.

| الفعل | العائلة | الهدف | الحمولة | الفحوص | النشر | التراجع |
| --- | --- | --- | --- | --- | --- | --- |
| `edit_article_text` | `article` | `unit` (المادة) | `{ text, valid_from, dates: { issued, published, effective, applied }, evidence }` | السند إلزامي (أداة ورابط واقتباس)؛ النص مختلف عن النسخة النافذة؛ `valid_from` بعد آخر نسخة ولا تداخل (`assertNoVersionOverlap` القائمة)؛ لا نسخة أحدث بعد `read_at` | `INSERT` في **`unit_version` القائم** (إلحاقي بمشغّل) | نسخة جديدة بالنص السابق وسند التراجع، لا حذف |
| `edit_article_meta` | `article` | `unit` | أي من: العنوان، الرقم، الباب والفصل، التصنيف، الكلمات، الحالة | الحقول من القائمة؛ الحالة بسند (كالنظام) | `metadata_version` (`object_type = article`) | نسخة بالقيم السابقة |
| `enrich_article` | `article` | `unit` | `{ classification?, chapter?, keywords? }` | حقل واحد على الأقل؛ من قوائم مرجعية (التصنيفات الـ28) | `metadata_version` | كالسابق |
| `set_paragraph_anchors` | `article` | `unit` | `{ version_id, anchors: [{ key: "2" \| "2.ب", start, end }] }` | المراسي تغطي نص النسخة بلا تداخل، والمفاتيح فريدة | جدول المراسي (أدناه) | مراسٍ جديدة لنسخة جديدة |

- **ورشة الإثراء:** دفعة واحدة لعدة مواد (تغيير لكل مادة)، أو `bulk_rule` حين يُسند الحقل بقاعدة. اقتراح الوكيل يظهر بجانب المادة بدرجته **حين توجد م٨**؛ قبلها العمود «لا اقتراح».
- **خارج تعيين الأمر للمراحل (أقترح إلحاقهما بم٣-ب، قرار المالك):** ل٢-٥ `add_article_relation` (`INSERT` في `legal_relations`؛ «تقييد» و«استثناء» لا تقابلها قيم في نوع `RelationType` الحالي، فيلزم `ALTER TYPE … ADD VALUE` إضافيًا — قرار `aman-database`)، ول٢-٦ `add_explanation` بمصدر إلزامي.

**الجداول:**

| الجدول | لماذا |
| --- | --- |
| `unit_version` (قائم) للنص | يكفي: إلحاقي، بسند، و`textAsOf` يقرأه. |
| `metadata_version` (من م٢) للبيانات الوصفية | أعمدة `legal_articles` قابلة للتحديث. |
| `article_paragraph_anchor` (إلحاقي) — **ليس في قائمة الأمر** | لا مكان قائم لمراسي الفقرات على نص النسخة. إن دُمجت شجرة الوحدات في #631 (افتتاحية، أبواب، مواد، فقرات) فهي البديل ولا يُنشأ هذا الجدول — **قرار المالك في #631 أولًا**. |
| `article_explanation` (إلحاقي، إن أُقرّ م٣-ب) — **ليس في القائمة** | `annotations` ملاحظات المستخدمين بلا عمود مصدر؛ الشرح محتوى عام يُراجَع ويُسند. وينقل تعريف «الشروح» في `metrics.ts` إليه. |

**الشاشات:** `/admin/legal/articles` (قائمة بمرشحات الجودة = **طوابير مقاييس المواد** التي بلا طابور في م١، فتُغلق ل٠-٢ لها)، و`/admin/legal/articles/[id]/edit` (زر «تحرير» في صفحة المادة يعمل لمن له الصلاحية، ومعطّل بسبب مكتوب لغيره)، وسجل النسخ خلف أيقونة «النسخ السابقة» مع «كما في تاريخ»، ومقارنة نسختين **بالكلمة** (دالة فرق كلمات داخلية بخوارزمية LCS، بلا تبعية جديدة)، و`/admin/legal/articles/enrich` (تحديد متعدد، إسناد جماعي، اختصارات: قبول، رفض، التالي).

**الاختبارات:** `L2-1 text edit appends a unit_version and never overwrites` · `L2-1 previous text behind "النسخ السابقة" and as-of before the edit shows it` · `L2-1 edit disabled with written reason without permission` · `L2-1 status change needs evidence` · `L2-2 word-level diff between any two versions` · `L2-3 anchors stable across a new version` · `L2-4 enrich 50 articles of one system in one change set` · `L2-4 /quality counter drops by 50 after publish` (عبر `legalMetricsService`) · `L2-4 keyboard accept/reject/next` · `L0-2 article queues equal the article counters` · وحراس المكتب.

**التقدير:** 4 أيام (+يوم لم٣-ب إن أُقرّ). **التبعيات:** م٢-أ؛ قرار #631 (المراسي)؛ قائمة التصنيفات المرجعية من المالك.

## م٤ — إدارة الأنظمة (ل١)

**الحجم:** 1,147 نظامًا؛ بلا مجال 646، بلا تاريخ إصدار 651، بلا حالة موثّقة 653.

| الفعل | الهدف | الحمولة | الفحوص | النشر | التراجع |
| --- | --- | --- | --- | --- | --- |
| `add_system` | `system` (معرّف جديد) | الاسم، النوع (نظام، تنظيم، ترتيبات، لائحة، قواعد، ضوابط، دليل إجراءات، سياسة)، المجال، أداة الإصدار (نوعها ورقمها وتاريخها الهجري)، التواريخ الأربعة، المصدر ورابطه، النص الكامل | **هوية = الاسم + أداة الإصدار + التاريخ** (لا الاسم وحده)؛ المطابق يرفض بـ `DUPLICATE_SYSTEM` وإحالة للقائم؛ رابط المصدر https ورتبته | `INSERT legal_systems` + مواد + `law_card` + `metadata_version` | تحقق «سحب» (`verification`) لا حذف |
| `import_system` | `system` | نص ملصوق أو رابط أم القرى/الهيئة | التفكيك بقارئ #631 إلى شجرة (افتتاحية، استنادات، بنود منطوق، أبواب، مواد، فقرات) ومعاينتها؛ **لا كتابة قبل الاعتماد** | كـ `add_system` | كـ `add_system` |
| `edit_system_meta` | `system` | أي حقل من `add_system` عدا النص | كالسابق | `metadata_version` (`object_type = system`) | نسخة سابقة |
| `set_work_status` (قائم، يُوسَّع) | `work` | + `effective_date`، و`replacement_system_id` | «مستبدل» بلا بديل يُرفض؛ الحالة بسند (قائم) | `verification` (قائم) | قائم |
| `set_system_family` | `system` | `{ add \| remove: { relation: IMPLEMENTS \| CITES, other_id } }` | الطرفان موجودان؛ لا دورة IMPLEMENTS | `INSERT legal_relations`؛ الفك صف حالة | صف حالة معاكس |
| `add_legal_effect` | `system` | النوع (إحلال، إلغاء، تعديل، نفاذ مؤجل)، الأداة ورابطها، التاريخ، الهدف | السند إلزامي | جدول الآثار (أدناه) | أثر معاكس |
| `classify_systems` (جماعي) | `system` × ن | `{ domain?, kind? }` | قيم من القوائم المرجعية | `metadata_version` لكل نظام | — |

**الجداول:** `metadata_version` (م٢). **حالة العلاقة:** فك علاقة بلا `DELETE` يحتاج صف حالة إلحاقيًا `relation_state` (`relation_id`، `active \| retracted`، `change_id`) — **ليس في القائمة**؛ لأن `legal_relations.status` نوع مخصّص لا تُعرف قيمه للفك ويُحدَّث في مكانه، و`verification(relation)` لحالات النفاذ. **الآثار:** لا جدول `legal_effect` في الإنتاج (الموجود `uqn_stage.effect` مرحلي، و`verification(effect)` بلا نوع ولا هدف)؛ فإما جدول #631 إن دُمج، أو `legal_effect` إلحاقي جديد — **قرار #631**.

**العرض:** الملغى لا يُحذف ولا يُعرض ساريًا: شريط إلغاء، ورابط البديل، وخارج البحث افتراضيًا (وجه البحث القائم)، وبطاقة «الساري هو…».
**الشاشات:** `/admin/legal/systems` (مرشحات ل١-٨: الحالة، النوع، المجال، بلا تاريخ نفاذ، غير مصنّف، بلا مرسوم، متقادم عن المصدر = **طوابير مقاييس الأنظمة**)، و`/new` (نموذج + فحص هوية حي)، و`/new?mode=import` (لصق/رابط ← شجرة ← إرسال)، و`/[id]` (البيانات، الحالة بسندها، العائلة، الإصدارات والآثار). ويحلّ ترتيب «غير المصنّف أولًا» (ع-٥) بمرشح بدل الترتيب.
**الاختبارات:** `L1-1 duplicate identity (name+instrument+date) is rejected with a link` (بنظام المرافعات الشرعية الاصطناعي) · `L1-1 same name with a different instrument is allowed` · `L1-2 sample text with decree, operative clauses and three chapters parses to the right tree` · `L1-2 nothing is written before approval` · `L1-3 metadata edit appends a version` · `L1-4 superseded without replacement is rejected` · `L1-4 status needs instrument and link` · `L1-4 repealed system leaves search and shows the banner` · `L1-5 IMPLEMENTS add/remove through the cycle` · `L1-6 manual effect needs evidence` · `L1-7 bulk classify in one change set` · `L1-8 each filter equals its counter` · وحراس المكتب.
**التقدير:** 5 أيام. **التبعيات:** م٢-أ؛ #631 (القارئ والآثار)؛ القوائم المرجعية للأنواع والمجالات.

## م٥ — المبادئ (ل٥) والمسائل (ل٦)

**الحجم:** المبادئ 4,066 (منتظر 3,433، مرفوض 633، معتمد 0). المسائل 3,073 (مطابقة عالية 2,043، تحتاج مراجعة 652، غير مقنّنة 378) — **في ملف JSON بالمستودع لا في القاعدة** (`data/legal-issues-browse.json`)؛ و`fiqh_issues` في القاعدة 2,590 صفًّا شيء آخر.

| الفعل | الهدف | الحمولة | الفحوص | النشر |
| --- | --- | --- | --- | --- |
| `edit_principle` | `principle` | `{ title, text }` | الصياغة الآلية الأصلية تبقى؛ نص مختلف | `principle_revision` |
| `review_principle` (قائم، يُوسَّع) | `principle` | + `reason_code` من القائمة (ليس مبدأ، تكرار، مخالف للمستقر، صياغة معيبة، واقعة خاصة) | الرفض بسبب من القائمة؛ الجماعي بقاعدة وعيّنة | **`principle_revision` بحالة** بدل `UPDATE` (انظر أدناه) |
| `merge_principles` | `principle` (الباقي) | `{ merged_ids[] }` | المدمَجة موجودة وغير مدمجة سابقًا؛ الأحكام المصدر كلها تبقى مرتبطة | `principle_merge` |
| `link_principle_article` | `principle` | `{ article_id }` | المادة موجودة | `INSERT legal_relations` (`principle → article`، INTERPRETS) |
| `review_issue` | `issue` | `{ action: approve_link \| change_article \| mark_uncodified, article_id? }` | المادة موجودة | جدول المسائل (أدناه) |
| `edit_issue` / `move_issue` | `issue` | العنوان/الباب | — | كالسابق |

- **قرار الحالة:** الأساس يحدّث `judicial_principles.reviewStatus` في مكانه. أقترح أن يصير القرار صف `principle_revision` (حالة ± نص) و«آخر صف يغلب» في العرض والعدّ، مع إبقاء العمود القديم قراءة احتياطية — **قرار المالك و`aman-database`** لأنه يغيّر سلوك #727. تعريفات `principles.*` في `metrics.ts` تتبعه في الالتزام نفسه، و`L5-6 statuses sum to total` يبقى (مع «مدمج» حالةً معروضة).
- **المسائل في القاعدة:** ل٦ لا يُنفّذ بدورة المكتب على ملف في المستودع. يلزم جدول `legal_issue` (+ `legal_issue_revision` إلحاقي) يُستورد إليه الملف مرة بمسار مأذون (ف١١ بإذن المالك وعيّنة)، أو قرار بأن المسائل تُدار في `fiqh_issues`. **ليس في قائمة الأمر؛ قرار المالك.** وتُربط غير المقنّنة (378) بالطبقة الفقهية لا بمادة (ل٦-٣، بعد م٧).

**الجداول:** `principle_revision`، `principle_merge` (في القائمة؛ لأن `judicial_principles` قابل للتحديث ولا مكان لنسخ الصياغة ولا للدمج)، و`legal_issue` + `legal_issue_revision` (بقرار).
**الشاشات:** تحويل `/dashboard/legal-core/principles` إلى `/admin/legal/principles` (تحرير قبل الاعتماد مع الأصل ظاهرًا، تحديد متعدد، قاعدة مع عيّنة، دمج بمعاينة، ربط بمادة)، و`/admin/legal/issues` (طابور الـ652، ومرشح بالحالة = طوابير مقاييس المسائل).
**الاختبارات:** `L5-1 edit keeps the original machine text` · `L5-2 bulk approve/reject with rule and sample` · `L5-3 reject reason from the list` · `L5-4 merge keeps every source judgment linked` · `L5-5 principle links to an article through the cycle` · `L5-6 statuses sum to total (with merged)` · `L6-1 the 652 queue approves, changes article, or marks uncodified` · `L6-2 add/edit/move an issue` · `L6-3 uncodified links to fiqh not to an article` · وحراس المكتب.
**التقدير:** 4 أيام (+يومان لاستيراد المسائل إن أُقرّ). **التبعيات:** م٢-أ، و`bulk_rule`؛ قرار حالة المبدأ؛ قرار موطن المسائل؛ م٧ لـ ل٦-٣.

## م٦ — تصحيح بيانات الأحكام (ل٣-٢ إلى ل٣-٥)

**الحجم (قراءة):** `ruling_meta` يغطي 51,105 حكمًا، و`year_h` فارغ في **31** منها؛ و`city_norm` 25 قيمة مميزة؛ و`judicial_cases."decisionDate"` فارغ في الأحكام كلها (التاريخ نص في `decisionDateText`). `pg_trgm` مثبّت.

| الفعل | الهدف | الحمولة | الفحوص | النشر |
| --- | --- | --- | --- | --- |
| `fix_judgment_meta` (جماعي بقاعدة) | `judgment` × ن | `{ rule: year_from_text \| city_map, params }` → قيم لكل حكم | **العيّنة 20 حكمًا قبل/بعد** تُعرض وتُوافَق قبل الإرسال (ل٣-٢)؛ القاعدة مسجلة في `bulk_rule` | `metadata_version` لكل حكم (لا `UPDATE` على `ruling_meta` ولا `judicial_cases`) |
| `mark_judgment_duplicate` | `judgment` | `{ duplicate_of, basis: same_case_and_date \| text_similarity, score }` | الطرفان موجودان؛ لا دورة | علاقة بين الحكمين (الصفان باقيان) |

- **التكرار:** علاقة «تكرار» بين حكمين بإبقاء الصفين. `RelationType` لا قيمة فيه لذلك؛ فإما `ALTER TYPE … ADD VALUE 'DUPLICATE_OF'` (إضافي) أو `RELATED_TO` بوصف — **قرار `aman-database`**. طابور الاشتباه: تطابق رقم القضية والتاريخ أولًا، ثم تشابه نص بـ `pg_trgm` بحد يحدده المالك.
- **قائمة الأحكام (ل٣-٥):** `/admin/legal/judgments` بمرشحات المحكمة، والمدينة، والسنة، و«بلا رابط»، و«بلا سنة»، و«روابطه غير معتمدة»، و«مخفي» — وتصير طابور `judgments.*` بدل قائمة `/dashboard` (المرشح `links` من م١ يُنقل).

**الجداول:** `metadata_version` و`bulk_rule` (م٢)، و`judgment_visibility` (م٢) للمخفي. لا جديد.
**الاختبارات:** `L3-2 rule shows 20 judgments before/after and sends only after approval` · `L3-2 empty year_h filled from the date text without touching ruling_meta` · `L3-2 city spellings normalised by the map` · `L3-3 suspected duplicates queue (same case and date, then similarity)` · `L3-3 merge as one reference keeps both rows` · `L3-4 points button hidden for admins` (من م١، يبقى) · `L3-5 each filter equals its counter` · وحراس المكتب.
**التقدير:** 3 أيام. **التبعيات:** م٢ (`bulk_rule`، `metadata_version`)؛ قرار قيمة التكرار.

## م٧ — الاستيراد والرصد (ل٨)، والفهرسة (ل١٠)، والطبقة الفقهية (ل٧)

| الجزء | الأفعال | المصادر والجداول | الحد |
| --- | --- | --- | --- |
| ل٨ الاستيراد والرصد | لا فعل كتابة جديد: كل عنصر في الطابور يفتح `add_system`/`import_system`/`set_work_status`/`add_legal_effect` مسودةً | طابور ما التقطه خط RSS أم القرى من #631 (جديد، تعديل، إلغاء، نفاذ مؤجل) برابط المصدر؛ «متقادم» = تاريخ آخر تعديل في المصدر أحدث من القاعدة؛ سجل مهام الاستيراد (متى، ماذا، نجح، فشل، السبب) | **عرض واقتراح فقط**؛ لا تشغيل للخط المجدول ولا مساس بـ workflows (ف٢٧ لـ `aman-devops`) |
| ل١٠ الفهرسة | نقل «فهرسة الجديد» و«إعادة بناء الكل» إلى `/admin/legal/index` مع تأكيد لإعادة البناء الكامل | حالة `index_sync` (القائم): المعلّق، والفاشل، وإعادة المحاولة؛ والمتجهات: مواد وأحكام بلا صف في `embeddings`/`embedding_version` (مقاييس جديدة في `metrics.ts`) | إعادة المحاولة تكتب في `index_sync` وحده |
| ل٧ الفقهي | `add_fiqh_source` (الكتاب، المؤلف، الطبعة، معرّف تراث)، `add_fiqh_text` (إسناد إلزامي: الكتاب والجزء والصفحة؛ دفعات مختارة)، `align_fiqh` (المادة، وجه الصلة، النوع: موافق/مخالف/مقيِّد/أصل تاريخي، الثقة) | الجداول القائمة `fiqh_sources`، `fiqh_texts`، `fiqh_article_alignments` (0/0/0 اليوم) تكفي؛ اعتماد المواءمة = حالة `review_status` بقرار في دورة المكتب | **لا سحب جماعي من تراث**؛ المواءمة لا تظهر إلا معتمدة أو موسومة «مواءمة آلية غير معتمدة» |

**الجداول:** لا جديد إن دُمجت جداول خط RSS وسجل المهام من #631؛ وإلا `intake_item` و`import_job` للقراءة — **قرار #631**.
**الاختبارات:** `L8-1 intake queue shows source link and kind` · `L8-2 stale = source newer than the database` · `L8-3 import job log` · `L8-4 no scheduled run is triggered from the panel` · `L10-1 full rebuild needs confirmation` · `L10-2 index_sync pending/failed/retry` · `L10-3 vectors missing per type` · `L7-1 source needs book, author, edition` · `L7-2 text without volume and page is rejected` · `L7-3 alignment type from the list` · `L7-4 unapproved alignment is hidden or labelled`.
**التقدير:** 4 أيام. **التبعيات:** #631 (خط RSS والقارئ)؛ تأكيد أن شاشات الطبقة الفقهية لا تشغّل جلبًا آليًا.

## م٨ — الوكيل الفارز (ل١١)

- **الدور:** حساب وكيل بتكليف `kind = agent` (القائم يمنعه من دوري المعتمِد والناشر في `policy.ts`، و`AGENT_CANNOT_DECIDE` في كل اعتماد ونشر). يكتب **مسودات فقط** في الطوابير بالأفعال القائمة (`review_citation` باقتراح، `enrich_article`، `set_work_status` بمستند، `mark_judgment_duplicate`)، بفاعل `agent:<اسم>` في السجل.
- **لا فعل جديد للكتابة:** الوكيل مستخدم للأفعال نفسها. الجديد: **سقف التشغيل والتكلفة** (عدد العناصر والرموز والمبلغ لكل دفعة، يضعه المالك في `editorial_config`، ويرفض المكتب الإدراج عند تجاوزه)، و**أداء الوكيل** (نسبة قبول مقترحاته لكل فعل من `review_decision` و`editorial_change.status`) — مقاييس في `metrics.ts`، بلا جدول.
- **الجدول:** `agent_run` (إلحاقي: الوكيل، الفعل، العناصر، الرموز، التكلفة، البدء والانتهاء، الحالة) لأن السقف يحتاج مجموعًا موثوقًا لكل دفعة، ولا مكان له في `audit_event` (حدث لكل فعل لا لكل تشغيل) — **ليس في القائمة؛ يُقرّ مع السقف**.
- **الشاشات:** `/admin/legal/agent` (التشغيلات، المقترحات بحالاتها، نسبة القبول لكل فعل، السقف المتبقي).
- **الاختبارات:** `L11-1 agent proposals land as drafts in the right queue` · `L11-2 agent has no approve or publish action` (من الأساس، يُعاد لكل فعل جديد) · `L11-2 actor recorded as agent:<name>` · `L11-3 acceptance rate per action` · `L11-4 run over the cost cap is refused before any write` · `L11-5 agent built last on stable queues`.
- **التقدير:** 4–5 أيام (بمشاركة `aman-ai-engineer` في الأوامر والتقييم). **التبعيات:** م٢–م٧ مستقرة؛ قرار سقف التكلفة الشهري؛ مجموعة تقييم عربية لكل فعل قبل التفعيل.

## الخصائص المشتركة (ل١٢) بحسب المرحلة

| المتطلب | أين يُبنى |
| --- | --- |
| ل١٢-١ بحث موحد في أعلى اللوحة | م٢ (الأحكام والمواد)، ويتسع مع كل مرحلة |
| ل١٢-٢ تحديد متعدد وأفعال جماعية | كل طابور من م٢ |
| ل١٢-٣ مرشحات محفوظة (`saved_view`) | م٢ |
| ل١٢-٤ تصدير CSV لقائمة مصفّاة (قراءة) | م٢، ثم كل قائمة |
| ل١٢-٥ الإسناد (`review_assignment`) | م٢، ومعه ل٠-٣ «عملي اليوم» |
| ل١٢-٦ الاعتماد من الجوال (390px) | كل طابور، باختبار بصري |
| ل١٢-٧ كل فعل في `/audit` بقبل/بعد | قائم في المكتب؛ يُختبر لكل فعل جديد |
| ل١٢-٨/ل١٢-٩ الهوية وكل الحالات | كل شاشة، بمراجعة `aman-ui-designer` |
| ل١٢-١٠ قسم «المحتوى القانوني» في قائمة الإدارة | **أُنجز في م١** |
| ل٠-٣ «عملي اليوم»، ل٠-٥ المؤشر الأسبوعي | م٢ (بعد `review_assignment`)؛ الأسبوعي من `review_decision` و`audit_event` بلا جدول |

## ملخص الجداول المقترحة

| الجدول | المرحلة | في قائمة الأمر؟ |
| --- | --- | --- |
| `bulk_rule` | م٢ | نعم |
| `review_assignment` | م٢ | نعم |
| `saved_view` | م٢ | نعم (خارج دورة المكتب: تفضيل مستخدم) |
| `citation_review` | م٢ | نعم |
| `metadata_version` | م٢ | **بديل موحّد** عن `judgment_metadata_version` يخدم م٣ وم٤ أيضًا |
| `judgment_visibility` | م٢ | نعم |
| `article_paragraph_anchor` | م٣ | لا — إلا إن لم تُدمج شجرة #631 |
| `article_explanation` | م٣-ب | لا — إن أُقرّ ل٢-٦ |
| `relation_state` | م٤ | لا — لفك العلاقة بلا حذف |
| `legal_effect` | م٤ | لا — إلا إن جاء من #631 |
| `principle_revision`، `principle_merge` | م٥ | نعم |
| `legal_issue`، `legal_issue_revision` | م٥ | لا — المسائل في ملف لا في القاعدة |
| `agent_run` | م٨ | لا — لسقف التكلفة |

كل الجداول إلحاقية بمشغّلات تمنع `UPDATE`/`DELETE`/`TRUNCATE` (إلا ما يُضبط مرة واحدة من NULL)، وترحيلاتها تُكتب ولا تُطبَّق إلا باعتماد المالك (ف١٠)، ويكتبها `aman-database` ضمن الفرع.

## القرارات المطلوبة قبل م٢

1. قائمتا CHECK في ترحيل المكتب: تعديلهما قبل أول تطبيق، أو ترحيل استبدال لاحق.
2. `metadata_version` واحد بدل ثلاثة جداول.
3. قرار #631 (القارئ، الشجرة، الآثار، خط RSS): ندمج منه أم نبني بديلًا محدودًا؟
4. حالة المبدأ: صف `principle_revision` بدل تحديث العمود.
5. موطن المسائل القانونية في القاعدة.
6. §١١ من الأمر: حد الخطأ وحجم العيّنة، المراجعون لكل طابور، الجماعي لـ«أساس الحكم»، سقف الوكيل، انتقال الإدارة إلى `/admin/legal`.
