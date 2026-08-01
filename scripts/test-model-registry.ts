// اختبار سجلّ النماذج (§17) — بلا شبكة ولا قاعدة بيانات.
import {
  listModels,
  getModel,
  registryDefaultModel,
  resolveModelForTask,
  isTaskApproved,
} from "../lib/modules/ai/model-registry";
import { defaultModelFor } from "../lib/modules/ai/ai-config";

let failures = 0;
function assert(c: boolean, m: string) {
  if (!c) { failures++; console.error("✗", m); } else console.log("✓", m);
}

assert(listModels().length >= 4, "السجلّ يحوي النماذج الأساسية");
assert(getModel("anthropic", "claude-3-5-sonnet-latest") !== null, "استرجاع نموذج مسجَّل");
assert(registryDefaultModel("anthropic") === "claude-3-5-sonnet-latest", "الافتراضيّ المسجَّل لـ anthropic");
assert(resolveModelForTask("gemini", "ocr")?.model === "gemini-2.5-flash", "توجيه مهمّة OCR إلى gemini");
assert(isTaskApproved("anthropic", "claude-3-5-sonnet-latest", "deep-analysis"), "اعتماد مهمّة التحليل العميق");
assert(!isTaskApproved("openai", "gpt-4o-mini", "ocr"), "رفض مهمّة غير معتمدة");

// عدم كسر السلوك: defaultModelFor يطابق الثابت القديم عند غياب env.
const prev = process.env.ANTHROPIC_MODEL;
delete process.env.ANTHROPIC_MODEL;
assert(defaultModelFor("anthropic") === "claude-3-5-sonnet-latest", "defaultModelFor(anthropic) سلوكٌ مطابق");
assert(defaultModelFor("openai") === "gpt-4o-mini", "defaultModelFor(openai) سلوكٌ مطابق");
assert(defaultModelFor("offline") === "offline", "defaultModelFor(offline) سلوكٌ مطابق");
if (prev !== undefined) process.env.ANTHROPIC_MODEL = prev;

if (failures) { console.error(`\nفشل ${failures} تحقّق.`); process.exit(1); }
console.log("\nسجلّ النماذج: كل التحقّقات ناجحة.");
