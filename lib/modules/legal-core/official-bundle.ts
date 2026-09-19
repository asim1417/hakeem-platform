import { extractCouncilDecisionRefs, normalizeInstrumentNumber } from "./system-readiness";

export type PreparedOfficialDocument = {
  docType: "ROYAL_DECREE" | "COUNCIL_DECISION" | "SYSTEM_TEXT";
  rawText: string;
  number?: string;
  hijriDate?: string;
  sourceUrl: string;
  sourceCode: "NCAR" | "BOE";
  sourceDocumentId: string;
  verificationStatus: "SOURCE_MATCHED";
};

export type OfficialBundleSplit = {
  ok: boolean;
  confidence: "HIGH" | "REVIEW";
  systemName: string;
  documents: PreparedOfficialDocument[];
  issues: string[];
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function htmlToLegalText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/giu, "")
      .replace(/<style\b[\s\S]*?<\/style>/giu, "")
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/giu, "\n")
      .replace(/<li\b[^>]*>/giu, "- ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function stripFooter(text: string): string {
  const markers = [
    "\nجميع الحقوق محفوظة",
    "\nتابعنا على",
    "\nاشترك في نشرتنا",
    "\nتاريخ آخر تعديل",
  ];
  let end = text.length;
  for (const marker of markers) {
    const i = text.indexOf(marker);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(0, end).trim();
}

function findSystemHeading(text: string, systemName: string): number {
  const escaped = escapeRegExp(systemName);
  const re = new RegExp("(?:^|\\n)\\s*" + escaped + "\\s*\\n(?=\\s*(?:باب|الفصل|المادة))", "gu");
  let last = -1;
  for (const m of text.matchAll(re)) {
    const raw = m[0] ?? "";
    const within = raw.lastIndexOf(systemName);
    last = (m.index ?? 0) + Math.max(0, within);
  }
  return last;
}

function nextNonEmptyLine(text: string, after: number): string {
  return text
    .slice(after, after + 500)
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function findRoyalHeading(text: string, before: number): number {
  const prefix = text.slice(0, before);
  const re = /مرسوم\s+ملكي\s+رقم\s*\([^)]+\)\s*(?:و?تاريخ)\s*[^\n]+/gu;
  for (const m of prefix.matchAll(re)) {
    const i = m.index ?? -1;
    if (i < 0) continue;
    const next = nextNonEmptyLine(prefix, i + (m[0]?.length ?? 0));
    if (/^بعون\s+الله/u.test(next)) return i;
  }
  return -1;
}

function findCouncilHeading(text: string, from: number, before: number): number {
  const part = text.slice(Math.max(0, from), before);
  const re = /قرار\s+مجلس\s+الوزراء\s+رقم\s*\([^)]+\)\s*(?:و?تاريخ)\s*[^\n]+/gu;
  for (const m of part.matchAll(re)) {
    const i = (m.index ?? 0) + Math.max(0, from);
    const next = nextNonEmptyLine(text, i + (m[0]?.length ?? 0));
    if (/^إن\s+مجلس\s+الوزراء/u.test(next)) return i;
  }
  return -1;
}

function instrumentMeta(text: string, kind: "ROYAL_DECREE" | "COUNCIL_DECISION"): { number?: string; hijriDate?: string } {
  const label = kind === "ROYAL_DECREE" ? "مرسوم\\s+ملكي" : "قرار\\s+مجلس\\s+الوزراء";
  const re = new RegExp(label + "\\s+رقم\\s*\\(([^)]+)\\)\\s*(?:و?تاريخ)\\s*([0-9٠-٩۰-۹\\s/\\-]+)\\s*هـ?", "u");
  const m = text.match(re);
  return {
    number: m?.[1]?.trim(),
    hijriDate: m?.[2]?.trim(),
  };
}

function sourceBaseId(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl);
    return u.pathname.split("/").filter(Boolean).pop() || "official";
  } catch {
    return "official";
  }
}

export function splitOfficialSystemBundle(input: {
  htmlOrText: string;
  systemName: string;
  sourceUrl: string;
  sourceCode: "NCAR" | "BOE";
}): OfficialBundleSplit {
  const text0 = /<[^>]+>/.test(input.htmlOrText) ? htmlToLegalText(input.htmlOrText) : input.htmlOrText;
  const text = stripFooter(text0);
  const issues: string[] = [];
  const documents: PreparedOfficialDocument[] = [];
  const baseId = sourceBaseId(input.sourceUrl);

  const systemStart = findSystemHeading(text, input.systemName);
  if (systemStart < 0) {
    return { ok: false, confidence: "REVIEW", systemName: input.systemName, documents: [], issues: ["SYSTEM_HEADING_NOT_FOUND"] };
  }

  const royalStart = findRoyalHeading(text, systemStart);
  const councilStart = findCouncilHeading(text, royalStart >= 0 ? royalStart : 0, systemStart);

  if (royalStart >= 0) {
    const end = councilStart >= 0 ? councilStart : systemStart;
    const rawText = text.slice(royalStart, end).trim();
    const meta = instrumentMeta(rawText, "ROYAL_DECREE");
    documents.push({
      docType: "ROYAL_DECREE",
      rawText,
      number: meta.number,
      hijriDate: meta.hijriDate,
      sourceUrl: input.sourceUrl,
      sourceCode: input.sourceCode,
      sourceDocumentId: baseId + ":royal-decree",
      verificationStatus: "SOURCE_MATCHED",
    });

    const refs = extractCouncilDecisionRefs(rawText);
    if (refs.length && councilStart < 0) issues.push("COUNCIL_DECISION_REFERENCED_BUT_SECTION_NOT_FOUND");
  } else {
    issues.push("ROYAL_DECREE_SECTION_NOT_FOUND");
  }

  if (councilStart >= 0) {
    const rawText = text.slice(councilStart, systemStart).trim();
    const meta = instrumentMeta(rawText, "COUNCIL_DECISION");
    documents.push({
      docType: "COUNCIL_DECISION",
      rawText,
      number: meta.number ? normalizeInstrumentNumber(meta.number) : undefined,
      hijriDate: meta.hijriDate,
      sourceUrl: input.sourceUrl,
      sourceCode: input.sourceCode,
      sourceDocumentId: baseId + ":council-decision:" + (meta.number ? normalizeInstrumentNumber(meta.number) : "unknown"),
      verificationStatus: "SOURCE_MATCHED",
    });
  }

  const systemText = text.slice(systemStart).trim();
  if (!new RegExp("^" + escapeRegExp(input.systemName) + "\\s*\\n", "u").test(systemText)) {
    issues.push("SYSTEM_TEXT_BOUNDARY_WEAK");
  }
  documents.push({
    docType: "SYSTEM_TEXT",
    rawText: systemText,
    sourceUrl: input.sourceUrl,
    sourceCode: input.sourceCode,
    sourceDocumentId: baseId + ":system-text",
    verificationStatus: "SOURCE_MATCHED",
  });

  const royal = documents.find((d) => d.docType === "ROYAL_DECREE");
  const council = documents.find((d) => d.docType === "COUNCIL_DECISION");
  if (royal) {
    if (!/رسمنا\s+بما\s+هو\s+آت/u.test(royal.rawText)) issues.push("ROYAL_DECREE_OPERATIVE_FORMULA_MISSING");
    if (!/آل\s+سعود/u.test(royal.rawText)) issues.push("ROYAL_DECREE_SIGNATURE_BOUNDARY_WEAK");
    const refs = extractCouncilDecisionRefs(royal.rawText);
    if (refs.length && council) {
      const n = normalizeInstrumentNumber(council.number);
      if (!refs.some((r) => r.number === n)) issues.push("COUNCIL_DECISION_NUMBER_DOES_NOT_MATCH_DECREE");
    }
  }
  if (council && !/يقرر\s+ما\s+يلي/u.test(council.rawText)) issues.push("COUNCIL_DECISION_OPERATIVE_FORMULA_MISSING");
  if (!/المادة\s+(?:الأولى|1|١)/u.test(systemText)) issues.push("SYSTEM_FIRST_ARTICLE_NOT_FOUND");

  const blockers = issues.filter((x) => !x.endsWith("_WEAK"));
  const ok = documents.some((d) => d.docType === "SYSTEM_TEXT") && blockers.length === 0;
  return {
    ok,
    confidence: ok && issues.length === 0 ? "HIGH" : "REVIEW",
    systemName: input.systemName,
    documents,
    issues,
  };
}
