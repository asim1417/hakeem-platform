// ─────────────────────────────────────────────────────────────────────────────
// موجّه المعاون — عقلٌ حرّ يستفيد من نموذج الذكاء للأمور التي لا خدمةَ مخصّصة لها.
// يمرّ بخطّ التأصيل نفسه (createAgentConsultationDraft): استشهادٌ بمواد النواة أو حجبٌ صادق،
// بلا نصٍّ نظاميّ من الذاكرة. مع سياق القضية (الخريطة + المرفقات) إن وُجدت. مسودّة human-in-loop.
// ─────────────────────────────────────────────────────────────────────────────
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { JURISDICTION_LABEL } from "./labels";
import type { JudicialCase } from "./types";

export interface AskResult {
  answer: string;
  blocked: boolean;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  requestId: string;
  notice: string;
}

const NOTICE = "إجابةٌ مساعدة مسودّة، مؤصَّلةٌ بمواد النواة حيث أمكن. للمراجعة، لا حكمٌ ولا نصٌّ نظاميّ من الذاكرة.";
const BLOCKED = "لم أجد سندًا نظاميًّا كافيًا في النواة لهذا الطلب، فامتنعت عن الجزم (تعطّلٌ آمن). أعِد صياغة السؤال أو أضِف مرفقًا.";

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

function caseContext(kase: JudicialCase): string {
  const parties = kase.parties.map((p) => `${p.role}: ${p.name}`).join("، ");
  const requests = kase.requests.map((r) => r.text).join("؛ ");
  const facts = kase.facts.map((f) => f.text).join("؛ ");
  const issues = kase.issues.map((i) => i.statement).join("؛ ");
  let budget = 8_000;
  const docs = kase.attachments.map((a) => { const s = a.text.slice(0, Math.max(0, budget)); budget -= s.length; return s ? `— «${a.name}»:\n${s}` : ""; }).filter(Boolean).join("\n\n");
  return [
    `سياق القضية — نوع القضاء: ${JURISDICTION_LABEL[kase.jurisdiction]}؛ الموضوع: ${kase.subject}.`,
    parties ? `الأطراف: ${parties}.` : "",
    requests ? `الطلبات: ${requests}.` : "",
    facts ? `الوقائع: ${facts}.` : "",
    issues ? `المسائل: ${issues}.` : "",
    docs ? `مقتطفات من المرفقات:\n${docs}` : "",
  ].filter(Boolean).join("\n");
}

const GREETING = "وعليكم السلام ورحمة الله وبركاته. أنا موجّه المعاون القضائيّ.";
const GREETING_INVITE_CASE = "اطرح مسألتك عن هذه القضية — مثل: الدفوع المحتملة، موقف الإثبات، أو صياغة سؤالٍ للخصم — لأُجيبك مؤصَّلًا بالنواة وبسياق قضيتك.";
const GREETING_INVITE_GENERAL = "اطرح مسألتك القضائيّة — مثل: مدّة الاعتراض على حكم، شروط قبول الدعوى، عبء الإثبات، أو الاختصاص — لأُجيبك مؤصَّلًا بمواد النواة.";

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

  const prompt = [
    kase ? caseContext(kase) : "",
    `طلب القاضي: ${question.trim()}`,
    "أجِب مؤصَّلًا بمواد النظام الحاكم المرفقة من النواة. إن لم تكفِ فصرّح بذلك بدل الاختلاق. اكتب بالعربيّة بإيجازٍ منظّم.",
  ].filter(Boolean).join("\n\n");

  const draft = await createAgentConsultationDraft({ facts: prompt, actorId }).catch(() => null);
  const blocked = !draft || draft.blocked;
  return {
    answer: blocked ? BLOCKED : draft!.output,
    blocked,
    citations: draft?.citations ?? [],
    requestId: draft?.requestId ?? "no-ask",
    notice: blocked ? BLOCKED : NOTICE,
  };
}
