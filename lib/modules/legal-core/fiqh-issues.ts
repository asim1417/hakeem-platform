/**
 * fiqh-issues.ts — جسر النواة القانونية ↔ المسائل الفقهية.
 *
 * يحمّل الفهرس العكسي النحيف (data/fiqh-article-index.json) مرة واحدة، فيُجيب:
 * «ما المسائل الفقهية التي تعالجها هذه المادة؟» — ربط حتمي (مادة ↔ مسألة) بلا قاعدة في
 * مسار العرض الساخن، منسجم مع نهج concept-map/bm25.
 *
 * المصدر: ربط الموسوعة الفقهية بالأنظمة (link-fiqh-to-nizam) — روابط واثقة فقط.
 */
import fs from "node:fs";
import path from "node:path";

export interface FiqhIssueRef {
  issueId: string;
  title: string;
  path: string;
  section: string;
  linkStatus: "linked" | "needs_review";
  nizamRatio: number;
  rank: number;
}

interface FiqhArticleIndex {
  meta: { generatedAt: string; articles: number; source: string };
  index: Record<string, FiqhIssueRef[]>;
}

let _index: FiqhArticleIndex | null = null;
let _loaded = false;

function load(): FiqhArticleIndex | null {
  if (_loaded) return _index;
  _loaded = true;
  try {
    const p = path.join(process.cwd(), "data", "fiqh-article-index.json");
    _index = JSON.parse(fs.readFileSync(p, "utf-8")) as FiqhArticleIndex;
  } catch {
    _index = null; // سقوط آمن إن غاب الفهرس
  }
  return _index;
}

const key = (lawName: string, articleNumber: number) => `${lawName}|${articleNumber}`;

/** المسائل الفقهية المرتبطة بمادة (مرتّبة: المرتبة ثم النسبة)، مع حدّ اختياري. */
export function getFiqhIssuesForArticle(lawName: string, articleNumber: number, limit?: number): FiqhIssueRef[] {
  const idx = load();
  if (!idx) return [];
  const refs = idx.index[key(lawName, articleNumber)] ?? [];
  return typeof limit === "number" ? refs.slice(0, limit) : refs;
}

/** هل لهذه المادة مسائل فقهية مرتبطة؟ */
export function hasFiqhIssues(lawName: string, articleNumber: number): boolean {
  const idx = load();
  return !!idx && (idx.index[key(lawName, articleNumber)]?.length ?? 0) > 0;
}

/** إحصاء موجز للفهرس. */
export function fiqhIssuesStats(): { articles: number; issueLinks: number; source: string } | null {
  const idx = load();
  if (!idx) return null;
  let issueLinks = 0;
  for (const k of Object.keys(idx.index)) issueLinks += idx.index[k].length;
  return { articles: idx.meta.articles, issueLinks, source: idx.meta.source };
}
