# تقرير فجوات صندوق حكيم الذكي — HKM-COMPOSER-001

تاريخ الفحص: 2026-07-31  
الفرع المستهدف: `cursor/hakeem-composer-da55`  
مرجع التنفيذ: بنية المشروع الحالية (لا نظام موازٍ)

---

## 1) الموجود (قابل لإعادة الاستخدام)

| القدرة | المسار | ملاحظة |
|---|---|---|
| صندوق Ask الرئيسي | `components/ask/HakeemAskWorkspace.tsx` | textarea + إرفاق + دراسة موسّعة + بث NDJSON |
| جلسات Ask | `lib/modules/conversations/engine.ts` + `ask-session-api.ts` | إنشاء عند أول رسالة، استعادة، حفظ أدوار |
| بث الوكيل | `/api/ai/agent-search` + `run-agent-search.ts` | NDJSON: job/step/result/clarify/error/done |
| أوضاع العمل | `lib/modules/agents/modes.ts` | ask / analyze-case / action-plan / verdict-estimate / consultation / chat |
| أوامر مختصرة (منطق) | `lib/modules/agents/commands.ts` | 4 أوامر فقط، بلا واجهة |
| بوابة النيّة | `lib/modules/agents/intent-gate.ts` | تصنيف حتمي قبل البحث |
| استخراج المستندات | `lib/modules/doc-tool/extract.ts` | PDF/DOCX/صور + OCR اختياري |
| مسودة | `HOME_ASK_DRAFT_KEY` في sessionStorage | مستخدمة في Ask والرئيسية |
| صوت | `LegalChatWorkspace.startVoice` | Web Speech API، غير موصول بـ Ask |
| هوية بصرية | `globals.css` / `identity.css` | `--navy` `--gold` `--hakeem-*` |
| اقتراحات أولى | `ASK_FIRST_SUGGESTIONS` | ثابتة للرئيسية فقط |

---

## 2) الناقص

- مكوّن مركزي قابل لإعادة الاستخدام باسم `HakeemComposer`
- زر إيقاف توليد ظاهر (Abort موجود داخليًا لكن الزر معطّل أثناء البث)
- قائمة أوامر `/` قابلة للبحث في الواجهة
- إشارات `@` للكيانات/السياق
- محدد مصادر يغيّر سلوك الطلب فعليًا
- إدخال صوتي في Ask
- اقتراحات سياقية حسب الصفحة/الملف/المحادثة
- محرر موسّع للنصوص الطويلة
- شريط سياق ظاهر (قضية/مستند/جلسة)
- حالات رفع متعددة الملفات ببطاقات منظّمة
- عقد طلب موحّد `HakeemComposerRequest` مع تحقق خادمي

---

## 3) المعطّل / غير الموصول

| عنصر | الحالة |
|---|---|
| `parseCommand` / `listCommands` | منطق + اختبارات فقط — بلا UI |
| شريط الأوضاع في Ask | مخفي ما لم `NEXT_PUBLIC_ASK_SHOW_MODES=1` |
| صوت LegalChat | الصفحة تحوّل إلى Ask، فالصوت غير ظاهر |
| `/api/attachments` استخراج النص | `extractedText: null` (TODO) — Ask يستخدم استخراجًا مضمّنًا بدلًا منه |

---

## 4) خطة التنفيذ المرتبطة بالملفات الفعلية

### المرحلة أ — الأساس (بدون لمس المحرك القانوني)
1. إنشاء `components/hakeem-composer/*` و`lib/modules/hakeem-composer/*`
2. استبدال نموذج الإدخال داخل `HakeemAskWorkspace.tsx` بـ `HakeemComposer`
3. ربط: إرسال → `ask()`، إيقاف → `abort` مع تمييز إيقاف المستخدم، مسودة → `HOME_ASK_DRAFT_KEY`، مرفقات → `extractFile`

### المرحلة ب — الأدوات
4. ModeSelector → `AGENT_MODES` / `setModeId`
5. SourcesSelector → تلميحات مصدر تُمرَّر مع الطلب (مثل مسار `detailed`)
6. SlashCommandMenu → أوامر موسّعة + أوامر الوكلاء الحالية
7. MentionMenu → إدراج سياق في النص والطلب
8. VoiceButton → Web Speech API (ar-SA) كما في LegalChat
9. SmartSuggestions → حسب `surface` ووجود مرفق/محادثة

### المرحلة ج — الاختبار
10. `scripts/test-hakeem-composer.ts` + typecheck + lint + بناء موجّه

---

## 5) محظورات ملتزم بها

- لا تغيير لمحرك الاسترجاع/الوكيل إلا بإضافة تلميحات طلب اختيارية غير كاسرة
- لا كسر لجلسات `chat_conversations` الحالية
- لا أزرار بلا وظيفة
- لا بيانات وهمية في واجهة الإنتاج
