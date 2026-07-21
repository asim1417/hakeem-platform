// ─────────────────────────────────────────────────────────────────────────────
// محرّك موجّه المعاون = **محرّك «اسأل حكيم» نفسه** (لا نسخة أخفّ): المنسّق (orchestrate)
// + التحقّق (verifyCitations) + الصياغة المستندة (synthesizeWithMode) — بنفس المزوّد
// المركزيّ ومفاتيحه (resolveAiConfig)، فلا مفاتيحَ جديدة. الاختلاف البسيط: تعليمة الوضع
// القضائيّ (persona المعاون) + حقن سياق القضية. يرث حارس التلفيق والحجب الصادق.
// ─────────────────────────────────────────────────────────────────────────────
import { orchestrate } from "@/lib/modules/agents/orchestrator";
import { intentNeedsSearch } from "@/lib/modules/agents/intent-gate";
import { verifyCitations } from "@/lib/modules/agents/thinking/verifier";
import { synthesizeWithMode } from "@/lib/modules/agents/mode-synthesis";

export interface JudicialAgentStep { id: string; status: string; label: string }
export interface JudicialCitation { articleId?: string; systemName: string; articleNumber: number; quote: string }
export interface JudicialAgentResult {
  answer: string | null;
  blocked: boolean;
  citations: JudicialCitation[];
  notice: string;
}

// الاختلاف البسيط عن «اسأل حكيم»: persona المعاون القضائيّ (يخاطب القاضي، مسودّة لا حكم).
const JUDICIAL_PROMPT = [
  "أنت «موجّه المعاون القضائيّ» داخل منصّة حكيم — تعين القاضي السعوديّ في تحليل مسألته.",
  "حلّل المسألة مؤصَّلًا بمواد النظام الحاكم المرفقة من النواة، بأسلوبٍ قضائيّ منظّمٍ وعمليّ.",
  "خاطب القاضي بصيغة المعاون، وابنِ التحليل: المسألة ← القاعدة النظاميّة ← التطبيق ← الخلاصة.",
  "المخرَج مسودّةٌ تحتاج مراجعة القاضي واعتماده؛ لا تعتمد حكمًا ولا رأيًا نهائيًّا.",
].join("\n");

const NOTICE_OK = "إجابةٌ مؤصَّلةٌ بمواد النواة (بمحرّك «اسأل حكيم» نفسه) — مسودّة لمراجعتك.";
const NOTICE_BLOCK = "لا سندَ نظاميٌّ كافٍ مطابقٌ في النواة لهذا الطلب، فامتنعتُ عن الجزم (تعطّلٌ آمن). أعِد صياغة السؤال أو أضِف مرفقًا.";
const NOTICE_INTENT = "ليست مسألةً قضائيّة تستدعي بحثًا في النواة.";

/**
 * يشغّل محرّك «اسأل حكيم» بوضعٍ قضائيّ. onStep يبثّ خطوات المنسّق حيًّا (للواجهة الحيّة).
 * سقوطٌ آمن في كلّ خطوة: خطأ المنسّق ⇒ حجبٌ صادق؛ تعذّر الصياغة ⇒ عرض المواد المُتحقَّقة.
 */
export async function runJudicialAgent(query: string, opts: { onStep?: (s: JudicialAgentStep) => void } = {}): Promise<JudicialAgentResult> {
  const result = await orchestrate(query, { mode: "deep", skipBreadth: true, skipAnalysis: true, onStep: opts.onStep }).catch(() => null);
  if (!result) return { answer: null, blocked: true, citations: [], notice: NOTICE_BLOCK };

  // نيّة غير قانونية (تحية/تعريف/خارج النطاق) → ردّ المنسّق المباشر إن وُجد.
  if (!intentNeedsSearch(result.intent)) {
    return { answer: result.reply ?? null, blocked: !result.reply, citations: [], notice: NOTICE_INTENT };
  }

  // التحقّق (حارس التلفيق): كلّ مادّة مُخرَّجة تُتحقَّق فعلًا في النواة.
  opts.onStep?.({ id: "verify", status: "running", label: "أتحقّق من ورود المواد في النواة" });
  const outcome = await verifyCitations(
    (result.articles ?? []).map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet })),
  ).catch(() => ({ verified: [] as Array<{ articleId?: string; systemName?: string; articleNumber?: number; quote?: string }> }));
  opts.onStep?.({ id: "verify", status: "done", label: `تحقّقت: ${outcome.verified.length} مادّة مؤكَّدة` });

  const citations: JudicialCitation[] = outcome.verified.map((c) => ({ articleId: c.articleId, systemName: c.systemName ?? "", articleNumber: c.articleNumber ?? 0, quote: c.quote ?? "" }));

  // حارس الترابط: لا سندَ مُتحقَّق → امتناعٌ صادق.
  if (!citations.length) return { answer: null, blocked: true, citations: [], notice: NOTICE_BLOCK };

  // الصياغة المستندة بوضع المعاون القضائيّ (نفس محرّك «اسأل حكيم»).
  opts.onStep?.({ id: "synthesize", status: "running", label: "أصوغ التحليل مستندًا للمواد" });
  const synth = await synthesizeWithMode({
    query,
    systemPrompt: JUDICIAL_PROMPT,
    citations: outcome.verified.map((c) => ({ articleId: c.articleId, systemName: c.systemName, articleNumber: c.articleNumber, quote: c.quote })),
    supporting: {
      rulings: (result.rulings ?? []).map((r) => ({ title: r.title, snippet: r.snippet })),
      principles: (result.principles ?? []).map((p) => ({ title: p.title, snippet: p.snippet })),
    },
    maxTokens: 2400,
  }).catch(() => null);
  opts.onStep?.({ id: "synthesize", status: "done", label: "صغتُ التحليل مستندًا للمواد" });

  // تعذّرت الصياغة → عرض المواد المُتحقَّقة (لا تلفيق).
  if (!synth) {
    const list = citations.map((c) => `- ${c.systemName}، المادة ${c.articleNumber}: ${c.quote.slice(0, 200)}`).join("\n");
    return { answer: `تعذّرت الصياغة المستندة؛ وهذه المواد المُتحقَّقة من النواة:\n${list}`, blocked: false, citations, notice: NOTICE_OK };
  }
  return { answer: synth.output, blocked: false, citations, notice: NOTICE_OK };
}
