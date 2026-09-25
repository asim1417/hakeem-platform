import { extractCouncilDecisionRefs, normalizeInstrumentNumber } from "./system-readiness";

export type PreparedOfficialDocument = {
  docType: "ROYAL_DECREE" | "COUNCIL_DECISION" | "SYSTEM_TEXT";
  rawText: string;
  number?: string;
  hijriDate?: string;
  sourceUrl: string;
  sourceCode: "NCAR" | "BOE";
  sourceDocumentId: string;
  verificationStatus: "REVIEW_REQUIRED";
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

function systemNamePattern(value: string): string {
  return value.split(/\s+/).map(word => [...word].map(escapeRegExp).join("[ـ\\u200B-\\u200F]*")).join("\\s+");
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
  const escaped = systemNamePattern(systemName);
  const re = new RegExp("(?:^|\\n)\\s*(" + escaped + ")\\s*\\n(?=\\s*(?:الباب|باب|الفصل|المادة))", "gu");
  let last = -1;
  for (const m of text.matchAll(re)) {
    const raw = m[0] ?? "";
    const within = raw.lastIndexOf(m[1]);
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

// Only standalone headings qualify; references inside recitals are not boundaries.
const INSTRUMENT_NUMBER = String.raw`(?:\(([^)\n]+)\)|([^()\n]+?))`;
function instrumentHeadingPattern(kind: "ROYAL_DECREE" | "COUNCIL_DECISION", flags: string): RegExp {
  const label = kind === "ROYAL_DECREE" ? String.raw`مرسوم\s+ملكي` : String.raw`قرار(?:\s+مجلس\s+الوزراء)?`;
  return new RegExp(String.raw`(?:^|\n)[^\S\n\r]*[\u200B-\u200F\uFEFF]*(${label}\s+رقم\s*${INSTRUMENT_NUMBER}\s+(?:و?تاريخ)\s*[:：]?\s*([0-9٠-٩۰-۹\s/\-]+)هـ?[^\n]*)`, flags);
}

function withOpening(text: string, heading: number): number {
  const opening = text.slice(0, heading).match(/(?:^|\n)[\s\u200B-\u200F\uFEFF]*(بسم\s+الله\s+الرحمن\s+الرحيم)[\s\u200B-\u200F\uFEFF]*$/u);
  return opening ? (opening.index ?? 0) + opening[0].indexOf(opening[1]) : heading;
}

function findRoyalHeading(text: string, before: number): number {
  const prefix = text.slice(0, before);
  for (const m of prefix.matchAll(instrumentHeadingPattern("ROYAL_DECREE", "gu"))) {
    const i = (m.index ?? 0) + m[0].indexOf(m[1]);
    const next = nextNonEmptyLine(prefix, (m.index ?? 0) + m[0].length);
    // Normalize only the recognition probe; keep the source and offsets intact.
    const openingProbe = next.replace(/[\u0640\u064B-\u065F\u0670\u200B-\u200F\uFEFF]/gu, "");
    if (/^بعون\s+الله/u.test(openingProbe)) return withOpening(prefix, i);
  }
  return -1;
}

function findCouncilHeading(text: string, from: number, before: number): number {
  const start = Math.max(0, from);
  const part = text.slice(start, before);
  for (const m of part.matchAll(instrumentHeadingPattern("COUNCIL_DECISION", "gu"))) {
    const i = (m.index ?? 0) + start + m[0].indexOf(m[1]);
    const next = nextNonEmptyLine(text, (m.index ?? 0) + start + m[0].length);
    if (/^إن\s+مجلس\s+الوزراء/u.test(next)) return withOpening(text, i);
  }
  return -1;
}

function instrumentMeta(text: string, kind: "ROYAL_DECREE" | "COUNCIL_DECISION"): { number?: string; hijriDate?: string } {
  const m = text.match(instrumentHeadingPattern(kind, "u"));
  return { number: (m?.[2] ?? m?.[3])?.trim(), hijriDate: m?.[4]?.trim() };
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
      verificationStatus: "REVIEW_REQUIRED",
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
      verificationStatus: "REVIEW_REQUIRED",
    });
  }

  const systemText = text.slice(systemStart).trim();
  if (!new RegExp("^" + systemNamePattern(input.systemName) + "\\s*\\n", "u").test(systemText)) {
    issues.push("SYSTEM_TEXT_BOUNDARY_WEAK");
  }
  documents.push({
    docType: "SYSTEM_TEXT",
    rawText: systemText,
    sourceUrl: input.sourceUrl,
    sourceCode: input.sourceCode,
    sourceDocumentId: baseId + ":system-text",
    verificationStatus: "REVIEW_REQUIRED",
  });

  const royal = documents.find((d) => d.docType === "ROYAL_DECREE");
  const council = documents.find((d) => d.docType === "COUNCIL_DECISION");
  if (royal) {
    if (!/رسمنا\s+بما\s+هو\s+آت/u.test(royal.rawText.replace(/[\u200B-\u200F\uFEFF]/g, ""))) issues.push("ROYAL_DECREE_OPERATIVE_FORMULA_MISSING");
    if (!/آل\s+سعود/u.test(royal.rawText)) issues.push("ROYAL_DECREE_SIGNATURE_BOUNDARY_WEAK");
    const refs = extractCouncilDecisionRefs(royal.rawText);
    if (refs.length && council) {
      const n = normalizeInstrumentNumber(council.number);
      if (!refs.some((r) => r.number === n)) issues.push("COUNCIL_DECISION_NUMBER_DOES_NOT_MATCH_DECREE");
    }
  }
  if (council && !/(?:^|\n)\s*يقرر(?:\s+ما\s+يلي)?\s*[:：]?\s*(?:\n|$)/u.test(council.rawText.replace(/[\u064B-\u065F\u200B-\u200F\uFEFF]/g, ""))) issues.push("COUNCIL_DECISION_OPERATIVE_FORMULA_MISSING");
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
