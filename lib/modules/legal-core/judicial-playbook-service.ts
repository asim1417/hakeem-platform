/**
 * Judicial Playbook Service
 * خدمة خريطة المواد القضائية الأساسية
 *
 * القاعدة الجوهرية:
 * Playbooks = خريطة بحث وتوجيه فقط
 * Legal Core = المصدر الوحيد للنصوص النظامية
 *
 * لا يُستند إلى أي نص مادة من هذا الملف مباشرة.
 */

import type { ArabicSearchType } from "./arabic-morphology";

// ── Types ─────────────────────────────────────────────────

export interface JudicialPlaybook {
  id: string;
  title: string;
  category: PlaybookCategory;
  description: string;
  keywords: string[];
  preferredSystems: string[];
  litigationStages: string[];
  judicialUsage: string[];
  searchQueries: string[];
  suggestedArticleNumbers?: string[];
  caution: string;
  outputGuidance: string;
}

export type PlaybookCategory =
  | "الاختصاص"
  | "شروط قبول الدعوى"
  | "الإثبات"
  | "إدارة الجلسة والإجراءات"
  | "الحكم القضائي"
  | "طرق الاعتراض"
  | "المسائل الموضوعية";

export interface CaseContext {
  id?: string;
  subject?: string;
  facts?: string;
  requests?: string;
  defenses?: string;
  currentStage?: string;
  plaintiff?: string;
  defendant?: string;
}

export interface PlaybookSearchResult {
  playbook: JudicialPlaybook;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface LegalSearchResult {
  id: string;
  type: "article" | "judgment";
  systemName: string;
  articleNumber?: string;
  title?: string;
  snippet: string;
  citationLabel: string;
  url?: string;
  relevanceScore?: number;
  source: "live_core" | "builtin";
}

// ── Load Playbooks ────────────────────────────────────────

let _playbooksCache: JudicialPlaybook[] | null = null;
let _stageMappingCache: Record<string, string[]> | null = null;

function loadPlaybooks(): { playbooks: JudicialPlaybook[]; stageMapping: Record<string, string[]> } {
  if (_playbooksCache && _stageMappingCache) {
    return { playbooks: _playbooksCache, stageMapping: _stageMappingCache };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("@/data/judicial-playbooks.json");
    _playbooksCache = data.playbooks as JudicialPlaybook[];
    _stageMappingCache = data.stageMapping as Record<string, string[]>;
  } catch {
    _playbooksCache = [];
    _stageMappingCache = {};
  }
  return { playbooks: _playbooksCache!, stageMapping: _stageMappingCache! };
}

// ── Public API ────────────────────────────────────────────

/**
 * Get all judicial playbooks
 */
export function getJudicialPlaybooks(): JudicialPlaybook[] {
  return loadPlaybooks().playbooks;
}

/**
 * Get playbooks grouped by category
 */
export function getPlaybooksByCategory(): Record<PlaybookCategory, JudicialPlaybook[]> {
  const all = getJudicialPlaybooks();
  const grouped: Partial<Record<PlaybookCategory, JudicialPlaybook[]>> = {};
  for (const pb of all) {
    if (!grouped[pb.category]) grouped[pb.category] = [];
    grouped[pb.category]!.push(pb);
  }
  return grouped as Record<PlaybookCategory, JudicialPlaybook[]>;
}

/**
 * Find playbooks matching a legal issue or case text
 */
export function findPlaybooksByIssue(issueText: string, maxResults = 5): PlaybookSearchResult[] {
  const all = getJudicialPlaybooks();
  const q = issueText.toLowerCase().trim();
  const words = q.split(/[\s،,؛]+/).filter((w) => w.length >= 2);

  const stopWords = new Set([
    "في","من","إلى","على","أن","عن","مع","هذا","التي","الذي","وقد",
    "كان","قام","حيث","إذا","الدعوى","المدعي","المدعى","أمام","بين",
  ]);
  const keywords = words.filter((w) => !stopWords.has(w));

  return all
    .map((pb) => {
      const searchSpace = [
        ...pb.keywords,
        pb.title,
        pb.description,
        pb.category,
        ...pb.judicialUsage,
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      const matched: string[] = [];

      // Direct match on title
      if (searchSpace.includes(q)) score += 15;

      for (const kw of keywords) {
        if (pb.keywords.some((k) => k.includes(kw))) { score += 5; matched.push(kw); }
        else if (pb.title.includes(kw)) { score += 4; matched.push(kw); }
        else if (pb.description.includes(kw)) { score += 2; }
        else if (searchSpace.includes(kw)) { score += 1; }
      }

      return { playbook: pb, relevanceScore: score, matchedKeywords: [...new Set(matched)] };
    })
    .filter((r) => r.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

/**
 * Get playbooks relevant to a litigation stage
 */
export function getPlaybooksForStage(stage: string): JudicialPlaybook[] {
  const { playbooks, stageMapping } = loadPlaybooks();
  const ids = stageMapping[stage] ?? [];
  const pbMap = new Map(playbooks.map((p) => [p.id, p]));
  return ids.map((id) => pbMap.get(id)).filter(Boolean) as JudicialPlaybook[];
}

/**
 * Build optimised search queries for the Legal Core API from a playbook
 */
export function buildLegalSearchQueriesFromPlaybook(playbook: JudicialPlaybook): string[] {
  // Primary: the playbook's own searchQueries
  const queries = [...playbook.searchQueries];

  // Secondary: combine title + first 2 keywords
  const compact = [playbook.title, ...playbook.keywords.slice(0, 2)].join(" ");
  if (!queries.includes(compact)) queries.push(compact);

  // Tertiary: per preferred system
  for (const sys of playbook.preferredSystems.slice(0, 2)) {
    queries.push(`${playbook.keywords[0] ?? playbook.title} ${sys}`);
  }

  return [...new Set(queries)].slice(0, 6);
}

/**
 * Suggest Legal Core search queries for a full case context
 * (does NOT return article texts — only queries to pass to the Legal Core)
 */
export function suggestLegalAuthoritiesForCase(caseCtx: CaseContext): {
  queries: string[];
  matchedPlaybooks: PlaybookSearchResult[];
} {
  const text = [caseCtx.subject, caseCtx.facts, caseCtx.requests, caseCtx.defenses]
    .filter(Boolean)
    .join(" ");

  const matchedPlaybooks = findPlaybooksByIssue(text, 6);

  const queries = new Set<string>();

  // Stage-specific playbooks
  if (caseCtx.currentStage) {
    const stagePbs = getPlaybooksForStage(caseCtx.currentStage);
    stagePbs.forEach((pb) =>
      buildLegalSearchQueriesFromPlaybook(pb).forEach((q) => queries.add(q))
    );
  }

  // Case-matched playbooks
  matchedPlaybooks.forEach(({ playbook }) =>
    buildLegalSearchQueriesFromPlaybook(playbook).forEach((q) => queries.add(q))
  );

  return {
    queries: [...queries].slice(0, 8),
    matchedPlaybooks,
  };
}

/**
 * Retrieve REAL articles from the Legal Core for a playbook.
 * This is the ONLY place where article text is sourced.
 * Never returns article text from the playbook itself.
 */
export async function retrieveArticlesForPlaybook(
  playbook: JudicialPlaybook,
  limit = 6
): Promise<LegalSearchResult[]> {
  const queries = buildLegalSearchQueriesFromPlaybook(playbook);
  const primaryQuery = queries[0] ?? playbook.title;

  try {
    const params = new URLSearchParams({
      q: primaryQuery,
      searchType: "contains" as ArabicSearchType,
      sourceTypes: "article",
      limit: String(limit),
      includeSnippets: "true",
    });

    // Prefer the dedicated endpoint for hakim1111 (no auth required)
    const endpoint = "/api/original-hakeem/legal-search";
    const res = await fetch(`${endpoint}?${params}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map(normalizeResult);
  } catch {
    return [];
  }
}

/**
 * Validate that articles used in a verdict were retrieved from the Legal Core.
 * Returns a cleaned text and a list of warnings for any unverified article references.
 */
export function validatePlaybookArticlesAgainstLegalCore(
  verdictText: string,
  approvedArticles: LegalSearchResult[]
): { cleanText: string; warnings: string[] } {
  const warnings: string[] = [];
  const approvedNos = new Set(approvedArticles.map((a) => a.articleNumber).filter(Boolean));

  // Pattern: م/15 or المادة 15 or م. 15
  const articlePattern = /(م\/\d+|المادة\s+\d+|م\.\s*\d+)/g;
  const mentions = [...verdictText.matchAll(articlePattern)].map((m) => ({
    original: m[0],
    num: m[0].replace(/\D/g, ""),
  }));

  let cleanText = verdictText;
  for (const { original, num } of mentions) {
    if (!approvedNos.has(num)) {
      warnings.push(`⚠ مادة غير موثّقة من النواة القانونية: ${original}`);
      cleanText = cleanText.replace(original, "(يراجع السند النظامي المناسب قبل التقديم)");
    }
  }

  return { cleanText, warnings };
}

// ── Internals ─────────────────────────────────────────────

function normalizeResult(r: Record<string, unknown>): LegalSearchResult {
  return {
    id: String(r.id ?? ""),
    type: r.type === "judgment" ? "judgment" : "article",
    systemName: String(r.systemName ?? r.law_name ?? ""),
    articleNumber: r.articleNumber ? String(r.articleNumber) : undefined,
    title: String(r.title ?? r.articleTitle ?? ""),
    snippet: String(r.snippet ?? "").slice(0, 400),
    citationLabel: String(r.citationLabel ?? r.citation ?? ""),
    url: r.url ? String(r.url) : undefined,
    relevanceScore: Number(r.relevanceScore ?? 0),
    source: "live_core",
  };
}
