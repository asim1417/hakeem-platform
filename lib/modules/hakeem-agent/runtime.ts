// زمن تشغيل الوكيل الأصيل — حلقة أدوات Claude الحقيقية. Claude يستقبل السياق كاملًا،
// يقرّر (ردّ/استيضاح/أداة)، تُنفَّذ الأداة وتعود نتيجتها إليه، ويستمرّ حتى ينهي المهمّة أو
// يبلغ الحدّ الآمن. الكود لا يقرّر النيّة ولا يفرض أداة — ينفّذ ويحمي ويجمع فقط.
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";
import { collectAllowedArticleNumbers, verifyNarrativeGrounding } from "@/lib/modules/grounding/verify-guard";
import { HAKEEM_SYSTEM_PROMPT } from "./system";
import { HAKEEM_TOOL_DEFS, createAgentContext, executeTool, type RetrievedSource } from "./tools";
import { callAnthropicWithTools, type AnthropicMessage, type AnthropicContentBlock } from "./anthropic";
import { hakeemAgentMaxToolTurns } from "./flag";

export interface AgentStep {
  id: string;
  status: "running" | "done";
  label: string;
  data?: Record<string, unknown>;
}

export interface AgentBasisItem {
  systemName: string;
  articleNumber: number;
  articleTitle?: string;
  quote: string;
  state: "official";
  enforcement: string | null;
  internalUrl?: string;
}

export interface AgentResult {
  ok: boolean;
  /** الجواب النهائيّ للمستخدم (قد يكون سؤال استيضاح أو تحليلًا أو ردًّا طبيعيًّا). */
  answer: string;
  /** المصادر التي استُرجِعت واستُند إليها (للعرض والشفافية). */
  basis: AgentBasisItem[];
  toolTurns: number;
  /** سبب الفشل عند ok=false (يتيح للمسار السقوط للمسار القديم). */
  error?: string;
}

function textOf(content: AnthropicContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** يحذف الأسطر التي تحمل رقم مادةٍ غير مؤرَّض (خارج المصادر المستَرجَعة). يعيد null عند الانهيار. */
function pruneUngrounded(text: string, allowed: Set<number>): string | null {
  const lines = text.split("\n");
  const kept: string[] = [];
  let contentLines = 0;
  let removed = 0;
  for (const line of lines) {
    if (!line.trim()) { kept.push(line); continue; }
    contentLines += 1;
    if (verifyNarrativeGrounding([line], allowed).ok) kept.push(line);
    else removed += 1;
  }
  if (!contentLines || removed / contentLines > 0.4) return null;
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;
}

function buildBasis(sources: Map<string, RetrievedSource>): AgentBasisItem[] {
  return Array.from(sources.values()).map((s) => ({
    systemName: s.systemName,
    articleNumber: s.articleNumber,
    articleTitle: s.articleTitle,
    quote: s.snippet,
    state: "official" as const,
    enforcement: s.status,
    internalUrl: s.internalUrl,
  }));
}

/**
 * يشغّل الوكيل الأصيل على رسالةٍ واحدة ضمن محادثةٍ جارية. يبثّ الخطوات عبر onStep.
 * يعيد ok=false (بلا رمي) عند تعطّل المزوّد أو خطأٍ حاسم فيسقط المسار للمسار القديم.
 */
export async function runHakeemAgent(input: {
  query: string;
  document?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentResult> {
  const onStep = input.onStep ?? (() => {});
  const ctx = createAgentContext(input.document ?? "");

  // بناء المحادثة: التاريخ (مُعمّى) ثمّ الرسالة الحالية. المستند لا يُحقن في النصّ — يقرؤه
  // Claude عند الحاجة عبر read_attachment (فلا نُثقل السياق ولا نفرض قراءته).
  const messages: AnthropicMessage[] = [];
  for (const m of input.history ?? []) {
    const content = sanitizeForModel(m.content).text.slice(0, 4000);
    if (content.trim()) messages.push({ role: m.role, content });
  }
  const hasDoc = Boolean(ctx.document.trim());
  const currentText = sanitizeForModel(input.query).text.trim();
  messages.push({
    role: "user",
    content: hasDoc ? `${currentText}\n\n(أرفق المستخدم مستندًا — اقرأه بأداة read_attachment إن لزم.)` : currentText,
  });

  const maxTurns = hakeemAgentMaxToolTurns();
  let toolTurns = 0;

  for (let turn = 0; turn <= maxTurns; turn += 1) {
    const res = await callAnthropicWithTools({
      system: HAKEEM_SYSTEM_PROMPT,
      messages,
      tools: HAKEEM_TOOL_DEFS as unknown as { name: string; description: string; input_schema: unknown }[],
      maxTokens: 4096,
    });
    if (!res.ok) return { ok: false, answer: "", basis: [], toolTurns, error: res.error };

    const toolUses = res.content.filter((b): b is { type: "tool_use"; id: string; name: string; input: unknown } => b.type === "tool_use");

    // لا أدوات → هذا هو الجواب النهائيّ (ردّ مباشر أو سؤال استيضاح أو تحليل).
    if (!toolUses.length) {
      const answer = textOf(res.content);
      if (!answer) return { ok: false, answer: "", basis: [], toolTurns, error: "مخرَجٌ فارغ من النموذج." };
      // حارس الإسناد: أرقام المواد في الجواب يجب أن تكون ضمن المصادر المستَرجَعة فعلًا.
      const allowed = collectAllowedArticleNumbers({ numbers: Array.from(ctx.sources.values()).map((s) => s.articleNumber) });
      let finalText = answer;
      if (!verifyNarrativeGrounding([finalText], allowed).ok) {
        const pruned = pruneUngrounded(finalText, allowed);
        // انهيار الجواب بعد التنقية (اختراعٌ كثيف) → فشلٌ صريح لا مخرَجٌ ملفَّق.
        if (!pruned) return { ok: false, answer: "", basis: buildBasis(ctx.sources), toolTurns, error: "حجب حارس الإسناد المخرَج (استشهادٌ غير مؤرَّض)." };
        finalText = pruned + "\n\n> ملاحظة: حُذفت عباراتٌ أشارت إلى مواد خارج المصادر المتحقَّقة.";
      }
      return { ok: true, answer: finalText, basis: buildBasis(ctx.sources), toolTurns };
    }

    // بلغنا الحدّ الآمن ولا يزال يطلب أدوات → نتوقّف: نعيد ما كتبه نصًّا إن وُجد، وإلا فشلٌ صريح.
    if (turn === maxTurns) {
      const partial = textOf(res.content);
      if (partial) return { ok: true, answer: partial, basis: buildBasis(ctx.sources), toolTurns };
      return { ok: false, answer: "", basis: buildBasis(ctx.sources), toolTurns, error: "بلغ الوكيل حدّ استدعاءات الأدوات دون حسم." };
    }

    // نفّذ الأدوات وأعِد نتائجها إلى Claude ليقرّر الخطوة التالية.
    messages.push({ role: "assistant", content: res.content });
    const toolResults: AnthropicContentBlock[] = [];
    for (const tu of toolUses) {
      toolTurns += 1;
      onStep({ id: `tool-${toolTurns}`, status: "running", label: labelFor(tu.name) });
      const exec = await executeTool(tu.name, tu.input, ctx);
      onStep({ id: `tool-${toolTurns}`, status: "done", label: exec.label, data: { ok: exec.ok } });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(exec.data).slice(0, 60000),
        is_error: !exec.ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { ok: false, answer: "", basis: buildBasis(ctx.sources), toolTurns, error: "انتهت الحلقة دون جواب." };
}

function labelFor(tool: string): string {
  switch (tool) {
    case "resolve_scope": return "أحدّد النطاق النظاميّ";
    case "legal_search": return "أبحث في النواة القانونية";
    case "fetch_legal_source": return "أقرأ نصّ المادة";
    case "read_attachment": return "أقرأ المستند المرفق";
    case "load_skill": return "أحمّل منهج العمل المناسب";
    default: return "أنفّذ أداة";
  }
}
