// ─────────────────────────────────────────────────────────────────────────────
// المنسّق (المرحلة ٣ — أوّلي). يوجّه: بوّابة النيّة → التكييف → التخريج (أدوات البحث).
// يتوسّع في المراحل التالية (المظانّ/التحليل/التحقّق/الحلقة/الوضعان). يبثّ خطواته عبر onStep
// (متوافق مع بثّ NDJSON القائم في الراوت). لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { classifyIntent, intentNeedsSearch } from "./intent-gate";
import { runTakyeef, type LegalIssue } from "./thinking/takyeef";
import { rankGoverningSystems, inferSpecialization, type GoverningSystem } from "./thinking/mazann";
import { verifyCitations } from "./thinking/verifier";
import { runAnalysis } from "./thinking/analysis";
import { search_articles } from "./tools";
import type { AgentStep, IntentType } from "./types";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";

export type OrchestratorMode = "quick" | "deep";

export interface OrchestratorResult {
  intent: IntentType;
  reply?: string; // للنوايا غير القانونية (ردّ مباشر بلا بحث)
  issues: LegalIssue[];
  articles: LegalCoreResult[];
  mode: OrchestratorMode;
  /** المستوى العميق فقط: الأنظمة الحاكمة المرتّبة (المظانّ). */
  governingSystems?: GoverningSystem[];
  /** المستوى العميق فقط: نصّ التحليل المستند للمواد المُتحقَّقة (أو null عند الامتناع). */
  analysis?: string | null;
}

/** يقترح المستوى تلقائيًّا من تعقيد السؤال (طوله + تعدّد الروابط/المسائل). */
export function suggestMode(query: string): OrchestratorMode {
  const q = (query || "").trim();
  const connectors = (q.match(/\bو\b|،|مع|بالإضافة|ثم|كذلك/g) ?? []).length;
  const long = q.split(/\s+/).filter(Boolean).length >= 14;
  return connectors >= 2 || long ? "deep" : "quick";
}

type OnStep = (step: AgentStep) => void;

/**
 * تشغيل المنسّق الأوّلي (وضع سريع). للنوايا غير القانونية يردّ مباشرةً بلا بحث.
 * للسؤال القانوني: يكيّف المسائل ثم يخرّج (بحث) لكلّ مسألة، ويجمع المواد بلا تكرار.
 */
export async function orchestrate(query: string, opts: { mode?: OrchestratorMode; onStep?: OnStep } = {}): Promise<OrchestratorResult> {
  const mode: OrchestratorMode = opts.mode ?? "quick";
  const onStep: OnStep = opts.onStep ?? (() => {});

  // ① بوّابة النيّة
  const intent = classifyIntent(query);
  onStep({ id: "intent", status: "done", label: "فهمت رسالتك", data: { intent: intent.type } });
  if (!intentNeedsSearch(intent.type)) {
    return { intent: intent.type, reply: intent.reply, issues: [], articles: [], mode };
  }

  // ② التكييف الأصولي: تفكيك المسائل + المناطات
  onStep({ id: "takyeef", status: "running", label: "أكيّف المسألة (تفكيك + مناط)" });
  const tk = await runTakyeef(query);
  onStep({ id: "takyeef", status: "done", label: `فكّكت ${tk.issues.length.toLocaleString("ar-SA")} مسألة`, data: { source: tk.source, issues: tk.issues.map((i) => i.issue) } });

  // ③ التخريج بحلقة تكرارية: بحث ← كشف نقص ← إعادة (بصياغة المناط) ← تكرار.
  //    سقف الجولات: ٣ (سريع) / ٧ (متعمّق). توقّف: نفاد المسائل أو بلوغ السقف.
  const cap = mode === "deep" ? 7 : 3;
  const seed = mode === "quick" ? tk.issues.slice(0, 3) : tk.issues.slice(0, 7);
  const byId = new Map<string, LegalCoreResult>();

  if (!seed.length) {
    // لا مسائل مكيّفة (سقوط) → بحث مباشر بالاستعلام.
    const res = await search_articles(query, mode === "quick" ? 8 : 12);
    if (res.ok) for (const a of res.data) if (!byId.has(a.articleId)) byId.set(a.articleId, a);
  } else {
    const queue: Array<{ iss: LegalIssue; retried: boolean }> = seed.map((iss) => ({ iss, retried: false }));
    let round = 0;
    while (queue.length && round < cap) {
      round += 1;
      const { iss, retried } = queue.shift()!;
      const q = retried && iss.manat ? [iss.manat, ...iss.keywords].join(" ") : [iss.issue, ...iss.keywords].filter(Boolean).join(" ") || query;
      onStep({ id: `round-${round}`, status: "running", label: `جولة ${round.toLocaleString("ar-SA")}: أبحث «${iss.issue.slice(0, 36)}»` });
      const before = byId.size;
      const res = await search_articles(q, mode === "quick" ? 6 : 10);
      if (res.ok) for (const a of res.data) if (!byId.has(a.articleId)) byId.set(a.articleId, a);
      const added = byId.size - before;
      onStep({ id: `round-${round}`, status: "done", label: `جولة ${round.toLocaleString("ar-SA")}: أضفتُ ${added.toLocaleString("ar-SA")} مادة`, data: { added } });
      // كشف نقص: جولة بلا إضافة ولم نُعِد بالمناط → أعِد المسألة بصياغة المناط (تنقيح موجَّه).
      if (added === 0 && !retried && iss.manat) queue.push({ iss, retried: true });
    }
  }

  const articles = [...byId.values()];
  onStep({ id: "search", status: "done", label: `خرّجت ${articles.length.toLocaleString("ar-SA")} مادة`, data: { count: articles.length } });

  // ④ المستوى المتعمّق (تتويج): المظانّ (ترتيب الأنظمة الحاكمة) + التحقّق + التحليل المستند.
  //    الوضع السريع يتخطّى هذا (خفّة وسرعة)؛ التحقّق النهائي يجري في الراوت لكلا الوضعين.
  if (mode === "deep" && articles.length) {
    onStep({ id: "mazann", status: "running", label: "أحدّد المظانّ (الأنظمة الحاكمة)" });
    const governingSystems = rankGoverningSystems(articles, inferSpecialization(query));
    onStep({ id: "mazann", status: "done", label: `رتّبت ${governingSystems.length.toLocaleString("ar-SA")} نظامًا حاكمًا`, data: { top: governingSystems.slice(0, 3).map((g) => g.systemName) } });

    onStep({ id: "verify-deep", status: "running", label: "أتحقّق من المواد قبل التحليل" });
    const outcome = await verifyCitations(
      articles.map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet }))
    );
    onStep({ id: "verify-deep", status: "done", label: `مؤصَّل ${outcome.verified.length.toLocaleString("ar-SA")} · محجوب ${outcome.blocked.length.toLocaleString("ar-SA")}` });

    onStep({ id: "analysis", status: "running", label: "أحلّل: مطابقة الأركان وموازنة وترجيح" });
    const an = await runAnalysis(query, outcome.verified);
    onStep({ id: "analysis", status: "done", label: an.abstained ? "امتنعتُ (لا سند كافٍ)" : "أنجزت التحليل المستند", data: { source: an.source } });

    return { intent: intent.type, issues: tk.issues, articles, mode, governingSystems, analysis: an.analysis };
  }

  return { intent: intent.type, issues: tk.issues, articles, mode };
}
