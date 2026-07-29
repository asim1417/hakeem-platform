import { fingerprintObject, sha256Hex, dualFingerprints } from "../hash";
import { normalizeForCompare } from "../normalize/arabic";
import { normalizeDigitsForCompare } from "../normalize/numbers";
import { extractInstrument } from "../normalize/dates";
import type { NormalizedMetadata, ParsedDocument, ParsedProvision, RasdProvisionType } from "../types";
import { detectLegislativeEffects } from "./effects";
import { extractMetadataFromHtml } from "./metadata";

const PARSER_VERSION = "1.0.0";

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(input: string): string {
  return decodeEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/giu, "\n")
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function cleanText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractTitle(text: string, htmlMetadata?: NormalizedMetadata): string | undefined {
  if (htmlMetadata?.title) return htmlMetadata.title;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 180);
  return lines.find((line) => /(نظام|لائحة|تنظيم|قواعد|قرار|مرسوم)/u.test(line)) ?? lines[0];
}

const HEADING_PATTERNS: Array<{ type: RasdProvisionType; pattern: RegExp }> = [
  { type: "CHAPTER", pattern: /^(الباب\s+[^:\n]+|الفصل\s+[^:\n]+)$/u },
  { type: "SECTION", pattern: /^(الفرع\s+[^:\n]+|المبحث\s+[^:\n]+)$/u },
  { type: "APPENDIX", pattern: /^(ملحق|جدول)\s*[:：-]?\s*(.*)$/u }
];

const ARTICLE_START_PATTERNS = [
  /(?:^|\n)\s*(المادة\s+(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|الحادية|[اأإآء-ي\s]+))\s*[:：-]?/gu,
  /(?:^|\n)\s*(المادة\s*\(?\s*[0-9٠-٩۰-۹]+\s*\)?)\s*[:：-]?/gu,
  /(?:^|\n)\s*(مادة\s+رقم\s*\(?\s*[0-9٠-٩۰-۹]+\s*\)?)\s*[:：-]?/gu
];

function articleNumberFromHeading(heading: string): string | undefined {
  const numeric = normalizeDigitsForCompare(heading).match(/[0-9]+/u)?.[0];
  if (numeric) return numeric;

  const ordinalMap: Record<string, string> = {
    الأولى: "1",
    الاولي: "1",
    الثانية: "2",
    الثالثه: "3",
    الثالثة: "3",
    الرابعة: "4",
    الرابعه: "4",
    الخامسة: "5",
    الخامسه: "5",
    السادسة: "6",
    السادسه: "6",
    السابعة: "7",
    السابعه: "7",
    الثامنة: "8",
    الثامنه: "8",
    التاسعة: "9",
    التاسعه: "9",
    العاشرة: "10",
    العاشره: "10"
  };
  const normalized = normalizeForCompare(heading);
  return Object.entries(ordinalMap).find(([word]) => normalized.includes(normalizeForCompare(word)))?.[1];
}

interface ArticleBoundary {
  index: number;
  heading: string;
}

function findArticleBoundaries(text: string): ArticleBoundary[] {
  const byIndex = new Map<number, ArticleBoundary>();
  for (const pattern of ARTICLE_START_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const heading = match[1]?.replace(/\s+/g, " ").trim();
      if (!heading) continue;
      byIndex.set(match.index ?? 0, { index: match.index ?? 0, heading });
    }
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function makeProvision(input: {
  provisionType: RasdProvisionType;
  textRaw: string;
  sequence: number;
  heading?: string;
  articleNumberRaw?: string;
  articleNumberNormalized?: string;
  parentSequence?: number;
  confidence?: number;
}): ParsedProvision {
  const textRaw = cleanText(input.textRaw);
  const textNormalized = normalizeForCompare(textRaw);
  return {
    provisionType: input.provisionType,
    articleNumberRaw: input.articleNumberRaw,
    articleNumberNormalized: input.articleNumberNormalized,
    heading: input.heading,
    textRaw,
    textNormalized,
    textHash: sha256Hex(textNormalized),
    sequence: input.sequence,
    parentSequence: input.parentSequence,
    confidence: input.confidence ?? 0.75
  };
}

function detectContextualSections(text: string, startOfArticles: number): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];
  const preamble = cleanText(text.slice(0, Math.max(0, startOfArticles)));
  if (preamble.length > 30) {
    provisions.push(makeProvision({ provisionType: "PREAMBLE", textRaw: preamble, sequence: 0, confidence: 0.7 }));
  }

  let sequence = provisions.length;
  for (const line of text.split(/\n+/)) {
    const normalizedLine = line.trim();
    if (!normalizedLine) continue;
    const heading = HEADING_PATTERNS.find(({ pattern }) => pattern.test(normalizedLine));
    if (heading) {
      provisions.push(
        makeProvision({
          provisionType: heading.type,
          heading: normalizedLine,
          textRaw: normalizedLine,
          sequence: sequence,
          confidence: 0.85
        })
      );
      sequence += 1;
    }
  }

  return provisions;
}

function provisionTypeForArticleText(text: string): RasdProvisionType {
  if (/يلغ[ىِي]|تلغ[ىِي]|إلغاء|الغاء/u.test(text)) return "REPEAL";
  if (/يعمل\s+به|ينشر|يسري/u.test(text)) return "EFFECT";
  return "ARTICLE";
}

export function parseDocumentStructure(rawTextOrHtml: string, sourceHint: string): ParsedDocument {
  const isHtml = looksLikeHtml(rawTextOrHtml);
  const htmlMetadata = isHtml ? extractMetadataFromHtml(rawTextOrHtml) : undefined;
  const rawText = cleanText(isHtml ? htmlToText(rawTextOrHtml) : rawTextOrHtml);
  const normalizedText = normalizeForCompare(rawText);
  const title = extractTitle(rawText, htmlMetadata);
  const instrument = extractInstrument(rawText);
  const articleBoundaries = findArticleBoundaries(rawText);

  const provisions = detectContextualSections(rawText, articleBoundaries[0]?.index ?? 0);
  let sequence = provisions.length;

  if (articleBoundaries.length > 0) {
    for (let index = 0; index < articleBoundaries.length; index += 1) {
      const current = articleBoundaries[index];
      const next = articleBoundaries[index + 1];
      if (!current) continue;
      const block = rawText.slice(current.index, next?.index).trim();
      const articleNumber = articleNumberFromHeading(current.heading);
      provisions.push(
        makeProvision({
          provisionType: provisionTypeForArticleText(block),
          heading: current.heading,
          articleNumberRaw: current.heading,
          articleNumberNormalized: articleNumber,
          textRaw: block,
          sequence,
          confidence: articleNumber ? 0.92 : 0.78
        })
      );
      sequence += 1;
    }
  } else if (rawText.length > 0) {
    provisions.push(makeProvision({ provisionType: "PREAMBLE", textRaw: rawText, sequence, confidence: 0.45 }));
  }

  const { rawHash, normalizedHash } = dualFingerprints(rawTextOrHtml, normalizedText);
  const metadata: NormalizedMetadata = {
    ...htmlMetadata,
    title: htmlMetadata?.title ?? title,
    normalizedTitle: title ? normalizeForCompare(title) : htmlMetadata?.normalizedTitle,
    sourceCode: sourceHint === "BOE" || sourceHint === "NCAR" || sourceHint === "UQN" ? sourceHint : undefined,
    instrumentType: htmlMetadata?.instrumentType ?? instrument?.type,
    instrumentNumber: htmlMetadata?.instrumentNumber ?? instrument?.number,
    normalizedInstrumentNumber: htmlMetadata?.normalizedInstrumentNumber ?? instrument?.normalizedNumber,
    instrumentDate: htmlMetadata?.instrumentDate ?? instrument?.dateRaw,
    instrumentDateHijri: htmlMetadata?.instrumentDateHijri ?? instrument?.dateHijri,
    instrumentDateGregorian: htmlMetadata?.instrumentDateGregorian ?? instrument?.dateGregorian
  };

  const structureHash = fingerprintObject(
    provisions.map((provision) => ({
      type: provision.provisionType,
      article: provision.articleNumberNormalized,
      heading: provision.heading,
      hash: provision.textHash
    }))
  );

  const articleConfidence = provisions.filter((provision) => provision.provisionType === "ARTICLE").length > 0 ? 0.2 : 0;
  const titleConfidence = metadata.title ? 0.2 : 0;
  const instrumentConfidence = metadata.normalizedInstrumentNumber ? 0.15 : 0;
  const warningPenalty = (metadata.warnings?.length ?? 0) > 0 ? Math.min(0.25, (metadata.warnings?.length ?? 0) * 0.05) : 0;
  const baseConfidence = Math.max(0.1, Math.min(1, 0.45 + articleConfidence + titleConfidence + instrumentConfidence - warningPenalty));

  return {
    title: metadata.title,
    sourceHint,
    rawText,
    normalizedText,
    rawHash,
    normalizedHash,
    structureHash,
    metadata,
    provisions,
    confidence: baseConfidence,
    effects: detectLegislativeEffects(rawText).slice(0, 50)
  };
}

export { PARSER_VERSION };
