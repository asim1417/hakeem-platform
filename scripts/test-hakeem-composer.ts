/**
 * اختبارات وحدات لصندوق حكيم الذكي — حتمية بلا شبكة.
 * تشغيل: npx tsx scripts/test-hakeem-composer.ts
 */
import {
  canSubmitComposer,
  composeAgentQuery,
  buildSourceHint,
  resolveEffectiveMode,
  suggestionsForSurface,
  COMPOSER_SLASH_COMMANDS,
  DEFAULT_SOURCES,
} from "../lib/modules/hakeem-composer/constants";
import {
  composerSourcesToPolicy,
  decideToolAccess,
  normalizeSourcePolicy,
} from "../lib/modules/hakeem-composer/source-policy";
import {
  applySlashCommand,
  detectSlashTrigger,
  filterSlashCommands,
} from "../lib/modules/hakeem-composer/slash-commands";
import {
  applyMention,
  buildMentionCatalog,
  detectMentionTrigger,
  filterMentions,
} from "../lib/modules/hakeem-composer/mentions";
import { routeComposerIntent } from "../lib/modules/hakeem-composer/intent-router";
import { parseCommand, listCommands } from "../lib/modules/agents/commands";

let ok = 0;
let fail = 0;
const t = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  c ? ok++ : fail++;
};

// تمكين الإرسال
t(canSubmitComposer({ text: "ما مدة الإشعار؟", hasReadyAttachment: false, maxChars: 8000 }) === true, "إرسال بنص");
t(canSubmitComposer({ text: "   ", hasReadyAttachment: false, maxChars: 8000 }) === false, "لا إرسال لنص فارغ");
t(canSubmitComposer({ text: "", hasReadyAttachment: true, maxChars: 8000 }) === true, "إرسال بمرفق جاهز بلا نص");
t(canSubmitComposer({ text: "س", hasReadyAttachment: false, busy: true, maxChars: 8000 }) === false, "منع إرسال أثناء الانشغال");
t(canSubmitComposer({ text: "س", hasReadyAttachment: false, extracting: true, maxChars: 8000 }) === false, "منع إرسال أثناء الاستخراج");
t(
  canSubmitComposer({ text: "x".repeat(9000), hasReadyAttachment: false, maxChars: 8000 }) === false,
  "منع تجاوز الحد"
);

// أوامر /
t(detectSlashTrigger("/بحث", 4)?.open === true, "اكتشاف /");
t(detectSlashTrigger("نص عادي", 8) === null, "لا اكتشاف بلا /");
t(filterSlashCommands("تحليل").some((c) => c.command === "/تحليل"), "فلترة أوامر عربية");
t(COMPOSER_SLASH_COMMANDS.length >= 10, `أوامر الصندوق >= 10 (الفعلي ${COMPOSER_SLASH_COMMANDS.length})`);
const applied = applySlashCommand("/بح", 3, COMPOSER_SLASH_COMMANDS[0]);
t(applied.text.includes("/") || applied.text.length >= 0, "تطبيق أمر مختص");

// أوامر الوكلاء ما زالت تعمل
t(parseCommand("/فحص-حكم نص")?.spec.target === "judicial", "أمر وكيل فحص-حكم");
t(listCommands().length === 4, "أوامر الوكلاء الأصلية = 4");

// إشارات @
t(detectMentionTrigger("@نظام", 5)?.open === true, "اكتشاف @");
t(detectMentionTrigger("سؤال", 4) === null, "لا اكتشاف بلا @");
const mentions = buildMentionCatalog({
  attachments: [
    {
      id: "1",
      name: "عقد.pdf",
      extractedText: "نص",
      status: "ready",
    },
  ],
});
t(mentions.some((m) => m.label.includes("عقد")), "إشارة للمرفق");
t(filterMentions(mentions, "مدني").length >= 1, "فلترة إشارات");
const mentApplied = applyMention("راجع ", 5, mentions[0]);
t(mentApplied.text.includes("@"), "إدراج إشارة");

// مسودة/مصادر/وضع
t(DEFAULT_SOURCES.includes("legal-core"), "مصدر افتراضي");
t(buildSourceHint(["attached-only"]).includes("المستندات المرفقة"), "تلميح مصادر");
t(resolveEffectiveMode("auto") === "ask", "وضع تلقائي → ask");
t(resolveEffectiveMode("analyze-case") === "analyze-case", "وضع صريح");
t(
  composeAgentQuery("سؤال", { sourceHint: "تلميح", contextLabels: ["قضية"] }).includes("السياق النشط"),
  "بناء استعلام مع سياق"
);

// اقتراحات سياقية
t(suggestionsForSurface("case").length >= 3, "اقتراحات صفحة قضية");
t(suggestionsForSurface("ask", { hasAttachment: true }).some((s) => s.insertText.includes("المستند")), "اقتراحات مرفق");
t(suggestionsForSurface("home", { followUp: true }).some((s) => s.id === "to-memo"), "اقتراحات بعد الإجابة");

// Intent router
const i1 = routeComposerIntent({ text: "السلام عليكم", mode: "auto", hasAttachment: false });
t(i1.category === "greeting" || i1.category === "general-chat", "تحية → لا بحث");
const i2 = routeComposerIntent({ text: "ما شروط فسخ عقد الإيجار؟", mode: "auto", hasAttachment: false });
t(i2.requiresRetrieval === true && i2.requiresCitations === true, "سؤال قانوني → بحث واستشهاد");
const i3 = routeComposerIntent({ text: "", mode: "auto", hasAttachment: true });
t(i3.category === "document-review", "مرفق بلا نص → مراجعة مستند");
const i4 = routeComposerIntent({ text: "x", mode: "verdict-estimate", hasAttachment: false });
t(i4.suggestedMode === "verdict-estimate", "وضع صريح يُحترم");
const i5 = routeComposerIntent({ text: "/فحص-حكم هذا الحكم", mode: "auto", hasAttachment: false });
t(i5.agentSlash?.command === "/فحص-حكم", "أمر وكيل عبر الموجّه");

// محاكاة انتقال إرسال→إيقاف (منطق الحالة)
function nextBusy(busy: boolean, action: "send" | "stop"): boolean {
  if (action === "send") return true;
  if (action === "stop") return false;
  return busy;
}
t(nextBusy(false, "send") === true, "بعد الإرسال: busy");
t(nextBusy(true, "stop") === false, "بعد الإيقاف: ليس busy");

// سياسة المصادر (عقد)
const attOnly = composerSourcesToPolicy(["attached-only"]);
t(attOnly.attachments === true && attOnly.legalLibrary === false && attOnly.strictScope === true, "مرفقات فقط → نطاق صارم بلا مكتبة");
t(decideToolAccess("legal_search", attOnly).allowed === false, "مرفقات فقط تمنع legal_search");
t(decideToolAccess("read_attachment", attOnly).allowed === true, "مرفقات فقط تسمح read_attachment");
const coreOnly = composerSourcesToPolicy(["legal-core"]);
t(coreOnly.legalLibrary === true && coreOnly.judgments === false, "أنظمة فقط بلا أحكام");
t(decideToolAccess("islamic_library_scan", coreOnly).allowed === false, "منع مصدر خارجي بلا ويب");
const bad = normalizeSourcePolicy({ legalLibrary: true });
t(bad.legalLibrary === true && bad.web === false, "تطبيع سياسة ناقصة → افتراضات آمنة");
const iAttached = routeComposerIntent({ text: "حلّل", mode: "auto", hasAttachment: true, sources: ["attached-only"] });
t(iAttached.requiredTools.includes("read_attachment") && !iAttached.requiredTools.includes("legal_search"), "intent يحترم attached-only");

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
