// ─────────────────────────────────────────────────────────────────────────────
// موجّه المعاون — البثّ الحيّ فوق **محرّك «اسأل حكيم» نفسه** (runJudicialAgent): مؤشّرات
// خطوات المنسّق الحيّة (فهم/تخريج/تحقّق/صياغة)، ثمّ بثّ التحليل المؤصَّل كلمةً كلمةً.
// بنفس المزوّد ومفاتيحه — لا مفاتيحَ جديدة. الاختلاف البسيط: سياق القضية + وضع المعاون.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import type { JudicialCase } from "./types";
import { isSmalltalk, caseContext, GREETING, GREETING_INVITE_CASE, GREETING_INVITE_GENERAL } from "./ask";
import { retrieveCasePassages } from "./case-vector";
import { runJudicialAgent, type JudicialAgentStep } from "./agent";

export type AskCitation = { articleId: string; lawName: string; articleNumber: number; quote: string };

/** حدثٌ من أحداث البثّ الحيّ. */
export type AskStreamEvent =
  | { type: "stage"; label: string; state: "active" | "done" }
  | { type: "delta"; text: string }
  | { type: "done"; blocked: boolean; citations: AskCitation[]; notice: string; answer: string; requestId: string; greeting?: boolean };

/** يبثّ إجابة الموجّه حيًّا: خطوات محرّك «اسأل حكيم» ثمّ التحليل كلمةً كلمةً، ثمّ الختام. */
export async function* streamAsk(question: string, kase: JudicialCase | null, actorId?: string): AsyncGenerator<AskStreamEvent> {
  const requestId = randomUUID();

  // ① حارس التحيّة — ردٌّ ودّيّ مبثوثٌ كلمةً كلمةً، بلا تأصيل.
  if (isSmalltalk(question)) {
    const answer = `${GREETING}\n${kase ? GREETING_INVITE_CASE : GREETING_INVITE_GENERAL}`;
    yield { type: "stage", label: "تحيّة", state: "done" };
    for (const w of answer.split(/(\s+)/)) if (w) yield { type: "delta", text: w };
    yield { type: "done", blocked: false, citations: [], notice: "تحيّةٌ طيّبة — في انتظار مسألتك القضائيّة.", answer, requestId, greeting: true };
    return;
  }

  // ② بحثٌ في مستندات القضية (دلاليّ/معجميّ) → سياقٌ يُحقَن في محرّك الوكيل.
  if (kase && kase.attachments.length) yield { type: "stage", label: "أبحث في مستنداتك", state: "active" };
  const passages = kase ? await retrieveCasePassages(kase, question, 6) : [];
  if (kase && kase.attachments.length) {
    yield { type: "stage", label: passages.length ? `بحثتُ مستنداتك: ${passages.length} مقطعًا ذا صلة` : "بحثتُ مستنداتك: لا مقطعَ مطابق", state: "done" };
  }

  // مادّة الوكيل: مسألة القاضي أوّلًا (لتصنيف النيّة الصحيح) ثمّ سياق القضية.
  const agentQuery = [
    `مسألة القاضي: ${question.trim()}`,
    kase ? caseContext(kase, passages) : "",
  ].filter(Boolean).join("\n\n");

  // ③ محرّك «اسأل حكيم» — نجسر خطواته الحيّة (callback) إلى البثّ عبر طابورٍ لا‑متزامن.
  const queue: JudicialAgentStep[] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  const push = () => { const w = wake; wake = null; w?.(); };
  const runP = runJudicialAgent(agentQuery, { onStep: (s) => { queue.push(s); push(); } })
    .then((r) => r)
    .finally(() => { finished = true; push(); });

  let lastLabel = "";
  for (;;) {
    if (queue.length) {
      const s = queue.shift()!;
      if (s.label && s.label !== lastLabel) {
        lastLabel = s.label;
        yield { type: "stage", label: s.label, state: s.status === "done" ? "done" : "active" };
      }
      continue;
    }
    if (finished) break;
    await new Promise<void>((res) => { wake = res; });
  }

  const r = await runP;

  // ④ الحجب الصادق (لا سند مُتحقَّق) أو النيّة غير القانونية.
  if (r.blocked || !r.answer) {
    yield { type: "done", blocked: true, citations: [], notice: r.notice, answer: r.answer || r.notice, requestId };
    return;
  }

  // ⑤ بثّ التحليل المؤصَّل كلمةً كلمةً (تجربةٌ حيّة).
  for (const w of r.answer.split(/(\s+)/)) if (w) yield { type: "delta", text: w };

  const citations: AskCitation[] = r.citations.map((c) => ({ articleId: c.articleId ?? "", lawName: c.systemName, articleNumber: c.articleNumber, quote: c.quote.slice(0, 350) }));
  yield { type: "done", blocked: false, citations, notice: r.notice, answer: r.answer, requestId };
}
