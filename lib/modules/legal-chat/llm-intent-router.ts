// ─────────────────────────────────────────────────────────────────────────────
// LLMIntentRouter — طبقة فهم النية بالنموذج (المعنى لا الكلمات).
// تصنّف رسالة المستخدم الغامضة عبر النموذج المركزي (callCentralProvider) وتُخرج
// JSON منظّماً فقط. تُستعمل للحالات الغامضة فقط؛ الرسائل التافهة (تحية بحتة/حرف
// واحد/ضجيج) تُمرَّر للمصنّف الحتمي مباشرةً توفيراً للكلفة والزمن.
//
// مبدأ حاكم: النموذج يصنّف، الحتمي يحرس. هذا الملف لا يتّخذ أي قرار خطر (تشغيل
// تحليل/عرض تقرير/استشهاد مادة) — يصف النية فقط. القرارات الخطرة تبقى لبوابات
// حتمية أعلى. عند أي فشل (offline/JSON غير صالح/ثقة منخفضة) يُرجِع null فيسقط
// النظام للمصنّف الحتمي القائم دون تدهور.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { normalizeArabic } from "./taxonomy";

/** أفعال المحادثة التي يفهمها الراوتر (وصف للنية، لا قرار). */
export const CONVERSATION_ACTS = [
  "greeting",
  "smalltalk",
  "playful",
  "incomplete",
  "noise",
  "insult",
  "complaint",
  "correction",
  "non_legal_general",
  "possible_legal_issue",
  "clear_legal_incident",
  "clear_legal_request",
  "document_reference",
  "report_request",
] as const;

export type ConversationAct = (typeof CONVERSATION_ACTS)[number];

const DIALECTS = ["saudi", "msa", "mixed", "unknown"] as const;
const EMOTIONS = ["neutral", "annoyed", "confused", "urgent", "playful"] as const;
const USER_LEVELS = ["layperson", "legal_practitioner", "unknown"] as const;

export type RouterDialect = (typeof DIALECTS)[number];
export type RouterEmotion = (typeof EMOTIONS)[number];
export type RouterUserLevel = (typeof USER_LEVELS)[number];

/** مخرج الراوتر — وصفٌ للنية بالمعنى، تحرسه بوابات حتمية أعلى قبل أي إجراء. */
export interface LLMIntentResult {
  conversationAct: ConversationAct;
  isLegal: boolean;
  isReadyForLegalTools: boolean;
  dialect: RouterDialect;
  userEmotion: RouterEmotion;
  userLevel: RouterUserLevel;
  incidentType: string | null;
  legalTrack: string | null;
  normalizedMeaning: string;
  confidence: number; // 0..1
}

/** عتبة الثقة الدنيا لاعتماد مخرج الراوتر؛ دونها يسقط للحتمي. */
export const ROUTER_CONFIDENCE_THRESHOLD = 0.6;

const SYSTEM_PROMPT = [
  "أنت طبقة فهمٍ داخل شات قانوني سعودي اسمه «حكيم».",
  "مهمتك: فهم نوع رسالة المستخدم بالمعنى لا بالكلمات، بالعربية الطبيعية واللهجة السعودية.",
  "لا تفترض أن كل رسالة قانونية. والواقعة القانونية قد لا تحوي كلمة «دعوى» أو «محكمة» — افهمها بمعناها:",
  "- «اشتريت شقة ووجدت فيها عيب» = clear_legal_incident (عيب في المبيع).",
  "- «انسرق جوالي» = clear_legal_incident (سرقة/فقد).",
  "- «الشركة تطالبني بمبلغ وأنا مسدد» = clear_legal_request.",
  "- «كيفك مع السهر» أو «كيفك مع البلايستيشن» = playful (دردشة، ليست قانونية).",
  "- «طقس الصومال وأثره على العقود» = non_legal_general (سؤال ساخر، لا واقعة قانونية حقيقية).",
  "- «حلّل لي مباراة كذا» = non_legal_general ما لم توجد قرينة عقد/نزاع/حقوق بث.",
  "قواعد الإخراج:",
  "- أخرج JSON واحداً فقط، دون أي نص للمستخدم ودون شرح ودون أسوار ```.",
  "- conversationAct من هذه القيم حصراً: greeting | smalltalk | playful | incomplete | noise | insult | complaint | correction | non_legal_general | possible_legal_issue | clear_legal_incident | clear_legal_request | document_reference | report_request.",
  "- isReadyForLegalTools=true فقط إن وصف المستخدم واقعة/طلباً قانونياً ملموساً يكفي للبدء.",
  "- normalizedMeaning: إعادة صياغة موجزة جداً لمعنى الرسالة بالعربية.",
  "- confidence رقم بين 0 و1 يعبّر عن يقينك في التصنيف.",
  "الصيغة المطلوبة بالضبط:",
  '{"conversationAct":"...","isLegal":false,"isReadyForLegalTools":false,"dialect":"saudi|msa|mixed|unknown","userEmotion":"neutral|annoyed|confused|urgent|playful","userLevel":"layperson|legal_practitioner|unknown","incidentType":null,"legalTrack":null,"normalizedMeaning":"...","confidence":0.0}',
].join("\n");

/**
 * هل الرسالة تافهة الوضوح فلا تستحق نداء النموذج؟ (تحية بحتة قصيرة/حرف واحد/ضجيج).
 * هذه ليست تصنيفاً — مجرد توفير: نترك الحتمي يتولّاها. أي شكّ → نمرّرها للنموذج.
 */
export function isObviouslyTrivial(message: string): boolean {
  const n = normalizeArabic(message).trim();
  const stripped = n.replace(/\s/g, "");
  if (stripped.length <= 2) return true; // حرف/حرفان
  if (/^(.)\1{2,}$/.test(stripped)) return true; // أحرف مكررة «ههههه»/«iiii»
  // تحية بحتة قصيرة بلا أي محتوى بعدها.
  const PURE_GREETINGS = ["السلام عليكم", "سلام عليكم", "هلا", "اهلا", "مرحبا", "صباح الخير", "مساء الخير", "هاي", "هايي"];
  if (PURE_GREETINGS.includes(n) && stripped.length <= 14) return true;
  return false;
}

/** يستخلص JSON من نص قد يحوي أسوار ```json أو نصاً محيطاً. */
function extractJson(raw: string): string | null {
  let s = raw.trim();
  // إزالة أسوار الشيفرة إن وُجدت.
  s = s.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function inEnum<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

/** يتحقّق من شكل المخرج ويطبّعه؛ يُرجِع null إن غاب ما هو جوهري. */
function validate(parsed: unknown): LLMIntentResult | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;

  const act = o.conversationAct;
  if (typeof act !== "string" || !(CONVERSATION_ACTS as readonly string[]).includes(act)) return null;

  const conf = typeof o.confidence === "number" && Number.isFinite(o.confidence) ? Math.min(Math.max(o.confidence, 0), 1) : 0;
  const normalizedMeaning = asString(o.normalizedMeaning) ?? "";

  return {
    conversationAct: act as ConversationAct,
    isLegal: o.isLegal === true,
    isReadyForLegalTools: o.isReadyForLegalTools === true,
    dialect: inEnum(o.dialect, DIALECTS, "unknown"),
    userEmotion: inEnum(o.userEmotion, EMOTIONS, "neutral"),
    userLevel: inEnum(o.userLevel, USER_LEVELS, "unknown"),
    incidentType: asString(o.incidentType),
    legalTrack: asString(o.legalTrack),
    normalizedMeaning,
    confidence: conf,
  };
}

/** آخر رسالتين من المساعد لسياق مختصر (لا يُمرَّر منهما نصّ حسّاس للقرار). */
function recentContext(history?: { role: string; content: string }[]): string {
  if (!history?.length) return "";
  const last = history.slice(-3).map((m) => `${m.role === "assistant" ? "حكيم" : "المستخدم"}: ${m.content}`).join("\n");
  return last;
}

/**
 * يصنّف نية الرسالة بالنموذج. يُرجِع LLMIntentResult عند النجاح، أو null عند:
 * رسالة تافهة واضحة (للحتمي)، offline، فشل JSON، أو مخرج غير صالح.
 */
export async function classifyIntentLLM(
  userMessage: string,
  history?: { role: string; content: string }[],
  dialogueState?: { mode?: string; rejectedAssumptions?: string[] } | null
): Promise<LLMIntentResult | null> {
  const message = (userMessage ?? "").trim();
  if (!message) return null;
  if (isObviouslyTrivial(message)) return null; // وضوحٌ تامّ → الحتمي أرخص وأسرع

  const ctx = recentContext(history);
  const rejected = dialogueState?.rejectedAssumptions?.length
    ? `\nافتراضات رفضها المستخدم سابقاً (لا تَعُد إليها): ${dialogueState.rejectedAssumptions.join("، ")}`
    : "";
  const slow = dialogueState?.mode === "slow_guided_intake" ? "\n(المستخدم طلب التمهّل وعدم الافتراض المتسرّع.)" : "";

  const userPrompt = [
    ctx ? `سياق آخر الرسائل:\n${ctx}\n` : "",
    `رسالة المستخدم الآن:\n«${message}»`,
    rejected,
    slow,
    "\nصنّفها وأخرج JSON فقط.",
  ]
    .filter(Boolean)
    .join("\n");

  let res: { ok: boolean; content: string } | null = null;
  try {
    res = await callCentralProvider({ systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: 300 });
  } catch {
    return null;
  }
  if (!res?.ok || !res.content?.trim()) return null; // offline أو فشل نداء → للحتمي

  const json = extractJson(res.content);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  return validate(parsed);
}
