// ─────────────────────────────────────────────────────────────────────────────
// ResponseComposer — طبقة صياغة حيّة للردود الحوارية فقط.
// تعيد صياغة الردّ الحتمي بنموذج لغوي داخل سياج صارم: لا تضيف مادة/حكم/نظام،
// ولا تغيّر القرار ولا الأزرار ولا المعنى، ولا تَعِد بنتيجة. تمنع تكرار آخر ردّين.
// عند عدم توفّر مزوّد ذكاء أو أي فشل: تُعيد القالب الحتمي كما هو (fallback آمن).
// لا تُمسّ المخرجات القانونية (conversational===false) إطلاقاً.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export interface ComposeInput {
  /** القالب الحتمي (الردّ الأصلي) — هو الحدّ الأعلى للمعنى الذي لا يجوز تجاوزه. */
  template: string;
  /** نوع الرسالة/النيّة (لضبط النبرة). */
  messageType: string;
  /** النبرة المطلوبة (اختياري — تُشتقّ من النوع إن غابت). */
  tone?: string;
  /** تاريخ المحادثة (آخر الرسائل) — لتفادي تكرار آخر ردّين. */
  history?: { role: string; content: string }[];
}

const SIM_THRESHOLD = 0.82; // تشابه Jaccard يُعدّ تكراراً
const ARTICLE_RE = /الماد[ةه]\s*\(?\s*\d+/g;

/** تشابه Jaccard على مجموعة الكلمات (بعد تطبيع بسيط). */
export function jaccardSimilarity(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      (s || "")
        .replace(/[ً-ْـ]/g, "")
        .replace(/[^ء-ي0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1)
    );
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function toneFor(messageType: string, tone?: string): string {
  if (tone) return tone;
  if (messageType === "assistant_feedback" || messageType === "user_correction" || messageType === "frustration_or_confusion") return "هادئة بطيئة معتذرة";
  if (messageType === "report_request") return "واضحة مطمئنة";
  return "دافئة بسيطة طبيعية";
}

function buildSystemPrompt(tone: string): string {
  return [
    "أنت حكيم، مساعد قانوني سعودي. مهمتك هنا: إعادة صياغة ردّ حواري قصير بأسلوب طبيعي إنساني فقط.",
    `النبرة المطلوبة: ${tone}.`,
    "سياج صارم لا يجوز تجاوزه:",
    "- لا تُضِف أي مادة نظامية أو حكم أو رقم نظام أو استشهاد لم يكن في النص الأصلي.",
    "- لا تُغيّر المعنى ولا القرار ولا السؤال ولا الخيارات/الأزرار المذكورة.",
    "- لا تَعِد بنتيجة قضائية ولا تُبدِ رأياً قاطعاً.",
    "- حافظ على نفس عدد الأسئلة (سؤال واحد يبقى سؤالاً واحداً)، ونفس الطلب.",
    "- أعِد النص العربي فقط، بإيجاز، دون مقدمات أو شروح أو علامات تنسيق إضافية.",
  ].join("\n");
}

function lastAssistantReplies(history?: { role: string; content: string }[]): string[] {
  if (!history?.length) return [];
  return history
    .filter((m) => m.role === "assistant" && m.content?.trim())
    .slice(-2)
    .map((m) => m.content);
}

/** هل أدخلت الصياغة الجديدة مادة/رقم نظام غير موجود في القالب؟ (حارس). */
function introducesNewArticle(candidate: string, template: string): boolean {
  const inTemplate = new Set((template.match(ARTICLE_RE) ?? []).map((s) => s.replace(/\s+/g, "")));
  const inCandidate = candidate.match(ARTICLE_RE) ?? [];
  return inCandidate.some((a) => !inTemplate.has(a.replace(/\s+/g, "")));
}

/**
 * يعيد صياغة الردّ الحواري. يُعيد القالب الحتمي عند أي فشل أو offline أو خرق السياج.
 */
export async function composeReply(input: ComposeInput): Promise<string> {
  const template = (input.template ?? "").trim();
  if (!template) return input.template;

  // ملاحظة أمان (BUG fix): لا نمرّر نصّ الردود السابقة داخل الـprompt إطلاقاً
  // (يمنع تسرّب محتوى محادثة قديمة في الصياغة الجديدة). تُستخدم فقط لفحص التشابه بعد التوليد.
  const recent = lastAssistantReplies(input.history);
  const system = buildSystemPrompt(toneFor(input.messageType, input.tone));

  const userPrompt = (variation: boolean) =>
    [
      "أعد صياغة هذا الردّ بأسلوب طبيعي دافئ، دون تغيير معناه أو سؤاله أو خياراته، واعتمد على هذا النص وحده دون أي سياق آخر:",
      "«",
      template,
      "»",
      variation ? "\nمهم: نوّع الصياغة بوضوح عن أي محاولة سابقة مع بقاء نفس المعنى والسؤال." : "",
    ]
      .filter(Boolean)
      .join("\n");

  async function attempt(variation: boolean): Promise<string | null> {
    try {
      const llm = await callCentralProvider({ systemPrompt: system, userPrompt: userPrompt(variation), maxTokens: 400 });
      if (!llm.ok || !llm.content.trim()) return null;
      const candidate = llm.content.trim();
      if (introducesNewArticle(candidate, template)) return null; // خرق السياج → ارفض
      return candidate;
    } catch {
      return null;
    }
  }

  // محاولة أولى.
  let candidate = await attempt(false);
  if (!candidate) return template; // offline/فشل → القالب الحتمي

  const tooSimilar = (c: string) => recent.some((r) => jaccardSimilarity(c, r) > SIM_THRESHOLD);
  if (tooSimilar(candidate)) {
    // إعادة توليد واحدة بتعليمة تنويع.
    const retry = await attempt(true);
    if (retry && !tooSimilar(retry)) candidate = retry;
    else return template; // ما زال مكرراً أو فشل → القالب الحتمي الآمن
  }

  return candidate;
}
