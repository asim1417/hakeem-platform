// ─────────────────────────────────────────────────────────────────────────────
// «المستقبِل الأوّل» — استقبالٌ ذكيّ يقوده Claude **قبل** التفكيك والدراسة الموسّعة.
//
// الفكرة: حين تكون الرسالة طلبَ مساعدةٍ بقضيةٍ (لا سؤالًا نظاميًّا مباشرًا)، يستقبلها
// Claude أوّلًا فيقيّم كفاية المعلومات: إن نقص جوهريٌّ استوضحه بأسئلةٍ موجّهة؛ وإن كفت
// وحّد الوقائع وأذِن ببدء الدراسة الموسّعة (التفكيك ← التكييف ← البحث ← الصياغة).
//
// يسقط سقوطًا آمنًا: إن كان مزوّد Claude غير مفعّل (offline) يعيد ok=false، فيتولّى
// المسار الاستيضاح الحتميّ الثابت. لا يُفتي ولا يحلّل هنا — مرحلة استقبالٍ فقط.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export interface IntakeTurn {
  role: "user" | "assistant";
  content: string;
}

export interface IntakeAssessment {
  /** استجاب المزوّد (Claude مفعّل)؟ إن false يتولّى المسار الاستيضاح الحتميّ. */
  ok: boolean;
  /** كفت المعلومات لبدء الدراسة الموسّعة؟ */
  ready: boolean;
  /** إن ready=false: أسئلة الاستيضاح المُوجّهة. إن ready=true: تأكيدٌ قصير. */
  message: string;
  /** الوقائع الموحَّدة التي جمعها المستقبِل — تُغذّى للدراسة الموسّعة عند الجاهزية. */
  consolidatedFacts?: string;
}

const SYSTEM_PROMPT = [
  "أنت «المستقبِل الأوّل» في منصّة حكيم القضائية السعودية — مرحلةٌ سابقةٌ لأيّ دراسةٍ موسّعة.",
  "مهمّتك تقييم كفاية معلومات القضية لبدء الدراسة القانونية (التفكيك ← التكييف ← البحث ← الصياغة).",
  "العناصر الجوهرية: (١) نوع النزاع بدقّة، (٢) صفة الأطراف (مدّعٍ/مدّعى عليه)، (٣) الوقائع الأساسية،",
  "(٤) الطلب المحدَّد، (٥) المستندات إن وُجدت.",
  "القاعدة: إن نقص عنصرٌ جوهريّ فاطلبه بأسئلةٍ موجزةٍ محدّدة (٢–٤ أسئلة، بلا تعداد ممل ولا تكرار",
  "ما ذكره المستخدم). إن توفّرت العناصر الكافية لتكييفٍ مبدئيّ فقرّر البدء.",
  "قيودٌ صارمة: لا تُفتِ ولا تحلّل ولا تذكر موادَّ نظامية هنا — أنت استقبالٌ فقط. لا تخترع وقائع.",
  "التزم العربية الفصحى الموجزة والصياغة القضائية المهذّبة.",
  "أخرِج JSON فقط بلا أيّ نصٍّ خارجه، بالشكل:",
  '{"ready": true|false, "message": "…", "facts": "…"}',
  "- message: إن ready=false فأسئلة الاستيضاح؛ إن ready=true فجملة تأكيدٍ قصيرة بأننا سنبدأ الدراسة.",
  "- facts: ملخّصٌ موحَّدٌ للوقائع المتوفّرة من كامل المحادثة (نصٌّ موجز؛ فارغٌ إن لا وقائع).",
].join("\n");

/** يلتقط أوّل كائن JSON من نصّ النموذج (قد يحيطه بشرحٍ رغم التوجيه). */
function parseJsonObject(text: string): { ready?: boolean; message?: string; facts?: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * يقيّم كفاية معلومات القضية عبر Claude. يعيد ok=false (بلا رمي) عند تعطّل المزوّد
 * أو فشل التحليل — فيتولّى المسار الاستيضاح الحتميّ الثابت بدلًا منه.
 */
export async function assessCaseIntake(input: { query: string; history?: IntakeTurn[] }): Promise<IntakeAssessment> {
  const convo = (input.history ?? [])
    .filter((m) => m.content?.trim())
    .map((m) => `${m.role === "user" ? "المستخدم" : "حكيم"}: ${m.content.trim()}`)
    .join("\n");
  const userPrompt = [convo, `المستخدم: ${input.query.trim()}`].filter(Boolean).join("\n");

  const res = await callCentralProvider({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 700 }).catch(() => null);
  if (!res || !res.ok || res.mode === "offline") return { ok: false, ready: false, message: "" };

  const parsed = parseJsonObject(res.content);
  if (!parsed || typeof parsed.ready !== "boolean") return { ok: false, ready: false, message: "" };

  const message = String(parsed.message ?? "").trim();
  const facts = String(parsed.facts ?? "").trim();
  // جاهزٌ بلا وقائعَ موحَّدة تناقضٌ منطقيّ — نعامله كغير جاهز فنستوضح بدل دراسةٍ بلا مادّة.
  if (parsed.ready && !facts) return { ok: true, ready: false, message: message || "" };
  return { ok: true, ready: Boolean(parsed.ready), message, consolidatedFacts: facts || undefined };
}
