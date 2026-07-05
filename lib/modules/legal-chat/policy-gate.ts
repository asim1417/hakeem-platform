// ─────────────────────────────────────────────────────────────────────────────
// PolicyGate — البوابات الحتمية الحارسة فوق مخرجات عقل الحوار (الحوكمة فوق النموذج).
// النموذج يقترح؛ الكود يقرّر القرارات الخطرة: متى يُسترجَع، متى يُعرض التقرير، وأي
// استشهاد يُسمح به. حتى لو قال النموذج «جاهز»، الكود يتحقّق. نقيّة وقابلة للاختبار.
// ─────────────────────────────────────────────────────────────────────────────
import { parseArticleNumberCandidates } from "@/lib/modules/legal-core/judgment-citation-extractor";

/** وسم سَنَد: كل مخرج قانوني يبقى «اقتراحًا يحتاج مراجعة» لا حكمًا نهائيًا. */
export const SANAD_SUGGESTION_TAG = "⚖️ هذا اقتراح أوّلي يحتاج مراجعة مختص، وليس حكمًا نهائيًا.";

/** تنويه يُضاف عند تجريد استشهاد لم يأتِ من أداة الاسترجاع (منع الهلوسة القانونية). */
export const UNSOURCED_CITATION_NOTICE =
  "ملاحظة: أزلتُ إشارة إلى رقم مادة/حكم لأنها لم تُسترجَع من النواة القانونية؛ الاستشهاد الرسمي يظهر فقط من نتائج البحث الموثّقة.";

/** حدّ جاهزية القضية لعرض التقرير (فوق موافقة المستخدم وإقرار النموذج). */
export const REPORT_READINESS_THRESHOLD = 0.6;

/** النوايا التي يجوز معها تشغيل أداة الاسترجاع (groundQuery). */
const RETRIEVAL_INTENTS = new Set(["legal_incident", "legal_request", "legal_followup"]);

export interface BrainGateView {
  intent: string;
  isLegal: boolean;
  needsLegalTools: boolean;
}

/**
 * البوّابة ١ — الاسترجاع: لا يعمل groundQuery إلا إذا طلب النموذج أداة، والرسالة
 * قانونية، والنيّة ضمن نوايا الاسترجاع. (حتمي فوق اقتراح النموذج.)
 */
export function allowRetrieval(b: BrainGateView): boolean {
  return b.needsLegalTools === true && b.isLegal === true && RETRIEVAL_INTENTS.has(b.intent);
}

export interface ReportGateInput {
  /** ما أقرّه النموذج (readyForReport). */
  readyForReport: boolean;
  /** موافقة المستخدم الصريحة على عرض التقرير. */
  approved: boolean;
  /** درجة جاهزية القضية [0..1] (تُحسب كوديًّا من ملف القضية). */
  readinessScore: number;
  threshold?: number;
}

/**
 * البوّابة ٢ — التقرير: لا يُعرض إلا باجتماع (إقرار النموذج + موافقة المستخدم +
 * جاهزية ≥ الحدّ). الكود يتحقّق حتى لو قال النموذج readyForReport.
 */
export function evaluateReportGate(input: ReportGateInput): { allowed: boolean; reason: string } {
  const threshold = input.threshold ?? REPORT_READINESS_THRESHOLD;
  if (!input.readyForReport) return { allowed: false, reason: "النموذج لم يُقرّ اكتمال الوقائع." };
  if (!input.approved) return { allowed: false, reason: "لم يوافق المستخدم صراحةً على عرض التقرير." };
  if (input.readinessScore < threshold)
    return { allowed: false, reason: `جاهزية القضية (${input.readinessScore.toFixed(2)}) دون الحدّ (${threshold}).` };
  return { allowed: true, reason: "مسموح: إقرار النموذج + موافقة المستخدم + جاهزية كافية." };
}

const ARTICLE_CITE_RE = /(?:ال)?ماد[ةه]\s*\(?\s*([0-9٠-٩]+(?:\s*\/\s*[0-9٠-٩]+)*)\s*\)?/g;
// الحكم/القرار يتطلّب «رقم» لتقليل الإيجابيات الكاذبة (لا نمسّ كلمة «حكم» وحدها).
const RULING_CITE_RE = /(?:ال)?(?:حكم|قرار)\s+رقم\s*\(?\s*([0-9٠-٩][0-9٠-٩/\-]*)\s*\)?/g;

/**
 * البوّابة ٣ — الاستشهاد: يجرّد من ردّ النموذج أي رقم مادة/حكم لم يأتِ من أداة
 * الاسترجاع (allowedArticleNumbers)، ويستبدله بإشارة محايدة، ويضيف تنويهًا مرة واحدة.
 * في المسار الحواري تكون المجموعة فارغة ⇒ يُجرَّد كل استشهاد رقمي (النموذج لا يستشهد).
 */
export function stripUnsourcedCitations(
  reply: string,
  allowedArticleNumbers: Set<number> = new Set()
): { text: string; strippedCount: number } {
  let strippedCount = 0;

  let text = reply.replace(ARTICLE_CITE_RE, (full: string, num: string) => {
    const candidates = parseArticleNumberCandidates(num).filter((n) => n > 0);
    if (candidates.length && !candidates.some((n) => allowedArticleNumbers.has(n))) {
      strippedCount += 1;
      return "المادة ذات الصلة";
    }
    return full;
  });

  // أرقام الأحكام لا تأتي من الأداة في المسار الحواري ⇒ تُجرَّد دائمًا.
  text = text.replace(RULING_CITE_RE, () => {
    strippedCount += 1;
    return "الحكم ذي الصلة";
  });

  if (strippedCount > 0) text = `${text.trim()}\n\n${UNSOURCED_CITATION_NOTICE}`;
  return { text, strippedCount };
}

/** البوّابة ٤ — وسم سَنَد: يضمن أن كل مخرج قانوني يحمل وسم «اقتراح يحتاج مراجعة». */
export function tagAsSuggestion(text: string): string {
  const t = (text ?? "").trim();
  if (!t) return SANAD_SUGGESTION_TAG;
  if (t.includes(SANAD_SUGGESTION_TAG)) return t;
  return `${t}\n\n${SANAD_SUGGESTION_TAG}`;
}

/** يجمع الحراسة على ردّ حواري قانوني: تجريد غير المُسنَد + وسم سَنَد عند الحاجة. */
export function guardLegalReply(
  reply: string,
  opts: { allowedArticleNumbers?: Set<number>; tagSuggestion?: boolean } = {}
): { text: string; strippedCount: number } {
  const stripped = stripUnsourcedCitations(reply, opts.allowedArticleNumbers ?? new Set());
  const text = opts.tagSuggestion ? tagAsSuggestion(stripped.text) : stripped.text;
  return { text, strippedCount: stripped.strippedCount };
}
