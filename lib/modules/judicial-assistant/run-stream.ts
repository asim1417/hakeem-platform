// ─────────────────────────────────────────────────────────────────────────────
// بثٌّ حيّ لمخرَج الخدمات النموذجيّة (كتابةٌ تدريجيّة كـ«اسأل حكيم») — يتفادى 504 ويتيح
// مخرجاتٍ أوفى. يعيد استخدام وكيل الأنظمة (runCaseAgent) للتأصيل، ثمّ يبثّ التوليد
// عبر streamWithConfig. مؤصَّلٌ بالنواة أو من مستندات القضية عند غيابها — بلا اختلاق.
// ─────────────────────────────────────────────────────────────────────────────
import { runCaseAgent } from "@/lib/modules/agents/case-agent-bridge";
import { resolveAiConfig, streamWithConfig } from "@/lib/modules/ai/ai-config";
import { caseContext } from "./ask";
import { WORK_SPECS } from "./works";
import { SERVICE_BY_ID } from "./catalog";
import type { JudicialCase, StudyDepth } from "./types";

export type RunStreamEvent =
  | { type: "stage"; label: string; state: "active" | "done" }
  | { type: "delta"; text: string }
  | { type: "done"; blocked: boolean; citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>; notice: string };

/** سباقٌ بمهلة: يمنع تجميد البثّ إن تعثّر/تعلّق التأصيل العميق — يسقط لمسار مادّة القضية. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("grounding-timeout")), ms)),
  ]);
}

const DEPTH_HINT: Record<StudyDepth, string> = { short: "بإيجازٍ مركّز", medium: "بتفصيلٍ متوسّط", extended: "بتوسّعٍ وتحليلٍ للبدائل" };

/** تعليمة العمل لكلّ خدمة نموذجيّة (الأعمال من WORK_SPECS، والبقيّة معرّفةٌ هنا). */
function directiveFor(serviceId: string, depth?: StudyDepth): string {
  if (WORK_SPECS[serviceId]) return WORK_SPECS[serviceId].directive;
  if (serviceId === "JS-001") return "اكتب ملخّصًا تنفيذيًّا شاملًا لحالة القضية: الأطراف، الطلبات، أبرز الوقائع، المسائل محلّ الفصل، الموقف الإجرائيّ، والأساس النظاميّ إن توفّر.";
  if (serviceId === "JS-013") return `أعدّ دراسةً قضائيّة ${DEPTH_HINT[depth ?? "medium"]} لمسائل القضية: التكييف القانونيّ لكلّ مسألة، القاعدة النظاميّة الحاكمة، التطبيق على الوقائع، والبدائل مع الترجيح.`;
  if (serviceId === "JS-018") return "صُغ مشروع حكمٍ متكامل: الديباجة، الوقائع، المسائل محلّ الفصل، الأسباب (تسبيبٌ مؤصَّل: واقعة← قاعدة← تطبيق← نتيجة)، والمنطوق المقترح دون تجاوز الطلبات.";
  return "حلّل القضية وأعدّ العمل القضائيّ المطلوب بأسلوبٍ منظّم.";
}

/** يبثّ مخرَج خدمةٍ نموذجيّة حيًّا (Markdown)، مؤصَّلًا بالنواة أو بمستندات القضية. */
export async function* streamService(kase: JudicialCase, serviceId: string, depth?: StudyDepth): AsyncGenerator<RunStreamEvent> {
  const directive = directiveFor(serviceId, depth);
  const facts = [`المطلوب: ${directive}`, caseContext(kase)].filter(Boolean).join("\n\n");

  // التأصيل العميق يجري قبل أوّل حرفٍ مبثوث؛ نُظهر خطوةً حيّة كي لا يبدو التوليد متوقّفًا،
  // ونحرسه بمهلةٍ (يُسقِط لمسار مادّة القضية) فلا يتجمّد البثّ إن تعثّر البحث العميق.
  yield { type: "stage", label: "أبحث في النواة القانونيّة (بحثٌ عميق)", state: "active" };
  const agent = await withTimeout(runCaseAgent(facts), 90_000).catch(() => null);
  const articles = agent?.articles ?? [];
  const grounded = Boolean(agent?.grounded && articles.length);
  yield { type: "stage", label: grounded ? `وجدتُ ${articles.length} مادّة مؤصِّلة` : "لا مادّة نظاميّة مطابقة — أعتمد مادّة القضية", state: "done" };
  const citations = articles.slice(0, 8).map((a) => ({ articleId: a.articleId, lawName: a.systemName, articleNumber: a.articleNumber, quote: a.articleText.slice(0, 350) }));

  const system = [
    "أنت المعاون القضائيّ في منصّة حكيم. أنجِز المطلوب بأسلوبٍ قضائيّ منظّم وبصيغة Markdown (عناوين ##، قوائم، وغامق للعناصر المهمّة).",
    grounded
      ? "استند حصريًّا لمواد النواة المرفقة عند الاستشهاد النظاميّ، ولا تخترع مادّةً أو رقم مادة. الأحكام والمبادئ سياقٌ استئناسيّ للترجيح لا للاستشهاد بأرقام مواد منها."
      : "لا تتوفّر مادّةٌ نظاميّة مطابقة في النواة؛ أنجِز المطلوب من مستندات القضية ووقائعها فقط، وصرّح بغياب السند النظاميّ صراحةً. لا تخترع مادّةً أو رقم مادة.",
    "لا تُصدر حكمًا نهائيًّا؛ المخرَج مسودّةٌ تحتاج اعتماد القاضي. اختم بتنبيهٍ مهنيّ مختصر.",
  ].join("\n");
  const user = grounded ? `${facts}\n\n${agent!.groundingText}` : facts;

  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    yield { type: "delta", text: `> مزوّد النموذج غير مضبوطٍ حاليًّا؛ إليك مادّة القضية:\n\n${facts.slice(0, 3000)}` };
    yield { type: "done", blocked: !grounded && citations.length === 0, citations, notice: "عُرضت مادّة القضية دون توليدٍ نموذجيّ (المزوّد غير مضبوط)." };
    return;
  }

  yield { type: "stage", label: "أصوغ المخرَج", state: "active" };
  // توليدٌ مفتوح بلا سقفٍ مصطنع: بحدّ النموذج الأقصى في كلّ نداء، ونواصل بجولةٍ تالية إن توقّف
  // لبلوغ الحدّ (لا لانتهاء المعنى) — حتى يُكمل النموذج العمل القضائيّ مهما اتّسع.
  let any = false;
  let acc = "";
  try {
    let round = 0;
    for (;;) {
      const meta = { truncated: false };
      const roundUser = round === 0
        ? user
        : `${user}\n\n— ما كُتب حتى الآن (تابع من حيث توقفت تمامًا، دون تكرارٍ ولا إعادة عنوان):\n${acc}`;
      let produced = false;
      for await (const chunk of streamWithConfig(cfg, system, roundUser, 8192, meta)) {
        any = true; produced = true; acc += chunk; yield { type: "delta", text: chunk };
      }
      round += 1;
      if (!meta.truncated || !produced) break;
    }
  } catch {
    /* يُعرَض ما تجمّع */
  }
  if (!any) yield { type: "delta", text: "تعذّر توليد المخرَج من النموذج؛ أعِد المحاولة." };
  yield {
    type: "done",
    blocked: false,
    citations,
    notice: grounded
      ? "مسودّةٌ مؤصَّلةٌ بمواد النواة — تخضع لمراجعة القاضي واعتماده."
      : "مسودّةٌ مبنيّةٌ على مستندات قضيتك (لا سند نظاميّ مطابق في النواة بعد) — تخضع لمراجعتك.",
  };
}

/** عنوان الخدمة للعرض في لوحة النتيجة الحيّة. */
export function serviceTitle(serviceId: string): string {
  return SERVICE_BY_ID[serviceId]?.title ?? serviceId;
}
