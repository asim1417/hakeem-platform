import { prisma } from "@/lib/prisma";

export type CourtPosition = "basis" | "dispute" | "procedural" | "general_reference" | "unresolved";

export type ExtractedJudgmentCitation = {
  rawText: string;
  systemName: string | null;
  articleNumber: number | null;
  resolvedArticleId: string | null;
  resolvedArticleText: string | null;
  confidence: number;
  section: "الوقائع" | "الطلبات" | "الدفوع" | "الأسباب" | "المنطوق" | "غير معروف";
  courtPosition: CourtPosition;
};

export type JudgmentCitationAnalysis = {
  inputLength: number;
  detectedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  citations: ExtractedJudgmentCitation[];
  reverseIndex: Array<{
    articleId: string;
    systemName: string;
    articleNumber: number;
    references: number;
  }>;
  message?: string;
};

type LegalSystemCandidate = {
  id: string;
  name: string;
  normalizedName: string;
};

const articlePattern = /(?:المادة|أحكام المادة|نصت المادة|وفق(?:ا|ًا)?\s+للمادة|استناد(?:ا|ًا)?\s+إلى\s+المادة)\s*(?:رقم)?\s*[\(\[]?\s*([0-9٠-٩۰-۹]+(?:\s*\/\s*[0-9٠-٩۰-۹]+)*|[اأإآء-ي\s]+?)\s*[\)\]]?(?=(?:\s+من|\s+في|\s+،|\.|$))/g;
const systemOnlyPattern = /(?:وفق(?:ا|ًا)?\s+ل|استناد(?:ا|ًا)?\s+إلى\s+)?(نظام\s+[اأإآء-ي\s]+?)(?=(?:،|\.|\n|$))/g;

export async function analyzeJudgmentCitations(judgmentText: string): Promise<JudgmentCitationAnalysis> {
  const text = judgmentText.trim();
  if (!text) {
    return {
      inputLength: 0,
      detectedCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      citations: [],
      reverseIndex: [],
      message: "أدخل نص حكم قضائي لتحليل الاستشهادات."
    };
  }

  const systems = await loadLegalSystems();
  const articleMentions = extractArticleMentions(text, systems);
  const systemOnlyMentions = extractSystemOnlyMentions(text, systems, articleMentions);
  const citations = await Promise.all([...articleMentions, ...systemOnlyMentions].map((mention) => resolveCitation(mention, systems)));
  const reverseIndex = buildReverseIndex(citations);

  return {
    inputLength: text.length,
    detectedCount: citations.length,
    resolvedCount: citations.filter((citation) => citation.resolvedArticleId).length,
    unresolvedCount: citations.filter((citation) => !citation.resolvedArticleId).length,
    citations,
    reverseIndex,
    message: citations.length ? undefined : "لم يتم العثور على استشهادات نظامية واضحة في النص المدخل."
  };
}

async function loadLegalSystems(): Promise<LegalSystemCandidate[]> {
  const systems = await prisma.legalSystem.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  return systems.map((system) => ({
    ...system,
    normalizedName: normalizeCitationArabicText(system.name)
  }));
}

function extractArticleMentions(text: string, systems: LegalSystemCandidate[]) {
  const mentions: Array<{ rawText: string; index: number; articleNumber: number | null; articleNumbers: number[]; systemName: string | null; section: ExtractedJudgmentCitation["section"]; context: string }> = [];
  for (const match of text.matchAll(articlePattern)) {
    const rawText = match[0];
    const index = match.index ?? 0;
    const context = sliceAround(text, index, 260);
    // مرشّحو رقم المادة من صيغة قد تكون «فقرة/مادة» مثل (١/١٢٠) — الأكبر أولاً
    const articleNumbers = parseArticleNumberCandidates(match[1]);
    const systemName = findNearestSystemName(text, index, systems);
    mentions.push({
      rawText,
      index,
      articleNumber: articleNumbers[0] ?? null,
      articleNumbers,
      systemName,
      section: detectSection(text, index),
      context
    });
  }
  return dedupeMentions(mentions);
}

function extractSystemOnlyMentions(
  text: string,
  systems: LegalSystemCandidate[],
  articleMentions: Array<{ index: number }>
) {
  const mentions: Array<{ rawText: string; index: number; articleNumber: number | null; systemName: string | null; section: ExtractedJudgmentCitation["section"]; context: string }> = [];
  for (const match of text.matchAll(systemOnlyPattern)) {
    const rawText = match[1] ?? match[0];
    const index = match.index ?? 0;
    if (articleMentions.some((mention) => Math.abs(mention.index - index) < 120)) continue;
    const systemName = resolveSystemName(rawText, systems);
    if (!systemName) continue;
    mentions.push({
      rawText,
      index,
      articleNumber: null,
      systemName,
      section: detectSection(text, index),
      context: sliceAround(text, index, 260)
    });
  }
  return dedupeMentions(mentions);
}

async function resolveCitation(
  mention: { rawText: string; articleNumber: number | null; articleNumbers?: number[]; systemName: string | null; section: ExtractedJudgmentCitation["section"]; context: string },
  systems: LegalSystemCandidate[]
): Promise<ExtractedJudgmentCitation> {
  const resolvedSystem = mention.systemName ? systems.find((system) => system.name === mention.systemName) : null;
  const systemFilter = resolvedSystem
    ? [{ legalSystemId: resolvedSystem.id }, { lawName: resolvedSystem.name }]
    : mention.systemName
      ? [{ lawName: { contains: mention.systemName, mode: "insensitive" as const } }]
      : undefined;
  // مرشّحو الرقم بالترتيب (الأكبر أولاً = المادة قبل الفقرة)؛ نأخذ أول ما يُحَلّ فعلاً
  const candidates = mention.articleNumbers?.length ? mention.articleNumbers : mention.articleNumber ? [mention.articleNumber] : [];
  let article: { id: string; content: string; lawName: string; articleNumber: number } | null = null;
  for (const cand of candidates) {
    const found = await prisma.legalArticle.findFirst({
      where: { articleNumber: cand, ...(systemFilter ? { OR: systemFilter } : {}) },
      select: { id: true, content: true, lawName: true, articleNumber: true }
    });
    if (found) { article = found; break; }
  }

  const systemName = article?.lawName ?? mention.systemName;
  const courtPosition = classifyCourtPosition(mention.context, mention.section, Boolean(article));

  return {
    rawText: mention.rawText,
    systemName,
    articleNumber: article?.articleNumber ?? mention.articleNumber,
    resolvedArticleId: article?.id ?? null,
    resolvedArticleText: article?.content ?? null,
    confidence: calculateConfidence(Boolean(article), Boolean(systemName), Boolean(mention.articleNumber)),
    section: mention.section,
    courtPosition
  };
}

function findNearestSystemName(text: string, index: number, systems: LegalSystemCandidate[]) {
  const context = normalizeCitationArabicText(sliceAround(text, index, 320));
  let best: { name: string; score: number } | null = null;
  for (const system of systems) {
    if (!system.normalizedName || !context.includes(system.normalizedName)) continue;
    const score = system.normalizedName.length;
    if (!best || score > best.score) best = { name: system.name, score };
  }
  return best?.name ?? null;
}

function resolveSystemName(rawText: string, systems: LegalSystemCandidate[]) {
  const normalized = normalizeCitationArabicText(rawText);
  let best: { name: string; score: number } | null = null;
  for (const system of systems) {
    if (!normalized.includes(system.normalizedName) && !system.normalizedName.includes(normalized)) continue;
    const score = Math.min(normalized.length, system.normalizedName.length);
    if (!best || score > best.score) best = { name: system.name, score };
  }
  return best?.name ?? null;
}

export function normalizeCitationArabicText(text: string) {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * يستخرج مرشّحي رقم المادة من قيمة قد تكون مركّبة «فقرة/مادة» مثل «١/١٢٠».
 * يعيدهم بترتيب الأرجحية (الأكبر أولاً، فالمادة أكبر من رقم الفقرة/البند).
 * عند عدم وجود أرقام يعود للتحليل اللفظي (المادة الأولى…).
 */
export function parseArticleNumberCandidates(value: string): number[] {
  const normalized = normalizeDigits(value);
  const parts = normalized
    .split("/")
    .map((p) => p.match(/\d+/)?.[0])
    .filter((p): p is string => Boolean(p))
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length) return Array.from(new Set(parts)).sort((a, b) => b - a);
  const word = parseArabicArticleNumber(value);
  return word ? [word] : [];
}

export function parseArabicArticleNumber(value: string) {
  const normalized = normalizeDigits(value);
  const numeric = normalized.match(/\d+/)?.[0];
  if (numeric) return Number(numeric);

  const words = normalizeCitationArabicText(value).split(/\s+/).filter((word) => word && word !== "و");
  if (!words.length) return null;
  return parseNumberWords(words);
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function parseNumberWords(words: string[]) {
  const units: Record<string, number> = {
    الاولي: 1,
    الاول: 1,
    واحد: 1,
    الواحده: 1,
    الثانيه: 2,
    الثاني: 2,
    اثنان: 2,
    اثنتان: 2,
    الثالثه: 3,
    الثالث: 3,
    ثلاثه: 3,
    الرابعه: 4,
    الرابع: 4,
    اربعه: 4,
    الخامسه: 5,
    الخامس: 5,
    خمسه: 5,
    السادسه: 6,
    السادس: 6,
    سته: 6,
    السابعه: 7,
    السابع: 7,
    سبعه: 7,
    الثامنه: 8,
    الثامن: 8,
    ثمانيه: 8,
    التاسعه: 9,
    التاسع: 9,
    تسعه: 9
  };
  const teens: Record<string, number> = {
    العاشره: 10,
    العاشر: 10,
    العشره: 10,
    الحاديه: 11,
    الحادي: 11,
    احدي: 11,
    الحاديهعشره: 11,
    الثانيهعشره: 12,
    الثانيعشر: 12,
    الثالثهعشره: 13,
    الثالثعشر: 13,
    الرابعهعشره: 14,
    الرابععشر: 14,
    الخامسهعشره: 15,
    الخامسعشر: 15,
    السادسهعشره: 16,
    السادسعشر: 16,
    السابعهعشره: 17,
    السابععشر: 17,
    الثامنهعشره: 18,
    الثامنعشر: 18,
    التاسعهعشره: 19,
    التاسععشر: 19
  };
  const tens: Record<string, number> = {
    العشرون: 20,
    عشرون: 20,
    الثلاثون: 30,
    ثلاثون: 30,
    الاربعون: 40,
    اربعون: 40,
    الخمسون: 50,
    خمسون: 50,
    الستون: 60,
    ستون: 60,
    السبعون: 70,
    سبعون: 70,
    الثمانون: 80,
    ثمانون: 80,
    التسعون: 90,
    تسعون: 90,
    المائه: 100,
    مائه: 100,
    المئه: 100,
    مئه: 100
  };

  const compact = words.join("");
  if (teens[compact]) return teens[compact];
  let total = 0;
  for (const word of words) {
    total += units[word] ?? teens[word] ?? tens[word] ?? 0;
  }
  return total || null;
}

function detectSection(text: string, index: number): ExtractedJudgmentCitation["section"] {
  const before = text.slice(0, index);
  const markers: Array<[ExtractedJudgmentCitation["section"], number]> = [
    ["الوقائع", before.lastIndexOf("الوقائع")],
    ["الطلبات", before.lastIndexOf("الطلبات")],
    ["الدفوع", Math.max(before.lastIndexOf("الدفوع"), before.lastIndexOf("دفع"))],
    ["الأسباب", Math.max(before.lastIndexOf("الأسباب"), before.lastIndexOf("الحيثيات"))],
    ["المنطوق", Math.max(before.lastIndexOf("المنطوق"), before.lastIndexOf("حكمت"))]
  ];
  const best = markers.sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 0 ? best[0] : "غير معروف";
}

function classifyCourtPosition(context: string, section: ExtractedJudgmentCitation["section"], resolved: boolean): CourtPosition {
  if (!resolved) return "unresolved";
  if (/الاختصاص|القبول|المرافعات|التبليغ|الإثبات|عبء الإثبات/.test(context)) return "procedural";
  if (/دفع المدعى عليه|ذكر المدعي|تمسك الطرف|طلب وكيل المدعي|أقوال|يدعي|يدفع/.test(context) || section === "الوقائع" || section === "الدفوع") return "dispute";
  if (/استنادا|استنادًا|وحيث إن|ولما كان|تقضي المادة|قررت الدائرة|حكمت المحكمة/.test(context) || section === "الأسباب" || section === "المنطوق") return "basis";
  return "general_reference";
}

function calculateConfidence(resolved: boolean, hasSystem: boolean, hasArticle: boolean) {
  let confidence = 0.35;
  if (hasArticle) confidence += 0.2;
  if (hasSystem) confidence += 0.2;
  if (resolved) confidence += 0.25;
  return Math.min(confidence, 0.98);
}

function buildReverseIndex(citations: ExtractedJudgmentCitation[]) {
  const items = new Map<string, { articleId: string; systemName: string; articleNumber: number; references: number }>();
  for (const citation of citations) {
    if (!citation.resolvedArticleId || !citation.systemName || !citation.articleNumber) continue;
    const item = items.get(citation.resolvedArticleId);
    if (item) item.references += 1;
    else {
      items.set(citation.resolvedArticleId, {
        articleId: citation.resolvedArticleId,
        systemName: citation.systemName,
        articleNumber: citation.articleNumber,
        references: 1
      });
    }
  }
  return Array.from(items.values());
}

function dedupeMentions<T extends { rawText: string; index: number; articleNumber: number | null; systemName: string | null }>(mentions: T[]) {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const key = `${mention.rawText}:${mention.index}:${mention.articleNumber}:${mention.systemName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sliceAround(text: string, index: number, radius: number) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}
