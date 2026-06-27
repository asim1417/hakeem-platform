// ─────────────────────────────────────────────────────────────────────────────
// DialogueBrain — العقل النموذجي الذي يقود الحوار (إعادة هندسة طبقة الحوار).
// نداء نموذجي واحد يفهم رسالة المستخدم ويصنّفها ويصوغ الرد، ويُخرج JSON منظّمًا.
// النموذج يقود الحوار (فهمًا وصياغةً وتصنيفًا)؛ القرارات الخطرة (استرجاع/تقرير/
// استشهاد) يحرسها policy-gate لاحقًا فوق مخرجات هذا الملف — لا داخله.
//
// مبدأ السقوط الآمن: عند offline أو فشل النموذج أو خرق صيغة JSON → يعيد null،
// فيرجع المنسّق إلى المحرّك الحتمي (conversation-engine) دون تعطّل.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

/** نوايا الحوار التي يقودها النموذج (الحوار لا الأدوات). */
export const DIALOGUE_INTENTS = [
  "greeting",
  "smalltalk",
  "out_of_scope",
  "identity",
  "complaint",
  "correction",
  "legal_incident",
  "legal_request",
  "legal_followup",
  "report_request",
  "document_ref",
  "insufficient",
] as const;
export type DialogueIntent = (typeof DIALOGUE_INTENTS)[number];

export interface DialogueBrainResult {
  reply: string;
  intent: DialogueIntent;
  isLegal: boolean;
  needsLegalTools: boolean;
  readyForReport: boolean;
  incidentType: string | null;
  nextQuestion: string | null;
  suggestedButtons: string[];
  confidence: number;
  source: "model";
}

export interface DialogueBrainInput {
  message: string;
  history?: { role: string; content: string }[];
  /** ملخّص موجز لملف القضية الحالي إن وُجد (وقائع/مسار/صفة) — سياق لا أكثر. */
  caseSummary?: string | null;
  /** حالة الحوار (normal | slow_guided_intake) لضبط الإيقاع. */
  dialogueMode?: string | null;
}

// هوية حكيم — طبقة الشخصية المتّسقة (روح الأمر: عقل قانوني سعودي طبيعي وواثق).
const HAKEEM_IDENTITY = [
  "أنت «حكيم»، عقل قانوني سعودي. تتحدث بطبيعية وثقة كإنسان خبير، لا كنموذج إدخال.",
  "تعرف دورك: تساعد في المسائل القانونية والقضائية السعودية. تفهم العربية واللهجة السعودية والسخرية والمزاح.",
  "تميّز بثقة:",
  "- الأسئلة خارج نطاقك (بطاطس، مكياج، طقس، رياضة، طبخ...) → ردّ ودود قصير يوضّح أنها خارج تخصّصك القانوني، دون قالب «اكتب موضوعك».",
  "- أسئلة هويتك (ما اسمك، هل أنت عاقل) → عرّف نفسك بإيجاز وثقة.",
  "- الوقائع القانونية ولو بصياغة عامية بلا كلمة «دعوى» (اشتريت شقة وفيها عيب، انسرق جوالي، طردوني من الشغل) → افهمها واسأل سؤالًا عمليًا واحدًا.",
  "- لا تكرّر قالبًا. لا تحوّل التحية أو السوالف إلى قضية. لا تَعِد بنتيجة.",
  "- لا تستشهد بمادة أو حكم من عندك إطلاقًا — الاستشهاد يأتي من أدوات الكود فقط.",
  "كن متوازنًا: سلس كالمحادثة الطبيعية، منضبط كالقانوني المحترف.",
].join("\n");

// عقد المخرجات: JSON فقط بالحقول المحدّدة (لا نص خارجه).
const OUTPUT_CONTRACT = [
  "أعد ردّك حصراً ككائن JSON واحد صالح (دون أي نص قبله أو بعده، ودون أسوار شيفرة) بهذه الحقول:",
  '{',
  '  "reply": "نص الرد الطبيعي على المستخدم بشخصية حكيم (عربي سعودي، بلا قوالب)",',
  '  "intent": "greeting|smalltalk|out_of_scope|identity|complaint|correction|legal_incident|legal_request|legal_followup|report_request|document_ref|insufficient",',
  '  "isLegal": true|false,',
  '  "needsLegalTools": true|false,',
  '  "readyForReport": true|false,',
  '  "incidentType": "نص أو null",',
  '  "nextQuestion": "سؤال عملي واحد أو null",',
  '  "suggestedButtons": ["خيار", "خيار"],',
  '  "confidence": 0.0',
  '}',
  "قواعد: needsLegalTools=true فقط إذا كان الطلب قانونيًا ويحتاج بحثًا في الأنظمة.",
  "readyForReport=true فقط إذا اكتملت وقائع القضية بما يكفي لتقرير. سؤال واحد كحدّ أقصى في nextQuestion.",
].join("\n");

const schema = z.object({
  reply: z.string().min(1),
  intent: z.enum(DIALOGUE_INTENTS),
  isLegal: z.boolean(),
  needsLegalTools: z.boolean(),
  readyForReport: z.boolean(),
  incidentType: z.string().nullable().optional(),
  nextQuestion: z.string().nullable().optional(),
  suggestedButtons: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/** يستخرج أول كائن JSON من نص النموذج (يتحمّل أسوار الشيفرة والنص الزائد). */
export function extractJsonObject(text: string): unknown | null {
  if (!text) return null;
  const fenced = text.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildUserPrompt(input: DialogueBrainInput): string {
  const recent = (input.history ?? [])
    .filter((m) => m.content?.trim())
    .slice(-6)
    .map((m) => `${m.role === "assistant" ? "حكيم" : "المستخدم"}: ${m.content.trim()}`)
    .join("\n");
  return [
    input.caseSummary?.trim() ? `سياق ملف القضية الحالي (للفهم فقط، لا تُعِد عرضه):\n${input.caseSummary.trim()}` : "",
    input.dialogueMode === "slow_guided_intake" ? "ملاحظة: المستخدم طلب التمهّل سابقًا — لا تتسرّع ولا تفترض." : "",
    recent ? `آخر رسائل المحادثة:\n${recent}` : "",
    `رسالة المستخدم الآن:\n«${input.message.trim()}»`,
    "",
    OUTPUT_CONTRACT,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * يقود الحوار عبر نداء نموذجي واحد. يعيد نتيجة مُصدَّقة، أو null عند أي تعذّر
 * (offline/فشل/JSON غير صالح) فيستعمل المنسّق المحرّك الحتمي الاحتياطي.
 */
export async function runDialogueBrain(input: DialogueBrainInput): Promise<DialogueBrainResult | null> {
  const message = (input.message ?? "").trim();
  if (!message) return null;

  let llm: { ok: boolean; content: string };
  try {
    llm = await callCentralProvider({
      systemPrompt: HAKEEM_IDENTITY,
      userPrompt: buildUserPrompt(input),
      maxTokens: 700,
    });
  } catch {
    return null;
  }
  if (!llm.ok || !llm.content.trim()) return null; // offline/فشل → سقوط حتمي

  const parsed = extractJsonObject(llm.content);
  const safe = schema.safeParse(parsed);
  if (!safe.success) return null; // JSON غير مطابق → سقوط حتمي

  const d = safe.data;
  return {
    reply: d.reply.trim(),
    intent: d.intent,
    isLegal: d.isLegal,
    needsLegalTools: d.needsLegalTools,
    readyForReport: d.readyForReport,
    incidentType: d.incidentType?.trim() ? d.incidentType.trim() : null,
    nextQuestion: d.nextQuestion?.trim() ? d.nextQuestion.trim() : null,
    suggestedButtons: (d.suggestedButtons ?? []).filter((b) => b.trim()).slice(0, 6),
    confidence: typeof d.confidence === "number" ? Math.max(0, Math.min(1, d.confidence)) : 0.5,
    source: "model",
  };
}
