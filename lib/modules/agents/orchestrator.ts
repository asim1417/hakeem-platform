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
import { search_articles, scan_system_articles } from "./tools";
import { detectDurationEnumeration, extractDurations, formatDurationTable, type DurationRow } from "./enumeration";
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

  // ①.٥ مسار الحصر الكامل للنظام: سؤال حصريّ عن مدد نظام مُسمّى → مسح فهرس النظام كاملًا
  //     واستخراج المدد حتميًّا (تغطية كاملة، لا عيّنة استرجاع). يُقدَّم كإجابة مباشرة.
  const enumReq = detectDurationEnumeration(query);
  if (enumReq) {
    onStep({ id: "scan", status: "running", label: `أمسح فهرس «${enumReq.systemName}» كاملًا لحصر المدد` });
    const scan = await scan_system_articles(enumReq.systemName);
    const rows: DurationRow[] = [];
    if (scan.ok) {
      for (const a of scan.data) {
        const durations = extractDurations(a.content);
        if (durations.length) rows.push({ articleNumber: a.articleNumber, title: a.title, durations });
      }
    }
    onStep({ id: "scan", status: "done", label: `مسحتُ ${scan.data.length.toLocaleString("ar-SA")} مادة · وجدتُ ${rows.length.toLocaleString("ar-SA")} مادة بمدد` });
    if (rows.length) {
      const table = formatDurationTable(enumReq.systemName, rows);
      return { intent: intent.type, issues: [], articles: [], mode, analysis: table };
    }
    // لا نتائج للمسح → نكمل بالمسار العادي (قد يجدها البحث الدلالي).
  }

  // ② التكييف الأصولي: تفكيك المسائل + المناطات
  onStep({ id: "takyeef", status: "running", label: "أكيّف المسألة (تفكيك + مناط)" });
  const tk = await runTakyeef(query);
  onStep({ id: "takyeef", status: "done", label: `فكّكت ${tk.issues.length.toLocaleString("ar-SA")} مسألة`, data: { source: tk.source, issues: tk.issues.map((i) => i.issue) } });

  // ③ التخريج بحلقة تكرارية: بحث ← كشف نقص ← إعادة (بصياغة المناط) ← تكرار.
  //    سقف الجولات: ٣ (سريع) / ٧ (متعمّق). توقّف: نفاد المسائل أو بلوغ السقف.
  const DEEP = mode === "deep";
  const cap = DEEP ? 7 : 3;
  const perIssue = DEEP ? 24 : 6;
  const seed = DEEP ? tk.issues.slice(0, 7) : tk.issues.slice(0, 3);
  const byId = new Map<string, LegalCoreResult>();
  const add = (rows: LegalCoreResult[]) => {
    for (const a of rows) if (!byId.has(a.articleId)) byId.set(a.articleId, a);
  };

  // (أ) بحث المسائل بحلقة تكرارية (كشف نقص → إعادة بالمناط)، بعمق أوسع في المتعمّق.
  if (!seed.length) {
    const res = await search_articles(query, DEEP ? 30 : 8);
    if (res.ok) add(res.data);
  } else {
    const queue: Array<{ iss: LegalIssue; retried: boolean }> = seed.map((iss) => ({ iss, retried: false }));
    let round = 0;
    while (queue.length && round < cap) {
      round += 1;
      const { iss, retried } = queue.shift()!;
      const q = retried && iss.manat ? [iss.manat, ...iss.keywords].join(" ") : [iss.issue, ...iss.keywords].filter(Boolean).join(" ") || query;
      onStep({ id: `round-${round}`, status: "running", label: `جولة ${round.toLocaleString("ar-SA")}: أبحث «${iss.issue.slice(0, 36)}»` });
      const before = byId.size;
      const res = await search_articles(q, perIssue);
      if (res.ok) add(res.data);
      const added = byId.size - before;
      onStep({ id: `round-${round}`, status: "done", label: `جولة ${round.toLocaleString("ar-SA")}: أضفتُ ${added.toLocaleString("ar-SA")} مادة`, data: { added } });
      if (added === 0 && !retried && iss.manat) queue.push({ iss, retried: true });
    }
  }

  // (ب) المتعمّق: مسحة بالاستعلام الخام — حاسمة لأسئلة الحصر («كل/أي المدد في نظام كذا»)
  // كي لا يقتصر على مقتطفات المسائل المفكّكة.
  if (DEEP) {
    onStep({ id: "sweep", status: "running", label: "مسحة شاملة بالاستعلام الأصلي" });
    const before = byId.size;
    const raw = await search_articles(query, 30);
    if (raw.ok) add(raw.data);
    onStep({ id: "sweep", status: "done", label: `المسحة أضافت ${(byId.size - before).toLocaleString("ar-SA")} مادة` });
  }

  let governingSystems: GoverningSystem[] | undefined;
  let analysis: string | null | undefined;

  // ④ المستوى المتعمّق: المظانّ → **تعميق موجَّه داخل كل نظام حاكم** → التحقّق → التحليل.
  if (DEEP && byId.size) {
    onStep({ id: "mazann", status: "running", label: "أحدّد المظانّ (الأنظمة الحاكمة)" });
    governingSystems = rankGoverningSystems([...byId.values()], inferSpecialization(query));
    onStep({ id: "mazann", status: "done", label: `رتّبت ${governingSystems.length.toLocaleString("ar-SA")} نظامًا حاكمًا`, data: { top: governingSystems.slice(0, 3).map((g) => g.systemName) } });

    // تعميق موجَّه بالمظانّ: لكل نظام من أعلى نظامين، بحث منحاز لتوسيع التغطية داخله.
    onStep({ id: "deepen", status: "running", label: "أقرأ مظانّ المسألة (تعميق داخل الأنظمة الحاكمة)" });
    const before = byId.size;
    for (const g of governingSystems.slice(0, 2)) {
      const r = await search_articles(`${g.systemName} ${query}`, 24);
      if (r.ok) add(r.data);
    }
    onStep({ id: "deepen", status: "done", label: `التعميق أضاف ${(byId.size - before).toLocaleString("ar-SA")} مادة` });
  }

  const articles = [...byId.values()];
  onStep({ id: "search", status: "done", label: `خرّجت ${articles.length.toLocaleString("ar-SA")} مادة`, data: { count: articles.length } });

  if (DEEP && articles.length) {
    onStep({ id: "verify-deep", status: "running", label: "أتحقّق من المواد قبل التحليل" });
    const outcome = await verifyCitations(
      articles.map((a) => ({ articleId: a.articleId, systemName: a.systemName, articleNumber: Number(a.articleNumber), quote: a.snippet }))
    );
    onStep({ id: "verify-deep", status: "done", label: `مؤصَّل ${outcome.verified.length.toLocaleString("ar-SA")} · محجوب ${outcome.blocked.length.toLocaleString("ar-SA")}` });

    onStep({ id: "analysis", status: "running", label: "أحلّل: هيكلة المسألة ومطابقة الأركان وترجيح" });
    const an = await runAnalysis(query, outcome.verified, undefined, governingSystems?.map((g) => g.systemName));
    onStep({ id: "analysis", status: "done", label: an.abstained ? "امتنعتُ (لا سند كافٍ)" : "أنجزت التحليل المستند", data: { source: an.source } });
    analysis = an.analysis;
  }

  return { intent: intent.type, issues: tk.issues, articles, mode, governingSystems, analysis };
}
