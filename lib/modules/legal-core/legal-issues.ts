/**
 * legal-issues.ts — طبقة عرض «المسائل القانونية» للواجهة.
 *
 * يقرأ فهرس التصفّح (data/legal-issues-browse.json) المُولّد من ربط المسائل بالأنظمة،
 * ويوفّر نظرة عامة + تصفّحاً مُقسَّماً ومُرقَّماً. حتميّ، بلا قاعدة في مسار العرض.
 */
import fs from "node:fs";
import path from "node:path";

export interface LegalIssueItem {
  issueId: string;
  title: string;
  book: string;
  chapter: string;
  suggestedNizam: string;
  linkStatus: "linked" | "needs_review" | "review_nizam" | "uncodified_sharia";
  nizamRatio: number;
  topArticle: { lawName: string; articleNumber: number; citation: string } | null;
}

interface SectionBlock {
  slug: string;
  title: string;
  linked: number;
  issues: LegalIssueItem[];
}

interface BrowseIndex {
  meta: {
    generatedAt: string;
    total: number;
    byStatus: Record<string, number>;
    sections: { slug: string; title: string; count: number; linked: number }[];
  };
  sections: Record<string, SectionBlock>;
}

let _idx: BrowseIndex | null = null;
let _loaded = false;

function load(): BrowseIndex | null {
  if (_loaded) return _idx;
  _loaded = true;
  try {
    _idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "legal-issues-browse.json"), "utf-8")) as BrowseIndex;
  } catch {
    _idx = null;
  }
  return _idx;
}

export interface LegalIssuesOverview {
  total: number;
  byStatus: Record<string, number>;
  sections: { slug: string; title: string; count: number; linked: number }[];
}

/** نظرة عامة: الإجمالي + التوزيع حسب الحالة + الأقسام. */
export function getLegalIssuesOverview(): LegalIssuesOverview {
  const idx = load();
  if (!idx) return { total: 0, byStatus: {}, sections: [] };
  return { total: idx.meta.total, byStatus: idx.meta.byStatus, sections: idx.meta.sections };
}

/** إجمالي عدد المسائل القانونية (للإحصاء). */
export function getLegalIssuesCount(): number {
  return load()?.meta.total ?? 0;
}

/** كتب القسم (للفهرس الجانبي): كل كتاب بعدده ونصيبه من «المطابقة العالية». */
export function getSectionBooks(slug: string): { book: string; count: number; linked: number }[] {
  const block = load()?.sections[slug];
  if (!block) return [];
  const order: string[] = [];
  const map = new Map<string, { book: string; count: number; linked: number }>();
  for (const i of block.issues) {
    const book = i.book || "—";
    let b = map.get(book);
    if (!b) {
      b = { book, count: 0, linked: 0 };
      map.set(book, b);
      order.push(book);
    }
    b.count++;
    if (i.linkStatus === "linked") b.linked++;
  }
  return order.map((k) => map.get(k)!);
}

/** تصفّح مسائل قسمٍ (مع تصفية اختيارية بالكتاب) وترقيم الصفحات. */
export function getLegalIssuesBySection(
  slug: string,
  page = 1,
  pageSize = 60,
  book?: string
): { title: string; book: string | null; total: number; page: number; pageSize: number; items: LegalIssueItem[] } {
  const idx = load();
  const block = idx?.sections[slug];
  if (!idx || !block) return { title: "", book: book ?? null, total: 0, page, pageSize, items: [] };
  const all = book ? block.issues.filter((i) => (i.book || "—") === book) : block.issues;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    title: block.title,
    book: book ?? null,
    total: all.length,
    page,
    pageSize,
    items: all.slice(start, start + pageSize)
  };
}
