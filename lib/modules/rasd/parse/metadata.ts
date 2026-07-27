import type { NormalizedMetadata, RasdDocumentStatus } from "../types";
import { normalizeForCompare } from "../normalize/arabic";
import { extractInstrument, parseHijriGregorianDate } from "../normalize/dates";

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

function findTitle(html: string): string | undefined {
  const og = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/iu)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/iu)?.[1];
  return [og, h1, title].map((value) => (value ? stripTags(value).replace(/\s+/g, " ").trim() : undefined)).find(Boolean);
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

export function extractMetadataFromHtml(html: string): NormalizedMetadata {
  const text = stripTags(html);
  const jsonLd = parseJsonLd(html);
  const title = findTitle(html) ?? asString(jsonLd?.headline) ?? asString(jsonLd?.name);
  const instrument = extractInstrument(text);
  const datePublished = asString(jsonLd?.datePublished) ?? asString(jsonLd?.dateCreated);
  const parsedPublicationDate = datePublished ? parseHijriGregorianDate(datePublished) : parseHijriGregorianDate(text);

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
    publicationDateGregorian: parsedPublicationDate?.gregorian
  };
}
