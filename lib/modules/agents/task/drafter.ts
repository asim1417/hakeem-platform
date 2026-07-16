// ─────────────────────────────────────────────────────────────────────────────
// وكيل الصياغة (المرحلة ٦) — يصوغ مستندات قانونية بقوالب، بمعيار «أمان» التحريري:
// RTL، ترقيم عربي، عربية فصيحة، كل جملة مختلطة عربي/إنجليزي بسطر مستقلّ. يقوده النموذج
// مع سقوط آمن. لائحة النقض تلتزم مواد ١٩٣/١٩٥/١٩٦/١٩٨ (aman-naqd). لا يلمس النواة/الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export type DraftKind =
  | "contract" // عقد
  | "objection" // لائحة اعتراضية
  | "appeal" // لائحة استئنافية
  | "naqd" // لائحة نقض
  | "reply_memo" // مذكرة جوابية
  | "record_approval"; // اعتماد محضر

export interface DraftRequest {
  kind: DraftKind;
  facts: string;
  /** استشهادات مُتحقَّقة تُدرَج في الصياغة (لا يُذكر غيرها). */
  citations?: string[];
  skillContext?: string;
}

export interface DraftResult {
  kind: DraftKind;
  title: string;
  content: string | null; // نصّ المستند (RTL) أو null عند تعذّر الصياغة
  format: "markdown-rtl";
  source: "model" | "offline";
}

const KIND_META: Record<DraftKind, { title: string; guidance: string }> = {
  contract: { title: "مسودّة عقد", guidance: "اكتب عقدًا متكامل البنود (الأطراف، المحلّ، الالتزامات، المدة، الفسخ، تسوية النزاع)." },
  objection: { title: "لائحة اعتراضية", guidance: "اكتب لائحة اعتراض على الحكم: البيانات، الأسباب النظامية، الطلبات." },
  appeal: { title: "لائحة استئنافية", guidance: "اكتب لائحة استئناف: بيانات الحكم المستأنَف، أسباب الاستئناف، الطلبات." },
  naqd: {
    title: "لائحة نقض",
    guidance:
      "اكتب لائحة نقض وفق نظام المرافعات: التزم بأسباب النقض في المواد (193) و(195) و(196) و(198): مخالفة النظام أو الخطأ في تطبيقه/تأويله، والخطأ في التكييف، ومخالفة الاختصاص، وصدور أحكام متناقضة. اذكر السبب النظامي لكل مطعن.",
  },
  reply_memo: { title: "مذكرة جوابية", guidance: "اكتب مذكرة جوابية تردّ على دعوى/لائحة الخصم نقطةً نقطة مع السند." },
  record_approval: { title: "محضر اعتماد", guidance: "اكتب محضر اعتماد/إثبات حالة موجزًا ومنظّمًا." },
};

const AMAN_STYLE = [
  "معيار أمان التحريري: اكتب بالعربية الفصحى، اتجاه RTL، وبالأرقام العربية (١٢٣).",
  "ضع كل جملة تخلط العربية بالإنجليزية في سطر مستقلّ.",
  "استند حصرًا إلى الاستشهادات المُتحقَّقة المرفقة إن وُجدت؛ لا تخترع مادة أو رقمًا.",
  "أخرِج المستند بصيغة Markdown بعناوين واضحة.",
].join(" ");

/** يصوغ المستند المطلوب. لا سقوط مخترع: عند تعذّر النموذج يعيد content=null بصدق. */
export async function draftDocument(req: DraftRequest): Promise<DraftResult> {
  const meta = KIND_META[req.kind];
  const system = `أنت صائغ قانوني سعودي خبير. ${meta.guidance} ${AMAN_STYLE}`;
  const userPrompt = [
    req.skillContext ? `منهج المهارة:\n${req.skillContext}\n` : "",
    `الوقائع/المعطيات:\n${req.facts}`,
    req.citations?.length ? `\nالاستشهادات المُتحقَّقة (السند الوحيد):\n${req.citations.join("\n")}` : "",
  ].join("\n");

  const res = await callCentralProvider({ systemPrompt: system, userPrompt, maxTokens: 1800 }).catch(() => null);
  if (res?.ok && res.mode === "server" && res.content.trim()) {
    return { kind: req.kind, title: meta.title, content: res.content.trim(), format: "markdown-rtl", source: "model" };
  }
  return { kind: req.kind, title: meta.title, content: null, format: "markdown-rtl", source: "offline" };
}
