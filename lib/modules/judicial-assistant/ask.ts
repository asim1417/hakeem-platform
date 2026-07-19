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

/** يجيب على طلبٍ حرٍّ من القاضي، مؤصَّلًا بالنواة، مع سياق القضية إن وُجد. */
export async function askAssistant(question: string, kase: JudicialCase | null, actorId?: string): Promise<AskResult> {
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
