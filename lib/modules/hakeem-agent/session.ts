// «الغرفة» — تحميل سياق الجلسة كاملًا من محرّك المحادثات الدائم (ChatConversation/ChatMessage)
// فيرى الوكيل الحوار من أوّله لا آخر ٨ أدوار فقط. الحفظ والاستعادة يتولّاهما العميل
// (persistAskTurn/getAskSession) عبر المحرّك نفسه؛ هذا الملف يقرأ للوكيل ويلخّص الطويل.
import { prisma } from "@/lib/prisma";
import { getConversationContext } from "@/lib/modules/conversations/engine";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";

export interface RoomContext {
  /** كامل أدوار الحوار (مستخدم/حكيم) بالترتيب. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** ملخّصٌ متدرّج لما قبل الأدوار الأخيرة (للجلسات الطويلة) — يحفظ السياق المبكّر بلا تضخّم. */
  summary: string | null;
}

// عتبة التلخيص: نُبقي آخر KEEP دورًا حرفيًّا، ونطوي ما قبلها في ملخّصٍ حين يتجاوز الحوار SUMMARIZE_AT.
const KEEP_RECENT = 20;
const SUMMARIZE_AT = 28;

/**
 * يحمّل غرفة الجلسة كاملةً للوكيل. يعيد null (بلا رمي) إن غابت الجلسة أو لم تُطبَّق سكيمة
 * المحادثات بعد — فيسقط المسار إلى تاريخ العميل الممرَّر (لا كسر للتجربة).
 */
export async function loadRoomContext(input: { userId: string; conversationId: string }): Promise<RoomContext | null> {
  try {
    const ctx = await getConversationContext({ userId: input.userId, conversationId: input.conversationId, serviceKey: "ask" });
    const turns = ctx.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content || "").trim() }))
      .filter((m) => m.content);

    if (turns.length <= SUMMARIZE_AT) return { history: turns, summary: ctx.summary ?? null };

    // حوارٌ طويل: نطوي الأقدم في ملخّصٍ ونُبقي الأحدث حرفيًّا — فيبقى السياق من الأوّل حاضرًا.
    const older = turns.slice(0, turns.length - KEEP_RECENT);
    const recent = turns.slice(-KEEP_RECENT);
    const summary = await summarizeOlder(older, ctx.summary ?? null);
    // حفظٌ أفضل-جهد للملخّص (لا يكسر عند تعذّره).
    if (summary) await prisma.chatConversation.update({ where: { id: input.conversationId }, data: { summary } }).catch(() => undefined);
    return { history: recent, summary: summary ?? ctx.summary ?? null };
  } catch {
    return null;
  }
}

const SUMMARY_SYSTEM = [
  "أنت مُلخِّصٌ لجلسة استشارةٍ قانونية في منصّة حكيم. لخّص ما سبق من الحوار تلخيصًا أمينًا موجزًا",
  "يحفظ: هويّة المسألة، الوقائع المؤكَّدة التي ذكرها المستخدم، تصحيحاته، ما اتُّفق عليه، والأسئلة المفتوحة،",
  "وأيّ موادَّ نظاميّة أُشير إليها (باسمها ورقمها كما وردا). لا تُضف تحليلًا جديدًا ولا تخترع وقائع.",
  "أخرِج فقرةً أو نقاطًا موجزة بالعربية.",
].join("\n");

/** يطوي الأدوار الأقدم في ملخّصٍ مؤصَّل بالوقائع (يبني على الملخّص السابق إن وُجد). */
async function summarizeOlder(older: Array<{ role: string; content: string }>, prev: string | null): Promise<string | null> {
  const convo = older.map((m) => `${m.role === "user" ? "المستخدم" : "حكيم"}: ${m.content}`).join("\n").slice(0, 12000);
  const userPrompt = [prev ? `ملخّصٌ سابق:\n${prev}\n` : "", `الحوار المراد طيّه في الملخّص:\n${convo}`].filter(Boolean).join("\n");
  const res = await callCentralProvider({ systemPrompt: SUMMARY_SYSTEM, userPrompt, maxTokens: 600 }).catch(() => null);
  return res && res.ok && res.content.trim() ? res.content.trim() : prev;
}
