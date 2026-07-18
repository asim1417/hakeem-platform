// صياغة واعية بالوضع لـ«اسأل حكيم»: تصوغ الإخراج من **المواد المُتحقَّقة نفسها** التي أخرجها
// الوكيل (لا إعادة استرجاع) بتعليمة وضعٍ مختلفة — فيتحقّق «عقل واحد، إخراج مختلف» باستدعاء
// وكيلٍ واحد. محروسة بحارس التلفيق المشترك. لا تمسّ النواة ولا المصادقة.
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { collectAllowedArticleNumbers, verifyNarrativeGrounding } from "@/lib/modules/grounding/verify-guard";
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";

export interface ModeCitation {
  articleId?: string;
  systemName?: string | null;
  articleNumber?: number | null;
  quote?: string;
}

const PRO_DISCLAIMER =
  "تنبيه مهني: هذه المخرجات مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو بديلًا عن مراجعة محامٍ مختص.";

/**
 * يصوغ إجابة بوضعٍ معيّن اعتمادًا حصريًا على المواد المُتحقَّقة المرفقة.
 * يعيد null عند تعذّر النموذج أو رصد رقم مادة غير مؤرَّض (فيسقط المستدعي إلى عرض المواد الخام).
 */
export async function synthesizeWithMode(input: {
  query: string;
  systemPrompt: string;
  citations: ModeCitation[];
  /** تاريخ المحادثة السابق (للأوضاع الحوارية) — يُمرَّر للحفاظ على تعدّد الأدوار. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** سوابق قضائية استئناسيّة (أحكام/مبادئ) لأوضاع التحليل — سياقٌ لا سندٌ للاستشهاد بأرقام المواد. */
  supporting?: { rulings?: Array<{ title: string; snippet?: string }>; principles?: Array<{ title: string; snippet?: string }> };
  /** سقف الرموز — يُرفَع لأوضاع التحليل الطويلة (٧–٨ عناوين) لتفادي القصّ. */
  maxTokens?: number;
}): Promise<{ output: string; mode: "live" | "offline" } | null> {
  const valid = input.citations.filter((c) => typeof c.articleNumber === "number" && (c.articleNumber ?? 0) > 0);
  if (!valid.length) return null;

  const block = valid
    .map((c) => `- ${c.systemName ?? ""}، المادة ${c.articleNumber}: ${(c.quote ?? "").slice(0, 400)}`)
    .join("\n");
  // السوابق القضائية: سياقٌ استئناسيّ يوجّه التحليل والترجيح. لا تُضيف أرقام مواد فلا تمسّ حارس التأريض.
  const rul = (input.supporting?.rulings ?? []).slice(0, 6).map((r) => `- حكم: ${r.title}${r.snippet ? " — " + r.snippet.slice(0, 220) : ""}`).join("\n");
  const prin = (input.supporting?.principles ?? []).slice(0, 6).map((p) => `- مبدأ: ${p.title}${p.snippet ? " — " + p.snippet.slice(0, 220) : ""}`).join("\n");
  const supportingBlock = [rul, prin].filter(Boolean).join("\n");
  // PDPL ④: تُعمّى معرّفات الأطراف من نصّ المسألة قبل الإرسال للنموذج (المواد سياق نظاميّ محلّي).
  const facts = sanitizeForModel(input.query).text;
  const system = [
    input.systemPrompt,
    "استند حصريًا للمواد المرفقة من النواة القانونية. لا تذكر مادة ليست فيها، ولا رقم مادة غير وارد في نصّها المرفق.",
    supportingBlock ? "الأحكام والمبادئ المرفقة سياقٌ قضائيّ استئناسيّ لتوجيه التحليل والترجيح؛ لا تستشهد منها بأرقام مواد — السند النظاميّ الوحيد للأرقام هو المواد المرفقة." : "",
  ].filter(Boolean).join("\n");
  // سياق المحادثة السابق (للأوضاع الحوارية): يُعمّى ويُقتطَع لآخر ٦ رسائل حفظًا للكمون.
  const historyBlock = (input.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "المستخدم" : "حكيم"}: ${sanitizeForModel(m.content).text.slice(0, 600)}`)
    .join("\n");
  const user = [
    historyBlock ? `سياق المحادثة السابقة:\n${historyBlock}\n` : "",
    `الرسالة/المسألة الحالية:\n${facts}`,
    "",
    `المواد المرفقة من النواة (السند الوحيد المسموح):\n${block}`,
    supportingBlock ? `\nسياقٌ قضائيّ استئناسيّ (أحكام ومبادئ — لتوجيه التحليل فقط، لا للاستشهاد بأرقام مواد منها):\n${supportingBlock}` : "",
    "",
    "قاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد.",
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await callCentralProvider({ systemPrompt: system, userPrompt: user, maxTokens: Math.min(Math.max(input.maxTokens ?? 1600, 1600), 4000) }).catch(() => ({
    ok: false as const,
    content: "",
    mode: "offline" as const,
    provider: "offline",
  }));
  if (!llm.ok || !llm.content.trim()) return null;

  // حارس التلفيق: أيّ رقم مادة في الإخراج ليس ضمن المواد المرفقة ⇒ رفض (يسقط المستدعي للأساس الخام).
  const allowed = collectAllowedArticleNumbers({ numbers: valid.map((c) => c.articleNumber ?? 0) });
  if (!verifyNarrativeGrounding([llm.content], allowed).ok) return null;

  const output = llm.content.includes("تنبيه") ? llm.content : `${llm.content}\n\n${PRO_DISCLAIMER}`;
  return { output, mode: "live" };
}
