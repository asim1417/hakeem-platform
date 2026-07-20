// ─────────────────────────────────────────────────────────────────────────────
// موجّه المعاون — البثّ الحيّ (كصناديق المحادثة الحيّة): مؤشّرات تفكيرٍ وبحثٍ حيّة،
// ثمّ بثّ الإجابة كلمةً كلمةً فور وصولها من النموذج. نفس ضمانات ask.ts:
// حارس التحيّة · تأصيلٌ اختياريّ · حارس التلفيق · تعمية PDPL · إفصاحٌ إن كان المزوّد غير مضبوط.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import { resolveAiConfig, streamWithConfig } from "@/lib/modules/ai/ai-config";
import { guardOutputAgainstUnknownArticleNumbers } from "@/lib/modules/legal-core/legal-citation-guard";
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";
import type { JudicialCase } from "./types";
import {
  isSmalltalk, caseContext, buildAskSystemPrompt, retrieveGroundingArticles, citedArticles,
  GREETING, GREETING_INVITE_CASE, GREETING_INVITE_GENERAL,
  DISCLAIMER, NOTICE_GROUNDED, NOTICE_GENERAL, OFFLINE, GUARD_FALLBACK,
} from "./ask";

export type AskCitation = { articleId: string; lawName: string; articleNumber: number; quote: string };

/** حدثٌ من أحداث البثّ الحيّ. */
export type AskStreamEvent =
  | { type: "stage"; label: string; state: "active" | "done" }
  | { type: "delta"; text: string }
  | { type: "done"; blocked: boolean; citations: AskCitation[]; notice: string; answer: string; requestId: string; greeting?: boolean };

/** يبثّ إجابة الموجّه حيًّا: مراحل (فهم/بحث/صياغة/تحقّق) ثمّ أجزاء النصّ، ثمّ حدث الختام. */
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

  yield { type: "stage", label: "أفهم طلبك", state: "done" };

  // ② تأصيلٌ اختياريّ من النواة (بحثٌ حيّ).
  yield { type: "stage", label: "أبحث في النواة", state: "active" };
  const retrieveQuery = [kase?.subject, kase?.issues.map((i) => i.statement).join(" "), question].filter(Boolean).join(" ").trim();
  const articles = await retrieveGroundingArticles(retrieveQuery);
  yield { type: "stage", label: articles.length ? `عُثر على ${articles.length} مادّةً ذات صلة في النواة` : "لا مادّةَ مطابقةً في النواة — سأجيب اجتهادًا", state: "done" };

  const sourcesBlock = articles.length
    ? articles.map((a) => `- ${a.systemName}، المادة ${a.articleNumber}: ${a.articleText.slice(0, 350)}`).join("\n")
    : "";

  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    yield { type: "stage", label: "المزوّد غير مضبوط", state: "done" };
    yield { type: "done", blocked: true, citations: [], notice: OFFLINE, answer: OFFLINE, requestId };
    return;
  }

  // ③ صياغة الإجابة بالنموذج — بثٌّ فوريّ.
  yield { type: "stage", label: "أصوغ الإجابة بالنموذج", state: "active" };
  const userPrompt = sanitizeForModel([
    kase ? caseContext(kase) : "",
    `طلب القاضي: ${question.trim()}`,
    sourcesBlock ? `مواد النواة المتاحة للاستشهاد (لا تستشهد بغيرها ولا تخترع رقمًا):\n${sourcesBlock}` : "لا توجد موادُّ نظاميّة مسترجَعة — أجِب اجتهادًا عامًّا دون نسبة رقم مادّةٍ لأيّ نظام.",
  ].filter(Boolean).join("\n\n")).text;

  let full = "";
  try {
    for await (const delta of streamWithConfig(cfg, buildAskSystemPrompt(Boolean(sourcesBlock)), userPrompt, 1400)) {
      full += delta;
      yield { type: "delta", text: delta };
    }
  } catch {
    if (!full.trim()) {
      yield { type: "done", blocked: true, citations: [], notice: OFFLINE, answer: OFFLINE, requestId };
      return;
    }
  }

  if (!full.trim()) {
    yield { type: "done", blocked: true, citations: [], notice: OFFLINE, answer: OFFLINE, requestId };
    return;
  }

  // ④ التحقّق من الإسناد.
  yield { type: "stage", label: "أتحقّق من الإسناد", state: "done" };
  const guard = guardOutputAgainstUnknownArticleNumbers(full, articles);
  if (!guard.ok) {
    yield { type: "done", blocked: false, citations: [], notice: NOTICE_GENERAL, answer: GUARD_FALLBACK, requestId };
    return;
  }

  const cited = citedArticles(full, articles);
  const citations: AskCitation[] = cited.map((a) => ({ articleId: a.articleId, lawName: a.systemName, articleNumber: a.articleNumber, quote: a.articleText.slice(0, 350) }));
  const answer = /تنبيه|لا تُعدّ حكمًا/.test(full) ? full : `${full}\n\n${DISCLAIMER}`;
  yield { type: "done", blocked: false, citations, notice: citations.length ? NOTICE_GROUNDED : NOTICE_GENERAL, answer, requestId };
}
