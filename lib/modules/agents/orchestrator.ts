// ─────────────────────────────────────────────────────────────────────────────
// المنسّق (المرحلة ٣ — أوّلي). يوجّه: بوّابة النيّة → التكييف → التخريج (أدوات البحث).
// يتوسّع في المراحل التالية (المظانّ/التحليل/التحقّق/الحلقة/الوضعان). يبثّ خطواته عبر onStep
// (متوافق مع بثّ NDJSON القائم في الراوت). لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { classifyIntent, intentNeedsSearch } from "./intent-gate";
import { runTakyeef, type LegalIssue } from "./thinking/takyeef";
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

  // ③ التخريج: بحث لكلّ مسألة (وضع سريع: المسائل الأولى)، جمع بلا تكرار.
  const issuesToSearch = mode === "quick" ? tk.issues.slice(0, 3) : tk.issues.slice(0, 7);
  onStep({ id: "search", status: "running", label: "أخرّج المواد من النواة القانونية" });
  const byId = new Map<string, LegalCoreResult>();
  for (const issue of issuesToSearch) {
    const q = [issue.issue, ...issue.keywords].filter(Boolean).join(" ") || query;
    const res = await search_articles(q, mode === "quick" ? 6 : 10);
    if (res.ok) for (const a of res.data) if (!byId.has(a.articleId)) byId.set(a.articleId, a);
  }
  // لا مسائل مكيّفة (سقوط) → بحث مباشر بالاستعلام.
  if (!issuesToSearch.length) {
    const res = await search_articles(query, mode === "quick" ? 8 : 12);
    if (res.ok) for (const a of res.data) if (!byId.has(a.articleId)) byId.set(a.articleId, a);
  }
  const articles = [...byId.values()];
  onStep({ id: "search", status: "done", label: `خرّجت ${articles.length.toLocaleString("ar-SA")} مادة`, data: { count: articles.length } });

  return { intent: intent.type, issues: tk.issues, articles, mode };
}
