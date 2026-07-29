import type { NormalizedMetadata, RasdDocumentStatus } from "../types";
import { normalizeForCompare } from "../normalize/arabic";
import { extractInstrument, parseHijriGregorianDate } from "../normalize/dates";
import { easternToWesternDigits } from "../normalize/numbers";

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " "));
}

function findTitleCandidates(html: string): string[] {
  const og = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/iu)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/iu)?.[1];
  const seen = new Set<string>();
  return [og, h1, title]
    .map((value) => (value ? stripTags(value).replace(/\s+/g, " ").trim() : undefined))
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseJsonLd(html: string): Record<string, unknown> | undefined {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu);
  for (const script of scripts) {
    const raw = script[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const article = parsed.find((item): item is Record<string, unknown> => {
          return typeof item === "object" && item !== null && String((item as Record<string, unknown>)["@type"] ?? "").includes("NewsArticle");
        });
        if (article) return article;
      }
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function detectStatus(text: string): RasdDocumentStatus | undefined {
  if (/ملغ[ىي]|ألغي|الغاء|إلغاء/u.test(text)) return "REPEALED";
  if (/معد[ّلل]|تعديل|عدلت/u.test(text)) return "AMENDED";
  if (/موقوف|تعليق|يعلق/u.test(text)) return "SUSPENDED";
  if (/ساري|نافذ|معمول\s+به/u.test(text)) return "ACTIVE";
  return undefined;
}

export function extractUqnPublicationFields(text: string): {
  uqnIssue?: string;
  publicationDateRaw?: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const issueMatch =
    text.match(/(?:أم\s+القرى|ام\s+القرى)[^.\n،]{0,40}العدد\s*(?:رقم)?\s*\(?\s*([0-9٠-٩۰-۹]{3,6})\s*\)?/u) ??
    text.match(/العدد\s*(?:رقم)?\s*\(?\s*([0-9٠-٩۰-۹]{3,6})\s*\)?/u);
  const decreeLike = text.match(/(مرسوم|قرار|أمر|امر)\s*(?:ملكي|وزاري|مجلس\s+الوزراء)?\s*(?:رقم)?\s*\(?\s*([أ-يA-Za-z]?\/?[0-9٠-٩۰-۹]+)/u);
  const dateMatch = text.match(/(?:تاريخ\s+النشر|نشر\s+في|الصادر\s+في|بتاريخ)\s*[:：]?\s*([^.\n،]{6,40})/u);

  const uqnIssue = issueMatch?.[1] ? easternToWesternDigits(issueMatch[1]) : undefined;
  if (uqnIssue && decreeLike?.[2] && easternToWesternDigits(decreeLike[2]).replace(/\D/g, "") === uqnIssue.replace(/\D/g, "")) {
    warnings.push("UQN_ISSUE_MAY_COLLIDE_WITH_INSTRUMENT_NUMBER");
  }
  if (issueMatch && !/(?:أم\s+القرى|ام\s+القرى)/u.test(issueMatch[0]) && !/(?:أم\s+القرى|ام\s+القرى)/u.test(text.slice(Math.max(0, (issueMatch.index ?? 0) - 40), (issueMatch.index ?? 0) + issueMatch[0].length))) {
    warnings.push("UQN_ISSUE_WITHOUT_EXPLICIT_UMM_AL_QURA_CONTEXT");
  }

  return {
    uqnIssue,
    publicationDateRaw: dateMatch?.[1]?.trim(),
    warnings
  };
}

export function extractMetadataFromHtml(html: string): NormalizedMetadata {
  const text = stripTags(html);
  const jsonLd = parseJsonLd(html);
  const titleCandidates = findTitleCandidates(html);
  const jsonLdHeadline = asString(jsonLd?.headline);
  const jsonLdName = asString(jsonLd?.name);
  const title = titleCandidates[0] ?? jsonLdHeadline ?? jsonLdName;
  const instrumentCandidates = [...titleCandidates, jsonLdHeadline, jsonLdName, text].filter((value): value is string => Boolean(value));
  const instrument = instrumentCandidates.map((candidate) => extractInstrument(candidate)).find(Boolean);
  const uqnPublication = extractUqnPublicationFields([title, text].filter(Boolean).join("\n"));
  const datePublished = asString(jsonLd?.datePublished) ?? asString(jsonLd?.dateCreated);
  const parsedPublicationDate = datePublished
    ? parseHijriGregorianDate(datePublished)
    : uqnPublication.publicationDateRaw
      ? parseHijriGregorianDate(uqnPublication.publicationDateRaw)
      : parseHijriGregorianDate(text);

  const warnings = [...uqnPublication.warnings];
  if (!title) warnings.push("MISSING_TITLE");
  if (title && /^https?:\/\//i.test(title)) warnings.push("TITLE_LOOKS_LIKE_URL");
  if (!instrument?.number) warnings.push("MISSING_INSTRUMENT_NUMBER");
  if (!instrument?.type) warnings.push("MISSING_INSTRUMENT_TYPE");
  if (!parsedPublicationDate) warnings.push("MISSING_PUBLICATION_DATE");
  // Never invent values — leave null/undefined and surface warnings.

  return {
    title,
    normalizedTitle: title ? normalizeForCompare(title) : undefined,
    status: detectStatus(text),
    instrumentType: instrument?.type,
    instrumentNumber: instrument?.number,
    normalizedInstrumentNumber: instrument?.normalizedNumber,
    instrumentDate: instrument?.dateRaw,
    instrumentDateHijri: instrument?.dateHijri,
    instrumentDateGregorian: instrument?.dateGregorian,
    publicationDate: parsedPublicationDate?.raw,
    publicationDateHijri: parsedPublicationDate?.hijri,
    publicationDateGregorian: parsedPublicationDate?.gregorian,
    uqnIssue: uqnPublication.uqnIssue,
    warnings: warnings.length ? warnings : undefined
  };
}
