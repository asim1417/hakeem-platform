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
import { resolveAiConfig, streamWithConfig } from "@/lib/modules/ai/ai-config";

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

  // ④ لا سند نظاميّ في النواة: بدل الامتناع الكامل، إن كانت للقضية مادّةٌ (مستندات/وقائع) نجيب
  //    منها مباشرةً — تلخيصٌ/تنظيمٌ لسؤال القاضي عن قضيته، لا حكمٌ ولا اختلاق مادّةٍ نظاميّة.
  if (r.blocked || !r.answer) {
    const material = kase ? caseContext(kase, passages) : "";
    const hasCaseMaterial = Boolean(kase && (passages.length || kase.attachments.length || kase.facts.length || kase.requests.length));
    if (hasCaseMaterial && material.trim()) {
      yield* streamFromCaseMaterial(question, material, requestId);
      return;
    }
    yield { type: "done", blocked: true, citations: [], notice: r.notice, answer: r.answer || r.notice, requestId };
    return;
  }

  // ⑤ بثّ التحليل المؤصَّل كلمةً كلمةً (تجربةٌ حيّة).
  for (const w of r.answer.split(/(\s+)/)) if (w) yield { type: "delta", text: w };

  const citations: AskCitation[] = r.citations.map((c) => ({ articleId: c.articleId ?? "", lawName: c.systemName, articleNumber: c.articleNumber, quote: c.quote.slice(0, 350) }));
  yield { type: "done", blocked: false, citations, notice: r.notice, answer: r.answer, requestId };
}

// ─────────────────────────────────────────────────────────────────────────────
// سقوطٌ على مادّة القضية: حين لا يُطابَق سندٌ نظاميّ في النواة، نجيب سؤال القاضي عن قضيته
// اعتمادًا على **مستنداته ووقائعه** فقط (تلخيصٌ/تنظيمٌ)، بلا حكمٍ نهائيّ ولا اختلاق مادّةٍ
// نظاميّة. مُعلَّمٌ بوضوح أنّه من مستندات القضية لا من النواة. سقوطٌ حتميّ لعرض المادّة عند غياب المفتاح.
// ─────────────────────────────────────────────────────────────────────────────
const CASE_MATERIAL_NOTICE =
  "إجابةٌ مبنيّةٌ على مستندات قضيتك ووقائعها — لا على مادّةٍ نظاميّة من النواة (لم يُطابَق سندٌ نظاميّ بعد). مسودّةٌ تحتاج مراجعتك.";

async function* streamFromCaseMaterial(question: string, material: string, requestId: string): AsyncGenerator<AskStreamEvent> {
  yield { type: "stage", label: "ألخّص من مستندات قضيتك", state: "active" };
  const system = [
    "أنت المعاون القضائيّ في منصّة حكيم. أجب عن سؤال القاضي اعتمادًا على مستندات القضية ووقائعها المرفقة **فقط**.",
    "لا تُصدر حكمًا نهائيًّا، ولا تخترع مادّةً نظاميّة أو رقم مادةٍ من الذاكرة. إن استلزم الجواب سندًا نظاميًّا ولم يُتَح فصرّح بذلك صراحةً.",
    "انسب كلّ واقعةٍ لمصدرها في المستندات، وميّز الثابت عن المُدّعى. اكتب بالعربية بأسلوبٍ قضائيّ منظّم.",
  ].join("\n");
  const user = `سؤال القاضي:\n${question.trim()}\n\nمادّة القضية (مستندات ووقائع):\n${material}`;

  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    // لا مفتاح نموذج: نعرض مادّة القضية كما هي (لا اختلاق).
    const text = material.slice(0, 4000);
    for (const w of text.split(/(\s+)/)) if (w) yield { type: "delta", text: w };
    yield { type: "stage", label: "عرضٌ مباشرٌ لمادّة القضية (مزوّد النموذج غير مضبوط)", state: "done" };
    yield { type: "done", blocked: false, citations: [], notice: CASE_MATERIAL_NOTICE, answer: text, requestId };
    return;
  }

  let acc = "";
  try {
    for await (const chunk of streamWithConfig(cfg, system, user, 1400)) { acc += chunk; yield { type: "delta", text: chunk }; }
  } catch {
    /* يُعرَض ما تجمّع */
  }
  yield { type: "stage", label: "لخّصتُ من مستندات قضيتك", state: "done" };
  const answer = acc.trim() || material.slice(0, 2000);
  yield { type: "done", blocked: false, citations: [], notice: CASE_MATERIAL_NOTICE, answer, requestId };
}
