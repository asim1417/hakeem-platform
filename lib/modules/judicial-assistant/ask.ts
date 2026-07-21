// ─────────────────────────────────────────────────────────────────────────────
// موجّه المعاون — عقلٌ حرٌّ يجيب بنموذج الذكاء المضبوط في المنصّة مباشرةً.
// يستفيد من ذكاء كلود للأمور التي لا خدمةَ مخصّصة لها، ويؤصّل إجابته بمواد النواة حين تتوفّر
// (استرجاعٌ اختياريّ لا يحجب)، مع حارسٍ يمنع نسبة أرقام موادَّ غير موجودة (لا اختلاق).
// إن لم تتوفّر مادّةٌ من النواة أجاب اجتهادًا عامًّا مُفصِحًا عن ذلك — لا امتناعَ مطلق.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { guardOutputAgainstUnknownArticleNumbers } from "@/lib/modules/legal-core/legal-citation-guard";
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import { JURISDICTION_LABEL } from "./labels";
import type { CasePassage } from "./case-search";
import { retrieveCasePassages } from "./case-vector";
import type { JudicialCase } from "./types";

export interface AskResult {
  answer: string;
  blocked: boolean;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  requestId: string;
  notice: string;
}

export const DISCLAIMER = "تنبيه: إجابةٌ مساعدة أوّليّة تحتاج مراجعة القاضي، ولا تُعدّ حكمًا ولا رأيًا نهائيًّا.";
export const NOTICE_GROUNDED = "إجابةٌ مؤصَّلةٌ بمواد النواة — مسودّة للمراجعة.";
export const NOTICE_GENERAL = "إجابةٌ اجتهاديّة عامّة (لا مادّةَ محدّدةً من النواة لهذا الطلب) — للاسترشاد ومراجعة القاضي.";
export const OFFLINE = "مزوّد النموذج غير مضبوطٍ في المنصّة، فتعذّرت الإجابة. اضبط المزوّد من إعدادات الذكاء (‏/admin/ai) ثمّ أعِد المحاولة.";
export const GUARD_FALLBACK = "أجبتُ اجتهادًا، لكن ورد في الإجابة إسنادٌ نظاميّ غير مؤكَّدٍ من النواة فحُجب حرصًا على عدم نسبة مادّةٍ غير موجودة. أعِد صياغة السؤال أو حدّد النظام محلّ السؤال.";

// ── حارس المدخل: تحيّةٌ أو مجاملةٌ لا مسألةَ قضائيّةً فيها ⇒ لا تأصيل ولا استشهاد ⇒ ردٌّ ودّيّ. ──
// يمنع أن تُسحَب مادّةٌ نظاميّة غير ذات صلة (أقرب متجهٍ) ردًّا على «السلام عليكم».
function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "") // حركات + تطويل
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
const SMALLTALK = [
  "السلام عليكم", "وعليكم السلام", "ورحمه الله وبركاته", "ورحمه الله", "وبركاته", "عليكم السلام",
  "سلام", "مرحبا", "مرحبتين", "اهلا", "اهلين", "هلا", "حياك الله", "حياك", "هاي", "هالو",
  "صباح الخير", "صباح النور", "مساء الخير", "مساء النور",
  "كيف حالك", "كيف الحال", "كيفك", "شلونك", "اخبارك", "عساك بخير",
  "شكرا", "شكرا جزيلا", "مشكور", "يعطيك العافيه", "الله يعطيك العافيه", "تسلم", "تسلمون",
  "جزاك الله خير", "جزاك الله خيرا", "بارك الله فيك", "تحيه", "تحياتي", "تمام", "طيب", "اوك", "اوكي",
  "ok", "okay", "hi", "hello", "hey", "test", "اختبار", "تجربه", "جيد", "ممتاز",
];
// عبارات المجاملة مُطبَّعةً ومرتّبةً من الأطول للأقصر كي تُزال المركّبة قبل المفردة («شكرا جزيلا» قبل «شكرا»).
const SMALLTALK_NORM = SMALLTALK.map(normalizeAr).sort((a, b) => b.length - a.length);
/** أهذا مجرّدُ تحيّةٍ/مجاملةٍ بلا مسألةٍ قضائيّة؟ (بعد إزالة عبارات المجاملة لا يبقى محتوى ذو معنى) */
function isSmalltalk(q: string): boolean {
  let t = normalizeAr(q);
  if (!t) return true;
  for (const p of SMALLTALK_NORM) t = t.split(p).join(" ");
  t = t.replace(/\b(يا|و|في|من|على|الى|عن|هل|يعني|ايه|ايوه|لا|نعم|اخي|استاذ|شيخ|دكتور|جزيلا|كثيرا|والله)\b/g, " ").replace(/\s+/g, " ").trim();
  return t.replace(/\s/g, "").length < 3;
}

export { isSmalltalk };

/** المواد التي استشهد بها المخرَج فعلًا (رقمها وارد في النصّ) — فلا تُعرض موادُّ مسترجَعة تجاهلها النموذج. */
export function citedArticles(answer: string, articles: LegalCoreResult[]): LegalCoreResult[] {
  const nums = new Set<number>();
  for (const m of answer.matchAll(/(?:المادة|مادة)\s*\(?\s*([0-9٠-٩]+)/g)) {
    const n = Number(m[1].replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (n > 0) nums.add(n);
  }
  return articles.filter((a) => nums.has(a.articleNumber));
}

export function caseContext(kase: JudicialCase, passages?: CasePassage[]): string {
  const parties = kase.parties.map((p) => `${p.role}: ${p.name}`).join("، ");
  const requests = kase.requests.map((r) => r.text).join("؛ ");
  const facts = kase.facts.map((f) => f.text).join("؛ ");
  const issues = kase.issues.map((i) => i.statement).join("؛ ");
  // مقاطعُ ذات صلة من مستندات القضية (بحثٌ فوريّ) إن مُرِّرت، وإلا مقتطفٌ مبتور احتياطيّ.
  let docs = "";
  if (passages && passages.length) {
    docs = passages.map((p) => `— «${p.attName}»:\n${p.text}`).join("\n\n");
  } else {
    let budget = 8_000;
    docs = kase.attachments.map((a) => { const s = a.text.slice(0, Math.max(0, budget)); budget -= s.length; return s ? `— «${a.name}»:\n${s}` : ""; }).filter(Boolean).join("\n\n");
  }
  return [
    `سياق القضية — نوع القضاء: ${JURISDICTION_LABEL[kase.jurisdiction]}؛ الموضوع: ${kase.subject}.`,
    parties ? `الأطراف: ${parties}.` : "",
    requests ? `الطلبات: ${requests}.` : "",
    facts ? `الوقائع: ${facts}.` : "",
    issues ? `المسائل: ${issues}.` : "",
    docs ? `مقاطعُ ذات صلة من مستندات القضية:\n${docs}` : "",
  ].filter(Boolean).join("\n");
}

export const GREETING = "وعليكم السلام ورحمة الله وبركاته. أنا موجّه المعاون القضائيّ.";
export const GREETING_INVITE_CASE = "اطرح مسألتك عن هذه القضية — مثل: الدفوع المحتملة، موقف الإثبات، أو صياغة سؤالٍ للخصم — لأُجيبك مؤصَّلًا بالنواة وبسياق قضيتك.";
export const GREETING_INVITE_GENERAL = "اطرح مسألتك القضائيّة — مثل: مدّة الاعتراض على حكم، شروط قبول الدعوى، عبء الإثبات، أو الاختصاص — لأُجيبك مؤصَّلًا بمواد النواة.";

/** يجيب على طلبٍ حرٍّ من القاضي، مؤصَّلًا بالنواة، مع سياق القضية إن وُجد. */
export async function askAssistant(question: string, kase: JudicialCase | null, actorId?: string): Promise<AskResult> {
  // حارس المدخل: تحيّةٌ/مجاملةٌ فقط ⇒ ردٌّ ودّيّ بلا تأصيلٍ ولا استشهادٍ مقحَم.
  if (isSmalltalk(question)) {
    return {
      answer: `${GREETING}\n${kase ? GREETING_INVITE_CASE : GREETING_INVITE_GENERAL}`,
      blocked: false,
      citations: [],
      requestId: "greeting",
      notice: "تحيّةٌ طيّبة — في انتظار مسألتك القضائيّة (لم يُشغَّل التأصيل).",
    };
  }

  const requestId = randomUUID();

  // ① استرجاعٌ اختياريّ من النواة (أفضل جهد، لا يحجب): مادّةٌ للتأصيل إن وُجدت لموضوع السؤال.
  const retrieveQuery = [kase?.subject, kase?.issues.map((i) => i.statement).join(" "), question].filter(Boolean).join(" ").trim();
  const articles = await retrieveGroundingArticles(retrieveQuery);
  const sourcesBlock = articles.length
    ? articles.map((a) => `- ${a.systemName}، المادة ${a.articleNumber}: ${a.articleText.slice(0, 350)}`).join("\n")
    : "";

  // بحثٌ في مستندات القضية عن أكثر المقاطع صلةً بالسؤال (دلاليٌّ إن أمكن، وإلا معجميّ).
  const passages = kase ? await retrieveCasePassages(kase, question, 6) : [];

  // ② استدعاء النموذج المضبوط في المنصّة مباشرةً (كلود عبر المزوّد المركزيّ).
  const userPrompt = [
    kase ? caseContext(kase, passages) : "",
    `طلب القاضي: ${question.trim()}`,
    sourcesBlock ? `مواد النواة المتاحة للاستشهاد (لا تستشهد بغيرها ولا تخترع رقمًا):\n${sourcesBlock}` : "لا توجد موادُّ نظاميّة مسترجَعة لهذا الطلب — أجِب اجتهادًا عامًّا دون نسبة رقم مادّةٍ لأيّ نظام.",
  ].filter(Boolean).join("\n\n");

  const llm = await callCentralProvider({
    systemPrompt: buildAskSystemPrompt(Boolean(sourcesBlock)),
    userPrompt: sanitizeForModel(userPrompt).text,
    maxTokens: 1400,
  }).catch(() => null);

  // ③ لا مزوّد مضبوط/تعذّر النموذج ⇒ إفصاحٌ صريح (لا تلفيق، لا امتناعٌ غامض).
  if (!llm || !llm.ok || !llm.content.trim()) {
    return { answer: OFFLINE, blocked: true, citations: [], requestId, notice: OFFLINE };
  }

  // ④ حارس التلفيق: أيّ رقم مادّةٍ في المخرَج ليس من المسترجَع ⇒ يُحجب المخرَج (لا مادّة غير موجودة).
  const guard = guardOutputAgainstUnknownArticleNumbers(llm.content, articles);
  if (!guard.ok) {
    return { answer: GUARD_FALLBACK, blocked: false, citations: [], requestId, notice: NOTICE_GENERAL };
  }

  const grounded = articles.length > 0;
  const citations = grounded
    ? articles.slice(0, 6).map((a) => ({ articleId: a.articleId, lawName: a.systemName, articleNumber: a.articleNumber, quote: a.articleText.slice(0, 350) }))
    : [];
  const answer = /تنبيه|لا تُعدّ حكمًا/.test(llm.content) ? llm.content : `${llm.content}\n\n${DISCLAIMER}`;

  return { answer, blocked: false, citations, requestId, notice: grounded ? NOTICE_GROUNDED : NOTICE_GENERAL };
}

/** تعليمة الموجّه: يجيب بذكاءٍ ويؤصّل بالمواد المتاحة، بلا اختلاق رقم مادّة. */
export function buildAskSystemPrompt(hasSources: boolean): string {
  return [
    "أنت «موجّه المعاون القضائيّ» داخل منصّة حكيم — مساعدٌ ذكيّ للقاضي السعوديّ.",
    "أجِب على طلب القاضي بذكاءٍ وبأسلوبٍ عربيّ منظّمٍ وعمليّ، مباشرةً وبلا حشو.",
    hasSources
      ? "استند إلى مواد النواة المرفقة، واذكرها باسم النظام ورقم المادة كما وردت. لا تستشهد بمادّةٍ أو رقمٍ غير موجودٍ في المرفق."
      : "لم تُرفَق موادُّ من النواة؛ أجِب اجتهادًا عامًّا مفيدًا دون نسبة رقم مادّةٍ لأيّ نظام، وصرّح بأنّ الإجابة عامّة تحتاج تحقّقًا نظاميًّا.",
    "لا تختلق مادّةً ولا رقم مادّة ولا حكمًا. إن كان الطلب خارج المجال القضائيّ/القانونيّ فوجّه بلُطفٍ لطرح مسألةٍ قضائيّة.",
    "اختم بسطرٍ يوضّح أنّ الإجابة مساعدة أوّليّة تحتاج مراجعة القاضي ولا تُعدّ حكمًا.",
  ].join("\n");
}

/** استرجاعٌ اختياريّ لمواد النواة (أفضل جهد). فشلٌ ⇒ [] فلا يُعطَّل الموجّه. */
export async function retrieveGroundingArticles(query: string): Promise<LegalCoreResult[]> {
  if (query.replace(/\s/g, "").length < 4) return [];
  try {
    const { runCaseAgent } = await import("@/lib/modules/agents/case-agent-bridge");
    const agent = await runCaseAgent(query);
    return agent.grounded ? agent.articles.slice(0, 6) : [];
  } catch {
    return [];
  }
}
