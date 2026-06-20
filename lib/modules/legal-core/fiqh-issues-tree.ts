/**
 * fiqh-issues-tree.ts — بناء شجرة المسائل الفقهية/القانونية وربطها بالأنظمة والمواد.
 *
 * الشجرة (نقيّة، بلا اختلاق): كل ورقة «مسألة» = مادة حقيقية مرتبطة بمفتاحها الفريد
 * (lawName, articleNumber) في legal_articles — فالربط حتمي وقابل للتحقق.
 *
 *   المجال (domain) → النظام (system) → [الباب/الفصل (chapter) إن وُجد] → المسألة (مادة)
 *
 * مستوى الباب يظهر فقط إن توفّر حقل chapter (من قاعدة البيانات)؛ وإلا تتدلّى المسائل
 * مباشرةً تحت النظام.
 */
import type { SaudiSystem } from "./saudi-systems";

export interface FiqhMasalaLink {
  lawName: string;
  articleNumber: number;
}

export interface FiqhMasalaNode {
  id: string;
  type: "masala";
  title: string;
  keywords: string[];
  /** الربط الحتمي بالمادة في legal_articles. */
  link: FiqhMasalaLink;
}

export interface FiqhChapterNode {
  id: string;
  type: "chapter";
  title: string;
  articleCount: number;
  children: FiqhMasalaNode[];
}

export interface FiqhSystemNode {
  id: string;
  type: "system";
  systemName: string;
  articleCount: number;
  children: (FiqhChapterNode | FiqhMasalaNode)[];
}

export interface FiqhDomainNode {
  id: string;
  type: "domain";
  slug: string;
  title: string;
  systemsCount: number;
  articleCount: number;
  children: FiqhSystemNode[];
}

export interface FiqhIssuesTree {
  meta: {
    generatedAt: string;
    linkedTo: string;
    domains: number;
    systems: number;
    chapters: number;
    masail: number;
    note: string;
  };
  tree: FiqhDomainNode[];
}

function masalaTitle(title: string, articleNumber: number): string {
  const t = (title || "").trim();
  return t || `المادة ${articleNumber}`;
}

function buildSystemNode(system: SaudiSystem, domainSlug: string): { node: FiqhSystemNode; chapters: number; masail: number } {
  const sysId = `${domainSlug}/${system.name}`;
  const hasChapters = system.articles.some((a) => (a.chapter ?? "").trim().length > 0);
  let chapters = 0;
  let masail = 0;

  const leaf = (a: SaudiSystem["articles"][number]): FiqhMasalaNode => {
    masail++;
    return {
      id: `${sysId}#${a.articleNumber}`,
      type: "masala",
      title: masalaTitle(a.title, a.articleNumber),
      keywords: a.keywords,
      link: { lawName: system.name, articleNumber: a.articleNumber }
    };
  };

  let children: (FiqhChapterNode | FiqhMasalaNode)[];
  if (hasChapters) {
    const byChapter = new Map<string, FiqhMasalaNode[]>();
    for (const a of system.articles) {
      const ch = (a.chapter ?? "").trim() || "مواد عامة";
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch)!.push(leaf(a));
    }
    children = [...byChapter.entries()].map(([title, kids], i) => {
      chapters++;
      return { id: `${sysId}::ch${i + 1}`, type: "chapter", title, articleCount: kids.length, children: kids };
    });
  } else {
    children = system.articles.map(leaf);
  }

  return {
    node: { id: sysId, type: "system", systemName: system.name, articleCount: system.articleCount, children },
    chapters,
    masail
  };
}

/** يبني شجرة المسائل من الأنظمة المُصدَّرة، مرتبطةً بكل مادة عبر مفتاحها الفريد. */
export function buildFiqhIssuesTree(systems: SaudiSystem[], linkedTo = "data/saudi_systems.json"): FiqhIssuesTree {
  const byDomain = new Map<string, { slug: string; title: string; systems: SaudiSystem[] }>();
  for (const s of systems) {
    if (!byDomain.has(s.domain)) byDomain.set(s.domain, { slug: s.domain, title: s.domainTitle, systems: [] });
    byDomain.get(s.domain)!.systems.push(s);
  }

  let totalSystems = 0;
  let totalChapters = 0;
  let totalMasail = 0;

  const tree: FiqhDomainNode[] = [...byDomain.values()]
    .map((d) => {
      const sysNodes: FiqhSystemNode[] = [];
      let articleCount = 0;
      for (const s of d.systems) {
        const { node, chapters, masail } = buildSystemNode(s, d.slug);
        sysNodes.push(node);
        articleCount += s.articleCount;
        totalChapters += chapters;
        totalMasail += masail;
        totalSystems++;
      }
      sysNodes.sort((a, b) => b.articleCount - a.articleCount);
      return {
        id: d.slug,
        type: "domain" as const,
        slug: d.slug,
        title: d.title,
        systemsCount: sysNodes.length,
        articleCount,
        children: sysNodes
      };
    })
    .sort((a, b) => b.articleCount - a.articleCount);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      linkedTo,
      domains: tree.length,
      systems: totalSystems,
      chapters: totalChapters,
      masail: totalMasail,
      note: "كل مسألة (ورقة) مرتبطة بمادة حقيقية عبر (lawName, articleNumber) في legal_articles."
    },
    tree
  };
}
